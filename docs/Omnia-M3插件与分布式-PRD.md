# Omnia · M3 插件引擎全量与分布式 PRD v1.6

> 本文件定义 M3 阶段目标，产品尚未实现。M1 最小审核与 HTTP 认证以 C-07/C-11 为准；M3 增量契约由 US-201 从冻结源码提取。技术选型保持既定方案。

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v1.6 / 2026-11-12（同步架构 v2.6 定案）/ **部分冻结** |
| 适用阶段 | M3；剩余【待冻结】由 US-201 滚动冻结，未冻结禁止实现（见 `README.md` §5.2） |
| 范围对应 | 后端模块见 `docs/Omnia-复刻范围与对应矩阵.md` §3.2、§3.4；偏差登记见其 §6.2 |
| 1:1 基线 | VCPToolBox commit `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c`（与 M0M1/M2 同基线；事实须逐项核验，不从文件 diff 未变推断既有描述正确） |
| 前置依赖 | M0M1 PRD（协议循环/stdio 插件/认证）+ M2 PRD（direct 宿主/记忆双通道）完成 |
| 源码位置 | `D:\code\github\VCPToolBox`（Plugin.js、WebSocketServer.js、FileFetcherServer.js、modules/toolApprovalManager.js、asyncResultStore.js、dynamicToolRegistry.js、routes/taskScheduler.js、docs/DISTRIBUTED_ARCHITECTURE.md、PLUGIN_ECOSYSTEM.md、TOOL_APPROVAL_REASON_PROTOCOL.md）+ `D:\code\github\VCPChat\VCPDistributedServer`（VCPDistributedServer.js 955 行、Plugin.js、plugins.json、config.env.example；行号以冻结 commit 为准） |
| 事实标注 | 【已验证】= 基线源码/文档确认；【待冻结】= US-201 补齐，未冻结禁止实现 |

---

## 1. 范围与优先级

### P0（M3 必须）

1. 插件类型补全：asynchronous（回调）、messagePreprocessor（链）、service（路由注册）、hybridservice 完整接口
2. Manifest 完整 Schema（dependencies/lifecycle/compatibility）+ 三层配置级联 + 环境变量注入 + 生命周期管理
3. WebSocket 服务器：6 类客户端、VCP_Key 认证、广播、心跳、断线清理
4. 分布式工具执行：注册、执行、结果、取消、超时、节点生命周期（含安全绑定）
5. FileFetcher 透明跨节点文件访问
6. 工具人工审核全量（reason 协议、变更预览、TTL、隐私过滤）
7. 任务调度器（定时工具调用）
8. admin_api 插件管理补全 + 预处理器顺序管理

### P1

ChromeBridge Observer/Control 通道路由、动态工具注册表（ToolBridge catalog）、论坛 API、插件预热进程池。

论坛 API 的 US-217 是 M4 US-324 的硬前置：若未在 M3 完成，必须排在 US-324 前完成，不能随 P1 标签跳过。其他 P1 延期进入 SC-16；server-log/system-monitor 与 dailynotes/knowledge-base 管理端点由 P0 US-214 按冻结清单承接

### P2

语义模型自动路由、自动备份/容灾编排、VCPMobile 兼容验证进入 SC-14，由 US-201 补规格、US-427 核验完成。

Top-20 高频插件 Rust 原生化是可选内部优化，不是功能范围缩减；不原生化也须通过兼容宿主覆盖原有能力。Top-20 对拍只作阶段抽样，冻结基线 96 个插件目录的最终覆盖归 SC-16

**IN-3 插件能力沙箱（创新条目，架构 §1.3，扩展层 opt-in、默认关闭，M3 完成后独立立项；偏差登记 DV-13，启用条件/回退/验收见 `docs/Omnia-复刻范围与对应矩阵.md` §6.2）**：WASM 运行时（wasmtime）+ manifest 能力声明（文件系统/网络/模型调用按需授权），沙箱执行；冷启动、体积及平台覆盖目标须以实测报告证明。Node/Python sidecar 兼容层长期保留，存量插件渐进迁移不强制。偏差声明：原版插件全权限子进程（契约 C-02）→ Omnia 可选能力受限执行；启用沙箱的插件须通过能力声明校验，未声明能力默认拒绝。安全增强类偏差，对齐 M5 Widget DSL 先例。

