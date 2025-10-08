import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { authenticateApiKey, getAuthHeaders } from "@/lib/auth-helpers";

/**
 * GET invoices for the authenticated merchant
 */
export async function GET(request: NextRequest) {
  try {
    const { apiKey, environment } = getAuthHeaders(request);

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
      const result = await client.query(
        `SELECT * FROM invoices WHERE merchant_id = $1 ORDER BY created_at DESC`,
        [authResult.merchant!.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json([]);
      }

      return NextResponse.json(
        result.rows.map((inv) => ({
          ref: inv.payment_ref,
          amount: inv.local_amount,
          currency: inv.local_currency,
          description: inv.description,
          tokenPaid: inv.token_amount,
          chain: inv.chains,
          status: inv.status,
          txHash: inv.tx_hash,
          date: inv.created_at,
          hostedUrl: inv.secondary_endpoint,
        }))
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST create new invoice
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
      payment_ref,
      local_amount,
      local_currency,
      description,
      chain,
      secondary_endpoint,
    } = body;

    if (!payment_ref || !local_amount || !local_currency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO invoices 
          (merchant_id, payment_ref, local_amount, local_currency, description, chains, secondary_endpoint,environment, status, created_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, 'pending', NOW()) 
         RETURNING *`,
        [
          authResult.merchant!.id,
          payment_ref,
          local_amount,
          local_currency,
          description,
          chain,
          secondary_endpoint,
          environment,
        ]
      );

      return NextResponse.json(
        { success: true, invoice: result.rows[0] },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

/**
 * PUT update invoice
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
      "payment_ref",
      "secondary_ref",
      "access_code",
      "status",
      "local_amount",
      "usdc_amount",
      "token_amount",
      "payment_token",
      "local_currency",
      "chain",
      "receipt_number",
      "secondary_endpoint",
      "paid_at",
      "ip_address",
      "metadata",
      "channel",
      "tx_hash",
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramCount}`);
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

    // must pass invoice id in body
    if (!updates.id) {
      return NextResponse.json(
        { error: "Invoice id is required" },
        { status: 400 }
      );
    }

    values.push(authResult.merchant!.id);
    values.push(updates.id);

    const client = await pool.connect();
    try {
      const query = `
        UPDATE invoices
        SET ${setFields.join(", ")}, updated_at = NOW()
        WHERE merchant_id = $${paramCount} AND id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, invoice: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}
