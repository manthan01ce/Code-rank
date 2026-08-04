const fs = require('fs');
let content = fs.readFileSync('src/lib/problems.js', 'utf8');

// We want to replace `python: \`class Solution:` with `python: \`import math\\nimport collections\\nimport heapq\\nimport sys\\n\\nclass Solution:`
content = content.replace(/python:\s*`class Solution:/g, 'python: `import math\\nimport collections\\nimport heapq\\nimport sys\\n\\nclass Solution:');

fs.writeFileSync('src/lib/problems.js', content);
console.log('Updated python boilerplates with standard imports.');
