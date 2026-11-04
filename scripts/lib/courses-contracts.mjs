import assert from 'node:assert/strict';

export async function verifyCoursesContracts({ base, apiBase, adminToken, studentToken, facultyToken }) {
  const call = (origin, path, { method = 'GET', token, body, raw } = {}) =>
    fetch(`${origin}/api/${path}`, {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}),
    });

  // Verify across both direct API origin and public gateway
  for (const origin of [apiBase, base]) {
    // 1. Unauthenticated rejection
    const unauth = await call(origin, 'courses');
    assert.equal(unauth.status, 401);

    // 2. Role enforcement
    const studentCreate = await call(origin, 'courses', {
      method: 'POST',
      token: studentToken,
      body: { name: 'Unauthorized Course', course_code: 'UNAUTH1', semester: 1 },
    });
    assert.equal(studentCreate.status, 401);

    const facultyDept = await call(origin, 'departments', {
      method: 'POST',
      token: facultyToken,
      body: { name: 'Unauthorized Dept', institute_name: 'Inst' },
    });
    assert.equal(facultyDept.status, 401);

    const studentMapping = await call(origin, 'mapping', {
      method: 'POST',
      token: studentToken,
      body: { course_id: 1, faculty_ids: [1] },
    });
    assert.equal(studentMapping.status, 401);

    // 3. Malformed payload
    const malformed = await call(origin, 'courses', {
      method: 'POST',
      token: adminToken,
      raw: '{',
    });
    assert.equal(malformed.status, 400);

    // 4. Method not allowed and OPTIONS
    const patchRes = await call(origin, 'courses', { method: 'PATCH', token: adminToken });
    assert.equal(patchRes.status, 405);

    const optionsRes = await call(origin, 'courses', { method: 'OPTIONS' });
    assert.equal(optionsRes.status, 204);
    assert.ok(optionsRes.headers.get('allow')?.includes('GET'));
  }

  // 5. Admin course lifecycle
  const createCourseRes = await call(apiBase, 'courses', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Contracts Course', course_code: 'CC101', semester: 1 },
  });
  assert.equal(createCourseRes.status, 200);
  const createdCourse = await createCourseRes.json();
  assert.equal(createdCourse.course_code, 'CC101');
  const courseId = createdCourse.id;

  // Duplicate course code
  const dupCourseRes = await call(base, 'courses', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Contracts Course Dup', course_code: 'CC101', semester: 1 },
  });
  assert.equal(dupCourseRes.status, 409);

  // Read courses with headers
  const listCoursesRes = await call(base, 'courses', { token: studentToken });
  assert.equal(listCoursesRes.status, 200);
  assert.equal(listCoursesRes.headers.get('cache-control'), 'no-store');
  const courses = await listCoursesRes.json();
  assert.ok(courses.some(c => c.id === courseId));

  // Update course
  const updateCourseRes = await call(base, `courses/${courseId}`, {
    method: 'PUT',
    token: adminToken,
    body: { name: 'Contracts Course Updated', course_code: 'CC101', semester: 1 },
  });
  assert.equal(updateCourseRes.status, 200);
  const updatedCourse = await updateCourseRes.json();
  assert.equal(updatedCourse.success, true);
  assert.equal(updatedCourse.course.name, 'Contracts Course Updated');

  // 6. Admin department lifecycle
  const createDeptRes = await call(base, 'departments', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Contracts Department', institute_name: 'Contracts Institute' },
  });
  assert.equal(createDeptRes.status, 200);
  const createdDept = await createDeptRes.json();
  assert.equal(createdDept.name, 'Contracts Department');
  const deptId = createdDept.id;

  // List departments
  const listDeptsRes = await call(apiBase, 'departments', { token: adminToken });
  assert.equal(listDeptsRes.status, 200);
  assert.equal(listDeptsRes.headers.get('cache-control'), 'no-store');
  const depts = await listDeptsRes.json();
  assert.ok(depts.some(d => d.id === deptId));

  // Update department
  const updateDeptRes = await call(apiBase, `departments/${deptId}`, {
    method: 'PUT',
    token: adminToken,
    body: { name: 'Contracts Dept Renamed', institute_name: 'Contracts Institute' },
  });
  assert.equal(updateDeptRes.status, 200);

  // 7. Mapping lifecycle
  const mappingListRes = await call(base, 'mapping', { token: adminToken });
  assert.equal(mappingListRes.status, 200);

  const assignMappingRes = await call(apiBase, 'mapping', {
    method: 'POST',
    token: adminToken,
    body: { course_id: courseId, faculty_ids: [] },
  });
  assert.equal(assignMappingRes.status, 200);
  assert.deepEqual(await assignMappingRes.json(), { success: true });

  // 8. Deletions
  const deleteCourseRes = await call(apiBase, `courses/${courseId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(deleteCourseRes.status, 200);
  assert.deepEqual(await deleteCourseRes.json(), { success: true });

  const deleteDeptRes = await call(base, `departments/${deptId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(deleteDeptRes.status, 200);
  assert.deepEqual(await deleteDeptRes.json(), { success: true });

  console.log('Courses, departments, and mapping HTTP contracts passed: direct API, production gateway, roles, CRUD, and validations');
}
