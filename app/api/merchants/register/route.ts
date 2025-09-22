import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import pool from "@/lib/db";
import { generateApiKeys, hashSecretKey, generateJWT } from "@/lib/jwt";

interface MerchantRegistrationData {
  business_name?: string;
  business_email: string;
  business_type?: string;
  monthly_volume?: string;
  wallet_address?: string;
  authMethod?: "wallet" | "google";
  local_currency?: string;
  transaction_hash?: string;
  clerk_user_id?: string;
  pin?: string;
}

export async function POST(request: NextRequest) {
  console.log("POST route to register merchant");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const data: MerchantRegistrationData = await request.json();
    console.log("Merchant Data", data);

    // Get Clerk authentication info
    const { userId } = await auth();
    
    // For signup flow, we expect clerk_user_id in the request body
    // For authenticated requests, we use the userId from auth()
    const clerkUserId = data.clerk_user_id || userId;

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!data.business_email) {
      return NextResponse.json(
        { error: "Business email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.business_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if merchant already exists by email or Clerk user ID
    const existingMerchant = await client.query(
      "SELECT id, business_email, clerk_user_id FROM merchants WHERE business_email = $1 OR clerk_user_id = $2",
      [data.business_email, clerkUserId]
    );

    if (existingMerchant.rows.length > 0) {
      const existing = existingMerchant.rows[0];
      if (existing.clerk_user_id === clerkUserId) {
        // Return existing merchant data for this Clerk user
        const testnetKeys = generateApiKeys(existing.id, "testnet");
        const testnetJWT = generateJWT({
          merchantId: existing.id,
          walletAddress: "",
          environment: "testnet",
        });

        return NextResponse.json({
          success: true,
          message: "Merchant account found",
          merchant: {
            id: existing.id,
            business_email: existing.business_email,
          },
          apiKeys: {
            publicKey: testnetKeys.publicKey,
            jwt: testnetJWT,
          },
        });
      } else {
        return NextResponse.json(
          { error: "Email already registered with different account" },
          { status: 409 }
        );
      }
    }

    // Create new merchant with Clerk user ID
    const merchantResult = await client.query(
      `INSERT INTO merchants (business_email, local_currency, supported_currencies, 
        is_verified, clerk_user_id, business_name, business_type, monthly_volume
      ) VALUES ($1, $2, $3, true, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        data.business_email,
        data.local_currency || "NGN",
        ["USDC", "ETH", "STRK", "BTC"],
        clerkUserId,
        data.business_name || "New Business",
        data.business_type || "retail",
        data.monthly_volume || "0-1000",
      ]
    );

    const newMerchant = merchantResult.rows[0];

    console.log("Merchant", newMerchant);

    // Generate API keys for both testnet and mainnet (only here)
    const testnetKeys = generateApiKeys(newMerchant.id, "testnet");
    const mainnetKeys = generateApiKeys(newMerchant.id, "mainnet");

    // Generate JWTs
    const testnetJWT = generateJWT({
      merchantId: newMerchant.id,
      walletAddress: newMerchant.wallet_address || "",
      environment: "testnet",
    });
    const mainnetJWT = generateJWT({
      merchantId: newMerchant.id,
      walletAddress: newMerchant.wallet_address || "",
      environment: "mainnet",
    });

    // Store API keys in database (hashed secret)
    await client.query(
      `INSERT INTO api_keys (merchant_id, secret_key, public_key, created_at) VALUES
       ($1, $2, $3, NOW()),
       ($1, $4, $5, NOW())`,
      [
        newMerchant.id,
        hashSecretKey(testnetKeys.secretKey),
        testnetKeys.publicKey,
        hashSecretKey(mainnetKeys.secretKey),
        mainnetKeys.publicKey,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Merchant account created successfully.",
      merchant: {
        id: newMerchant.id,
        business_name: data.business_name,
        business_email: data.business_email,
        wallet_address: newMerchant.wallet_address,
        createdAt: newMerchant.created_at,
      },
      apiKeys: {
        publicKey: testnetKeys.publicKey,
        jwt: testnetJWT,
        // testnet: {
        //   publicKey: testnetKeys.publicKey,
        //   secretKey: testnetKeys.secretKey, // Unhashed, sent only once
        //   jwt: testnetJWT
        // },
        // mainnet: {
        //   publicKey: mainnetKeys.publicKey,
        //   secretKey: mainnetKeys.secretKey, // Unhashed, sent only once
        //   jwt: mainnetJWT
        // }
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating merchant:", error);
    return NextResponse.json(
      { error: "Failed to create merchant account" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
