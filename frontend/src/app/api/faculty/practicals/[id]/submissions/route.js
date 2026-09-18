import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decodeBinaryCode } from '@/lib/binaryCode';

export async function GET(request, { params }) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'faculty') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Filters
    const studentSearch = searchParams.get('studentSearch'); // Name or email or roll no or division
    const divisionFilter = searchParams.get('division');
    const status = searchParams.get('status'); // e.g. Accepted, Wrong Answer
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'submission_time'; // marks, submission_time, student_name
    const sortOrder = searchParams.get('sortOrder') || 'DESC'; // ASC or DESC

    // Verify ownership of practical
    const owned = await sql`
      SELECT 1 FROM practicals p
      JOIN course_faculty cf ON p.course_id = cf.course_id
      WHERE p.id = ${parseInt(id)} AND cf.faculty_id = ${user.id}
    `;
    if (owned.length === 0) {
      return NextResponse.json({ error: 'Practical not found or not owned by you' }, { status: 404 });
    }

    // Build the query dynamically
    let query = sql`
      SELECT s.*, u.name as student_name, u.email as student_email,
             u.extra_info->>'roll_number' as roll_number,
             u.extra_info->>'batch' as batch,
             u.extra_info->>'division' as division,
             u.extra_info->>'department' as department
      FROM practical_submissions s
      JOIN users u ON s.student_id = u.id
      WHERE s.practical_id = ${parseInt(id)}
    `;

    // Filter by student name / email / roll no / division
    if (studentSearch) {
      const searchPattern = `%${studentSearch}%`;
      query = sql`${query} AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u.extra_info->>'roll_number' ILIKE ${searchPattern} OR u.extra_info->>'division' ILIKE ${searchPattern})`;
    }

    // Filter by specific division
    if (divisionFilter && divisionFilter !== 'all') {
      query = sql`${query} AND u.extra_info->>'division' = ${divisionFilter}`;
    }

    // Filter by status
    if (status && status !== 'all') {
      if (status === 'in-time') {
        query = sql`${query} AND s.is_late = false`;
      } else if (status === 'late') {
        query = sql`${query} AND s.is_late = true`;
      } else {
        query = sql`${query} AND s.status = ${status}`;
      }
    }

    // Filter by date range
    if (fromDate) {
      query = sql`${query} AND s.submitted_at >= ${new Date(fromDate)}`;
    }
    if (toDate) {
      // Set to end of day
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = sql`${query} AND s.submitted_at <= ${endOfDay}`;
    }

    // Handle dynamic sorting
    if (sortBy === 'marks') {
      query = sortOrder.toUpperCase() === 'ASC' 
        ? sql`${query} ORDER BY s.normalized_marks ASC, s.submitted_at DESC`
        : sql`${query} ORDER BY s.normalized_marks DESC, s.submitted_at DESC`;
    } else if (sortBy === 'student_name') {
      query = sortOrder.toUpperCase() === 'ASC' 
        ? sql`${query} ORDER BY u.name ASC, s.submitted_at DESC`
        : sql`${query} ORDER BY u.name DESC, s.submitted_at DESC`;
    } else {
      // Default: submission_time
      query = sortOrder.toUpperCase() === 'ASC' 
        ? sql`${query} ORDER BY s.submitted_at ASC`
        : sql`${query} ORDER BY s.submitted_at DESC`;
    }

    const submissionsList = await query;

    const decodedList = submissionsList.map(s => ({
      ...s,
      code: decodeBinaryCode(s.code)
    }));

    return NextResponse.json(decodedList);
  } catch (error) {
    console.error('Fetch practical submissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
