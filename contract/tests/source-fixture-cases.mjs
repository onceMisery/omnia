// Synthetic, public inputs only. Expected outputs are recorded once into fixed
// fixture files; verification never regenerates them.
export const cases = [];
function add(directory, name, runner, input, rules, limitations = []) {
  cases.push({ directory, name, runner, input, rules, limitations });
}
function pair(directory, name, runner, positive, negative, rules, limitations) {
  add(directory, `${name}-pos`, runner, positive, rules, limitations);
  add(directory, `${name}-neg`, runner, negative, rules, limitations);
}
const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } };
const text = value => ({ type: 'text', text: value });
const good = { success: true, raw: { status: 'success', result: '完成' }, content: [text('完成')] };
const bad = { success: false, raw: { status: 'error', plugin_error: '出错' }, error: '出错', content: [text('[错误] 出错')] };
const call = { name: 'FixtureTool' };

pair('c01-injection', 'c01-single-tool', 'visible',
  { calls: [{ name: '目录', status: 'success', result: { content: [text('第一行'), image, text('第二行')] } }] },
  { calls: [{ name: '目录', status: 'error', result: null }] }, ['C01.single-domain', 'C01.image-omission']);
pair('c01-injection', 'c01-multi-tool', 'visible',
  { calls: [{ name: 'A', status: 'success', result: '甲' }, { name: 'B', status: 'error', result: '乙' }] },
  { calls: [{ name: 'A', status: 'success', result: '甲', aborted: true }, { name: 'B', status: 'error', result: '乙' }] }, ['C01.multi-domain']);
pair('c01-injection', 'c01-base64-fallback', 'visible',
  { calls: [{ name: 'Image', status: 'success', result: { image: image.image_url.url } }] },
  { calls: [{ name: 'Image', status: 'success', result: { content: [text(image.image_url.url)] } }] },
  ['C01.base64-placeholder'], ['The original redacts base64 only in fallback JSON serialization; selected text paths are unchanged.']);
const readable = [
  ['content', { content: [text('content')], result: [text('result')] }, { content: [image], result: [text('result')] }],
  ['result-array', { result: [text('result-array')], message: 'message' }, { result: [], message: 'message' }],
  ['nested-content', { result: { content: [text('nested')] } }, { result: { content: [image] } }],
  ['result-string', { result: 'result', message: 'message' }, { result: 0, message: 'message' }],
  ['calculator', { original_plugin_output: '###计算结果：42###' }, { original_plugin_output: '###计算结果：{"x":2}###' }],
];
for (const [name, positive, negative] of readable) pair('c01-injection', `c01-readable-${name}`, 'visible',
  { calls: [{ ...call, status: 'success', result: positive }] }, { calls: [{ ...call, status: 'success', result: negative }] }, ['C01.readable-priority']);

for (const [name, failed] of [
  ['success', good], ['failure', bad],
  ['rejected', { ...bad, raw: { rejected_by_user: true, plugin_error: 'timeout' } }],
  ['timeout', { ...bad, error: 'DIRECT_TOOL_TIMEOUT' }],
]) pair('c01-injection', `c01-summary-${name}`, 'normal-round',
  { show: false, calls: [call], results: [{ ...failed, recordId: 'record-1' }] },
  { show: false, calls: [call], results: [{ ...good, raw: { status: 'success', error: 'rejected by user timeout' } }] }, ['C01.summary-four-states']);
pair('c01-injection', 'c01-ai-payload', 'normal-round',
  { show: false, calls: [call], results: [{ ...good, content: [text('紧凑\nJSON'), { type: 'text', text: '引用', url: 'data:secret', image_url: 'data:image-secret', other: 'data:keep' }] }] },
  { show: true, calls: [call], results: [{ ...good, content: [text('有图'), image] }] },
  ['C01.ai-compact-json', 'C01.ai-omitted', 'C01.ai-image-shape'], ['Media translator is an identity IO seam; disabled translation behavior only.']);
pair('c01-injection', 'c01-archery', 'archery-round',
  { show: true, calls: [call], results: [good] }, { show: true, calls: [call], results: [bad] },
  ['C01.archery-success-silence', 'C01.archery-failure-payload', 'C01.pure-archery-terminal']);
pair('c01-injection', 'c01-archery-feedback', 'archery-round',
  { show: false, calls: [call], results: [{ ...good, approvalFeedbackContent: [text('审核留言')] }] },
  { show: false, calls: [call], results: [good] }, ['C01.archery-feedback']);

for (const [name, value] of [
  ['rich', { content: [text('first'), image, text('last')] }],
  ['non-rich', { result: '业务结果' }], ['no-text', { content: [image] }],
]) pair('c01-injection', `c01-feedback-${name}`, 'format-result',
  { value: { ...value, __vcpApprovalFeedback: '  同意并备注  ' } }, { value }, ['C01.feedback-position']);