**IN-4 工具协议双轨（创新条目，架构 §1.3，实现层，M3 完成后独立立项；优化登记 DV-14，默认文本通道；能力探测与等价性门禁通过后可启用原生通道，回退 = 文本标记兼容通道，验收 = 双通道行为 diff 为零 + 契约 fixture 全过，见 `docs/Omnia-复刻范围与对应矩阵.md` §6.2）**：按模型能力自动路由——支持原生 function calling 且通过等价性验证的模型可走结构化内部通道，其余走文本标记通道；对外 SSE 报文、可见域/摘要、AI payload 语义与契约 C-01/C-04 完全一致（原版前端无感）。验收：双通道对同一工具集的行为 diff 为零 + 契约 fixture 全过。ModelAdapter 当前设计签名不宣称已有能力探测方法；该扩展实施前须单独冻结能力探测、流式失败和回退契约。

---

## 2. 插件类型规格（补全 M1/M2 之外的四类）

### 2.1 asynchronous【已验证：PLUGIN_ECOSYSTEM.md §2.3 + Plugin.js】

- 执行：spawn 后等待**首个合法 JSON**（status success/error）即 resolve，进程可继续后台运行（非守护线程）；默认超时 1800000ms（manifest 可覆盖）
- 初始响应：`{status, result:{requestId, message}, messageForAI?}`
- 环境注入：`CALLBACK_BASE_URL`、`PLUGIN_NAME_FOR_CALLBACK`
- 完成回调：`POST /plugin-callback/:pluginName/:taskId`，body `{requestId, status:"Succeed"/..., pluginName, ...业务字段}`；需要全局 Bearer 认证（C-11），内部来源不构成豁免
- 回调存储【已验证：asyncResultStore.js】：文件式 JSON，`<pluginName>-<taskId>.json` 与 `<taskId>.json`；taskId/pluginName 路径安全校验（UNSAFE_PATH→400）；插件不存在→404；非 JSON 对象→400
- archery no_reply：宽限期默认 3000ms 静默接收（以 M1 契约为前置，M3 接异步路径）；初始 JSON success 或 exit 0 均可触发静默 resolve
- 超时语义：初始响应未发出→超时 kill 进程树并 reject；已发出→进程继续，仅日志

### 2.2 messagePreprocessor【已验证：§2.5】

- direct 协议，导出 `processMessages(messages, config)`，返回处理后的 messages
- 执行顺序：`preprocessor_order.json` 配置，admin_api 可读写顺序
- 生命周期钩子：lifecycle.loadCache=initialize / saveCache=shutdown
- 错误隔离：单个预处理器失败不阻断请求链（记录日志，跳过该器）【策略待冻结：核对基线行为】

### 2.3 service【已验证：§2.4】

- direct 协议常驻模块，导出 `initialize(config, dependencies)`、可选 `shutdown()`、`registerApiRoutes(router, config, projectBasePath, webSocketServer)`
- 路由挂载点：`/api/plugins/<PluginName>/...`
- capabilities.services 声明服务清单；图床/文件服务走 `/pw=<key>/images|files/*`（URL 密钥认证，M1 已列豁免路径）

### 2.4 hybridservice 完整接口【已验证：§2.6】

- M2 的侧车宿主与原生记忆路径为前置；M3 补全 `processMessages` + `processToolCall` + 占位符三能力。`isDynamic` 只是 manifest 声明，基线引擎不消费此字段；动态替换由插件的 `processMessages` 自行完成（如 ChromeBridge），宿主不得因该字段自动执行求值

---

## 3. Manifest 完整 Schema 与配置

### 3.1 扩展字段【已验证：§3.6-3.8】

```json
{
  "dependencies": { "npm": ["ssh2"], "pip": ["requests"], "system": ["ffmpeg"] },
  "lifecycle": { "loadCache": "initialize", "saveCache": "shutdown" },
  "compatibility": { "vcpVersion": ">=1.0.0", "nodeVersion": ">=14.0.0", "pythonVersion": ">=3.8" }
}
```

dependencies 检查与 compatibility 门控的精确行为（缺失时拒绝加载还是告警）【待冻结：US-201 从 Plugin.js 提取】。

