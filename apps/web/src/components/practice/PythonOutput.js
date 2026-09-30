'use client';

import { Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function PythonOutput({ result, isRunning, dockerStatus, onClear }) {
  const loadingText = 'Executing code...';

  // Status mapping colors & labels
  const STATUS_CONFIG = {
    success: { label: 'Success', color: 'text-[#2cbb5d]' },
    runtime_error: { label: 'Runtime Error', color: 'text-red-500' },
    time_limit_exceeded: { label: 'Time Limit Exceeded', color: 'text-red-500' },
    memory_limit_exceeded: { label: 'Memory Limit Exceeded', color: 'text-red-500' },
    internal_error: { label: 'Internal Server Error', color: 'text-red-500' },
  };

  const statusInfo = result?.status ? (STATUS_CONFIG[result.status] || { label: result.status, color: 'text-red-500' }) : null;

  return (
    <div className="h-full flex flex-col bg-[#282828] border border-[#3e3e42] rounded-lg overflow-hidden font-sans text-sm text-gray-300">
      {/* Console Header Bar */}
      <div className="flex items-center justify-between bg-[#333333] border-b border-[#3e3e42] shrink-0 h-10 px-4 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#2cbb5d]" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-200">Console Output</span>
        </div>
        
        {/* Docker Indicator */}
        <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wide">
          {dockerStatus === 'checking' && <span className="text-gray-500 animate-pulse">Checking Docker...</span>}
          {dockerStatus === 'healthy' && <span className="text-[#2cbb5d] flex items-center gap-1.5"><CheckCircle size={12}/> Docker Ready</span>}
          {dockerStatus === 'error' && <span className="text-red-400 flex items-center gap-1.5"><XCircle size={12}/> Docker Offline</span>}
        </div>
      </div>

      {/* Main Console Content */}
      <div className="flex-1 overflow-y-auto p-5 bg-[#282828]">
        {isRunning ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
            <Loader2 size={28} className="animate-spin text-[#007acc]" />
            <span className="font-medium tracking-wide text-sm">{loadingText}</span>
          </div>
        ) : !result ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 italic select-none">
            Run your code to see the execution output here.
          </div>
        ) : (
          <div className="space-y-5 max-w-full">
            {/* Status Statistics Bar */}
            <div className="flex items-center justify-between border-b border-[#3e3e42] pb-3 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 uppercase font-semibold">Status:</span>
                <span className={`text-[15px] font-bold tracking-wide ${statusInfo?.color || 'text-white'}`}>
                  {statusInfo?.label || 'Finished'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {result.timeMs !== undefined && (
                  <span>Time: <span className="text-gray-300 font-mono">{result.timeMs} ms</span></span>
                )}
                {result.exitCode !== undefined && (
                  <span>Exit Code: <span className={result.exitCode === 0 ? 'text-gray-300 font-mono' : 'text-red-400 font-mono'}>{result.exitCode}</span></span>
                )}
              </div>
            </div>

            {/* Standard Output Console */}
            {result.stdout && (
              <div>
                <div className="text-xs text-gray-400 mb-1.5 uppercase tracking-wider font-semibold select-none">Stdout</div>
                <pre className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-4 font-mono text-sm text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
                  {result.stdout}
                </pre>
              </div>
            )}

            {/* Standard Error Console */}
            {result.stderr && (
              <div>
                <div className="text-xs text-red-400/80 mb-1.5 uppercase tracking-wider font-semibold select-none">Stderr / Traceback</div>
                <pre className="bg-[#1a1112] border border-[#4a2226] rounded-lg p-4 font-mono text-sm text-red-400 whitespace-pre-wrap leading-relaxed select-text">
                  {result.stderr}
                </pre>
              </div>
            )}
            
            {/* Empty Output Warning */}
            {!result.stdout && !result.stderr && result.status === 'success' && (
              <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg p-4 font-mono text-sm text-gray-500 italic select-none">
                (Process finished with no console output generated)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
