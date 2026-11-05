/**
 * Full End-to-End Route and Page Verification Script
 * Validates all public, authenticated, student, faculty, admin, and execution routes.
 */

const BASE_URL = 'http://localhost:3000';

async function testRoute(name, url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - started;
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text.substring(0, 100).replace(/\n/g, ' ') + '...';
    }

    const ok = res.status >= 200 && res.status < 400;
    return {
      name,
      url,
      method: options.method || 'GET',
      status: res.status,
      ok,
      durationMs: duration,
      data,
    };
  } catch (err) {
    return {
      name,
      url,
      method: options.method || 'GET',
      status: 0,
      ok: false,
      durationMs: Date.now() - started,
      error: err.message,
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log('  CodeRank Full Platform & API Verification');
  console.log('  Target: ' + BASE_URL);
  console.log('====================================================\n');

  const results = [];

  // 1. PUBLIC ROUTES
  console.log('--- 1. Testing Public Routes ---');
  results.push(await testRoute('Landing Page', `${BASE_URL}/`));
  results.push(await testRoute('Login Page', `${BASE_URL}/login`));
  results.push(await testRoute('Health API', `${BASE_URL}/api/health`));
  results.push(await testRoute('Queue Stats API', `${BASE_URL}/api/queue/stats`));

  // 2. AUTHENTICATION
  console.log('--- 2. Testing Authentication ---');
  const adminLogin = await testRoute('Admin Login', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'adminpassword123' }),
  });
  results.push(adminLogin);
  const adminToken = adminLogin.data?.token;

  const studentLogin = await testRoute('Student Login', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '26ce001@charusat.edu.in', password: 'LoadTest@2024' }),
  });
  results.push(studentLogin);
  const studentToken = studentLogin.data?.token;

  const facultyLogin = await testRoute('Faculty Login', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hardi.agola@charusat.ac.in', password: 'LoadTest@2024' }),
  });
  results.push(facultyLogin);
  const facultyToken = facultyLogin.data?.token;

  // 3. PROFILE & ROLES
  console.log('--- 3. Testing Authenticated Profiles ---');
  if (adminToken) {
    results.push(await testRoute('Admin Profile', `${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }));
  }
  if (studentToken) {
    results.push(await testRoute('Student Profile', `${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }));
  }
  if (facultyToken) {
    results.push(await testRoute('Faculty Profile', `${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    }));
  }

  // 4. STUDENT WORKFLOWS
  console.log('--- 4. Testing Student APIs & Pages ---');
  results.push(await testRoute('Student Dashboard UI', `${BASE_URL}/student`, {
    headers: studentToken ? { Cookie: `token=${studentToken}` } : {},
  }));
  if (studentToken) {
    results.push(await testRoute('Student Practicals List', `${BASE_URL}/api/student/practicals`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }));
    results.push(await testRoute('Student Submissions History', `${BASE_URL}/api/student/submissions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }));
    results.push(await testRoute('Student Workspace Save', `${BASE_URL}/api/student/workspaces/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        practicalId: '1',
        language: 'python',
        code: 'print("Full verification test")',
      }),
    }));
    results.push(await testRoute('Student Workspace Load', `${BASE_URL}/api/student/workspaces/load?practicalId=1`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    }));
  }

  // 5. FACULTY WORKFLOWS
  console.log('--- 5. Testing Faculty APIs & Pages ---');
  results.push(await testRoute('Faculty Dashboard UI', `${BASE_URL}/faculty`, {
    headers: facultyToken ? { Cookie: `token=${facultyToken}` } : {},
  }));
  if (facultyToken) {
    results.push(await testRoute('Faculty Courses List', `${BASE_URL}/api/faculty/courses`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    }));
    results.push(await testRoute('Faculty Practicals List', `${BASE_URL}/api/faculty/practicals`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    }));
    results.push(await testRoute('Faculty Course Stats', `${BASE_URL}/api/faculty/courses/5/stats`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    }));
    results.push(await testRoute('Faculty Submissions View', `${BASE_URL}/api/faculty/practicals/1/submissions`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    }));
  }

  // 6. ADMIN WORKFLOWS
  console.log('--- 6. Testing Admin APIs & Pages ---');
  results.push(await testRoute('Admin Dashboard UI', `${BASE_URL}/admin`, {
    headers: adminToken ? { Cookie: `token=${adminToken}` } : {},
  }));
  if (adminToken) {
    results.push(await testRoute('Admin Detailed Health API', `${BASE_URL}/api/health/detailed`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }));
    results.push(await testRoute('Admin Courses Management', `${BASE_URL}/api/courses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }));
    results.push(await testRoute('Admin Departments Management', `${BASE_URL}/api/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }));
  }

  // 7. CODE EXECUTION ROUND TRIP
  console.log('--- 7. Testing End-to-End Code Execution Pipeline ---');
  if (studentToken) {
    const execRes = await testRoute('Code Execution Enqueue', `${BASE_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        language: 'python',
        code: 'print("CodeRank verification: 2 + 2 =", 2 + 2)',
        input: '',
      }),
    });
    results.push(execRes);

    const jobId = execRes.data?.jobId;
    if (jobId) {
      console.log(`   Job enqueued with ID: ${jobId}, polling status...`);
      let attempts = 0;
      let finalJob = null;
      while (attempts < 15) {
        await new Promise((r) => setTimeout(r, 800));
        attempts++;
        finalJob = await testRoute(`Job Status Poll (Attempt ${attempts})`, `${BASE_URL}/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${studentToken}` },
        });
        if (finalJob.data?.status === 'completed' || finalJob.data?.status === 'failed') {
          break;
        }
      }
      results.push({
        name: 'Job Execution Completed',
        url: `${BASE_URL}/api/jobs/${jobId}`,
        method: 'GET',
        status: finalJob.status,
        ok: finalJob.data?.status === 'completed',
        durationMs: attempts * 800,
        data: {
          jobStatus: finalJob.data?.status,
          output: finalJob.data?.output,
        },
      });
    }
  }

  // PRINT SUMMARY
  console.log('\n====================================================');
  console.log('  ROUTE & PLATFORM VERIFICATION SUMMARY');
  console.log('====================================================\n');

  let passed = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.method.padEnd(5)} ${r.name.padEnd(32)} (${r.durationMs}ms)`);
    if (r.ok) passed++;
    else if (r.error) console.log(`   Error: ${r.error}`);
    else if (r.data?.error) console.log(`   API Error: ${JSON.stringify(r.data.error)}`);
  }

  console.log(`\nResults: ${passed} / ${results.length} checks passed successfully.`);
  console.log('====================================================\n');

  if (passed === results.length) {
    console.log('🎉 ALL API ROUTES AND WEBSITE WORKFLOWS ARE WORKING!');
  } else {
    console.warn(`⚠️ ${results.length - passed} checks encountered issues.`);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
