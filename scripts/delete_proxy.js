import fs from 'fs';
try {
  fs.unlinkSync('src/proxy.js');
  console.log('src/proxy.js deleted successfully.');
} catch (e) {
  console.error(e);
}
