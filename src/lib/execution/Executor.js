import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);
// Force turbopack cache invalidation

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

export class Executor {
  constructor(language, code, customTimeLimit = 3000, userId = null) {
    this.language = language;
    this.code = code;
    this.timeLimit = customTimeLimit;

    if (this.language === 'java' && !this.code.includes('public class Solution') && !this.code.includes('class Solution')) {
      this.code = `public class Solution {\n${this.code}\n}`;
    }

    this.config = LANGUAGES[language];
    // If a userId is provided, use their dedicated VPS container. Otherwise, fallback to shared daemon.
    this.daemon = userId ? `coderank-student-${userId}` : DAEMONS[language];

    // Create a unique hash for caching the compiled binary
    this.hash = crypto.createHash('sha256').update(`${this.language}:${this.code}`).digest('hex');
    // Inside the student's container, we create a unique folder for this execution
    this.workdir = `/app/exec_${this.hash}`;
  }

  async compile() {
    // 1. Prepare directory and write code using base64 to completely bypass Windows volume mount bugs
    const codeB64 = Buffer.from(this.code).toString('base64');
    
    // We check if it already exists, if so, we can skip writing and compiling! (Caching!)
    try {
      await execAsync(`docker exec ${this.daemon} bash -c "test -d ${this.workdir}"`);
      // Directory exists, means it was already compiled and cached!
      return { success: true, cached: true };
    } catch {
      // Directory does not exist, proceed to write and compile
    }

    const prepareCmd = `docker exec ${this.daemon} bash -c "mkdir -p ${this.workdir} && cd ${this.workdir} && echo '${codeB64}' | base64 -d > ${this.config.filename}"`;
    
    try {
      await execAsync(prepareCmd);
    } catch (err) {
      return { success: false, error: 'Daemon unreachable or failed to write file.' };
    }

    // 2. Compile if the language requires it
    if (this.config.compileCmd) {
      const compileCmd = `docker exec ${this.daemon} bash -c "cd ${this.workdir} && ${this.config.compileCmd}"`;
      try {
        await execAsync(compileCmd, { timeout: 10000 });
      } catch (err) {
        // If compilation fails, we delete the workdir so it doesn't get cached as a success
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
      const actual = (stdout || '').trim();
      const expected = (expectedOutput || '').trim();
      const passed = actual === expected;
      const marksAwarded = passed ? parseFloat(marksAwardedMax) : 0;
      
      return {
        testCaseId: tcId,
        idx,
        passed,
        marksAwarded,
        actualOutput: stdout || '',
        errorMessage: stderr || '',
        runtimeMs,
        expectedOutput: expected,
        input: input
      };
    } catch (err) {
      const runtimeMs = performance.now() - start;
      let errMsg = err.stderr || err.message;
      if (err.killed) errMsg = "Time Limit Exceeded";
      
      return {
        testCaseId: tcId,
        idx,
        passed: false,
        marksAwarded: 0,
        actualOutput: err.stdout || '',
        errorMessage: errMsg,
        runtimeMs,
        expectedOutput: (expectedOutput || '').trim(),
        input: input
      };
    }
  }

  async runBatch(testCases) {
    // Run all test cases concurrently against the cached binary!
    // Since each test case uses a unique input_idx.txt, they won't clash!
    const promises = testCases.map((tc, idx) => 
      this.runOneTestCase(tc.input, tc.expected, tc.id, idx, tc.marks || 0)
    );
    
    const results = await Promise.all(promises);
    return results;
  }
}
