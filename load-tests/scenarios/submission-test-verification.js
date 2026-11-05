import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const workspaceSaveRate = new Rate('workspace_save_rate');
const workspaceLoadRate = new Rate('workspace_load_rate');
const facultyPollRate   = new Rate('faculty_poll_rate');
const executionSuccessRate = new Rate('execution_success_rate');

export const options = {
  scenarios: {
    students: {
      executor: 'constant-vus',
      vus: 5,
      duration: '15s',
      exec: 'studentFlow',
    },
    faculty: {
      executor: 'constant-vus',
      vus: 2,
      duration: '15s',
      exec: 'facultyFlow',
    },
  },
  thresholds: {
    workspace_save_rate: ['rate>0.90'],
    workspace_load_rate: ['rate>0.90'],
    faculty_poll_rate:   ['rate>0.90'],
    http_req_failed:     ['rate<0.05'],
  },
};

const BASE_URL      = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN     = __ENV.JWT_TOKEN || '';
const FACULTY_TOKEN = __ENV.FACULTY_TOKEN || '';
const PRACTICAL_ID  = __ENV.PRACTICAL_ID || '1';
const COURSE_ID     = __ENV.COURSE_ID || '5';

const studentHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

const facultyHeaders = {
  'Content-Type': 'application/json',
  ...(FACULTY_TOKEN ? { Authorization: `Bearer ${FACULTY_TOKEN}` } : {}),
};

export function studentFlow() {
  // 1. Load workspace
  const loadRes = http.get(`${BASE_URL}/api/student/workspaces/load?practicalId=${PRACTICAL_ID}`, {
    headers: studentHeaders,
  });
  const loadOk = check(loadRes, {
    'workspace loaded 200': (r) => r.status === 200,
  });
  workspaceLoadRate.add(loadOk ? 1 : 0);

  // 2. Save workspace
  const saveBody = JSON.stringify({
    practicalId: PRACTICAL_ID,
    language: 'python',
    code: 'print("improvement verification")',
  });
  const saveRes = http.post(`${BASE_URL}/api/student/workspaces/save`, saveBody, {
    headers: studentHeaders,
  });
  const saveOk = check(saveRes, {
    'workspace saved 200': (r) => r.status === 200,
  });
  workspaceSaveRate.add(saveOk ? 1 : 0);

  // 3. Test execute
  const execRes = http.post(`${BASE_URL}/api/execute`, JSON.stringify({
    language: 'python',
    code: 'print("verified")',
    input: '',
  }), {
    headers: studentHeaders,
    timeout: '10s',
  });
  check(execRes, {
    'execute accepted': (r) => r.status === 200 || r.status === 202,
  });

  sleep(1);
}

export function facultyFlow() {
  const res = http.get(`${BASE_URL}/api/faculty/practicals/${PRACTICAL_ID}/submissions`, {
    headers: facultyHeaders,
  });
  const ok = check(res, {
    'faculty submissions 200': (r) => r.status === 200,
  });
  facultyPollRate.add(ok ? 1 : 0);

  const res2 = http.get(`${BASE_URL}/api/faculty/courses/${COURSE_ID}/stats`, {
    headers: facultyHeaders,
  });
  check(res2, {
    'faculty course stats 200': (r) => r.status === 200,
  });

  sleep(1);
}

