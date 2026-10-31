import { dockerCommand } from './docker.js';
import { Sandbox } from './Sandbox.js';
export { dockerCommand } from './docker.js';
import crypto from 'node:crypto';

export const MAX_EXECUTION_MS = 5000;
export function executionBudget(value = MAX_EXECUTION_MS) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_EXECUTION_MS) : MAX_EXECUTION_MS;
}

const RESOURCE_MARKER = '__CODERANK_RESOURCE__';
const LANGUAGES = {
  cpp: { compile: 'g++ -O2 solution.cpp -o solution', run: './solution', filename: 'solution.cpp' },
  c: { compile: 'gcc -O2 solution.c -o solution', run: './solution', filename: 'solution.c' },
  java: { compile: 'javac Solution.java', run: 'java Solution', filename: 'Solution.java' },
  python: { run: 'python solution.py', filename: 'solution.py' },
  javascript: { run: 'node solution.js', filename: 'solution.js' },
};

const b64 = value => Buffer.from(String(value ?? '')).toString('base64');
const normalize = value => String(value ?? '').replace(/\r\n/g, '\n').split('\n').map(x => x.trimEnd()).join('\n').trim();
function resources(stderr = '') {
  const match = stderr.match(new RegExp(`${RESOURCE_MARKER}:(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?):(\\d+)`));
  return { stderr: match ? stderr.replace(match[0], '').trim() : stderr.trim(), cpuTimeMs: match ? Math.round((Number(match[1]) + Number(match[2])) * 1000) : null, memoryBytes: match ? Number(match[3]) * 1024 : null };
}

export class Executor {
  constructor(language, code, timeLimit = MAX_EXECUTION_MS, userId = null, { runDocker = dockerCommand } = {}) {
    if (!LANGUAGES[language]) throw new Error('Unsupported language');
    this.config = LANGUAGES[language];
    this.sandbox = new Sandbox(runDocker, { language });
    this.code = language === 'java' && !code.includes('class Solution') ? `public class Solution {\n${code}\n}` : code;
    this.timeLimit = executionBudget(timeLimit);
    this.executionId = crypto.randomUUID();
    // Never treat directory existence as a compiled-artifact cache hit.
    this.workdir = `/app/exec_${this.executionId}`;
    this.runDocker = runDocker;
    this.deadline = this.sandbox.deadline;
  }
  async script(script, budget = this.timeLimit) {
    const remaining = Math.min(budget, this.deadline - Date.now());
    if (remaining <= 0) throw Object.assign(new Error('Job deadline exceeded'), { code: 124 });
    return this.sandbox.script(script, remaining);
  }
  async compile() {
    try {
      await this.script(`set -e\nmkdir -p '${this.workdir}'\ncd '${this.workdir}'\nprintf '%s' '${b64(this.code)}' | base64 -d > ${this.config.filename}\n${this.config.compile || 'true'}\n`, 10000);
      return { success: true, cached: false };
    } catch (error) { if (error.infrastructure) throw error; return { success: false, error: error.stderr || error.message || 'Compilation failed' }; }
  }
  async runPlayground(input = '') {
    if (this.config.compile) return null;
    try {
      const compiled = await this.compile();
      if (!compiled.success) return { stdout: '', stderr: compiled.error, exitCode: 1 };
      const result = await this.runOneTestCase(input, '', 'playground', 0);
      return { stdout: result.actualOutput, stderr: result.errorMessage, exitCode: result.exitCode, runtimeMs: result.runtimeMs, cpuTimeMs: result.cpuTimeMs, memoryBytes: result.memoryBytes };
    } finally { await this.cleanup(); }
  }
  async runOneTestCase(input, expectedOutput, tcId, idx, marks = 0, timeLimit = this.timeLimit) {
    const start = performance.now();
    let stdout = '', stderr = '', exitCode = 0;
    try {
      const result = await this.script(`set -e\ncd '${this.workdir}'\nprintf '%s' '${b64(input)}' | base64 -d > input.txt\n/usr/bin/time -f '${RESOURCE_MARKER}:%U:%S:%M' ${this.config.run} < input.txt\n`, Math.min(this.timeLimit, executionBudget(timeLimit)));
      stdout = result.stdout || ''; stderr = result.stderr || '';
    } catch (error) {
      if (error.infrastructure) throw error;
      stdout = error.stdout || ''; stderr = error.stderr || '';
      exitCode = typeof error.code === 'number' ? error.code : 1;
      if (error.killed || exitCode === 124 || exitCode === 137) { exitCode = 124; stderr = 'Time Limit Exceeded'; }
      else if (!stderr) stderr = error.message || `Process exited with code ${exitCode}`;
    }
    const metrics = resources(stderr);
    const passed = exitCode === 0 && normalize(stdout) === normalize(expectedOutput);
    return { testCaseId: tcId, idx, passed, marksAwarded: passed ? Number(marks) || 0 : 0, actualOutput: stdout.trim(), errorMessage: metrics.stderr, exitCode, runtimeMs: performance.now() - start, cpuTimeMs: metrics.cpuTimeMs, memoryBytes: metrics.memoryBytes, expectedOutput: String(expectedOutput ?? '').trim(), input };
  }
  async runBatch(testCases) {
    const results = [];
    for (const [idx, tc] of testCases.entries()) {
      if (typeof tc.input !== 'string' || (typeof tc.expected !== 'string' && typeof tc.expected !== 'number')) throw new Error('stdin/stdout test cases require input and expected output');
      const seconds = Number(tc.time_limit);
      const limit = Number.isFinite(seconds) && seconds > 0 ? executionBudget(seconds * 1000) : this.timeLimit;
      results.push(await this.runOneTestCase(tc.input, tc.expected, tc.id, idx, tc.marks, limit));
    }
    return results;
  }
  async cleanup() {
    try {
      if (this.workdir) {
        await this.sandbox.script(`rm -rf '${this.workdir}'`, 3000).catch(() => {});
      }
    } finally {
      await this.sandbox.destroy();
    }
  }
}
