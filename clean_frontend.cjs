const fs = require('fs');
const path = require('path');

const frontendDir = path.join(process.cwd(), 'frontend');

// Exact list of files/folders that belong in a Next.js frontend directory
const keepList = [
  'src',
  'public',
  '.next',
  'node_modules',
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'next-env.d.ts',
  'eslint.config.mjs',
  'jsconfig.json',
  'tsconfig.json',
  '.env',
  '.env.local',
  '.gitignore'
];

function deleteRecursive(itemPath) {
  if (fs.existsSync(itemPath)) {
    if (fs.lstatSync(itemPath).isDirectory()) {
      fs.readdirSync(itemPath).forEach((file) => {
        deleteRecursive(path.join(itemPath, file));
      });
      fs.rmdirSync(itemPath);
    } else {
      fs.unlinkSync(itemPath);
    }
  }
}

fs.readdirSync(frontendDir).forEach(item => {
  if (!keepList.includes(item)) {
    console.log(`Deleting from frontend: ${item}`);
    deleteRecursive(path.join(frontendDir, item));
  }
});

console.log("Frontend folder is now perfectly clean.");
