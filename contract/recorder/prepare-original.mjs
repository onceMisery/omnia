#!/usr/bin/env node
// Export only frozen source and the platform kernel into an isolated test tree.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseline = 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repo = resolve(process.argv[2] ?? '../VCPToolBox');
const output = resolve(process.argv[3] ?? join(root, 'target/baseline/vcptoolbox'));
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 64 * 1024 * 1024 });
const source = (path) => git('show', `${baseline}:${path}`);

if (existsSync(output)) throw new Error(`Refusing to overwrite existing baseline tree: ${output}`);
if (process.arch !== 'x64' || !['win32', 'linux', 'darwin'].includes(process.platform)) {
  throw new Error('This recorder currently needs a frozen x64 native kernel. Other hosts remain unverified.');
}
const nativeSuffix = { win32: 'win32-x64-msvc', linux: 'linux-x64-gnu', darwin: 'darwin-x64' }[process.platform];
const tracked = git('ls-tree', '-r', '--name-only', baseline).toString('utf8').trim().split('\n');
const paths = tracked.filter((path) =>
  /^[^/]+\.js$/.test(path)
  || /^(modules|routes|shared)\/.*\.(js|json)$/.test(path)
  || ['LICENSE', 'ToolConfigs/jev_tool_call_exp.json', 'TVStxt/JevToolCallDecision.txt',
    'rust-vexus-lite/index.js', 'rust-vexus-lite/package.json',
    `rust-vexus-lite/vexus-lite.${nativeSuffix}.node`].includes(path));
if (!paths.includes(`rust-vexus-lite/vexus-lite.${nativeSuffix}.node`)) {
  throw new Error(`Frozen native kernel unavailable for ${nativeSuffix}`);
}

// Keep the frozen transitive resolutions; trim only the root dependency surface.
const lock = JSON.parse(source('package-lock.json'));
const dependencyNames = ['@dqbd/tiktoken', '@napi-rs/canvas', 'axios', 'basic-auth',
  'better-sqlite3', 'chinese-lunar-calendar', 'chokidar', 'cors', 'dayjs', 'dotenv',
  'express', 'https-proxy-agent', 'mime-types', 'multer', 'node-fetch', 'node-schedule',
  'pm2', 'tar', 'unzipper', 'ws'];
const dependencies = Object.fromEntries(dependencyNames.map((name) => {
  const version = lock.packages[`node_modules/${name}`]?.version;
  if (!version) throw new Error(`Missing frozen dependency: ${name}`);
  return [name, version];
}));
const manifest = { name: 'omnia-frozen-server-fixture', version: '0.0.0', private: true,
  license: 'CC-BY-NC-SA-4.0', dependencies };
lock.name = manifest.name;
lock.version = manifest.version;
lock.packages[''] = manifest;

mkdirSync(output, { recursive: true });
const hashes = {};
for (const path of paths) {
  const bytes = source(path);
  mkdirSync(dirname(join(output, path)), { recursive: true });
  writeFileSync(join(output, path), bytes);
  hashes[path] = createHash('sha256').update(bytes).digest('hex');
}
for (const directory of ['Agent', 'TVStxt', 'dailynote', 'knowledge', 'config', 'ToolConfigs',
  'Plugin/EmojiListGenerator/generated_lists', '.home', '.tmp']) {
  mkdirSync(join(output, directory), { recursive: true });
}
writeFileSync(join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(output, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
writeFileSync(join(output, 'omnia-baseline.json'), JSON.stringify({
  repository: 'lioensky/VCPToolBox', baseline, platform: process.platform, arch: process.arch,
  dependencyMode: 'frozen-lock-with-minimal-root-dependencies', hashes,
}, null, 2) + '\n');
// Verify exported bytes before any runtime or package install can execute them.
for (const [path, hash] of Object.entries(hashes)) {
  if (createHash('sha256').update(readFileSync(join(output, path))).digest('hex') !== hash) {
    throw new Error(`Export hash mismatch: ${path}`);
  }
}
console.log(`Exported ${paths.length} frozen files to ${output}`);
console.log('Install the isolated fixture dependencies with npm ci in that directory, then run record-original.mjs.');
