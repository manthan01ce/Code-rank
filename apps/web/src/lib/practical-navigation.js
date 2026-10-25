export function practicalDestination(practical, courseCode = '') {
  if (!/^[1-9]\d*$/.test(String(practical?.id))) return null;
  const id = Number(practical.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return `/student/code/practical_${id}?subject=${encodeURIComponent(courseCode || '')}`;
}
export function practicalHasStarted(practical, now = Date.now()) {
  if (!practical?.start_time) return true;
  const start = Date.parse(practical.start_time);
  return Number.isFinite(start) && start <= now;
}

export function practicalBelongsToCourse(practical, course) {
  if (practical.course_id != null && course.id != null) return String(practical.course_id) === String(course.id);
  return Boolean(practical.course_code && course.course_code && practical.course_code === course.course_code);
}
