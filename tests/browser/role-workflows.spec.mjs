import { test, expect } from '@playwright/test';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Browser integration fixture requires ${name}`);
  return value;
}
function practicalId() {
  const value = required('E2E_PRACTICAL_ID');
  if (!/^[1-9]\d*$/.test(value)) throw new Error('E2E_PRACTICAL_ID must be a positive integer');
  return Number(value);
}
async function login(page, role) {
  await page.goto('/login');
  await page.getByLabel('Username or Email', { exact: true }).fill(required(`E2E_${role.toUpperCase()}_EMAIL`));
  await page.getByLabel('Password', { exact: true }).fill(required(`E2E_${role.toUpperCase()}_PASSWORD`));
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign In →', exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/${role}/?$`));
  const identity = await page.evaluate(() => ({ token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null') }));
  expect(identity.token).toBeTruthy();
  expect(identity.user.role).toBe(role);
  return { ...identity, headers: { Authorization: `Bearer ${identity.token}` } };
}
async function getJson(request, path, headers) {
  const response = await request.get(path, { headers });
  expect(response.status(), `GET ${path}`).toBe(200);
  return response.json();
}
function failOnPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return () => expect(errors, 'No browser runtime or hydration exceptions').toEqual([]);
}

test('administrator hydrates dashboard, retains login on reload and loads master selectors', async ({ page, context }) => {
  const assertNoErrors = failOnPageErrors(page);
  const { headers } = await login(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Dashboard Overview', exact: true })).toBeVisible();
  const stats = await getJson(context.request, '/api/stats', headers);
  expect(Number(stats.courses)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard Overview', exact: true })).toBeVisible();
  const courses = await getJson(context.request, '/api/courses?limit=1', headers);
  expect(courses).toHaveLength(1);
  await page.goto('/admin/courses');
  await expect(page.getByRole('heading', { name: 'Courses Management', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: courses[0].course_code, exact: true })).toBeVisible();
  const departments = await getJson(context.request, '/api/departments?limit=1', headers);
  expect(departments).toHaveLength(1);
  await page.goto('/admin/departments');
  await expect(page.getByRole('heading', { name: 'Department Master', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: departments[0].name, exact: true })).toBeVisible();
  assertNoErrors();
});

test('faculty course selection renders the assigned practical and survives refresh', async ({ page, context }) => {
  const assertNoErrors = failOnPageErrors(page);
  const { headers } = await login(page, 'faculty');
  await expect(page.getByRole('heading', { name: 'Select Allocated Subject', exact: true })).toBeVisible();
  const practical = await getJson(context.request, `/api/faculty/practicals/${practicalId()}`, headers);
  const courses = await getJson(context.request, '/api/faculty/courses', headers);
  const course = courses.find(item => Number(item.id) === Number(practical.course_id));
  expect(course, 'Seeded faculty is assigned to practical course').toBeTruthy();
  await page.getByRole('heading', { name: course.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Available Practicals', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: practical.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/faculty(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'Available Practicals', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: practical.title, exact: true })).toBeVisible();
  assertNoErrors();
});

test('student dashboard shows the assigned practical and retains current authentication on refresh', async ({ page, context }) => {
  const assertNoErrors = failOnPageErrors(page);
  const { headers, token } = await login(page, 'student');
  const practicals = await getJson(context.request, '/api/student/practicals', headers);
  const practical = practicals.find(item => Number(item.id) === practicalId());
  expect(practical, 'Active practical matches the student batch and semester').toBeTruthy();
  await expect(page.getByRole('heading', { name: 'My Assigned Subjects & Practicals', exact: true })).toBeVisible();
  await expect(page.getByText(practical.title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/student\/?$/);
  await expect(page.getByText(practical.title, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(token);
  const profile = await getJson(context.request, '/api/auth/profile', headers);
  expect(profile.user.role).toBe('student');
  assertNoErrors();
});

test('browser sessions enforce role mutations, grade ownership and hidden-case privacy', async ({ page, context, browser }) => {
  const student = await login(page, 'student');
  const facultyContext = await browser.newContext({ baseURL: process.env.BROWSER_BASE_URL || 'http://127.0.0.1:3101' });
  try {
    const facultyPage = await facultyContext.newPage();
    const faculty = await login(facultyPage, 'faculty');
    const submissions = await getJson(facultyContext.request, `/api/faculty/practicals/${practicalId()}/submissions`, faculty.headers);
    const own = submissions.find(row => Number(row.student_id) === Number(student.user.id));
    const other = submissions.find(row => Number(row.student_id) !== Number(student.user.id));
    expect(own, 'Fixture includes the logged-in student grade').toBeTruthy();
    expect(other, 'Fixture includes another student grade').toBeTruthy();
    const grade = await getJson(context.request, `/api/faculty/submissions/${own.id}`, student.headers);
    expect(Number(grade.student_id)).toBe(Number(student.user.id));
    const hidden = grade.cases.filter(item => item.is_hidden);
    expect(hidden.length, 'Seed includes hidden grading cases').toBeGreaterThan(0);
    for (const item of hidden) {
      for (const key of ['input', 'expected', 'actual_output', 'error_message', 'output']) expect(item).not.toHaveProperty(key);
    }
    const otherGrade = await context.request.get(`/api/faculty/submissions/${other.id}`, { headers: student.headers });
    expect(otherGrade.status()).toBe(403);
    const deniedMutations = [
      await context.request.post('/api/courses', { headers: student.headers, data: { course_code: 'BROWSER_DENIED', name: 'Must never be created', semester: 1 } }),
      await context.request.put(`/api/faculty/practicals/${practicalId()}`, { headers: student.headers, data: { title: 'Must never be changed' } }),
      await facultyContext.request.post('/api/departments', { headers: faculty.headers, data: { name: 'BROWSER_DENIED', institute_name: 'Must never be created' } }),
    ];
    for (const response of deniedMutations) expect(response.status()).toBe(401);
    const original = await getJson(facultyContext.request, `/api/faculty/practicals/${practicalId()}`, faculty.headers);
    expect(original.title).not.toBe('Must never be changed');
    const anonymous = await context.request.get('/api/users');
    expect(anonymous.status()).toBe(401);
  } finally {
    await facultyContext.close();
  }
});

// Capture only public pages or disposable fixture data; never capture login credentials.
test('public pages preserve theme and remain usable at phone, tablet and desktop widths', async ({page}) => {
 const assertNoErrors=failOnPageErrors(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [360,768,1280]) {
  await page.setViewportSize({width,height:900});
  for(const route of ['/', '/login', '/signup']) {
   await page.goto(route);
   await expect(page.locator('h1')).toBeVisible();
   expect(await page.locator('.admin-desktop-sidebar').count()).toBe(0);
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,text:el.textContent?.slice(0,50),right:el.getBoundingClientRect().right}))}));
   expect(layout.scrollWidth,`No horizontal page clipping: ${route} ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.width+1);
   if(route==='/'){
    await expect(page.getByRole('heading',{name:'RANK UP CODING'})).toBeVisible();
    expect(await page.locator('footer input, footer a[href^="mailto:"]').count()).toBe(0);
   }
   if(route==='/login') {
    await page.getByLabel('Password',{exact:true}).fill('');
    await expect(page.getByRole('button',{name:'Sign In →',exact:true})).toBeVisible();
   }
   await page.screenshot({path:`test-results/ui-review/${route==='/'?'home':route.slice(1)}-${width}.png`,fullPage:true});
  }
 }
 assertNoErrors();
});
test('admin menu preserves existing destinations and keyboard operation on mobile', async ({page}) => {
 await login(page,'admin');
 await page.setViewportSize({width:360,height:900});
 await page.getByRole('button',{name:'Open admin menu'}).click();
 const menu=page.getByRole('dialog',{name:'Admin menu'});
 await expect(menu).toBeVisible();
 for(const label of ['Dashboard','Department Master','Faculty Master','Student Master','Courses','Course Mapping','Activity Logs','Settings','Profile'])await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();
 await expect(menu.getByRole('button',{name:'Change Password',exact:true})).toBeVisible();
 await expect(menu.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/ui-review/admin-mobile.png',fullPage:true});
 await page.keyboard.press('Escape');
 await expect(menu).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Open admin menu'})).toBeFocused();
});