pair('c01-injection', 'c01-batch-role-divider', 'batch',
  { batches: [['甲', '乙']], roleDivider: true }, { batches: [['甲', '乙'], []], roleDivider: false }, ['C01.batch-wrapper']);
pair('c01-injection', 'c01-batch-monotonic', 'batch',
  { batches: [['一'], ['二']], roleDivider: false },
  { batches: [['<<<[VCP_TOOL_BATCH_START:2024-10-27T11:33:20.000+08:00]>>>']], roleDivider: false }, ['C01.batch-monotonic-collision']);
const batchText = '\n<<<[VCP_TOOL_BATCH_START:2024-10-27T11:33:20.000+08:00]>>>\n甲\n<<<[VCP_TOOL_BATCH_END:2024-10-27T11:33:20.000+08:00]>>>\n';
pair('c01-injection', 'c01-upstream-projection', 'batch',
  { operation: 'project', body: { messages: [{ role: 'user', content: batchText }] } },
  { operation: 'project', body: { messages: [{ role: 'user', content: '<!-- VCP_TOOL_PAYLOAD -->\n' + batchText }, { role: 'assistant', content: batchText }] } }, ['C01.batch-projection']);

pair('c02-stdio', 'c02-bare-args', 'stdio-bridge',
  { args: { command: '列目录', filePath1: 'D:/notes', maid: 'Alice' }, pluginOutput: { status: 'success', result: {} } },
  { args: {}, pluginOutput: { status: 'success', result: {} } }, ['C02.bare-payload', 'C02.empty-stdin']);
pair('c02-stdio', 'c02-stdin-no-newline', 'stdin', { value: '{"command":"列目录"}' }, { value: null }, ['C02.no-trailing-newline', 'C02.empty-stdin']);
pair('c02-stdio', 'c02-env-three-levels', 'environment',
  { env: { KEEP: 'inherited', OVERRIDE: 'parent', PYTHONIOENCODING: 'ascii', VCP_REQUEST_IP: 'old', PORT: '6005' },
    pluginConfig: { OVERRIDE: 7, PYTHONIOENCODING: 'utf-16', VCP_REQUEST_IP: 'plugin', ENABLED: true }, requestIp: '192.0.2.3', projectBasePath: '/synthetic/project' },
  { env: { KEEP: 'inherited', VCP_REQUEST_IP: 'parent' }, pluginConfig: {}, requestIp: '', projectBasePath: null },
  ['C02.env-three-levels'], ['Plugin config is supplied at the _getPluginConfig boundary; environment merge code is original.']);
pair('c02-stdio', 'c02-env-admin', 'environment',
  { env: {}, pluginConfig: {}, plugin: { requiresAdmin: true }, authCode: 'synthetic-admin' },
  { env: {}, pluginConfig: {}, plugin: { requiresAdmin: true }, authCode: null }, ['C02.admin-auth-env']);
pair('c02-stdio', 'c02-json-exit-success', 'stdout',
  { code: 7, stdout: ' {"status":"success","result":"ok"}\n', stderr: '  warning  ' },
  { code: 0, stdout: 'not JSON' }, ['C02.json-over-exit-success', 'C02.stderr']);
pair('c02-stdio', 'c02-json-exit-error', 'stdout',
  { code: 0, stdout: '{"status":"error","error":"failure"}' },
  { code: 2, stdout: '{"result":"missing status"}', stderr: 'error stream' }, ['C02.json-over-exit-error']);
pair('c02-stdio', 'c02-result-second-parse', 'stdio-bridge',
  { args: {}, pluginOutput: { status: 'success', result: '{"value":42}' } },
  { args: {}, pluginOutput: { status: 'success', result: 'ordinary string' } }, ['C02.result-second-parse']);
pair('c02-stdio', 'c02-status-error', 'stdio-bridge',
  { args: {}, pluginOutput: { status: 'error', result: { partial: true }, error: 'blocked' } },
  { args: {}, pluginOutput: { result: null } }, ['C02.status-error']);
pair('c02-stdio', 'c02-no-reply-exit', 'stdout',
  { code: 0, stdout: '', noReply: true }, { code: 3, stdout: '', noReply: true }, ['C01.no-reply-silent']);

const plugin = commands => ({ name: 'Example', displayName: '示例', capabilities: { invocationCommands: commands } });
pair('c03-instructions', 'c03-command-indent-example', 'instructions',
  { plugins: [plugin([{ command: 'Run', commandIdentifier: 'wrong', description: '第一行\n第二行', example: '调用一\n调用二' }])] },
  { plugins: [plugin([{ commandIdentifier: 'IdentifierOnly', description: '说明' }, { command: 'Ignored', example: '无说明' }])] },
  ['C03.command-not-identifier', 'C03.description-four-spaces', 'C03.example-two-spaces']);
