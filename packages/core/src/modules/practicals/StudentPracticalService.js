import sql from '../../db/client.js';
import { listPage } from '../courses/list-pagination.js';
import { PracticalService } from './PracticalService.js';

export class StudentPracticalService {
  static async detail(user, id) {
    if (!user || user.role !== 'student') throw { status: 401, message: 'Student authentication required' };
    const p = await PracticalService.authorize(user,id);
    return { id: `practical_${p.id}`, dbId: p.id, isPractical: true,
      clipboardRestricted: p.starter_code?.exam_policy?.restrict_clipboard === true,
      title: p.title, description: p.description, difficulty: p.difficulty || 'Medium',
      inputFormat: p.input_format, outputFormat: p.output_format, sampleInput: p.sample_input,
      sampleOutput: p.sample_output, constraints: p.constraints, instructions: p.instructions,
      starter_code: p.starter_code, allowedLanguages: p.starter_code?.allowed_languages || ['python','cpp','java','c','javascript'],
      startTime: p.start_time, endTime: p.end_time, testCases: [],
    };
  }
  static async list(user, courseId = null, options = {}) {
    if (!user || user.role !== 'student') throw { status: 401, message: 'Unauthorized' };
    if (courseId !== null && (typeof courseId !== 'string' || courseId.length > 100)) throw { status: 400, message: 'Invalid course filter' };
    const { cursor, limit } = listPage({ limit: 25, ...options });
    if (limit > 100) throw { status: 400, message: 'Maximum page size is 100' };
    // Read cohort and current session before selecting visible practicals.
    const students = await sql`
      SELECT extra_info, session_token FROM users WHERE id = ${user.id}
    `;
    if (students.length === 0) {
      throw { status: 404, message: 'Student profile not found' };
    }
    if ((students[0].session_token ?? null) !== (user.session_token ?? null)) {
        throw { status: 401, message: 'Session expired' };
    }


    const extra = students[0].extra_info || {};
    const batch = (extra.batch || '').trim();
    const division = (extra.division || '').trim();
    const semester = parseInt(extra.semester) || 0;

    if (!semester) {
      return [];
    }

    // Fetch practicals where practical batch matches (by batch or division or all) and course semester matches student semester.
    const params = [user.id, batch, division, semester];
    let query = `
      SELECT p.id, p.course_id, p.batch_id, p.title, p.description, p.instructions, p.total_marks, p.difficulty, 
             p.is_challenge, p.input_format, p.output_format, p.constraints, 
             p.sample_input, p.sample_output, p.starter_code, p.start_time, p.end_time,
             c.name as course_name, c.course_code, c.semester as course_semester, u.name as faculty_name,
             s.status as my_status, s.normalized_marks as my_marks, s.submitted_at as my_submitted_at
      FROM practicals p
      JOIN courses c ON p.course_id = c.id
      JOIN users u ON p.faculty_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (practical_id) 
          practical_id, status, normalized_marks, submitted_at
        FROM practical_submissions 
        WHERE student_id = $1
        ORDER BY practical_id, normalized_marks DESC, submitted_at DESC
      ) s ON s.practical_id = p.id
      WHERE (
        p.batch_id IS NULL 
        OR btrim(p.batch_id) = '' 
        OR lower(btrim(p.batch_id)) = 'all' 
        OR ($2 != '' AND lower(btrim(p.batch_id)) = lower($2))
        OR ($3 != '' AND lower(btrim(p.batch_id)) = lower($3))
      )
        AND c.semester = $4
        AND p.status = 'active'
    `;

    if (courseId) {
      if (/^[0-9]+$/.test(courseId) && Number.isSafeInteger(Number(courseId)) && Number(courseId) > 0) {
        params.push(Number(courseId), courseId);
        query += ` AND (p.course_id = $${params.length - 1} OR c.course_code = $${params.length})`;
      } else {
        params.push(courseId);
        query += ` AND c.course_code = $${params.length}`;
      }
    }

    params.push(cursor, limit);
    query += ` AND ($${params.length - 1}::integer IS NULL OR p.id < $${params.length - 1}) ORDER BY p.id DESC LIMIT $${params.length}`;

    const practicals = await sql.query(query, params);

    return practicals;
  }
}
