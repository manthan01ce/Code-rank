import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword } from '@/lib/auth';

async function handleFacultyDeactivation(facultyId) {
  // 1. Get all courses where this faculty is mapped as co-coordinator
  const coordinatedCourses = await sql`
    SELECT course_id FROM course_faculty 
    WHERE faculty_id = ${facultyId} AND is_co_coordinator = true
  `;

  // 2. Remove the faculty from mapping
  await sql`DELETE FROM course_faculty WHERE faculty_id = ${facultyId}`;

  // 3. For each affected course, automatically assign the co-coordinator to another available active faculty
  for (const c of coordinatedCourses) {
    const otherActiveFaculties = await sql`
      SELECT cf.faculty_id 
      FROM course_faculty cf
      JOIN users u ON cf.faculty_id = u.id
      WHERE cf.course_id = ${c.course_id} AND u.status = 'active'
      ORDER BY cf.faculty_id ASC
    `;

    if (otherActiveFaculties.length > 0) {
      const newCoId = otherActiveFaculties[0].faculty_id;
      await sql`
        UPDATE course_faculty 
        SET is_co_coordinator = true 
        WHERE course_id = ${c.course_id} AND faculty_id = ${newCoId}
      `;
    }
  }
}

function validateDivision(division) {
  if (!division || typeof division !== 'string' || !division.trim()) {
    return { valid: false, error: 'Division is compulsory for students.' };
  }
  const trimmed = division.trim();
  const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
  const digitMatches = trimmed.match(/[0-9]/g) || [];
  if (alphaMatches.length < 2) {
    return { valid: false, error: 'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).' };
  }
  if (digitMatches.length < 1) {
    return { valid: false, error: 'Division must contain at least 1 numeric digit (e.g., CE1, IT2).' };
  }
  return { valid: true };
}

export async function PUT(request, { params }) {
  try {
    const admin = getUserFromRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { first_name, last_name, email, name, extra_info, status, password, role } = body;

    if (extra_info && (role === 'student' || extra_info.division !== undefined)) {
      if (extra_info.division !== undefined || role === 'student') {
        const val = validateDivision(extra_info.division);
        if (!val.valid) {
          return NextResponse.json({ error: val.error }, { status: 400 });
        }
        extra_info.division = extra_info.division.trim().toUpperCase();
      }
    }

    // Use reconstructed name if first and last name provided, otherwise use name
    let finalName = name;
    if (first_name && last_name) {
      finalName = `${first_name} ${last_name}`;
    }

    let hashedPassword = null;
    if (password && password.trim().length > 0) {
      hashedPassword = await hashPassword(password);
    }

    // Build update in one query to return updated row
    const result = await sql`
      UPDATE users
      SET
        first_name = COALESCE(${first_name ?? null}, first_name),
        last_name = COALESCE(${last_name ?? null}, last_name),
        name = COALESCE(${finalName ?? null}, name),
        email = COALESCE(${email ?? null}, email),
        extra_info = COALESCE(${extra_info ? JSON.stringify(extra_info) : null}::jsonb, extra_info),
        status = COALESCE(${status ?? null}, status),
        password = COALESCE(${hashedPassword ?? null}, password)
      WHERE id = ${parseInt(id)} AND role != 'admin'
      RETURNING id, first_name, last_name, name, email, role, status, extra_info
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (result[0].role === 'faculty' && status === 'inactive') {
      await handleFacultyDeactivation(parseInt(id));
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
    const userRows = await sql`SELECT email, name, role FROM users WHERE id = ${parseInt(id)} AND role != 'admin'`;
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found or cannot be deleted' }, { status: 404 });
    }

    const { email, name, role } = userRows[0];

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

    if (role === 'faculty') {
      await handleFacultyDeactivation(parseInt(id));
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
