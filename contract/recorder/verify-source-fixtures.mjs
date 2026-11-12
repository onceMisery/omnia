#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases } from '../tests/source-fixture-cases.mjs';
import { assertFixture, jsonValue } from '../tests/source-fixture-support.mjs';
import { evidenceOrigin, runSourceFixture } from '../tests/source-fixture-runners.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

export async function verifySourceFixtures(root = defaultRoot) {
  assert.ok(cases.length > 0, 'source fixture inventory is empty');
  const names = new Set();
  const coverage = new Map();
  const totals = { executed: 0, static: 0, rules: 0 };
  for (const definition of cases) {
    const key = `${definition.directory}/${definition.name}`;
    assert.ok(!names.has(key), `duplicate source fixture inventory entry: ${key}`);
    names.add(key);
    const filename = join(root, definition.directory, `${definition.name}.json`);
    const fixture = JSON.parse(await readFile(filename, 'utf8'));
    const meta = JSON.parse(await readFile(filename.replace(/\.json$/, '.meta.json'), 'utf8'));
    assert.equal(fixture.schema, 'omnia-source-fixture-v1', `${key}: invalid schema`);
    assert.equal(fixture.runner, definition.runner, `${key}: runner drift`);
    assert.deepStrictEqual(fixture.input, jsonValue(definition.input), `${key}: scenario input drift`);
    assert.deepStrictEqual(meta.rules, definition.rules, `${key}: rule inventory drift`);
    assert.equal(meta.origin, evidenceOrigin(fixture.runner), `${key}: evidence origin drift`);
    assert.ok(Array.isArray(meta.sources) && meta.sources.length > 0, `${key}: missing source provenance`);
    const actual = await runSourceFixture(fixture.runner, fixture.input);
    try { assertFixture(fixture, meta, actual); }
    catch (error) { throw new Error(`${key}: ${error.message}`, { cause: error }); }
    totals[meta.origin === 'source-derived-static' ? 'static' : 'executed']++;
    const polarity = definition.name.endsWith('-pos') ? 'pos' : definition.name.endsWith('-neg') ? 'neg' : null;
    assert.ok(polarity, `${key}: missing scenario polarity`);
    for (const rule of meta.rules) {
      if (!coverage.has(rule)) coverage.set(rule, new Set());
      coverage.get(rule).add(polarity);
    }
  }
  for (const [rule, polarities] of coverage) assert.equal(polarities.size, 2, `${rule}: positive/negative coverage missing`);
  totals.rules = coverage.size;
  return totals;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const totals = await verifySourceFixtures(process.argv[2] ? resolve(process.argv[2]) : defaultRoot);
  console.log(`Verified ${totals.executed} frozen-source execution fixtures and ${totals.static} static evidence fixtures; ${totals.rules} rules have positive/negative cases.`);
}
