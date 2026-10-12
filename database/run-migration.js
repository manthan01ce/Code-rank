#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * Executes SQL migration files against the Neon Postgres database.
 * Reads DATABASE_URL from environment variables (.env file).
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.error('   Please set it in your .env file or as an environment variable');
  process.exit(1);
}

// Mask password in URL for logging
function maskConnectionString(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '[invalid URL]';
  }
}

console.log('🔧 CodeRank Database Migration Runner');
console.log('=====================================\n');
console.log('📡 Connecting to:', maskConnectionString(DATABASE_URL));

async function runMigrations() {
  let sql;
  
  try {
    // Initialize Neon client with connection pooling
    sql = neon(DATABASE_URL, {
      fetchConnectionCache: true,
      poolQueryViaFetch: true
    });
    
    // Test connection
    await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }

  // Read migration files
  const migrationsDir = join(__dirname, 'migrations');
  let files;
  
  try {
    files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
  } catch (error) {
    console.error('❌ Failed to read migrations directory:', error.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('⚠️  No migration files found in', migrationsDir);
    process.exit(0);
  }

  console.log(`📂 Found ${files.length} migration file(s):\n`);

  // Execute each migration
  let successCount = 0;
  let failureCount = 0;

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    console.log(`📄 Running migration: ${file}`);
    
    try {
      const sqlContent = readFileSync(filePath, 'utf8');
      
      // Split SQL content by semicolons to execute statements individually
      // This is needed because neon() doesn't support multiple statements in one call
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          // Execute raw SQL - CREATE INDEX CONCURRENTLY requires this approach
          await sql.unsafe(statement);
        }
      }
      
      console.log(`   ✅ Success: ${file}\n`);
      successCount++;
    } catch (error) {
      // Check if error is "relation already exists" or "already exists" - these are OK
      if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate key')
        )) {
        console.log(`   ⏭️  Skipped (already exists): ${file}\n`);
        successCount++;
      } else {
        console.error(`   ❌ Failed: ${file}`);
        console.error(`   Error: ${error.message}\n`);
        failureCount++;
      }
    }
  }

  // Summary
  console.log('=====================================');
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log('=====================================\n');

  if (failureCount > 0) {
    console.log('⚠️  Some migrations failed. Please check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All migrations completed successfully!');
    
    // Verify indexes were created
    console.log('\n🔍 Verifying indexes...');
    try {
      const indexes = await sql`
        SELECT tablename, indexname 
        FROM pg_indexes 
        WHERE tablename IN ('courses', 'departments', 'users', 'practical_submissions', 'course_faculty')
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
      `;
      
      if (indexes.length > 0) {
        console.log(`   Found ${indexes.length} performance indexes:`);
        indexes.forEach(idx => {
          console.log(`   - ${idx.indexname} on ${idx.tablename}`);
        });
      } else {
        console.log('   ⚠️  No indexes found - they may still be building with CONCURRENTLY');
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify indexes:', error.message);
    }
    
    process.exit(0);
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
