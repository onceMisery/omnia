import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const baselines = {
  VCPToolBox: 'a8560b0ae4e7b1a7803a88093a9ebee391e21a7c',
  VCPChat: 'c3e4855efa2b24c0578d76e17fd6c5f21857a539',
};
const sourceCache = new Map();

export function selectLines(source, startLine, endLine) {
  const lines = source.split('\n');
  assert.ok(Number.isInteger(startLine) && Number.isInteger(endLine)
    && startLine > 0 && endLine >= startLine && endLine <= lines.length,
  'invalid source line range');
  return lines.slice(startLine - 1, endLine).join('\n');
}

export function frozenSource(repository, path) {
  assert.ok(Object.hasOwn(baselines, repository), `unknown source repository: ${repository}`);
  const key = `${repository}:${path}`;
  if (!sourceCache.has(key)) {
    const environmentKey = repository === 'VCPToolBox' ? 'OMNIA_VCPTOOLBOX_SOURCE' : 'OMNIA_VCPCHAT_SOURCE';
    const repo = process.env[environmentKey] || resolve(workspace, '..', repository);
    sourceCache.set(key, execFileSync('git', ['-C', repo, 'show', `${baselines[repository]}:${path}`],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  }
  return sourceCache.get(key);
}

// Every execution records the exact upstream slice. Dependency/IO seams are
// declared by each runner; no rewritten business algorithm is evaluated here.
export function sourceHarness() {
  const sources = [];
  function source(repository, path, startLine = 1, endLine) {
    const full = frozenSource(repository, path);
    const end = endLine ?? full.split('\n').length;
    const selected = selectLines(full, startLine, end);
    const reference = { repository, commit: baselines[repository], path, startLine,
      endLine: end, sha256: createHash('sha256').update(selected).digest('hex') };
    if (!sources.some(item => JSON.stringify(item) === JSON.stringify(reference))) sources.push(reference);
    return selected;
  }
  function evaluate(code, bindings = {}) {
    return vm.runInNewContext(code, { console: { log() {}, warn() {}, error() {} },
      URL, Buffer, AbortController, setTimeout, clearTimeout, ...bindings }, { timeout: 5000 });
  }
  function commonjs(repository, path, bindings = {}) {
    const module = { exports: {} };
    evaluate(source(repository, path), { module, exports: module.exports, ...bindings });
    return module.exports;
  }
  return { source, evaluate, commonjs, result: output => ({ output: jsonValue(output), sources }) };
}

export function jsonValue(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export function assertFixture(fixture, meta, actual) {
  assert.ok(['frozen-source-execution', 'source-derived-static'].includes(meta.origin),
    'unsupported evidence origin');
  assert.deepStrictEqual(actual.sources, meta.sources, 'source provenance mismatch');
  assert.deepStrictEqual(actual.output, fixture.expected, 'output mismatch');
}

export const fixedTimeMs = 1730000000000;
export class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedTimeMs])); }
  static now() { return fixedTimeMs; }
}
