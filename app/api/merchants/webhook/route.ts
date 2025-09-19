import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { authenticateApiKey, getAuthHeaders } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) { 

  try {
    const { apiKey, environment } = getAuthHeaders(request);

    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(
      apiKey,    
      environment
    );

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { webhookUrl } = await request.json();
    console.log("Payload webhook", webhookUrl);
    
    if (!webhookUrl) { //|| !/^https:\/\//.test(webhookUrl)
      return NextResponse.json(
        { error: "Valid HTTPS webhook URL required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE merchants SET webhook = $1 WHERE id = $2", [
        webhookUrl,
        authResult.merchant!.id,
      ]);
      await client.query("COMMIT");
      return NextResponse.json({ success: true, webhookUrl });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating webhook URL:", error);
    return NextResponse.json(
      { error: "Failed to update webhook URL" },
      { status: 500 }
    );
  }
}
