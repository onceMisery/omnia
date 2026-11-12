import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

export function assertInside(directory, root) {
  const child = relative(realpathSync(root), realpathSync(directory));
  assert(child && !child.startsWith('..') && !isAbsolute(child), 'Recorder directory is outside its isolated root');
}

export function verifyBaselineTree(directory, root) {
  assertInside(directory, root);
  const provenance = JSON.parse(readFileSync(join(directory, 'omnia-baseline.json'), 'utf8'));
  assert.equal(provenance.baseline, 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c');
  assert.equal(provenance.platform, process.platform);
  assert.equal(provenance.arch, process.arch);
  assert(Object.hasOwn(provenance.hashes, 'server.js'), 'Missing server source hash');
  for (const [path, hash] of Object.entries(provenance.hashes)) {
    const file = join(directory, path);
    assertInside(file, directory);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash, `Frozen hash mismatch: ${path}`);
  }
  return provenance;
}

export async function waitForUpstream(request, arrival) {
  // Attach a rejection handler immediately, before the first await. A response
  // ending before the mock receives it also signals a broken interrupt scenario.
  await Promise.race([arrival, request.then(response => {
    throw new Error(`Request ended before upstream arrival: ${response.status}`);
  })]);
}
