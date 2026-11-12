# Omnia · 插件系统设计 v1.4

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 | v1.4 / 2026-11-12（记录库归属定案，节点端措辞同步架构 v2.6） |
| 状态 | **已批准**（方案 A 统一插件架构 + 前端内置清单化/Loom 沙箱承接第三方，用户确认） |
| 适用阶段 | M1–M5；本方案已批准，具体接口和运行行为仍由各阶段契约冻结及实现验证；元数据口径见 `README.md` §5 |
| 基线 | VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` + VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（docs/基线记录.md） |
| 依据文档 | docs/Omnia-架构设计.md §1.3（IN-3 能力沙箱 / IN-4 双轨协议）；docs/Omnia-M0M1-协议契约.md（C-02/C-03/C-07） |
| 编号归属 | 全部 DV 的定义、影响分类及默认行为只在 `docs/Omnia-复刻范围与对应矩阵.md` §6.2 维护；本文说明机制与验收 |
| 范围 | 后端插件引擎全量 + 前端子程序插件化；M1 子集见 M0M1 PRD，本文是完整目标架构 |
| 事实标注 | 【已验证】= 基线源码逐行确认（附文件:行号）；【设计】= Omnia 新增决策；【偏差】= 与原版可观测行为不同，须登记 |
| 源码位置 | D:\code\github\VCPToolBox（Plugin.js 2763 行）、D:\code\github\VCPChat |

---

## 1. 原版机制解剖（设计的事实基础）

### 1.1 后端引擎结构【已验证】

PluginManager 是单例 EventEmitter（Plugin.js:2761-2763），持有状态与执行原语；pluginBridgeRegistry.js 是策略层，两个可扩展注册表把"哪类插件怎么执行/注入什么依赖"解耦：

- **执行桥**（priority 降序，首个 canHandle 命中）：distributed(400) / chrome-control-websocket(300) / direct-hybrid-service(200) / local-stdio(100)【pluginBridgeRegistry.js:219-404】
- **依赖桥**：base 恒含 vcpLogFunctions + pluginManager（整个引擎实例全量暴露），条件注入 vectorDBManager/tdbKnowledgeManager/jevClient/contextBridge 等【pluginBridgeRegistry.js:91-217】

### 1.2 五个结构性缺陷【已验证，Omnia 修复靶点】

| # | 缺陷 | 证据 | 后果 |
| --- | --- | --- | --- |
| D1 | direct 插件零隔离 | require 进主进程同 V8 实例，永不卸载（Plugin.js:920） | 死循环/OOM/未捕获异步异常拖垮主进程 |
| D2 | 无并发控制 | executeAll=Promise.all，同插件无限并发（toolExecutor.js:459-463） | direct 共享实例无锁，状态安全靠插件自觉 |
| D3 | 异步子进程无人回收 | 引擎不跟踪存活子进程，shutdownAllPlugins 不杀子进程（Plugin.js:732-796） | POSIX detached 孤儿进程 |
| D4 | 热重载不重载代码 | require.cache 永不清，reload 只重新 initialize（Plugin.js:2613-2615） | direct 改代码必须重启整服 |
| D5 | 能力面全量暴露 | dependencies.pluginManager = 整个引擎实例（Plugin.js:1014-1017） | 插件可操作引擎一切，无权限边界 |

### 1.3 兼容暗礁【已验证，必须原样处理或显式决策】

1. **注册名 = manifest.name，非目录名**，7 处漂移：FileOperator→ServerFileOperator、VCPEverything→ServerSearchController、PowerShellExecutor→ServerPowerShellExecutor、CodeSearcher→ServerCodeSearcher、PluginSourceViewer→ServerPluginSourceViewer、ImageFileServer→ImageServer、VCPForumLister→ForumLister。无别名回退（Plugin.js:911/1318）
2. **manifest 宽校验**：硬必填仅 name/pluginType/entryPoint（Plugin.js:899），其余全容忍；未知字段大量存在（jev/vcpInfoLifecycle/permissions/configSchemaDescriptions/defaults）
3. **direct 插件与宿主代码强耦合**：RAGDiaryPlugin 相对路径 require 宿主模块（../../TextChunker.js、../../EmbeddingUtils.js、../../modules/messageProcessor.js，RAGDiaryPlugin.js:25-31）——最大兼容点
4. **isDynamic 是纯声明字段**，引擎零消费；动态性由插件 processMessages 自实现（ChromeBridge pageInfoPreprocessor.js:22-46）
5. **configSchema.default 不生效**：_getPluginConfig 只取 插件env > 全局env > 跳过（Plugin.js:213-257）
6. **enabled = 文件名**：启用 plugin-manifest.json / 禁用 .json.block（Plugin.js:2245），无状态文件
7. **同名冲突方向不对称**：注册期本地优先（Plugin.js:2060），热重载期分布式保留压本地（Plugin.js:880）
8. **stdio 输出契约三类不同**：sync=JSON、async=JSON+占位符、static=纯文本（非 JSON）
9. **异步回调 body 无强制 schema**（asyncResultStore.js:52-55 只要求 JSON 对象）；占位符兼容 2/3/4 层花括号（messageProcessor.js:1112）
10. **分布式节点基线不声明/不处理 cancel**（主端有完整消费端 WebSocketServer.js:876-895）；register_tools 携带 pluginSpecificEnvConfig（密钥外发面）；internal_request_file 无大小限制/路径白名单

### 1.4 前端现状：半插件化【已验证】

- 27+ 子程序三形态：独立窗口（多数）/ 内嵌 WebContentsView 标签（11 白名单）/ 主窗口内联面板（酒馆/心流锁/提示词/群聊，同 DOM）
- **无统一注册表**：五处硬编码目录（托盘 VCHAT_APPS 复制两份、action→appId switch、windowAppIds 冻结表、内嵌白名单、Next 启动台复用）
- **三套清单扫描机制已存在**：feature.json（register(host)/dispose + renderer install，仅 DeskPet 1 个在用，appFeatures.js:84-101）、loom.json（LoomApps 完整插件生命周期：扫描→沙箱→热增删→打包，VCPLoomManager.js 2467 行）、主题 JSON 扫描
- 窗口基建良好：windowService 运行时注册 + ready 握手 + 进程级崩溃隔离
- 耦合点：共享全局（chatAPI/utilityAPI/VCPContributions）、内联面板直入 chatManager、后端地址推导各应用重复实现

### 1.5 生态实况【已验证】

Plugin/ 共 96 目录（77 启用 + 19 禁用）：synchronous 39 / hybridservice 19 / static 8 / messagePreprocessor 5 / asynchronous 3 / service 3。"300+"含插件商店云端源。依赖主流模式 = 共享根 node_modules（60+ 插件零声明）；仅 5/77 声明 manifest.dependencies。

节点侧另有一套插件：VCPChat `VCPDistributedServer/Plugin/` 共 38 个目录（33 启用 + 5 禁用，`git ls-tree` 清点），由桌面端主进程内嵌的分布式节点加载（VCPChat main.js:538–551），不计入上面的 96。它们是后端工具到达用户本机音乐、桌面、Loom、文件与终端等能力的通道；承接见范围矩阵 SC-17 与架构 §5.1。

---

## 2. 统一插件模型（前后端同构哲学）【设计】

五个共同抽象，前后端各自原生实现：

```
┌─────────────────────────────────────────────────────────┐
│ 1 清单发现  目录扫描 + manifest，宽进严出，单一注册表       │
│ 2 能力声明  提供什么（工具/占位符/路由/面板）+ 需要什么权限  │
│ 3 宿主注入  沙箱按声明注入句柄；兼容侧车保留原能力面             │
│ 4 生命周期  discover → load → initialize → run → shutdown │
│ 5 事件同步  注册表变更事件驱动（tools_changed/apps_changed）│
└─────────────────────────────────────────────────────────┘
```

| 抽象 | 后端实现 | 前端实现 |
| --- | --- | --- |
| 清单 | plugin-manifest.json（1:1） | app-manifest.json（feature.json 演进） |
| 注册表 | PluginRegistry（本地+分布式统一） | AppRegistry（取代五处硬编码） |
| 能力声明 | capabilities + permissions | capabilities + permissions |
| 宿主注入 | CapabilityManager → 执行桥依赖 | FrontendHost → 能力句柄 |
| 生命周期 | 五阶段 + 热重载 | register/activate/deactivate/dispose |
| 事件 | tools_changed / distributed_tools_offline | apps_changed / state 订阅 |

**原则**：原版已验证的机制（执行桥、feature.json、Loom 沙箱）扶正为统一架构；创新点（能力沙箱、进程治理、前端扩展点）都有明确兼容边界，不赌激进技术。

---

## 3. 后端插件引擎设计

### 3.1 四层架构

```
┌─ 路由层 ToolRouter ─────────────────────────────────────┐
│ JEV 展开 → PluginRegistry 查找 → ExecutionBridge 策略层  │
├─ 执行桥层（priority 降序，首个 canHandle 命中）──────────┤
│ 400 distributed │ 300 chrome-control │ 200 direct-hybrid │
│ 150 wasm-sandbox【新增 IN-3】│ 100 local-stdio           │
├─ 运行时层 ──────────────────────────────────────────────┤
│ StdioRuntime（进程池）│ DirectRuntime（Node 侧车宿主）    │
│ WasmRuntime（wasmtime，IN-3）                            │
├─ 治理层 ────────────────────────────────────────────────┤
│ CapabilityManager │ ProcessGovernor │ ConfigResolver     │
│ HotReloader │ ApprovalGate（C-07）│ RecordStore          │
└─────────────────────────────────────────────────────────┘
```

**RecordStore 归 omnia-plugin**（2026-11-12 定案，依据见架构 §8.1）：工具循环先开记录、把句柄传入并自行收尾；没有传句柄的调用（如调度器）由插件引擎开启并收尾，两条路径写同一个库。

### 3.2 核心接口（签名级）【设计】

```rust
// ===== 注册表 =====
pub struct PluginRegistry { /* RwLock<HashMap<String, PluginEntry>>，单一真源 */ }
pub struct PluginEntry {
    pub manifest: Manifest,
    pub origin: Origin,                 // Local | Distributed { server_id, server_name }
    pub runtime: RuntimeKind,           // Stdio | Direct | Wasm
    pub state: PluginState,             // Discovered|Loaded|Initialized|Running|Disabled|Failed
    pub capabilities: CapabilitySet,
}
pub enum Origin { Local, Distributed { server_id: String, server_name: String } }
impl PluginRegistry {
    pub fn resolve(&self, tool_name: &str) -> Option<Arc<PluginEntry>>;  // 精确匹配，无别名
    pub fn register_local(&self, manifest: Manifest) -> RegisterOutcome; // 注册期本地优先；热重载保留已有分布式项，见 §1.3 第7项
    pub fn register_distributed(&self, server_id: &str, tools: Vec<Manifest>) -> Vec<RegisterOutcome>;
    pub fn unregister_server(&self, server_id: &str) -> Vec<Manifest>;   // 返回快照供 catalog 留档
    pub fn subscribe(&self) -> broadcast::Receiver<RegistryEvent>;
}
pub enum RegistryEvent { ToolsChanged, DistributedToolsOffline { manifests: Vec<Manifest> },
    PluginToggled { name: String, enabled: bool } }

