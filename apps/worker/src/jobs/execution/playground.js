import { Executor } from '@coderank/runner';
import { ALLOWED_LANGUAGES } from '@coderank/runner/languages';

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
  try {
    const playgroundResult = await executor.runPlayground(input);

    if (playgroundResult) {
      return {
        success: playgroundResult.exitCode === 0,
        stdout: playgroundResult.stdout.trim(),
        stderr: playgroundResult.stderr.trim(),
        exitCode: playgroundResult.exitCode,
        runtimeMs: playgroundResult.runtimeMs,
        cpuTimeMs: playgroundResult.cpuTimeMs,
        memoryBytes: playgroundResult.memoryBytes
      };
    }

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
      success: res.exitCode === 0,
      stdout: res.actualOutput,
      stderr: res.errorMessage,
      exitCode: res.exitCode
    };
  } finally { await executor.cleanup(); }
}
