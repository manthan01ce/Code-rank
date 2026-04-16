import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const admin = getUserFromRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;  // Next.js 15: params must be awaited
    const body = await request.json();
    const { name, extra_info, status } = body;

    // Build update in one query to return updated row
    const result = await sql`
      UPDATE users
      SET
        name = COALESCE(${name ?? null}, name),
        extra_info = COALESCE(${extra_info ? JSON.stringify(extra_info) : null}::jsonb, extra_info),
        status = COALESCE(${status ?? null}, status)
      WHERE id = ${parseInt(id)} AND role != 'admin'
      RETURNING id, name, email, role, status, extra_info
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const action = status === 'active' ? 'REACTIVATE_USER' : 'UPDATE_USER';
    const details = status === 'active' ? `Reactivated user ${result[0].name}` : `Updated user ID ${id}`;

    await sql`INSERT INTO activity_logs (user_id, action, details)
              VALUES (${admin.id}, ${action}, ${details})`;

    return NextResponse.json({ success: true, user: result[0] });
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = getUserFromRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;  // Next.js 15: params must be awaited

    // Get user info before marking as inactive
    const userRows = await sql`SELECT email, name FROM users WHERE id = ${parseInt(id)} AND role != 'admin'`;
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found or cannot be deleted' }, { status: 404 });
    }

    const { email, name } = userRows[0];

    // Mark user as inactive instead of deleting
    const result = await sql`
      UPDATE users 
      SET status = 'inactive' 
      WHERE id = ${parseInt(id)} AND role != 'admin'
      RETURNING id, name, email, role, status, extra_info
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found or cannot be deactivated' }, { status: 404 });
    }

    // Unassign from courses if faculty
    await sql`UPDATE courses SET assigned_faculty = NULL WHERE assigned_faculty = ${parseInt(id)}`;

    // Log the deactivation under admin's ID
    await sql`INSERT INTO activity_logs (user_id, action, details)
              VALUES (${admin.id}, 'DEACTIVATE_USER', ${`Deactivated user ${name} (${email})`})`;

    return NextResponse.json({ success: true, user: result[0] });
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
