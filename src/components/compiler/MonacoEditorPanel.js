'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';

export default function MonacoEditorPanel() {
  const [code, setCode] = useState('def twoSum(nums, target):\n    # Write your code here\n    pass');

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
      <div className="flex items-center px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Language:</span>
          <select className="bg-[#3c3c3c] text-sm text-white px-2 py-1 rounded outline-none border-none">
            <option value="python">Python 3</option>
          </select>
        </div>
      </div>
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
          }}
        />
      </div>
    </div>
  );
}
