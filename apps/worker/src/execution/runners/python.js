import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

const runnerPyTemplate = `
import sys
import json
import traceback
import time
import io
import ast

def check_ast(code_str):
    try:
        tree = ast.parse(code_str)
    except Exception:
        return None
    for node in ast.walk(tree):
        if isinstance(node, ast.Expr):
            if isinstance(node.value, ast.Name):
                name_id = node.value.id
                if name_id not in ('None', 'True', 'False'):
                    line_no = getattr(node, 'lineno', '?')
                    return f"NameError: standalone undefined name reference '{name_id}' at line {line_no}"
    return None

def run_tests():
    try:
        with open('solution.py', 'r', encoding='utf-8') as f_in:
            solution_code = f_in.read()
        ast_err = check_ast(solution_code)
        if ast_err:
            print(json.dumps({
                "status": "compile_error",
                "summary": "Compile Error",
                "exitCode": 0,
                "compileError": ast_err,
                "runtimeError": None,
                "cases": []
            }))
            return
    except Exception:
        pass

    try:
        import solution
    except Exception as e:
        tb = traceback.format_exception(type(e), e, e.__traceback__)
        err_msg = "".join(tb)
        print(json.dumps({
            "status": "compile_error",
            "summary": "Compile Error",
            "exitCode": 0,
            "compileError": err_msg,
            "runtimeError": None,
            "cases": []
        }))
        return

    try:
        with open('test_cases.json', 'r') as f:
            data = json.load(f)
        
        entry = data.get('entry', {})
        entry_type = entry.get('type', 'function')
        method_name = entry.get('methodName', 'solution')
        class_name = entry.get('className', 'Solution')
        test_cases = data.get('testCases', [])
    except Exception as e:
        print(json.dumps({
            "status": "internal_error",
            "summary": f"Failed to initialize test harness: {e}",
            "exitCode": 1,
            "compileError": None,
            "runtimeError": str(e),
            "cases": []
        }))
        return

    target_fn = None
    try:
        if entry_type == 'class-method':
            if not hasattr(solution, class_name):
                raise AttributeError(f"Class '{class_name}' not found in solution.py")
            cls = getattr(solution, class_name)
            inst = cls()
            if not hasattr(inst, method_name):
                raise AttributeError(f"Method '{method_name}' not found in class '{class_name}'")
            target_fn = getattr(inst, method_name)
        else:
            if not hasattr(solution, method_name):
                raise AttributeError(f"Function '{method_name}' not found in solution.py")
            target_fn = getattr(solution, method_name)
    except Exception as e:
        print(json.dumps({
            "status": "runtime_error",
            "summary": "Entrypoint Resolution Failed",
            "exitCode": 1,
            "compileError": None,
            "runtimeError": str(e),
            "cases": []
        }))
        return

    cases_report = []
    all_passed = True
    any_runtime_error = False
    
    for idx, tc in enumerate(test_cases):
        args = tc.get('args', [])
        kwargs = tc.get('kwargs', {})
        expected = tc.get('expected')
        
        captured_stdout = io.StringIO()
        captured_stderr = io.StringIO()
        
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = captured_stdout
        sys.stderr = captured_stderr
        
        start_time = time.perf_counter()
        actual = None
        passed = False
        tb_str = None
        case_status = "passed"
        
        try:
            actual = target_fn(*args, **kwargs)
            duration = (time.perf_counter() - start_time) * 1000.0
            
            def normalize(val):
                if isinstance(val, tuple):
                    return list(normalize(x) for x in val)
                if isinstance(val, list):
                    return [normalize(x) for x in val]
                if isinstance(val, dict):
                    return {k: normalize(v) for k, v in val.items()}
                if isinstance(val, set):
                    return sorted(list(normalize(x) for x in val))
                if isinstance(val, float):
                    return round(val, 8)
                return val
            
            norm_actual = normalize(actual)
            norm_expected = normalize(expected)
            
            def deep_compare(a, b):
                if isinstance(a, float) and isinstance(b, float):
                    return abs(a - b) < 1e-6
                if type(a) != type(b):
                    return a == b
                if isinstance(a, list):
                    if len(a) != len(b):
                        return False
                    return all(deep_compare(x, y) for x, y in zip(a, b))
                if isinstance(a, dict):
                    if set(a.keys()) != set(b.keys()):
                        return False
                    return all(deep_compare(a[k], b[k]) for k in a)
                return a == b

            if deep_compare(norm_actual, norm_expected):
                passed = True
                case_status = "passed"
            else:
                passed = False
                case_status = "wrong_answer"
                all_passed = False
                
        except Exception as e:
            duration = (time.perf_counter() - start_time) * 1000.0
            tb_str = traceback.format_exc()
            case_status = "runtime_error"
            any_runtime_error = True
            all_passed = False
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        stdout_val = captured_stdout.getvalue()
        stderr_val = captured_stderr.getvalue()
        
        if len(stdout_val) > 8192:
            stdout_val = stdout_val[:8192] + "\\n...[Output truncated to 8KB]"
        if len(stderr_val) > 8192:
            stderr_val = stderr_val[:8192] + "\\n...[Output truncated to 8KB]"
            
        cases_report.append({
            "index": idx + 1,
            "status": case_status,
            "input": {
                "args": args,
                "kwargs": kwargs
            },
            "expected": expected,
            "actual": norm_actual if case_status != "runtime_error" else None,
            "stdout": stdout_val,
            "stderr": stderr_val,
            "runtimeMs": round(duration, 3),
            "traceback": tb_str
        })

    if any_runtime_error:
        status = "runtime_error"
        summary = "Runtime Error"
    elif not all_passed:
        status = "wrong_answer"
        summary = "Wrong Answer"
    else:
        status = "accepted"
        summary = "Accepted"

    print(json.dumps({
        "status": status,
        "summary": summary,
        "exitCode": 0,
        "compileError": None,
        "runtimeError": None,
        "cases": cases_report
    }))

if __name__ == '__main__':
    run_tests()
`;

