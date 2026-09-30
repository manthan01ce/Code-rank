import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

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
    this.workdir = `/app/exec_${this.hash}`;
  }

  async compile() {
    const codeB64 = Buffer.from(this.code).toString('base64');
    
    try {
      await execAsync(`docker exec ${this.daemon} bash -c "test -d ${this.workdir}"`);
      return { success: true, cached: true };
    } catch {}

    const prepareCmd = `docker exec ${this.daemon} bash -c "mkdir -p ${this.workdir} && cd ${this.workdir} && echo '${codeB64}' | base64 -d > ${this.config.filename}"`;
    
    try {
      await execAsync(prepareCmd);
    } catch (err) {
      return { success: false, error: 'Daemon unreachable or failed to write file.' };
    }

    if (this.config.compileCmd) {
      const compileCmd = `docker exec ${this.daemon} bash -c "cd ${this.workdir} && ${this.config.compileCmd}"`;
      try {
        await execAsync(compileCmd, { timeout: 10000 });
      } catch (err) {
        await execAsync(`docker exec ${this.daemon} rm -rf ${this.workdir}`).catch(() => {});
        return { success: false, error: err.stderr || err.message || 'Compilation failed' };
      }
    }

    return { success: true, cached: false };
  }

  async runOneTestCase(input, expectedOutput, tcId, idx, marksAwardedMax = 0) {
    const inputFilename = `input_${idx}.txt`;
    const start = performance.now();
    try {
      const inputB64 = Buffer.from(input || '').toString('base64');
      const specificRunCmd = this.config.runCmd.replace('input.txt', inputFilename);
      
      const runCmd = `docker exec ${this.daemon} bash -c "cd ${this.workdir} && echo '${inputB64}' | base64 -d > ${inputFilename} && ${specificRunCmd}"`;
      
      const { stdout, stderr } = await execAsync(runCmd, { timeout: this.timeLimit, killSignal: 'SIGKILL' });
      
      const runtimeMs = performance.now() - start;
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
        errorMessage: (stderr || '').trim(),
        runtimeMs,
        expectedOutput: (expectedOutput || '').trim(),
        input: input
      };
    } catch (err) {
      const runtimeMs = performance.now() - start;
      let errMsg = err.stderr || err.message;
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
        expectedOutput: (expectedOutput || '').trim(),
        input: input
      };
    }
  }

  async runBatch(testCases) {
    if (testCases.length === 0) return [];

    const scriptLines = [`cd ${this.workdir}`];
    const testCaseMap = new Map();

    testCases.forEach((tc, idx) => {
      const inputFilename = `input_${idx}.txt`;
      const inputB64 = Buffer.from(tc.input || '').toString('base64');
      const runCmd = this.config.runCmd.replace('input.txt', inputFilename);
      
      scriptLines.push(`echo '${inputB64}' | base64 -d > ${inputFilename}`);
      scriptLines.push(`${runCmd} > output_${idx}.txt 2> error_${idx}.txt || echo "EXIT_CODE_NONZERO" > error_${idx}.txt`);
      
      testCaseMap.set(idx, tc);
    });

    const fullScript = scriptLines.join(' && ');
    const batchCmd = `docker exec ${this.daemon} bash -c "${fullScript}"`;

    try {
      await execAsync(batchCmd, { timeout: this.timeLimit * testCases.length });
    } catch (err) {}

    const results = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCaseMap.get(i);
      const inputFilename = `input_${i}.txt`;
      
      let stdout = '';
      let stderr = '';
      try {
        const outRes = await execAsync(`docker exec ${this.daemon} cat ${this.workdir}/output_${i}.txt`).catch(() => ({ stdout: '' }));
        const errRes = await execAsync(`docker exec ${this.daemon} cat ${this.workdir}/error_${i}.txt`).catch(() => ({ stdout: '' }));
        stdout = outRes.stdout;
        stderr = errRes.stdout;
      } catch (e) {}

      const actualNorm = normalizeOutput(stdout);
      const expectedNorm = normalizeOutput(tc.expected);
      const passed = actualNorm === expectedNorm;
      
      execAsync(`docker exec ${this.daemon} rm -f ${this.workdir}/${inputFilename} ${this.workdir}/output_${i}.txt ${this.workdir}/error_${i}.txt`).catch(() => {});

      results.push({
        testCaseId: tc.id,
        idx: i,
        passed,
        marksAwarded: passed ? parseFloat(tc.marks || 0) : 0,
        actualOutput: stdout.trim(),
        errorMessage: stderr.trim(),
        runtimeMs: 0,
        expectedOutput: (tc.expected || '').trim(),
        input: tc.input
      });
    }

    return results;
  }
}
