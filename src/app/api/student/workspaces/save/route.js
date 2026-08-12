import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practical_id, language, code } = await request.json();

    if (!practical_id || !language || code === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch the practical's course/subject ID
    const practicals = await sql`
      SELECT course_id FROM practicals WHERE id = ${parseInt(practical_id)}
    `;
    if (practicals.length === 0) {
      return NextResponse.json({ error: 'Practical not found' }, { status: 404 });
    }
    const subjectId = practicals[0].course_id;

    // 2. Persist to student_workspaces database table as binary
    const codeBuffer = Buffer.from(code, 'utf8');
    await sql`
      INSERT INTO student_workspaces (student_id, practical_id, language, latest_code, saved_at)
      VALUES (${user.id}, ${parseInt(practical_id)}, ${language}, ${codeBuffer}, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, practical_id, language) 
      DO UPDATE SET latest_code = EXCLUDED.latest_code, saved_at = CURRENT_TIMESTAMP
    `;

    // 3. Write to code-storage file path structure
    const ext = language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : language === 'javascript' ? 'js' : 'txt';
    const storageDir = path.join(process.cwd(), 'code-storage', `subject-${subjectId}`, `practical-${practical_id}`, `student-${user.id}`);
    await fs.mkdir(storageDir, { recursive: true });
    
    const filePath = path.join(storageDir, `latest_saved_code.${ext}`);
    await fs.writeFile(filePath, code, 'utf-8');

    // 4. Log workspace save event
    await sql`
      INSERT INTO activity_logs (user_id, action, details) 
      VALUES (${user.id}, 'SAVE_WORKSPACE', ${`Saved code workspace for practical ${practical_id} in ${language}`})
    `;

    return NextResponse.json({ success: true, message: 'Draft saved successfully' });
  } catch (error) {
    console.error('Save workspace error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
