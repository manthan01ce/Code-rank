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
    const { name, institute_name } = await request.json();

    if (!name || !institute_name) {
      return NextResponse.json({ error: 'Name and Institute are required' }, { status: 400 });
    }

    const result = await sql`
      UPDATE departments 
      SET name = ${name}, institute_name = ${institute_name}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'UPDATE_DEPARTMENT', ${`Updated department ${name}`})`;

    return NextResponse.json({ success: true, department: result[0] });
  } catch (error) {
    console.error('PUT /api/departments/[id] error:', error);
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
    
    const deptRows = await sql`SELECT name FROM departments WHERE id = ${parseInt(id)}`;
    if (deptRows.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const deptName = deptRows[0].name;
    await sql`DELETE FROM departments WHERE id = ${parseInt(id)}`;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${user.id}, 'DELETE_DEPARTMENT', ${`Deleted department ${deptName}`})`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/departments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
