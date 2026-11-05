'use client';
import { practiceRequest } from '../api/practice-api';
import WorkspaceReturn from '@/components/layout/WorkspaceReturn';

import { waitForJob } from '@/lib/client/wait-for-job';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import PythonEditor from '@/features/practice/components/PythonEditor';
import PythonOutput from '@/features/practice/components/PythonOutput';
import { Code2, RotateCcw } from 'lucide-react';

const DEFAULT_CODE = `'''

Welcome to CodeRank Online.
CodeRank is an online compiler, editor, and developer workspace for Python.
Write, compile, run, and execute Python code online with standard inputs.

'''
print('Hello World')
`;

export function usePythonDashboard() {
  // Code is held in a REF, not state — prevents Monaco from remounting on change
  const codeRef = useRef(DEFAULT_CODE);

  // Reset function registered by child editor via callback
  const resetEditorRef = useRef(null);

  const [customInput, setCustomInput] = useState('');
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [dockerStatus, setDockerStatus] = useState('checking');

  // Verify Docker status on mount using our new practice-run GET method
  useEffect(() => {
    const checkDocker = async () => {
      try {
        const res = await practiceRequest();
        const data = await res.json();
        setDockerStatus(data.status === 'healthy' ? 'healthy' : 'error');
      } catch (err) {
        setDockerStatus('error');
      }
    };
    checkDocker();
  }, []);

  // Callback the child editor registers to expose its imperative reset
  const handleRegisterReset = useCallback((resetFn) => {
    resetEditorRef.current = resetFn;
  }, []);

  // Called by Monaco's onChange — just update the ref, no re-render triggered
  const handleCodeChange = useCallback((newCode) => {
    codeRef.current = newCode;
  }, []);

  const handleRun = async () => {
    const currentCode = codeRef.current;
    if (!currentCode.trim()) return;

    setIsRunning(true);
    setResult(null);

    try {
      const response = await practiceRequest( {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, input: customInput }),
      });

      let data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Execution request failed');
      if (data.jobId) {
        data = await waitForJob({ jobId: data.jobId });
        data = { ...data, status: data.success ? 'success' : 'runtime_error', timeMs: Math.round(data.runtimeMs || 0) };
      }
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        status: 'internal_error',
        stdout: '',
        stderr: `Network Error: Failed to contact execution server. ${error.message}`,
        exitCode: 500,
        timeMs: 0
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = useCallback(() => {
    if (window.confirm('Reset your compiler editor to the starter template?')) {
      if (resetEditorRef.current) {
        resetEditorRef.current();
      }
      codeRef.current = DEFAULT_CODE;
      setResult(null);
      setCustomInput('');
    }
  }, []);

  const handleClearConsole = useCallback(() => {
    setResult(null);
  }, []);


  return { codeRef, resetEditorRef, customInput, setCustomInput, result, setResult, isRunning, setIsRunning, dockerStatus, setDockerStatus, handleRegisterReset, handleCodeChange, handleRun, handleReset, handleClearConsole };
}

export { DEFAULT_CODE };
