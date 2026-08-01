// Checks that the repo-root package.json stays in sync with chat/package.json
// for the two fields Vercel's build depends on: "packageManager" (Corepack
// activation) and the "next" dependency version (framework detection).
// The root package.json only exists to satisfy Vercel's checks that read the
// repo root instead of chat/ - if these drift apart, Vercel could silently
// pin the wrong pnpm version or fail to detect Next.js again.
//
// Usage:
//   node check-package-sync.js
//
// Exits 0 if both fields match, exits 1 with a clear error otherwise.

const fs = require('fs');
const path = require('path');

function readJson(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function fail(message) {
  console.error(`check-package-sync failed: ${message}`);
  process.exit(1);
}

const root = readJson('package.json');
const chat = readJson('chat/package.json');

function stripHash(packageManager) {
  return packageManager && packageManager.split('+')[0];
}

const rootPackageManager = stripHash(root.packageManager);
const chatPackageManager = stripHash(chat.packageManager);

if (rootPackageManager !== chatPackageManager) {
  fail(
    `"packageManager" mismatch between package.json and chat/package.json.\n` +
      `  root package.json:       ${root.packageManager}\n` +
      `  chat/package.json:       ${chat.packageManager}`
  );
}

const rootNextVersion = root.dependencies && root.dependencies.next;
const chatNextVersion = chat.dependencies && chat.dependencies.next;

if (rootNextVersion !== chatNextVersion) {
  fail(
    `"next" dependency version mismatch between package.json and chat/package.json.\n` +
      `  root package.json:       ${rootNextVersion}\n` +
      `  chat/package.json:       ${chatNextVersion}`
  );
}

console.log(
  `check-package-sync passed: packageManager (${rootPackageManager}) and next (${rootNextVersion}) match.`
);
process.exit(0);
