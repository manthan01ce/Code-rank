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
  await page.getByLabel('Username or email', { exact: true }).fill(required(`E2E_${role.toUpperCase()}_EMAIL`));
  await page.getByLabel('Password', { exact: true }).fill(required(`E2E_${role.toUpperCase()}_PASSWORD`));
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /sign in/i }).click();
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
  await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  const stats = await getJson(context.request, '/api/stats', headers);
  expect(Number(stats.courses)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  const courses = await getJson(context.request, '/api/courses?limit=1', headers);
  expect(courses).toHaveLength(1);
  await page.goto('/admin/courses');
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
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
  const shell = await context.request.get(`/student/code/practical_${practicalId()}`);
  expect(await shell.text()).not.toContain(practical.title);
  const anonymousDetail = await context.request.get(`/api/student/practicals/${practicalId()}`);
  expect(anonymousDetail.status()).toBe(401);
  const courses = await getJson(context.request, '/api/faculty/courses', headers);
  const course = courses.find(item => Number(item.id) === Number(practical.course_id));
  expect(course, 'Seeded faculty is assigned to practical course').toBeTruthy();
  await page.getByRole('heading', { name: course.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Available Practicals', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: practical.title, exact: true })).toBeVisible();
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: practical.title, exact: true }) }).getByRole('button', { name: 'Grades', exact: true }).click();
  const report = page.getByRole('dialog', { name: 'Practical grade report' });
  await expect(report).toBeVisible();
  await expect(report.getByRole('button', { name: 'First grade page' })).toBeVisible();
  const gradePage = await getJson(context.request, `/api/faculty/practicals/${practicalId()}/stats?limit=1`, headers);
  expect(gradePage.students).toHaveLength(1);
  expect(gradePage.pagination.nextCursor).toBeTruthy();
  const secondPage = await getJson(context.request, `/api/faculty/practicals/${practicalId()}/stats?limit=1&cursor=${gradePage.pagination.nextCursor}`, headers);
  expect(secondPage.students[0].id).not.toBe(gradePage.students[0].id);
  await report.getByRole('button', { name: 'Close grades' }).click();
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
  await expect(page.getByRole('heading', { name: /(?:my learning workspace|my assigned subjects)/i })).toBeVisible();
  await expect(page.getByText(practical.title, { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Dashboard practical pages' })).toBeVisible();
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
    const featureBounds = await page.locator('#experience').evaluate(el => Array.from(el.querySelectorAll('button, #feature-detail h3, #feature-detail p')).map(node => ({ text: node.textContent.slice(0, 45), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })));
    for (const bounds of featureBounds) {
      expect(bounds.left, `Feature is not clipped on the left: ${bounds.text}`).toBeGreaterThanOrEqual(0);
      expect(bounds.right, `Feature is not clipped on the right: ${bounds.text}`).toBeLessThanOrEqual(width);
    }
   }
   if(route==='/login') {
    await page.getByLabel('Password', { exact: true }).fill('');
    await expect(page.getByRole('button',{name:/sign in/i})).toBeVisible();
   }
   await page.screenshot({path:`test-results/ui-review/${route==='/'?'home':route.slice(1)}-${width}.png`,fullPage:true,animations:'disabled'});
  }
 }
 assertNoErrors();
});
test('admin menu preserves existing destinations and keyboard operation on mobile', async ({page}) => {
 await login(page,'admin');
 await page.setViewportSize({width:360,height:900});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Admin overflow stays inside content').toBe(true);
 await page.getByRole('button',{name:'Open admin menu'}).click();
 const menu=page.getByRole('dialog',{name:'Admin menu'});
 await expect(menu).toBeVisible();
 for(const label of ['Dashboard','Department Master','Faculty Master','Student Master','Courses','Course Mapping','Activity Logs','Settings','Profile'])await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();
 await expect(menu.getByRole('button',{name:'Change Password',exact:true})).toBeVisible();
 await expect(menu.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/ui-review/admin-mobile.png',fullPage:true,animations:'disabled'});
 await page.keyboard.press('Escape');
 await expect(menu).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Open admin menu'})).toBeFocused();
});

test('student overview and practical selection retain readable themes, navigation and mobile layout', async ({ page, context }) => {
  const assertNoErrors = failOnPageErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { headers, token } = await login(page, 'student');
  const practicals = await getJson(context.request, '/api/student/practicals', headers);
  const practical = practicals.find(item => Number(item.id) === practicalId());
  expect(practical).toBeTruthy();
  const profile = await getJson(context.request, '/api/auth/profile', headers);
  const courses = await getJson(context.request, `/api/courses?semester=${profile.user.extra_info.semester}`, headers);
  const course = courses.find(item => Number(item.id) === Number(practical.course_id));
  expect(course).toBeTruthy();
  for (const theme of ['light', 'dark']) {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/student');
      const root = page.locator('.student-theme');
      if (await root.getAttribute('data-student-theme') !== theme) await page.getByRole('button', { name: 'Light theme', exact: true }).click();
      await expect(root).toHaveAttribute('data-student-theme', theme);
      const row = page.locator('.student-question-row').filter({ hasText: practical.title });
      await expect(row).toBeVisible();
      await expect(row.getByRole('link')).toHaveAttribute('href', /\/student\/code\//);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Dashboard fits ${width}px in ${theme}`).toBe(true);
      // Ensure the body, course and alternating row layers are visibly distinct.
      const layers = await page.locator('.student-dashboard').evaluate(el => ({
        page: getComputedStyle(el).backgroundColor,
        card: getComputedStyle(el.querySelector('.student-course-card')).backgroundColor,
        text: getComputedStyle(el.querySelector('h1')).color,
      }));
      expect(layers.page).not.toBe(layers.card);
      expect(layers.text).not.toBe(layers.card);
      await page.screenshot({ path: `test-results/ui-review/student-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      await page.goto('/student/practicals');
      await expect(page.getByRole('heading', { name: 'Select Course / Subject', exact: true })).toBeVisible();
      await expect(root).toHaveAttribute('data-student-theme', theme);
      const courseButton = page.getByRole('button').filter({ has: page.getByRole('heading', { name: course.name, exact: true }) });
      await expect(courseButton).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Course selection fits ${width}px in ${theme}`).toBe(true);
      await page.screenshot({ path: `test-results/ui-review/courses-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
      await courseButton.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('cell', { name: practical.title, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Switch Subject/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Practical table scrolls within its container at ${width}px in ${theme}`).toBe(true);
      await page.screenshot({ path: `test-results/ui-review/practicals-${theme}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(token);
  assertNoErrors();
});

// Delay an actual server response; do not substitute invented practical data.
test('late practical list response cannot overwrite the newly selected course', async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  await login(page, 'faculty');
  await page.getByRole('heading', { name: 'CI Course', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'CI Practical', exact: true })).toBeVisible();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let captured;
  const requested = new Promise(resolve => { captured = resolve; });
  let completed;
  const delivered = new Promise(resolve => { completed = resolve; });
  const pattern = /\/api\/faculty\/practicals\?course_id=1(?:&|$)/;
  await page.route(pattern, async route => {
    try {
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    } finally { completed(); }
  });
  try {
    await page.getByRole('button', { name: /Switch Subject/ }).click();
    await page.getByRole('heading', { name: 'CI Course', exact: true }).click();
    await requested;
    await page.getByRole('button', { name: /Switch Subject/ }).click();
    await page.getByRole('heading', { name: 'CI Other Course', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'CI Other Practical', exact: true })).toBeVisible();
    const oldResponse = page.waitForResponse(response => pattern.test(response.url()));
    release();
    await (await oldResponse).finished();
    await delivered;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByRole('cell', { name: 'CI Other Practical', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CI Practical', exact: true })).toHaveCount(0);
    assertNoErrors();
  } finally {
    release();
    await page.unroute(pattern);
  }
});

test('administrator downloads a readable credential PDF through the real student form', async ({ page }) => {
  const assertNoErrors = failOnPageErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/students');
  await page.getByRole('button', { name: '+ Add Student', exact: true }).click();
  await page.getByLabel('First Name', { exact: true }).fill('Synthetic');
  await page.getByLabel('Last Name', { exact: true }).fill('Credential');
  await page.getByLabel('Roll Number', { exact: true }).fill('25CE999');
  await page.getByLabel('Division', { exact: true }).fill('CE1');
  const form = page.locator('form').filter({ has: page.getByLabel('First Name', { exact: true }) });
  await form.locator('select').filter({ has: page.getByRole('option', { name: 'CI Department (CI Institute)', exact: true }) }).selectOption({ label: 'CI Department (CI Institute)' });
  const downloadEvent = page.waitForEvent('download');
  const creation = page.waitForResponse(response => response.url().endsWith('/api/users') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Student', exact: true }).click();
  expect((await creation).status()).toBe(200);
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^CodeRank_Students_\d+\.pdf$/);
  expect(await download.failure()).toBeNull();
  const { readFile } = await import('node:fs/promises');
  const pdf = await readFile(await download.path(), 'latin1');
  expect(pdf.startsWith('%PDF')).toBe(true);
  expect(pdf.includes('Student Credentials')).toBe(true);
  expect(pdf.includes('Synthetic')).toBe(true);
  // AutoTable wraps narrow cells across PDF text operators. Check the displayed
  // text in order rather than requiring one unbroken binary substring.
  const text = [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map(match => match[1].replace(/\\([\\()])/g, '$1')).join('');
  expect(text.includes('25ce999@charusat.edu.in')).toBe(true);
  await expect(page.getByText('Synthetic created! Password PDF downloaded.', { exact: true })).toBeVisible();
  assertNoErrors();
});

test('faculty authoring validates, creates, edits, extends and deletes a practical over real HTTP', async ({ page, context }) => {
  const assertNoErrors = failOnPageErrors(page);
  const { headers } = await login(page, 'faculty');
  await page.getByRole('heading', { name: 'CI Course', exact: true }).click();
  await page.getByRole('button', { name: '+ Add Practical', exact: true }).click();
  const title = page.getByPlaceholder('e.g. Reverse an array', { exact: true });
  await page.getByRole('button', { name: 'Save Practical', exact: true }).click();
  expect(await title.evaluate(input => input.validity.valueMissing)).toBe(true);
  await title.fill('CI Authored Practical');
  await page.getByPlaceholder('Describe the coding challenge in detail (Supports HTML/Markdown)...', { exact: true }).fill('Return the supplied integer.');
  const form = page.locator('form').filter({ has: title });
  await form.locator('label').filter({ hasText: /^Input Format \*$/ }).locator('..').locator('textarea').fill('One integer');
  await form.locator('label').filter({ hasText: /^Output Format \*$/ }).locator('..').locator('textarea').fill('The same integer');
  await page.getByPlaceholder('Sample Input 1', { exact: true }).fill('1');
  await page.getByPlaceholder('Sample Output 1', { exact: true }).fill('1');
  await page.getByPlaceholder('Input arguments (e.g. 3 5) *', { exact: true }).fill('1');
  await page.getByPlaceholder('Expected result (e.g. 8) *', { exact: true }).fill('1');
  const createdResponse = page.waitForResponse(response => response.url().endsWith('/api/faculty/practicals') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save Practical', exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(200);
  const result = await created.json();
  const id = result.practical?.id ?? result.id;
  expect(Number(id)).toBeGreaterThan(0);
  const row = (name) => page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
  await expect(row('CI Authored Practical')).toBeVisible();
  await row('CI Authored Practical').getByRole('button', { name: /Edit/ }).click();
  await expect(title).toHaveValue('CI Authored Practical');
  await title.fill('CI Edited Practical');
  const update = page.waitForResponse(response => response.url().endsWith(`/api/faculty/practicals/${id}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save Practical', exact: true }).click();
  expect((await update).status()).toBe(200);
  await expect(row('CI Edited Practical')).toBeVisible();
  await row('CI Edited Practical').getByRole('button', { name: /\+ Time/ }).click();
  const extension = page.waitForResponse(response => response.url().endsWith(`/api/faculty/practicals/${id}/extra-time`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: '+10m', exact: true }).click();
  expect((await extension).status()).toBe(200);
  const detail = await getJson(context.request, `/api/faculty/practicals/${id}`, headers);
  expect(new Date(detail.end_time).getTime()).toBeGreaterThan(Date.now());
  page.once('dialog', dialog => dialog.accept());
  const deletion = page.waitForResponse(response => response.url().endsWith(`/api/faculty/practicals/${id}`) && response.request().method() === 'DELETE');
  await row('CI Edited Practical').getByRole('button', { name: /Delete/ }).click();
  expect((await deletion).status()).toBe(200);
  await expect(row('CI Edited Practical')).toHaveCount(0);
  assertNoErrors();
});
