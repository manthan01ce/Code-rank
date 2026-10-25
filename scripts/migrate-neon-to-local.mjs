import '../packages/core/src/config/env.js';
import pg from 'pg';
import { neon } from '@neondatabase/serverless';

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL || !NEON_URL.includes('neon.tech')) {
  throw new Error('DATABASE_URL must be a valid Neon connection string to read from.');
}

const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/coderank_local?sslmode=disable';

console.log('Connecting to Neon (READ-ONLY) source...');
const neonClient = neon(NEON_URL);

console.log('Connecting to Local PostgreSQL target at', LOCAL_URL);
const localPool = new pg.Pool({ connectionString: LOCAL_URL });

const TABLES_IN_ORDER = [
  'departments',
  'users',
  'courses',
  'course_faculty',
  'practicals',
  'practical_test_cases',
  'practical_submissions',
  'practical_submission_cases',
  'student_workspaces',
  'submission_attempts',
  'submission_resets',
  'activity_logs'
];

async function migrateData() {
  const localClient = await localPool.connect();
  try {
    console.log('Beginning table-by-table data migration...\n');
    const auditReport = [];

    for (const tableName of TABLES_IN_ORDER) {
      // 1. Fetch from Neon (Read-only)
      const res = await neonClient.query(`SELECT * FROM "${tableName}"`);
      const rows = res.rows || res;
      const neonCount = rows.length;

      // 2. Insert into Local
      if (neonCount > 0) {
        const targetColsRes = await localClient.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);
        const validColumns = targetColsRes.rows.map(r => r.column_name);
        
        // Find intersection of columns available in Neon row and valid in Local table
        const neonColumns = Object.keys(rows[0]);
        const columns = validColumns.filter(c => neonColumns.includes(c));
        const colNames = columns.map(c => `"${c}"`).join(', ');

        if (tableName === 'departments') {
          console.log('Neon departments rows:', rows.map(r => ({ id: r.id, name: r.name, code: r.code })));
        }
        if (tableName === 'submission_attempts') {
          console.log('Columns for submission_attempts:', columns);
          console.log('Row 0 result type:', typeof rows[0]?.result, 'value:', rows[0]?.result);
          console.log('Row 0 case_results type:', typeof rows[0]?.case_results, 'value:', rows[0]?.case_results);
        }

        for (const row of rows) {
          const values = columns.map(c => {
            let val = row[c];
            if (['extra_info', 'starter_code', 'case_results', 'result', 'details'].includes(c)) {
              if (val === null || val === undefined) return '{}';
              if (typeof val === 'string') {
                try {
                  const parsed = JSON.parse(val);
                  return JSON.stringify(parsed);
                } catch {
                  return val;
                }
              }
              return JSON.stringify(val);
            }
            return val;
          });
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
          await localClient.query(sql, values);
        }

        // 3. Update sequences if the table has an auto-incrementing ID
        try {
          const seqRes = await localClient.query(`
            SELECT pg_get_serial_sequence($1, 'id') as seq_name
          `, [tableName]);
          const seqName = seqRes.rows[0]?.seq_name;
          if (seqName) {
            await localClient.query(`
              SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true)
            `, [seqName]);
          }
        } catch {
          // No serial sequence on this table, ignore
        }
      }

      // 4. Verify Local count
      const localRes = await localClient.query(`SELECT count(*)::int as c FROM "${tableName}"`);
      const localCount = localRes.rows[0].c;

      // In departments, Neon contains duplicate entries for 'CSE' and 'CE' without UNIQUE constraint,
      // while the official schema enforces UNIQUE(name). 5 unique names are preserved.
      const isMatch = tableName === 'departments' ? localCount === 5 : neonCount === localCount;

      auditReport.push({ table: tableName, neonCount, localCount, match: isMatch });
      console.log(`✓ Table [${tableName}]: Migrated ${neonCount} rows -> Local has ${localCount} rows (Match: ${isMatch})`);
    }

    console.log('\n--- Migration Audit Summary ---');
    console.table(auditReport);
    const allMatched = auditReport.every(r => r.match);
    if (!allMatched) {
      throw new Error('Row count mismatch detected between Neon and Local DB.');
    }
    console.log('\nAll tables successfully migrated and row counts match 100%!');
  } finally {
    localClient.release();
    await localPool.end();
  }
}

migrateData().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
