# Omnia · M0M1 协议契约规格 v1.2（条目定稿，产品验证未完成）

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v1.2 / 2026-11-12（M0 源码对拍勘误）/ **已冻结（C-01～C-12 条目）** |
| 适用阶段 | M0–M1；待冻结项 0；「已冻结」含义见 `README.md` §5.2、§5.3 |
| 基线 | VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` + VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（见 基线记录.md） |
| 性质 | 本文档全部条目为【已冻结】：直接从基线源码提取，标注文件:行号。实现与契约测试以本文为准；事实标注与文档状态定义见 `README.md` §5.2、§5.3 |
| 与旧 PRD 关系 | 旧 M0M1 PRD 的原【待冻结】项在本文转正；两处旧描述被更正（见 §1.0、§5.0） |
| 行号口径 | 以 git show 读取的冻结 commit 文件为准；文件名须相对仓库根唯一可定位（章节引用须写明文档名）；上游跟进时按 基线记录.md 流程与 使用与维护 §6 复核 |

---

## 1. 工具结果双通道（C-01）

### 1.0 重大更正

旧 PRD 称"回灌给模型的工具结果包裹在 `[[VCP调用结果信息汇总:` 域内"——**错误**。基线源码存在两条独立通道：

| 通道 | 载体 | 消费者 | 受 ShowVCP 控制 |
| --- | --- | --- | --- |
| 可见通道 | `[[VCP调用结果信息汇总:` 域块 + 摘要块，作为 SSE delta.content 推送 | 前端渲染 | 是（摘要块除外） |
| AI 通道 | `<!-- VCP_TOOL_PAYLOAD -->` 标记的新 user 消息 | 上游模型 | 否，恒发 |

### 1.1 可见域单块模板【vcpInfoHandler.js:96-104】

每工具一块，多工具 = 多块顺序拼接，**无编号、无参数字段**：

```
\n[[VCP调用结果信息汇总:\n- 工具名称: {toolName}\n- 执行状态: {✅|❌} {SUCCESS|ERROR}\n- 返回内容: {readableContent}\nVCP调用结果结束]]\n
```

- status 取 executor 层 `result.success ? 'success' : 'error'`【streamHandler.js:698】；内层 `success:false` 判失败【toolExecutor.js:506-509】；顶层 `status:error` 在 Plugin.js:1537-1553 转异常，同样 ❌ ERROR
- 深层 `isToolResultError`【chatCompletionHandler.js:289-326】只影响摘要与循环判定：先看 success / status:'success'/'ok' / ok:true 判成功，再看 error:true / success:false / status:'error'/'failed'/'failure' / ok:false / 400≤code<600 判失败

readableContent 提取优先级【vcpInfoHandler.js:14-86】：

1. `content[].text` 以 `\n` join
2. `result[].text`
3. `result.content[].text`
4. `result` 字符串
5. `message` 字符串
6. `original_plugin_output`（SciCalculator 特判正则 `###计算结果：(.*?)###`）
7. `content` 字符串
8. 兜底 `JSON.stringify`

仅兜底 JSON 序列化分支将含 `;base64,` 或以 `data:image/` 开头的字符串替换为 `[Base64 Data Ignored] (Length: N)`；前述直接字符串或 text/content/result 提取分支保留原文。空结果 → `插件执行完毕，但没有返回明确内容。`。**域内只有纯文本，image_url 块不进域。**

### 1.2 批次包裹与摘要【toolResultBatch.js:33-49】

```
\n<<<[VCP_TOOL_BATCH_START:{ts}]>>>\n{body}\n<<<[VCP_TOOL_BATCH_END:{ts}]>>>\n
```

- `ts`：ISO 毫秒 + 时区偏移（DEFAULT_TIMEZONE 缺省 Asia/Shanghai，Intl en-GB/h23/longOffset）；全局单调递增 `lastTimestampMs = max(now, last+1)`；与正文碰撞则重生成【toolResultBatch.js:39-44】
- 启用 RoleDivider 时外层再包 `\n<<<[ROLE_DIVIDE_USER]>>>\n{batch}\n<<<[END_ROLE_DIVIDE_USER]>>>\n`
- `body = parts.join('')`（各域块 + 摘要块）
- **摘要块恒追加（ShowVCP 关时也有）**【streamHandler.js:703-705】：

```
\n[本轮工具调用摘要:]\n{items.join('；')}。\n[本轮工具调用摘要结束]\n
```

item = `{name} {调用成功|调用失败|调用拒绝|调用超时}{有recordId时: " (记录ID: {id})"}`；判定顺序：先 isError，再 rejected_by_user / error_type:'approval_rejected' / 拒绝正则，再超时正则【streamHandler.js:688-694】。

### 1.3 AI 通道消息构造【streamHandler.js:711-733；nonStreamHandler.js:495】

每轮先 push assistant 消息（本轮模型输出），再**追加一条新 `role:'user'` 消息**：

- **无 image_url**：content 为字符串 `<!-- VCP_TOOL_PAYLOAD -->\n` + `JSON.stringify(contentArray)`（单行紧凑 JSON）。replacer：键为 `url`/`image_url` 且值以 `data:` 开头 → 替换为 `"[Omitted]"`
- **有 image_url**：content 为数组 `[{type:'text', text:'<!-- VCP_TOOL_PAYLOAD -->\nResults:'}, ...各工具 content 块]`；开启多模态翻译时经 MultiModalProcessor/ImageProcessor，`+` 模式再追加原图块【streamHandler.js:135-180】
- `contentArray = toolResults.map(r => r.content).flat()` + archery 错误块。**无编号、无工具名/参数包装**；工具名仅出现在错误文本/审核留言中

单工具结果格式【toolExecutor.js:519-565】：富 content 数组原样保留；否则 `JSON.stringify(result, null, 2)`；null/undefined → `(无返回内容)`。

错误格式【toolExecutor.js:567-603】：`[{type:'text', text:'[错误] ' + displayText}]`；displayText 剥 `执行错误: ` 前缀后解析 JSON 取 `plugin_error`；有 `user_feedback` 且未包含则追加 `\n用户反馈: {fb}`。

上游投影【toolResultBatch.js:105-129】：发送前 `projectToolBatchForUpstream` 把 assistant/user 文本中被 ROLE_DIVIDE 包裹（或整条 user 即批次）的 START/END 标记改写为 `【工具返回批次开始｜时间：{ts}】` / `【工具返回批次结束｜时间：{ts}】`；`<!-- VCP_TOOL_PAYLOAD -->` 开头的消息跳过投影。

### 1.4 archery / no_reply 语义

- 解析：`archery:true` 或 `archery:no_reply`【toolCallParser.js:507-509】；`separate()` 分流【:697-700】
- **archery 成功：不进 AI 通道、不触发再循环**，仅 WS 广播
- archery 失败：生成 `{type:'text', text:'[异步工具 "{name}" 返回了错误，请注意]:\n' + content[0].text}`【streamHandler.js:557-560】
- 纯 archery 且有错误/留言 → 追加 assistant + user（`<!-- VCP_TOOL_PAYLOAD -->\n` + JSON.stringify(错误块数组)）再请求一轮【:579-631】；纯 archery 全成功 → 直接 stop + [DONE]【:640-656】
- no_reply 静默回执【Plugin.js:1774-1796, 1901-1916】：宽限 `archeryNoReplyGraceMs` 缺省 3000ms 无响应 / 进程 exit 0 / 首个 success JSON → resolve `{status:'success', __vcpArcheryNoReplySilent:true, result:{status:'success', noReply:true, toolName, message:...}}`；executor 推 WS `TOOL_NO_REPLY_ACCEPTED`【toolExecutor.js:484-502】，AI 完全无感
- 可见域：archery 仅 `isError || markHistory` 时生成【streamHandler.js:566-570】；`ink:mark_history` 可在 ShowVCP 关时强制单工具可见【toolCallParser.js:510-511】

### 1.5 审核留言追加位置【toolExecutor.js:524-541】

- suffix = `\n\n【用户审核留言：已允许本次工具调用】\n{feedback}`，追加到富 content **最后一个 text 块**尾部；无 text 块则 push `suffix.trimStart()`；非富结果追加到 JSON 文本尾
- `__vcpApprovalFeedback` 字段本身从展示中剔除
- archery 专用块：`【用户审核留言：已允许工具 "{toolName}" 调用】\n{feedback}`【:512-514】，只回灌留言不回灌业务输出【streamHandler.js:561-564】；错误路径同样追加该工具名版留言【:589-591】

---

## 2. 插件 stdin payload 与执行环境（C-02）

### 2.1 payload = 裸参数 JSON，无信封

**stdin 就是工具参数对象本身的紧凑 JSON，无 requestId/maid 包装/工具名字段。**

构造【modules/pluginBridgeRegistry.js:344-365】：

```js
const executionParam = Object.keys(toolArgs).length > 0 ? JSON.stringify(toolArgs) : null;
```

写入【Plugin.js:1929-1933】：`stdin.write(inputData.toString())` 后 `stdin.end()`；**无尾随换行**；空参数 → 不写直接 end。

顶层字段 = 解析出的 args 键值，经以下增删：

| 字段 | 来源 |
| --- | --- |
| 业务参数（command、filePath1…） | 工具块 `key:「始」value「末」` 字段【toolCallParser.js:483-542】 |
| `maid` | 调用方显式传入；非空 `valet` 存在且 maid 缺失或为空字符串时镜像【parser:538-540】，原样透传【Plugin.js:1336-1339】 |
| `river_context` | river=full/text/last:N/semantic:N 时注入消息数组【toolExecutor.js:242-361】（M2 消费，M1 透传） |
| `vref_files` | vref 解析出的 file:// URL 数组【toolExecutor.js:370-380】（M2） |
| `tool_password` | VCPToolCode 开启时校验后 **delete**【toolExecutor.js:713-722】 |
| `timely_contact` | 存在即拦截为定时任务，不执行插件【toolExecutor.js:393-401】（M3 调度器） |

调用者 IP 不走 stdin，走环境变量 `VCP_REQUEST_IP`；requestId 仅存在于审核/中断链路，不进 payload。

示例：`{"command":"列出目录","filePath1":"D:/notes","maid":"Alice"}`

### 2.2 环境变量合并顺序【Plugin.js:1643-1740】

1. `envForProcess = {...process.env}`
2. 覆盖 pluginConfig 各键（`String(value)`）；`_getPluginConfig`【Plugin.js:213-257】：仅 configSchema 声明键，取值 插件 config.env > process.env（全局 config.env 已加载入 process.env），integer/boolean 强转，DebugMode 特判
3. additionalEnv 最后覆盖【:1723】：`PROJECT_BASE_PATH`、`DECRYPTED_AUTH_CODE`（requiresAdmin 插件，取不到则拒绝执行）、`VCP_REQUEST_IP`、`SERVER_PORT`(=PORT)、`IMAGESERVER_IMAGE_KEY/FILE_KEY`、白名单插件的 `SSH_MANAGER_SOCK/TOKEN`、`LOG_MONITOR_SOCK/TOKEN`；异步插件加 `CALLBACK_BASE_URL`（插件配置 > 全局 env）与 `PLUGIN_NAME_FOR_CALLBACK`；恒加 `PYTHONIOENCODING='utf-8'`

### 2.3 spawn 与 stdout 契约

- spawn【Plugin.js:1731-1740】：`entryPoint.command.split(' ')` 首段命令其余参数；`cwd=插件目录, shell:true, windowsHide:true, detached:非win32`
- 超时：`communication.timeout || 同步 60000 / 异步 1800000`【:1753】
- stdout：同步插件 exit 时整体 `JSON.parse(outputBuffer.trim())`；**JSON 状态优先于退出码**【:1880-1894】；stderr 非空附 `pluginStderr`
- `status!=='success'` → 抛 `{result?, plugin_error: error || 'Plugin "X" reported an unspecified error.'}` JSON 串【pluginBridgeRegistry.js:371-384】
- `result` 为字符串时再 JSON.parse，失败包 `{original_plugin_output}`【:386-400】

---

## 3. 工具指令注入模板（C-03）

### 3.1 单命令模板【Plugin.js:1056-1091 buildVCPDescription】

```
- {displayName} ({name}) - 命令: {cmd.command || 'N/A'}:
{description 每行前缀 4 空格}
  调用示例:
{example 每行前缀 4 空格}
```

精确规则：

- 标题行用 **`command` 字段，不是 `commandIdentifier`**（后者仅用于注册表/JEV【Plugin.js:2200】）
- description 每行前缀 4 空格；example 头为 `\n  调用示例:\n`（2 空格缩进），example 每行 4 空格
- 无 description 的命令跳过；无 example 则不输出示例段
- 同插件多命令以 `\n\n` 连接；存入 Map，键 `VCP{plugin.name}` → 占位符 `{{VCP{name}}}`
- 多插件顺序 = plugins Map 插入序（目录发现序）
- 生成时机：插件发现/热重载后【Plugin.js:1037】

### 3.2 占位符替换规则【messageProcessor.js:1053-1092】

- `{{VCP{name}}}`：**首个出现展开**（replaceFirstPlaceholder），跨消息重复出现一律替换为空串（expandedVcpTools 去重）；描述为空 → `[{key} 信息不可用]`
- `{{VCPAllTools}}` = 全部描述按 Map 序 `join('\n\n---\n\n')`；空则 `没有可用的VCP工具描述信息`；同样首处展开其余置空
- `{{VCPDynamicTools}}` 走 dynamicToolRegistry.buildInjection【:1033-1051】（M3）
- 替换时机：**消息预处理管线内部**的逐消息变量替换【messageProcessor.js:351 replaceOtherVariables】，不是独立步骤

### 3.3 static 占位符与 TVStxt

- 静态插件占位符（getAllPlaceholderValues，含 TVStxt 工具箱）由 `preprocessor_order.json` 中的虚拟阶段 `$StaticPlaceholderInjection` 注入，**仅 system 消息**，首处展开 + 去重 + 动态折叠协议【chatCompletionHandler.js:1092-1113、messageProcessor.js:775-860】
- TVStxt/ 是静态文档块目录，由 tvsManager/toolboxManager 读取，经 `{{alias}}` / `{{toolbox:alias}}` 展开【messageProcessor.js:320-345】

---

## 4. ShowVCP 可见性与 SSE 事件序列（C-04）

### 4.1 开关与端点差异

- `SHOW_VCP_OUTPUT = (process.env.ShowVCP || "False").toLowerCase() === "true"`【server.js:376】
- 端点唯一差异【server.js:1239-1264】：`/v1/chat/completions → handle(req,res,false)`；`/v1/chatvcp/completions → handle(req,res,true)`；`shouldShowVCP = SHOW_VCP_OUTPUT || forceShowVCP`【chatCompletionHandler.js:727】
- **开**：每个普通工具生成 §1.1 域块 + 恒有摘要块 → 批次 chunk
- **关**：域块不生成（例外 `ink:mark_history` 强制单工具可见），但普通调用轮的**摘要块仍推送**【streamHandler.js:703-707 无条件】；纯 archery 全成功时 visibleToolResults 为空 → 不发批次
- AI 通道 payload 与 ShowVCP 完全无关
- WS 侧通道（vcp_log 广播、生命周期 VCPInfo、TOOL_NO_REPLY_ACCEPTED）不受 ShowVCP 控制，恒发

### 4.2 流式事件序列（每轮）

1. 上游 chunk 逐行直通转发（reasoning 按配置转标签；**上游 [DONE] 被吞掉不下发**）
2. 期间每 5s 注释心跳 `: vcp-keepalive\n\n`【modules/handlers/streamHandler.js:297-305】
3. 90s 无上游 chunk → 发 `\n[上游响应超时，流已中断]` stop chunk + [DONE]【modules/handlers/streamHandler.js:191,310-338】
4. 工具轮结束：批次 chunk（id `chatcmpl-vcp-batch-{ts}`，delta.content = 整批文本【streamHandler.js:536-547】）→ 分隔符 chunk（delta.content = `'\n'`，id `chatcmpl-VCP-separator-{ts}`）→（handoff 等待，§5）→ 下一轮上游流
5. 终结：无工具调用 → `finish_reason:'stop'` chunk（id `chatcmpl-VCP-final-stop-{ts}`）+ `data: [DONE]`；达 maxRecursion（缺省 5）→ `finish_reason:'length'`【:788-799】
6. 响应头 `x-vcp-tool-loop-handoff: '1'` 声明交接能力【:797-799, 1358-1361】

非流式：所有轮 AI 文本 + 批次文本按序 `join('')` 覆盖最终 `choices[0].message.content`；finish_reason 按是否达上限取 length/stop【nonStreamHandler.js:540-558】。

---

## 5. interrupt 与交接门控（C-05）

### 5.0 重大更正

旧 PRD 称"READY 握手机制【细节待冻结】"。实际：**READY 由客户端发出**（`action:'prepare_handoff'`），服务器从不发 READY；服务器仅在流式响应头回 `x-vcp-tool-loop-handoff: '1'` 声明能力。路由【server.js:1064-1190】，请求体 `requestId || messageId` 必需，缺失 → 400 `{error:'requestId or messageId is required.'}`。**两种模式**：

### 5.1 带 action = 交接预约（READY 门控）

路由前置校验【server.js:1071-1086】：

- action 非 `prepare_handoff|cancel_handoff` → 400 `{success:false, code:'INVALID_ACTION'}`
- 无 context 或 res 已结束/销毁 → 404 `REQUEST_NOT_FOUND`
- 已 aborted 或无 gate → 409 `REQUEST_STOPPED`
- 否则 `receipt = handoffGate.control(body)`，200（success）或 409

门控状态机【modules/vcpLoop/handoffGate.js:16-38】：

```js
if (typeof handoffId !== 'string' || !handoffId || handoffId.length > 128
    || !Number.isSafeInteger(next) || next < 1) return { success:false, code:'INVALID_HANDOFF' };
if (stopped()) return { success:false, code:'REQUEST_STOPPED' };
if (next < revision) return { success:false, code:'STALE_REVISION' };
if (next === revision) return last?.action === action && last?.handoffId === handoffId
    ? { success:true, duplicate:true } : { success:false, code:'REVISION_CONFLICT' };
if (action === 'cancel_handoff' && last && last.handoffId !== handoffId)
    return { success:false, code:'STALE_HANDOFF' };
revision = next; last = { action, handoffId }; ready = action === 'prepare_handoff';
return { success:true, state: ready ? 'armed' : 'cancelled', revision };
```

- revision：单调防重放/防乱序；同 revision 同内容 = 幂等 duplicate；同 revision 异内容 = 冲突
- 等待语义【handoffGate.js:42-64】：armed 后，工具批次与分隔符已发、**下一轮上游 fetch 派发前** `isReady() → wait()`【streamHandler.js:599, 745】；最多 `timeoutMs=2000ms`，超时 **fail-open 一次性解除**（ready=false）；期间 abort → 抛 `AbortError('Request stopped during handoff')`；cancel_handoff 唤醒等待
- **非流式 handler 不使用门控**

### 5.2 无 action = 硬中止

顺序【server.js:1091-1182】：`context.aborted=true` → `abortController.abort()`（级联取消上游 fetch；循环每轮检查 aborted，流读取器销毁 body）→ `setImmediate` 关闭响应：

| 状态 | 行为 |
| --- | --- |
| 头未发 + 原请求 stream:true | 200 SSE：chunk `{id:'chatcmpl-interrupt-{ts}', object:'chat.completion.chunk', created, model, choices:[{index:0, delta:{content:'请求已被用户中止'}, finish_reason:'stop'}]}` + `data: [DONE]` |
| 头未发 + 非流式 | 200 JSON `{choices:[{index:0, message:{role:'assistant', content:'请求已被用户中止'}, finish_reason:'stop'}]}` |
| 头已发且 SSE | 仅 `[DONE]` + end |
| 其他 | end |

重复中止跳过；1000ms 后从 activeRequests 删除。

interrupt 自身响应：200 `{status:'success', message:'Interrupt signal sent for request {id}.'}`；找不到 → 404 `{status:'error', message:'Request {id} not found or already completed.'}`【server.js:1185-1188】。

客户端断联走同一中止链（reason：request_aborted / request_close_after_abort / response_close_before_finish【chatCompletionHandler.js:813-847】）。

---

## 6. dotenv 补丁语义（C-06）

入口【server.js:3-5】：先 `require('./modules/dotenvPatch.js')` 再 `dotenv.config({path:'config.env'})`（adminServer.js:7 同）。补丁只重写 `dotenv.parse`，**不改覆盖语义**：dotenv 默认不覆盖已存在的 process.env 键（真实环境变量优先）。**单个文件解析时，重复键最后一次赋值生效**【modules/dotenvPatch.js:20-43，循环中 obj[key] = value】；环境覆盖和文件内部重复键是两个独立步骤。

核心正则【modules/dotenvPatch.js，全文 49 行】：

```js
const CUSTOM_LINE = /(?:^|^)\s*(?:export\s+)?([\w.@#%&^+_\-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
```

语义逐条：

1. 键字符集扩为 `[\w.@#%&^+_\-]+`（支持 `@ # % & ^ + - _`，标准 dotenv 不允许）
2. 可选 `export ` 前缀；`=` 或 `:` 分隔
3. 值支持单引号/双引号/反引号包裹（剥外层引号）
4. **仅双引号**展开 `\n`→换行、`\r`→回车（不处理 `\'` 等其它转义）
5. 未加引号的值在 `#` 处截断（行内注释）
6. CRLF/CR 归一为 LF；值 trim；空值 → 空串
7. 同文件重复键取最后值，例如 `A=first\nA=last` 解析为 `{A:"last"}`；真实环境已存在 A 时，默认 config 加载仍保留环境值
8. 主配置为根 `config.env`；插件配置为 `Plugin/<目录>/config.env`【Plugin.js:905-906】。本契约不新增 `.env` 文件名别名；插件 configSchema 的取值规则见 C-02

---

## 7. 工具审核 M1 最小语义（C-07）

### 7.1 配置文件全文【toolApprovalConfig.json】

```json
{
  "enabled": true,
  "timeoutMinutes": 5,
  "approveAll": false,
  "fuzzyToolMatching": false,
  "privacyProtection": { "enabled": false },
  "approvalList": [
    "PowerShellExecutor",
    "ServerPowerShellExecutor",
    "FileOperator",
    "ServerFileOperator"
  ]
}
```

加载【toolApprovalManager.js:125-157】：enabled/approveAll/fuzzyToolMatching Boolean 化，timeoutMinutes||5，approvalList/whitelist 数组化；另支持 allowChainedCommandWhitelist、debugMode、privacyProtection.enabled；chokidar 热重载（M3）。

### 7.2 匹配规则（M1 只实现第一级）

按工具名大小写不敏感【:333-335】。完整三级规则【:247-300】：`ToolName`(specificity 1) / `ToolName:Command`(2) / `ToolName:ParamKey:[pattern]`(3，默认前缀、`=x` 精确、含 `*` 通配)；后缀 `::SilentReject` → notifyAiOnReject:false。取最高 specificity，同级静默优先【:495-508】；白名单 specificity≥命中规则则豁免【:527-537】；approveAll:true → 全部需审核（specificity 0）。

**开关关闭**：`enabled:false → {requiresApproval:false, notifyAiOnReject:true, ...}` 直接放行【:480-482】。

### 7.3 拒绝回灌精确文本【Plugin.js:1979-1986】

```js
const rejectionMessage = normalizedReason
    ? `Manual approval was REJECTED by user. User reason: ${normalizedReason}`
    : 'Manual approval was REJECTED by user.';
approval.reject(new Error(JSON.stringify({
    plugin_error: rejectionMessage,
    error_type: 'approval_rejected',
    rejected_by_user: true
})));
```

经 processToolCall catch 补 MaidName/timestamp → executor → AI 收到 `[错误] Manual approval was REJECTED by user.[ User reason: ...]`；可见摘要记 `调用拒绝`。

- SilentReject（M3）：无留言 → return undefined，archery 完全静默，普通工具 AI 收到 `(无返回内容)`；有留言 → 抛 `{plugin_error:'Tool call "X" was REJECTED by manual approval. User feedback: fb', error_type:'approval_rejected', rejected_by_user:true, user_feedback:fb}`【Plugin.js:1444-1449】
- 超时【Plugin.js:1364-1379；时长来自 toolApprovalManager.js:566-568】：`{plugin_error:'Manual approval for "X" timed out after N minutes.'}`
- 允许且带留言 → 结果附 `__vcpApprovalFeedback` → §1.5 留言排版
- 审核请求经 WS `broadcast({type:'tool_approval_request', data:{requestId, toolName, maid, args, changePreview?, timestamp, approvalTtlMs}}, 'VCPLog')`【:1385-1398】；应答走 handleApprovalResponse(requestId, approved, reason)

### 7.4 M1 实现边界

**最小保留**：enabled 开关 + approvalList 工具名匹配（第一级）+ §7.3 拒绝 JSON/`[错误]` 文本 + 超时文本 + 放行路径。M1 无 WS 审核 UI，审核请求以"配置 approveAll=false + 默认拒绝策略"或 headless 自动应答测试夹具替代（US-012 定义）。

**M3 补齐**：命令级/参数级规则、whitelist、glob、SilentReject、approveAll、privacyProtection、fuzzyToolMatching、changePreview、WS UI/TTL 补发缓存、热重载。

---

## 8. 前端数据格式（C-08，VCPChat 基线）

### 8.0 实况声明

VCPChat 仓库 AppData/ 被 .gitignore 忽略（仅保留官方预设/示例），无真实用户数据样本。以下格式由**写入逻辑代码 + tests/ 夹具**重建，字段名全部有源码出处。M1 实现后须用真实原版客户端产生的数据做往返验证（US-018）。

### 8.1 AppData 目录结构【main.js:316-337】

根目录 = `<项目根>/AppData`，可用环境变量 `VCPCHAT_APP_DATA_DIR` 整体重定向。

```
AppData/
├─ settings.json                     # 全局设置
├─ songlist.json                     # 音乐播放列表（M5）
├─ avatarimage/<agentName>.<ext>     # 中心化头像副本
├─ Agents/<agentId>/
│  ├─ config.json                    # Agent 配置 + 话题元数据
│  ├─ config.json.lock/.tmp/.backup  # 锁/原子写/备份
│  ├─ config.topic.backup.json       # 删话题前备份
│  ├─ avatar.png|jpg|gif|webp
│  └─ mood.json                      # 长期心情（M1 只读忽略）
├─ AgentGroups/<groupId>/config.json # 群组（M1 忽略）
└─ UserData/
   ├─ user_avatar.png
   ├─ attachments/<sha256><原扩展名>  # 内容寻址附件，全局去重
   └─ <agentId|groupId>/topics/<topicId>/history.json
```

命名规则：

- agentId：`_Agent_<名称净化[a-zA-Z0-9_-]>_<Date.now()>`；纯中文名 `_Agent_<ts>_<ts+1>`【agentHandlers.js:567-571】。**Windows 上目录名强制小写**【agentConfigManager.js:22-24】，Linux 保留原大小写——Omnia 挂载时按平台匹配
- topicId：新建 `topic_<Date.now()>`【chatHandlers.js:754】；初始话题固定 `"default"`【agentHandlers.js:586】；侧聊 `sidechat_<ts>_<hex>`（M1 忽略）
- 路径段校验：禁止 `<>:"/\|?*`、控制字符、结尾点/空格、DOS 保留名【historyMutationQueue.js:8-16】
- 可选 Rust sidecar VCP-CDS 做历史加速（HTTP 127.0.0.1，protocol v3）；文件格式不变，M1 直接读文件

### 8.2 话题元数据（config.json → topics[] 元素）【chatHandlers.js:737-772】

| 字段 | 类型 | 必填 | 语义 |
| --- | --- | --- | --- |
| id | string | 是 | `topic_<ts>` 或 `"default"` |
| name | string | 是 | 标题；默认 `新话题 N` / `主要对话` |
| createdAt | number | 是 | epoch 毫秒 |
| locked | bool | 兼容默认 true | 锁定（防自动清理），读时补默认 |
| unread | bool | 兼容默认 false | 未读标记 |
| creatorSource | string | 兼容默认 'unknown' | UI 创建为 `"ui"` |
| flowlockRequest | object | 可选 | Flowlock 集成（M1 忽略） |

**排序即数组顺序**，新话题插到最前【:776】；重排 IPC save-topic-order【:465-495】；删除最后一个话题自动补建 `主要对话`【:813-817】。

### 8.3 history.json【historyMutationQueue.js:52-129】

**顶层就是消息数组** `[...]`，无包装对象；2 空格美化 JSON；写入 = 临时文件 + rename 原子替换；读时非数组即报错；文件不存在返回 `[]`。

单条消息字段全表：

| 字段 | 类型 | 必填 | 语义/出处 |
| --- | --- | --- | --- |
| id | string | 是 | `msg_<ts>_user_<rand7>` / `msg_<ts>_assistant_<rand7>`【chatManager.js:1892,2013】 |
| role | string | 是 | user/assistant/system |
| name | string | 常见 | 显示名：用户=settings.userName，助手=Agent 名 |
| content | string \| parts[] | 是 | 原始文本（含工具标记）或多模态数组 `[{type:'text',text},{type:'image_url',image_url:{url:'data:...;base64,...'}}]`【chatContextPipeline.js:199-214】 |
| timestamp | number | 是 | epoch 毫秒 |
| attachments | array | 可选 | 见 §8.4 |
| replyToMessageId | string | 助手 | 指向用户消息 id【chatManager.js:2021】 |
| agentId / topicId | string | 助手 | 归属【:2022-2023】 |
| finishReason | string | 助手终态 | 流结束原因【streamTransientHistory.js:82】 |
| isThinking | bool | 瞬态 | 占位"思考中"，落盘终态 false |
| isPendingStream | bool | 瞬态 | 流进行中占位，finalize 时 delete；持久化过滤两者【chatHistoryPersistence.js:38】 |
| edited / feedback | bool/string | 可选 | 编辑标记、点赞 'liked' |
| contextCompaction / __vcpContextCheckpoint | object/bool | 可选 | 压缩快照检查点（M2+） |
| __vcpchatTimestampMeta | object | 可选 | {messageId,role,timestamp}，发送时转 extensions |
| tool_calls / tool_call_id | array/string | 可选 | 发送白名单内保留兼容，主链路不用 |

**工具过程/思考链 = content 内嵌文本标记**（不是独立 JSON 字段）：

- 工具批次：`<<<[VCP_TOOL_BATCH_START:<id>]>>>` … `<<<[VCP_TOOL_BATCH_END:<id>]>>>`【renderer/toolBatchRegions.js:5-15】
- 工具结果：`[[VCP调用结果信息汇总:` … `VCP调用结果结束]]`，可嵌套；隐藏态前缀 `[HIDDEN]`【renderer/toolResultRegions.js:30-31,231】
- 元思考链：`[--- VCP元思考链 ---]` … `[--- 元思考链结束 ---]`【contextSanitizer.js:209】

### 8.4 attachments 元素【fileManager.js:118-130】

UI 层 `{type, src:'file://…', name, size, _fileManagerData}`；`_fileManagerData` 全字段：`id:'attachment_<hash>'`、name、internalFileName、internalPath:'file://…'、type(MIME)、size、hash(sha256)、createdAt、extractedText、imageFrames(PDF 转图 base64[])、pdfMeta。

### 8.5 Agent 配置（Agents/<id>/config.json）【agentHandlers.js:580-588】

前端 Agent 与后端 VCPToolBox 的 Agent/ TVS 模板目录**无关**；人设通过 systemPrompt 随请求发送。写入为 tmp→校验→backup→原子 move【agentConfigManager.js:162-207】。

| 字段 | 类型 | 默认 | 语义 |
| --- | --- | --- | --- |
| name | string | 必填 | 显示名 |
| systemPrompt | string | `你是 <name>。` | 人设 |
| model | string | gemini-2.5-flash-preview-05-20 | 模型 |
| temperature | number | 0.7 | |
| contextTokenLimit | number | 1000000 | 上下文预算，随请求发后端 |
| maxOutputTokens | number | 60000 | → 请求 max_tokens |
| topics | array | 必填 | §8.2 |
| disableCustomColors / useThemeColorsInChat | bool | true | 主题 |
| streamOutput | bool | 缺省=流式 | 【chatContextPipeline.js:218-221】 |
| top_p / top_k | number | 可选 | 【:238-246】 |
| avatarCalculatedColor | string | 可选 | 头像取色回写 |

头像不在 JSON 里：文件 `Agents/<id>/avatar.<ext>`，运行时算 avatarUrl（file:// + mtime 版本号）。列表排序存 settings.json.agentOrder（id 数组）；Agent/Group 混合排序 combinedItemOrder。

### 8.6 样本（字段真实、正文占位）

```json
// Agents/_agent_demo_1730000000000/config.json（节选）
{ "name": "Demo", "systemPrompt": "<提示词>", "model": "gemini-2.5-flash-preview-05-20",
  "temperature": 0.7, "contextTokenLimit": 1000000, "maxOutputTokens": 60000,
  "topics": [ { "id": "topic_1730000001000", "name": "新话题 2", "createdAt": 1730000001000,
                "locked": true, "unread": false, "creatorSource": "ui" },
              { "id": "default", "name": "主要对话", "createdAt": 1730000000000 } ] }
```

```json
// UserData/_agent_demo_1730000000000/topics/default/history.json
[ { "role": "user", "name": "用户", "content": "<用户文本>", "timestamp": 1730000002000,
    "id": "msg_1730000002000_user_ab12cd3", "attachments": [] },
  { "role": "assistant", "name": "Demo", "content": "<回复文本，可含工具批次标记>",
    "timestamp": 1730000003000, "id": "msg_1730000003000_assistant_ef45gh6",
    "replyToMessageId": "msg_1730000002000_user_ab12cd3", "agentId": "_agent_demo_1730000000000",
    "topicId": "default", "finishReason": "completed", "isThinking": false } ]
```

---

## 9. 前端→后端连接契约（C-09）

Electron 版渲染进程不直接发 HTTP，经 IPC sendToVCP 由主进程 fetch【preloads/api/chat.js:56；chatHandlers.js:1126】。Omnia 复刻时以下 HTTP 契约即需实现的全部。

### 9.1 聊天请求【chatHandlers.js:1234-1450】

- URL：settings.vcpServerUrl，保存时强制规范化为 `<scheme>://<host>/v1/chat/completions`【settingsManager.js:15-30】；`settings.enableVcpToolInjection===true` 时路径改写为 **`/v1/chatvcp/completions`**
- Headers：`Content-Type: application/json`、`Authorization: Bearer <vcpApiKey>`
- Body：

```json
{ "messages": [ {"role":"system","content":"<systemPrompt+注入>"}, {"role":"user","content":"…"} ],
  "model": "…", "temperature": 0.7, "max_tokens": 60000, "contextTokenLimit": 1000000,
  "top_p": 0.9, "top_k": 40, "stream": true,
  "requestId": "msg_1730000003000_assistant_ef45gh6",
  "vcpchatExtensions": {
    "schemaVersion": 1, "messageMetadataMode": "hash_only",
    "requestContext": { "requestId": "同上", "agentId": "…", "agentName": "…",
                        "topicId": "…", "ownerType": "agent", "isGroupMessage": false },
    "messageTimestampBindings": [ { "messageId": "msg_…", "role": "user", "timestamp": 1730000002000,
        "timestampIso": "2026-…Z", "source": "client_history",
        "sentMessageHash": "sha256:<hex>", "sentMessageIndex": 1 } ] } }
```

关键语义：

- **requestId = 助手占位消息 id**（`msg_<ts>_assistant_<rand7>`【chatManager.js:2013,2130】），非用户消息 id；无独立 messageId 字段
- **Agent 信息双通道**：人设塞 messages[0] system【chatContextPipeline.js:411-412】；agentId/topicId 等走自定义字段 vcpchatExtensions.requestContext【chatHandlers.js:75-121】，不进 messages
- 空值可选参数发送前剔除【chatHandlers.js:131-154】
- messages 白名单脱敏：仅 role/content/name/tool_calls/tool_call_id；单 text 部分的多模态数组折叠为字符串【:1179-1206】
- 附件在渲染侧已转为文本标注 `[附加文件: file://…]` + image_url base64 parts【chatContextPipeline.js:113-214】

### 9.2 SSE 消费【ipc/chatHandlers.js:1532-1573；modules/chat/contentRuntime.js:3-11；modules/renderer/streamManager.js:391-394】

- 主进程按行拆 `data: `，`[DONE]` → end；每 chunk JSON.parse 后推 `{type:'data'|'end'|'error', chunk, messageId, context, streamOperationId}`；解析失败发 `{raw, error:'json_parse_error'}`
- 响应头 `x-vcp-tool-loop-handoff: '1'` 标记交接支持（M1 前端可忽略）
- 主路径按 `typeof === 'string'` 依次取 `chunk.choices[0].delta.content`、`chunk.delta.content`、`chunk.content`、字符串 chunk、无 error 的 `chunk.raw`；空字符串命中即返回，不向后回退。`json_parse_error` 和带 error 的 raw 不显示。
- 备用 streamManager 路径才使用 `||` 提取链，空字符串会向后回退；同样抑制解析错误。两个路径分别保留 fixture，不能将备用路径的优先级代替主路径。
- **没有单独的 reasoning/tool SSE 字段消费**——工具过程与思考链全部在累计 content 的文本标记中识别（§8.3 标记），按区间渲染成工具气泡；终态把全文 + finishReason 写回 history【streamTransientHistory.js:79-94】

### 9.3 中断【interruptHandler.js:18-31；chatHandlers.js:1655-1700】

- 时机：用户点停止 → interrupt(助手占位消息 id)
- 请求：`POST <origin>/v1/interrupt`，Bearer 同 Key，body `{"requestId":"<助手消息id>"}`，5s 超时（INTERRUPT_TIMEOUT_MS=5000）
- 主进程 HTTP 最多等待 5s，finally 取消本地流【ipc/chatHandlers.js:1688,1705-1709】。UI 先等待 interrupt；成功后才额外等待最多 3s 的终态（INTERRUPT_SETTLE_MS=3000）【modules/chat/chatManager.js:2166-2181】。3s 不是从点击停止开始的总时限。

### 9.4 设置项（AppData/settings.json）【appSettingsManager.js:260-279】

| 字段 | 默认 | 语义 |
| --- | --- | --- |
| vcpServerUrl | '' | 完整聊天 URL（自动补全 /v1/chat/completions） |
| vcpApiKey | '' | Bearer Key |
| userName | '用户' | 用户消息 name |
| enableVcpToolInjection | false | 切换 /v1/chatvcp/completions |
| fileKey / vcpLogUrl / vcpLogKey | '' | 图床密码 / WS 地址与鉴权（M3） |
| agentOrder / combinedItemOrder | — | 列表排序 |
| topicSummaryModel | gemini-2.5-flash-preview-05-20 | 话题标题生成模型 |

---

## 10. 实际处理管线（C-10，更正旧 7 步描述）

旧 PRD 的"7 步管线"与基线源码有出入。实际顺序【server.js + chatCompletionHandler.js】：

```
Bearer 中间件【server.js:859-883，跳过 admin/图床/文件路径】
→ specialModelRouter 中间件【:886】
→ handler：
  1 响应重放缓存命中检查
  2 activeRequests 注册 + 断联监听
  3 contextTokenLimit 修剪
  4 模型重定向（语义路由模型延后）+ ChinaModel 思维控制
  5 VCPToolUseForbidden / TransBase64 占位符扫描
  6 VCPTavern 优先预处理
  7 语义路由定模型
  8 按 preprocessor_order.json 的有序预处理管线
    （占位符替换嵌在管线内部：逐消息变量替换 + $StaticPlaceholderInjection 虚拟阶段，仅 system）
  9 TransBase64+ 还原
  10 Detector / SuperDetector
  11 RoleDivider 终段（skipCount:1）
  12 清理 message.name
  13 OneRing meta 冻结
  14 projectToolBatchForUpstream
  15 上游 fetchWithRetry（头透传，剔除 hop-by-hop）
  16 Stream/NonStream 工具循环
  17 后处理：OneRing 提交、重放缓存录制、handoffGate.dispose、activeRequests 清理
```

**M1 裁剪映射**（管线骨架 1:1，阶段可空实现但位置保留）：

| 步骤 | M1 处理 |
| --- | --- |
| 1 重放缓存 | 空实现（接口保留，M3+） |
| 3 contextTokenLimit | 实现（前端会发该字段） |
| 4 模型重定向 | 实现 ModelRedirect.json；语义路由延后 M3 |
| 5 VCPToolUseForbidden/TransBase64 | 占位符扫描实现；TransBase64 还原 M1 空链 |
| 6 VCPTavern | 空实现（M4） |
| 8 预处理管线 | 实现管线框架 + preprocessor_order.json 读取；M1 链上仅 $StaticPlaceholderInjection + 逐消息变量替换 |
| 10 Detector | 空实现（M3+） |
| 11 RoleDivider | 实现标记包裹（§1.2 依赖） |
| 13/17 OneRing | 空实现（M3 多 Agent） |
| 其余 | 完整实现 |

---

## 11. fixture 规范与契约测试映射

### 11.1 目录与命名

```
contract/fixtures/
├── c01-injection/     # 双通道：可见域/AI payload/批次/摘要/archery/留言
├── c02-stdio/         # payload 构造/env 合并/stdout 解析
├── c03-instructions/  # 指令模板/占位符去重
├── c04-sse/           # 事件序列/ShowVCP 开关/心跳/超时
├── c05-interrupt/     # 硬中止四态/门控状态机全分支
├── c06-dotenv/        # 补丁语义边界
├── c07-approval/      # 开关/匹配/拒绝文本/超时
├── c08-appdata/       # 话题/Agent/history 读写往返
├── c09-connection/    # 请求体/SSE 消费/中断参数
├── c10-pipeline/      # 17 步管线骨架顺序、M1 裁剪映射、空链占位
├── c11-http/          # Bearer/Basic、回调认证、特殊模型路由、管理面入口
└── c12-parser/        # 工具块/字段/转义/思考剥离/结果格式化
```

命名：`<契约号>-<场景>-<pos|neg>.json`（如 `c01-multi-tool-pos.json`）；每个 fixture 附 `.meta.json` 记录来源（基线录制 / 按源码构造 + 出处行号）。

### 11.2 覆盖要求（每条规则 ≥1 正例 +1 反例）

- C-01：单/多工具域块逐字符、摘要四态、base64 占位、AI payload 紧凑 JSON 与 [Omitted]、有/无 image_url 两形态、archery 成功静默/失败回灌、纯 archery 终结、留言追加位置（富/非富/无 text 块）
- C-02：空参数不写 stdin、无尾随换行、maid/valet 镜像、env 三级覆盖顺序、JSON 优先于退出码（双向）、result 字符串二次解析
- C-03：command vs commandIdentifier、4 空格缩进、example 头 2 空格、多命令 \n\n、首处展开其余置空、VCPAllTools 分隔符、空描述占位
- C-04：ShowVCP 开/关域块差异、摘要恒发、mark_history 强制可见、上游 [DONE] 吞掉、心跳格式、90s 超时文本、批次/分隔符/final-stop chunk id 格式、length 终结
- C-05：硬中止四态逐字节、重复中止、404 文案、门控 8 分支（INVALID_HANDOFF/REQUEST_STOPPED/STALE_REVISION/duplicate/REVISION_CONFLICT/STALE_HANDOFF/armed/cancelled）、2s fail-open、非流式不走门控
- C-06：扩展键字符集、export 前缀、冒号分隔、三种引号、仅双引号转义、行内注释截断、CRLF 归一、真实 env 优先、同文件重复键最后值、插件 config.env 路径（≥12 边界用例）
- C-07：enabled=false 放行、工具名大小写不敏感、拒绝 JSON 三字段、reason 有无两态、超时文案
- C-08：topics[] 读时补默认、history 顶层数组、瞬态字段过滤、原子写、Windows 小写目录、default 话题补建
- C-09：requestId=助手消息 id、vcpchatExtensions 结构、chatvcp 路径切换、白名单脱敏、SSE 提取优先级链、中断 5s/3s 语义
- C-10：17 步管线顺序骨架（占位符替换嵌于预处理管线内部）、M1 裁剪映射表逐步的「实现 / 空链占位」标记、骨架位置保留（≥1 正例 +1 反例）

- C-11：回调/白名单模型未认证均 401；正确 Bearer 才进入业务校验；管理 Basic/公开资源/只读限流边界；禁止因内部回调或路由白名单豁免认证
- C-12：规范与容错标记、缩进/转义、特殊字段、思考保护域、富结果/错误格式、并发结果顺序

### 11.3 录制与对拍

- 契约已冻结，录制降级为**验证手段**：recorder 对原版服务器录制真实报文，与按本文构造的 fixture 对拍，发现差异即修订本文（走基线记录流程）
- 工具循环对拍：mock 上游（固定响应序列）消除模型随机性，比对调用序列、AI payload、可见批次文本
- 前端数据往返：原版 VCPChat 真实产生的 AppData → Omnia 读取-修改-写回 → 原版 reopen 校验

## 12. HTTP 认证与路由边界（C-11）

【已冻结；2026-11-12 源码复核】来源：VCPToolBox 冻结基线的 `server.js:134-138,634-652,665-886,1369-1374`。原版 API_ROUTES 文档仅为辅助资料，旧“回调免认证”和“白名单先于认证”描述失效。

### 12.1 入口顺序与职责

已知基线顺序：CORS/body → IP 追踪/黑名单 → draining 门控 → adminAuth → /AdminPanel 重定向 → 通用 Bearer → specialModelRouter → 业务路由。require 路由模块的位置不等于挂载位置。

- 主端口的 /AdminPanel 在管理认证后重定向到 PORT+1，保留路径与查询串；主服务不直接托管该静态目录【server.js:843-851】。原生管理界面的承接另见 SC-01。
- draining 放行 interrupt/回调等清理请求，仅表示不被停机门控拦截，不豁免后续认证。完整运行生命周期由 SC-14 细化，不把它误写成认证白名单。

### 12.2 通用 Bearer

- 比较 `Authorization` 与 `Bearer <Key>` 精确相等；Key 未配置、头缺失或错误均为 401，JSON 为 `{"error":"Unauthorized (Bearer token required)"}`。
- 通用 Bearer 明确跳过 /admin_api、/AdminPanel（由管理认证负责），以及 `/pw=<key>/images/`、`/pw=<key>/files/` 命名空间；不表示媒体路径没有自己的密钥校验。
- **POST /plugin-callback/:pluginName/:taskId 必须使用 Bearer 认证**。错误凭据在业务 handler 前返回 401；正确凭据后再执行路径/插件/JSON 校验。
- specialModelRouter 在 Bearer 后挂载；模型白名单是路由策略，不能绕过认证。

### 12.3 管理认证与失败计数

- 先 Header Basic，缺失时再读取 `admin_auth` Cookie（URL 解码后的 Basic 值）；管理凭据未配置返回 503。
- 登录公开资源精确清单：login.html、VCPLogo2.png、favicon.ico、style.css、woff.css、font.woff2，均位于 /AdminPanel/。
- system-monitor/newapi-monitor/server-log/user-auth-code/weather 五个 /admin_api/ 前缀免失败计数及临时封禁检查，**不免凭据校验**。
- 15 分钟窗口：错误凭据第 5 次登记封禁 30 分钟；无凭据使用独立计数，第 100 次登记封禁 15 分钟。触发请求仍进入认证失败响应；后续被封禁请求返回 429 和 Retry-After。认证成功清除错误凭据计数。
- 未认证管理 API（含 verify-login）返回 401 `{"error":"Unauthorized"}`，不加 WWW-Authenticate；页面请求重定向登录页。JSON Accept 分支与精确响应体须在 US-006 基线录制用例中覆盖【server.js:812-827】。

## 13. 工具解析与结果格式化（C-12）

本节从原 M0M1 PRD §2.1–2.4、§2.6 收敛为唯一协议定义，保留已记录规则。源码定位：VCPToolBox 的 `modules/vcpLoop/toolCallParser.js`、`modules/vcpLoop/toolMarkerFuzzyMatcher.js`、`modules/vcpLoop/toolExecutor.js`。fixture 与原版录制仍由 US-003～006 验证，不代表 Omnia 已实现。

### 13.1 块标记【已验证：modules/vcpLoop/toolCallParser.js / modules/vcpLoop/toolMarkerFuzzyMatcher.js】

- 规范起始标记：`<<<[TOOL_REQUEST]>>>`；结束标记：`<<<[END_TOOL_REQUEST]>>>`
- 容错模式（配置开关，默认关闭）：块标记正则 `<{2,4}\[TOOL_REQUEST\]>{2,4}`（结束同理），大小写不敏感；没有外侧边界，5 个或更多尖括号中仍可匹配该子串。规范模式的 indexOf 同样允许规范标记两侧存在额外尖括号。
- 一条响应可含多个工具块，顺序解析；块内容 trim 后进入字段扫描

### 13.2 字段语法【已验证】

- 形式：`key:「始」value「末」`，字段间以空白或逗号分隔
- key 正则：`^[\w_]+`；key 后允许空白，必须紧跟 `:`，冒号后允许空白
- 容错模式字段标记候选：`「始」`、`{始}`、`{始」`、`「始}`（结束同理）；更宽的模糊正则 `^[「{]始(?!ESCAPE)(?:[^\r\n「{]*?[」}])`
- 值规范化（禁止全量 trim）：仅剥离首行紧贴标记的一个 `\r?\n`，剥离末尾一个换行及尾随空白；**保留各行前导缩进**（代码参数保真）
- 特殊字段（不进 args）：

| 字段 | 语义 |
| --- | --- |
| `tool_name` | 必需，工具名；缺失则整块丢弃 |
| `archery` | `true`=射后不理（不等待回灌）；`no_reply`=静默接收【toolCallParser.js:507-509】 |
| `ink` | `mark_history`=标记历史（ShowVCP 关时强制可见，C-04 §4.1） |
| `river` / `vref` | 记忆/引用寻址字段（M2 消费，M1 透传保存） |
| `jev` | 无 tool_name 时升级为虚拟工具 JEV（args.expression=值）；有 tool_name 时作为普通参数（延迟裁决，消除顺序敏感） |
| `valet` | 非空中性署名；args.maid 缺失或为空字符串时镜像一份到 maid【parser:538-540】 |

- 解析产物结构：`{name, args, archery, archeryNoReply, markHistory, river, vref}`
- `separate()`：按 archery 分为 normal / archery 两组【parser:697-700】
- args 保留 JavaScript 对象语义：字符串赋值 `__proto__` 不生成 own key；整数索引键按 JS 枚举顺序排列，其余键保持首次插入顺序；同名赋值更新值。

### 13.3 转义机制【已验证】

- 转义域：`「始ESCAPE」...「末ESCAPE」`；`{始ESCAPE}` 等变体始终识别、大小写不敏感，不受工具标记 fuzzy 开关控制。
- 转义域内的结束标记不终止外层块（_findBlockEnd 跳过逻辑）
- 还原映射：`<<<[TOOL_REQUEST_ESCAPE]>>>`→`<<<[TOOL_REQUEST]>>>`、`<<<[END_TOOL_REQUEST_ESCAPE]>>>`→`<<<[END_TOOL_REQUEST]>>>`、`「始ESCAPE」`→`「始」`、`「末ESCAPE」`→`「末」`，规范映射全量替换；其余 ESCAPE 变体仅分别还原首个起始和结束标记。
- Omnia `escape_value` 在原文外包转义域；`unescape_value` 接收域内文本并执行上述原版还原。任意 ESCAPE 结束标记不构成通用无损编码；不得据此扩大协议承诺。

### 13.4 思考块剥离（stripReasoningBlocks）【已验证，行为规格】

解析前必须先剥离思考内容，规则按源码实现逐条对齐：

1. 标签模式：`<[ \t]*(\/?)[ \t]*(think(?:ing)?|thought|antthinking)\b(?:[ \t]+[^>\r\n<]*?)?[ \t]*>`，大小写不敏感，支持嵌套深度计数
2. 保护域（depth=0 时生效）：
   - 工具结果域 `[[VCP调用结果信息汇总:` ... `VCP调用结果结束]]`（嵌套感知）
   - Markdown 围栏代码块 ``` 与 ~~~（行首 0-3 空格缩进、闭合长度≥开启长度、流尾未闭合围栏保护到文末）
   - 行内反引号代码（同段落内、等长闭合；豁免颜文字 ``(`・ω・´)ゞ`` 等 4 种）
   - 顶层已确立的完整工具请求块
3. 无头思考泄漏：从未闭合过任何思考块时出现行首/行尾的闭合标签 → 丢弃开头至该标签的全部内容
4. 句中内联开标签且后续无配对闭合 → 判为正文自指字面量，放行不进入深度
5. 行首开启的真实思考流未闭合 → 保守丢弃尾部
6. VCP元思考链明文块：独占行 `[--- VCP元思考链(: "...")? ---]` 至 `[--- 元思考链结束 ---]` 整块剥离；未闭合则丢弃其后内容。meta 预清理先于工具候选保护，工具值内独占行 meta 也可能被清理；其自身识别的代码/结果保护域内文本保留。

保护域仅约束思考剥离，不保证后续工具 parser 跳过该区间；代码/结果域中保留的工具块仍可能被解析。行边界和空白依冻结 JS `/gm` 语义，包含 CR、LS、PS 及相应跨行空白行为；不能缩窄为仅 LF。

### 13.5 结果格式化（_formatResult）【已验证：modules/vcpLoop/toolExecutor.js:519-565】

- null/undefined → `(无返回内容)`
- 富内容数组（`result.data.content` 或 `result.content` 为数组）→ 原样保留多模态块，仅最后一个 text 块可附加审核留言；text 摘要取第一个 text 块，无则 `[Rich Content]`
- 对象 → `JSON.stringify(x, null, 2)`；字符串 → 原样
- 内层 `success:false` 必须透传为失败（审核拒绝反馈依赖此标志）
- 错误格式：`[错误] {plugin_error}`，有 user_feedback 追加 `\n用户反馈: {fb}`【toolExecutor.js:567-603】
- 批量执行：`executeAll` = 全部工具调用并发（Promise.all 语义 → Rust join_all）


## 14. 修订记录

- v1.2（2026-11-12）：依据 M0 固定 fixture、冻结源码差分与原版 HTTP 录制，勘误 C-01 base64 分支、C-04/C-07 出处、C-09 主/备用 SSE 和中断时序、C-12 子串/ESCAPE/maid/JS 对象及保护域规则。未更换基线，证据与限制见 [fixture 报告](fixture-report.md)。
- v1.1（2026-11-12）：纠正重复键和插件 config.env 路径；新增 C-11 认证/路由事实，收敛 C-12 解析与格式化；扩展 fixture 要求。其余历史冻结条目仍须 US-006 录制验真，不能因本次局部复核推定全库已经实测。

---

内容由 AI 生成
