import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

test('fixed source fixtures reject output drift and source provenance drift', async () => {
  const support = await import('./source-fixture-support.mjs').catch(() => null);
  assert.ok(support, 'source fixture verifier must exist');
  const fixture = { runner: 'example', input: {}, expected: { content: 'fixed' } };
  const meta = { origin: 'frozen-source-execution', sources: [{ repository: 'VCPToolBox',
    commit: 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c', path: 'example.js', startLine: 1,
    endLine: 2, sha256: 'a'.repeat(64) }] };
  const good = { output: { content: 'fixed' }, sources: meta.sources };
  assert.doesNotThrow(() => support.assertFixture(fixture, meta, good));
  assert.throws(() => support.assertFixture(fixture, meta, { ...good, output: { content: 'drift' } }), /output mismatch/);
  assert.throws(() => support.assertFixture(fixture, meta, { ...good, sources: [] }), /source provenance mismatch/);
  assert.throws(() => support.assertFixture(fixture, { ...meta, origin: 'runtime-e2e' }, good), /unsupported evidence origin/);
});

test('source slices reject an invalid range instead of silently evaluating other code', async () => {
  const support = await import('./source-fixture-support.mjs').catch(() => null);
  assert.ok(support, 'source fixture verifier must exist');
  assert.throws(() => support.selectLines('first\nsecond\n', 0, 1), /invalid source line range/);
  assert.throws(() => support.selectLines('first\nsecond\n', 2, 8), /invalid source line range/);
  assert.equal(support.selectLines('first\nsecond\n', 1, 2), 'first\nsecond');
});

test('source fixture inventory cannot pass when required fixtures are missing', async () => {
  const verifier = await import('../recorder/verify-source-fixtures.mjs').catch(() => null);
  assert.ok(verifier, 'source fixture inventory verifier must exist');
  const directory = await mkdtemp(join(tmpdir(), 'omnia-source-verifier-'));
  try {
    await assert.rejects(verifier.verifySourceFixtures(directory), /ENOENT/);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('the real CLI exits unsuccessfully for altered expected output and altered provenance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omnia-source-verifier-'));
  try {
    const fixtureDirectory = join(directory, 'c01-injection');
    await mkdir(fixtureDirectory);
    const name = 'c01-single-tool-pos';
    const accepted = new URL(`../fixtures/c01-injection/${name}.json`, import.meta.url);
    const fixture = JSON.parse(await readFile(accepted, 'utf8'));
    const meta = JSON.parse(await readFile(new URL(`../fixtures/c01-injection/${name}.meta.json`, import.meta.url), 'utf8'));
    const fixturePath = join(fixtureDirectory, `${name}.json`);
    const metaPath = join(fixtureDirectory, `${name}.meta.json`);
    const cli = fileURLToPath(new URL('../recorder/verify-source-fixtures.mjs', import.meta.url));
    const expectFailure = pattern => assert.throws(
      () => execFileSync(process.execPath, [cli, directory], { stdio: 'pipe' }),
      error => error.status !== 0 && pattern.test(error.stderr.toString()));
    await writeFile(fixturePath, JSON.stringify({ ...fixture, expected: 'corrupted expected bytes' }));
    await writeFile(metaPath, JSON.stringify(meta));
    expectFailure(/output mismatch/);
    await writeFile(fixturePath, JSON.stringify(fixture));
    meta.sources[0].sha256 = '0'.repeat(64);
    await writeFile(metaPath, JSON.stringify(meta));
    expectFailure(/source provenance mismatch/);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
