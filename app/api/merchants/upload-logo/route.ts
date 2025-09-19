import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, environment } = getAuthHeaders(request);
    
    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const merchantId = authResult.merchant!.id;
    const fileExtension = file.name.split('.').pop();
    const fileName = `merchant_${merchantId}_${timestamp}.${fileExtension}`;

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos');
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
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE merchants SET business_logo = $1, updated_at = NOW() WHERE id = $2',
        [logoUrl, merchantId]
      );
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      logoUrl: logoUrl,
      message: 'Logo uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}