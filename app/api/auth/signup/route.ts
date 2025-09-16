import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/lib/db";

interface SignupRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password }: SignupRequest = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if user already exists
      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 409 }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id, email, created_at`,
        [email.toLowerCase(), hashedPassword]
      );

      const newUser = userResult.rows[0];

      await client.query("COMMIT");

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
        },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "7d" }
      );

      // Create response
      const response = NextResponse.json({
        success: true,
        message: "User created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.created_at,
        },
      });

      // Set HTTP-only cookie with the token
      response.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
