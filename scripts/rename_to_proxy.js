import fs from 'fs';
try {
  fs.copyFileSync('src/middleware.js', 'src/proxy.js');
  fs.unlinkSync('src/middleware.js');
  console.log('Renamed src/middleware.js back to src/proxy.js to follow Next.js conventions.');
} catch (e) {
  console.error(e);
}