// ===== 执行桥（策略层，1:1 保留 + 扩展）=====
#[async_trait]
pub trait ExecutionBridge: Send + Sync {
    fn name(&self) -> &str;
    fn priority(&self) -> u32;
    fn can_handle(&self, entry: &PluginEntry) -> bool;
    async fn execute(&self, entry: &PluginEntry, args: &Args, ctx: &ExecContext)
        -> Result<ToolOutcome, PluginError>;
}
pub struct BridgeRegistry { /* Vec<Box<dyn ExecutionBridge>>，priority 降序，同级名字典序 */ }
impl BridgeRegistry {
    pub fn register(&mut self, bridge: Box<dyn ExecutionBridge>);
    pub async fn execute(&self, entry: &PluginEntry, args: &Args, ctx: &ExecContext)
        -> Result<ToolOutcome, PluginError>;  // 首个 can_handle 命中；无命中抛 NoBridge
}

// ===== 运行时 =====
#[async_trait]
pub trait PluginRuntime: Send + Sync {
    async fn spawn_or_invoke(&self, entry: &PluginEntry, payload: Option<&str>,
        env: &Env, ctx: &ExecContext) -> Result<RawOutput, RuntimeError>;
    async fn shutdown(&self, entry: &PluginEntry);
}
pub struct StdioRuntime { pool: ProcessPool, governor: Arc<ProcessGovernor> }
pub struct DirectRuntime { host: SidecarHost }       // Node 侧车，JS 接口仿真
pub struct WasmRuntime { engine: wasmtime::Engine, linker: CapabilityLinker }  // IN-3