pair('c03-instructions', 'c03-multiple-commands', 'instructions',
  { plugins: [plugin([{ command: 'First', description: '一' }, { command: 'Second', description: '二' }])] },
  { plugins: [plugin([{ command: 'Empty', description: '' }])] }, ['C03.multi-command-separator']);
pair('c03-instructions', 'c03-first-expansion', 'placeholders',
  { descriptions: [['VCPA', '内容']], messages: ['{{VCPA}} + {{VCPA}}', '{{VCPA}}再出现'] },
  { descriptions: [['VCPA', '内容']], messages: ['{{vcpA}} {{Unknown}}', '{{VCPA}}'] }, ['C03.first-only']);
pair('c03-instructions', 'c03-all-tools-separator', 'placeholders',
  { descriptions: [['VCPB', 'B'], ['VCPA', 'A']], messages: ['{{VCPAllTools}} {{VCPAllTools}}', '{{VCPAllTools}}'] },
  { descriptions: [], messages: ['{{VCPAllTools}}'] }, ['C03.all-tools-separator']);
pair('c03-instructions', 'c03-empty-description', 'placeholders',
  { descriptions: [['VCPA', '']], messages: ['{{VCPA}}'] },
  { descriptions: [], messages: ['{{VCPA}}'] }, ['C03.empty-description']);

pair('c04-sse', 'c04-show-vcp', 'normal-round',
  { show: true, calls: [call], results: [good] }, { show: false, calls: [call], results: [good] },
  ['C04.show-domain', 'C04.summary-always', 'C04.batch-separator-id']);
pair('c04-sse', 'c04-mark-history', 'normal-round',
  { show: false, calls: [{ ...call, markHistory: true }], results: [good] },
  { show: false, calls: [{ ...call, markHistory: false }], results: [good] }, ['C04.mark-history']);
pair('c04-sse', 'c04-archery-mark-history', 'archery-round',
  { show: false, calls: [{ ...call, markHistory: true }], results: [good] },
  { show: true, calls: [{ ...call, markHistory: true }], results: [good] }, ['C04.archery-visible', 'C04.final-stop-id']);

const control = (revision, handoffId = 'handoff-1', action = 'prepare_handoff') => ({ type: 'control', value: { action, handoffId, revision } });
pair('c05-interrupt', 'c05-gate-invalid', 'handoff',
  { operations: [control(1)] }, { operations: [control(0), control(1, ''), control(1, 'x'.repeat(129)), control(1, 'h', 'wrong')] },
  ['C05.armed', 'C05.invalid-handoff']);
pair('c05-interrupt', 'c05-gate-stopped', 'handoff',
  { operations: [control(1), { type: 'dispose' }, control(2)] },
  { operations: [control(1), { type: 'abort' }, control(2)] }, ['C05.request-stopped']);
pair('c05-interrupt', 'c05-gate-revision', 'handoff',
  { operations: [control(2), control(2)] }, { operations: [control(2), control(1), control(2, 'other')] },
  ['C05.duplicate', 'C05.stale-revision', 'C05.revision-conflict']);
pair('c05-interrupt', 'c05-gate-cancel', 'handoff',
  { operations: [control(1), control(2, 'handoff-1', 'cancel_handoff')] },
  { operations: [control(1), control(2, 'other', 'cancel_handoff')] }, ['C05.cancelled', 'C05.stale-handoff']);
pair('c05-interrupt', 'c05-gate-fail-open', 'handoff',
  { operations: [control(1), { type: 'wait', expire: true }, { type: 'wait' }] },
  { operations: [control(1), { type: 'wait', abort: true }] }, ['C05.fail-open-2000ms', 'C05.abort-wait']);
pair('c05-interrupt', 'c05-gate-cancel-wakes', 'handoff',
  { operations: [control(1), { type: 'wait', cancel: control(2, 'handoff-1', 'cancel_handoff').value }] },
  { operations: [{ type: 'wait' }] }, ['C05.cancel-wait']);
for (const [name, state] of [
  ['unsent-sse', { stream: true }], ['unsent-json', { stream: false }],
  ['sent-sse', { stream: true, response: { headersSent: true, headers: { 'Content-Type': 'text/event-stream' } } }],
  ['sent-other', { response: { headersSent: true, headers: { 'Content-Type': 'application/json' } } }],
]) pair('c05-interrupt', `c05-hard-${name}`, 'interrupt', state,
  { ...state, aborted: true }, ['C05.hard-four-states', 'C05.duplicate-hard-interrupt']);
