import { runCpp } from './src/lib/execution/runCpp.js';
import { STATIC_PROBLEMS } from './src/lib/problems.js';

async function test() {
    console.log('Testing C++ compiler engine...');
    const problem = STATIC_PROBLEMS['1']; // Two Sum
    
    const code = `
class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        for(size_t i=0; i<nums.size(); ++i) {
            for(size_t j=i+1; j<nums.size(); ++j) {
                if(nums[i] + nums[j] == target) return {(int)i, (int)j};
            }
        }
        return {};
    }
};
`;

    const runnerTestCases = problem.testCases.map((tc) => ({
      args: tc.args || [],
      kwargs: tc.kwargs || {},
      expected: tc.expected,
    }));

    const result = await runCpp({ code, problem, testCases: runnerTestCases });
    console.log(JSON.stringify(result, null, 2));
}

test();
