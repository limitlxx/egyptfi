// app/api/payment/initiate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { authenticateApiKey, getAuthHeaders } from "@/lib/auth-helpers";
import QRCode from "qrcode";
import {
  createTransaction,
  invokeContractFunction,
} from "@/lib/starknetService";
import { cairo, shortString, uint256 } from "starknet";

const DECIMALS = 6; // USDC decimals

// Validation schema for the request body
const PaymentInitiateSchema = z.object({
  payment_ref: z.string().min(1, "Payment reference is required"),
  local_amount: z.number().positive("Amount must be positive"),
  local_currency: z
    .string()
    .min(3, "Currency code must be at least 3 characters"),
  description: z.string().optional(),
  chain: z
    .enum(["ethereum", "starknet", "base", "arbitrum", "polygon", "bitcoin"])
    .optional(),
  secondary_endpoint: z.string().url().optional(),
  email: z.string().min(1, "Email is required"),
  // metadata: z.enum(['cancel_action']).optional(),
});

// Generate QR code as base64 data URL
async function generateQRCode(paymentUrl: string): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(paymentUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR code generation failed:", error);
    throw new Error("Failed to generate QR code");
  }
}

// helper to prepare the exact calldata expected by create_payment
function prepareCreatePaymentCalldata({
  merchantAddress,
  amountStr, // decimal string like "100.5" or already in smallest units
  decimals = DECIMALS,
  fee,
  reference, // felt decimal/hex string
  description, // plain UTF-8 string
}: {
  merchantAddress: string;
  amountStr: string;
  decimals?: number;
  reference: string;
  fee: any;
  description: string;
}) {
  // 1) scale amount to smallest integer units (USDC: 6 decimals)
  //    If caller already passed smallest-units integer string, this still works.
  const scaled = BigInt(Math.round(Number(amountStr) * 10 ** decimals));
  const u = cairo.uint256(scaled); // gives { low: BigInt, high: BigInt }

  // convert to hex/felt strings
  const low = "0x" + u.low.toString(16);
  const high = "0x" + u.high.toString(16);

  // 2) ensure reference is a single felt: passed as hex or decimal string
  // if decimal string, convert to hex felt
  const referenceFelt = shortString.encodeShortString(reference);

  // 3) encode description as a single short-string felt
  const descriptionFelt = shortString.encodeShortString(description);

  const scaledAmount = BigInt(
    Math.floor(parseFloat(amountStr) * 10 ** decimals)
  );

  const scaledFee = BigInt(Math.floor(parseFloat(fee) * 10 ** decimals));

  // const amount = BigInt(amountStr);
  // const platformFee = amount / 5n; // example: 1% fee — adjust as needed

  // Convert both amount and platform fee to Uint256
  const amountUint = uint256.bnToUint256(scaledAmount);
  const feeUint = uint256.bnToUint256(scaledFee);

  // const calldata = [
  //   merchantAddress,
  //   // low,
  //   // high,
  //   // fee,
  //   referenceFelt,
  //   descriptionFelt,
  // ];

  // // final validation
  // if (calldata.length !== 5) {
  //   throw new Error("Prepared calldata has incorrect length");
  // }
  // return calldata;
  return {
    merchant: merchantAddress,
    amount: amountUint,
    platform_fee: feeUint,
    reference: shortString.encodeShortString(reference),
    description: shortString.encodeShortString(description),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, environment } = getAuthHeaders(request);

    console.log("Headers:", { apiKey, environment });

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();

    // Validate the request body
    const validatedData = PaymentInitiateSchema.parse(body);

    const {
      payment_ref,
      local_amount,
      local_currency,
      description,
      chain,
      secondary_endpoint,
      email,
      // metadata
    } = validatedData;

    // Check if payment_ref already exists for this merchant
    if (payment_ref.length < 5) {
      var ref = `egyptfi-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    } else {
      var ref = payment_ref;
    }
    const client = await pool.connect();

    console.log("Initiating payment...");

    try {
      const existingInvoice = await client.query(
        `SELECT *, m.business_name, m.wallet_address, m.business_logo, m.business_email, m.webhook FROM invoices i
            JOIN merchants m ON i.merchant_id = m.id WHERE i.merchant_id = $1 AND i.payment_ref = $2`,
        [authResult.merchant!.id, ref]
      );

      if (existingInvoice.rows.length > 0) {
        return NextResponse.json(
          { error: "Payment reference already exists" },
          { status: 409 }
        );
      }

      var new_secondary_endpoint = "";
      if (!secondary_endpoint || secondary_endpoint == "") {
        new_secondary_endpoint = existingInvoice.rows[0]?.webhook || "";
      } else {
        new_secondary_endpoint = secondary_endpoint;
      }

      // Create the hosted payment URL
      const hostedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${ref}`;
      const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay?ref=${ref}`;

      // Generate QR code for the hosted URL
      const qrCode = await generateQRCode(paymentUrl);

      // Calculate expiry time (24 hours from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const feeRate = 0.005; // 1.08%

      const total_amount = local_amount + local_amount * feeRate;
      const fee = local_amount * feeRate;

      console.log({ total_amount, local_amount, fee: local_amount * feeRate });
      console.log("public_key:", { ref, description, total_amount });

      // Insert new invoice into database using your existing schema
      const result = await client.query(
        `INSERT INTO invoices 
          (merchant_id, payment_ref, local_amount, local_currency, description, chains, secondary_endpoint, qr_url, payment_endpoint, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW()) 
         RETURNING *`,
        [
          authResult.merchant!.id,
          ref,
          total_amount,
          local_currency,
          description || null,
          chain || "starknet",
          new_secondary_endpoint || null,
          qrCode,
          paymentUrl,
        ]
      );

      const invoice = result.rows[0];

      const merchantAddress = authResult.merchant!.walletAddress; // Handle possible field name variance

      const innerCalldata = prepareCreatePaymentCalldata({
        merchantAddress,
        amountStr: total_amount.toString(),
        decimals: DECIMALS,
        fee: fee,
        reference: ref,
        description: description || "Ecommerce Purchase",
      });

      // // Execute on-chain  invokeContractFunction undefined,
      const { transaction_hash, paymentId } = await invokeContractFunction(
        authResult.merchant!.id,
        undefined,
        "create_payment",
        innerCalldata
      );

      console.log("Transaction hash:", transaction_hash);

      await client.query(
        "UPDATE invoices SET tx_hash = $1, payment_id = $2 WHERE payment_ref = $3",
        [transaction_hash, paymentId, ref]
      );

      // Call secondary endpoint if provided (fire and forget)
      if (secondary_endpoint) {
        fetch(secondary_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "payment_initiated",
            payment_ref,
            invoice_id: invoice.id,
            amount: local_amount,
            currency: local_currency,
            hosted_url: hostedUrl,
            timestamp: invoice.created_at,
          }),
        }).catch((error) => {
          console.error("Failed to call secondary endpoint:", error);
        });
      }

      // Return the response in the exact format you requested
      return NextResponse.json(
        {
          reference: invoice.payment_ref,
          authorization_url: hostedUrl,
          qr_code: invoice.qr_url,
          expires_at: expiresAt.toISOString(),
          tx_hash: transaction_hash,
        },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `"Internal server error" ${error}` },
      { status: 500 }
    );
  }
}

// Optional: GET method to retrieve invoice status by payment_ref
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payment_ref = searchParams.get("payment_ref");

    if (!payment_ref) {
      return NextResponse.json(
        { error: "payment_ref parameter is required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT *, m.business_name, m.business_logo, m.business_email, m.webhook, m.wallet_address, m.preferred_btc_flow FROM invoices i
            JOIN merchants m ON i.merchant_id = m.id
            WHERE i.payment_ref = $1`,
        [payment_ref]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      const hostedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay?ref=${payment_ref}`;

      // Generate QR code for the hosted URL
      const qrCode = await generateQRCode(hostedUrl);

      const invoice = result.rows[0];

      return NextResponse.json({
        success: true,
        data: {
          merchant_name: invoice.business_name,
          merchant_logo: invoice.business_logo,
          payment_ref: invoice.payment_ref,
          status: invoice.status,
          amount: invoice.local_amount,
          currency: invoice.local_currency,
          description: invoice.description,
          chain: invoice.chain,
          created_at: invoice.created_at,
          paid_at: invoice.paid_at,
          tx_hash: invoice.tx_hash,
          paymentUrl: invoice.payment_endpoint,
          walletUrl: `${invoice.payment_endpoint}&redirect=${invoice.secondary_endpoint}`,
          secondaryEndpoint: invoice.secondary_endpoint,
          merchant_address: invoice.wallet_address,
          preferred_btc_flow: invoice.preferred_btc_flow,
          qrCode,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