// ===== 能力管理（IN-3 沙箱限制 D5；兼容侧车保留全权限）=====
pub struct CapabilityManager { /* 沙箱按声明注入；兼容侧车另行仿真原依赖面 */ }
pub struct CapabilitySet {
    pub provides: Provides,             // tools/placeholders/routes/preprocessor
    pub requires: Requires,             // knowledge_base/jev_client/context_bridge/admin_code
    pub permissions: Permissions,       // fs_read/fs_write/network/model_call（opt-in 沙箱用）
}
impl CapabilityManager {
    pub fn build_dependencies(&self, entry: &PluginEntry) -> Dependencies;  // 原生/WASM 使用句柄；侧车保留 JS 兼容接口
    pub fn check_permission(&self, entry: &PluginEntry, op: &Operation) -> PermDecision;
}

// ===== 进程治理（修复 D3）=====
pub struct ProcessGovernor { /* 全量 pid 注册表 */ }
impl ProcessGovernor {
    pub fn track(&self, pid: u32, meta: ProcMeta);
    pub fn kill_tree(&self, pid: u32);          // Win taskkill /T /F；POSIX 进程组信号
    pub fn reap_orphans(&self);                 // shutdown 时全量回收
    pub fn list_alive(&self) -> Vec<ProcMeta>;  // doctor/监控用
}

// ===== 并发治理（修复 D2，opt-in）=====
pub struct ConcurrencyLimiter { /* 按 communication.maxConcurrency，缺省不限（1:1）*/ }

