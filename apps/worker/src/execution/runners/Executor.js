import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const RESOURCE_MARKER = '__CODERANK_RESOURCE__';

const DAEMONS = {
  cpp: 'coderank-cpp-daemon',
  c: 'coderank-c-daemon',
  java: 'coderank-java-daemon',
  python: 'coderank-python-daemon',
  javascript: 'coderank-javascript-daemon'
};

const LANGUAGES = {
  cpp: {
    compileCmd: 'g++ -O2 solution.cpp -o solution 2> compile_err.txt || (cat compile_err.txt >&2 && exit 1)',
    runCmd: './solution < input.txt',
    filename: 'solution.cpp'
  },
  c: {
    compileCmd: 'gcc -O2 solution.c -o solution 2> compile_err.txt || (cat compile_err.txt >&2 && exit 1)',
    runCmd: './solution < input.txt',
    filename: 'solution.c'
  },
  java: {
    compileCmd: 'javac Solution.java 2> compile_err.txt || (cat compile_err.txt >&2 && exit 1)',
    runCmd: 'java Solution < input.txt',
    filename: 'Solution.java'
  },
  python: {
    compileCmd: null,
    runCmd: 'python solution.py < input.txt',
    filename: 'solution.py'
  },
  javascript: {
    compileCmd: null,
    runCmd: 'node solution.js < input.txt',
    filename: 'solution.js'
  }
};

