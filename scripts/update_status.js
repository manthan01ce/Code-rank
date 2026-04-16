import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function updateUserStatus() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local');
    return;
  }

  const sql = neon(DATABASE_URL);
  
  try {
    console.log('--- Updating User Status ---');
    
    // Ensure all existing users have 'active' status if status is null or empty
    console.log('Setting default status to active for existing users...');
    const result = await sql`
      UPDATE users 
      SET status = 'active' 
      WHERE status IS NULL OR status = ''
    `;
    
    console.log(`✓ Updated ${result.length || 0} users to active status`);
    
    // Verify the status column exists and has proper constraint
    console.log('Verifying status column...');
    const statusCheck = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'status'
    `;
    
    if (statusCheck.length > 0) {
      console.log('✓ Status column exists:', statusCheck[0]);
    } else {
      console.log('⚠️  Status column not found, adding it...');
      await sql`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`;
      console.log('✓ Status column added');
    }
    
    // Show current user status distribution
    console.log('\nCurrent user status distribution:');
    const statusDistribution = await sql`
      SELECT role, status, COUNT(*) as count 
      FROM users 
      GROUP BY role, status 
      ORDER BY role, status
    `;
    
    statusDistribution.forEach(row => {
      console.log(`  ${row.role}: ${row.status} = ${row.count}`);
    });
    
    console.log('\n✅ User status update complete!');
  } catch (err) {
    console.error('❌ Update Status Error:', err);
  }
}

updateUserStatus();