### 3.2 配置级联【定义源：C-02 §2.2 / C-06；源码：Plugin.js _getPluginConfig:213-257】

优先级：`process.env`（全局 config.env 已加载）→ 插件目录 config.env 按 configSchema 取值后覆盖 → `additionalEnv` 最后覆盖；**`configSchema.default` 不生效**（原版兼容暗礁，见插件系统设计 §1.3 第 5 条）。按 configSchema 逐键取值并类型转换（integer→parseInt，boolean→字符串比较 'true'）；两级均无的键跳过（用代码默认）。原「三层 = 插件 env > 全局 env > Schema 默认值」的表述作废，与 C-02 统一。

### 3.3 执行环境变量注入【已验证：§4.3】

PROJECT_BASE_PATH、PORT、SERVER_PORT（别名）、PYTHONIOENCODING=utf-8、CALLBACK_BASE_URL、PLUGIN_NAME_FOR_CALLBACK、VCP_REQUEST_IP、DECRYPTED_AUTH_CODE（requiresAdmin 插件）、IMAGESERVER_IMAGE_KEY。

### 3.4 生命周期【已验证：§5 目录；细节待冻结】

Discovery → Loading → Initialize → Execution → Shutdown；热加载（VCPPluginCreator 场景）与预热进程池（P1）的精确时序 US-201 冻结。

---

## 4. WebSocket 协议规格【已验证：DISTRIBUTED_ARCHITECTURE.md + WebSocketServer.js】

### 4.1 客户端类型与路径（VCP_Key 认证，失败即 destroy）

| 类型 | 路径正则 | 存储 |
| --- | --- | --- |
| VCPLog | `/^\/VCPlog\/VCP_Key=(.+)$/` | clients Map |
| VCPInfo | `/^\/vcpinfo\/VCP_Key=(.+)$/` | clients Map |
| DistributedServer | `/^\/vcp-distributed-server\/VCP_Key=(.+)$/` | distributedServers（serverId=dist-<clientId>） |
| ChromeObserver | `/^\/vcp-chrome-observer\/VCP_Key=(.+)$/` | chromeObserverClients |
| ChromeControl | `/^\/vcp-chrome-control\/VCP_Key=(.+)$/` | chromeControlClients + waitingControlClients |
| AdminPanel | `/^\/vcp-admin-panel\/VCP_Key=(.+)$/` | adminPanelClients |

- clientId：`Date.now().toString(36) + '-' + Math.random().toString(36).substring(2,9)`
- connection_ack：各类型确认文案 1:1；DistributedServer 附带 {serverId, clientId}
- 广播 API：broadcast(data, targetClientType?)、broadcastVCPInfo、broadcastToAdminPanel、sendMessageToClient
- 心跳：heartbeat → heartbeat_ack{timestamp}（Observer）
- 断线清理：DistributedServer 断开→注销其全部工具 + 清 IP 映射 + reject 其全部 pending；其余类型按 Map 清理
- 安全注意：VCP_Key 在 URL 中是原版设计，1:1 保留；日志必须对 Key 脱敏

### 4.2 消息类型总表（type/data 二段式）

connection_ack、heartbeat、heartbeat_ack、register_tools、report_ip、update_static_placeholders、execute_tool、tool_result、cancel_tool、command、command_result、pageInfoUpdate、page_info_update、tool_approval_request、tool_approval_response、plugin_callback_notification（webSocketPush 配置驱动）。

---

## 5. 分布式执行规格【已验证：DISTRIBUTED_ARCHITECTURE.md §4-5 + 取消附录】

