import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceHarness, FixedDate, fixedTimeMs } from './source-fixture-support.mjs';

const backend = 'VCPToolBox';
const streamPath = 'modules/handlers/streamHandler.js';

export async function runBoundaryFixture(runner, input) {
  const h = sourceHarness();
  if (runner === 'sse-timers') {
    const chunks = [];
    const scheduled = [];
    const cleared = [];
    const callbacks = new Map();
    let destroyed = false;
    let settled = false;
    const res = { writableEnded: input.closed ?? false, destroyed: false, write: value => chunks.push(value) };
    h.evaluate(`(function(){let keepAliveTimer; let chunkIdleTimer; let streamAborted = false;
      ${h.source(backend, streamPath, 191, 191)}
      ${h.source(backend, streamPath, 297, 338)}
    })()`, { res, Date: FixedDate, originalBody: { model: 'fixture-model' }, abortController: null,
      aiResponse: { body: { destroyed: false, destroy: () => { destroyed = true; } } },
      result: () => 'settled', resolve: () => { settled = true; },
      setInterval: (callback, delay) => { callbacks.set('heartbeat', callback); scheduled.push({ type: 'interval', delay }); return 'heartbeat'; },
      setTimeout: (callback, delay) => { callbacks.set('idle', callback); scheduled.push({ type: 'timeout', delay }); return 'idle'; },
      clearInterval: id => cleared.push(id), clearTimeout: id => cleared.push(id),
    });
    callbacks.get(input.fire)();
    return h.result({ scheduled, chunks, destroyed, settled, cleared });
  }
  if (runner === 'sse-forward') {
    const chunks = [];
    const observed = [];
    return h.result(h.evaluate(`(function(){let sawDone = false; let invalidPayload = false; let streamAborted = false;
      ${h.source(backend, streamPath, 376, 410)}
      return { chunks, observed, sawDone, invalidPayload, streamAborted };})()`, {
      lines: input.lines, chunks, observed, res: { write: value => chunks.push(value) },
      observePayload: value => observed.push(value), appendDelta() {}, writeClientReasoningCloseChunk() {},
      reasoningToContentEnabled: false,
    }));
  }
  if (runner === 'sse-length') {
    const chunks = [];
    let ended = false;
    h.evaluate(h.source(backend, streamPath, 788, 799), { Date: FixedDate,
      recursionDepth: input.depth, maxRecursion: 5,
      res: { write: (value, callback) => { chunks.push(value); callback?.(); }, end: () => { ended = true; } },
    });
    return h.result({ chunks, ended });
  }
  if (runner === 'bearer') {
    let handler;
    let next = false;
    const response = { status: 200, headers: {}, body: null };
    h.evaluate(h.source(backend, 'server.js', 859, 883), {
      app: { use: fn => { handler = fn; } }, serverKey: input.key,
    });
    const res = { status: value => { response.status = value; return res; }, json: value => { response.body = value; return res; } };
    handler({ path: input.path, headers: { authorization: input.authorization } }, res, () => { next = true; });
    return h.result({ ...response, next });
  }
  if (runner === 'admin-auth') {
    const loginAttempts = new Map();
    const noCredentialAccess = new Map();
    const tempBlocks = new Map();
    const middleware = h.evaluate(`(function(){
      ${h.source(backend, 'server.js', 134, 138)}
      ${h.source(backend, 'server.js', 665, 838)}
      return adminAuth;})()`, { Date: FixedDate, Buffer, loginAttempts, noCredentialAccess, tempBlocks,
      ADMIN_USERNAME: input.configured === false ? '' : 'admin', ADMIN_PASSWORD: 'fixture-password',
      // Header decoding is an external basic-auth dependency seam; the original
      // cookie decoder and the actual credential decision remain under test.
      basicAuth: request => request.credentials ?? null,
    });
    const results = [];
    for (const operation of input.requests) {
      const result = { status: 200, headers: {}, body: null, next: false };
      const res = { status: value => { result.status = value; return res; },
        json: value => { result.body = value; return res; }, send: value => { result.body = value; return res; },
        setHeader: (key, value) => { result.headers[key] = value; },
        redirect: value => { result.status = 302; result.headers.Location = value; },
      };
      for (let i = 0; i < (operation.count ?? 1); i++) {
        middleware({ path: operation.path, headers: operation.headers ?? {}, credentials: operation.credentials,
          ip: '192.0.2.100' }, res, () => { result.next = true; });
      }
      results.push({ ...result, wrongCredentialCount: loginAttempts.get('192.0.2.100')?.count ?? 0,
        missingCredentialCount: noCredentialAccess.get('192.0.2.100')?.count ?? 0,
        blockedForMs: tempBlocks.has('192.0.2.100') ? tempBlocks.get('192.0.2.100').expires - fixedTimeMs : 0 });
    }
    return h.result(results);
  }
  if (runner === 'static-order') {
    assert.equal(new Set(input.anchors.map(anchor => `${anchor.repository ?? backend}:${anchor.path}`)).size, 1,
      'static source order requires anchors in one source file');
    const locations = input.anchors.map(anchor => {
      const source = h.source(anchor.repository ?? backend, anchor.path, anchor.startLine, anchor.endLine);
      const index = source.indexOf(anchor.text);
      return { id: anchor.id, found: index >= 0,
        line: index < 0 ? null : anchor.startLine + source.slice(0, index).split('\n').length - 1 };
    });
    const positions = new Map([...locations].sort((left, right) => left.line - right.line)
      .map((value, index) => [value.id, index]));
    const complete = input.order.length === locations.length && new Set(input.order).size === locations.length
      && input.order.every(id => positions.has(id)) && locations.every(value => value.found);
    const ordered = complete && input.order.every((id, index) => positions.get(id) === index);
    return h.result({ locations, complete, ordered });
  }
  if (runner === 'static-occurrences') {
    return h.result(input.sources.map(reference => {
      const source = h.source(reference.repository, reference.path, reference.startLine, reference.endLine);
      return { path: reference.path, occurrences: source.split(input.text).length - 1 };
    }));
  }
  if (runner === 'm1-mapping') {
    // Upstream source establishes the slots. Their M1 implementation/deferred
    // annotations belong to Omnia's approved contract, not to upstream code.
    h.source(backend, 'modules/chatCompletionHandler.js', 770, 1523);
    const contract = readFileSync(new URL('../../docs/Omnia-M0M1-协议契约.md', import.meta.url), 'utf8');
    const start = contract.indexOf('**M1 裁剪映射**');
    assert.ok(start >= 0, 'M1 mapping authority section missing');
    const section = contract.slice(start).split('\n---')[0];
    const rows = [...section.matchAll(/^\| (\d[^|]*|其余) \| ([^|]+) \|$/gm)]
      .map(match => ({ step: match[1].trim(), handling: match[2].trim() }));
    assert.ok(rows.length > 0, 'M1 mapping authority table missing');
    const complete = input.candidate.length === rows.length
      && new Set(input.candidate.map(item => item.step)).size === rows.length;
    const checks = input.candidate.map(item => ({ step: item.step, mode: item.mode,
      supported: rows.some(row => row.step === item.step && row.handling.includes(item.sourcePhrase)) }));
    return h.result({ authority: 'docs/Omnia-M0M1-协议契约.md §10 M1 裁剪映射', rows, complete,
      accepted: complete && checks.every(check => check.supported), checks });
  }
  if (runner === 'frontend-settle') {
    let callback;
    let timerMs;
    let cleared = false;
    const settle = h.evaluate(`(function(){${h.source('VCPChat', 'modules/chatManager.js', 12, 16)}
      return promise => settlesWithin(promise, INTERRUPT_SETTLE_MS);})()`, {
      setTimeout: (fn, ms) => { callback = fn; timerMs = ms; return 1; }, clearTimeout: () => { cleared = true; },
    });
    const upstream = input.completed ? Promise.resolve() : new Promise(() => {});
    const output = settle(upstream);
    await Promise.resolve();
    if (!input.completed) callback();
    return h.result({ settled: await output, timerMs, cleared });
  }
  throw new Error(`Unknown boundary fixture runner: ${runner}`);
}
