import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executionQueue } from '../executionQueue.js';

const execAsync = promisify(exec);

const runnerJsTemplate = `
const fs = require('fs');

function deepCompare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-6;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }
  if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let key of keysA) {
      if (!deepCompare(a[key], b[key])) return false;
    }
    return true;
  }
  return a === b;
}

async function runTests() {
  try {
    const userModule = require('./solution.js');
    const data = JSON.parse(fs.readFileSync('test_cases.json', 'utf-8'));
    const testCases = data.testCases || [];
    const entry = data.entry || {};
    const methodName = entry.methodName || 'solution';
    const className = entry.className || 'Solution';

    let targetFn = null;
    if (typeof userModule === 'function') {
      targetFn = userModule;
    } else if (userModule[methodName]) {
      targetFn = userModule[methodName];
    } else if (userModule[className]) {
      const inst = new userModule[className]();
      targetFn = inst[methodName] ? inst[methodName].bind(inst) : null;
    } else if (global[methodName]) {
      targetFn = global[methodName];
    } else if (global[className]) {
      const inst = new global[className]();
      targetFn = inst[methodName] ? inst[methodName].bind(inst) : null;
    }

    if (typeof targetFn !== 'function') {
      // Fallback: search exports for any exported function
      for (const key of Object.keys(userModule)) {
        if (typeof userModule[key] === 'function') {
          targetFn = userModule[key];
          break;
        }
      }
    }

    if (typeof targetFn !== 'function') {
      console.log(JSON.stringify({
        status: "runtime_error", summary: "Entrypoint Not Found", exitCode: 1,
        compileError: null, runtimeError: "Entrypoint function '" + methodName + "' not found.", cases: []
      }));
      return;
    }

    const cases_report = [];
    let all_passed = true;
    let any_runtime_error = false;

    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      const args = tc.args || [];
      const expected = tc.expected;

      const originalStdoutWrite = process.stdout.write;
      const originalStderrWrite = process.stderr.write;
      let stdoutVal = "";
      let stderrVal = "";
      process.stdout.write = (chunk) => { stdoutVal += chunk; return true; };
      process.stderr.write = (chunk) => { stderrVal += chunk; return true; };

      const start = process.hrtime.bigint();
      let actual = null;
      let passed = false;
      let tb_str = null;
      let case_status = "passed";

      try {
        // Deep clone args to avoid side effect mutations across cases
        const clonedArgs = JSON.parse(JSON.stringify(args));
        actual = targetFn(...clonedArgs);
        
        // If function returns undefined/void, check if first arg was mutated in-place
        if (actual === undefined && clonedArgs.length > 0) {
          actual = clonedArgs[0];
        }

        passed = deepCompare(actual, expected);
        case_status = passed ? "passed" : "wrong_answer";
        if (!passed) all_passed = false;
      } catch (err) {
        case_status = "runtime_error";
        tb_str = err.stack || err.message;
        any_runtime_error = true;
        all_passed = false;
      } finally {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
      }

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      cases_report.push({
        index: idx + 1,
        status: case_status,
        input: { args },
        expected: expected,
        actual: case_status !== "runtime_error" ? actual : null,
        stdout: stdoutVal,
        stderr: stderrVal,
        runtimeMs: Math.round(durationMs * 100) / 100,
        traceback: tb_str
      });
    }

    let status = "accepted";
    let summary = "Accepted";
    if (any_runtime_error) { status = "runtime_error"; summary = "Runtime Error"; }
    else if (!all_passed) { status = "wrong_answer"; summary = "Wrong Answer"; }

    console.log(JSON.stringify({
      status, summary, exitCode: 0, compileError: null, runtimeError: null, cases: cases_report
    }));

  } catch (err) {
    console.log(JSON.stringify({
      status: "internal_error", summary: "Failed to run", exitCode: 1,
      compileError: null, runtimeError: err.message, cases: []
    }));
  }
}

runTests();
`;

export async function runJavaScript({ code, problem, testCases, timeoutMs = 5000, memoryMb = 128 }) {
  return executionQueue.run(async () => {
    const uuid = crypto.randomUUID();
    const tmpBase = path.join(process.cwd(), '.tmp');
    const sessionDir = path.join(tmpBase, uuid);

    try {
      await fs.mkdir(sessionDir, { recursive: true });
      
      // Wrap user code to export declared functions/classes automatically
      const modifiedCode = `
${code}

if (typeof twoSum !== 'undefined') module.exports.twoSum = twoSum;
if (typeof reverseString !== 'undefined') module.exports.reverseString = reverseString;
if (typeof isPalindrome !== 'undefined') module.exports.isPalindrome = isPalindrome;
if (typeof solution !== 'undefined') module.exports.solution = solution;
if (typeof Solution !== 'undefined') module.exports.Solution = Solution;
`;
      await fs.writeFile(path.join(sessionDir, 'solution.js'), modifiedCode, 'utf-8');
      await fs.writeFile(path.join(sessionDir, 'runner.js'), runnerJsTemplate, 'utf-8');
      
      const casesPayload = {
        entry: problem?.entry ?? { type: 'function', methodName: 'solution' },
        testCases: testCases || [],
      };
      await fs.writeFile(path.join(sessionDir, 'test_cases.json'), JSON.stringify(casesPayload, null, 2), 'utf-8');

      const volumePath = sessionDir.replace(/\\/g, '/');
      const containerName = `coderank_js_runner_${uuid.slice(0, 8)}`;
      const cmd = [
        'docker run',
        '--rm',
        `--name ${containerName}`,
        `--memory=${memoryMb}m`,
        '--cpus=0.5',
        '--network none',
        `--volume "${volumePath}:/app"`,
        '--workdir /app',
        'coderank-javascript:latest',
        'node runner.js'
      ].join(' ');

      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });
        try {
          return JSON.parse(stdout.trim());
        } catch {
          return { status: 'runtime_error', summary: 'Harness Failed', exitCode: 1, compileError: null, runtimeError: stderr || stdout, cases: [] };
        }
      } catch (execErr) {
        if (execErr.killed) {
          await execAsync(`docker rm -f ${containerName}`).catch(() => {});
          return { status: 'time_limit_exceeded', summary: 'Time Limit Exceeded', exitCode: 124, compileError: null, runtimeError: 'Execution exceeded time limit.', cases: [] };
        }
        return { status: 'runtime_error', summary: 'Runtime Exception', exitCode: execErr.code ?? 1, compileError: null, runtimeError: execErr.stderr || execErr.message, cases: [] };
      }
    } catch (sysErr) {
      return { status: 'internal_error', summary: 'Internal Execution Failure', exitCode: 500, compileError: null, runtimeError: sysErr.message, cases: [] };
    } finally {
      try { await fs.rm(sessionDir, { recursive: true, force: true }); } catch {}
    }
  });
}