export async function runPython({
  code,
  problem,
  testCases,
  timeoutMs = 5000,
  memoryMb = 128,
}) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required and must be a string');
  }
  if (!testCases || !Array.isArray(testCases)) {
    throw new Error('testCases is required and must be an array');
  }

  const uuid = crypto.randomUUID();
  const tmpBase = path.join(process.cwd(), '.tmp');
  const sessionDir = path.join(tmpBase, uuid);

  try {
    await fs.mkdir(sessionDir, { recursive: true });

    await fs.writeFile(path.join(sessionDir, 'solution.py'), code, 'utf-8');
    await fs.writeFile(path.join(sessionDir, 'runner.py'), runnerPyTemplate, 'utf-8');
    
    const casesPayload = {
      entry: problem?.entry ?? { type: 'function', methodName: 'solution' },
      testCases,
    };
    await fs.writeFile(
      path.join(sessionDir, 'test_cases.json'),
      JSON.stringify(casesPayload, null, 2),
      'utf-8'
    );

    const codeB64 = Buffer.from(code).toString('base64');
    const runnerB64 = Buffer.from(runnerPyTemplate).toString('base64');
    const testCasesB64 = Buffer.from(JSON.stringify({ entry: problem?.entry, testCases })).toString('base64');
    
    const workdir = `/app/exec_${uuid.slice(0, 8)}`;
    
    const cmd = [
      'docker exec coderank-python-daemon',
      'bash -c "',
      `mkdir -p ${workdir} && cd ${workdir} && `,
      `echo '${codeB64}' | base64 -d > solution.py && `,
      `echo '${runnerB64}' | base64 -d > runner.py && `,
      `echo '${testCasesB64}' | base64 -d > test_cases.json && `,
      'python runner.py',
      '"'
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 2 * 1024 * 1024,
      });

      try {
        return JSON.parse(stdout.trim());
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

      if (execErr.code === 137) {
        return {
          status: 'memory_limit_exceeded',
          summary: 'Memory Limit Exceeded',
          exitCode: 137,
          compileError: null,
          runtimeError: 'Execution exceeded memory limit.',
          cases: [],
        };
      }

      try {
        if (execErr.stdout) {
          const result = JSON.parse(execErr.stdout.trim());
          if (result.status) return result;
        }
      } catch {}

      return {
        status: 'runtime_error',
        summary: 'Runtime Exception',
        exitCode: execErr.code ?? 1,
        compileError: null,
        runtimeError: execErr.stderr || execErr.message || 'Unknown runtime exception',
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
  } finally {
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch {}
  }
}
