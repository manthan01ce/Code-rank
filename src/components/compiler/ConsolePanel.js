'use client';

import { useState } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';

export default function ConsolePanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('testcase');
  const [activeCase, setActiveCase] = useState(1);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-sm font-sans">
      {/* Console Header Tabs */}
      <div className="flex items-center justify-between bg-[#282828] px-2 shrink-0">
        <div className="flex items-center">
          <button 
            onClick={() => setActiveTab('testcase')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'testcase' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors`}
          >
            <CheckCircle size={14} className={activeTab === 'testcase' ? 'text-emerald-400' : 'text-gray-500'} />
            Testcase
          </button>
          <button 
            onClick={() => setActiveTab('result')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'result' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors`}
          >
            <XCircle size={14} className={activeTab === 'result' ? 'text-red-400' : 'text-gray-500'} />
            Test Result
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c3c3c] rounded-md transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Console Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e]">
        {activeTab === 'testcase' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => setActiveCase(num)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeCase === num ? 'bg-[#3c3c3c] text-white' : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#333]'}`}
                >
                  Case {num}
                </button>
              ))}
            </div>
            
            <div className="space-y-3 font-mono text-sm">
              <div>
                <div className="text-gray-400 mb-1">nums =</div>
                <div className="bg-[#2d2d2d] text-gray-200 px-3 py-2 rounded-lg border border-[#3c3c3c]">[2,7,11,15]</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">target =</div>
                <div className="bg-[#2d2d2d] text-gray-200 px-3 py-2 rounded-lg border border-[#3c3c3c]">9</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
            You must run your code first.
          </div>
        )}
      </div>
    </div>
  );
}
