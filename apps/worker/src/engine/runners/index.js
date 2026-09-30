import { Executor } from './Executor.js';
import { runPython } from './python.js';
import { runCpp } from './cpp.js';
import { runJava } from './java.js';
import { runC } from './c.js';
import { runJavaScript } from './javascript.js';
import { runDynamicPractical } from './dynamic.js';

export const ALLOWED_LANGUAGES = new Set(['python', 'cpp', 'c', 'java', 'javascript']);

export async function executeCode(language, code, input = '') {
  if (!ALLOWED_LANGUAGES.has(language)) {
    return {
      success: false,
      stdout: '',
      stderr: `Unsupported language: "${language}". Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}`,
      exitCode: 400,
    };
  }

  const executor = new Executor(language, code);
  const compileRes = await executor.compile();

  if (!compileRes.success) {
    return {
      success: false,
      stdout: '',
      stderr: compileRes.error,
      exitCode: 1
    };
  }

  const res = await executor.runOneTestCase(input, '', 'playground', 0);

  return {
    success: !res.errorMessage,
    stdout: res.actualOutput,
    stderr: res.errorMessage,
    exitCode: res.errorMessage ? 1 : 0
  };
}

export {
  runPython,
  runCpp,
  runJava,
  runC,
  runJavaScript,
  runDynamicPractical
};
