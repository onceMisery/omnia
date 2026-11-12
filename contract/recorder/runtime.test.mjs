import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyBaselineTree, waitForUpstream } from './runtime.mjs';

test('baseline verification refuses outside directories and altered source', () => {
  const root = mkdtempSync(join(tmpdir(), 'omnia-recorder-test-'));
  try {
    mkdirSync(join(root, 'allowed'));
    assert.throws(() => verifyBaselineTree(root, join(root, 'allowed')), /outside/);
    const directory = join(root, 'baseline');
    mkdirSync(directory);
    writeFileSync(join(directory, 'omnia-baseline.json'), JSON.stringify({ baseline: 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c',
      platform: process.platform, arch: process.arch, hashes: { 'server.js': 'not-the-hash' } }));
    writeFileSync(join(directory, 'server.js'), 'altered');
    assert.throws(() => verifyBaselineTree(directory, root), /hash/);
  } finally { rmSync(root, { recursive: true }); }
});

test('early request rejection is observed while awaiting upstream arrival', async () => {
  await assert.rejects(waitForUpstream(Promise.reject(new Error('connection failed')), new Promise(() => {})), /connection failed/);
});

test('arrival wait leaves a later response body for the recording owner', async () => {
  let respond;
  const pending = new Promise(resolve => { respond = resolve; });
  await waitForUpstream(pending, Promise.resolve());
  const response = new Response('record this');
  respond(response);
  await pending;
  assert.equal(await response.text(), 'record this');
});

test('baseline network adapter confines the real listen call to IPv4 loopback', () => {
  const preload = fileURLToPath(new URL('./loopback.cjs', import.meta.url));
  const result = execFileSync(process.execPath, ['--require', preload, '-e',
    "const s = require('node:http').createServer(); s.listen(0, () => { console.log(s.address().address); s.close(); });"], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.trim(), '127.0.0.1');
});
