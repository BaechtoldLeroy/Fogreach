// Unit test entry point. Wraps `node --test` so the user has a single command.
//
// Usage:
//   node tools/runTests.js
//
// For the full test suite (unit + smoke):
//   node tools/runTests.js && node tools/testGame.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');
const testFiles = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

if (testFiles.length === 0) {
  console.error('No test files found in tests/');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
