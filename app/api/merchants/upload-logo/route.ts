import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@clerk/nextjs/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find merchant by Clerk user ID
    const client = await pool.connect();
    let merchantId: string;

    try {
      const merchantResult = await client.query(
        "SELECT id FROM merchants WHERE clerk_user_id = $1",
        [userId]
      );

      if (merchantResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Merchant not found" },
          { status: 404 }
        );
      }

      merchantId = merchantResult.rows[0].id;
    } finally {
      client.release();
    }

    const formData = await request.formData();
    const file = formData.get("logo") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const fileName = `merchant_${merchantId}_${timestamp}.${fileExtension}`;

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), "public", "uploads", "logos");
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
    }

    // Save file
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);

    // Create public URL
    const logoUrl = `/uploads/logos/${fileName}`;

    // Update database with new logo URL
    const updateClient = await pool.connect();
    try {
      await updateClient.query(
        "UPDATE merchants SET business_logo = $1, updated_at = NOW() WHERE id = $2",
        [logoUrl, merchantId]
      );
    } finally {
      updateClient.release();
    }

    return NextResponse.json({
      success: true,
      logoUrl: logoUrl,
      message: "Logo uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading logo:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
