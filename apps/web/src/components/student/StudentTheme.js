'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';
import { readStudentTheme, saveStudentTheme, STUDENT_THEME_KEY } from '@/lib/student-theme';

const ThemeContext = createContext(null);
const eventName = 'coderank-student-theme';
function subscribe(callback) {
  const onStorage = event => { if (event.key === STUDENT_THEME_KEY || event.key === 'pref_theme' || event.key === null) { sessionTheme = null; callback(); } };
  window.addEventListener('storage', onStorage);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(eventName, callback); };
}
let sessionTheme = null;
function readTheme() {
  if (sessionTheme) return sessionTheme;
  try { return readStudentTheme(localStorage); } catch { return 'dark'; }
}
export function StudentThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark');
  const setTheme = next => {
    if (!['light', 'dark'].includes(next)) return;
    sessionTheme = next;
    try { saveStudentTheme(localStorage, next); } catch { /* Keep the toggle usable if browser storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName));
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}><div className="student-theme" data-student-theme={theme}>{children}</div></ThemeContext.Provider>;
}
export function useStudentTheme() { return useContext(ThemeContext); }
export function StudentThemeToggle() {
  const context = useStudentTheme();
  if (!context) return null;
  return <button type="button" className="student-theme-toggle" aria-label="Light theme" aria-pressed={context.theme === 'light'} onClick={() => context.setTheme(context.theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{context.theme === 'dark' ? '☀' : '☾'}</span><span>{context.theme === 'dark' ? 'Light theme' : 'Dark theme'}</span></button>;
}
