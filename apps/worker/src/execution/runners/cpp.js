import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

const PROBLEM_TYPES = {
  1: { args: ['vector<int>', 'int'], ret: 'vector<int>' },
  2: { args: ['vector<char>'], ret: 'void' },
  3: { args: ['int'], ret: 'bool' },
  4: { args: ['int'], ret: 'vector<string>' },
  5: { args: ['vector<int>'], ret: 'int' },
  6: { args: ['vector<int>'], ret: 'bool' },
  7: { args: ['int'], ret: 'int' },
  8: { args: ['string', 'string'], ret: 'bool' },
  9: { args: ['string'], ret: 'int' },
  10: { args: ['int'], ret: 'int' }
};

function formatCppValue(type, val) {
  if (val === null || val === undefined) return '""';
  if (type === 'int') return val.toString();
  if (type === 'bool') return val ? 'true' : 'false';
  if (type === 'string') return `"${val}"`;
  if (type === 'vector<int>') return 'std::vector<int>{' + val.join(', ') + '}';
  if (type === 'vector<char>') return 'std::vector<char>{' + val.map(c => `'${c}'`).join(', ') + '}';
  if (type === 'vector<string>') return 'std::vector<std::string>{' + val.map(s => `"${s}"`).join(', ') + '}';
  return '""';
}

function generateMainCpp(problemId, entry, testCases) {
  const pTypes = PROBLEM_TYPES[problemId] || { args: [], ret: 'void' };
  const methodName = entry.methodName || 'solution';
  const className = entry.className || 'Solution';

  let cpp = `
#include <iostream>
#include <vector>
#include <string>
#include <chrono>
#include "solution.cpp"

std::string escapeJsonString(const std::string& input) {
    std::string output = "\\"";
    for (char c : input) {
        if (c == '"') output += "\\\\\\"";
        else if (c == '\\\\') output += "\\\\\\\\";
        else if (c == '\\b') output += "\\\\b";
        else if (c == '\\f') output += "\\\\f";
        else if (c == '\\n') output += "\\\\n";
        else if (c == '\\r') output += "\\\\r";
        else if (c == '\\t') output += "\\\\t";
        else output += c;
    }
    output += "\\"";
    return output;
}

std::string toJson(int val) { return std::to_string(val); }
std::string toJson(bool val) { return val ? "true" : "false"; }
std::string toJson(const std::string& val) { return escapeJsonString(val); }
std::string toJson(char val) { return escapeJsonString(std::string(1, val)); }

template<typename T>
std::string toJson(const std::vector<T>& vec) {
    std::string res = "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        res += toJson(vec[i]);
        if (i < vec.size() - 1) res += ", ";
    }
    res += "]";
    return res;
}

int main() {
    ${className} sol;
    std::cout << "{\\"status\\": \\"accepted\\", \\"cases\\": [";
`;

  testCases.forEach((tc, idx) => {
    cpp += `\n    // Test Case ${idx + 1}\n    {\n`;
    
    tc.args.forEach((argVal, argIdx) => {
      const type = pTypes.args[argIdx] || 'int';
      const cppVal = formatCppValue(type, argVal);
      cpp += `        ${type.replace('vector', 'std::vector').replace('string', 'std::string')} arg${argIdx} = ${cppVal};\n`;
    });

    const argList = tc.args.map((_, i) => `arg${i}`).join(', ');

    cpp += `        auto start = std::chrono::high_resolution_clock::now();\n`;

    if (pTypes.ret === 'void') {
      cpp += `        sol.${methodName}(${argList});\n`;
      cpp += `        auto end = std::chrono::high_resolution_clock::now();\n`;
      cpp += `        auto res = arg0;\n`; 
    } else {
      cpp += `        auto res = sol.${methodName}(${argList});\n`;
      cpp += `        auto end = std::chrono::high_resolution_clock::now();\n`;
    }

    cpp += `        double duration = std::chrono::duration<double, std::milli>(end - start).count();\n`;
    
    const isLast = idx === testCases.length - 1;
    cpp += `        std::cout << "{\\"index\\": ${idx + 1}, \\"status\\": \\"passed\\", \\"actual\\": " << toJson(res) << ", \\"runtimeMs\\": " << duration << "}";\n`;
    if (!isLast) cpp += `        std::cout << ",";\n`;

    cpp += `    }\n`;
  });

  cpp += `
    std::cout << "]}";
    return 0;
}
`;
  return cpp;
}

export async function runCpp({ code, problem, testCases }) {
  const timeoutMs = 5000;
  const uuid = crypto.randomUUID();

  try {
    const mainCpp = generateMainCpp(problem?.id, problem?.entry || { methodName: 'solution', className: 'Solution' }, testCases || []);

    const codeB64 = Buffer.from(code).toString('base64');
    const mainB64 = Buffer.from(mainCpp).toString('base64');
    
    const workdir = `/app/exec_${uuid.slice(0, 8)}`;
    
    const cmd = [
      'docker exec coderank-cpp-daemon',
      'bash -c "',
      `mkdir -p ${workdir} && cd ${workdir} && `,
      `echo '${codeB64}' | base64 -d > solution.cpp && `,
      `echo '${mainB64}' | base64 -d > main.cpp && `,
      `g++ -O2 main.cpp -o run_tests 2> compile_err.txt && ./run_tests || (echo '\\nRUNTIME_ERROR:' && cat compile_err.txt)`,
      '"'
    ].join(' ');

    let stdout, stderr;
    try {
      const execResult = await execAsync(cmd, {
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 2 * 1024 * 1024,
      });
      stdout = execResult.stdout;
      stderr = execResult.stderr;

      if (stdout.includes('RUNTIME_ERROR:')) {
        const errData = stderr;
        return {
          status: 'compile_error',
          summary: 'Compile Error',
          exitCode: 1,
          compileError: errData || 'Unknown compile error',
          runtimeError: null,
          cases: []
        };
      }

      try {
        const result = JSON.parse(stdout.trim());
        let allPassed = true;
        result.cases = (result.cases || []).map((c, idx) => {
          const expected = testCases[idx]?.expected;
          const pass = JSON.stringify(c.actual) === JSON.stringify(expected);
          if (!pass) allPassed = false;
          return {
            ...c,
            status: pass ? 'passed' : 'wrong_answer',
            expected: expected,
            input: { args: testCases[idx]?.args }
          };
        });
        
        result.status = allPassed ? 'accepted' : 'wrong_answer';
        result.summary = allPassed ? 'Accepted' : 'Wrong Answer';
        result.compileError = null;
        result.runtimeError = null;
        return result;

      } catch (jsonErr) {
        return {
          status: 'runtime_error',
          summary: 'Harness Failed to output JSON',
          exitCode: 1,
          compileError: null,
          runtimeError: stderr || stdout || 'Harness parsing error',
          cases: [],
        };
      }

    } catch (execErr) {
      if (execErr.killed) {
        return {
          status: 'time_limit_exceeded',
          summary: 'Time Limit Exceeded',
          exitCode: 124,
          compileError: null,
          runtimeError: 'Execution exceeded time limit.',
          cases: [],
        };
      }

      return {
        status: 'compile_error',
        summary: 'Compile Error',
        exitCode: execErr.code ?? 1,
        compileError: execErr.stderr || execErr.message || 'Unknown compile exception',
        runtimeError: null,
        cases: [],
      };
    }

  } catch (sysErr) {
    return {
      status: 'internal_error',
      summary: 'Internal Execution Failure',
      exitCode: 500,
      compileError: null,
      runtimeError: sysErr.message,
      cases: [],
    };
  } finally {}
}
