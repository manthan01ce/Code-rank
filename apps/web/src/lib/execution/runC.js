import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executionQueue } from '../executionQueue.js';

const execAsync = promisify(exec);

function cleanStdout(raw) {
  if (!raw) return '';
  return raw
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('{"status"') && !trimmed.startsWith('{"index"') && !trimmed.startsWith('{"cases"');
    })
    .join('\n')
    .trim();
}

function deepCompare(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatCArg(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return `"${val}"`;
  if (Array.isArray(val)) {
    if (val.length === 0) return "(int[]){0}";
    if (typeof val[0] === 'number') return `(int[]){${val.join(', ')}}`;
    if (typeof val[0] === 'string' && val[0].length === 1) return `(char[]){${val.map(c => `'${c}'`).join(', ')}}`;
  }
  return "NULL";
}

function generateMainC(problemId, entry, testCases) {
  const methodName = entry?.methodName || 'solution';

  let cHeader = `
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>
#include <limits.h>
#include <ctype.h>
#include <time.h>

#include "solution.c"

static void print_int_array(int* arr, int sz) {
    if (!arr) { printf("null"); return; }
    printf("[");
    for (int i = 0; i < sz; i++) {
        printf("%d%s", arr[i], i < sz - 1 ? ", " : "");
    }
    printf("]");
}

static void print_char_array(char* arr, int sz) {
    if (!arr) { printf("null"); return; }
    printf("[");
    for (int i = 0; i < sz; i++) {
        printf("\\"%c\\"%s", arr[i], i < sz - 1 ? ", " : "");
    }
    printf("]");
}

int main() {
    printf("{\\"status\\": \\"running\\", \\"cases\\": [");
`;

  let cCases = '';
  testCases.forEach((tc, idx) => {
    const isLast = idx === testCases.length - 1;
    const args = tc.args || [];
    
    // Case logic for C calls
    cCases += `
    {
        clock_t start = clock();
        printf("{\\"index\\": ${idx + 1}, \\"actual\\": ");
`;

    if (problemId === 1) { // Two Sum
      cCases += `
        int nums[] = {${args[0].join(', ')}};
        int target = ${args[1]};
        int retSize = 0;
        int* res = twoSum(nums, ${args[0].length}, target, &retSize);
        print_int_array(res, retSize);
`;
    } else if (problemId === 2) { // Reverse String
      cCases += `
        char s[] = {${args[0].map(c => `'${c}'`).join(', ')}};
        reverseString(s, ${args[0].length});
        print_char_array(s, ${args[0].length});
`;
    } else if (problemId === 3) { // Palindrome Number
      cCases += `
        bool res = isPalindrome(${args[0]});
        printf("%s", res ? "true" : "false");
`;
    } else if (problemId === 7) { // Reverse Integer
      cCases += `
        int res = reverse(${args[0]});
        printf("%d", res);
`;
    } else if (problemId === 10) { // Climbing Stairs
      cCases += `
        int res = climbStairs(${args[0]});
        printf("%d", res);
`;
    } else {
      // Fallback runner
      cCases += `
        printf("null");
`;
    }

    cCases += `
        clock_t end = clock();
        double durationMs = ((double)(end - start)) / CLOCKS_PER_SEC * 1000.0;
        printf(", \\"runtimeMs\\": %.2f}", durationMs);
        ${isLast ? '' : 'printf(",");'}
    }
`;
  });

  return cHeader + cCases + `
    printf("]}");
    return 0;
}
`;
}

export async function runC({ code, problem, testCases = [], timeoutMs = 5000, memoryMb = 128 }) {
  return executionQueue.run(async () => {
    const uuid = crypto.randomUUID();
    const tmpBase = path.join(process.cwd(), '.tmp');
    const sessionDir = path.join(tmpBase, uuid);

    try {
      await fs.mkdir(sessionDir, { recursive: true });

      const hasMain = code.includes('int main(') || code.includes('void main(');

      const codeB64 = Buffer.from(code).toString('base64');
      const workdir = `/app/exec_${uuid.slice(0, 8)}`;
      let cmd;

      if (hasMain) {
        cmd = [
          'docker exec coderank-c-daemon',
          'bash -c "',
          `mkdir -p ${workdir} && cd ${workdir} && `,
          `echo '${codeB64}' | base64 -d > main.c && `,
          `gcc -O2 main.c -o run_tests 2> compile_err.txt && ./run_tests || (echo \'\\nRUNTIME_ERROR:\' && cat compile_err.txt)`,
          '"'
        ].join(' ');
      } else {
        const mainC = generateMainC(problem?.id, problem?.entry, testCases);
        const mainB64 = Buffer.from(mainC).toString('base64');
        cmd = [
          'docker exec coderank-c-daemon',
          'bash -c "',
          `mkdir -p ${workdir} && cd ${workdir} && `,
          `echo '${codeB64}' | base64 -d > solution.c && `,
          `echo '${mainB64}' | base64 -d > main.c && `,
          `gcc -O2 main.c -o run_tests 2> compile_err.txt && ./run_tests || (echo \'\\nRUNTIME_ERROR:\' && cat compile_err.txt)`,
          '"'
        ].join(' ');
      }

      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });

        if (stdout.includes('RUNTIME_ERROR:')) {
          const errData = await fs.readFile(path.join(sessionDir, 'compile_err.txt'), 'utf-8').catch(() => stderr);
          return {
            status: 'compile_error',
            summary: 'Compile Error',
            exitCode: 1,
            compileError: errData || 'C Compilation Error',
            runtimeError: null,
            cases: []
          };
        }

        let parsedOutput = null;
        try {
          parsedOutput = JSON.parse(stdout.trim());
        } catch {
          parsedOutput = { cases: [] };
        }

        const rawCases = parsedOutput?.cases || [];
        let allPassed = true;
        const cleanedUserStdout = cleanStdout(stdout);

        const evaluatedCases = (testCases || []).map((tc, idx) => {
          const rawCase = rawCases[idx] || {};
          let actualVal = rawCase.actual;
          if (typeof actualVal === 'string' && (actualVal.startsWith('[') || actualVal.startsWith('{'))) {
            try { actualVal = JSON.parse(actualVal); } catch {}
          }

          const passed = deepCompare(actualVal, tc.expected);
          if (!passed) allPassed = false;

          return {
            index: idx + 1,
            status: passed ? 'passed' : 'wrong_answer',
            input: { args: tc.args || [] },
            expected: tc.expected,
            actual: actualVal,
            stdout: cleanedUserStdout,
            stderr: stderr.slice(0, 1024),
            runtimeMs: rawCase.runtimeMs || 0
          };
        });

        const overallStatus = allPassed ? 'accepted' : 'wrong_answer';
        const summary = allPassed ? `All ${evaluatedCases.length} / ${evaluatedCases.length} Sample Cases Passed` : 'Wrong Answer';

        return {
          status: overallStatus,
          summary,
          exitCode: 0,
          compileError: null,
          runtimeError: null,
          cases: evaluatedCases
        };

      } catch (execErr) {
        if (execErr.killed) {
          await execAsync(`docker rm -f ${containerName}`).catch(() => {});
          return { status: 'time_limit_exceeded', summary: 'Time Limit Exceeded', exitCode: 124, compileError: null, runtimeError: 'Execution exceeded time limit.', cases: [] };
        }

        const errData = await fs.readFile(path.join(sessionDir, 'compile_err.txt'), 'utf-8').catch(() => null);
        if (errData && errData.trim()) {
          return { status: 'compile_error', summary: 'Compile Error', exitCode: 1, compileError: errData, runtimeError: null, cases: [] };
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
