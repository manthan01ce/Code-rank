import { SubmissionService } from '@coderank/core/submissions';
import { SubmissionHistoryService, pageOptions } from './submission-history.service.js';
import { ExecutionService } from '../execution/execution.service.js';
import { PracticalService } from '@coderank/core/practicals';
import { ALLOWED_LANGUAGES } from '@coderank/core/security/execution';
import sql from '@coderank/database';

export function decodeBinaryCode(codeField) {
  if (!codeField) return '';
  let str = '';
  if (Buffer.isBuffer(codeField)) {
    str = codeField.toString('utf8');
  } else if (codeField instanceof Uint8Array) {
    str = Buffer.from(codeField).toString('utf8');
  } else if (typeof codeField === 'object' && codeField.type === 'Buffer' && Array.isArray(codeField.data)) {
    str = Buffer.from(codeField.data).toString('utf8');
  } else if (typeof codeField === 'string') {
    if (codeField.startsWith('\\x')) {
      str = Buffer.from(codeField.slice(2), 'hex').toString('utf8');
    } else {
      str = codeField;
    }
  } else {
    str = String(codeField);
  }

  const trimmed = str.trim();
  if (trimmed.length > 20 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64') === trimmed && !decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      // Keep original str if base64 decoding fails
    }
  }

  return str;
}

export class SubmissionsService {
  static async submitPractice({ request, body }) {
    return await ExecutionService.handlePracticeExecution({
      request,
      body,
      submit: true,
    });
  }

  static async submitPractical({ request, id, body }) {
    if (!/^\d+$/.test(String(id || ''))) {
      throw { status: 400, message: 'Invalid practical ID' };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Invalid JSON payload' };
    }
    return await ExecutionService.enqueueExecution({
      request,
      type: 'dynamic',
      payload: {
        language: body?.language,
        code: body?.code,
        dbId: Number(id),
      },
      submit: true,
    });
  }

  static async getStudentSubmissions(actor, practicalId, searchParams) {
    const options = pageOptions(searchParams);
    const rows = await SubmissionHistoryService.student(actor, practicalId, options);
    const nextCursor = rows.length === Number(options.limit) ? String(rows.at(-1).id) : '';
    return { rows, nextCursor };
  }

  static async getFacultyPracticalSubmissions(actor, id, searchParams) {
    const { rows, next } = await SubmissionHistoryService.faculty(actor, id, searchParams);
    return { rows, nextCursor: next || '' };
  }

  static async getSubmission(actor, id) {
    const submission = await SubmissionService.getSubmission(actor, id);
    return {
      ...submission,
      code: decodeBinaryCode(submission.code),
    };
  }

  static async deleteSubmission(actor, id) {
    if (!actor || (actor.role !== 'faculty' && actor.role !== 'admin')) {
      throw { status: 401, message: 'Unauthorized: Only faculty or admins can delete submissions.' };
    }
    const subId = Number(id);
    if (!Number.isSafeInteger(subId) || subId <= 0) {
      throw { status: 400, message: 'Invalid submission ID' };
    }
    try {
      const [row] = await sql.query('SELECT coderank_reset_submission($1,$2) AS result', [actor.id, subId]);
      return row.result;
    } catch (error) {
      if (error.code === '42501') throw { status: 403, message: 'Current course assignment required' };
      if (error.code === 'P0002') throw { status: 404, message: 'Submission not found' };
      throw error;
    }
  }

  static async saveWorkspace(actor, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Expected a JSON object' };
    }
    if (!actor || actor.role !== 'student') {
      throw { status: 401, message: 'Unauthorized' };
    }

    let { practical_id, practicalId: altId, code, language } = body;
    practical_id = practical_id ?? altId;
    let pId = practical_id;
    if (typeof pId === 'string' && pId.startsWith('practical_')) {
      pId = pId.replace('practical_', '');
    }
    const practicalId = Number(pId);
    if (!Number.isSafeInteger(practicalId) || practicalId <= 0) throw { status: 400, message: 'Invalid practical_id' };
    await PracticalService.authorize(actor, practicalId);
    
    if (language && !ALLOWED_LANGUAGES.has(language)) throw { status: 400, message: 'Invalid language' };
    if (typeof code !== 'string' || Buffer.byteLength(code, 'utf8') > 128 * 1024 || !language) throw { status: 400, message: 'Invalid workspace code or language' };
    
    await sql`
      INSERT INTO student_workspaces (student_id, practical_id, language, latest_code, saved_at)
      VALUES (${actor.id}, ${practicalId}, ${language}, convert_to(${code}, 'UTF8'), NOW())
      ON CONFLICT (student_id, practical_id, language)
      DO UPDATE SET latest_code = EXCLUDED.latest_code, saved_at = NOW()
    `;

    return { success: true };
  }

  static async loadWorkspace(actor, practicalId, language) {
    if (!actor || actor.role !== 'student') {
      throw { status: 401, message: 'Unauthorized' };
    }

    let pId = practicalId;
    if (typeof pId === 'string' && pId.startsWith('practical_')) {
      pId = pId.replace('practical_', '');
    }
    const pIdNum = Number(pId);
    if (!Number.isSafeInteger(pIdNum) || pIdNum <= 0) throw { status: 400, message: 'Invalid practical_id' };
    await PracticalService.authorize(actor, pIdNum);
    if (language && !ALLOWED_LANGUAGES.has(language)) throw { status: 400, message: 'Invalid language' };

    let rows;
    if (language) {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at 
        FROM student_workspaces 
        WHERE student_id = ${actor.id} AND practical_id = ${pIdNum} AND language = ${language}
        ORDER BY saved_at DESC LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT convert_from(latest_code, 'UTF8') as code, language, saved_at 
        FROM student_workspaces 
        WHERE student_id = ${actor.id} AND practical_id = ${pIdNum}
        ORDER BY saved_at DESC LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return { code: '', latest_code: '', language: language || 'python' };
    }

    const codeStr = rows[0].code || '';
    return {
      code: codeStr,
      latest_code: codeStr,
      language: rows[0].language,
      saved_at: rows[0].saved_at
    };
  }
}
