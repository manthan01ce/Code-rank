import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executionQueue } from '../executionQueue.js';

const execAsync = promisify(exec);

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

function formatJavaArg(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return `"${val}"`;
  if (Array.isArray(val)) {
    if (val.length === 0) return "new int[]{}";
    if (typeof val[0] === 'number') return `new int[]{${val.join(', ')}}`;
    if (typeof val[0] === 'string' && val[0].length === 1) return `new char[]{${val.map(c => `'${c}'`).join(', ')}}`;
    if (typeof val[0] === 'string') return `new String[]{${val.map(s => `"${s}"`).join(', ')}}`;
  }
  return "null";
}

function generateMainJava(problemId, entry, testCases) {
  const methodName = entry?.methodName || 'solution';

  let java = `
import java.util.*;
import java.io.*;
import java.math.*;

public class Main {
    private static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\\"" + ((String) obj).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\n") + "\\"";
        if (obj instanceof Character) return "\\"" + obj.toString() + "\\"";
        if (obj instanceof Boolean || obj instanceof Number) return obj.toString();
        if (obj instanceof int[]) return Arrays.toString((int[]) obj);
        if (obj instanceof char[]) {
            char[] arr = (char[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append("\\"").append(arr[i]).append("\\"");
                if (i < arr.length - 1) sb.append(", ");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof String[]) {
            String[] arr = (String[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(toJson(arr[i]));
                if (i < arr.length - 1) sb.append(", ");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                sb.append(toJson(list.get(i)));
                if (i < list.size() - 1) sb.append(", ");
            }
            sb.append("]");
            return sb.toString();
        }
        return obj.toString();
    }

    public static void main(String[] args) {
        try {
            Solution sol = new Solution();
            System.out.print("{\\"status\\": \\"running\\", \\"cases\\": [");

`;

  testCases.forEach((tc, idx) => {
    const isLast = idx === testCases.length - 1;
    const formattedArgs = (tc.args || []).map(arg => formatJavaArg(arg)).join(', ');

    java += `
            {
                long start = System.nanoTime();
                Object actual = null;
                try {
                    actual = sol.${methodName}(${formattedArgs});
                } catch (Throwable t) {
                    actual = "ERROR: " + t.getMessage();
                }
                long end = System.nanoTime();
                double durationMs = (end - start) / 1e6;
                System.out.print("{\\"index\\": ${idx + 1}, \\"actual\\": " + toJson(actual) + ", \\"runtimeMs\\": " + String.format(Locale.US, "%.2f", durationMs) + "}");
                ${isLast ? '' : 'System.out.print(",");'}
            }
`;
  });

  java += `
            System.out.print("]}");
        } catch (Throwable e) {
            String err = e.getMessage() != null ? e.getMessage() : e.toString();
            err = err.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\\"").replace("\\n", "\\\\n");
            System.out.print("{\\"status\\": \\"runtime_error\\", \\"summary\\": \\"Runtime Exception: " + err + "\\", \\"cases\\": []}");
        }
    }
}
`;
  return java;
}

export async function runJava({ code, problem, testCases = [], timeoutMs = 10000, memoryMb = 128 }) {
  return executionQueue.run(async () => {
    const uuid = crypto.randomUUID();
    const tmpBase = path.join(process.cwd(), '.tmp');
    const sessionDir = path.join(tmpBase, uuid);

    try {
      await fs.mkdir(sessionDir, { recursive: true });
      
      let userCode = code;
      if (!userCode.includes('class Solution')) {
        userCode = `public class Solution {\n${userCode}\n}`;
      } else {
        userCode = userCode.replace(/public\s+class\s+Solution/, 'class Solution');
      }

      await fs.writeFile(path.join(sessionDir, 'Solution.java'), userCode, 'utf-8');
      
      const mainJava = generateMainJava(problem?.id, problem?.entry, testCases);
      await fs.writeFile(path.join(sessionDir, 'Main.java'), mainJava, 'utf-8');

      const volumePath = sessionDir.replace(/\\/g, '/');
      const containerName = `coderank_java_runner_${uuid.slice(0, 8)}`;

      const cmd = [
        'docker run',
        '--rm',
        `--name ${containerName}`,
        `--memory=${memoryMb}m`,
        '--cpus=0.5',
        '--network none',
        `--volume "${volumePath}:/app"`,
        '--workdir /app',
        'coderank-java:latest',
        'bash -c "javac Solution.java Main.java 2> compile_err.txt && java Main || (echo \'\\nRUNTIME_ERROR:\' && cat compile_err.txt)"'
      ].join(' ');

      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 });

        if (stdout.includes('RUNTIME_ERROR:')) {
          const errData = await fs.readFile(path.join(sessionDir, 'compile_err.txt'), 'utf-8').catch(() => stderr);
          return {
            status: 'compile_error',
            summary: 'Compile Error',
            exitCode: 1,
            compileError: errData || 'Java Compilation Failed',
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
        let anyRuntimeErr = false;

        const cleanStdoutStr = (raw) => {
          if (!raw) return '';
          return raw
            .split('\n')
            .filter(line => {
              const trimmed = line.trim();
              return !trimmed.startsWith('{"status"') && !trimmed.startsWith('{"index"') && !trimmed.startsWith('{"cases"');
            })
            .join('\n')
            .trim();
        };
        const cleanedUserStdout = cleanStdoutStr(stdout);

        const evaluatedCases = (testCases || []).map((tc, idx) => {
          const rawCase = rawCases[idx] || {};
          let actualVal = rawCase.actual;
          
          // Try parsing actual string back into JSON if needed
          if (typeof actualVal === 'string' && (actualVal.startsWith('[') || actualVal.startsWith('{'))) {
            try { actualVal = JSON.parse(actualVal); } catch {}
          }

          const passed = deepCompare(actualVal, tc.expected);
          if (!passed) allPassed = false;
          const caseStatus = passed ? 'passed' : 'wrong_answer';

          return {
            index: idx + 1,
            status: caseStatus,
            input: { args: tc.args || [] },
            expected: tc.expected,
            actual: actualVal,
            stdout: cleanedUserStdout,
            stderr: stderr.slice(0, 1024),
            runtimeMs: rawCase.runtimeMs || 0
          };
        });

        let overallStatus = allPassed ? 'accepted' : 'wrong_answer';
        let summary = allPassed ? `All ${evaluatedCases.length} / ${evaluatedCases.length} Sample Cases Passed` : 'Wrong Answer';

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
          return { status: 'time_limit_exceeded', summary: 'Time Limit Exceeded', exitCode: 124, compileError: null, runtimeError: 'Execution exceeded time limit (10s).', cases: [] };
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