1. **注册**：register_tools{tools[]} → 过滤 `internal_request_file` → pluginManager.registerDistributedTools(serverId, tools)；report_ip{localIPs, publicIP, serverName}；update_static_placeholders{serverName, placeholders}
2. **执行**：execute_tool{requestId, toolName, toolArgs}；按 serverId 或 serverName 查找；超时=插件 communication.timeout ?? 60000；pendingToolRequests Map 管理
3. **结果安全绑定**：pending 绑定目标 serverId，**只接受该节点的 tool_result**；其他节点复用 requestId 不得完成请求
4. **取消**：节点 register_tools.data.capabilities.cancelTool===true 才声明支持；服务端超时仅在 socket OPEN 且已声明能力时 best-effort 发一次 cancel_tool{requestId}；不向已关闭 socket 发帧；节点本地 deadline 独立生效
5. **断线**：目标节点断开→立即清理并 reject 其全部 pending
6. **节点侧**（VCPDistributedServer 仓库）：express body 上限 2mb；/plugin/callback 端点；internal_request_file 内置工具；原版节点不声明或处理 cancel_tool。Omnia 节点新增取消能力及本地中止生命周期属于 DV-6，不作为原版节点能力
7. **混部要求**：omnia-server 主服务器必须能接原版 Node 分布式节点；Omnia 节点端实现必须能接原版主服务器（双向验证，§10）。节点端不依赖 omnia-server/omnia-agent，桌面端内嵌与独立节点进程都能装配（架构 §5.1，SC-17）

---

## 6. FileFetcher 透明文件访问【已验证：§6 + FileFetcherServer.js】

- 流程：插件引用远程 file:// → 主服务器按请求 IP 查来源节点（findServerByIp：publicIP 或 localIPs 匹配）→ executeDistributedTool(serverId, 'internal_request_file', {fileUrl}, 60000) → 节点回 {status, fileData:Base64, mimeType} → 解码缓存
- 缓存：`.file_cache/`，键=sha256(fileUrl)+扩展名，永久；失败缓存 30s（防重复失败请求）；请求循环检测 5s（同 URL 短窗口重复→拒绝）
- 错误：IP 无对应节点、节点不在线、超时，均返回明确错误文本给插件

---

## 7. 工具人工审核规格【已验证：TOOL_APPROVAL_REASON_PROTOCOL.md + Plugin.js:1384-1398】

### 7.1 请求（广播到 VCPLog）

```json
{ "type": "tool_approval_request",
  "data": { "requestId": "approve-xxx", "toolName": "...", "maid": "...",
            "args": {...}, "changePreview": {...}?, 
            "timestamp": "本地格式化时间", "approvalTtlMs": 300000 } }
```

changePreview：稳定文件变更预览协议（前端无需了解插件参数别名）【结构待冻结：buildToolChangePreview】；`approvalTtlMs = 300000`（5 分钟），**与 M1 冻结契约 C-07 §7.1 `timeoutMinutes: 5` 对齐**（原 600000 / 10 分钟写法 2026-11-12 更正）；同步给 VCPLog 补发缓存，超时自动清除。

### 7.2 响应与行为

- `tool_approval_response {requestId, approved, reason?}`，reason 可选、向后兼容
- 拒绝+reason（规则允许通知 AI 时）：回灌 JSON 与 M1 冻结契约 C-07 §7.3 一致，**三字段** `{"plugin_error": "Manual approval was REJECTED by user. User reason: <reason>", "error_type": "approval_rejected", "rejected_by_user": true}`（字段名以契约 §7.3 代码块为准；原单字段写法作废，否则 fixture 对拍必然不一致）
- 静默拒绝规则：**仅空 reason 保持静默**；用户填写反馈优先于静默规则，仍回灌 AI
- 批准+reason：继续执行，留言以 `【用户审核留言：已允许本次工具调用】\n<reason>` 回灌；留言不进插件参数、不改成功/失败状态
- 回执追加规则（与 M1 _formatResult 一致）：旧格式文本尾部追加；OpenAI 内容数组只改最后一个 text 块（无文本块则末尾新增）；image_url 等非文本块字段/内容/顺序不变，禁止整体字符串化；失败回执也可带留言
- archery/no_reply 成功：只回灌留言，不回灌业务输出；无留言保持静默
- 留言经隐私保护过滤（toolResultPrivacyGuard）后进入后续模型请求；时机=工具执行结束/免回执确认后，不是执行前重新规划
- 审核规则配置（哪些工具需审核、静默/通知策略）【待冻结：toolApprovalManager.js 规则格式】

---

## 8. 任务调度器规格【已验证：routes/taskScheduler.js】

