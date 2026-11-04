export const courses = [1, 2].map(id => ({ id, name: `Course ${id}`, course_code: `C${id}`, semester: 1, is_co_coordinator: true }));
export const practical = id => ({ id, course_id: id, title: `Practical ${id}`, is_active: true, allowed_languages: ['python'], submissions_count: 1 });
export const student = name => ({ id: 1, student_id: 1, practical_id: 1, student_name: name, name, roll_number: 'R1', department: 'CE', division: 'A', normalized_marks: 8, raw_marks: 8, language: 'python', status: 'Accepted', submitted_at: '2026-11-01T12:00:00Z' });
export const marks = name => ({ students: [student(name)], practicals: [practical(1)], submissions: [student(name)], departments: [{ department: 'CE', count: 1 }], pagination: { studentCursor: 'next-student', practicalCursor: 'next-practical' } });

// Only the submission table is cursor-paged in these synthetic fixtures. Small
// selector collections are complete; advertising a cursor repeats their page.
export function facultyReviewResponse(url, coordinator = true) {
  let data = [];
  if (url.pathname === '/api/faculty/courses') data = courses.map(c => ({ ...c, is_co_coordinator: coordinator }));
  else if (url.pathname === '/api/faculty/batches') data = ['2024'];
  else if (url.pathname === '/api/faculty/practicals') data = [practical(Number(url.searchParams.get('course_id')))];
  else if (url.pathname.endsWith('/submissions')) data = [student('First Student')];
  else if (/\/courses\/\d+\/stats$/.test(url.pathname)) data = marks('First Student');
  else if (/\/submissions\/\d+$/.test(url.pathname)) data = { ...student('First Student'), code: 'print(42)', cases: [] };
  return {
    json: data,
    headers: url.pathname.endsWith('/submissions') ? { 'X-Next-Cursor': 'next-page' } : {},
  };
}
