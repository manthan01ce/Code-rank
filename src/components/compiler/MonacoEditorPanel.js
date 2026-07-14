'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Code2, Settings, Maximize2, RotateCcw } from 'lucide-react';

export default function MonacoEditorPanel() {
  const [code, setCode] = useState('def twoSum(nums, target):\n    # Write your code here\n    pass');

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] font-sans relative">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 bg-[#282828] border-b border-[#3c3c3c] shrink-0 h-11">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-emerald-400" />
          <select className="bg-[#1e1e1e] text-xs text-white px-2 py-1 rounded border border-[#3c3c3c] outline-none hover:border-gray-500 transition-colors cursor-pointer">
            <option value="python">Python 3</option>
            <option value="cpp" disabled>C++</option>
            <option value="java" disabled>Java</option>
          </select>
        </div>
        
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors" title="Reset Code">
            <RotateCcw size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors" title="Settings">
            <Settings size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors" title="Fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative pt-2">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 24,
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            }
          }}
        />
      </div>
    </div>
  );
}