function normalizeOutput(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function extractResourceMetrics(stderr = '') {
  const match = String(stderr).match(new RegExp(`${RESOURCE_MARKER}:(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?):(\\d+)`));
  if (!match) return { stderr: String(stderr), cpuTimeMs: null, memoryBytes: null };

  const cpuTimeMs = Math.round((Number(match[1]) + Number(match[2])) * 1000);
  const memoryBytes = Number(match[3]) * 1024; // GNU time reports max RSS in KiB on Linux.
  return {
    stderr: String(stderr).replace(match[0], '').trim(),
    cpuTimeMs,
    memoryBytes
  };
}

export class Executor {
  constructor(language, code, customTimeLimit = 3000, userId = null) {
    this.language = language;
    this.code = code;
    this.timeLimit = customTimeLimit;

    if (this.language === 'java' && !this.code.includes('public class Solution') && !this.code.includes('class Solution')) {
      this.code = `public class Solution {\n${this.code}\n}`;
    }

    this.config = LANGUAGES[language] || LANGUAGES.python;
    this.daemon = DAEMONS[language] || DAEMONS.python;

    this.hash = crypto.createHash('sha256').update(`${this.language}:${this.code}`).digest('hex');
    this.executionId = crypto.randomUUID();
    // Each execution gets a private workdir — never shared between concurrent
    // same-source submissions.
    this.workdir = `/app/exec_${this.executionId}`;
  }

  /**
   * Executes an interpreted playground program in one Docker invocation.
   *
   * The old path did a directory probe, a source write, and a program run as
   * three separate `docker exec` processes.  That process startup overhead was
   * the dominant cost for short Python/JavaScript programs.  Playground code
   * does not need the persistent compilation cache, so keep all of its files
   * in a private temporary directory and clean it up in the same invocation.
   */
  async runPlayground(input = '') {
    if (this.config.compileCmd) return null;

    const workdir = `/tmp/coderank-${this.executionId}`;
    const codeB64 = Buffer.from(this.code).toString('base64');
    const inputB64 = Buffer.from(input || '').toString('base64');
    const timeoutSeconds = Math.max(1, Math.ceil(this.timeLimit / 1000));
    const script = [
      'set -u',
      `workdir='${workdir}'`,
      'cleanup() { rm -rf "$workdir"; }',
      'trap cleanup EXIT',
      'mkdir -p "$workdir"',
      `printf '%s' '${codeB64}' | base64 -d > "$workdir/${this.config.filename}"`,
      `printf '%s' '${inputB64}' | base64 -d > "$workdir/input.txt"`,
      'cd "$workdir"',
      `timeout ${timeoutSeconds}s /usr/bin/time -f '${RESOURCE_MARKER}:%U:%S:%M' ${this.config.runCmd}`
    ].join('; ');

    const start = performance.now();
    try {
      const { stdout, stderr } = await execFileAsync(
        'docker',
        ['exec', this.daemon, 'bash', '-lc', script],
        { timeout: this.timeLimit + 2000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }
      );
      const resources = extractResourceMetrics(stderr);
      return { stdout: stdout || '', ...resources, runtimeMs: performance.now() - start };
    } catch (err) {
      const timedOut = err.code === 124 || err.killed;
      const resources = extractResourceMetrics(err.stderr);
      return {
        stdout: err.stdout || '',
        ...resources,
        stderr: timedOut ? 'Time Limit Exceeded' : (resources.stderr || err.message || 'Execution failed'),
        runtimeMs: performance.now() - start
      };
    }
  }

  async compile() {
    const codeB64 = Buffer.from(this.code).toString('base64');

    const prepareCmd = `docker exec ${this.daemon} bash -c "mkdir -p ${this.workdir} && cd ${this.workdir} && printf '%s' '${codeB64}' | base64 -d > ${this.config.filename}"`;

    try {
      await execAsync(prepareCmd, { timeout: 10000 });
    } catch (err) {
      return { success: false, error: 'Daemon unreachable or failed to write file.' };
    }

    if (this.config.compileCmd) {
      const compileCmd = `docker exec ${this.daemon} bash -c "cd ${this.workdir} && ${this.config.compileCmd}"`;
      try {
        await execAsync(compileCmd, { timeout: 15000 });
      } catch (err) {
        // Always clean up on compile failure so the workdir doesn't linger.
        await execAsync(`docker exec ${this.daemon} rm -rf ${this.workdir}`).catch(() => {});
        return { success: false, error: err.stderr || err.message || 'Compilation failed' };
      }
    }

    return { success: true, cached: false };
  }

  async runOneTestCase(input, expectedOutput, tcId, idx, marksAwardedMax = 0) {
    const inputFilename = `input_${this.executionId}_${idx}.txt`;
    const start = performance.now();
    try {
      const inputB64 = Buffer.from(input || '').toString('base64');
      const specificRunCmd = this.config.runCmd.replace('input.txt', inputFilename);
      
      const runCmd = `docker exec ${this.daemon} bash -c "cd ${this.workdir} && echo '${inputB64}' | base64 -d > ${inputFilename} && /usr/bin/time -f '${RESOURCE_MARKER}:%U:%S:%M' ${specificRunCmd}"`;
      
      const { stdout, stderr } = await execAsync(runCmd, { timeout: this.timeLimit, killSignal: 'SIGKILL' });
      
      const runtimeMs = performance.now() - start;
      const resources = extractResourceMetrics(stderr);
      const actualNorm = normalizeOutput(stdout);
      const expectedNorm = normalizeOutput(expectedOutput);
      const passed = actualNorm === expectedNorm;
      const marksAwarded = passed ? parseFloat(marksAwardedMax) : 0;
      
      execAsync(`docker exec ${this.daemon} rm -f ${this.workdir}/${inputFilename}`).catch(() => {});

      return {
        testCaseId: tcId,
        idx,
        passed,
        marksAwarded,
        actualOutput: (stdout || '').trim(),
        errorMessage: resources.stderr,
        runtimeMs,
        cpuTimeMs: resources.cpuTimeMs,
        memoryBytes: resources.memoryBytes,
        expectedOutput: (expectedOutput || '').trim(),
        input: input
      };
    } catch (err) {
      const runtimeMs = performance.now() - start;
      const resources = extractResourceMetrics(err.stderr);
      let errMsg = resources.stderr || err.message;
      if (err.killed) errMsg = 'Time Limit Exceeded';
      
      execAsync(`docker exec ${this.daemon} rm -f ${this.workdir}/${inputFilename}`).catch(() => {});

      return {
        testCaseId: tcId,
        idx,
        passed: false,
        marksAwarded: 0,
        actualOutput: (err.stdout || '').trim(),
        errorMessage: (errMsg || '').trim(),
        runtimeMs,
        cpuTimeMs: resources.cpuTimeMs,
        memoryBytes: resources.memoryBytes,
        expectedOutput: (expectedOutput || '').trim(),
        input: input
      };
    }
  }

  async runBatch(testCases) {
    if (testCases.length === 0) return [];

    // One Docker process for execution and framed result collection. Base64 keeps
    // arbitrary program output from corrupting the tab-delimited protocol.
    const scriptLines = [`cd ${this.workdir} || exit 1`, 'ulimit -f 2048'];
    testCases.forEach((tc, idx) => {
      const inputB64 = Buffer.from(tc.input || '').toString('base64');
      const limitMs = Number(tc.time_limit) > 0 ? Number(tc.time_limit) * 1000 : this.timeLimit;
      const seconds = Math.max(0.001, limitMs / 1000);
      scriptLines.push(
        `printf '%s' '${inputB64}' | base64 -d > input.txt`,
        'start=$(date +%s%N)',
        `timeout -k 1s ${seconds}s /usr/bin/time -f '${RESOURCE_MARKER}:%U:%S:%M' ${this.config.runCmd} > output.txt 2> error.txt`,
        'rc=$?',
        'elapsed=$(( ($(date +%s%N) - start) / 1000000 ))',
        `printf '${idx}\\t%s\\t%s\\t' "$rc" "$elapsed"`,
        "base64 -w0 output.txt",
        "printf '\\t'",
        'base64 -w0 error.txt',
        "printf '\\n'"
      );
    });
    const budget = testCases.reduce((sum, tc) => sum +
      (Number(tc.time_limit) > 0 ? Number(tc.time_limit) * 1000 : this.timeLimit) + 1000, 5000);
    const { stdout } = await execFileAsync('docker',
      ['exec', this.daemon, 'bash', '-c', scriptLines.join('\n')],
      { timeout: budget, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 });
    const lines = stdout.replace(/\n$/, '').split('\n');
    if (lines.length !== testCases.length) throw new Error('Incomplete execution batch');
    const results = lines.map((line, idx) => {
      const fields = line.split('\t');
      if (fields.length !== 5 || Number(fields[0]) !== idx) throw new Error('Invalid execution batch');
      const [, exitCode, elapsed, out, err] = fields;
      const tc = testCases[idx];
      const actual = Buffer.from(out, 'base64').toString();
      const resources = extractResourceMetrics(Buffer.from(err, 'base64').toString());
      const passed = Number(exitCode) === 0 && normalizeOutput(actual) === normalizeOutput(tc.expected);
      return {
        testCaseId: tc.id, idx, passed,
        marksAwarded: passed ? parseFloat(tc.marks || 0) : 0,
        actualOutput: actual.trim(),
        errorMessage: ['124', '137'].includes(exitCode) ? 'Time Limit Exceeded' : resources.stderr,
        runtimeMs: Number(elapsed), cpuTimeMs: resources.cpuTimeMs,
        memoryBytes: resources.memoryBytes,
        expectedOutput: String(tc.expected ?? '').trim(), input: tc.input
      };
    });
    return results;
  }

  /**
   * Remove the private workdir from the daemon container.
   * Called after every execution (pass or fail) to prevent artifact accumulation.
   */
  async cleanup() {
    if (!this.workdir) return;
    await execAsync(
      `docker exec ${this.daemon} rm -rf ${this.workdir}`
    ).catch(() => {});
  }
}
