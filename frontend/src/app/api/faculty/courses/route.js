import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courses = await sql`
      SELECT c.id, c.course_code, c.name, c.semester, cf.is_co_coordinator 
      FROM course_faculty cf 
      JOIN courses c ON cf.course_id = c.id 
      WHERE cf.faculty_id = ${user.id}
      ORDER BY c.course_code ASC
    `;

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Fetch faculty courses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
