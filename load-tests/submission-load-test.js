/**
 * ============================================================
 * CodeRank — Submission Load Test
 * ============================================================
 * Purpose:
 *  Simulates a complete lab session where many students
 *  simultaneously submit code, which goes through:
 *    → POST /api/student/practicals/:id/submit  (or /api/submit)
 *    → Code execution pipeline (/api/execute)
 *    → Job polling (/api/jobs/:jobId)
 *    → Workspace save (/api/student/workspaces/save)
 *    → Results fetched by faculty (/api/faculty/practicals/:id/submissions)
 *
 * Tests:
 *  1. Concurrent student submissions at lab scale (30–120 students)
 *  2. Execution pipeline throughput under submission burst
 *  3. Workspace save/load under concurrent access
 *  4. Faculty dashboard polling while submissions happen
 *  5. Mixed language submissions (Python, C, C++, Java)
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:3000 -e JWT_TOKEN=student_token -e FACULTY_TOKEN=faculty_token -e PRACTICAL_ID=1 load-tests/submission-load-test.js
 *
 * ⚠️  For pure server capacity: Set DISABLE_RATE_LIMIT=true, DISABLE_CACHE=true
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const submissionsAccepted   = new Counter('submissions_accepted');
const submissionsFailed     = new Counter('submissions_failed');
const executionSuccessRate  = new Rate('execution_success_rate');
const workspaceSaveRate     = new Rate('workspace_save_rate');
const submissionLatency     = new Trend('submission_latency_ms');
const jobCompletionTime     = new Trend('job_completion_time_ms');

// ─── Load Profile ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // ── Student submission surge (primary load) ─────────────────────────────
    student_submissions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 20  },  // 20 students start working
        { duration: '30s', target: 60  },  // Mid-lab: 60 students submitting
        { duration: '45s', target: 120 },  // Peak: full class of 120 submitting
        { duration: '30s', target: 80  },  // Late lab: some done
        { duration: '15s', target: 0   },  // Lab ends
      ],
      tags: { role: 'student' },
      exec: 'studentSubmissionFlow',
    },

    // ── Faculty monitoring (concurrent) ────────────────────────────────────
    faculty_monitoring: {
      executor: 'constant-vus',
      vus: 5,                   // 5 faculty members watching dashboards
      duration: '2m15s',
      tags: { role: 'faculty' },
      exec: 'facultyMonitoringFlow',
    },
  },

  thresholds: {
    // Submission pipeline health
    'submissions_accepted':                   ['count>0'],
    'execution_success_rate':                 ['rate>0.85'],       // 85%+ executions succeed
    'workspace_save_rate':                    ['rate>0.90'],       // 90%+ saves succeed
    'submission_latency_ms':                  ['p(90)<3000'],      // 90% submissions accepted in <3s
    'job_completion_time_ms':                 ['p(75)<15000'],     // 75% jobs complete in <15s

    // HTTP health
    'http_req_failed{role:student}':          ['rate<0.10'],       // <10% failures for students
    'http_req_failed{role:faculty}':          ['rate<0.05'],       // <5% failures for faculty
    'http_req_duration{role:student}':        ['p(95)<5000'],
    'http_req_duration{role:faculty}':        ['p(95)<3000'],
  },
};

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL       = __ENV.BASE_URL       || 'http://localhost:3000';
const JWT_TOKEN      = __ENV.JWT_TOKEN      || '';   // Student JWT
const FACULTY_TOKEN  = __ENV.FACULTY_TOKEN  || '';   // Faculty JWT
const PRACTICAL_ID   = __ENV.PRACTICAL_ID   || '1';
const COURSE_ID      = __ENV.COURSE_ID      || '1';

const studentHeaders = {
  'Content-Type': 'application/json',
  ...(JWT_TOKEN ? { Authorization: `Bearer ${JWT_TOKEN}` } : {}),
};

const facultyHeaders = {
  'Content-Type': 'application/json',
  ...(FACULTY_TOKEN ? { Authorization: `Bearer ${FACULTY_TOKEN}` } : {}),
};

// ─── Code Samples (mixed languages) ──────────────────────────────────────────
const codesamples = [
  {
    language: 'python',
    code: `
def factorial(n):
    if n <= 1: return 1
    return n * factorial(n-1)

n = int(input())
print(factorial(n))
`,
    input: '5',
  },
  {
    language: 'c',
    code: `
#include <stdio.h>
int main() {
    int n, sum = 0;
    scanf("%d", &n);
    for (int i = 1; i <= n; i++) sum += i;
    printf("%d\\n", sum);
    return 0;
}
`,
    input: '10',
  },
  {
    language: 'cpp',
    code: `
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> v(n);
    for (auto& x : v) cin >> x;
    sort(v.begin(), v.end());
    for (auto x : v) cout << x << " ";
    return 0;
}
`,
    input: '5\n3 1 4 1 5',
  },
  {
    language: 'java',
    code: `
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long fib = 1, prev = 0;
        for (int i = 1; i < n; i++) {
            long next = fib + prev;
            prev = fib;
            fib = next;
        }
        System.out.println(fib);
    }
}
`,
    input: '10',
  },
];

function pickCode() {
  return codesamples[Math.floor(Math.random() * codesamples.length)];
}

// ─── Student Submission Flow ──────────────────────────────────────────────────
export function studentSubmissionFlow() {
  const sample = pickCode();

  // Step 1: Load practicals (like page load)
  group('1. Load Student Practicals', () => {
    const res = http.get(`${BASE_URL}/api/student/practicals`, {
      headers: studentHeaders,
      tags: { name: 'Load_Practicals', role: 'student' },
    });
    check(res, { 'practicals loaded': (r) => r.status === 200 || r.status === 401 });
  });

  sleep(Math.random() * 2 + 0.5); // Student reads the problem: 0.5–2.5s

  // Step 2: Load workspace (check saved code)
  group('2. Load Workspace', () => {
    const res = http.get(
      `${BASE_URL}/api/student/workspaces/load?practicalId=${PRACTICAL_ID}`,
      {
        headers: studentHeaders,
        tags: { name: 'Load_Workspace', role: 'student' },
      }
    );
    check(res, { 'workspace loaded': (r) => r.status === 200 || r.status === 401 || r.status === 404 });
  });

  sleep(Math.random() * 3 + 1); // Student codes: 1–4s simulated

  // Step 3: Save workspace
  group('3. Save Workspace', () => {
    const body = JSON.stringify({
      practicalId: PRACTICAL_ID,
      code: sample.code,
      language: sample.language,
    });

    const res = http.post(`${BASE_URL}/api/student/workspaces/save`, body, {
      headers: studentHeaders,
      tags: { name: 'Save_Workspace', role: 'student' },
    });

    const ok = check(res, {
      'workspace saved': (r) => r.status === 200 || r.status === 201 || r.status === 401,
    });
    workspaceSaveRate.add(ok && res.status !== 401 ? 1 : 0);
  });

  // Step 4: Run code (test before final submit)
  let jobId = null;
  group('4. Test Run Code', () => {
    const body = JSON.stringify({
      language: sample.language,
      code: sample.code,
      input: sample.input,
    });

    const res = http.post(`${BASE_URL}/api/execute`, body, {
      headers: studentHeaders,
      tags: { name: 'TestRun_Execute', role: 'student' },
      timeout: '15s',
    });

    if (res.status === 200 || res.status === 202) {
      try {
        const body = JSON.parse(res.body);
        jobId = body.jobId || null;
      } catch (e) {}
    }

    check(res, {
      'test run accepted': (r) => r.status === 200 || r.status === 202 || r.status === 401,
    });
  });

  // Step 5: Poll for job completion (if async)
  if (jobId) {
    group('5. Poll Job Completion', () => {
      const start = Date.now();
      let attempts = 0;

      while (attempts < 12) {
        sleep(1);
        attempts++;

        const res = http.get(`${BASE_URL}/api/jobs/${jobId}`, {
          headers: studentHeaders,
          tags: { name: 'Poll_Job', role: 'student' },
        });

        if (res.status === 200) {
          try {
            const data = JSON.parse(res.body);
            if (data.status === 'completed' || data.status === 'failed') {
              jobCompletionTime.add(Date.now() - start);
              executionSuccessRate.add(data.status === 'completed' ? 1 : 0);
              break;
            }
          } catch (e) {}
        }
      }
    });
  }

  sleep(Math.random() * 1 + 0.5); // Review output: 0.5–1.5s

  // Step 6: Final submission
  group('6. Final Submission', () => {
    const body = JSON.stringify({
      code: sample.code,
      language: sample.language,
      input: sample.input,
    });

    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/student/practicals/${PRACTICAL_ID}/submit`,
      body,
      {
        headers: studentHeaders,
        tags: { name: 'Final_Submit', role: 'student' },
        timeout: '20s',
      }
    );

    submissionLatency.add(Date.now() - start);

    const ok = check(res, {
      'submission accepted': (r) =>
        r.status === 200 || r.status === 201 || r.status === 202 || r.status === 401,
    });

    if (ok && res.status !== 401) {
      submissionsAccepted.add(1);
    } else if (!ok) {
      submissionsFailed.add(1);
    }
  });

  sleep(1);
}

// ─── Faculty Monitoring Flow ──────────────────────────────────────────────────
export function facultyMonitoringFlow() {
  // Faculty polls submission list every few seconds
  group('Faculty: Poll Practical Submissions', () => {
    const res = http.get(
      `${BASE_URL}/api/faculty/practicals/${PRACTICAL_ID}/submissions`,
      {
        headers: facultyHeaders,
        tags: { name: 'Faculty_Poll_Submissions', role: 'faculty' },
      }
    );
    check(res, {
      'faculty submissions loaded': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    });
  });

  sleep(0.5);

  group('Faculty: Poll Course Stats', () => {
    const res = http.get(
      `${BASE_URL}/api/faculty/courses/${COURSE_ID}/stats`,
      {
        headers: facultyHeaders,
        tags: { name: 'Faculty_Poll_CourseStats', role: 'faculty' },
      }
    );
    check(res, {
      'course stats loaded': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    });
  });

  sleep(0.5);

  group('Faculty: Poll Practical Stats', () => {
    const res = http.get(
      `${BASE_URL}/api/faculty/practicals/${PRACTICAL_ID}/stats`,
      {
        headers: facultyHeaders,
        tags: { name: 'Faculty_Poll_PracticalStats', role: 'faculty' },
      }
    );
    check(res, {
      'practical stats loaded': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    });
  });

  sleep(3); // Faculty checks every ~4s in real usage
}
