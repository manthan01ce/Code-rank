import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const requestingUser = getUserFromRequest(request);
    if (!requestingUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await params;

    // Look up user by email prefix (username = part before @)
    const rows = await sql`
      SELECT id, name, email, role, status, extra_info
      FROM users
      WHERE split_part(email, '@', 1) = ${username}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Fallback check for Super Admin from .env
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && adminEmail.split('@')[0] === username) {
        return NextResponse.json({
          user: {
            id: 0,
            name: 'Super Admin',
            email: adminEmail,
            role: 'admin',
            status: 'active',
            extra_info: { department: 'Administration', employee_id: 'ADMIN-001' }
          },
          practicals: []
        });
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profileUser = rows[0];

    // Only return practicals if viewing own profile AND role is faculty
    let practicals = [];
    const viewerHandle = requestingUser.email
      ? requestingUser.email.split('@')[0]
      : '';

    if (viewerHandle === username && profileUser.role === 'faculty') {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const rows2 = await sql`
        SELECT
          p.id,
          p.title,
          p.end_time,
          c.name  AS course_name,
          c.course_code,
          (
            SELECT COUNT(*)::int
            FROM practical_submissions ps
            WHERE ps.practical_id = p.id AND ps.submitted_by = ${profileUser.id}
          ) AS my_submissions
        FROM practicals p
        JOIN courses c ON p.course_id = c.id
        JOIN course_faculty cf ON cf.course_id = c.id
        WHERE cf.faculty_id = ${profileUser.id}
        ORDER BY p.end_time ASC NULLS LAST
      `;

      practicals = rows2.map((p) => {
        const due = p.end_time ? new Date(p.end_time) : null;
        let status = 'not_started';
        if (p.my_submissions > 0) {
          status = 'done';
        } else if (due) {
          if (due < now) status = 'past_due';
          else if (due <= sevenDaysLater) status = 'upcoming';
          else status = 'not_started';
        }
        return {
          id: p.id,
          name: p.title,
          course: p.course_name,
          course_code: p.course_code,
          dueDate: p.end_time,
          status,
        };
      });
    }

    return NextResponse.json({
      user: {
        id: profileUser.id,
        name: profileUser.name,
        email: profileUser.email,
        role: profileUser.role,
        status: profileUser.status,
        extra_info: profileUser.extra_info,
      },
      practicals,
    });
  } catch (error) {
    console.error('GET /api/profile/[username] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const requestingUser = getUserFromRequest(request);
    if (!requestingUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await params;
    const viewerHandle = requestingUser.email
      ? requestingUser.email.split('@')[0]
      : '';

    if (viewerHandle !== username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, extra_info, currentPassword, newPassword } = await request.json();

    if (newPassword && newPassword.trim().length > 0) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password.' }, { status: 400 });
      }

      // Fetch user's existing hashed password from DB
      const dbUserRows = await sql`SELECT password FROM users WHERE id = ${requestingUser.id}`;
      if (dbUserRows.length === 0) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const { comparePassword, hashPassword } = await import('@/lib/auth');
      const passwordMatch = await comparePassword(currentPassword, dbUserRows[0].password);
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Incorrect current password.' }, { status: 400 });
      }

      const hashed = await hashPassword(newPassword);
      await sql`
        UPDATE users
        SET name = ${name}, extra_info = ${JSON.stringify(extra_info)}, password = ${hashed}
        WHERE id = ${requestingUser.id}
      `;
    } else {
      await sql`
        UPDATE users
        SET name = ${name}, extra_info = ${JSON.stringify(extra_info)}
        WHERE id = ${requestingUser.id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/profile/[username] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
