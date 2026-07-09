const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir);
if (!fs.existsSync(backendDir)) fs.mkdirSync(backendDir);

const keepAtRoot = ['.git', '.gemini', '.kiro', 'backend', 'frontend', 'restructure.cjs', '.env.local'];

const items = fs.readdirSync(rootDir);
for (const item of items) {
  if (keepAtRoot.includes(item)) continue;
  
  const oldPath = path.join(rootDir, item);
  const newPath = path.join(frontendDir, item);
  
  try {
    fs.renameSync(oldPath, newPath);
    console.log(`Moved ${item} to frontend/`);
  } catch (err) {
    console.error(`Failed to move ${item}:`, err);
  }
}

// Copy env to backend and frontend
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  fs.copyFileSync(envLocalPath, path.join(frontendDir, '.env.local'));
  fs.copyFileSync(envLocalPath, path.join(backendDir, '.env'));
  fs.renameSync(envLocalPath, path.join(rootDir, '.env.local.backup'));
}

console.log('Restructuring complete.');