- node-schedule 语义（Rust 用 tokio 定时任务对齐 cron/日期触发行为）
- 任务文件持久化：{taskId, scheduledLocalTime, tool_name, toolArgs...}；启动时扫描恢复
- 执行：processToolCall(tool_name, toolArgs, null, 'scheduler')——caller_type=scheduler 落 tool_call_records
- 结果持久化：persistTimedTaskResult（status/payload/scheduledLocalTime）；执行错误 source=task_scheduler_executor_error
- API：POST /v1/schedule_task（M1 已列，M3 实现完整语义）；时间格式含时区偏移（formatToLocalDateTimeWithOffset）

---

## 9. admin_api 补全与论坛

- 插件管理补全：instruction 更新、manifest 读取（M1 已有列表/开关/config）；预处理器顺序 GET/POST
- server-log：增量读取（offset/needFullReload 语义；**精确格式【待冻结：US-201 从基线源码提取】**。原「M0M1 PRD §3 已列格式」为失效引用，2026-11-12 更正）。日志文件位置与轮转按基线对齐（`DebugLog/ServerLog.txt`，见架构 §7 日志与诊断）；每行文本格式是否属于契约由 US-201 提取本端点时决定
- 管理端口：omnia-server 同时监听 PORT 与 PORT+1（架构 §5.1）。两个端口对同一路径的行为在基线中并不完全相同，逐端点差异由 US-201 提取；提取前不实现 PORT+1 上的端点
- dailynotes/knowledge-base 管理 API（M2 引擎的管理面）：folders/files/search/move/delete-batch、browse/file/tags，按 M0M1 PRD 引用的 API_ROUTES.md 清单 1:1
- 论坛 API（P1）：posts/post/reply/like；FORUM_CONFIG 限额 1:1（内容 50000 字符、文件 2MB、maid 50 字、标题 100 字、500 楼、UID `^[a-zA-Z0-9_-]+$`、文件锁 10s、并发写 5）

---

## 10. 验证计划

1. **WS 协议契约**：6 类客户端握手/ack/广播/断线 fixture 对拍（录制原版 WS 流量）
2. **双向混部**（M3 核心验收）：
   - 原版 VCPDistributedServer（Node）→ omnia-server 主服务器：注册/执行/超时/断线；验证未声明 cancelTool 时不发取消帧，不要求原版节点取消执行
   - Omnia 节点端 → 原版主服务器：注册/执行/超时/断线，并验证声明 cancelTool 后的 cancel_tool 处理；DV-6 单独记录
3. **审核 e2e**：原版 VCPChat 前端 ↔ omnia-server：批准/拒绝/带 reason/静默规则/多模态留言追加/archery 特例，逐条对拍回执文本
4. **异步链路**：提交→初始响应→后台完成→回调→WS 推送→前端展示，原版插件（如视频生成类）直接挂载验证
5. **文件访问**：跨节点 file:// 透明读取 + 缓存命中 + 循环检测 + 失败缓存用例
6. **插件兼容清单**：按类型、stdio/direct 和强耦合覆盖选取 Top-20 阶段样本，记录选择依据，逐个挂载跑行为 diff；原生化与 JS 挂载分开记录。最终 96 目录逐项盘点由 SC-16 / US-427 负责

---

## 11. Rust 结构（增量，文件级）

```
omnia/crates/
├── omnia-ws/src/
│   ├── server.rs          # 6 路径路由 + VCP_Key 认证 + clientId
│   ├── clients.rs         # 各 Map + 断线清理
│   ├── broadcast.rs       # broadcast/VCPInfo/AdminPanel/定向
│   └── messages.rs        # 消息类型枚举（§4.2）
├── omnia-dist/src/
│   ├── registry.rs        # register_tools/report_ip/占位符更新
│   ├── executor.rs        # execute_tool + pending + serverId 绑定 + cancel
│   └── node.rs            # 分布式节点端协议实现（混部反向）；不依赖 omnia-server/omnia-agent，供 omnia-app 内嵌与独立节点进程装配；所在 crate 由 US-201 核定（架构 §5.1）
├── omnia-filefetch/src/lib.rs  # §6 缓存/循环检测/IP 查找
├── omnia-approval/src/
│   ├── rules.rs           # 审核规则（冻结后实现）
│   └── flow.rs            # 请求/TTL/响应/reason 语义；只产出留言文本，追加排版由 omnia-agent 的结果格式化完成（C-01 §1.5，架构 §2.2）
├── omnia-scheduler/src/lib.rs  # §8 任务持久化 + 触发 + 执行
└── omnia-plugin/src/
    ├── async_exec.rs      # §2.1 初始响应/回调/静默宽限
    ├── preprocessor.rs    # §2.2 链 + 顺序
    ├── service_host.rs    # §2.3 路由注册
    └── lifecycle.rs       # §3.4 生命周期/热加载
```