pair('c05-interrupt', 'c05-not-found', 'interrupt', { missing: true }, { requests: [{}] }, ['C05.not-found-text', 'C05.required-id']);
pair('c05-interrupt', 'c05-id-alias', 'interrupt', { requests: [{ messageId: 'assistant-id' }] },
  { requests: [{ requestId: 'unknown', messageId: 'assistant-id' }] }, ['C05.id-priority']);

pair('c07-approval', 'c07-enabled', 'approval-decision',
  { config: { enabled: false, approvalList: ['FileOperator'] }, name: 'FileOperator' },
  { config: { enabled: true, approvalList: ['FileOperator'] }, name: 'FileOperator' }, ['C07.disabled-pass']);
pair('c07-approval', 'c07-case-insensitive', 'approval-decision',
  { config: { approvalList: ['FileOperator'] }, name: 'fILEoPERATOR' },
  { config: { approvalList: ['FileOperator'] }, name: 'FileOperatorExtra' }, ['C07.case-insensitive']);
pair('c07-approval', 'c07-rejection-reason', 'approval-rejection', { reason: '禁止修改' }, { reason: '' },
  ['C07.rejection-three-fields', 'C07.reason-present-absent']);
pair('c07-approval', 'c07-timeout', 'approval-timeout', { minutes: 5 }, { minutes: 5, approve: true }, ['C07.timeout-text']);

for (const [name, positive, negative] of [
  ['empty', null, ''], ['rich-array', [text('rich'), image], { content: 'not-array' }],
  ['rich-nested', { data: { content: [image] } }, { data: { content: [] }, content: [text('fallback is shadowed')] }],
  ['object-string', { value: 42 }, '{"value":42}'],
]) pair('c02-stdio', `c12-format-${name}`, 'format-result', { value: positive }, { value: negative }, ['C12.result-format']);
pair('c02-stdio', 'c12-inner-failure', 'process-result',
  { name: 'Tool', value: { success: false, error: 'failure' } },
  { name: 'Tool', value: { status: 'error', message: 'outer layer did not throw' } }, ['C12.inner-success-false']);
pair('c02-stdio', 'c12-error-feedback', 'format-error',
  { name: 'Tool', message: '执行错误: {"plugin_error":"拒绝","user_feedback":"别改"}' },
  { name: 'Tool', message: '执行错误: {broken' }, ['C12.error-format']);
pair('c02-stdio', 'c12-error-feedback-dedup', 'format-error',
  { name: 'Tool', message: '{"plugin_error":"包含备注","user_feedback":"备注"}' },
  { name: 'Tool', message: '{"plugin_error":"错误","__vcpApprovalFeedback":"备注"}' }, ['C12.error-feedback']);
pair('c02-stdio', 'c12-concurrent-order', 'execute-order',
  { calls: ['A', 'B', 'C'], completionOrder: ['C', 'A', 'B'] },
  { calls: ['C', 'B', 'A'], completionOrder: ['A', 'B', 'C'] }, ['C12.concurrent-order'],
  ['Original executeAll runs against deferred IO operations to observe concurrency and input-order results.']);
pair('c02-stdio', 'c12-no-reply-lifecycle', 'process-result',
  { name: 'Tool', value: { status: 'success', __vcpArcheryNoReplySilent: true } },
  { name: 'Tool', value: { status: 'success' } }, ['C01.no-reply-lifecycle']);

pair('c04-sse', 'c04-heartbeat', 'sse-timers', { fire: 'heartbeat' }, { fire: 'heartbeat', closed: true }, ['C04.heartbeat-format']);
pair('c04-sse', 'c04-idle-timeout', 'sse-timers', { fire: 'idle' }, { fire: 'idle', closed: true }, ['C04.idle-90000ms-text']);
pair('c04-sse', 'c04-swallow-upstream-done', 'sse-forward',
  { lines: ['data: {"choices":[{"delta":{"content":"一"}}]}', '', 'data: [DONE]'] },
  { lines: ['data: [DONE] extra', 'data:[DONE]', ': comment'] }, ['C04.swallow-upstream-done']);
pair('c04-sse', 'c04-length-terminal', 'sse-length', { depth: 5 }, { depth: 4 }, ['C04.length-terminal']);

pair('c08-appdata', 'c08-topic-defaults', 'topics',
  { config: { topics: [{ id: 'old', name: '旧话题', createdAt: 1 }, { id: 'explicit', locked: false, unread: true, creatorSource: 'ui' }] } },
  { config: { topics: [{ id: 'explicit-null', locked: null, unread: null, creatorSource: '' }] } }, ['C08.topic-read-defaults']);
