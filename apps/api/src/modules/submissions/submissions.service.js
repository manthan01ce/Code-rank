import { SubmissionService } from '@coderank/core/services/SubmissionService';
import { SubmissionHistoryService, pageOptions } from '@coderank/core/services/SubmissionHistoryService';
import { ExecutionService } from '../execution/execution.service.js';

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
    return await SubmissionService.deleteSubmission(actor, id);
  }

  static async loadWorkspace(actor, practicalId, language) {
    return await SubmissionService.loadWorkspace(actor, practicalId, language);
  }

  static async saveWorkspace(actor, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Expected a JSON object' };
    }
    return await SubmissionService.saveWorkspace(actor, body);
  }
}
