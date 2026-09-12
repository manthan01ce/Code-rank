'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import PythonEditor from './PythonEditor';
import PythonOutput from './PythonOutput';
import { Code2, ArrowLeft, RotateCcw } from 'lucide-react';

const DEFAULT_CODE = `'''

Welcome to CodeRank Online.
CodeRank is an online compiler, editor, and developer workspace for Python.
Write, compile, run, and execute Python code online with standard inputs.

'''
print('Hello World')
`;

export default function PythonDashboard() {
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
        const res = await fetch('/api/practice-run');
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
      const response = await fetch('/api/practice-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, input: customInput }),
      });

      const data = await response.json();
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

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-300 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="h-12 bg-[#252525] border-b border-[#3e3e42] flex items-center justify-between px-4 shrink-0 z-10 select-none">
        <div className="flex items-center gap-4">
          <a
            href="/admin"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#3e3e42] hover:bg-[#4a4a4f] px-3 py-1 rounded-md text-sm font-medium"
          >
            <ArrowLeft size={14} /> Back
          </a>
          <div className="flex items-center gap-2 pl-4 border-l border-[#3e3e42]">
            <Code2 size={16} className="text-[#2cbb5d]" />
            <span className="text-white font-semibold text-sm tracking-wide">Python Compiler</span>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#3e3e42] hover:bg-[#4a4a4f] text-gray-300 hover:text-white rounded-md text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={11} /> Reset Code
          </button>
          <button
            onClick={handleClearConsole}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#3e3e42] hover:bg-[#4a4a4f] text-gray-300 hover:text-white rounded-md text-xs font-semibold transition-all"
          >
            Clear Console
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop Layout — uses react-resizable-panels */}
        <div className="hidden lg:block h-full p-2">
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Editor Panel */}
            <Panel defaultSize={65} minSize={40}>
              <PythonEditor
                defaultCode={DEFAULT_CODE}
                onCodeChange={handleCodeChange}
                onRun={handleRun}
                isRunning={isRunning}
                onRegisterReset={handleRegisterReset}
              />
            </Panel>

            <PanelResizeHandle className="w-1.5 mx-1 hover:bg-[#3e3e42] transition-colors cursor-col-resize flex items-center justify-center group relative z-10">
              <div className="h-8 w-1 bg-[#4a4a4f] rounded-full group-hover:bg-[#2cbb5d] transition-colors"></div>
            </PanelResizeHandle>

            {/* Right Input / Output Panel */}
            <Panel defaultSize={35} minSize={20}>
              <PanelGroup direction="vertical">
                {/* Input Panel */}
                <Panel defaultSize={38} minSize={25}>
                  <div className="h-full flex flex-col bg-[#282828] border border-[#3e3e42] rounded-lg overflow-hidden font-sans p-4">
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold select-none">
                        Input (stdin)
                      </div>
                      <div className="text-[10px] text-gray-500 italic leading-tight select-none">
                        Programs do not wait for live typing during execution; provide stdin before clicking Run.
                      </div>
                    </div>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      className="flex-1 w-full bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-3 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:border-[#4a4a4f] transition-all"
                      placeholder="Enter standard input for your program..."
                      spellCheck="false"
                    />
                  </div>
                </Panel>

                <PanelResizeHandle className="h-1.5 my-1 hover:bg-[#3e3e42] transition-colors cursor-row-resize flex items-center justify-center group relative z-10">
                  <div className="w-8 h-1 bg-[#4a4a4f] rounded-full group-hover:bg-[#2cbb5d] transition-colors"></div>
                </PanelResizeHandle>

                {/* Output Panel */}
                <Panel defaultSize={62} minSize={30}>
                  <PythonOutput
                    result={result}
                    isRunning={isRunning}
                    dockerStatus={dockerStatus}
                    onClear={handleClearConsole}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>

        {/* Mobile Layout — Stacked layout */}
        <div className="flex lg:hidden flex-col h-full gap-2 p-2 overflow-y-auto">
          <div className="h-[50%] min-h-[300px]">
            <PythonEditor
              defaultCode={DEFAULT_CODE}
              onCodeChange={handleCodeChange}
              onRun={handleRun}
              isRunning={isRunning}
              onRegisterReset={handleRegisterReset}
            />
          </div>
          <div className="min-h-[170px] flex flex-col bg-[#282828] border border-[#3e3e42] rounded-lg p-4">
            <div className="flex flex-col gap-1 mb-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                Input (stdin)
              </div>
              <div className="text-[10px] text-gray-500 italic leading-tight">
                Programs do not wait for live typing during execution; provide stdin before clicking Run.
              </div>
            </div>
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="h-24 w-full bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-3 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:border-[#4a4a4f] transition-all"
              placeholder="Enter standard input for your program..."
              spellCheck="false"
            />
          </div>
          <div className="min-h-[200px]">
            <PythonOutput
              result={result}
              isRunning={isRunning}
              dockerStatus={dockerStatus}
              onClear={handleClearConsole}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
