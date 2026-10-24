// Academic submissions, grades, attempts and replay-protection rows are never
// retention targets. Execute one bounded batch; operators control scheduling.
export async function retainOperationalData(query, { apply = false, workspaceDays = 180, logDays = 365, limit = 500 } = {}) {
  for (const [value, min, max] of [[workspaceDays,30,3650],[logDays,365,3650],[limit,1,1000]]) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw Error('Invalid retention policy');
  }
  if (typeof apply !== 'boolean') throw Error('Invalid retention mode');
  // A preview is read-only. Apply locks candidates and rechecks age in the same
  // statement, avoiding deletion of drafts concurrently refreshed by students.
  const candidates = `WITH workspace_candidates AS (
    SELECT student_id,practical_id,language FROM student_workspaces
    WHERE saved_at < now()-make_interval(days => $1)
    ORDER BY saved_at,student_id,practical_id,language LIMIT $3 ${apply ? 'FOR UPDATE SKIP LOCKED' : ''}
  ), log_candidates AS (
    SELECT id FROM activity_logs WHERE created_at < now()-make_interval(days => $2)
    ORDER BY created_at,id LIMIT $3 ${apply ? 'FOR UPDATE SKIP LOCKED' : ''}
  )`;
  const statement = apply ? `${candidates}, removed_workspaces AS (
    DELETE FROM student_workspaces w USING workspace_candidates c
    WHERE w.student_id=c.student_id AND w.practical_id=c.practical_id AND w.language=c.language
      AND w.saved_at < now()-make_interval(days => $1) RETURNING 1
  ), removed_logs AS (
    DELETE FROM activity_logs l USING log_candidates c WHERE l.id=c.id RETURNING 1
  ), summary AS (
    SELECT (SELECT count(*)::int FROM removed_workspaces) AS workspaces,
           (SELECT count(*)::int FROM removed_logs) AS logs
  ), audit AS (
    INSERT INTO activity_logs(action,details)
    SELECT 'RETENTION',to_jsonb(s)::text FROM summary s RETURNING id
  ) SELECT s.* FROM summary s CROSS JOIN (SELECT count(*) FROM audit) committed`
    : `${candidates} SELECT (SELECT count(*)::int FROM workspace_candidates) AS workspaces,
       (SELECT count(*)::int FROM log_candidates) AS logs`;
  const [counts] = await query(statement, [workspaceDays,logDays,limit]);
  return { mode: apply ? 'apply' : 'preview', policy: { workspaceDays,logDays,limit }, ...counts };
}
