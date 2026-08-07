const { execSync } = require('child_process');

const DAEMONS = [
  { name: 'coderank-cpp-daemon', image: 'coderank-cpp:latest' },
  { name: 'coderank-c-daemon', image: 'coderank-c:latest' },
  { name: 'coderank-java-daemon', image: 'coderank-java:latest' },
  { name: 'coderank-python-daemon', image: 'coderank-python:latest' },
  { name: 'coderank-javascript-daemon', image: 'coderank-javascript:latest' }
];

console.log('Starting persistent execution daemons...');

for (const d of DAEMONS) {
  try {
    // Check if running
    const status = execSync(`docker ps -a --format "{{.Names}}" --filter "name=${d.name}"`).toString().trim();
    if (status === d.name) {
      console.log(`[INFO] Restarting existing daemon: ${d.name}`);
      execSync(`docker rm -f ${d.name}`);
    }
    
    console.log(`[INFO] Starting daemon: ${d.name} using image ${d.image}`);
    // Run container infinitely
    execSync(`docker run -d --name ${d.name} --network none ${d.image} tail -f /dev/null`);
    console.log(`[SUCCESS] Started ${d.name}`);
  } catch (err) {
    console.error(`[ERROR] Failed to start ${d.name}: ${err.message}`);
  }
}

console.log('All daemons started successfully.');
