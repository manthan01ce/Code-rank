import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, comparePassword, hashPassword } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const requestingUser = getUserFromRequest(request);
    if (!requestingUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await params;
    const viewerHandle = requestingUser.email
      ? requestingUser.email.split('@')[0]
      : '';

    // Enforce role-based access control:
    // Non-admin users can ONLY view their own profile.
    if (requestingUser.role !== 'admin' && viewerHandle !== username) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view another user\'s profile.' },
        { status: 403 }
      );
    }

    // Look up user by email prefix (username = part before @)
    const rows = await sql`
      SELECT id, name, email, role, status, extra_info, created_at
      FROM users
      WHERE split_part(email, '@', 1) = ${username}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Fallback check for Super Admin from .env
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && adminEmail.split('@')[0] === username) {
        let systemStats = { students: 0, faculty: 0, courses: 0, practicals: 0 };
        try {
          const [sc] = await sql`SELECT COUNT(*)::int as count FROM users WHERE role = 'student'`;
          const [fc] = await sql`SELECT COUNT(*)::int as count FROM users WHERE role = 'faculty'`;
          const [cc] = await sql`SELECT COUNT(*)::int as count FROM courses`;
          const [pc] = await sql`SELECT COUNT(*)::int as count FROM practicals`;
          systemStats = {
            students: sc?.count || 0,
            faculty: fc?.count || 0,
            courses: cc?.count || 0,
            practicals: pc?.count || 0
          };
        } catch (e) {
          console.error('Error fetching admin system stats:', e);
        }

        return NextResponse.json({
          user: {
            id: 0,
            name: 'Super Admin',
            email: adminEmail,
            role: 'admin',
            status: 'active',
            extra_info: { department: 'Administration', employee_id: 'ADMIN-001' }
          },
          courses: [],
          practicals: [],
          academicOverview: null,
          systemStats
        });
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profileUser = rows[0];
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let courses = [];
    let practicals = [];
    let academicOverview = null;
    let systemStats = null;

    if (profileUser.role === 'faculty') {
      // Fetch assigned courses & subjects
      const facultyCourses = await sql`
        SELECT c.id, c.course_code, c.name, c.semester, cf.is_co_coordinator
        FROM course_faculty cf
        JOIN courses c ON cf.course_id = c.id
        WHERE cf.faculty_id = ${profileUser.id}
        ORDER BY c.course_code ASC
      `;
      courses = facultyCourses || [];

      // Fetch practicals created/managed by faculty
      const facultyPracticals = await sql`
        SELECT
          p.id,
          p.title,
          p.end_time,
          c.name AS course_name,
          c.course_code,
          (
            SELECT COUNT(*)::int
            FROM practical_submissions ps
            WHERE ps.practical_id = p.id
          ) AS total_submissions
        FROM practicals p
        JOIN courses c ON p.course_id = c.id
        JOIN course_faculty cf ON cf.course_id = c.id
        WHERE cf.faculty_id = ${profileUser.id}
        ORDER BY p.end_time ASC NULLS LAST
      `;

      practicals = (facultyPracticals || []).map((p) => {
        const due = p.end_time ? new Date(p.end_time) : null;
        let status = 'active';
        if (due && due < now) status = 'past_due';
        else if (due && due <= sevenDaysLater) status = 'upcoming';

        return {
          id: p.id,
          name: p.title,
          course: p.course_name,
          course_code: p.course_code,
          dueDate: p.end_time,
          status,
          submissionsCount: p.total_submissions || 0
        };
      });
    } else if (profileUser.role === 'student') {
      const extra = profileUser.extra_info || {};
      const batch = extra.batch || '';
      const semester = parseInt(extra.semester) || 0;

      if (semester > 0) {
        // Fetch enrolled courses for semester
        courses = await sql`
          SELECT id, course_code, name, semester
          FROM courses
          WHERE semester = ${semester}
          ORDER BY course_code ASC
        `;

        // Fetch practicals with student submission status & marks
        const studentPracticals = await sql`
          SELECT p.id, p.title, p.end_time, p.total_marks,
                 c.name as course_name, c.course_code,
                 s.status as my_status, s.normalized_marks, s.raw_marks, s.submitted_at
          FROM practicals p
          JOIN courses c ON p.course_id = c.id
          LEFT JOIN (
            SELECT DISTINCT ON (practical_id) 
              practical_id, status, normalized_marks, raw_marks, submitted_at
            FROM practical_submissions 
            WHERE student_id = ${profileUser.id}
            ORDER BY practical_id, normalized_marks DESC, submitted_at DESC
          ) s ON s.practical_id = p.id
          WHERE (
            p.batch_id IS NULL 
            OR p.batch_id = '' 
            OR p.batch_id ILIKE 'all' 
            OR (${batch} != '' AND p.batch_id ILIKE ${batch})
          )
            AND c.semester = ${semester}
            AND p.status = 'active'
          ORDER BY p.end_time ASC NULLS LAST
        `;

        practicals = (studentPracticals || []).map((p) => {
          const due = p.end_time ? new Date(p.end_time) : null;
          let status = 'not_started';
          if (p.my_status === 'passed') {
            status = 'done';
          } else if (p.my_status) {
            status = 'submitted';
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
            totalMarks: p.total_marks,
            normalizedMarks: p.normalized_marks,
            rawMarks: p.raw_marks,
            submittedAt: p.submitted_at
          };
        });

        // Compute academic overview statistics
        const totalAssigned = practicals.length;
        const completed = practicals.filter((p) => p.status === 'done' || p.status === 'submitted').length;
        const pending = practicals.filter((p) => p.status === 'not_started' || p.status === 'past_due').length;
        const scoredPracticals = practicals.filter((p) => p.normalizedMarks !== null && p.normalizedMarks !== undefined);
        const averageMarks = scoredPracticals.length > 0
          ? Math.round(scoredPracticals.reduce((acc, curr) => acc + Number(curr.normalizedMarks), 0) / scoredPracticals.length)
          : null;

        academicOverview = {
          totalAssigned,
          completed,
          pending,
          averageMarks,
          enrolledCoursesCount: courses.length
        };
      }
    } else if (profileUser.role === 'admin') {
      try {
        const [sc] = await sql`SELECT COUNT(*)::int as count FROM users WHERE role = 'student'`;
        const [fc] = await sql`SELECT COUNT(*)::int as count FROM users WHERE role = 'faculty'`;
        const [cc] = await sql`SELECT COUNT(*)::int as count FROM courses`;
        const [pc] = await sql`SELECT COUNT(*)::int as count FROM practicals`;
        systemStats = {
          students: sc?.count || 0,
          faculty: fc?.count || 0,
          courses: cc?.count || 0,
          practicals: pc?.count || 0
        };
      } catch (e) {
        console.error('Error fetching admin system stats:', e);
      }
    }

    return NextResponse.json({
      user: {
        id: profileUser.id,
        name: profileUser.name,
        email: profileUser.email,
        role: profileUser.role,
        status: profileUser.status,
        extra_info: profileUser.extra_info,
        created_at: profileUser.created_at
      },
      courses,
      practicals,
      academicOverview,
      systemStats
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

    // Authorization check: only self or admin can edit
    if (viewerHandle !== username && requestingUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: You cannot modify another user\'s profile' }, { status: 403 });
    }

    // Fetch existing target user from DB
    const dbUserRows = await sql`
      SELECT id, name, email, password, role, status, extra_info 
      FROM users 
      WHERE split_part(email, '@', 1) = ${username}
      LIMIT 1
    `;

    // Handle Super Admin fallback update
    if (dbUserRows.length === 0) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && adminEmail.split('@')[0] === username && requestingUser.role === 'admin') {
        return NextResponse.json({
          success: true,
          message: 'Super Admin credentials managed via environment configuration.'
        });
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = dbUserRows[0];
    const body = await request.json();
    const { name, extra_info, currentPassword, newPassword } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Full name is required and cannot be empty.' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Enforce role-based field restrictions (mass assignment protection):
    // Students and faculty cannot edit their roll_number, department, division, semester, batch, facultyId, role, email, status.
    let updatedExtraInfo = { ...(targetUser.extra_info || {}) };

    if (requestingUser.role === 'admin') {
      // Admins are permitted to update department and employee_id
      if (extra_info) {
        if (extra_info.department !== undefined) {
          updatedExtraInfo.department = extra_info.department;
        }
        if (extra_info.employee_id !== undefined) {
          updatedExtraInfo.employee_id = extra_info.employee_id;
        }
        if (extra_info.facultyId !== undefined && targetUser.role === 'faculty') {
          updatedExtraInfo.facultyId = extra_info.facultyId;
        }
      }
    }
    // For students and non-admin faculty, protected fields in extra_info are preserved untouched.

    // Handle password change if requested
    if (newPassword && newPassword.trim().length > 0) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change your password.' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long.' }, { status: 400 });
      }

      const passwordMatch = await comparePassword(currentPassword, targetUser.password);
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Incorrect current password.' }, { status: 400 });
      }

      const hashed = await hashPassword(newPassword);

      await sql`
        UPDATE users
        SET name = ${trimmedName}, extra_info = ${JSON.stringify(updatedExtraInfo)}, password = ${hashed}
        WHERE id = ${targetUser.id}
      `;

      // Log activity
      try {
        await sql`
          INSERT INTO activity_logs (user_id, action, details) 
          VALUES (${targetUser.id}, 'CHANGE_PASSWORD', 'User updated password via profile')
        `;
      } catch (logErr) {
        console.error('Error logging activity:', logErr);
      }
    } else {
      await sql`
        UPDATE users
        SET name = ${trimmedName}, extra_info = ${JSON.stringify(updatedExtraInfo)}
        WHERE id = ${targetUser.id}
      `;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        name: trimmedName,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        extra_info: updatedExtraInfo
      }
    });
  } catch (error) {
    console.error('PUT /api/profile/[username] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
