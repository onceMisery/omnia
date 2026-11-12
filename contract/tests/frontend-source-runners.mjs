import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { sourceHarness, FixedDate } from './source-fixture-support.mjs';

const require = createRequire(import.meta.url);
const frontend = 'VCPChat';
const chatPath = 'modules/ipc/chatHandlers.js';

export async function runFrontendFixture(runner, input) {
  const h = sourceHarness();
  if (runner === 'topics') {
    return h.result(h.evaluate(`(function(){${h.source(frontend, chatPath, 735, 745)}})()`, { config: input.config }));
  }
  if (runner === 'replacement-topic') {
    return h.result(h.evaluate(`(function(){
      const replacementTimestamp = Date.now(); const replacementTopicId = 'topic_' + replacementTimestamp;
      let replacementCreated = false; let remainingTopics;
      ${h.source(frontend, chatPath, 812, 822)}
    })()`, { existingConfig: input.config, topicIdToDelete: input.id, Date: FixedDate }));
  }
  if (runner === 'agent-directory') {
    const normalize = h.evaluate(`({${h.source(frontend, 'modules/utils/agentConfigManager.js', 17, 26)}}).normalizeId`,
      { process: { platform: input.platform } });
    return h.result(normalize(input.id));
  }
  if (runner === 'history-file') {
    const temporaryRoot = await fs.mkdtemp(path.join(tmpdir(), 'omnia-source-history-'));
    const historyPath = path.join(temporaryRoot, 'agent', 'topics', 'default', 'history.json');
    const observations = [];
    // fs-extra is the upstream I/O boundary. This narrow adapter uses real
    // files and preserves writeJson's requested indentation and final newline.
    const io = {
      pathExists: async name => { try { await fs.access(name); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } },
      readJson: async name => JSON.parse(await fs.readFile(name, 'utf8')),
      writeJson: async (name, value, options) => fs.writeFile(name, JSON.stringify(value, null, options.spaces) + '\n'),
      ensureDir: name => fs.mkdir(name, { recursive: true }),
      remove: name => fs.rm(name, { force: true }),
      rename: async (from, to) => {
        observations.push({ oldBytesBeforeRename: await fs.readFile(to, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; }) });
        if (input.failRename) throw new Error('Injected rename failure');
        await fs.rename(from, to);
      },
    };
    try {
      const { HistoryMutationQueue } = h.commonjs(frontend, 'modules/services/historyMutationQueue.js', {
        require: name => name === 'fs-extra' ? io : require(name), process,
      });
      const owner = new HistoryMutationQueue({ userDataDir: temporaryRoot });
      if (Object.hasOwn(input, 'initial')) {
        await fs.mkdir(path.dirname(historyPath), { recursive: true });
        await fs.writeFile(historyPath, JSON.stringify(input.initial, null, 2) + '\n');
      }
      const descriptor = { itemId: input.itemId || 'agent', topicId: 'default' };
      let result;
      try { result = input.operation === 'read' ? await owner.read(descriptor) : await owner.write(descriptor, input.history); }
      catch (error) { result = { error: error.name, message: error.message.replaceAll(temporaryRoot, '<APPDATA>').replaceAll('\\', '/') }; }
      const finalBytes = await fs.readFile(historyPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      const files = await fs.readdir(path.dirname(historyPath)).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
      return h.result({ result, observations, finalBytes, temporaryFiles: files.filter(name => name.endsWith('.tmp')) });
    } finally {
      assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(tmpdir()));
      assert.ok(path.basename(temporaryRoot).startsWith('omnia-source-history-'));
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
  if (runner === 'history-persistence') {
    const source = h.source(frontend, 'modules/chat/chatHistoryPersistence.js');
    const factory = h.evaluate(`(function(){${source.replace(/^export /gm, '')}
      return createChatHistoryPersistence;})()`);
    const saves = [];
    const repository = { getHistory: async () => input.durableHistory ?? [],
      saveHistory: async (...args) => { saves.push(args); return { success: true }; } };
    try { const result = await factory(repository).commit(input.projected); return h.result({ result, saves }); }
    catch (error) { return h.result({ error: error.message, saves }); }
  }
  if (runner === 'frontend-request') {
    const build = h.evaluate(`(function(){${h.source(frontend, chatPath, 44, 154)}
      return function(messages, modelConfig, context, messageId){
        ${h.source(frontend, chatPath, 1166, 1213)}
        modelConfig = omitUnsetOptionalModelParams(modelConfig);
        ${h.source(frontend, chatPath, 1389, 1401)}
        return requestBody;
      };})()`, { crypto });
    return h.result(build(input.messages, input.modelConfig, input.context, input.assistantId));
  }
  if (runner === 'frontend-assistant-origin') {
    return h.result(await h.evaluate(`(async function(){
      ${h.source(frontend, 'modules/chatManager.js', 2013, 2027)}
      ${h.source(frontend, 'modules/chatManager.js', 2126, 2135)}
      return { thinkingMessage, dispatchedMessageId: orchestrated.messageId,
        currentUserMessageId: orchestrated.currentUserMessageId };
    })()`, { Date: FixedDate, Math: { random: () => 0.125 },
      userMessage: { id: input.userId }, currentSelectedItem: { name: 'Fixture Agent' },
      sendContext: { agentId: 'agent', topicId: 'default' },
      singleChatRequestOrchestrator: { buildRequest: async value => value },
      globalSettings: {}, agentConfig: {}, historySnapshotForVCP: [], requestTextOptions: {}, buildDefaultMessageContent() {},
    }));
  }
  if (runner === 'frontend-url') {
    const complete = h.evaluate(`(${h.source(frontend, 'modules/settingsManager.js', 13, 38)})`);
    const vcpUrl = complete(input.url);
    return h.result(h.evaluate(`(function(){let finalVcpUrl = vcpUrl;
      ${h.source(frontend, chatPath, 1234, 1241)}
      return finalVcpUrl;})()`, { vcpUrl, settings: { enableVcpToolInjection: input.enabled } }));
  }
  if (runner === 'frontend-chunk') {
    const normalize = input.fallback
      ? h.evaluate(`({${h.source(frontend, 'modules/renderer/streamManager.js', 391, 394)}}).extractChunkText`)
      : h.evaluate(`(${h.source(frontend, 'modules/chat/contentRuntime.js', 3, 11).replace(/^export /, '')})`);
    return h.result(input.chunks.map(normalize));
  }
  if (runner === 'frontend-sse') {
    const payloads = [];
    const run = h.evaluate(`(function(lines){${h.source(frontend, chatPath, 1537, 1564)}})`, {
      messageId: 'assistant-id', context: { agentId: 'agent', topicId: 'default' },
      trajectoryCall: { finish() {}, chunk() {} }, sendStreamPayload: value => payloads.push(value),
    });
    run(input.lines);
    return h.result(payloads);
  }
  if (runner === 'frontend-interrupt') {
    const fetches = [];
    const cancellations = [];
    let handler;
    const event = { sender: {} };
    h.evaluate(`${h.source(frontend, chatPath, 171, 171)}
      ${h.source(frontend, chatPath, 1655, 1710)}`, {
      ipcMain: { handle: (_name, fn) => { handler = fn; } }, activeHandoffs: new Map(),
      APP_DATA_ROOT_IN_PROJECT: '/synthetic/AppData', path,
      fs: { pathExists: async () => true, readJson: async () => input.settings },
      AbortSignal: { timeout: value => ({ timeoutMs: value }) },
      fetch: async (url, options) => {
        fetches.push({ url, options });
        if (input.fail) throw new Error('Injected HTTP timeout');
        return { ok: true, json: async () => ({ message: 'accepted' }) };
      },
      vcpStreamTasks: { cancel: (_sender, id, reason) => cancellations.push({ id, reason }) },
    });
    const result = await handler(event, { messageId: input.assistantId });
    return h.result({ result, fetches, cancellations });
  }
  throw new Error(`Unknown frontend fixture runner: ${runner}`);
}
