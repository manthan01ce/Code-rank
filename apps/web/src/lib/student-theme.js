export const STUDENT_THEME_KEY = 'coderank.student.theme';
export function readStudentTheme(storage) {
  try {
    const saved = storage.getItem(STUDENT_THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return storage.getItem('pref_theme') === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
}
export function saveStudentTheme(storage, theme) {
  if (theme !== 'light' && theme !== 'dark') return false;
  try {
    storage.setItem(STUDENT_THEME_KEY, theme);
    storage.setItem('pref_theme', theme === 'light' ? 'light' : 'vs-dark');
    return true;
  } catch { return false; }
}