新增依赖：tokio-tungstenite（WS）、tokio-cron-scheduler 或自研定时轮（调度）、sha2（缓存键，已有）。

crate 依赖方向（架构 §2.2，2026-11-12 定案）：omnia-ws 只依赖 omnia-protocol / omnia-config；omnia-dist、omnia-approval、omnia-scheduler 依赖 omnia-plugin 与 omnia-ws；omnia-filefetch 依赖 omnia-dist；omnia-agent 自 M3 起依赖 omnia-ws（侧通道广播）。不保留基线的双向持有，装配只在 omnia-server 的启动入口完成。

---

## 12. 用户故事（按依赖排序）

**US-201 M3 契约冻结**：提取 Plugin.js 生命周期/预热/审核规则/changePreview/依赖门控、preprocessor_order.json、任务文件格式、错误隔离策略和管理 API；产出〔待产出〕docs/m3-spec.md，使用 M3-C-xx 命名空间，交付规则见使用与维护 §4。API_ROUTES.md 只作检索线索，精确格式以冻结源码为准。

验收：按上列待冻结项登记提取证据与测试输入；SC-01/SC-02/SC-03/SC-13/SC-14 的后台能力逐项指定模块、契约、实施 US 及验收，不把缺少详规写成范围豁免。同时提取架构 v2.6 留给本 US 的事项：PORT 与 PORT+1 两个端口的逐端点差异、节点端协议实现所在的 crate（架构 §5.1，SC-17）、单个插件加载失败时的启动策略（架构 §5.2）、server-log 每行文本格式是否属于契约（架构 §7 日志与诊断）、定时任务文件的写入入口（架构 §8.1）。M3 各 crate 的依赖方向、审核留言追加的归属与工具调用记录库的归属已于 2026-11-12 定案（架构 §2.2、§8.1），按定案实现，不在本 US 重新核定；提取中发现与定案冲突的源码证据时，先勘误架构再实现。未完成的 SC 规格和实现由 US-427 跟踪，相关能力未冻结前不得开工。

**US-202 Manifest 全 Schema + 配置级联**：验收：§3.1-3.3 逐项用例（类型转换、级联优先级、env 注入全表）。

**US-203 生命周期管理**：验收：五阶段用例；热加载不中断在途请求；shutdown 钩子执行。

**US-204 异步插件 + 回调存储**：验收：§2.1 全语义（初始 JSON、后台续跑、Bearer 缺失/错误/正确（C-11）、回调路径安全 400/404、静默宽限、超时两态）。

**US-205 预处理器链**：验收：顺序配置生效；processMessages 修改可见；单器失败隔离。

**US-206 service 宿主**：验收：registerApiRoutes 挂载 /api/plugins/<name>；图床 URL 密钥路径可用；shutdown 清理。

**US-207 hybridservice 补全**：验收：三能力并存；保留 isDynamic 声明但不据此自动求值；插件 processMessages 的请求级替换用例与静态占位符对拍。

**US-208 WS 服务器基础**：验收：§4.1 六类握手/认证失败 destroy/ack 文案/clientId 格式/断线清理 fixture 全过。

**US-209 分布式注册**：验收：internal_request_file 过滤；IP 映射；占位符跨节点更新。

**US-210 分布式执行**：验收：§5 六条逐项用例，重点：serverId 绑定防伪、cancel 能力协商、断线 reject。

**US-211 FileFetcher**：验收：§6 全流程 + 三级缓存/防护用例。

**US-212 审核全量**：验收：§7 全部行为逐条对拍（含多模态留言、静默覆盖、archery 特例、隐私过滤）。

**US-213 任务调度器**：验收：持久化恢复、时区格式、caller=scheduler 落库、结果持久化。

**US-214 admin_api 补全**：验收：§9 清单端点按 US-201 从冻结源码提取的路由/响应格式通过，认证沿用 C-11；阶段必需管理端点均属 P0。

