import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { retainOperationalData } from '../packages/database/src/retention.js';
test('retention is bounded, preview-only by default, audited and preserves academic records and fresh drafts', async () => {
  const db = new PGlite();
  const query = async (text, params) => (await db.query(text, params)).rows;
  try {
    await db.exec(`CREATE TABLE student_workspaces(student_id int,practical_id int,language text,saved_at timestamptz);
      CREATE TABLE activity_logs(id serial PRIMARY KEY,action text,details text,created_at timestamptz DEFAULT now());
      CREATE TABLE practical_submissions(id int); INSERT INTO practical_submissions VALUES(1);
      INSERT INTO student_workspaces VALUES(1,1,'python',now()-interval '200 days'),(2,1,'python',now()-interval '201 days'),(3,1,'python',now());
      INSERT INTO activity_logs(action,created_at) VALUES('OLD',now()-interval '400 days'),('FRESH',now());`);
    const preview = await retainOperationalData(query, { limit: 1 });
    assert.deepEqual([preview.mode,preview.workspaces,preview.logs], ['preview',1,1]);
    assert.equal((await query('SELECT count(*)::int n FROM student_workspaces'))[0].n, 3);
    const applied = await retainOperationalData(query, { apply: true, limit: 1 });
    assert.deepEqual([applied.workspaces,applied.logs],[1,1]);
    assert.deepEqual((await query('SELECT student_id FROM student_workspaces ORDER BY student_id')).map(row => row.student_id),[1,3]);
    assert.equal((await query('SELECT count(*)::int n FROM practical_submissions'))[0].n,1);
    assert.equal((await query("SELECT count(*)::int n FROM activity_logs WHERE action='RETENTION'"))[0].n,1);
    await db.exec(`CREATE FUNCTION deny_retention_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER deny_retention BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION deny_retention_audit();`);
    await assert.rejects(retainOperationalData(query,{apply:true,limit:1}),/audit unavailable/);
    assert.equal((await query('SELECT count(*)::int n FROM student_workspaces'))[0].n,2,'audit failure rolls back every deletion');
    for (const options of [{workspaceDays:1},{logDays:30},{limit:1001},{apply:'true'}]) await assert.rejects(retainOperationalData(query,options),/Invalid retention/);
  } finally { await db.close(); }
});
