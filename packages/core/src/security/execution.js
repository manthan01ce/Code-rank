import { randomBytes } from 'node:crypto';

export const GUEST_COOKIE = 'coderank_execution_session';
export const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

export function guestActor(cookieHeader = '', create = false) {
  const raw = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(`${GUEST_COOKIE}=`))?.slice(GUEST_COOKIE.length + 1);
  const id = raw && /^[a-f0-9]{64}$/.test(raw) ? raw : (create ? randomBytes(32).toString('hex') : null);
  return id ? { id: `guest:${id}`, role: 'guest', cookie: id } : null;
}

export function canReadJob(job, actor) {
  if (!actor || job.data.userId == null) return false;
  return actor.role === 'admin' || String(job.data.userId) === String(actor.id);
}

// Allowlist hidden-case fields so new confidential fields cannot leak by default.
export function publicCase(value) {
  if (!value?.is_hidden && !value?.hidden) return value;
  const result = {};
  for (const key of ['index', 'id', 'testCaseId', 'label', 'status', 'passed', 'is_hidden', 'hidden', 'marks_awarded', 'max_marks', 'runtimeMs', 'execution_time_ms']) {
    if (key in value) result[key] = value[key];
  }
  return result;
}

export function publicResult(result) {
  if (!result || typeof result !== 'object') return result;
  return { ...result, ...(Array.isArray(result.cases) ? { cases: result.cases.map(publicCase) } : {}) };
}

export function validateExecution({ language, code, input = '' }) {
  if (!ALLOWED_LANGUAGES.has(language)) throw { status: 400, message: 'Unsupported language' };
  if (typeof code !== 'string' || !code.trim()) throw { status: 400, message: 'Code cannot be empty' };
  if (typeof input !== 'string') throw { status: 400, message: 'Input must be a string' };
  if (Buffer.byteLength(code) > 128 * 1024 || Buffer.byteLength(input) > 128 * 1024) {
    throw { status: 413, message: 'Code and input must each be at most 128 KiB' };
  }
}

export function assertPracticalPolicy(user, practical, profile, { submit = false, now = Date.now(), assignedFaculty = false } = {}) {
  if (!user || user.role === 'guest') throw { status: 401, message: 'Authentication required' };
  if (!practical || practical.status !== 'active') throw { status: 404, message: 'Practical not found or inactive' };
  if (submit && user.role !== 'student') throw { status: 403, message: 'Only students may submit practicals' };
  if (user.role === 'student') {
    if (!profile || profile.status !== 'active' || (profile.session_token && profile.session_token !== user.session_token)) {
      throw { status: 401, message: 'Session is no longer active' };
    }
    const extra = profile.extra_info || {};
    const batch = String(practical.batch_id || '').trim().toLowerCase();
    const studentBatch = String(extra.batch || '').trim().toLowerCase();
    const studentDivision = String(extra.division || '').trim().toLowerCase();
    const batchMatches = !batch || batch === 'all' || (studentBatch && batch === studentBatch) || (studentDivision && batch === studentDivision);

    const practicalSemester = practical.semester != null ? Number(practical.semester) : null;
    const studentSemester = Number(extra.semester);
    const semMatches = practicalSemester == null || (Number.isInteger(studentSemester) && studentSemester > 0 && studentSemester === practicalSemester);

    if (!batchMatches || !semMatches) {
      throw { status: 403, message: 'Practical is not assigned to your batch/semester' };
    }
  } else if (user.role !== 'admin' && !(user.role === 'faculty' && assignedFaculty)) {
    throw { status: 403, message: 'You are not assigned to this course' };
  }
  if (practical.start_time && now < new Date(practical.start_time).getTime()) {
    throw { status: 403, message: 'This practical has not started yet' };
  }
}