**US-215 ChromeBridge 通道（P1）**：验收：command/command_result 路由、sourceClientId 回传、wait_for_page_info 等待队列、心跳。

**US-216 动态工具注册表（P1）**：验收：catalog/分类缓存/override/脱敏配置端点；不新增绕过审核的执行路径。

**US-217 论坛 API（P1）**：验收：FORUM_CONFIG 限额逐项用例。

**US-218 预热进程池（P1）**：验收：预热命中率与冷启动时延对比报告；进程泄漏检查。

**US-219 双向混部验证**：验收：§10.2 两方向全场景通过（使用冻结版本的原 Node 节点及依赖；取消能力按节点声明分别验证）。

**US-220 M3 集成验收**：验收：§10.3-10.6 通过；Top-20 兼容矩阵报告；M3 DoD 签署。

每个 US 遵守[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)的通用检查与交付审查；插件挂载、混部、审核与协议对拍仍按本文验收。

---

## 13. 安全与异常路径

- VCP_Key URL 传输为原版设计，1:1 保留；日志/错误信息一律脱敏 Key；文档提示生产环境用内网或 TLS 终结
- 回调端点需要 Bearer 认证（C-11），且保留路径安全校验；draining 放行只豁免停机拦截，不豁免认证
- 分布式结果防伪：serverId 绑定是硬安全约束，禁止用 requestId 全局匹配
- 审核超时：TTL 到期自动拒绝（策略按冻结规则），VCPLog 补发缓存同步清除
- 节点失联：pending 立即 reject，工具循环按错误回灌，不挂起对话
- 文件缓存：sha256 键防路径穿越；缓存目录配额告警（P1）

## 14. 完成定义（DoD）

- P0 全部 US 验收通过；双向混部全场景绿
- 原版 Plugin/ 目录中 asynchronous/service/messagePreprocessor/hybridservice 各 ≥2 个直接挂载可用
- Top-20 插件兼容矩阵报告发布；审核协议与原版 VCPChat 对拍零差异
- 交付：插件引擎全量类型 + 分布式 + WS + 审核 + 调度 + m3-spec.md + 混部验证报告；类型覆盖不等于全部插件已验收
- P1 延期由 SC-16 承接（US-217 须先于 M4 US-324）；P2 及遗漏后台能力按 SC-01/02/03/13/14 继续补齐，未完成不得通过 US-426

## 15. 风险

| 风险 | 对策 |
| --- | --- |
| Plugin.js 138KB 隐含行为多 | US-201 强制冻结 + 行为对拍，不凭文档臆断 |
| 文档滞后于代码（分布式文档 2 月版 + 取消附录） | 冻结源码权威；附录不能证明原版节点已支持取消，须区分主端与节点端 |
| Node 插件生态依赖（npm/pip/system） | 桥接宿主保留原运行时；dependencies 检查提示安装，不自动执行安装命令 |
| WS 长连接稳定性 | 心跳 + 断线清理 + 重连由客户端负责（与原版一致） |
| 审核规则配置复杂度 | 冻结规则格式后先实现默认策略，逐规则对拍 |

---

## 16. 修订记录

- v1.6（2026-11-12）：同步架构 v2.6 定案：§9 写明 PORT+1 承接与日志文件位置；§11 去掉 omnia-approval 的 `receipt.rs`（留言追加留在 omnia-agent）、`node.rs` 改为不依赖 omnia-server 的节点端实现、补 crate 依赖方向；§5/§10 的“omnia-server 节点”改称“Omnia 节点端”；US-201 区分已定案事项与仍需提取的事项。阶段范围与已冻结条目不变。
- v1.5（2026-11-12）：US-201 验收承接架构 v2.5 指向本 US 的待定项（依赖方向、两端口差异、节点端宿主、启动容错、记录库调用路径）；更正 VCPDistributedServer.js 行数为 955。阶段范围与已冻结条目不变。
- v1.4（2026-11-12）：通用检查与审查引用代码质量规范，保留混部与阶段专属验证。
- v1.3（2026-11-12）：纠正回调认证、config.env、isDynamic 和取消能力；明确管理端点优先级、论坛前置与最终插件覆盖；统一 IN-4 路由与契约冻结责任。

内容由 AI 生成
