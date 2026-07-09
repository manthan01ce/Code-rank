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
        SELECT * FROM departments 
        WHERE name ILIKE ${searchPattern} OR institute_name ILIKE ${searchPattern}
        ORDER BY created_at DESC
      `;
    } else {
      query = sql`
        SELECT * FROM departments 
        ORDER BY created_at DESC
      `;
    }

    const departments = await query;
    return NextResponse.json(departments);
  } catch (error) {
    console.error('GET /api/departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, institute_name } = await request.json();

    if (!name || !institute_name) {
      return NextResponse.json({ error: 'Name and Institute are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO departments (name, institute_name)
      VALUES (${name}, ${institute_name})
      RETURNING *
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'CREATE_DEPARTMENT', ${`Created department ${name}`})`;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('POST /api/departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
