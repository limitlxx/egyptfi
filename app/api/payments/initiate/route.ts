// app/api/payment/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import pool from '@/lib/db'
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers'
import QRCode from 'qrcode'

// Validation schema for the request body
const PaymentInitiateSchema = z.object({
  payment_ref: z.string().min(1, 'Payment reference is required'),
  local_amount: z.number().positive('Amount must be positive'),
  local_currency: z.string().min(3, 'Currency code must be at least 3 characters'),
  description: z.string().optional(),
  chain: z.enum(['ethereum', 'starknet', 'base', 'arbitrum', 'polygon']).optional(),
  secondary_endpoint: z.string().url().optional(),
  email: z.string().min(1, 'Email is required'),
  // metadata: z.enum(['cancel_action']).optional(),
})

// Generate QR code as base64 data URL
async function generateQRCode(paymentUrl: string): Promise<string> {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(paymentUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    return qrCodeDataURL
  } catch (error) {
    console.error('QR code generation failed:', error)
    throw new Error('Failed to generate QR code')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, walletAddress, environment } = getAuthHeaders(request)
    
    if (!apiKey || !walletAddress || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, walletAddress, environment)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate the request body
    const validatedData = PaymentInitiateSchema.parse(body)
    
    const {
      payment_ref,
      local_amount,
      local_currency,
      description,
      chain,
      secondary_endpoint,
      email,
      // metadata
    } = validatedData

    // Check if payment_ref already exists for this merchant
    const client = await pool.connect()
    try {
      const existingInvoice = await client.query(
        'SELECT id FROM invoices WHERE merchant_id = $1 AND payment_ref = $2',
        [authResult.merchant!.id, payment_ref]
      )

      if (existingInvoice.rows.length > 0) {
        return NextResponse.json(
          { error: 'Payment reference already exists' },
          { status: 409 }
        )
      }

      // Create the hosted payment URL
      const hostedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${payment_ref}`
      
      // Generate QR code for the hosted URL
      const qrCode = await generateQRCode(hostedUrl)
      
      // Calculate expiry time (24 hours from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      console.log("LOCAL AMOUNT", local_amount);
      

      // Insert new invoice into database using your existing schema
      const result = await client.query(
        `INSERT INTO invoices 
          (merchant_id, payment_ref, local_amount, local_currency, description, chains, secondary_endpoint, qr_url, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW()) 
         RETURNING *`,
        [
          authResult.merchant!.id,
          payment_ref,
          local_amount,
          local_currency,
          description || null,
          chain || 'starknet',
          secondary_endpoint || null,
          qrCode,
        ]
      )

      const invoice = result.rows[0]

      // Call secondary endpoint if provided (fire and forget)
      if (secondary_endpoint) {
        fetch(secondary_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'payment_initiated',
            payment_ref,
            invoice_id: invoice.id,
            amount: local_amount,
            currency: local_currency,
            hosted_url: hostedUrl,
            timestamp: invoice.created_at,
          }),
        }).catch(error => {
          console.error('Failed to call secondary endpoint:', error)
        })
      }

      // Return the response in the exact format you requested
      return NextResponse.json({
        reference: payment_ref,
        authorization_url: hostedUrl,
        qr_code: qrCode,
        expires_at: expiresAt.toISOString()
      }, { status: 201 })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Payment initiate error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Optional: GET method to retrieve invoice status by payment_ref
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const payment_ref = searchParams.get('payment_ref')
    
    if (!payment_ref) {
      return NextResponse.json(
        { error: "payment_ref parameter is required" },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT *, m.business_name, m.business_logo, m.business_email, m.webhook FROM invoices i
            JOIN merchants m ON i.merchant_id = m.id
            WHERE i.payment_ref = $1`,
        [payment_ref]
      )

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        )
      }

      const hostedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${payment_ref}`
      
      // Generate QR code for the hosted URL
      const qrCode = await generateQRCode(hostedUrl)

      const invoice = result.rows[0]
      
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
          qrCode
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}