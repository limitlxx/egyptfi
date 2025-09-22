#!/usr/bin/env node

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Database configuration from environment variables
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "admin",
  database: process.env.DB_NAME || "egyptfi",
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("Running Clerk integration migration...");

    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "../database/add_clerk_user_id.sql"),
      "utf8"
    );

    // Execute the migration
    await client.query(migrationSQL);

    console.log("✅ Migration completed successfully!");
    console.log("Added clerk_user_id column to merchants table");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
