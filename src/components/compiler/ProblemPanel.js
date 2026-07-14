'use client';

export default function ProblemPanel() {
  return (
    <div className="h-full w-full bg-[#1e1e1e] text-gray-300 overflow-y-auto p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">1. Two Sum</h1>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium">Easy</span>
          <span className="text-gray-400 text-sm">Arrays</span>
          <span className="text-gray-400 text-sm">Hash Table</span>
        </div>

        <div className="prose prose-invert prose-sm max-w-none mb-8">
          <p>
            Given an array of integers <code>nums</code> and an integer <code>target</code>, return 
            indices of the two numbers such that they add up to <code>target</code>.
          </p>
          <p>
            You may assume that each input would have <strong>exactly one solution</strong>, and you 
            may not use the same element twice.
          </p>
          <p>
            You can return the answer in any order.
          </p>
        </div>

        <div className="mb-8">
          <h3 className="text-white font-semibold mb-3">Example 1:</h3>
          <div className="bg-[#2d2d2d] rounded-lg p-4 font-mono text-sm">
            <div><span className="text-gray-500">Input:</span> nums = [2,7,11,15], target = 9</div>
            <div><span className="text-gray-500">Output:</span> [0,1]</div>
            <div><span className="text-gray-500">Explanation:</span> Because nums[0] + nums[1] == 9, we return [0, 1].</div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-white font-semibold mb-3">Example 2:</h3>
          <div className="bg-[#2d2d2d] rounded-lg p-4 font-mono text-sm">
            <div><span className="text-gray-500">Input:</span> nums = [3,2,4], target = 6</div>
            <div><span className="text-gray-500">Output:</span> [1,2]</div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-white font-semibold mb-3">Constraints:</h3>
          <ul className="list-disc list-inside text-sm space-y-2 text-gray-400">
            <li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>
            <li><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li>
            <li><code>-10<sup>9</sup> &lt;= target &lt;= 10<sup>9</sup></code></li>
            <li><strong>Only one valid answer exists.</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
