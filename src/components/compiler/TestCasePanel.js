'use client';

import { useState } from 'react';

export default function TestCasePanel() {
  const [activeTab, setActiveTab] = useState('testcases');
  const [activeCase, setActiveCase] = useState(1);

  return (
    <div className="h-full w-full bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col text-sm text-gray-300">
      <div className="flex bg-[#252526] border-b border-[#3c3c3c]">
        <button 
          onClick={() => setActiveTab('testcases')}
          className={`px-4 py-2 ${activeTab === 'testcases' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'}`}
        >
          Test Cases
        </button>
        <button 
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 ${activeTab === 'custom' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'}`}
        >
          Custom Input
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'testcases' ? (
          <div>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => setActiveCase(num)}
                  className={`px-3 py-1 rounded-md transition-colors ${activeCase === num ? 'bg-[#3c3c3c] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#333]'}`}
                >
                  Case {num}
                </button>
              ))}
            </div>
            
            <div className="space-y-4 font-mono">
              <div>
                <div className="text-gray-500 mb-1">nums =</div>
                <div className="bg-[#2d2d2d] px-3 py-2 rounded-md">[2,7,11,15]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">target =</div>
                <div className="bg-[#2d2d2d] px-3 py-2 rounded-md">9</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <textarea 
              className="flex-1 w-full bg-[#2d2d2d] border border-[#3c3c3c] rounded-md p-3 text-gray-300 font-mono resize-none focus:outline-none focus:border-emerald-400"
              placeholder="Enter your custom input here..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
