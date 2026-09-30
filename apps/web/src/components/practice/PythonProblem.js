'use client';

import { useState } from 'react';
import { Lock, FileText, Beaker, CheckCircle } from 'lucide-react';

export default function PythonProblem() {
  const [activeTab, setActiveTab] = useState('description');

  return (
    <div className="h-full flex flex-col bg-[#282828] rounded-lg overflow-hidden font-sans border border-[#3e3e42]">
      {/* Tab Navigation */}
      <div className="h-10 bg-[#333333] flex items-center px-2 shrink-0 overflow-x-auto hide-scrollbar border-b border-[#3e3e42]">
        <div className="flex gap-1 h-full">
          <button 
            onClick={() => setActiveTab('description')}
            className={`flex items-center gap-1.5 font-medium text-xs px-3 py-1 mt-1 rounded-t-md cursor-pointer transition-colors ${
              activeTab === 'description' ? 'text-white border-b-2 border-transparent bg-[#282828]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <FileText size={12} /> Description
          </button>
          <button 
            onClick={() => setActiveTab('editorial')}
            className={`flex items-center gap-1.5 font-medium text-xs px-3 py-1 mt-1 rounded-t-md cursor-pointer transition-colors ${
              activeTab === 'editorial' ? 'text-white border-b-2 border-transparent bg-[#282828]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Beaker size={12} /> Editorial
          </button>
          <button 
            onClick={() => setActiveTab('submissions')}
            className={`flex items-center gap-1.5 font-medium text-xs px-3 py-1 mt-1 rounded-t-md cursor-pointer transition-colors ${
              activeTab === 'submissions' ? 'text-white border-b-2 border-transparent bg-[#282828]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <CheckCircle size={12} /> Submissions
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#282828] text-[#eff1f6] text-[15px] leading-[1.6]">
        {activeTab === 'description' && (
          <div className="max-w-3xl">
            <h1 className="text-[22px] font-semibold text-white mb-3">Factorial Calculator</h1>
            <div className="flex gap-3 mb-6 items-center">
              <span className="text-[#00b8a3] bg-[#00b8a3]/10 px-2 py-0.5 rounded-full text-xs font-medium">Easy</span>
              <span className="text-gray-400 hover:text-gray-200 cursor-pointer transition-colors text-xs font-medium flex items-center gap-1">
                Math
              </span>
            </div>

            <div className="prose prose-invert prose-sm max-w-none mb-8 text-[#eff1f6]">
              <p className="mb-4">
                Write a Python script that reads an integer <code>n</code> from standard input and prints its factorial.
                The factorial of a non-negative integer <code>n</code>, denoted by <code>n!</code>, is the product of all positive integers less than or equal to <code>n</code>.
              </p>
              <p className="mb-4">
                For example, <code>5! = 5 * 4 * 3 * 2 * 1 = 120</code>.
              </p>
              <p className="mb-6">
                <strong>Note:</strong> The value of <code>0!</code> is <code>1</code>.
              </p>
            </div>

            <div className="space-y-6">
              <p className="font-semibold text-white">Example 1:</p>
              <div className="bg-[#ffffff12] rounded-lg p-4 font-mono text-sm text-[#eff1f6] border-l-2 border-[#ffffff33]">
                <div><strong className="text-gray-400 text-xs uppercase">Input:</strong> 5</div>
                <div className="mt-1"><strong className="text-gray-400 text-xs uppercase">Output:</strong> 120</div>
              </div>

              <p className="font-semibold text-white">Example 2:</p>
              <div className="bg-[#ffffff12] rounded-lg p-4 font-mono text-sm text-[#eff1f6] border-l-2 border-[#ffffff33]">
                <div><strong className="text-gray-400 text-xs uppercase">Input:</strong> 0</div>
                <div className="mt-1"><strong className="text-gray-400 text-xs uppercase">Output:</strong> 1</div>
              </div>

              <div className="mt-10 pt-4">
                <p className="font-semibold text-white mb-3">Constraints:</p>
                <ul className="list-disc list-inside text-sm space-y-1.5 text-[#eff1f6]">
                  <li className="font-mono"><code>0 &lt;= n &lt;= 20</code></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editorial' && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-4">
            <Lock size={32} className="text-gray-500 mb-2" />
            <h3 className="text-lg font-semibold text-white">Editorial Locked</h3>
            <p className="text-sm max-w-sm">
              You need a premium subscription to view the official editorial and solution approaches for this problem.
            </p>
            <button className="mt-2 bg-[#ffa116] hover:bg-[#ffb03a] text-black font-semibold text-sm px-4 py-2 rounded-md transition-colors">
              Subscribe to Premium
            </button>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <div className="mb-4">
              <CheckCircle size={32} className="text-[#3e3e42]" />
            </div>
            <p className="text-sm">You haven't submitted any solutions for this problem yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
