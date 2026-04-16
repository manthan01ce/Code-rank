import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { name, description, assigned_faculty } = await request.json();

    const result = await sql`
      UPDATE courses 
      SET name = ${name}, description = ${description}, assigned_faculty = ${assigned_faculty || null}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'UPDATE_COURSE', ${`Updated course ${name}`})`;

    return NextResponse.json({ success: true, course: result[0] });
  } catch (error) {
    console.error('PUT /api/courses/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const courseRows = await sql`SELECT name FROM courses WHERE id = ${parseInt(id)}`;
    if (courseRows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseName = courseRows[0].name;
    await sql`DELETE FROM courses WHERE id = ${parseInt(id)}`;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'DELETE_COURSE', ${`Deleted course ${courseName}`})`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/courses/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