pair('c08-appdata', 'c08-last-topic-replacement', 'replacement-topic',
  { config: { name: 'agent', topics: [{ id: 'default', name: '旧' }] }, id: 'default' },
  { config: { topics: [{ id: 'default' }, { id: 'keep' }] }, id: 'default' }, ['C08.default-topic-replacement']);
pair('c08-appdata', 'c08-platform-directory', 'agent-directory',
  { platform: 'win32', id: '_Agent_Demo_123' }, { platform: 'linux', id: '_Agent_Demo_123' }, ['C08.windows-lowercase']);
pair('c08-appdata', 'c08-history-top-array', 'history-file',
  { operation: 'read', initial: [{ role: 'user', content: '合成' }] },
  { operation: 'read', initial: { messages: [] } }, ['C08.history-top-array']);
pair('c08-appdata', 'c08-history-atomic', 'history-file',
  { initial: [{ id: 'old' }], history: [{ id: 'new', content: '新' }] },
  { initial: [{ id: 'old' }], history: [{ id: 'new', content: '新' }], failRename: true }, ['C08.history-atomic']);
pair('c08-appdata', 'c08-history-missing', 'history-file',
  { operation: 'read' }, { history: { invalid: true } }, ['C08.history-missing-array']);
pair('c08-appdata', 'c08-history-path', 'history-file',
  { operation: 'read', itemId: 'demo' }, { operation: 'read', itemId: '../escape' }, ['C08.path-validation']);
const persisted = { messageId: 'assistant-2', context: { agentId: 'agent', topicId: 'default' }, content: '终态', finishReason: 'stop',
  history: [{ id: 'user-1', role: 'user', content: '用户', timestamp: 1 },
    { id: 'assistant-2', role: 'assistant', content: '终态', timestamp: 2, isThinking: false },
    { id: 'pending', role: 'assistant', content: 'pending', isPendingStream: true },
    { id: 'thinking', role: 'assistant', content: 'thinking', isThinking: true }] };
pair('c08-appdata', 'c08-transient-filter', 'history-persistence', { projected: persisted },
  { projected: { ...persisted, context: { topicId: 'default' } } }, ['C08.transient-filter']);
pair('c08-appdata', 'c08-history-preserve-unknown', 'history-persistence',
  { projected: persisted, durableHistory: [{ id: 'user-1', role: 'user', content: '并发编辑', timestamp: 1, custom: { keep: true } }] },
  { projected: persisted, durableHistory: { invalid: true } }, ['C08.unknown-field-preservation']);

const requestInput = { assistantId: 'msg_1730000003000_assistant_ef45gh6',
  context: { agentId: ' agent ', agentName: ' Demo ', topicId: ' default ', isGroupMessage: false },
  modelConfig: { model: 'fixture-model', temperature: 0, top_p: '', top_k: null, max_tokens: 60000, stream: true },
  messages: [{ role: 'system', content: 'persona', attachments: ['private'] },
    { role: 'user', content: [text('用户')], name: '用户', id: 'user-id', isThinking: false,
      __vcpchatTimestampMeta: { messageId: 'user-id', role: 'user', timestamp: 1730000002000 } }] };
pair('c09-connection', 'c09-request-id-extensions', 'frontend-request', requestInput,
  { assistantId: 'assistant-other', messages: [{ role: 'user', content: 'hi' }], modelConfig: { stream: 'true', top_p: 0 }, context: {} },
  ['C09.assistant-request-id', 'C09.extensions', 'C09.optional-parameters']);
pair('c09-connection', 'c09-message-whitelist', 'frontend-request',
  { ...requestInput, messages: [{ role: 'assistant', content: [text('前'), image], tool_calls: [{ id: 'tool1' }], tool_call_id: 'tool1', attachments: [1], private: 'drop' }] },
  { ...requestInput, messages: [null, { role: 'user', content: { text: 'object text' }, private: 'drop' }] }, ['C09.message-whitelist', 'C09.single-text-fold']);
pair('c09-connection', 'c09-chatvcp-switch', 'frontend-url', { url: 'localhost:6005/old?x=1', enabled: true },
  { url: 'https://example.test/custom', enabled: 'true' }, ['C09.chatvcp-switch']);
pair('c09-connection', 'c09-url-empty-invalid', 'frontend-url', { url: '   ', enabled: false },
  { url: 'http://', enabled: false }, ['C09.url-normalization']);
const chunks = [{ choices: [{ delta: { content: 'choices' } }], delta: { content: 'delta' }, content: 'content', raw: 'raw' },
  { delta: { content: 'delta' }, content: 'content' }, { content: 'content' }, 'string', { raw: 'raw' }];
