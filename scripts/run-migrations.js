#!/usr/bin/env node

/**
 * Database Migration Runner for ChipiPay Integration
 * 
 * This script runs database migrations in the correct order and tracks
 * which migrations have been applied.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async createMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON schema_migrations(applied_at);
    `;

    await this.pool.query(createTableSQL);
    console.log('✅ Schema migrations table ready');
  }

  async getMigrationFiles() {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && !file.startsWith('rollback_'))
      .sort();

    console.log(`📁 Found ${files.length} migration files`);
    return files.map(file => ({
      filename: file,
      version: file.replace('.sql', ''),
      path: path.join(migrationsDir, file)
    }));
  }

  async getAppliedMigrations() {
    const { rows } = await this.pool.query(
      'SELECT version, applied_at, checksum FROM schema_migrations ORDER BY version'
    );
    return rows;
  }

  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async validateMigrationIntegrity(migration, appliedMigration) {
    const content = fs.readFileSync(migration.path, 'utf8');
    const currentChecksum = this.calculateChecksum(content);

    if (appliedMigration.checksum && appliedMigration.checksum !== currentChecksum) {
      throw new Error(
        `Migration ${migration.version} has been modified since it was applied. ` +
        `Expected checksum: ${appliedMigration.checksum}, ` +
        `Current checksum: ${currentChecksum}`
      );
    }

    return currentChecksum;
  }

  async runMigration(migration) {
    const content = fs.readFileSync(migration.path, 'utf8');
    const checksum = this.calculateChecksum(content);
    const startTime = Date.now();

    console.log(`🔄 Applying ${migration.filename}...`);

    await this.pool.query('BEGIN');

    try {
      // Execute the migration
      await this.pool.query(content);

      // Record the migration
      const executionTime = Date.now() - startTime;
      await this.pool.query(
        `INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms) 
         VALUES ($1, NOW(), $2, $3)`,
        [migration.version, checksum, executionTime]
      );

      await this.pool.query('COMMIT');
      
      console.log(`✅ Applied ${migration.filename} (${executionTime}ms)`);
      return true;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      console.error(`❌ Failed to apply ${migration.filename}:`, error.message);
      throw error;
    }
  }

  async runMigrations(options = {}) {
    const { dryRun = false, targetVersion = null } = options;

    console.log('🚀 Starting database migrations...\n');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    try {
      // Create migrations table if it doesn't exist
      if (!dryRun) {
        await this.createMigrationsTable();
      }

      // Get migration files and applied migrations
      const migrationFiles = await this.getMigrationFiles();
      const appliedMigrations = dryRun ? [] : await this.getAppliedMigrations();
      
      // Create a map of applied migrations for quick lookup
      const appliedMap = new Map(
        appliedMigrations.map(m => [m.version, m])
      );

      let migrationsToRun = [];
      let skippedCount = 0;

      // Determine which migrations to run
      for (const migration of migrationFiles) {
        // Stop if we've reached the target version
        if (targetVersion && migration.version > targetVersion) {
          console.log(`🛑 Stopping at target version: ${targetVersion}`);
          break;
        }

        const appliedMigration = appliedMap.get(migration.version);

        if (appliedMigration) {
          // Validate integrity of already applied migration
          if (!dryRun) {
            await this.validateMigrationIntegrity(migration, appliedMigration);
          }
          console.log(`⏭️  Skipping ${migration.filename} (already applied on ${appliedMigration.applied_at})`);
          skippedCount++;
        } else {
          migrationsToRun.push(migration);
        }
      }

      console.log(`\n📊 Migration Summary:`);
      console.log(`   Total migrations: ${migrationFiles.length}`);
      console.log(`   Already applied: ${skippedCount}`);
      console.log(`   To be applied: ${migrationsToRun.length}`);

      if (migrationsToRun.length === 0) {
        console.log('\n✅ No migrations to run. Database is up to date.');
        return;
      }

      if (dryRun) {
        console.log('\n📋 Migrations that would be applied:');
        migrationsToRun.forEach(m => console.log(`   - ${m.filename}`));
        return;
      }

      // Run pending migrations
      console.log('\n🔄 Applying migrations...\n');
      
      for (const migration of migrationsToRun) {
        await this.runMigration(migration);
      }

      console.log(`\n🎉 Successfully applied ${migrationsToRun.length} migration(s)`);

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      
      if (error.detail) {
        console.error(`   Details: ${error.detail}`);
      }

      throw error;
    }
  }

  async getMigrationStatus() {
    console.log('📊 Migration Status Report\n');

    try {
      await this.createMigrationsTable();
      
      const migrationFiles = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      
      const appliedMap = new Map(
        appliedMigrations.map(m => [m.version, m])
      );

      console.log('Migration Status:');
      console.log('-'.repeat(80));
      console.log('Version'.padEnd(40) + 'Status'.padEnd(15) + 'Applied At');
      console.log('-'.repeat(80));

      for (const migration of migrationFiles) {
        const applied = appliedMap.get(migration.version);
        const status = applied ? '✅ Applied' : '⏳ Pending';
        const appliedAt = applied ? applied.applied_at.toISOString() : '-';
        
        console.log(
          migration.version.padEnd(40) + 
          status.padEnd(15) + 
          appliedAt
        );
      }

      console.log('-'.repeat(80));
      console.log(`Total: ${migrationFiles.length} migrations, ${appliedMigrations.length} applied, ${migrationFiles.length - appliedMigrations.length} pending`);

    } catch (error) {
      console.error('❌ Failed to get migration status:', error.message);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'run':
        const dryRun = args.includes('--dry-run');
        const targetIndex = args.indexOf('--target');
        const targetVersion = targetIndex !== -1 ? args[targetIndex + 1] : null;
        
        await runner.runMigrations({ dryRun, targetVersion });
        break;

      case 'status':
        await runner.getMigrationStatus();
        break;

      case 'help':
        console.log(`
ChipiPay Integration Migration Runner

Usage:
  node scripts/run-migrations.js [command] [options]

Commands:
  run      Run pending migrations (default)
  status   Show migration status
  help     Show this help message

Options:
  --dry-run           Show what would be migrated without applying changes
  --target VERSION    Run migrations up to specified version

Examples:
  node scripts/run-migrations.js
  node scripts/run-migrations.js run --dry-run
  node scripts/run-migrations.js run --target 002_create_chipipay_config_and_logging_tables
  node scripts/run-migrations.js status
        `);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('Run "node scripts/run-migrations.js help" for usage information');
        process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration runner failed:', error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { MigrationRunner };