// ===== 配置（1:1 + 显式 default 决策）=====
pub struct ConfigResolver;
impl ConfigResolver {
    pub fn resolve(&self, manifest: &Manifest) -> PluginConfig;
    // 1:1：插件env > 全局env > 跳过；default 不生效（保留原版行为，§1.3 第5项）
    // DebugMode 特判恒 boolean
}

// ===== 热重载（修复 D4）=====
pub struct HotReloader { /* chokidar 语义：manifest 监听 + 500ms debounce + 签名比对 */ }
pub enum ReloadAction { MetadataOnly, RestartDirectHost, FullReload }
impl HotReloader {
    pub fn classify(&self, old: &Manifest, new: &Manifest) -> ReloadAction;
    // stdio 运行变更→下次 spawn 天然热；direct 运行变更→重启侧车宿主（非整服）
}
```

### 3.3 路由决策树（1:1 + WASM 桥）【设计，基于已验证原版树】

```
工具调用 name
├─[A] JEV 虚拟名 → plan() 展开为白名单真实调用 → 递归回本树
├─ river/vref/archery 元数据注入 args（M2 消费 river/vref）
├─[B] PluginRegistry.resolve(name) 未命中 → not found
│      （internal_request_file 注册期过滤，模型打不到；仅 FileFetcher 内部直调）
└─[C] 执行前置：file:// 预拉取（非分布式）→ ApprovalGate（C-07）→ 生命周期 VCPInfo
    └─ BridgeRegistry.execute（priority 降序首个 canHandle）
        ├─ 400 distributed   origin=Distributed → WS execute_tool（serverId 防伪）
        ├─ 300 chrome-ctrl   name=ChromeControl && direct → forwardCommandToChrome
        ├─ 200 direct-hybrid hybridservice && direct → DirectRuntime.processToolCall
        ├─ 150 wasm-sandbox  runtime=Wasm【新增】→ WasmRuntime（能力受限）
        └─ 100 local-stdio   sync|async && stdio → StdioRuntime.spawn
        └─ 无桥命中 → NoBridge 错误
