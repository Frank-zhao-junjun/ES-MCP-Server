const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = __dirname;
const files = fs.readdirSync(testDir)
  .filter((f) => f.endsWith('.test.js') && !f.includes('.sap.'))
  .sort();

let failed = 0;

for (const file of files) {
  console.log(`\n=== ${file} ===\n`);
  const result = spawnSync(process.execPath, [path.join(testDir, file)], {
    stdio: 'inherit',
    cwd: path.join(testDir, '..'),
  });
  if (result.status !== 0) failed++;
}

console.log(`\n${files.length} test file(s), ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
