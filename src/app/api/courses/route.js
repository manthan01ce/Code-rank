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

    let query;
    if (search) {
      const searchPattern = `%${search}%`;
      query = sql`
        SELECT c.*, u.name as faculty_name 
        FROM courses c 
        LEFT JOIN users u ON c.assigned_faculty = u.id 
        WHERE c.name ILIKE ${searchPattern}
        ORDER BY c.created_at DESC
      `;
    } else {
      query = sql`
        SELECT c.*, u.name as faculty_name 
        FROM courses c 
        LEFT JOIN users u ON c.assigned_faculty = u.id 
        ORDER BY c.created_at DESC
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

    const { name, description, assigned_faculty } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO courses (name, description, assigned_faculty)
      VALUES (${name}, ${description}, ${assigned_faculty || null})
      RETURNING *
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'CREATE_COURSE', ${`Created course ${name}`})`;

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
