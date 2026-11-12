# Omnia · M0+M1 执行 PRD v2.3

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v2.3 / 2026-11-12（配置默认值源码勘误）/ **条目可执行；录制验证待 US-006** |
| 适用阶段 | M0–M1；待冻结项 0；元数据口径见 `README.md` §5.3、§7 |
| 项目 | Omnia（VCP 生态 Rust 全栈原生复刻） |
| 复刻对象 | lioensky/VCPToolBox（后端）+ lioensky/VCPChat（前端） |
| 1:1 基线 | VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` + VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（docs/基线记录.md） |
| 源码位置 | D:\code\github\VCPToolBox、D:\code\github\VCPChat（本地仓库，行号以冻结 commit 为准） |
| 依据架构 | docs/Omnia-架构设计.md（命名/基线/存储/模块已定案；§1.3 创新与偏差治理） |
| 契约权威 | docs/Omnia-M0M1-协议契约.md（C-01～C-12 全部已冻结，**本 PRD 无待冻结项**） |
| 创新接口预留 | ModelAdapter 为 IN-4 的未来演进边界，当前签名不宣称已存在能力探测方法（M1 仅文本标记通道，原生 function calling 通道 M3 后立项，见架构 §1.3）；M1 渲染引擎 v1 按 IN-1 原则设计（行为目标对齐，机制不预设 DOM 式复杂度） |
| 本 PRD 范围 | M0 骨架+契约落地、M1 核心聊天闭环；M2（记忆）及以后另行滚动产出 |
| 技术栈 | 后端 Rust（tokio+axum）；前端 gpui-kit（GPUI）纯原生 |
| 许可证 | CC BY-NC-SA 4.0：署名、非商业、相同方式共享；不复制 Zed 应用代码 |
| 事实标注 | 【已验证】= 基线源码逐行确认；【已冻结】= 契约文档条目（附 C 编号）；【待冻结】/【设计】/【偏差】/〔待产出〕定义见 `README.md` §5.2 |

### 0.1 v2 相对旧 PRD 的重大更正

1. **工具结果双通道**【已冻结 C-01】：`[[VCP调用结果信息汇总:` 域只是前端可见通道；回灌模型的是 `<!-- VCP_TOOL_PAYLOAD -->` user 消息。旧 PRD 混为一谈，实现必须按双通道
2. **interrupt READY 语义**【已冻结 C-05】：READY 由客户端 prepare_handoff 发起，revision 单调门控，2s fail-open；非流式不走门控。旧 PRD"细节待冻结"作废
3. **处理管线 17 步**【已冻结 C-10】：占位符替换嵌在预处理管线内部，不是独立步骤；M1 按裁剪映射表保留骨架
4. **前端数据格式**【已冻结 C-08】：话题 = config.json topics[] 元数据 + history.json 消息数组分离存储；requestId = 助手占位消息 id；Agent 身份走 vcpchatExtensions
5. 命名全套 Omnia 化；协议标记（{{VCPXxx}} 等）保留 VCP 字样（1:1 契约）

---

## 1. 范围与优先级

### P0（M1 上线必须）

1. VCP 工具协议解析器 1:1（含容错匹配、思考块剥离、转义）
2. `POST /v1/chat/completions` 流式+非流式，含完整工具循环（双通道结果分发）
3. 插件引擎：manifest 加载、static 占位符插件、synchronous stdio 插件
4. Bearer 认证 + 中间件链 1:1
5. GPUI 主聊天窗口：流式渲染引擎 v1、话题/Agent 最小管理（AppData 兼容）
6. 契约测试 fixture 库与 CI 门禁

### P0 补充（现有 US 和交叉验证依赖，纳入 M1 出口）

- `GET /v1/models`、`POST /v1/interrupt`（含交接门控）、`POST /v1/human/tool`、`POST /plugin-callback/*`
- admin_api 最小子集（插件列表/开关/配置/manifest）
- IP 黑名单与登录限流 1:1
- 模型重定向（ModelRedirect.json）
- 工具审核最小子集（enabled 开关 + approvalList 工具名匹配 + 拒绝路径，C-07）

### P2（移交后续阶段，最终范围不排除）

记忆系统/vexus-lite（M2）、分布式（M3）、asynchronous/messagePreprocessor/service/hybridservice 插件（M3，direct 宿主 M2）、论坛/日记管理 API（M3+）、前端子程序群（M4）、音乐舞台/Loom（M5）、JEV 完整集成（SC-12，US-427 终验前补齐）。

---

## 2. 协议契约规格（工具调用）

### 2.1 块标记

精确语法见协议契约 C-12 §13.1；实现由 US-003/US-004 承接。

### 2.2 字段语法

特殊字段、值保真和解析产物见 C-12 §13.2，不在本 PRD 复制。

### 2.3 转义机制

见 C-12 §13.3，归 US-003/US-004 验收。

### 2.4 思考块剥离

见 C-12 §13.4，归 US-005 验收。

### 2.5 结果双通道【已冻结 C-01】

实现规格全文见契约文档 §1，要点：

- 可见通道：每工具一块域模板（无编号）+ 恒有摘要块 + 批次包裹（ts 单调递增）；ShowVCP 门控域块，摘要恒发
- AI 通道：assistant 消息 + 新 user 消息（`<!-- VCP_TOOL_PAYLOAD -->\n` + 紧凑 JSON 或富数组）；base64 值替换 `[Omitted]`；与 ShowVCP 无关
- archery 成功不进 AI 通道；失败生成 `[异步工具 "name" 返回了错误，请注意]:` 块
- 审核留言追加到富 content 最后一个 text 块（C-01 §1.5）
- 上游投影：ROLE_DIVIDE 批次标记改写为 `【工具返回批次开始｜时间：{ts}】`（C-01 §1.3）

### 2.6 结果格式化

见 C-12 §13.5；插件执行结果由 omnia-plugin 提供，omnia-agent 构造双通道注入，不重复定义返回类型。US-012～014 对富内容、错误和并发结果逐项验收。

### 2.7 契约测试用例清单

按契约文档 §11.2 执行（C-01～C-12 每条规则 ≥1 正例 +1 反例）。fixture 存 `contract/fixtures/`，命名与 meta 规范见契约文档 §11.1；全部来自基线录制或按源码构造并注明出处。

---

## 3. API 规格（M1 子集）

### 3.1 中间件链与认证边界

唯一精确规则见 C-11。基线顺序：CORS/body → IP 追踪/黑名单 → draining 门控 → adminAuth → /AdminPanel 重定向 → Bearer → specialModelRouter → 业务路由。

US-008 必须证明：回调和特殊模型路由均经过 Bearer；/AdminPanel 主端口为重定向，不是静态托管。完整停机生命周期由 SC-14 细化，不把清理请求放行误作认证豁免。

### 3.2 POST /v1/chat/completions（P0）

请求头：`Authorization: Bearer <Key>`，`Content-Type: application/json`

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| model | string | 是 | 经 ModelRedirect.json 映射后转发上游 |
| messages | array | 是 | OpenAI 格式 {role, content}；content 支持多模态数组 |
| stream | boolean | 否 | 默认 false |
| temperature 等 | number | 否 | OpenAI 采样参数透传 |
| contextTokenLimit | number | 否 | 前端发送的上下文预算，管线第 3 步修剪用【已冻结 C-10，步骤 3】 |
| requestId / messageId | string | 否 | 请求追踪与中断标识（两者兼容）；原版前端 requestId=助手占位消息 id【已冻结 C-09】 |
| vcpchatExtensions | object | 否 | 前端自定义字段（requestContext/messageTimestampBindings），M1 透传保存不消费【已冻结 C-09】 |

处理管线：**17 步实际顺序 + M1 裁剪映射见契约 C-10**。骨架位置 1:1 保留，未实现阶段空链占位（重放缓存/VCPTavern/Detector/OneRing 等）。

非流式响应：OpenAI `chat.completion` 结构；所有轮 AI 文本+批次文本按序 join('') 覆盖 content；finish_reason 按是否达上限取 length/stop【已冻结 C-04 §4.2】。

流式响应【已冻结 C-04】：

- `Content-Type: text/event-stream`；响应头 `x-vcp-tool-loop-handoff: '1'`
- 上游 chunk 直通转发（上游 [DONE] 吞掉不下发）；每 5s 心跳 `: vcp-keepalive\n\n`；90s 无上游 chunk → 超时文本 stop chunk + [DONE]
- 工具轮：批次 chunk（id `chatcmpl-vcp-batch-{ts}`）→ 分隔符 chunk（id `chatcmpl-VCP-separator-{ts}`，content='\n'）→ handoff 等待 → 下一轮
- 终结：stop chunk（id `chatcmpl-VCP-final-stop-{ts}`）+ `data: [DONE]`；达上限 finish_reason:'length'
- 错误也走 chunk：错误文本作为 delta.content、finish_reason=stop，随后 [DONE]
- ShowVCP 控制域块可见性；摘要恒发；`/v1/chatvcp/completions` 强制可见（P0）

### 3.3 其余端点

| 端点 | 优先级 | 请求 | 响应 |
| --- | --- | --- | --- |
| GET /v1/models | P0 | Bearer | OpenAI 模型列表透传；重定向启用时替换公开名 |
| POST /v1/interrupt | P0 | {requestId 或 messageId, action?, handoffId?, revision?} | 硬中止：200 {status:"success", message:"Interrupt signal sent for request {id}."}；找不到 404；交接门控全分支见契约 C-05 |
| POST /v1/human/tool | P0 | 纯文本 VCP 工具块 | {status:"success", result}；复用 parseBlock |
| POST /plugin-callback/:pluginName/:taskId | P0 | {requestId, status:"Succeed"/..., result} | {status:"success", message}；Bearer 认证（C-11），认证后执行业务校验；路径安全校验 UNSAFE_PATH→400、插件不存在→404、非 JSON 对象→400 |
| GET /admin_api/plugins | P0 | Basic | [{name, manifest, enabled, configEnvContent, isDistributed, serverId}] |
| POST /admin_api/plugins/:name/toggle | P0 | Basic | 启用/禁用 |
| GET/POST /admin_api/plugins/:name/config | P0 | Basic | 插件 config.env 读写 |
| GET /admin_api/plugins/:name/manifest | P0 | Basic | manifest 原文 |

interrupt 实现要点【已冻结 C-05】：硬中止四态（头未发流式/头未发非流式/头已发 SSE/其他）逐字节对齐；重复中止跳过；1000ms 后清理 activeRequests；交接门控 revision 单调状态机 8 分支 + 2s fail-open；非流式不走门控。

### 3.4 认证与限流（1:1）

Bearer/Basic/Cookie、公开资源、只读计数边界、错误凭据与无凭据两套计数，见 C-11；US-008 不得只实现“5 次失败”摘要。IP 黑名单与登录临时封禁是两个机制，按 server.js 各自用例对拍。

### 3.5 配置键（M1 必须支持）【已验证：config.env.example + API_ROUTES.md 附录】

`PORT`(默认 6005)、`Key`、`AdminUsername`、`AdminPassword`、`Image_Key`、`File_Key`、`VCP_Key`、`ApiRetries`(3)、`ApiRetryDelay`(缺省 1000ms；config.env.example 示例为 200ms)、`MaxVCPLoopStream`(5)、`MaxVCPLoopNonStream`(5)、`WhitelistImageModel`、`WhitelistEmbeddingModel`、`ShowVCP`、`DEFAULT_TIMEZONE`(缺省 Asia/Shanghai，批次时间戳用)、上游 API 地址/密钥组。其余键 M2+ 逐步补齐。

缺省重试延迟依据冻结 `VCPToolBox/server.js:1227` 的 `parseInt(process.env.ApiRetryDelay) || 1000`；示例配置不是缺失键默认值。加载器保留显式字符串，空值/无效值/零值在模型适配层按原表达式处理。

加载器语义【已冻结 C-06】：dotenv 补丁正则（扩展键字符集 `[\w.@#%&^+_\-]+`、export 前缀、=/: 分隔、三种引号、仅双引号展开 \n\r、行内注释截断、CRLF 归一）；真实环境变量优先于文件；同文件重复键最后值生效（C-06；与真实环境优先分开验证）。

---

## 4. 插件引擎规格

### 4.1 manifest Schema【已验证：WeatherReporter / AgentMessage / AICodeWorker / AgentAssistant 实例】

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| manifestVersion | string | "1.0.0" |
| name / version / displayName / description / author | string | 元信息 |
| pluginType | enum | static / synchronous / asynchronous / messagePreprocessor / service / hybridservice；**M1 仅 static + synchronous** |
| entryPoint | object | {type:"nodejs", command:"node x.js"}（stdio）或 {script:"x.js"}（direct，M2） |
| communication | object | {protocol:"stdio"/"direct", timeout?:ms} |
| capabilities.systemPromptPlaceholders | array | [{placeholder:"{{VCPXxx}}", description}]（static） |
| capabilities.invocationCommands | array | [{command, commandIdentifier, description, example}]；**指令模板用 command 字段**【已冻结 C-03】 |
| configSchema | object | key→类型字符串 或 {type, default, description, min}；用于插件 config.env 取值 |
| refreshIntervalCron | string | static 刷新周期（如 "0 * * * *"） |
| webSocketPush | object | {enabled, messageType / usePluginResultAsMessage, targetClientType}（M1 记录不实现推送，M3） |

### 4.2 stdio 执行协议【已冻结 C-02】

1. payload = `JSON.stringify(toolArgs)`（裸参数，无信封）；空参数不写 stdin 直接 end；**无尾随换行**
2. spawn：entryPoint.command 按空格拆分，`cwd=插件目录, shell=true, env=合并环境, windowsHide=true`，非 Windows detached
3. 环境合并三级：process.env → pluginConfig（仅 configSchema 声明键，插件 config.env > 全局，integer/boolean 强转）→ additionalEnv（PROJECT_BASE_PATH/SERVER_PORT/VCP_REQUEST_IP/PYTHONIOENCODING=utf-8 等，全表见 C-02 §2.2）
4. 输出：stdout 累积，**同步插件等待进程 exit 后整体 JSON.parse(trim)**；合法输出 `{status:"success"|"error", result|error}`；**JSON 的 status 优先于退出码**（双向）
5. stderr 累积 → 附加为 `pluginStderr`
6. 超时：manifest communication.timeout，缺省同步 60000ms / 异步 1800000ms；超时杀进程树（Windows `taskkill /T /F /PID`，Unix 进程组信号）
7. 退出码≠0 且无合法 JSON → 错误含 stdout/stderr 前 200 字符
8. status≠success → 抛 `{result?, plugin_error}` JSON；result 为字符串时二次 JSON.parse，失败包 `{original_plugin_output}`
9. 每次调用写 tool_call_records（见 §5.2），结果附 recordId

### 4.3 static 插件与指令注入【已冻结 C-03】

- 按 refreshIntervalCron 周期执行，产出占位符值；失败保留旧值（stale-while-error）
- 指令模板（buildVCPDescription）：标题行 `- {displayName} ({name}) - 命令: {command||'N/A'}:`；description 每行 4 空格；example 头 `\n  调用示例:\n`（2 空格）+ 每行 4 空格；无 description 跳过；同插件多命令 `\n\n` 连接；键 `VCP{name}`
- 占位符替换：首处展开、跨消息重复置空；描述为空 → `[{key} 信息不可用]`；`{{VCPAllTools}}` = 全部描述 Map 序 `join('\n\n---\n\n')`
- 替换发生在预处理管线内部（逐消息变量替换 + $StaticPlaceholderInjection 虚拟阶段，仅 system）

### 4.4 工具审核最小子集（P0）【已冻结 C-07】

- 配置 toolApprovalConfig.json：enabled/timeoutMinutes(5)/approvalList（默认 PowerShellExecutor/ServerPowerShellExecutor/FileOperator/ServerFileOperator）
- M1 实现：enabled 开关 + approvalList 工具名匹配（大小写不敏感，第一级）+ 拒绝 JSON `{plugin_error, error_type:'approval_rejected', rejected_by_user:true}` + 超时文案 + 放行路径
- M1 无 WS 审核 UI：headless 测试夹具自动应答；默认策略可配置（approveAll=false 时未命中规则直接放行）
- 命令级/参数级规则、SilentReject、changePreview、热重载 → M3

---

## 5. 数据与存储

### 5.1 后端文件布局（目标兼容；停写、备份后顺序挂载）

```
config.env                  # 主配置
ModelRedirect.json          # 模型重定向
ip_blacklist.json           # IP 黑名单
toolApprovalConfig.json     # 审核配置
preprocessor_order.json     # 预处理顺序（M1 读取，链上仅静态注入）
Plugin/<Name>/plugin-manifest.json
Plugin/<Name>/config.env          # 插件私有配置
Agent/                      # Agent 预设（TVS 模板，M1 只读加载）
dailynote/                  # 日记（M2）
```

### 5.2 SQLite DDL【已验证：toolCallRecordStore.js，WAL + foreign_keys】

```sql
CREATE TABLE IF NOT EXISTS tool_call_records (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  caller_signature TEXT,
  caller_type TEXT,
  request_ip TEXT,
  source_node TEXT,
  started_at TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  finished_at TEXT,
  finished_at_ms INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  call_content_json TEXT NOT NULL,
  return_content_json TEXT,
  error_text TEXT,
  has_multimodal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_started_at_ms ON tool_call_records(started_at_ms);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_tool_name ON tool_call_records(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_caller_signature ON tool_call_records(caller_signature);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_status ON tool_call_records(status);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_success ON tool_call_records(success);
```

M1 不新增其他表。

### 5.3 前端 AppData（与原版 VCPChat 双向兼容）【已冻结 C-08】

- 目录结构、话题元数据（config.json topics[]）、history.json（顶层消息数组）、Agent 配置字段全表、attachments、命名规则（Windows 小写目录、default 话题、路径段校验）：全文见契约 C-08
- 写入：tmp + rename 原子替换；config.json 带 lock/backup；读时补默认（locked:true/unread:false/creatorSource:'unknown'）
- 瞬态字段（isThinking/isPendingStream）持久化时过滤
- 工具过程为 content 内文本标记（批次/结果域/元思考链），不是结构化字段
- **硬验收**：原版 VCPChat 产生的合成 AppData 在停写和备份后顺序挂载；Omnia 写回后原版 reopen 无损（US-018/US-022）

---

## 6. 后端 Rust 结构（签名级）

### 6.1 目录

```
omnia/
├── Cargo.toml                    # workspace
├── crates/
│   ├── omnia-protocol/src/
│   │   ├── lib.rs                # ToolCall 等类型
│   │   ├── markers.rs            # 规范/容错标记匹配（2.1/2.2）
│   │   ├── parser.rs             # 块提取+字段扫描+特殊字段（2.2/2.3）
│   │   ├── reasoning.rs          # 思考块剥离状态机（2.4）
│   │   └── escape.rs             # 转义域与还原
│   ├── omnia-config/src/lib.rs   # config.env / 插件 config.env 加载（C-06 补丁语义）
│   ├── omnia-plugin/src/
│   │   ├── manifest.rs           # Schema 校验
│   │   ├── registry.rs           # 加载/启停/热加载
│   │   ├── static_runner.rs      # cron 刷新+占位符值缓存
│   │   ├── stdio_exec.rs         # C-02 执行协议+进程树管理
│   │   ├── instructions.rs       # C-03 指令模板生成
│   │   └── approval_min.rs       # C-07 审核最小子集
│   ├── omnia-model/src/
│   │   ├── adapter.rs            # OpenAI 兼容上游（流式/非流式）
│   │   ├── redirect.rs           # ModelRedirect.json
│   │   └── retry.rs              # ApiRetries/ApiRetryDelay
│   ├── omnia-agent/src/
│   │   ├── pipeline.rs           # C-10 17 步管线骨架（空阶段占位）
│   │   ├── loop_nonstream.rs     # 非流式工具循环
│   │   ├── loop_stream.rs        # 流式工具循环+SSE（C-04 事件序列）
│   │   ├── injection.rs          # C-01 双通道构造（可见域/AI payload/批次/摘要）
│   │   ├── handoff.rs            # C-05 门控状态机
│   │   ├── prompt.rs             # 占位符替换+工具指令注入
│   │   └── records.rs            # tool_call_records 读写
│   └── omnia-server/src/
│       ├── main.rs               # 启动/端口/生命周期
│       ├── middleware.rs         # 3.1 中间件链
│       ├── auth.rs               # Bearer/Basic/限流/黑名单
│       ├── routes_chat.rs        # chat/chatvcp completions
│       ├── routes_misc.rs        # models/interrupt/human-tool/callback
│       └── routes_admin.rs       # admin_api 最小子集
├── contract/
│   ├── fixtures/                 # C-01～C-12 fixture（命名规范见契约 §11.1，含 c10-pipeline/）
│   ├── recorder/                 # 对原版服务器的录制脚本（验证用）
│   └── tests/                    # 契约测试（CI 门禁）
└── docs/
```

### 6.2 关键签名

```rust
// omnia-protocol
pub struct ToolCall {
    pub name: String,
    pub args: serde_json::Map<String, serde_json::Value>,
    pub archery: bool,
    pub archery_no_reply: bool,
    pub mark_history: bool,
    pub river: Option<String>,
    pub vref: Option<String>,
}
pub struct ParseOptions { pub fuzzy_markers: bool }  // 默认 false
pub fn parse_tool_calls(text: &str, opts: &ParseOptions) -> Vec<ToolCall>;
pub fn strip_reasoning_blocks(text: &str) -> String;
pub fn separate(calls: Vec<ToolCall>) -> (Vec<ToolCall>, Vec<ToolCall>);
pub fn escape_value(raw: &str) -> String;   // 「始ESCAPE」域包裹
pub fn unescape_value(raw: &str) -> String;

// omnia-config
pub struct Config { /* 键值 + 来源标记 */ }
pub fn load_dotenv_patched(src: &str) -> HashMap<String, String>;  // C-06 正则
pub fn load_config(path: &Path) -> Result<Config, ConfigError>;   // 真实 env 优先；装配层再汇总错误

// omnia-model
pub struct UpstreamRequest { pub model: String, pub messages: Vec<Message>,
    pub stream: bool, pub params: SamplingParams }
pub enum UpstreamChunk { Delta(String), Reasoning(String), Done, Raw(Value) }
#[async_trait]
pub trait ModelAdapter: Send + Sync {
    async fn complete(&self, req: UpstreamRequest) -> Result<UpstreamResponse, ModelError>;
    async fn stream(&self, req: UpstreamRequest)
        -> Result<BoxStream<'static, Result<UpstreamChunk, ModelError>>, ModelError>;
}
pub struct RedirectMap { /* ModelRedirect.json：公开名→上游名 */ }
pub struct RetryPolicy { pub retries: u32, pub delay_ms: u64 }  // 缺省 3 / 1000；示例配置为 200ms

// omnia-plugin
pub struct ExecContext { pub request_ip: String, pub caller: CallerInfo,
    pub cancel: CancellationToken, pub project_base: PathBuf }
pub struct ToolOutcome { pub content: Vec<ContentBlock>, pub success: bool,
    pub record_id: String, pub approval_feedback: Option<String>,
    pub no_reply_silent: bool, pub plugin_stderr: Option<String> }
#[async_trait]
pub trait PluginHost: Send + Sync {
    async fn execute(&self, call: &ToolCall, ctx: &ExecContext)
        -> Result<ToolOutcome, PluginError>;
    fn placeholders(&self) -> HashMap<String, String>;
    fn instructions(&self) -> HashMap<String, String>;
}
pub enum PluginError { Timeout, SpawnFailed(String), BadOutput(String),
    Rejected { reason: Option<String>, silent: bool }, PluginReported(Value) }
pub fn build_stdio_payload(args: &Map<String, Value>) -> Option<String>;  // C-02
pub fn merge_env(base: &Env, plugin_cfg: &Env, additional: &Env) -> Env;
pub fn build_vcp_description(plugin: &Manifest) -> String;               // C-03

// omnia-agent
pub struct LoopConfig { pub max_stream: u32, pub max_non_stream: u32,
    pub show_vcp: bool, pub force_show_vcp: bool }
pub struct HandoffGate { /* C-05：revision/handoffId/ready/last */ }
impl HandoffGate {
    pub fn control(&mut self, action: &str, handoff_id: &str, revision: i64) -> GateReceipt;
    pub async fn wait_if_armed(&self, timeout: Duration) -> WaitOutcome;  // 2s fail-open
}
pub enum GateReceipt { Armed { revision: i64 }, Cancelled { revision: i64 },
    Duplicate, InvalidHandoff, RequestStopped, StaleRevision, RevisionConflict, StaleHandoff }
pub struct VisibleBatch { pub ts: String, pub blocks: Vec<String>, pub summary: String }
pub fn build_visible_block(tool: &str, outcome: &ToolOutcome) -> String;   // C-01 §1.1
pub fn build_ai_payload(results: &[ToolOutcome]) -> AiPayload;             // C-01 §1.3
pub fn build_summary(items: &[SummaryItem]) -> String;                     // C-01 §1.2

// omnia-server
pub struct AppState { pub config: Arc<Config>, pub plugins: Arc<PluginRegistry>,
    pub models: Arc<ModelRouter>, pub active: Arc<ActiveRequests>,
    pub records: Arc<RecordStore>, pub approval: Arc<ApprovalMin> }
pub struct ActiveRequests { /* requestId → RequestContext{abort, gate, res_state} */ }
```

### 6.3 依赖（写入 Cargo.lock 锁定；版本为 2026-11-12 crates.io 稀疏索引一手核验的最新稳定版，cargo 解析后以锁文件为准）

| crate | 版本要求 | 核验时最新 | 用途 |
| --- | --- | --- | --- |
| tokio | 1（full） | 1.54.1 | 异步运行时 |
| tokio-util | 0.7 | 0.7.20 | CancellationToken |
| axum | 0.8 | 0.8.9 | HTTP/SSE |
| tower-http | 0.7（cors/trace） | 0.7.1 | 中间件（原 0.6 已落后一个大版本） |
| serde / serde_json | 1 | 1.0.229 / 1.0.154 | 序列化 |
| reqwest | 0.13（rustls, stream） | 0.13.5 | 上游模型调用（原 0.12 已落后一个大版本；M0 骨架时验证 API 迁移） |
| eventsource-stream | 0.2 | 0.2.3 | 上游 SSE 解析 |
| rusqlite | 0.42（bundled） | 0.42.0 | SQLite（DDL 兼容性在 US-001 验证） |
| regex | 1 | 1.13.1 | 协议正则 |
| cron | 0.17 | 0.17.0 | static 刷新（原 0.12 落后多个版本，M0 验证 cron 表达式解析语义不变） |
| tracing / tracing-subscriber | 0.1 / 0.3 | 0.1.44 / 0.3.23 | 日志 |
| uuid | 1（v4） | 1.29.2 | 记录 id |
| anyhow | 1 | 1.0.104 | 跨 crate 错误 |
| thiserror | 2 | 2.0.21 | 领域错误枚举（原 1 已落后一个大版本） |
| async-trait | 0.1 | 0.1.92 | trait 异步 |
| futures | 0.3 | 0.3.34 | BoxStream/join_all |

注：前端依赖版本矩阵见 docs/Omnia-前端框架选型.md §2.1（gpui-kit =0.9.1 / gpui-pre =0.3.12 / quickjs-jit =0.14.1）。M2 vendored 内核依赖以 vexus-lite 自带 Cargo.toml 为准（不随本表升级，保持基线）。

---

## 7. GPUI 前端 M1 规格

### 7.1 依赖与版本策略

- gpui-kit 精确锁 `=0.9.1`（2026-11-12 crates.io 一手核验；README 示例滞后标 0.7，以 crates.io 为准）；禁止浮动依赖。GPUI 快照 gpui-pre =0.3.12 由 gpui-kit 传递锁定。分层与选型依据见 docs/Omnia-前端框架选型.md（含版本矩阵）
- 分层用法：gpui-component 为主（聊天窗口/子程序/设置页）；gpui-base 兜底（流式渲染引擎自建，复用 focus/虚拟化/无障碍/IME 行为原语）
- UI 抽象层：所有 gpui-kit 调用收敛到 `ui_adapter/` 模块，隔离快照 API 漂移
- Markdown 解析：pulldown-cmark；渲染基于 gpui-kit Markdown 组件 + 自研增量层
- gpui-shell：M1 不引入；M0 实测 Windows 运行时（0.9.1，quickjs-jit =0.14.1 修复回归，见前端框架选型 §6 F4/F5），M4 起分阶段采纳
- M0 评估 gpui-fast 0.1.14 后端（性能/稳定性对比 gpui-pre 0.3.12 快照）

### 7.2 ChatKernel 状态设计（单一真源）

```rust
pub struct ChatKernel {
    pub agents: Vec<AgentEntry>,          // AppData/Agents 加载，排序=settings.agentOrder
    pub active: Option<ActiveSession>,
    pub settings: AppSettings,            // AppData/settings.json（C-09 §9.4）
}
pub struct ActiveSession {
    pub agent_id: String,
    pub topic_id: String,
    pub messages: Vec<ChatMessage>,       // history.json 内存镜像（C-08 §8.3）
    pub stream: Option<StreamState>,
    pub generation: u64,                  // 代次：切话题/重试递增
}
pub struct StreamState {
    pub session_id: Uuid,                 // 本次流会话
    pub message_id: String,               // 助手占位消息 id = requestId（C-09）
    pub generation: u64,                  // 发起时的代次快照
    pub buffer: String,                   // 累计 content（含工具标记）
    pub status: StreamStatus,             // Sending/Streaming/ToolRunning/Finishing
}
pub enum ChatState { Idle, Sending, Streaming, ToolRunning, Error(Retryable) }
```

状态迁移：Idle → Sending（POST 发出）→ Streaming（首 chunk）→ ToolRunning（识别批次标记且 ShowVCP 可见）→ Streaming → Idle（[DONE]/finish）；Error 态可重试（generation+1）。

**竞态三元组**（对齐 V4 三维校验的行为目标）：每个 chunk 携带 (session_id, generation, message_id)；写入前校验三者与当前 StreamState 一致，任一不符即丢弃。切换话题/重试 → generation 递增，旧流迟到 chunk 天然拒写。

### 7.3 窗口与布局

- 单主窗口：左侧 Agent/话题列表（虚拟化 List），右侧聊天区，底部输入区
- 话题管理：增删改排序，写 config.json topics[]（原子写）；删除最后一个话题自动补建"主要对话"（C-08）
- Agent 管理：M1 只读加载 + 最小创建（name/systemPrompt/model 默认值按 C-08 §8.5）；人设随请求 system 消息发送

### 7.4 流式渲染引擎 v1（行为规格）

1. SSE 增量到达 → 追加到 buffer → 增量 Markdown 解析（只重解析尾部未闭合结构）
2. 代码围栏流式期间按未闭合处理，闭合后切换高亮（Tree-sitter 经 gpui-kit）
3. 工具标记区间识别（C-08 §8.3）：批次 START/END、结果域、元思考链 → 渲染为独立工具卡片，不进入正文 Markdown；ShowVCP 关时仅摘要可见
4. 历史消息虚拟化：离屏消息冻结渲染（对齐 V4 墓碑冻结的行为目标，实现可简化）
5. 竞态防护：§7.2 三元组校验
6. 中断：发送 /v1/interrupt（body {requestId: 助手消息 id}，5s 超时）并本地停止渲染，保留已接收内容；失败/超时 3s 内本地收尾（C-09 §9.3）
7. 终态：全文 + finishReason 写回 history.json（过滤瞬态字段）

### 7.5 连接层

- 设置页：vcpServerUrl（自动规范化补全 /v1/chat/completions）、vcpApiKey、userName、enableVcpToolInjection（切换 chatvcp 路径）——字段与默认值按 C-09 §9.4
- 请求构造：messages 白名单（role/content/name/tool_calls/tool_call_id）、单 text 多模态折叠、空值剔除、requestId=助手占位 id、vcpchatExtensions 按 C-09 §9.1 构造
- SSE 客户端：reqwest 流式；按行拆 data:，[DONE] 结束；文本提取优先级链 `choices[0].delta.content || delta.content || content || string || raw`（C-09 §9.2）
- 断线指数退避重连（上限 30s），重连后提示而非静默续流

### 7.6 前端目录（增量）

```
crates/omnia-app/src/
├── main.rs                 # 应用入口/窗口
├── ui_adapter/             # gpui-kit 调用收敛层
├── kernel/
│   ├── mod.rs              # ChatKernel/ActiveSession/StreamState
│   ├── race.rs             # 竞态三元组校验
│   └── states.rs           # 状态机迁移
├── data/
│   ├── appdata.rs          # 目录布局/路径校验/Windows 小写（C-08）
│   ├── agent_store.rs      # config.json 读写（lock/tmp/backup 原子）
│   ├── history_store.rs    # history.json 读写（瞬态过滤）
│   └── settings.rs         # settings.json
├── net/
│   ├── client.rs           # 请求构造（C-09）
│   ├── sse.rs              # SSE 消费 task
│   └── interrupt.rs        # 中断（5s/3s 语义）
└── render/
    ├── stream.rs           # 增量 Markdown
    ├── tool_regions.rs     # 工具标记区间识别→卡片
    └── virtual_list.rs     # 虚拟化+离屏冻结
```

---

## 8. 交叉验证与测试计划

| 组合 | 用途 | M1 门禁 |
| --- | --- | --- |
| 原版后端 × 原版 VCPChat | 基线录制（recorder 抓取请求/SSE/注入报文，验证契约 fixture） | M0 完成 |
| omnia-server × 原版 VCPChat | 后端回归 | 聊天+工具调用 e2e 通过 |
| 原版后端 × omnia-app | 前端回归 | 聊天 e2e 通过 |
| omnia-server × omnia-app | 最终集成 | 聊天+工具+中断 e2e 通过 |

- 契约测试：`contract/tests` 对解析器/双通道/SSE 格式/错误格式/门控/dotenv/审核逐 fixture 断言（契约文档 §11.2 全覆盖），CI 必过
- 工具循环对拍：同一 prompt+同一插件，原版与 omnia-server 的调用序列、AI payload、可见批次文本 diff（mock 上游固定响应序列消除随机性）
- 前端数据往返：原版真实 AppData → Omnia 读-改-写 → 原版 reopen 校验
- 前端 UI：gpui-kit 无头 UI 测试驱动输入/断言状态
- 每个 US 遵守[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)的通用检查与交付审查；本节契约、交叉验证及无头 UI 用例为额外必需项。

---

## 9. 用户故事（按依赖排序）

### M0

**US-001 workspace 骨架 + CI**
作为开发者，我要 cargo workspace 与 CI 门禁，以便后续故事有统一质量底线。
验收：§6.1 目录建立（omnia-* 命名）；按代码质量约束 §7 落地 fmt/check/clippy/test 与文档检查门禁，明确自研/vendored 包和 feature/target 矩阵，失败阻断且不漏检自研代码；交付需通过代码质量约束 §8 人工质量审查；README 链接已验证构建/首跑说明；建立 LICENSE 和第三方归属清单基础版本（分发前由 US-425 核定）。

**US-002 配置加载器**
验收：读取 config.env 与 Plugin/<目录>/config.env；C-06 补丁语义逐条对拍（≥12 个边界用例：扩展键字符集/export/冒号/三引号/仅双引号转义/行内注释/CRLF/真实 env 优先/同文件重复键最后值/插件文件名）；缺失键按默认值；cargo test 通过。

**US-003 协议解析器（规范模式）**
验收：C-12 §13.1–13.3 全部规则实现；契约 fixture c12 规范模式部分全过；值缩进保真用例通过。

**US-004 容错匹配器**
验收：配置开关默认关；开启后 C-12 标记和字段容错规则 1:1；开关前后 fixture 行为差异用例通过。

**US-005 思考块剥离状态机**
验收：C-12 §13.4 六类规则逐条用例通过（含无头泄漏、未闭合尾部、颜文字豁免、保护域嵌套）。

**US-006 fixture 库实现 + 基线对拍**
验收：按契约文档 §11 建立 c01-c12 fixture 库（每条规则正例+反例，meta 标注出处，含 C-10 管线骨架）；recorder 对原版服务器录制 ≥20 组对话（含工具调用、多工具、错误、流式、中断）与 fixture 对拍；差异为零或回写契约文档（走基线记录流程 + `README.md` §7 回写所有引用方）；产出〔待产出〕docs/fixture-report.md。覆盖 C-06 重复键/插件文件名、C-11 回调与白名单认证、C-12 解析边界；修订契约后重新对拍通过才能结案。契约定稿不代表基线录制已经完成。

**US-007 GPUI 应用骨架**
验收：gpui-kit 锁版本；空窗口+设置页跑通三平台构建（Windows 优先）；ui_adapter 抽象层建立；无头 UI 测试跑通；按前端框架专项 §6 F1～F8 记录实测。F4/F5 决定既定脚本分支、F6 留性能对比、F8 明确视频缺口；失败分支记录回退与影响，不静默省略。

### M1 后端

**US-008 服务器 + 中间件链 + 认证**
验收：§3.1 顺序 1:1；按 C-11 覆盖 Bearer/Basic、两类失败计数、只读/公开资源边界、回调认证与特殊模型路由顺序；黑名单另测本地豁免。

**US-009 模型适配器**
验收：OpenAI 兼容上游流式/非流式；重试次数与间隔按配置；ModelRedirect 映射用例通过；上游超时/断流错误路径有用例。

**US-010 static 插件 + 占位符 + 指令注入**
验收：WeatherReporter 原版目录直接挂载可用；cron 刷新、失败保旧值；{{VCPWeatherInfo}} 替换用例通过；C-03 指令模板逐字符 fixture 全过（command 字段/缩进/首处展开去重/VCPAllTools）。

**US-011 manifest 加载与校验**
验收：§4.1 Schema 全字段解析；非法 manifest 拒绝并日志；M1 范围外 pluginType 标记为不支持而非崩溃。

**US-012 stdio 执行器 + 记录存储 + 审核最小子集**
验收：C-02 九条逐项用例（裸 payload/无尾随换行/env 三级/JSON 优先退出码双向/超时杀树/stderr 附加/result 二次解析）；tool_call_records 按 §5.2 落库且 recordId 回附；C-07 审核最小语义用例（开关放行/工具名匹配/拒绝 JSON/超时文案，headless 夹具应答）。

**US-013 非流式工具循环**
验收：解析→并发执行→双通道注入→再调用，MaxVCPLoopNonStream 上限生效；与原版对拍（mock 上游）调用序列与 AI payload 一致；多轮文本 join 覆盖 content。

**US-014 流式工具循环 + SSE**
验收：C-04 事件序列逐字节对齐 fixture（chunk id 格式/心跳/上游 DONE 吞掉/90s 超时/批次/分隔符/final-stop/length）；ShowVCP 开关行为一致（域块门控、摘要恒发、mark_history 强制可见）；MaxVCPLoopStream 上限生效。

**US-015 辅助端点 + 交接门控**
验收：models/human-tool/plugin-callback 按 §3.3 通过；interrupt 硬中止四态逐字节 fixture；C-05 门控 8 分支 + 2s fail-open + 非流式不走门控用例全过；interrupt 能终止进行中的循环。

**US-016 admin_api 最小子集**
验收：插件列表/开关/配置/manifest 四组端点按 §3.3 通过；Basic 认证与限流复用 US-008。

### M1 前端

**US-017 连接层**
验收：设置页字段与默认值按 C-09 §9.4；请求构造按 C-09 §9.1（requestId=助手占位 id/vcpchatExtensions/白名单脱敏/chatvcp 切换）；SSE 提取优先级链用例；断线重连用例通过。

**US-018 AppData 数据层 + 话题/Agent 管理**
验收：C-08 全格式读写用例（topics[] 补默认/history 顶层数组/瞬态过滤/原子写/Windows 小写/default 补建/路径校验）；§7.3 管理操作；**原版真实 AppData 挂载往返验证**。

**US-019 ChatKernel + 流式渲染引擎 v1**
验收：§7.2 状态迁移全路径用例；竞态三元组迟到 chunk 拒写用例；§7.4 七条行为逐项用例（未闭合围栏/工具卡片/离屏冻结）；1000 条历史消息滚动流畅（虚拟化生效）。

**US-020 输入区 + 中断 + 异常态**
验收：发送/中断（5s/3s 语义）/重试；加载中/失败/超时/无权限四态 UI 均有定义与用例。

### 集成

**US-021 omnia-server × 原版 VCPChat e2e**
验收：原版前端配置指向 omnia-server，完成聊天+工具调用+中断；SSE 报文与基线 diff 通过。

**US-022 omnia-app × 原版后端 e2e + CI 门禁**
验收：omnia-app 连原版后端完成聊天；AppData 双向兼容终验；四象限矩阵全部纳入 CI；M1 DoD 检查单签署。

---

## 10. 安全与异常路径

- 密钥只存 config.env / 插件 config.env，禁止硬编码与日志明文；日志对 Key/Token 脱敏
- 工具执行审核：M1 最小子集按 C-07（开关+工具名匹配+拒绝路径）；完整审核 UI/规则 M3
- 异常路径定义：上游超时→重试后错误 chunk；90s 无上游 chunk→超时文本 stop+[DONE]；插件超时→杀树+错误结果回灌；SSE 客户端断开→取消上游请求与工具循环（同一中止链，C-05）；循环上限→finish_reason:length 终止；磁盘满/DB 锁→503+日志
- 请求体 300mb 上限 1:1（多模态需要），但需配置化以便收紧
- 回调端点路径安全校验 1:1（UNSAFE_PATH→400）

## 11. 并发与性能假设

个人自用：1-3 个并发 Agent 会话、SSE 长连接数十条量级；tokio/axum 余量充足，不做集群设计。工具并发=单响应内多调用 join_all（与原版 Promise.all 一致）。瓶颈预案：上游模型延迟主导，本地解析/执行非瓶颈；SQLite WAL 已对齐原版。

## 12. 完成定义（DoD）

- M0：契约 fixture 库建成并对拍通过（US-006）+ 骨架 CI 全绿 + GPUI 空窗口三平台构建
- M1：本 PRD 全部 US（含原 P1 辅助端点/审核/管理）验收通过；四象限 e2e 通过；原版插件目录（static+synchronous 各 ≥3 个）直接挂载可用；原版 AppData 双向兼容验证通过；契约 CI 门禁常态化
- 交付物：可执行后端二进制 + GPUI 前端原型 + fixture 对拍报告 + 测试报告 + 使用与维护 §4 规定的构建/配置/迁移说明。仅称核心阶段交付，最终功能范围由矩阵和 US-426 约束。

## 13. 风险

| 风险 | 对策 |
| --- | --- |
| 契约理解偏差导致行为漂移 | 契约文档逐条出处行号；fixture CI 门禁；对拍差异必须回写契约 |
| gpui-kit 快照 API 漂移 | 精确锁版本 + ui_adapter 隔离 + 升级窗口 |
| 原版仓库持续迭代 | 基线 commit 冻结；上游变更走 changelog diff 决策（基线记录.md） |
| 流式渲染引擎工作量超预期 | M1 允许渲染保真度降级（功能对齐优先），视觉精修移 M4 |
| AppData 样本缺失（仓库被 gitignore） | 格式已通过代码+测试夹具冻结；US-018 用真实原版客户端数据往返验证兜底 |
| 单人断档 | 三层文档 + fixture + 决策日志即完整上下文，AI 辅助可接续 |

## 14. 修订记录

- v2.3（2026-11-12）：US-002 独立审查复核冻结 server.js:1227，区分 ApiRetryDelay 缺省 1000ms 和示例 200ms；显式配置行为不变。

- v2.2（2026-11-12）：通用检查与审查引用代码质量规范，US-001 承接 CI 落地；协议、技术选型和阶段范围不变。
- v2.1（2026-11-12）：C-11/C-12 收敛精确规则；纠正认证、配置与重复键；将交叉验收依赖项纳入 P0；补前端实测和文档交付责任。产品验证仍待实现。

---

内容由 AI 生成
