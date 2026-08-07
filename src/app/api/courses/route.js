import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const semester = searchParams.get('semester');

    let query;
    if (search) {
      const searchPattern = `%${search}%`;
      query = sql`
        SELECT * FROM courses 
        WHERE name ILIKE ${searchPattern} OR course_code ILIKE ${searchPattern}
        ORDER BY created_at DESC
      `;
    } else if (semester) {
      query = sql`
        SELECT * FROM courses 
        WHERE semester = ${parseInt(semester)}
        ORDER BY created_at DESC
      `;
    } else {
      query = sql`
        SELECT * FROM courses 
        ORDER BY created_at DESC
      `;
    }

    const courses = await query;
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { course_code, name, semester } = await request.json();

    if (!course_code || !name || !semester) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO courses (course_code, name, semester)
      VALUES (${course_code}, ${name}, ${semester})
      RETURNING *
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'CREATE_COURSE', ${`Created course ${name}`})`;

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
