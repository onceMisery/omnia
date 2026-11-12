#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { scenarios, pluginSource } from './scenarios.mjs';
import { httpCases } from './http-cases.mjs';
import { assertInside, verifyBaselineTree, waitForUpstream } from './runtime.mjs';

const directory = resolve(process.argv[2] ?? 'target/baseline/vcptoolbox');
const output = resolve(process.argv[3] ?? 'contract/recordings/original');
const root = fileURLToPath(new URL('../../', import.meta.url));
const provenance = verifyBaselineTree(directory, join(root, 'target/baseline'));
assert(existsSync(join(directory, 'node_modules')), 'Run npm ci in the exported baseline first');
mkdirSync(output, { recursive: true });
assertInside(output, join(root, 'contract/recordings'));
assert.equal(readdirSync(output).length, 0, 'Refusing nonempty recording output; select a new run directory');
const key = randomBytes(24).toString('hex');
const cancellation = new AbortController();
const cancel = () => cancellation.abort(new Error('Recording cancelled'));
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
const requests = new Map();
const arrivals = new Map();
const upstreamClosures = new Map();
const byModel = new Map(scenarios.map(scenario => [scenario.id, scenario]));

const mock = createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ object: 'list', data: [] }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    const scenario = byModel.get(body.model);
    assert(scenario, `Unexpected mock model: ${body.model}`);
    const calls = requests.get(scenario.id);
    calls.push(body);
    arrivals.get(scenario.id)?.();
    if (scenario.interrupt) {
      response.once('close', () => upstreamClosures.get(scenario.id)?.());
      return; // Interrupt must close this deliberately pending fetch.
    }
    const text = scenario.reply && (calls.length === 1 || scenario.repeat)
      ? scenario.reply : `fixture-complete:${scenario.id}`;
    response.setHeader('content-type', body.stream ? 'text/event-stream' : 'application/json');
    if (!body.stream) {
      response.end(JSON.stringify({ id: `synthetic-${scenario.id}`, object: 'chat.completion', created: 1,
        model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }));
      return;
    }
    const chunk = (content, reason = null) => `data: ${JSON.stringify({ id: `synthetic-${scenario.id}`,
      object: 'chat.completion.chunk', created: 1, model: body.model,
      choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason: reason }] })}\n\n`;
    // Split even UTF-8 code points across transport writes; the response remains valid SSE.
    const wire = Buffer.from(chunk(text.slice(0, 17)) + chunk(text.slice(17)) + chunk(null, 'stop') + 'data: [DONE]\n\n');
    for (let offset = 0; offset < wire.length; offset += 11) response.write(wire.subarray(offset, offset + 11));
    response.end();
  } catch (error) {
    response.writeHead(500).end(JSON.stringify({ error: error.message }));
  }
});
let child;
let exited;
let log;
let manifest;
try {
mock.listen(0, '127.0.0.1');
await once(mock, 'listening');
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const config = {
  PORT: String(port), API_URL: `http://127.0.0.1:${mock.address().port}`, API_Key: 'synthetic-upstream-key',
  Key: key, VCP_Key: key, AdminUsername: 'fixture-admin', AdminPassword: randomBytes(24).toString('hex'),
  DEFAULT_TIMEZONE: 'Asia/Shanghai', DebugMode: 'false', CHAT_LOG_ENABLED: 'false',
  LOG_VCHAT_POST_IP_ENABLED: 'false', ShowVCP: 'false', VCPToolCode: 'false',
  WhitelistImageModel: 'gemini-fixture',
  ApiRetries: '1', ApiRetryDelay: '1', MaxVCPLoopStream: '3', MaxVCPLoopNonStream: '3',
  KNOWLEDGEBASE_ROOT_PATH: join(directory, 'dailynote'), KNOWLEDGEBASE_STORE_PATH: join(directory, 'VectorStore'),
  KNOWLEDGEBASE_FULL_SCAN_ON_STARTUP: 'false', TDB_KNOWLEDGE_ENABLED: 'false',
  TDB_KNOWLEDGE_ROOT_PATH: join(directory, 'knowledge'), AGENT_DIR_PATH: join(directory, 'Agent'),
  TVSTXT_DIR_PATH: join(directory, 'TVStxt'),
};
writeFileSync(join(directory, 'config.env'), Object.entries(config).map(([name, value]) => `${name}=${value.replaceAll('\\', '/')}`).join('\n'));
for (const [path, value] of Object.entries({
  'toolApprovalConfig.json': { enabled: false, approveAll: false, approvalList: [] },
  'preprocessor_order.json': ['$StaticPlaceholderInjection'], 'ModelRedirect.json': {},
  'SemanticModelRouter.json': { enabled: false },
  'ToolConfigs/dynamic_tool_bridge.config.json': { enabled: false, useRagEmbeddings: false },
})) writeFileSync(join(directory, path), JSON.stringify(value));
for (const name of ['FixtureEcho', 'FixtureSecond']) {
  const pluginDirectory = join(directory, 'Plugin', name);
  mkdirSync(pluginDirectory, { recursive: true });
  writeFileSync(join(pluginDirectory, 'fixture-plugin.cjs'), pluginSource);
  writeFileSync(join(pluginDirectory, 'plugin-manifest.json'), JSON.stringify({
    manifestVersion: '1.0.0', name, version: '1.0.0', displayName: name, pluginType: 'synchronous',
    entryPoint: { type: 'nodejs', command: 'node fixture-plugin.cjs' },
    communication: { protocol: 'stdio', timeout: 2000 },
    capabilities: { invocationCommands: [{ command: 'echo', description: 'Synthetic echo', example: 'synthetic' }] },
  }));
}
const environment = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT']
  .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
Object.assign(environment, config, { USERPROFILE: join(directory, '.home'), HOME: join(directory, '.home'),
  APPDATA: join(directory, '.home'), LOCALAPPDATA: join(directory, '.home'),
  TEMP: join(directory, '.tmp'), TMP: join(directory, '.tmp'), PM2_HOME: join(directory, '.home/pm2') });
log = createWriteStream(join(output, 'server.log'));
log.on('error', error => cancellation.abort(error));
await once(log, 'open');
child = spawn(process.execPath, ['--require', fileURLToPath(new URL('./loopback.cjs', import.meta.url)), 'server.js'], { cwd: directory, env: environment,
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
exited = once(child, 'close');
// Observe spawn failures immediately, even while readiness polling is pending.
let spawnError;
exited.catch(error => { spawnError = error; });
const origin = `http://127.0.0.1:${port}`;
const post = (path, body, timeout = 30000) => fetch(origin + path, { method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify(body), signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(timeout)]) });
const results = [];
  const deadline = Date.now() + 30000;
  while (true) {
    cancellation.signal.throwIfAborted();
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Original server exited ${child.exitCode}; inspect ${output}/server.log`);
    try { if ((await post('/v1/interrupt', {}, 1000)).status === 400) break; }
    catch (error) { if (Date.now() >= deadline) throw error; }
    if (Date.now() >= deadline) throw new Error('Original server readiness timeout');
    await delay(100);
  }
  for (const scenario of httpCases) {
    const headers = { Accept: scenario.accept ?? 'application/json', 'content-type': 'application/json' };
    if (scenario.auth === 'wrong-basic') headers.Authorization = 'Basic ' + Buffer.from('wrong:wrong').toString('base64');
    if (scenario.auth === 'wrong-bearer') headers.Authorization = 'Bearer wrong';
    if (scenario.auth === 'bearer') headers.Authorization = `Bearer ${key}`;
    const response = await fetch(origin + scenario.path, { method: scenario.method ?? 'GET', headers,
      body: scenario.method === 'POST' ? JSON.stringify(scenario.body ?? {}) : undefined,
      redirect: 'manual', signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(5000)]) });
    const wire = await response.text();
    assert.equal(response.status, scenario.status, scenario.id);
    assert.equal(wire, scenario.wire, scenario.id);
    assert.equal(response.headers.get('www-authenticate'), null, scenario.id);
    assert.equal(response.headers.get('location'), scenario.location ?? null, scenario.id);
    writeFileSync(join(output, `${scenario.id}.json`), JSON.stringify({ request: { path: scenario.path, method: scenario.method ?? 'GET',
      accept: headers.Accept, credential: scenario.auth ?? 'none' }, status: response.status,
      headers: Object.fromEntries(response.headers), wire, upstream: [] }, null, 2) + '\n');
    results.push({ id: scenario.id, assertions: 'passed' });
    console.log(`${scenario.id}: recorded, exact HTTP assertion passed`);
  }
  for (const scenario of scenarios) {
    requests.set(scenario.id, []);
    let arrived;
    const upstreamArrived = new Promise(resolve => { arrived = resolve; });
    arrivals.set(scenario.id, arrived);
    const upstreamClosed = new Promise(resolve => upstreamClosures.set(scenario.id, resolve));
    const body = { model: scenario.id, stream: scenario.stream, requestId: `fixture-${scenario.id}`,
      messages: [{ role: 'user', content: 'Synthetic M0 contract recording.' }] };
    const pending = post(scenario.forceVisible ? '/v1/chatvcp/completions' : '/v1/chat/completions', body);
    let interrupt;
    if (scenario.interrupt) {
      await waitForUpstream(pending, upstreamArrived);
      const response = await post('/v1/interrupt', { requestId: body.requestId });
      interrupt = { status: response.status, body: await response.text() };
      assert.equal(response.status, 200);
    }
    const response = await pending;
    const wire = await response.text();
    if (scenario.interrupt) {
      const timeout = new AbortController();
      try {
        await Promise.race([upstreamClosed, delay(5000, undefined, { signal: timeout.signal })
          .then(() => { throw new Error('Interrupted upstream socket stayed open'); })]);
      } finally { timeout.abort(); }
    }
    const content = scenario.stream
      ? wire.split(/\r?\n/).filter(line => line.startsWith('data: ') && line !== 'data: [DONE]')
        .map(line => JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? '').join('')
      : wire;
    const upstream = requests.get(scenario.id);
    const record = { request: body, status: response.status, headers: Object.fromEntries(response.headers), wire, upstream, interrupt };
    writeFileSync(join(output, `${scenario.id}.json`), JSON.stringify(record, null, 2) + '\n');
    assert.equal(response.status, 200, `${scenario.id}: ${wire}`);
    assert(upstream.length > 0, scenario.id);
    if (!scenario.interrupt && !scenario.archeryOnly && !scenario.repeat) {
      assert(content.includes(`fixture-complete:${scenario.id}`), `${scenario.id}: missing final model response`);
    }
    if (scenario.reply && !scenario.archeryOnly && !scenario.repeat) {
      assert(upstream.length >= 2, `${scenario.id}: missing tool feedback round`);
      assert(JSON.stringify(upstream[1].messages).includes('VCP_TOOL_PAYLOAD'), `${scenario.id}: missing AI payload`);
    }
    if (scenario.stream && !scenario.interrupt) {
      assert.equal(wire.split('data: [DONE]').length - 1, 1, `${scenario.id}: final DONE count`);
      if (scenario.visible !== undefined) {
        assert.equal(wire.includes('[[VCP调用结果信息汇总:'), scenario.visible, scenario.id);
      }
    }
    results.push({ id: scenario.id, upstreamRounds: upstream.length, assertions: 'passed' });
    console.log(`${scenario.id}: recorded, ${upstream.length} upstream rounds`);
  }
  manifest = { baseline: provenance.baseline,
    node: process.version, platform: process.platform, recordedAt: new Date().toISOString(),
    transport: 'loopback.cjs restricts listen addresses; frozen handlers are unchanged',
    scope: 'Original HTTP server with synthetic plugins/model; not original VCPChat UI e2e or complete per-rule coverage', results };
} finally {
  try {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else process.kill(-child.pid, 'SIGKILL');
      await exited;
    }
  } finally {
    try {
      if (log) {
        log.end();
        await finished(log);
      }
    } finally {
      mock.closeAllConnections();
      if (mock.listening) await new Promise((resolve, reject) => mock.close(error => error ? reject(error) : resolve()));
      process.removeListener('SIGINT', cancel);
      process.removeListener('SIGTERM', cancel);
    }
  }
}
cancellation.signal.throwIfAborted();
// A successful manifest certifies both completed assertions and resource cleanup.
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
