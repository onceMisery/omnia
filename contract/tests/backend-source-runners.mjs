import { createRequire } from 'node:module';
import { sourceHarness, FixedDate, fixedTimeMs } from './source-fixture-support.mjs';

const require = createRequire(import.meta.url);
const backend = 'VCPToolBox';
const executorPath = 'modules/vcpLoop/toolExecutor.js';
const streamPath = 'modules/handlers/streamHandler.js';

function response(state = {}) {
  return { statusCode: 200, headers: {}, chunks: [], writableEnded: false, destroyed: false,
    headersSent: false, ...state,
    status(value) { this.statusCode = value; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    getHeader(key) { return this.headers[key]; },
    write(value, callback) { this.chunks.push(value); callback?.(); },
    json(value) { this.body = value; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; },
    destroy() { this.destroyed = true; },
  };
}

function formatter(harness) {
  return harness.evaluate(`new (class {${harness.source(backend, executorPath, 476, 610)}})`, {
    Date: FixedDate,
  });
}

function visibleFormatter(harness) {
  return harness.commonjs(backend, 'vcpInfoHandler.js', { require, Date: FixedDate });
}

function errorClassifier(harness) {
  return harness.evaluate(`(${harness.source(backend, 'modules/chatCompletionHandler.js', 289, 349)})`);
}

export async function runBackendFixture(runner, input) {
  const h = sourceHarness();
  if (runner === 'visible') {
    const info = visibleFormatter(h);
    return h.result(input.calls.map(call => info.streamVcpInfo(null, 'fixture-model',
      call.name, call.status, call.result, call.aborted ? { signal: { aborted: true } } : null)).join(''));
  }
  if (runner === 'format-result' || runner === 'format-error' || runner === 'process-result') {
    const owner = formatter(h);
    const broadcasts = [];
    owner.webSocketServer = { broadcast: (...args) => broadcasts.push(args) };
    const lifecycle = [];
    owner.pluginManager = { getVCPLogFunctions: () => ({ pushVcpInfo: value => lifecycle.push(value) }) };
    const output = runner === 'format-result' ? owner._formatResult(input.value)
      : runner === 'format-error' ? owner._createErrorResult(input.name, input.message)
        : owner._processResult(input.name, input.value);
    return h.result(runner === 'format-result' ? output : { output, broadcasts, lifecycle });
  }
  if (runner === 'execute-order') {
    const owner = h.evaluate(`({${h.source(backend, executorPath, 459, 463)}})`);
    const releases = new Map();
    const started = [];
    owner.execute = call => { started.push(call.name); return new Promise(resolve => releases.set(call.name, resolve)); };
    const result = owner.executeAll(input.calls.map(name => ({ name })), '127.0.0.1', []);
    for (const name of input.completionOrder) releases.get(name)({ name });
    return h.result({ started, results: await result });
  }
  if (runner === 'batch') {
    const batch = h.commonjs(backend, 'modules/toolResultBatch.js', {
      process: { env: { DEFAULT_TIMEZONE: input.timezone || 'Asia/Shanghai' } }, Date: FixedDate,
    });
    return h.result(input.operation === 'project' ? batch.projectToolBatchForUpstream(input.body)
      : input.batches.map(parts => batch.formatToolResultBatch(parts, input.roleDivider)));
  }
  if (runner === 'normal-round' || runner === 'archery-round') {
    const vcpInfoHandler = visibleFormatter(h);
    const isToolResultError = errorClassifier(h);
    const { formatToolResultBatch } = h.commonjs(backend, 'modules/toolResultBatch.js', {
      process: { env: {} }, Date: FixedDate,
    });
    const res = response(input.response);
    const abortController = new AbortController();
    const bindings = { input, res, abortController, vcpInfoHandler, formatToolResultBatch,
      Date: FixedDate, originalBody: { model: 'fixture-model' }, shouldShowVCP: input.show,
      enableRoleDivider: input.roleDivider ?? false, owner: { context: { isToolResultError } },
      maybeTranslateToolPayloadMedia: async value => value };
    let code = `const visibleToolResults = []; const archeryStatusSummaryItems = [];
      const archeryErrorContents = []; const currentMessagesForLoop = [];
      ${h.source(backend, streamPath, 536, 547)}\n`;
    if (runner === 'normal-round') {
      code += `const normalCalls = input.calls; const toolResults = input.results;
        const combinedToolResultsForAI = toolResults.map(r => r.content).flat();
        ${h.source(backend, streamPath, 674, 708)}
        ${h.source(backend, streamPath, 711, 713)}
        ${h.source(backend, streamPath, 722, 743)}
        return { visibleToolResults, messages: currentMessagesForLoop, response: res };`;
    } else {
      bindings.toolExecutor = { execute: async call => input.results[input.calls.indexOf(call)] };
      bindings.clientIp = '127.0.0.1';
      code += `const archeryCalls = input.calls; const normalCalls = []; let completed = false;
        const validUpstreamTurns = true;
        ${h.source(backend, streamPath, 550, 576)}
        if (archeryErrorContents.length) {
          ${h.source(backend, streamPath, 580, 597)}
        } else { do { ${h.source(backend, streamPath, 640, 656)} } while(false); }
        return { visibleToolResults, messages: currentMessagesForLoop, response: res, completed };`;
    }
    return h.result(await h.evaluate(`(async function(){${code}}).call(owner)`, bindings));
  }
  if (runner === 'stdio-bridge') {
    const calls = [];
    const execute = h.evaluate(`({${h.source(backend, 'modules/pluginBridgeRegistry.js', 344, 401)}}).execute`);
    const context = { toolName: 'FixtureTool', requestIp: '192.0.2.1', executionOptions: {},
      debugLog() {}, debugWarn() {}, filterFuzzyDiff() {}, getTimestamp: () => 'fixture-time',
      executeStdio: async (...args) => { calls.push(args); return input.pluginOutput; } };
    try { return h.result({ calls, result: await execute({}, input.args, context) }); }
    catch (error) { return h.result({ calls, error: error.message }); }
  }
  if (runner === 'stdin') {
    const writes = [];
    let ended = false;
    h.evaluate(h.source(backend, 'Plugin.js', 1929, 1939), { inputData: input.value,
      pluginName: 'FixtureTool', initialResponseSent: false,
      pluginProcess: { stdin: { write: value => writes.push(value), end: () => { ended = true; } } },
      reject: error => { throw error; } });
    return h.result({ writes, ended });
  }
  if (runner === 'stdout') {
    let result;
    h.evaluate(`(function(){${h.source(backend, 'Plugin.js', 1875, 1926)}}).call({debugMode:false})`, {
      signal: input.signal ?? null, code: input.code, outputBuffer: input.stdout,
      errorOutput: input.stderr ?? '', initialResponseSent: false, isArcheryNoReply: input.noReply ?? false,
      pluginName: 'FixtureTool', resolve: value => { result = { resolved: value }; },
      reject: error => { result = { rejected: error.message }; },
    });
    return h.result(result);
  }
  if (runner === 'environment') {
    const owner = { _getPluginConfig: () => input.pluginConfig, projectBasePath: input.projectBasePath,
      _getDecryptedAuthCode: async () => input.authCode, getResolvedPluginConfigValue: () => null,
      debugMode: false };
    try {
      return h.result(await h.evaluate(`(async function(){${h.source(backend, 'Plugin.js', 1643, 1723)}
        return finalEnv;}).call(owner)`, { owner, plugin: input.plugin ?? {}, pluginName: 'FixtureTool',
        requestIp: input.requestIp, inputData: null, process: { env: input.env }, global: {} }));
    } catch (error) { return h.result({ error: error.message }); }
  }
  if (runner === 'instructions') {
    const owner = h.evaluate(`({${h.source(backend, 'Plugin.js', 1056, 1091)}})`);
    owner.individualPluginDescriptions = new Map();
    owner.plugins = new Map(input.plugins.map(plugin => [plugin.name, plugin]));
    owner.buildVCPDescription();
    return h.result([...owner.individualPluginDescriptions]);
  }
  if (runner === 'parsed-args') {
    const matcher = h.commonjs(backend, 'modules/vcpLoop/toolMarkerFuzzyMatcher.js');
    const Parser = h.commonjs(backend, 'modules/vcpLoop/toolCallParser.js', {
      require: name => { if (name === './toolMarkerFuzzyMatcher') return matcher; throw new Error(`Unexpected parser dependency: ${name}`); },
    });
    return h.result(Parser.parse(input.text).map(call => call.args));
  }
  if (runner === 'placeholders') {
    const context = { expandedVcpTools: new Set(), expandedGlobalPlaceholders: new Set() };
    const replace = h.evaluate(`(function(processedText){
      ${h.source(backend, 'modules/messageProcessor.js', 66, 68)}
      ${h.source(backend, 'modules/messageProcessor.js', 141, 153)}
      ${h.source(backend, 'modules/messageProcessor.js', 1053, 1092)}
      return processedText;})`, { context, individualPluginDescriptions: new Map(input.descriptions), DEBUG_MODE: false });
    return h.result(input.messages.map(replace));
  }
  if (runner === 'handoff') {
    let now = fixedTimeMs;
    const timers = new Map();
    let nextTimer = 0;
    const { createHandoffGate } = h.commonjs(backend, 'modules/vcpLoop/handoffGate.js', {
      Date: class extends FixedDate { static now() { return now; } },
      setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id),
    });
    const controller = new AbortController();
    const gate = createHandoffGate(controller.signal);
    const outputs = [];
    for (const operation of input.operations) {
      if (operation.type === 'control') outputs.push(gate.control(operation.value));
      else if (operation.type === 'abort') controller.abort();
      else if (operation.type === 'dispose') gate.dispose();
      else if (operation.type === 'wait') {
        const waiting = gate.wait().then(() => ({ completed: true }), error => ({ error: error.name, message: error.message }));
        if (operation.cancel) outputs.push(gate.control(operation.cancel));
        if (operation.abort) controller.abort();
        const scheduled = [...timers.values()].map(timer => timer.delay);
        if (operation.expire) {
          for (const timer of [...timers.values()]) { now += timer.delay; timer.callback(); }
        }
        outputs.push({ scheduled, ...await waiting, ready: gate.isReady(), remainingTimers: timers.size });
      }
      outputs.push({ ready: gate.isReady() });
    }
    gate.dispose();
    return h.result(outputs);
  }
  if (runner === 'interrupt') {
    const res = response(input.response);
    const controller = new AbortController();
    const context = { res, req: { body: { stream: input.stream, model: 'fixture-model' } },
      aborted: input.aborted ?? false, abortController: controller };
    if (input.handoff) {
      const { createHandoffGate } = h.commonjs(backend, 'modules/vcpLoop/handoffGate.js');
      context.handoffGate = createHandoffGate(controller.signal);
    }
    const activeRequests = new Map(input.missing ? [] : [['assistant-id', context]]);
    const delayed = [];
    let route;
    h.evaluate(h.source(backend, 'server.js', 1064, 1190), {
      app: { post: (_path, callback) => { route = callback; } }, activeRequests,
      Date: FixedDate, setImmediate: callback => callback(),
      setTimeout: (callback, delay) => { delayed.push({ callback, delay }); },
    });
    const receipts = [];
    for (const body of input.requests ?? [{ requestId: 'assistant-id' }]) {
      const receipt = response(); route({ body }, receipt); receipts.push(receipt);
    }
    const scheduled = delayed.map(item => item.delay);
    for (const item of delayed) item.callback();
    context.handoffGate?.dispose();
    return h.result({ response: res, receipts, aborted: context.aborted,
      signalAborted: controller.signal.aborted, scheduled, remainingRequests: activeRequests.size });
  }
  if (runner === 'approval-decision') {
    const Manager = h.commonjs(backend, 'modules/toolApprovalManager.js', {
      require: name => { if (name === 'path' || name === 'fs') return require(name);
        if (name === 'chokidar') return {};
        if (name === './vcpLoop/toolMarkerFuzzyMatcher') return {};
        throw new Error(`Unexpected dependency: ${name}`); },
    });
    const owner = Object.create(Manager.prototype);
    owner.config = { enabled: true, approveAll: false, approvalList: [], whitelist: [], ...input.config };
    owner._ruleCache = {};
    return h.result(owner.getApprovalDecision(input.name, input.args ?? {}));
  }
  if (runner === 'approval-rejection') {
    let output;
    h.evaluate(h.source(backend, 'Plugin.js', 1979, 1986), {
      normalizedReason: input.reason,
      approval: { reject: error => { output = JSON.parse(error.message); } },
    });
    return h.result(output);
  }
  if (runner === 'approval-timeout') {
    let callback;
    let scheduled;
    const owner = { toolApprovalManager: { getTimeoutMs: () => input.minutes * 60000 }, pendingApprovals: new Map() };
    const promise = h.evaluate(`(function(){${h.source(backend, 'Plugin.js', 1364, 1379)}
      return approvalPromise;}).call(owner)`, { owner, requestId: 'fixture-approval', toolName: 'FixtureTool',
      approvalDecision: { notifyAiOnReject: true }, setTimeout: (fn, delay) => { callback = fn; scheduled = delay; return 1; } });
    const observed = promise.then(value => ({ resolved: value ?? null }), error => ({ rejected: JSON.parse(error.message) }));
    if (input.approve) {
      owner.pendingApprovals.get('fixture-approval').resolve(); owner.pendingApprovals.delete('fixture-approval');
    }
    callback();
    return h.result({ ...await observed, scheduled, pending: owner.pendingApprovals.size });
  }
  throw new Error(`Unknown backend fixture runner: ${runner}`);
}