pair('c09-connection', 'c09-primary-chunk-priority', 'frontend-chunk', { chunks },
  { chunks: [{ choices: [{ delta: { content: '' } }], content: 'must not win' }, { raw: 'broken', error: 'json_parse_error' }, { raw: 'no', error: true }, { content: 42 }] },
  ['C09.primary-extract-priority']);
pair('c09-connection', 'c09-fallback-chunk-priority', 'frontend-chunk', { chunks, fallback: true },
  { fallback: true, chunks: [{ choices: [{ delta: { content: '' } }], content: 'fallback' }, { raw: 'broken', error: 'json_parse_error' }] }, ['C09.fallback-extract-priority']);
pair('c09-connection', 'c09-main-sse-consumer', 'frontend-sse',
  { lines: [': keepalive', 'data: {"content":"正常"}', 'data: [DONE]', 'data: {"content":"ignored"}'] },
  { lines: ['data:{"content":"no-space ignored"}', 'data: {broken', 'data: '] }, ['C09.sse-json-failure', 'C09.sse-done']);
pair('c09-connection', 'c09-interrupt-http', 'frontend-interrupt',
  { settings: { vcpServerUrl: 'https://example.test:6005/v1/chatvcp/completions', vcpApiKey: 'synthetic' }, assistantId: 'assistant-id' },
  { settings: { vcpServerUrl: 'https://example.test:6005/v1/chatvcp/completions', vcpApiKey: 'synthetic' }, assistantId: 'assistant-id', fail: true },
  ['C09.interrupt-5000ms', 'C09.interrupt-id', 'C09.interrupt-local-fallback']);
pair('c09-connection', 'c09-terminal-settle', 'frontend-settle', { completed: true }, { completed: false }, ['C09.settle-3000ms'],
  ['This is the post-acknowledgement terminal wait, not a total 3-second user-stop guarantee.']);

for (const [name, endpoint] of [['callback', '/plugin-callback/Tool/task'], ['allowlisted-model', '/v1/chat/completions']]) {
  pair('c11-http', `c11-bearer-${name}`, 'bearer', { key: 'synthetic', authorization: 'Bearer synthetic', path: endpoint },
    { key: 'synthetic', authorization: 'bearer synthetic', path: endpoint }, ['C11.callback-bearer', 'C11.model-auth-first']);
}
pair('c11-http', 'c11-bearer-missing-key', 'bearer', { key: '', authorization: 'Bearer ', path: '/v1/interrupt' },
  { key: 'synthetic', path: '/v1/interrupt' }, ['C11.missing-key']);
pair('c11-http', 'c11-media-namespace', 'bearer', { path: '/pw=abc/images/a.png' },
  { path: '/pw=abc/other/a.png' }, ['C11.media-bearer-boundary']);
pair('c11-http', 'c11-admin-credentials', 'admin-auth',
  { requests: [{ path: '/admin_api/status', credentials: { name: 'admin', pass: 'fixture-password' } }] },
  { requests: [{ path: '/admin_api/status', credentials: { name: 'admin', pass: 'wrong' } }] }, ['C11.admin-basic-decision']);
pair('c11-http', 'c11-admin-public', 'admin-auth',
  { requests: ['/AdminPanel/login.html', '/AdminPanel/VCPLogo2.png', '/AdminPanel/favicon.ico', '/AdminPanel/style.css', '/AdminPanel/woff.css', '/AdminPanel/font.woff2'].map(path => ({ path })) },
  { requests: [{ path: '/AdminPanel/login.html/extra' }, { path: '/AdminPanel/secret', headers: { accept: 'application/json' } }] }, ['C11.admin-public-exact', 'C11.admin-json-accept']);
pair('c11-http', 'c11-admin-cookie', 'admin-auth',
  { requests: [{ path: '/admin_api/status', headers: { cookie: 'admin_auth=' + encodeURIComponent('Basic ' + Buffer.from('admin:fixture-password').toString('base64')) } }] },
  { requests: [{ path: '/admin_api/status', credentials: { name: 'admin', pass: 'wrong' }, headers: { cookie: 'admin_auth=' + encodeURIComponent('Basic ' + Buffer.from('admin:fixture-password').toString('base64')) } }] }, ['C11.admin-header-precedence']);
pair('c11-http', 'c11-admin-not-configured', 'admin-auth',
  { configured: false, requests: [{ path: '/admin_api/status' }] },
  { configured: false, requests: [{ path: '/AdminPanel/index.html' }] }, ['C11.admin-503']);
const invalidCredentials = { name: 'admin', pass: 'wrong' };
pair('c11-http', 'c11-admin-wrong-threshold', 'admin-auth',
  { requests: [{ path: '/admin_api/status', credentials: invalidCredentials, count: 5 }, { path: '/admin_api/status', credentials: invalidCredentials }] },
  { requests: [{ path: '/admin_api/system-monitor', credentials: invalidCredentials, count: 6 }] }, ['C11.admin-five-wrong-block', 'C11.readonly-not-counted']);
