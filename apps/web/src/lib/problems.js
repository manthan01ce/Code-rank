export const STATIC_PROBLEMS = {
  '1': {
    id: 1,
    slug: 'two-sum',
    title: '1. Two Sum',
    difficulty: 'Easy',
    description:
      'Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.<br/><br/>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.<br/><br/>You can return the answer in any order.',
    constraints: [
      '2 ≤ nums.length ≤ 10⁴',
      '-10⁹ ≤ nums[i] ≤ 10⁹',
      '-10⁹ ≤ target ≤ 10⁹',
      'Only one valid answer exists.',
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'twoSum'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def twoSum(self, nums, target):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};`
    },
    solution: `class Solution:\n    def twoSum(self, nums, target):\n        mapping = {}\n        for i, num in enumerate(nums):\n            diff = target - num\n            if diff in mapping:\n                return [mapping[diff], i]\n            mapping[num] = i\n        return []`,
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].' },
      { input: 'nums = [3,3], target = 6', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 6, we return [0, 1].' }
    ],
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[1, 5, 8, 10], 15], expected: [1, 3] },
      { args: [[5, 20, 30, 5], 10], expected: [0, 3] }
    ]
  },
  '2': {
    id: 2,
    slug: 'reverse-string',
    title: '2. Reverse String',
    difficulty: 'Easy',
    description:
      'Write a function that reverses a string. The input string is given as an array of characters <code>s</code>.<br/><br/>You must do this by modifying the input array <strong>in-place</strong> with O(1) extra memory.',
    constraints: [
      '1 ≤ s.length ≤ 10⁵',
      's[i] is a printable ascii character.'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'reverseString'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def reverseString(self, s):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    void reverseString(vector<char>& s) {
        // Write your code here
    }
};`
    },
    solution: `class Solution:\n    def reverseString(self, s):\n        s.reverse()\n        return s`,
    examples: [
      { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]', explanation: 'The input list is modified in-place to contain reverse values.' },
      { input: 's = ["H","a","n","n","a","h"]', output: '["h","a","n","n","a","H"]', explanation: 'String casing is preserved.' },
      { input: 's = ["a"]', output: '["a"]', explanation: 'Single character list remains unchanged.' }
    ],
    testCases: [
      { args: [['h', 'e', 'l', 'l', 'o']], expected: ['o', 'l', 'l', 'e', 'h'] },
      { args: [['H', 'a', 'n', 'n', 'a', 'h']], expected: ['h', 'a', 'n', 'n', 'a', 'H'] },
      { args: [['a']], expected: ['a'] },
      { args: [['a', 'b']], expected: ['b', 'a'] },
      { args: [['t', 'e', 's', 't']], expected: ['t', 's', 'e', 't'] }
    ]
  },
  '3': {
    id: 3,
    slug: 'palindrome-number',
    title: '3. Palindrome Number',
    difficulty: 'Easy',
    description:
      'Given an integer <code>x</code>, return <code>true</code> if <code>x</code> is a <strong>palindrome</strong>, and <code>false</code> otherwise.',
    constraints: [
      '-2³¹ ≤ x ≤ 2³¹ - 1'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'isPalindrome'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def isPalindrome(self, x):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    bool isPalindrome(int x) {
        // Write your code here
        return false;
    }
};`
    },
    solution: `class Solution:\n    def isPalindrome(self, x):\n        if x < 0:\n            return False\n        return str(x) == str(x)[::-1]`,
    examples: [
      { input: 'x = 121', output: 'true', explanation: '121 reads as 121 from left to right and from right to left.' },
      { input: 'x = -121', output: 'false', explanation: 'From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.' },
      { input: 'x = 10', output: 'false', explanation: 'Reads 01 from right to left. Therefore it is not a palindrome.' }
    ],
    testCases: [
      { args: [121], expected: true },
      { args: [-121], expected: false },
      { args: [10], expected: false },
      { args: [0], expected: true },
      { args: [12321], expected: true }
    ]
  },
  '4': {
    id: 4,
    slug: 'fizz-buzz',
    title: '4. Fizz Buzz',
    difficulty: 'Easy',
    description:
      'Given an integer <code>n</code>, return a string array <code>answer</code> (1-indexed) where:<br/>' +
      '<ul>' +
      '<li><code>answer[i] == "FizzBuzz"</code> if <code>i</code> is divisible by 3 and 5.</li>' +
      '<li><code>answer[i] == "Fizz"</code> if <code>i</code> is divisible by 3.</li>' +
      '<li><code>answer[i] == "Buzz"</code> if <code>i</code> is divisible by 5.</li>' +
      '<li><code>answer[i] == string(i)</code> if none of the above conditions are true.</li>' +
      '</ul>',
    constraints: [
      '1 ≤ n ≤ 10⁴'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'fizzBuzz'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def fizzBuzz(self, n):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    vector<string> fizzBuzz(int n) {
        // Write your code here
        return {};
    }
};`
    },
    solution: `class Solution:\n    def fizzBuzz(self, n):\n        result = []\n        for i in range(1, n + 1):\n            if i % 3 == 0 and i % 5 == 0:\n                result.append("FizzBuzz")\n            elif i % 3 == 0:\n                result.append("Fizz")\n            elif i % 5 == 0:\n                result.append("Buzz")\n            else:\n                result.append(str(i))\n        return result`,
    examples: [
      { input: 'n = 3', output: '["1","2","Fizz"]', explanation: 'Only index 3 is divisible by 3.' },
      { input: 'n = 5', output: '["1","2","Fizz","4","Buzz"]', explanation: 'Index 3 is Fizz, index 5 is Buzz.' },
      { input: 'n = 15', output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', explanation: 'Index 15 is FizzBuzz because it is divisible by both 3 and 5.' }
    ],
    testCases: [
      { args: [3], expected: ["1", "2", "Fizz"] },
      { args: [5], expected: ["1", "2", "Fizz", "4", "Buzz"] },
      { args: [1], expected: ["1"] },
      { args: [15], expected: ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"] },
      { args: [0], expected: [] }
    ]
  },
  '5': {
    id: 5,
    slug: 'single-number',
    title: '5. Single Number',
    difficulty: 'Easy',
    description:
      'Given a <strong>non-empty</strong> array of integers <code>nums</code>, every element appears <em>twice</em> except for one. Find that single one.<br/><br/>' +
      'You must implement a solution with a linear runtime complexity and use only constant extra space.',
    constraints: [
      '1 ≤ nums.length ≤ 3 * 10⁴',
      '-3 * 10⁴ ≤ nums[i] ≤ 3 * 10⁴',
      'Each element in the array appears twice except for one element which appears only once.'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'singleNumber'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def singleNumber(self, nums):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    int singleNumber(vector<int>& nums) {
        // Write your code here
        return 0;
    }
};`
    },
    solution: `class Solution:\n    def singleNumber(self, nums):\n        result = 0\n        for num in nums:\n            result ^= num\n        return result`,
    examples: [
      { input: 'nums = [2,2,1]', output: '1', explanation: 'Number 2 appears twice, while 1 is the unique single element.' },
      { input: 'nums = [4,1,2,1,2]', output: '4', explanation: 'Pairs of 1 and 2 exist, 4 is single.' },
      { input: 'nums = [1]', output: '1', explanation: 'Only one element in the list.' }
    ],
    testCases: [
      { args: [[2, 2, 1]], expected: 1 },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
      { args: [[7, 8, 8]], expected: 7 },
      { args: [[9, 9, 12, 11, 11]], expected: 12 }
    ]
  },
  '6': {
    id: 6,
    slug: 'contains-duplicate',
    title: '6. Contains Duplicate',
    difficulty: 'Easy',
    description:
      'Given an integer array <code>nums</code>, return <code>true</code> if any value appears <strong>at least twice</strong> in the array, and return <code>false</code> if every element is distinct.',
    constraints: [
      '1 ≤ nums.length ≤ 10⁵',
      '-10⁹ ≤ nums[i] ≤ 10⁹'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'containsDuplicate'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def containsDuplicate(self, nums):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Write your code here
        return false;
    }
};`
    },
    solution: `class Solution:\n    def containsDuplicate(self, nums):\n        return len(nums) != len(set(nums))`,
    examples: [
      { input: 'nums = [1,2,3,1]', output: 'true', explanation: 'Number 1 appears at index 0 and index 3.' },
      { input: 'nums = [1,2,3,4]', output: 'false', explanation: 'All elements in the array are unique.' },
      { input: 'nums = [1,1,1,3,3,4,3,2,4,2]', output: 'true', explanation: 'Multiple elements are duplicated.' }
    ],
    testCases: [
      { args: [[1, 2, 3, 1]], expected: true },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
      { args: [[]], expected: false },
      { args: [[9, 9]], expected: true }
    ]
  },
  '7': {
    id: 7,
    slug: 'fibonacci-number',
    title: '7. Fibonacci Number',
    difficulty: 'Easy',
    description:
      'The <strong>Fibonacci numbers</strong>, commonly denoted <code>F(n)</code> form a sequence, called the <strong>Fibonacci sequence</strong>, such that each number is the sum of the two preceding ones, starting from 0 and 1.',
    constraints: [
      '0 ≤ n ≤ 30'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'fib'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def fib(self, n):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    int fib(int n) {
        // Write your code here
        return 0;
    }
};`
    },
    solution: `class Solution:\n    def fib(self, n):\n        if n <= 1:\n            return n\n        a, b = 0, 1\n        for _ in range(2, n + 1):\n            a, b = b, a + b\n        return b`,
    examples: [
      { input: 'n = 2', output: '1', explanation: 'F(2) = F(1) + F(0) = 1 + 0 = 1.' },
      { input: 'n = 3', output: '2', explanation: 'F(3) = F(2) + F(1) = 1 + 1 = 2.' },
      { input: 'n = 4', output: '3', explanation: 'F(4) = F(3) + F(2) = 2 + 1 = 3.' }
    ],
    testCases: [
      { args: [2], expected: 1 },
      { args: [3], expected: 2 },
      { args: [4], expected: 3 },
      { args: [0], expected: 0 },
      { args: [1], expected: 1 }
    ]
  },
  '8': {
    id: 8,
    slug: 'valid-anagram',
    title: '8. Valid Anagram',
    difficulty: 'Easy',
    description:
      'Given two strings <code>s</code> and <code>t</code>, return <code>true</code> if <code>t</code> is an <strong>anagram</strong> of <code>s</code>, and <code>false</code> otherwise.',
    constraints: [
      '1 ≤ s.length, t.length ≤ 5 * 10⁴',
      's and t consist of lowercase English letters.'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'isAnagram'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def isAnagram(self, s, t):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    bool isAnagram(string s, string t) {
        // Write your code here
        return false;
    }
};`
    },
    solution: `class Solution:\n    def isAnagram(self, s, t):\n        if len(s) != len(t):\n            return False\n        count = {}\n        for char in s:\n            count[char] = count.get(char, 0) + 1\n        for char in t:\n            if char not in count or count[char] == 0:\n                return False\n            count[char] -= 1\n        return True`,
    examples: [
      { input: 's = "anagram", t = "nagaram"', output: 'true', explanation: 'The characters of "nagaram" can be rearranged to "anagram".' },
      { input: 's = "rat", t = "car"', output: 'false', explanation: 'No arrangement of "car" makes "rat".' },
      { input: 's = "hello", t = "ollhe"', output: 'true', explanation: 'All characters match in count.' }
    ],
    testCases: [
      { args: ["anagram", "nagaram"], expected: true },
      { args: ["rat", "car"], expected: false },
      { args: ["a", "a"], expected: true },
      { args: ["ab", "ba"], expected: true },
      { args: ["hello", "ollhe"], expected: true }
    ]
  },
  '9': {
    id: 9,
    slug: 'length-of-last-word',
    title: '9. Length of Last Word',
    difficulty: 'Easy',
    description:
      'Given a string <code>s</code> consisting of words and spaces, return <em>the length of the last word in the string</em>.<br/><br/>A word is a maximal substring consisting of non-space characters only.',
    constraints: [
      '1 ≤ s.length ≤ 10⁴',
      's consists of only English letters and spaces.'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'lengthOfLastWord'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def lengthOfLastWord(self, s):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    int lengthOfLastWord(string s) {
        // Write your code here
        return 0;
    }
};`
    },
    solution: `class Solution:\n    def lengthOfLastWord(self, s):\n        words = s.strip().split()\n        if not words:\n            return 0\n        return len(words[-1])`,
    examples: [
      { input: 's = "Hello World"', output: '5', explanation: 'The last word is "World" which has length 5.' },
      { input: 's = "   fly me   to   the moon  "', output: '4', explanation: 'The last word is "moon" which has length 4.' },
      { input: 's = "luffy is still joyboy"', output: '6', explanation: 'The last word is "joyboy" which has length 6.' }
    ],
    testCases: [
      { args: ["Hello World"], expected: 5 },
      { args: ["   fly me   to   the moon  "], expected: 4 },
      { args: ["luffy is still joyboy"], expected: 6 },
      { args: ["a"], expected: 1 },
      { args: ["   "], expected: 0 }
    ]
  },
  '10': {
    id: 10,
    slug: 'add-digits',
    title: '10. Add Digits',
    difficulty: 'Easy',
    description:
      'Given an integer <code>num</code>, repeatedly add all its digits until the result has only one digit, and return it.',
    constraints: [
      '0 ≤ num ≤ 2³¹ - 1'
    ],
    entry: {
      type: 'class-method',
      className: 'Solution',
      methodName: 'addDigits'
    },
    boilerplates: {
      python: `import math\nimport collections\nimport heapq\nimport sys\n\nclass Solution:\n    def addDigits(self, num):\n        # Write your code here\n        pass`,
      cpp: `class Solution {
public:
    int addDigits(int num) {
        // Write your code here
        return 0;
    }
};`
    },
    solution: `class Solution:\n    def addDigits(self, num):\n        if num == 0:\n            return 0\n        return 1 + (num - 1) % 9`,
    examples: [
      { input: 'num = 38', output: '2', explanation: 'The process is: 3 + 8 = 11, 1 + 1 = 2. Since 2 has only one digit, return it.' },
      { input: 'num = 0', output: '0', explanation: '0 already has only one digit.' },
      { input: 'num = 9', output: '9', explanation: '9 already has only one digit.' }
    ],
    testCases: [
      { args: [38], expected: 2 },
      { args: [0], expected: 0 },
      { args: [9], expected: 9 },
      { args: [123], expected: 6 },
      { args: [999], expected: 9 }
    ]
  }
};

