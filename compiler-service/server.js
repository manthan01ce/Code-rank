const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const COMPILER_SECRET = process.env.COMPILER_SECRET || 'super-secret-key-coderank';

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
    # 0. AST Static Lint checks
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

    # 1. Import solution
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

    # 2. Load test cases
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

    # 3. Resolve entrypoint
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

    # 4. Run test cases
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

// Simple auth middleware checking shared secret key
function requireAuth(req, res, next) {
  const secret = req.headers['x-compiler-secret'];
  if (!secret || secret !== COMPILER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized compiler access.' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', message: 'CodeRank Compiler Service is running.' });
});

app.post('/run-python', requireAuth, async (req, res) => {
  const { code, problem, testCases } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code must be a non-empty string' });
  }

  const uuid = crypto.randomUUID();
  const tmpBase = path.join(__dirname, '.tmp');
  const sessionDir = path.join(tmpBase, uuid);

  try {
    // 1. Create workspace
    await fs.mkdir(sessionDir, { recursive: true });

    // 2. Write runner files
    await fs.writeFile(path.join(sessionDir, 'solution.py'), code, 'utf-8');
    await fs.writeFile(path.join(sessionDir, 'runner.py'), runnerPyTemplate, 'utf-8');
    await fs.writeFile(
      path.join(sessionDir, 'test_cases.json'),
      JSON.stringify({
        entry: problem?.entry || { type: 'function', methodName: 'solution' },
        testCases: testCases || []
      }, null, 2),
      'utf-8'
    );

    // 3. Docker execution command
    const volumePath = sessionDir.replace(/\\/g, '/');
    const containerName = `py_exec_${uuid.slice(0, 8)}`;

    const cmd = [
      'docker run',
      '--rm',
      `--name ${containerName}`,
      '--memory=128m',
      '--cpus=0.5',
      '--network none',
      `--volume "${volumePath}:/app"`,
      '--workdir /app',
      'python:3.12-slim',
      'python runner.py',
    ].join(' ');

    // 4. Run execution
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 5000,
        killSignal: 'SIGKILL',
        maxBuffer: 2 * 1024 * 1024,
      });

      try {
        const result = JSON.parse(stdout.trim());
        return res.json(result);
      } catch (jsonErr) {
        return res.json({
          status: 'runtime_error',
          summary: 'Harness Failed to output JSON',
          exitCode: 1,
          compileError: null,
          runtimeError: stderr || stdout || 'Harness parsing error',
          cases: [],
        });
      }
    } catch (execErr) {
      if (execErr.killed) {
        await execAsync(`docker rm -f ${containerName}`).catch(() => {});
        return res.json({
          status: 'time_limit_exceeded',
          summary: 'Time Limit Exceeded',
          exitCode: 124,
          compileError: null,
          runtimeError: 'Execution exceeded time limit.',
          cases: [],
        });
      }

      if (execErr.code === 137) {
        return res.json({
          status: 'memory_limit_exceeded',
          summary: 'Memory Limit Exceeded',
          exitCode: 137,
          compileError: null,
          runtimeError: 'Execution exceeded memory limit.',
          cases: [],
        });
      }

      try {
        if (execErr.stdout) {
          const result = JSON.parse(execErr.stdout.trim());
          if (result.status) return res.json(result);
        }
      } catch {}

      return res.json({
        status: 'runtime_error',
        summary: 'Runtime Exception',
        exitCode: execErr.code ?? 1,
        compileError: null,
        runtimeError: execErr.stderr || execErr.message || 'Unknown runtime exception',
        cases: [],
      });
    }

  } catch (sysErr) {
    return res.status(500).json({
      status: 'internal_error',
      summary: 'Internal Execution Failure',
      exitCode: 500,
      compileError: null,
      runtimeError: sysErr.message,
      cases: [],
    });
  } finally {
    // 5. Cleanup
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`CodeRank Compiler Service listening on port ${PORT}`);
});
