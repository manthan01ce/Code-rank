import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudentTheme, saveStudentTheme, STUDENT_THEME_KEY } from '../apps/web/src/lib/student-theme.js';
const storage = (entries = []) => {
  const values = new Map(entries);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
test('student theme preserves dark as default and honors existing light editor preference', () => {
  assert.equal(readStudentTheme(storage()), 'dark');
  assert.equal(readStudentTheme(storage([['pref_theme', 'light']])), 'light');
  assert.equal(readStudentTheme(storage([['pref_theme', 'hc-black']])), 'dark');
  assert.equal(readStudentTheme(storage([[STUDENT_THEME_KEY, 'invalid']])), 'dark');
  assert.equal(readStudentTheme(storage([[STUDENT_THEME_KEY, 'dark'], ['pref_theme', 'light']])), 'dark');
});
test('both theme choices persist for navigation and synchronize the editor setting', () => {
  const saved = storage();
  assert.equal(saveStudentTheme(saved, 'light'), true);
  assert.equal(readStudentTheme(saved), 'light');
  assert.equal(saved.getItem('pref_theme'), 'light');
  assert.equal(saveStudentTheme(saved, 'dark'), true);
  assert.equal(readStudentTheme(saved), 'dark');
  assert.equal(saved.getItem('pref_theme'), 'vs-dark');
  assert.equal(saveStudentTheme(saved, 'invalid'), false);
  assert.equal(readStudentTheme(saved), 'dark');
});
test('blocked browser storage fails safely', () => {
  const blocked = { getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); } };
  assert.equal(readStudentTheme(blocked), 'dark');
  assert.equal(saveStudentTheme(blocked, 'light'), false);
});

test('workspace dark palette retains original fallbacks and every token has a light counterpart', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const css = await readFile(new URL('../apps/web/src/app/student/student-theme.css', import.meta.url), 'utf8');
  const darkBlock = css.match(/data-student-theme="dark"\]\s*\{([^}]+)\}/)[1];
  const lightBlock = css.match(/data-student-theme="light"\]\s*\{([^}]+)\}/)[1];
  const entries = block => new Map([...block.matchAll(/(--student-[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
  const dark = entries(darkBlock), light = entries(lightBlock);
  const normalize = value => {
    if (value === 'white') return '#ffffff';
    if (value === 'black') return '#000000';
    return /^#[a-f0-9]{3}$/i.test(value) ? '#' + [...value.slice(1)].map(c => c+c).join('') : value.toLowerCase();
  };
  const directory = new URL('../apps/web/src/components/compiler/', import.meta.url);
  let checked = 0;
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(file, directory), 'utf8');
    for (const [, token, fallback] of source.matchAll(/var\((--student-code-[\w-]+),\s*(#[a-f0-9]+|white|black)\)/gi)) {
      assert.equal(normalize(dark.get(token)), normalize(fallback), token);
      assert.ok(light.has(token), `Missing light color: ${token}`);
      checked++;
    }
  }
  assert.ok(checked > 100, 'Expected coverage of the workspace palette');
});