pair('c11-http', 'c11-admin-no-credential-threshold', 'admin-auth',
  { requests: [{ path: '/admin_api/status', count: 100 }, { path: '/admin_api/status' }] },
  { requests: [{ path: '/admin_api/system-monitor', count: 101 }] }, ['C11.admin-hundred-missing-block', 'C11.readonly-requires-auth']);
pair('c11-http', 'c11-admin-readonly-block-boundary', 'admin-auth',
  { requests: [{ path: '/admin_api/status', credentials: invalidCredentials, count: 5 }, { path: '/admin_api/system-monitor' }] },
  { requests: [{ path: '/admin_api/status', credentials: invalidCredentials, count: 5 }, { path: '/admin_api/verify-login' }] }, ['C11.readonly-bypass-block-not-auth']);

const pipelineAnchors = [
  [1, 770, 773, 'this.responseReplayCache.replay'], [2, 800, 808, 'activeRequests.set'],
  [3, 857, 872, 'contextTokenLimit'], [4, 881, 893, 'redirectModelForBackend'],
  [5, 901, 916, 'consumeVcpToolUseForbiddenPlaceholder'], [6, 946, 954, "executeMessagePreprocessor('VCPTavern'"],
  [7, 964, 990, 'semanticModelRouter.resolveRoute'], [8, 1044, 1133, 'replaceAgentVariables'],
  [9, 1134, 1166, 'TransBase64+ Cleanup'], [10, 1169, 1178, 'applyDetectorsToMessages'],
  [11, 1180, 1192, 'enableRoleDivider'], [12, 1194, 1203, 'delete message.name'],
  [13, 1205, 1218, 'oneRingResponseMeta'], [14, 1230, 1230, 'projectToolBatchForUpstream'],
  [15, 1242, 1262, 'fetchWithRetry'], [16, 1383, 1388, 'new StreamHandler'],
  [17, 1491, 1523, 'handoffGate.dispose'],
].map(([id, startLine, endLine, text]) => ({ id, path: 'modules/chatCompletionHandler.js', startLine, endLine, text }));
pair('c10-pipeline', 'c10-seventeen-stage-order', 'static-order',
  { anchors: pipelineAnchors, order: pipelineAnchors.map(value => value.id) },
  { anchors: pipelineAnchors, order: [1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17] }, ['C10.seventeen-stage-order'],
  ['Static source-location evidence only; no claim that every feature-dependent branch ran.']);
pair('c10-pipeline', 'c10-preserved-placeholder-slots', 'static-order',
  { anchors: pipelineAnchors, order: pipelineAnchors.map(value => value.id) },
  { anchors: pipelineAnchors, order: pipelineAnchors.filter(value => ![1, 6, 7, 9, 10, 13].includes(value.id)).map(value => value.id) }, ['C10.placeholder-slots'],
  ['M1 no-op slot preservation is approved design. This negative candidate omits deferred upstream stages; no M1 runtime is implemented by this test.']);
const nestedPipeline = [
  { id: 'variables', path: 'modules/chatCompletionHandler.js', startLine: 1044, endLine: 1088, text: 'replaceAgentVariables' },
  { id: 'ordered-loop', path: 'modules/chatCompletionHandler.js', startLine: 1090, endLine: 1102, text: 'for (const name of orderedPipeline)' },
  { id: 'static-placeholder', path: 'modules/chatCompletionHandler.js', startLine: 1103, endLine: 1113, text: 'injectStaticPluginPlaceholdersInMessages' },
];
pair('c10-pipeline', 'c10-variable-static-substages', 'static-order',
  { anchors: nestedPipeline, order: ['variables', 'ordered-loop', 'static-placeholder'] },
  { anchors: nestedPipeline, order: ['static-placeholder', 'variables', 'ordered-loop'] }, ['C10.variable-static-placement']);
pair('c05-interrupt', 'c05-nonstream-no-handoff', 'static-occurrences',
  { text: 'handoffGate', sources: [{ repository: 'VCPToolBox', path: 'modules/handlers/nonStreamHandler.js', startLine: 1 }] },
  { text: 'handoffGate', sources: [{ repository: 'VCPToolBox', path: 'modules/handlers/streamHandler.js', startLine: 1 }] }, ['C05.nonstream-no-gate'],
  ['Static source occurrence evidence; full streaming and nonstreaming recordings are separate.']);
