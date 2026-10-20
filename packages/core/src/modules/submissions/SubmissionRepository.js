import sql from '../../db/client.js';

// A single PostgreSQL statement owns the attempt ledger, best grade and case rows.
export async function saveAttempt(a) {
  const rows = await sql.query(`SELECT coderank_save_attempt(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb
  ) AS result`, [a.jobId, a.userId, a.dbId, a.code, a.language, a.status,
    a.rawMarks, a.normalizedMarks, a.totalTime, a.isLate, a.submittedAt.toISOString(),
    JSON.stringify(a.cases), JSON.stringify(a.result)]);
  return rows[0].result;
}

export async function findAttempt({ jobId, userId, dbId, code, language }) {
  const rows = await sql.query(`SELECT result FROM submission_attempts
    WHERE job_id = $1 AND student_id = $2 AND practical_id = $3
    AND code = convert_to($4, 'UTF8') AND language = $5`, [jobId, userId, dbId, code, language]);
  return rows[0]?.result;
}
