'use client';

import { useState } from 'react';
import { AlignLeft, Lightbulb, MessageSquare, Clock } from 'lucide-react';

export default function ProblemPanel() {
  const [activeTab, setActiveTab] = useState('description');

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300 font-sans">
      {/* Tab Navigation */}
      <div className="flex items-center bg-[#282828] px-2 shrink-0 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('description')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'description' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors whitespace-nowrap`}
        >
          <AlignLeft size={14} /> Description
        </button>
        <button 
          onClick={() => setActiveTab('editorial')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'editorial' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors whitespace-nowrap`}
        >
          <Lightbulb size={14} /> Editorial
        </button>
        <button 
          onClick={() => setActiveTab('solutions')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'solutions' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors whitespace-nowrap`}
        >
          <MessageSquare size={14} /> Solutions
        </button>
        <button 
          onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'submissions' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-300'} transition-colors whitespace-nowrap`}
        >
          <Clock size={14} /> Submissions
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#1e1e1e]">
        {activeTab === 'description' && (
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-white mb-4">1. Two Sum</h1>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-xs font-semibold">Easy</span>
              <button className="text-gray-400 hover:text-white transition-colors bg-[#2d2d2d] hover:bg-[#3c3c3c] px-3 py-1 rounded-full text-xs font-medium">Topics</button>
              <button className="text-gray-400 hover:text-white transition-colors bg-[#2d2d2d] hover:bg-[#3c3c3c] px-3 py-1 rounded-full text-xs font-medium">Companies</button>
            </div>

            <div className="prose prose-invert prose-sm max-w-none mb-10 text-[15px] leading-relaxed text-gray-300">
              <p>
                Given an array of integers <code>nums</code> and an integer <code>target</code>, return 
                <em> indices of the two numbers such that they add up to <code>target</code></em>.
              </p>
              <p>
                You may assume that each input would have <strong>exactly one solution</strong>, and you 
                may not use the same element twice.
              </p>
              <p>
                You can return the answer in any order.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <p className="font-semibold text-white mb-3">Example 1:</p>
                <div className="bg-[#2d2d2d] rounded-lg p-4 font-mono text-sm border-l-4 border-gray-500">
                  <div className="mb-1"><span className="text-gray-400">Input:</span> <span className="text-gray-200">nums = [2,7,11,15], target = 9</span></div>
                  <div className="mb-1"><span className="text-gray-400">Output:</span> <span className="text-gray-200">[0,1]</span></div>
                  <div><span className="text-gray-400">Explanation:</span> <span className="text-gray-200">Because nums[0] + nums[1] == 9, we return [0, 1].</span></div>
                </div>
              </div>

              <div>
                <p className="font-semibold text-white mb-3">Example 2:</p>
                <div className="bg-[#2d2d2d] rounded-lg p-4 font-mono text-sm border-l-4 border-gray-500">
                  <div className="mb-1"><span className="text-gray-400">Input:</span> <span className="text-gray-200">nums = [3,2,4], target = 6</span></div>
                  <div><span className="text-gray-400">Output:</span> <span className="text-gray-200">[1,2]</span></div>
                </div>
              </div>

              <div className="mt-8">
                <p className="font-semibold text-white mb-3">Constraints:</p>
                <ul className="list-disc list-inside text-sm space-y-2 text-gray-300 bg-[#282828] p-4 rounded-lg">
                  <li className="font-mono"><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>
                  <li className="font-mono"><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li>
                  <li className="font-mono"><code>-10<sup>9</sup> &lt;= target &lt;= 10<sup>9</sup></code></li>
                  <li><strong>Only one valid answer exists.</strong></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editorial' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
            Editorial content will be available here.
          </div>
        )}
        {activeTab === 'solutions' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
            Community solutions will be available here.
          </div>
        )}
        {activeTab === 'submissions' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
            Your past submissions will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