const authAnchors = [
  { id: 'admin', path: 'server.js', startLine: 841, endLine: 841, text: 'app.use(adminAuth)' },
  { id: 'redirect', path: 'server.js', startLine: 846, endLine: 852, text: "app.use('/AdminPanel'" },
  { id: 'bearer', path: 'server.js', startLine: 859, endLine: 883, text: 'authHeader !==' },
  { id: 'special-model', path: 'server.js', startLine: 886, endLine: 886, text: 'app.use(specialModelRouter)' },
];
pair('c11-http', 'c11-auth-route-order', 'static-order',
  { anchors: authAnchors, order: ['admin', 'redirect', 'bearer', 'special-model'] },
  { anchors: authAnchors, order: ['admin', 'redirect', 'special-model', 'bearer'] }, ['C11.auth-before-routing']);

const m1Mapping = [
  ['1 重放缓存', '空链占位', '空实现'], ['3 contextTokenLimit', '实现', '实现'],
  ['4 模型重定向', '实现（语义路由延后）', '实现 ModelRedirect.json；语义路由延后 M3'],
  ['5 VCPToolUseForbidden/TransBase64', '实现 + 空链占位', 'TransBase64 还原 M1 空链'],
  ['6 VCPTavern', '空链占位', '空实现'], ['8 预处理管线', '实现', '实现管线框架'],
  ['10 Detector', '空链占位', '空实现'], ['11 RoleDivider', '实现', '实现标记包裹'],
  ['13/17 OneRing', '空链占位', '空实现'], ['其余', '实现', '完整实现'],
].map(([step, mode, sourcePhrase]) => ({ step, mode, sourcePhrase }));
pair('c10-pipeline', 'c10-m1-mapping', 'm1-mapping', { candidate: m1Mapping },
  { candidate: m1Mapping.map(item => item.step === '3 contextTokenLimit' ? { ...item, mode: '空链占位', sourcePhrase: '空实现' } : item) },
  ['C10.m1-mapping-markers'], ['Approved-design table validation only; it does not execute or claim an Omnia M1 implementation.']);

pair('c02-stdio', 'c02-maid-valet', 'parsed-args',
  { text: '<<<[TOOL_REQUEST]>>>tool_name:「始」Tool「末」 valet:「始」Alice「末」<<<[END_TOOL_REQUEST]>>>' },
  { text: '<<<[TOOL_REQUEST]>>>tool_name:「始」Tool「末」 valet:「始」Alice「末」 maid:「始」Bob「末」<<<[END_TOOL_REQUEST]>>>' }, ['C02.valet-maid-mirror']);
pair('c02-stdio', 'c12-format-undefined', 'format-result', {}, { value: false }, ['C12.result-undefined']);
pair('c09-connection', 'c09-assistant-id-origin', 'frontend-assistant-origin',
  { userId: 'msg_1730000002000_user_ab12cd3' }, { userId: 'other-user-id' }, ['C09.assistant-request-id-origin']);
const prepare = { requestId: 'assistant-id', action: 'prepare_handoff', handoffId: 'h', revision: 1 };
pair('c05-interrupt', 'c05-route-handoff', 'interrupt', { handoff: true, requests: [prepare, prepare] },
  { handoff: true, requests: [prepare, { ...prepare, handoffId: 'other' }] }, ['C05.route-control', 'C05.duplicate', 'C05.revision-conflict']);
pair('c05-interrupt', 'c05-route-handoff-missing', 'interrupt', { missing: true, requests: [prepare] },
  { aborted: true, handoff: true, requests: [prepare] }, ['C05.route-request-not-found', 'C05.route-request-stopped']);
pair('c05-interrupt', 'c05-route-handoff-invalid', 'interrupt', { handoff: true, requests: [{ ...prepare, action: 'READY' }] },
  { handoff: true, requests: [{ ...prepare, revision: 0 }] }, ['C05.route-invalid-action', 'C05.invalid-handoff']);
pair('c11-http', 'c11-admin-success-clears-wrong-count', 'admin-auth',
  { requests: [{ path: '/admin_api/status', credentials: invalidCredentials, count: 4 },
    { path: '/admin_api/status', credentials: { name: 'admin', pass: 'fixture-password' } }] },
  { requests: [{ path: '/admin_api/status', credentials: invalidCredentials, count: 4 },
    { path: '/admin_api/status' }] }, ['C11.success-clears-wrong-count']);
pair('c11-http', 'c11-admin-readonly-all-prefixes', 'admin-auth',
  { requests: ['system-monitor', 'newapi-monitor', 'server-log', 'user-auth-code', 'weather'].map(name => ({ path: '/admin_api/' + name, credentials: invalidCredentials })) },
  { requests: [{ path: '/admin_api/systems-monitor', credentials: invalidCredentials }] }, ['C11.readonly-prefixes']);
