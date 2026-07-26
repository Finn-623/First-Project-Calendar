const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`Version validation failed: ${message}`);
  process.exit(1);
}

const frontendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(frontendDir, '..');

const pkgPath = path.join(frontendDir, 'package.json');
const configPath = path.join(frontendDir, 'src', 'config', 'version.config.json');

if (!fs.existsSync(pkgPath)) fail('missing frontend/package.json');
if (!fs.existsSync(configPath)) fail('missing frontend/version.config.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!pkg.version) fail('package.json missing version');
if (!config.status) fail('version.config.json missing status');

if (config.status !== 'released' && config.status !== 'development') {
  fail('status must be released or development');
}

if (config.status === 'released' && !config.releasedAt) {
  fail('released status requires releasedAt');
}

if (config.status === 'development' && config.releasedAt !== null) {
  fail('development status must use releasedAt=null');
}

const versionDocRelative = path.join('docs', 'version-updates', `v${pkg.version}.md`);
const versionDocPath = path.join(rootDir, versionDocRelative);

if (!fs.existsSync(versionDocPath)) {
  fail(`missing version document: ${versionDocRelative}`);
}

const versionDoc = fs.readFileSync(versionDocPath, 'utf8');
if (!versionDoc.includes(`# v${pkg.version}`)) {
  fail(`version document header does not match version v${pkg.version}`);
}

console.log(`Version validation passed for v${pkg.version}`);
