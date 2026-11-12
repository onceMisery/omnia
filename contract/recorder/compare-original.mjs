#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRecording } from './normalization.mjs';
import { scenarios } from './scenarios.mjs';
import { httpCases } from './http-cases.mjs';

const directory = resolve(process.argv[2] ?? 'contract/recordings/original');
const expected = fileURLToPath(new URL('./expected/', import.meta.url));
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
assert.equal(manifest.baseline, 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c');
const cases = [...httpCases, ...scenarios];
assert.deepEqual(manifest.results.map(item => item.id), cases.map(item => item.id));
for (const scenario of cases) {
  const record = JSON.parse(readFileSync(join(directory, `${scenario.id}.json`), 'utf8'));
  const baseline = JSON.parse(readFileSync(join(expected, `${scenario.id}.json`), 'utf8'));
  assert.deepEqual(normalizeRecording(record), baseline, scenario.id);
}
console.log(`${cases.length} original HTTP recordings match the checked-in baseline.`);
