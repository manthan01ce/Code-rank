export const PROGRESS_EVENT = 'coderank:progress';
export const PROGRESS_KEY = 'coderank.progress.updated';
export function notifyProgressChanged() {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
  try { localStorage.setItem(PROGRESS_KEY, `${Date.now()}:${Math.random()}`); } catch { /* Current tab still refreshes. */ }
}
export function profilePracticals(submissions = []) {
  const grouped = new Map();
  for (const submission of submissions) {
    const previous = grouped.get(submission.practical_id);
    const accepted = submission.status === 'Accepted';
    if (previous && (previous.status === 'done' && !accepted || Number(previous.marks ?? -1) >= Number(submission.normalized_marks ?? -1) && previous.status === (accepted ? 'done' : 'not_started'))) continue;
    grouped.set(submission.practical_id, { id: submission.practical_id, name: submission.practical_title,
      course: submission.course_name, course_code: submission.course_code,
      status: accepted || previous?.status === 'done' ? 'done' : 'not_started', marks: submission.normalized_marks, dueDate: submission.submitted_at || null });
  }
  return [...grouped.values()];
}
