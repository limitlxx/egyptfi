import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { authenticateApiKey, getAuthHeaders } from "@/lib/auth-helpers";

/**
 * GET transactions for the authenticated merchant
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { apiKey, environment } = getAuthHeaders(request);
    console.log(apiKey);
    console.log(environment);

    if (!apiKey || !environment) {
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

    const client = await pool.connect();
    try {
      const merchantId = authResult.merchant!.id;
      const isStats = searchParams.get("stats") === "true";

      if (isStats) {
        // Compute stats assuming 'success' status indicates a successful transaction
        const statsQuery = `
          SELECT 
            COUNT(*) as total_payments,
            SUM(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) as current_month_payments,
            CASE 
              WHEN COUNT(*) > 0 
              THEN (SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) * 100) 
              ELSE 0 
            END as success_rate
          FROM transactions 
          WHERE merchant_id = $1
        `;
        const statsResult = await client.query(statsQuery, [merchantId]);
        return NextResponse.json(statsResult.rows[0]);
      } else {
        const result = await client.query(
          `SELECT * FROM transactions WHERE merchant_id = $1 ORDER BY created_at DESC`,
          [merchantId]
        );

        if (result.rows.length === 0) {
          return NextResponse.json([]);
        }

        return NextResponse.json(
          result.rows.map((tx) => ({
            id: tx.id,
            amount: tx.currency_amount,
            walletAmount: tx.wallet_amount,
            altAmount: tx.alt_amount,
            toAddress: tx.to_address,
            status: tx.status,
            txHash: tx.txhash,
            gasSponsored: tx.gassponsored,
            date: tx.created_at,
          }))
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching transactions or stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST create new transaction
 */
export async function POST(request: NextRequest) {
  try {
    const { apiKey, environment } = getAuthHeaders(request);
    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const {
      currency_amount,
      wallet_amount,
      alt_amount,
      to_address,
      status,
      txHash,
      gasSponsored,
    } = body;

    if (!currency_amount || !wallet_amount || !to_address || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO transactions
          (merchant_id, currency_amount, wallet_amount, alt_amount, to_address, status, "txHash", "gasSponsored", created_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         RETURNING *`,
        [
          authResult.merchant!.id,
          currency_amount,
          wallet_amount,
          alt_amount ?? null,
          to_address,
          status,
          txHash ?? null,
          gasSponsored ?? false,
        ]
      );

      return NextResponse.json(
        { success: true, transaction: result.rows[0] },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

/**
 * PUT update transaction
 */
export async function PUT(request: NextRequest) {
  try {
    const { apiKey, environment } = getAuthHeaders(request);
    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const updates = await request.json();

    const allowedFields = [
      "currency_amount",
      "wallet_amount",
      "alt_amount",
      "to_address",
      "status",
      "txHash",
      "gasSponsored",
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        // normalize to DB column names
        let column = key;
        if (key === "txHash") column = "txhash";
        // if (key === "txHash") column = "txhash";
        if (key === "gasSponsored") column = "gassponsored";

        setFields.push(`${column} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setFields.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    if (!updates.id) {
      return NextResponse.json(
        { error: "Transaction id is required" },
        { status: 400 }
      );
    }

    values.push(authResult.merchant!.id);
    values.push(updates.id);

    const client = await pool.connect();
    try {
      const query = `
        UPDATE transactions
        SET ${setFields.join(", ")}, timestamp = NOW()
        WHERE merchant_id = $${paramCount} AND id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, transaction: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
