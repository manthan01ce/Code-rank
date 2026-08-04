const fs = require('fs');
let content = fs.readFileSync('src/lib/problems.js', 'utf8');

const cppBoilerplates = {
  1: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};`,
  2: `class Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        // Write your code here\n    }\n};`,
  3: `class Solution {\npublic:\n    bool isPalindrome(int x) {\n        // Write your code here\n        return false;\n    }\n};`,
  4: `class Solution {\npublic:\n    vector<string> fizzBuzz(int n) {\n        // Write your code here\n        return {};\n    }\n};`,
  5: `class Solution {\npublic:\n    int singleNumber(vector<int>& nums) {\n        // Write your code here\n        return 0;\n    }\n};`,
  6: `class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        // Write your code here\n        return false;\n    }\n};`,
  7: `class Solution {\npublic:\n    int fib(int n) {\n        // Write your code here\n        return 0;\n    }\n};`,
  8: `class Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        // Write your code here\n        return false;\n    }\n};`,
  9: `class Solution {\npublic:\n    int lengthOfLastWord(string s) {\n        // Write your code here\n        return 0;\n    }\n};`,
  10: `class Solution {\npublic:\n    int addDigits(int num) {\n        // Write your code here\n        return 0;\n    }\n};`
};

for (let i = 1; i <= 10; i++) {
  // We match the block containing `boilerplates: { python: ... }` and append `cpp: ...` to it.
  const regex = new RegExp(`(id:\\s*${i},.*?boilerplates:\\s*\\{\\s*python:.*?)(\\n\\s*\\})`, 's');
  content = content.replace(regex, (match, p1, p2) => {
    // Avoid double injecting if already there
    if (p1.includes('cpp:')) return match;
    return p1 + `,\n      cpp: \`${cppBoilerplates[i]}\`` + p2;
  });
}

fs.writeFileSync('src/lib/problems.js', content);
console.log('Updated problems.js successfully.');
