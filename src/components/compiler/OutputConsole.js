'use client';

export default function OutputConsole() {
  return (
    <div className="h-full w-full bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col font-sans">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <span className="text-sm font-medium text-white">Output</span>
        <button className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
          Clear
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {/* Placeholder for output states */}
        <div className="text-gray-400 italic">
          Run your code to see the output here.
        </div>
      </div>
    </div>
  );
}
