import { test, expect } from '@playwright/test';

const courses = [1, 2].map(id => ({ id, name: `Course ${id}`, course_code: `C${id}`, semester: 1, is_co_coordinator: true }));
const practical = id => ({ id, course_id: id, title: `Practical ${id}`, is_active: true, allowed_languages: ['python'], submissions_count: 1 });
const student = name => ({ id: 1, student_id: 1, practical_id: 1, student_name: name, name, roll_number: 'R1', department: 'CE', division: 'A', normalized_marks: 8, raw_marks: 8, language: 'python', status: 'Accepted', submitted_at: '2026-11-01T12:00:00Z' });
const marks = name => ({ students: [student(name)], practicals: [practical(1)], submissions: [student(name)], departments: [{ department: 'CE', count: 1 }], pagination: { studentCursor: 'next-student', practicalCursor: 'next-practical' } });
async function setup(page, tab = 'submissions', coordinator = true) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic');
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'faculty', name: 'Fixture' }));
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === '/api/faculty/courses') data = courses.map(c => ({ ...c, is_co_coordinator: coordinator }));
    else if (url.pathname === '/api/faculty/batches') data = ['2024'];
    else if (url.pathname === '/api/faculty/practicals') data = [practical(Number(url.searchParams.get('course_id')))];
    else if (url.pathname.endsWith('/submissions')) data = [student('First Student')];
    else if (/\/courses\/\d+\/stats$/.test(url.pathname)) data = marks('First Student');
    else if (/\/submissions\/\d+$/.test(url.pathname)) data = { ...student('First Student'), code: 'print(42)', cases: [] };
    await route.fulfill({ json: data, headers: { 'X-Next-Cursor': 'next-page' } });
  });
  await page.goto(`/faculty?course=1&tab=${tab}`);
  return () => expect(errors).toEqual([]);
}

test('submission filtering, sorting, cursor paging and denied reset preserve state', async ({ page }) => {
  const check = await setup(page);
  await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
  const next = page.waitForRequest(r => new URL(r.url()).searchParams.get('cursor') === 'next-page');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await next;
  await expect(page.getByRole('button', { name: 'First page', exact: true })).toBeEnabled();
  const filtered = page.waitForRequest(r => new URL(r.url()).searchParams.get('studentSearch') === 'needle');
  await page.getByPlaceholder('Search Student, Roll No, Division...').fill('needle');
  expect(new URL((await filtered).url()).searchParams.has('cursor')).toBe(false);
  await page.locator('select').filter({ has: page.locator('option[value="late"]') }).selectOption('late');
  const sorted = page.waitForRequest(r => new URL(r.url()).searchParams.get('sortBy') === 'marks');
  await page.locator('select').filter({ has: page.locator('option[value="marks"]') }).selectOption('marks');
  expect(new URL((await sorted).url()).searchParams.get('status')).toBe('late');
  await page.route('**/api/faculty/submissions/1', route => route.fulfill({ status: 403, json: { error: 'Forbidden reset' } }));
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Forbidden reset', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
  check();
});

test('late detail response cannot reopen a dialog after switching course', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('button', { name: 'View Details', exact: true })).toBeVisible();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/faculty/submissions/1', async route => {
    await gate;
    await route.fulfill({ json: { ...student('OLD DETAIL'), code: 'print(42)', cases: [] } }).catch(() => {});
  });
  const requested = page.waitForRequest('**/api/faculty/submissions/1');
  await page.getByRole('button', { name: 'View Details', exact: true }).click();
  await requested;
  await page.evaluate(() => window.history.pushState(null, '', '/faculty?course=2&tab=submissions'));
  await expect(page.getByRole('heading', { name: 'Course 2', exact: true })).toBeVisible();
  release();
  await expect(page.getByText('Submission Details - OLD DETAIL', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
});

test('marks pagination, failure, course switching and theme render', async ({ page }) => {
  const check = await setup(page, 'marks');
  await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
  const next = page.waitForRequest(r => new URL(r.url()).searchParams.get('studentCursor') === 'next-student');
  await page.getByRole('button', { name: 'Next students', exact: true }).click();
  await next;
  await expect(page.getByRole('button', { name: 'First student page' })).toBeEnabled();
  await page.route('**/api/faculty/courses/1/stats?*', route => route.fulfill({ status: 500, json: { error: 'Report failed' } }));
  await page.getByRole('button', { name: 'Next practicals', exact: true }).click();
  await expect(page.getByText('Report failed', { exact: true })).toBeVisible();
  await page.goto('/faculty?course=2&tab=marks');
  await expect(page.getByRole('heading', { name: 'Course 2', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByRole('heading', { name: 'Grades Matrix (Pivot View)' })).toBeVisible();
  check();
});

test('view-only faculty cannot see reset actions and successful reset refreshes rows', async ({ page }) => {
  await setup(page, 'submissions', false);
  await expect(page.getByRole('button', { name: 'View Details', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' });
  await setup(page);
  let deleted = false;
  await page.route('**/api/faculty/submissions/1', async route => {
    deleted = true;
    await route.fulfill({ json: { message: 'deleted' } });
  });
  await page.route('**/api/faculty/practicals/1/submissions?*', route => route.fulfill({ json: deleted ? [] : [student('First Student')] }));
  page.on('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Submission deleted successfully.', { exact: true })).toBeVisible();
  await expect(page.getByText('No student submissions found.', { exact: true })).toBeVisible();
});

for (const tab of ['submissions', 'marks']) {
  test(`${tab}: delayed response cannot restore a deselected course`, async ({ page }) => {
    await setup(page, tab);
    await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
    let release, finished;
    const gate = new Promise(resolve => { release = resolve; });
    const done = new Promise(resolve => { finished = resolve; });
    const path = tab === 'submissions' ? '**/api/faculty/practicals/1/submissions?*' : '**/api/faculty/courses/1/stats?*';
    await page.route(path, async route => {
      await gate;
      await route.fulfill({ json: tab === 'submissions' ? [student('STALE STUDENT')] : marks('STALE STUDENT') }).catch(() => {});
      finished();
    });
    const requested = page.waitForRequest(r => r.url().includes(tab === 'submissions' ? 'studentSearch=delayed' : 'studentCursor=next-student'));
    if (tab === 'submissions') await page.getByPlaceholder('Search Student, Roll No, Division...').fill('delayed');
    else await page.getByRole('button', { name: 'Next students', exact: true }).click();
    await requested;
    await page.getByRole('button', { name: /Switch Subject/ }).click();
    await expect(page.getByRole('heading', { name: 'Select Allocated Subject', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /C2/ }).click();
    await expect(page.getByRole('heading', { name: 'Course 2', exact: true })).toBeVisible();
    release();
    await done;
    await expect(page.getByRole('cell', { name: 'First Student', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'STALE STUDENT', exact: true })).toHaveCount(0);
  });
}