// Function signatures are shared with the C/JavaScript practice harnesses.
const cSignatures = {
  twoSum: 'int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}',
  reverseString: 'void reverseString(char* s, int sSize) {\n    // Modify s in place.\n}',
  isPalindrome: 'bool isPalindrome(int x) {\n    return false;\n}',
  fizzBuzz: 'char** fizzBuzz(int n, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}',
  singleNumber: 'int singleNumber(int* nums, int numsSize) {\n    return 0;\n}',
  containsDuplicate: 'bool containsDuplicate(int* nums, int numsSize) {\n    return false;\n}',
  fib: 'int fib(int n) {\n    return 0;\n}',
  isAnagram: 'bool isAnagram(char* s, char* t) {\n    return false;\n}',
  lengthOfLastWord: 'int lengthOfLastWord(char* s) {\n    return 0;\n}',
  addDigits: 'int addDigits(int num) {\n    return 0;\n}',
};
const jsArguments = {
  twoSum: 'nums, target', reverseString: 's', isPalindrome: 'x', fizzBuzz: 'n',
  singleNumber: 'nums', containsDuplicate: 'nums', fib: 'n', isAnagram: 's, t',
  lengthOfLastWord: 's', addDigits: 'num',
};
for (const problem of Object.values(STATIC_PROBLEMS)) {
  const method = problem.entry.methodName;
  problem.boilerplates.c = '#include <stdlib.h>\n#include <stdbool.h>\n\n' + cSignatures[method];
  problem.boilerplates.javascript = `class Solution {\n    ${method}(${jsArguments[method]}) {\n        // Write your code here.\n    }\n}`;
}