```

**优先级事实保留**：名字空间冲突注册期解决（本地优先）；JEV 先于插件查找；service 只挂路由不进工具桥；static 只产占位符不是工具；dynamicToolRegistry 完全在执行路径外（只管"模型看见什么"）。

### 3.4 六类插件执行时序【设计，协议 1:1】

**static**（占位符生产者，非工具）：
```
cron 触发 → StdioRuntime.spawn（无 stdin）→ 收集 stdout 纯文本
→ 非空覆盖占位符值 / 出错保旧值（仅现值缺失或已是 Error 才写错误串）/ 空保旧值
→ 签名去重（entryPoint/cron/configSchema/env/placeholders 未变且有值则不重跑）
→ 超时杀树但返回已收集输出（不算错误）
```

**synchronous**（stdio 一次性）：
```
args 序列化 JSON（空参→不写 stdin）→ spawn（shell=true, cwd=插件目录）
→ env 三级合并（process.env → pluginConfig → additionalEnv）
→ stdin write + end（无尾随换行）→ 等 exit → JSON.parse(stdout.trim())
→ JSON status 优先于退出码（双向）→ stderr 附 pluginStderr
→ status≠success 抛 {plugin_error}；result 字符串二次 parse 失败包 {original_plugin_output}
→ recordId 回附
```

**asynchronous**（两阶段 + 回调）：
```
spawn → 首个合法 JSON {status,result:{requestId,message}} 即 resolve（进程续跑）
→ 注入 CALLBACK_BASE_URL + PLUGIN_NAME_FOR_CALLBACK
→ 后台完成 POST /plugin-callback/:name/:taskId（Bearer 认证，C-11；body 任意 JSON 对象）
→ asyncResultStore 原子写 VCPAsyncResults/<name>-<taskId>.json
→ webSocketPush 广播 → {{VCP_ASYNC_RESULT::name::id}} 占位符替换（2/3/4 层花括号）
→ archery no_reply：宽限 3000ms/exit 0/首个 success → 静默 resolve
→ ProcessGovernor 跟踪续跑进程，shutdown 回收（修复 D3）
```

**messagePreprocessor**（direct 链）：
```
DirectRuntime 加载（侧车 require）→ initialize(config, deps)
→ 每请求按 preprocessor_order.json 序调 processMessages(messages, config)
→ 返回新 messages；抛错→返回原 messages（错误隔离）
→ $StaticPlaceholderInjection 虚拟阶段可拖动排序
```

**service**（direct 路由）：
```
DirectRuntime 加载 → initialize → registerApiRoutes(router, config, basePath, wss)
→ 挂 /api/plugins/<name>；图床走 /pw=<key>/images|files/*
→ 旧式 registerRoutes 按参数个数兼容（3参/4参）
→ shutdown 清理路由
```

**hybridservice**（三能力并存）：
```
工具能力：direct-hybrid 桥 → processToolCall(args, ctx)（60s 超时 + AbortSignal）
预处理能力：进 messagePreprocessors 链
占位符能力：运行时直写 staticPlaceholderValues 或 processMessages 请求级替换
requiresAdmin → 注入 decryptedAuthCode（取不到拒绝执行）
```

### 3.5 manifest 完整 Schema【设计，基于已验证字段全集】

```rust
pub struct Manifest {
    // 硬必填（缺一拒绝加载，1:1）
    pub name: String,
    pub plugin_type: PluginType,
    pub entry_point: EntryPoint,
    // 通用（容忍缺失）
    pub display_name: Option<String>, pub description: Option<String>,
    pub version: Option<String>, pub author: Option<String>,
    pub manifest_version: Option<String>,          // 恒 "1.0.0"
    pub communication: Option<Communication>,      // {protocol: stdio|direct, timeout?}
    pub config_schema: Option<Map<String, SchemaEntry>>,  // 简写串 或 {type,default,description,min}
    pub capabilities: Option<Capabilities>,
    // 类型专用
    pub refresh_interval_cron: Option<String>,     // static
    pub web_socket_push: Option<WebSocketPush>,
    // 权限/依赖开关
    pub requires_admin: bool, pub requires_knowledge_base_manager: bool,
    pub requires_context_bridge: bool, pub requires_jev_client: bool,
    pub has_api_routes: bool,
    // 扩展（容忍，原样保存）
    pub jev: Option<Value>, pub vcp_info_lifecycle: Option<Value>,
    pub permissions: Option<Vec<String>>,          // TimedTaskQuery 原型，IN-3 消费
    pub dependencies: Option<Dependencies>,        // {npm[],system[]} 或 {python,libraries[]}
    pub compatibility: Option<Value>, pub lifecycle: Option<Value>,
    pub config_schema_descriptions: Option<Value>, pub defaults: Option<Value>,
    pub license: Option<String>,
    // Omnia 扩展（opt-in，不声明则 1:1）
    pub max_concurrency: Option<u32>,              // communication 内，修复 D2
    pub runtime_hint: Option<RuntimeHint>,         // stdio|direct|wasm，IN-3
    // 运行时注入（非文件字段）
    pub base_path: PathBuf, pub plugin_env: Map<String, String>,
    pub is_distributed: bool, pub server_id: Option<String>,
}
pub enum PluginType { Static, Synchronous, Asynchronous, MessagePreprocessor, Service, HybridService }
pub struct Capabilities {
    pub invocation_commands: Vec<InvocationCommand>,  // command 或 commandIdentifier + description + example
    pub system_prompt_placeholders: Vec<Placeholder>, // {placeholder, description, isDynamic?}
    pub services: Vec<ServiceDecl>,
    pub response_format_to_ai: Option<String>,        // SciCalculator 专用
}
```

**校验规则**：宽进（仅 3 硬必填）+ 未知字段容忍（serde flatten 保存）+ 注册名以 name 为准（不加别名）。

### 3.6 三档运行时与能力沙箱（IN-3）【设计】

| 运行时 | 承载 | 隔离 | 兼容 |
| --- | --- | --- | --- |
| StdioRuntime | sync/async/static 子进程 | 进程级（1:1）+ 进程池预热 + Governor 回收 | 冻结基线中 stdio 插件；覆盖清单见范围矩阵 |
| DirectRuntime | direct/hybrid（Node 侧车宿主） | 进程级（修复 D1）+ JS 接口仿真 + shim 兼容层 | RAGDiary 等强耦合插件 |
| WasmRuntime | 新插件（wasmtime 组件） | 能力级（默认拒绝）；冷启动与平台覆盖待测 | opt-in，渐进迁移 |

**DirectRuntime 侧车宿主**（修复 D1/D4 的关键）：
- 独立 Node 进程承载 direct 插件，Rust 主进程经 IPC（stdin/stdout JSON-RPC 或本地 socket）调用
- 仿真 JS 接口：initialize(config, deps) / processMessages / processToolCall(args, ctx) / shutdown / registerApiRoutes
- **shim 兼容层**：由 omnia-plugin 的 DirectRuntime 维护 JS 宿主接口，经 IPC 调用所属模块（分块/Embedding 属 omnia-knowledge，记忆句柄属 omnia-memory，消息循环属 omnia-agent）。shim 适配接口，不复制其状态和算法；RAGDiaryPlugin 强耦合（§1.3 第3项）须用原 JS 挂载路径单独对拍
- 崩溃隔离：侧车崩溃 → 主进程标记插件 Failed + 降级，不拖垮服务
- 热重载：重启侧车宿主即可加载新代码（修复 D4，无需重启整服）
- **记忆类双轨**：默认产品路径由 M2 的 Rust 原生记忆能力实现；原 JS 插件兼容路径由侧车和 shim 承接。原生路径成功不代表 JS 挂载已兼容；二者按 manifest 身份明确选路，避免同名能力同时注册/重复注入。US-101 冻结选路与 API 映射，US-107 验证侧车接口；性能收益另测

**WasmRuntime 能力模型**（IN-3，opt-in）：
```
manifest.permissions 声明 → CapabilityLinker 按声明链接 host function
  fs_read/fs_write：限定目录句柄，越界拒绝
  network：白名单域名
  model_call：经后端鉴权的受限调用
未声明能力默认拒绝；sidecar 兼容层默认全权限（1:1），WASM 默认拒绝（安全增强偏差）
```

### 3.7 分布式插件（1:1 + 能力补全）【设计】

- 协议 1:1：WS 路径 `/vcp-distributed-server/VCP_Key=<key>`、serverId=dist-<clientId> 主端分配、register_tools 全量 manifest、tool_result serverId 防伪、断线 reject 全部 pending
- **Omnia 节点补全 cancel**：声明 capabilities.cancelTool=true + 处理 cancel_tool（原版节点缺失、主端有消费端；这是默认可观测差异 DV-6）
- **泄漏面治理**：register_tools 携带 pluginSpecificEnvConfig 保留协议（1:1），但日志脱敏 + 部署文档警告；Omnia 节点可选配置剔除敏感键（声明偏差）
- internal_request_file：保留无大小限制（1:1）+ Omnia 可选配额（opt-in 偏差）
- 双向混部验收：原版 Node 节点 ↔ omnia-server；Omnia 节点端 ↔ 原版主服务器。节点端协议实现不依赖 omnia-server/omnia-agent，桌面端内嵌与独立节点进程都能装配（架构 §5.1，SC-17）

### 3.8 前端插件化设计

#### 3.8.1 app-manifest.json（feature.json 演进）【设计】

```json
{
  "id": "translator",
  "name": "翻译中心",
  "version": "1.0.0",
  "icon": "assets/icon.png",
  "form": "window",                    // window | embedded | kernel-ext | script
  "entry": { "builtin": "translator" }, // 编译期注册键；不是外部二进制路径
  "capabilities": {
    "provides": ["panel", "command:translate"],
    "requires": ["backend_client", "settings_store"]
  },
  "permissions": ["network"],
  "window": { "width": 900, "height": 700, "singleton": true },
  "activation": ["onCommand:translate", "onStartup"],
  "defaultEnabled": true
}
```

内置 `window/embedded/kernel-ext` 的 `entry.builtin` 对应编译期工厂，由 US-329 校验清单与工厂一致；`script` 才指向脚本目录与能力声明（US-330）。此示例为设计示意，最终字段和错误语义在 US-301 冻结。

#### 3.8.2 AppRegistry 单一真源（取代五处硬编码）【设计】

```rust
pub struct AppRegistry { /* RwLock<HashMap<String, AppEntry>> */ }
pub struct AppEntry { pub manifest: AppManifest, pub state: AppState, pub form: Form }
pub enum Form { Window, Embedded, KernelExt, Script }  // Script = gpui-shell 脚本面板，见 §3.8.4
impl AppRegistry {
    pub fn discover(&self, dirs: &[PathBuf]) -> Vec<AppEntry>;  // 扫描 app-manifest.json
    pub fn register(&self, app: AppEntry);
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent>;
    // 托盘/Dock/内嵌白名单/启动台全部从注册表生成，不再硬编码
}
pub enum AppEvent { AppsChanged, AppToggled { id: String, enabled: bool } }
```

#### 3.8.3 四档形态与生命周期【设计】

| 形态 | 子程序 | 机制 |
| --- | --- | --- |
| window | 易档：翻译/骰子/论坛/日志/主题/RAG | GPUI 独立窗口 + 能力句柄注入 |
| embedded | 中档：笔记/音乐/画布/文坊/IDE | Dock/Tiles 面板 + 事件总线 |
| kernel-ext | 难档：酒馆/心流锁/提示词/群聊 | 受限 trait 扩展点 |
| script | 第三方脚本面板（gpui-shell） | 能力默认拒绝 + 每插件独立 Policy，见 §3.8.4 |

四档与 §3.8.1 `form` 字段、§3.8.2 `Form` 枚举一致；架构 §9 原「三档形态」表述已于 2026-11-12 同步为四档。

```rust
// 生命周期（feature.json register/dispose 演进）
#[async_trait]
pub trait FrontendPlugin: Send + Sync {
    async fn register(&mut self, host: &FrontendHost) -> Result<(), PluginError>;
    async fn activate(&mut self, ctx: &AppContext) -> Result<(), PluginError>;
    async fn deactivate(&mut self) -> Result<(), PluginError>;
    async fn dispose(&mut self);
}
pub struct FrontendHost {           // 能力句柄，取代全局变量
    pub backend: Arc<BackendClient>,
    pub event_bus: Arc<EventBus>,
    pub windows: Arc<WindowManager>,
    pub settings: Arc<SettingsStore>,
}
// 内核扩展点（难档专用，受限 trait，不开放任意内核访问）
pub trait ChatInterceptor { fn intercept(&self, msgs: &mut [Message], stage: Stage); }
pub trait ComposerExtension { fn render(&self, cx: &mut Context) -> AnyElement; }
pub trait MessageRenderer { fn render_message(&self, msg: &Message, cx: &mut Context) -> Option<AnyElement>; }
```

#### 3.8.4 第三方扩展（gpui-shell 脚本 + Loom 沙箱 + DSL）【设计，2026-11-12 更新】

- **gpui-shell 脚本插件（新增首选路径）**：第三方以 JavaScript 脚本贡献面板/工具/业务逻辑，宿主编译一次后脚本热加载，无需 fork/重分发。其能力模型与本设计同构（详见 docs/Omnia-前端框架选型.md §4.2）：Capabilities 默认空集宿主逐项授权、每插件独立 Policy、脚本故障可恢复宿主存活、脚本不在帧路径、HostModule 借宿主 Rust 能力。**M0 US-007 实测 Windows 运行时（0.9.1，gpui-shell 的 milestone M0；quickjs-jit Windows bug 上游已修复 =0.14.1，实测为回归确认）→ M4 US-330 试点 → M5 US-414 推广**；不通过则回退原生 DSL，不阻塞主线
- **Loom 沙箱模式**（原版已验证）：loom.json 清单扫描 + 独立会话 + 热增删 + vcp-loom-package 打包；Omnia 用外部浏览器 + CDP 桥（M5 已定）承接，应用内原生展示快照
- **原生 DSL 部件**（M5 Widget DSL）：AI 生成 schema，GPUI 渲染，不开放任意宿主代码执行；可授权受限 JS 计算子集优先 gpui-shell（deno_core 备选）
- **不开放任意原生代码**：第三方不能写 GPUI 动态库（ABI 稳定性 + 安全成本）；脚本扩展走 gpui-shell 能力沙箱，内置子程序清单化服务于内部解耦与热管理
- **AppRegistry 与 gpui-shell 衔接**：app-manifest.json 的 form 四档之一 `script`（gpui-shell 脚本面板；与 §3.8.1 Schema、§3.8.2 `Form` 枚举一致），entry 指向脚本目录 + gpui-shell.json 能力声明；Dock PanelRegistry 按名重建 + 状态持久化天然支持脚本面板插拔

#### 3.8.5 GPUI 单进程隔离策略（显式风险）【设计/偏差】

GPUI 单进程，**没有 Electron 的多进程崩溃隔离**。对策：
- 插件代码 catch_unwind 边界 + 状态隔离（单插件 panic 收敛为错误态，不崩主窗口）
- **gpui-shell 脚本插件**：脚本故障是可恢复异常，宿主进程存活；语言级沙箱（禁 eval/原型冻结/堆栈与 render 时限）+ 每插件独立 Policy，隔离强于裸 catch_unwind
- 重型子程序（终端/IDE）可选独立进程 + IPC
- 此差异作为显式风险登记：原版子窗口崩溃天然隔离 → Omnia 需主动防护，验收含插件 panic 注入测试

---

## 4. 兼容矩阵与验收

### 4.1 后端兼容矩阵

| 项 | 原版行为 | Omnia 处理 | 验收 |
| --- | --- | --- | --- |
| 注册名 | manifest.name，7 处漂移 | 原样，无别名 | 7 个漂移插件挂载调用成功 |
| manifest 校验 | 3 硬必填 + 宽进 | 1:1 | 缺字段/未知字段用例 |
| stdio 三类输出 | JSON/JSON+占位符/纯文本 | 1:1 | 三类各 ≥2 插件挂载 |
| 配置取值 | 插件env>全局env>跳过，default 不生效 | 1:1 | 边界用例 |
| enabled | 文件名 .block | 1:1 | toggle 用例 |
| 同名冲突 | 注册期本地优先；热重载保留分布式项 | 原样保留方向差异（§1.3 第7项） | 两个方向分别用例 |
| direct 接口 | initialize/processMessages/processToolCall/shutdown | 侧车仿真 | RAGDiary/LightMemo/ChromeBridge 挂载 |
| 宿主模块耦合 | require ../../TextChunker.js | shim 兼容层 | RAGDiaryPlugin 召回对拍 |
| 分布式协议 | WS/register/execute/防伪 | 1:1 + cancel 补全 | 双向混部全场景 |
| 审核 | C-07 | 1:1 | 拒绝/超时/留言用例 |

### 4.2 前端兼容矩阵

| 项 | 原版 | Omnia | 验收 |
| --- | --- | --- | --- |
| 子程序功能 | 27+ 各自验收 | 逐个对照 | 功能清单走查 |
| AppData | 双向兼容 | 1:1（C-08） | 往返验证 |
| Loom 应用 | loom.json + 沙箱 | 外部浏览器+CDP 承接 | 14 命令对拍（M5） |
| 主题/壁纸 | JSON 扫描 | 1:1 | 切换广播 |
| 崩溃隔离 | 进程级 | catch_unwind + 可选进程 | panic 注入测试 |

### 4.3 逐缺陷修复验收

| 缺陷 | 验收用例 |
| --- | --- |
| D1 隔离 | direct 插件注入死循环/OOM/未捕获异常 → 主进程存活，插件标记 Failed |
| D2 并发 | maxConcurrency=1 时同插件串行；不声明时并发（1:1） |
| D3 回收 | 异步插件续跑中 shutdown → 无孤儿进程（进程表核验） |
| D4 热重载 | direct 改代码 → 重启侧车 → 新代码生效，主进程不重启 |
| D5 能力 | WASM 插件未声明 fs_write → 写操作拒绝；sidecar 默认全权限 |

---

## 5. 偏差登记与兼容边界

DV 的唯一定义源为[范围矩阵 §6.2](Omnia-复刻范围与对应矩阵.md)。默认开启的侧车隔离、进程回收、热重载、节点取消、前端启停和崩溃隔离（DV-1/3/4/6/9/10）可能改变故障、时序或资源行为，按已批准例外披露，不能因“增强”或“实现层”标签自动认定等价。

并发限制、WASM 能力限制、注册配置脱敏、文件配额（DV-2/5/7/8）是可选行为；默认关闭，启用和回退按矩阵验证。兼容侧车保留原版权限面，不能将 WASM 的默认拒绝保证套用到存量插件。

IN-4 默认使用文本协议；只有模型能力可用且等价性门禁通过后才走原生调用，否则回退文本。其错误、流式和审核语义仍遵守统一契约。

---

## 6. 落地节奏与文档衔接

| 阶段 | 插件系统范围 | 衔接文档 |
| --- | --- | --- |
| M1 | stdio + manifest + static + 审核最小 | M0M1 PRD US-010~012 |
| M2 | DirectRuntime 侧车 + 记忆类 Rust 原生 + shim | M2 PRD US-107 |
| M3 | 六类全量 + 分布式 + 治理层（Governor/并发/热重载） | M3 PRD US-202~219 |
| M3+ | WasmRuntime 能力沙箱（IN-3 独立立项） | M3 PRD §1 创新条目；范围矩阵 §6.3 |
| M4 | AppRegistry + 内置清单化 + 事件总线 | M4 PRD US-301/US-329 |
| M4 | 内核扩展点与脚本试点 | M4 PRD US-329/US-330；P1 延期按 SC-16 承接 |
| M5 | Loom 第三方 + DSL 部件 | M5 PRD §6/§7 |

**与 IN-4 双轨协议衔接**：工具协议双轨（原生 function calling + 文本标记）在路由层 [A] 之前按模型能力分流，执行桥层完全复用本设计——双轨只改"工具调用怎么进来"，不改"进来后怎么执行"。

---

## 7. 风险

| 风险 | 对策 |
| --- | --- |
| direct 侧车 shim 兼容层工作量大（宿主模块仿真） | M2 先做记忆类 Rust 原生绕过最大耦合点；其余 direct 插件 shim 渐进补齐；Top-20 仅为阶段样本，全量覆盖由 SC-16 / US-427 核对 |
| 侧车 IPC 延迟影响 direct 性能 | 本地 socket + 批量调用；记忆类原生化后热路径无 IPC |
| WASM 生态对 Node API 兼容不成熟 | IN-3 仅面向新插件，存量留 sidecar；不强制迁移 |
| GPUI 单进程隔离弱于 Electron | catch_unwind + 状态隔离 + 重型可选进程；panic 注入验收 |
| 前端内核扩展点定义不当导致耦合反弹 | 受限 trait 白名单，扩展点评审制，不开放任意内核访问 |
| 分布式 env 泄漏 | 协议保留 + 日志脱敏 + 部署警告 + 可选剔除 |

---

## 8. 修订记录

- v1.4（2026-11-12）：同步架构 v2.6：§3.1 RecordStore 定案归 omnia-plugin；§3.7 节点端实现改称“Omnia 节点端”并写明依赖约束。其余设计不变。
- v1.3（2026-11-12）：§1.5 补节点侧 38 个插件目录的事实（SC-17）；§3.1 登记 RecordStore 归属待定（架构 §8.1）；更正 Plugin.js 行数为 2763。设计内容不变。
- v1.2（2026-11-12）：统一侧车与原生能力职责，修正同名冲突与回调认证；前端宿主改称 FrontendHost，补齐 US-329/US-330 承接；移除重复 DV 表，保留既定技术路线。

内容由 AI 生成
