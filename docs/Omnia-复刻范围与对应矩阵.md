# Omnia · 复刻范围与对应矩阵 v1.4

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v1.4 / 2026-11-12 / **生效** |
| 性质 | **范围问题的唯一权威**（见 `README.md` §4 按主题归属规则） |
| 基线 | VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` + VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（`docs/基线记录.md`） |
| 适用阶段 | M0–M5 全阶段；每阶段启动时复核一次 |
| 事实标注 | 同 `README.md` §5.2；【已验证】= 冻结基线源码/原版文档确认，【设计】= Omnia 决策 |
| 依据文档 | `README.md`、`docs/Omnia-架构设计.md` §1/§2/§12、各阶段 PRD §1、`docs/Omnia-插件系统设计.md` §5 |
| 范围成熟度 | 最终范围规则已明确；SC-01～SC-17 为待细化或未交付的补齐责任，不代表实现完成 |

> 本表保留既定技术选型。冻结基线内的用户功能、协议与数据能力均属于最终复刻目标；没有详规的能力进入 §5 补齐队列，不能自动排除。排除必须区分实现资产不照搬与用户能力不提供；后者须有明确批准及兼容性声明。

---

## 1. 口径与处置代码

**1:1 的定义**（架构 §1.1）：协议级、行为级、数据级对齐；非目标为像素级 UI 克隆与直接执行原版 Web 资产。行为等价的实现替换不缩减范围；可观测差异另登记为默认兼容差异或可选扩展。

| 代码 | 含义 | 是否需登记 |
| --- | --- | --- |
| `1:1` | 按协议/行为/数据对齐复刻 | 否 |
| `基线` | 仅作为契约依据或 vendoring 来源，不重写其行为 | 否 |
| `断点 BP-xx` | 纯原生约束下换形态，兼容性有可见差异 | 是，见 §6.1 |
| `偏差 DV-xx` | 与原版可观测行为不同 | 是，见 §6.2 |
| `创新 IN-x` | 实现层/扩展层优化条目 | 是，见 §6.3 |
| `实现替换` | 原代码/脚本不照搬，用户能力仍须验收 | 指向对应能力与替代验收 |
| `明确排除` | 已批准不提供的能力，如像素级 UI 克隆 | 附批准依据和影响 |
| `范围内待细化 SC-xx` | 最终范围内，详规或交付未闭合 | 指向 §5 的负责 US、验收及截止点 |

**优先级统一口径**（README §5.4）：P0 是阶段门禁；P1 延期须显式移交；P2 未纳入当前阶段交付，必须写承接任务或 SC。阶段交付不代表最终兼容完成，SC 未清零不得通过 US-426。

**里程碑**：M0 契约与骨架 / M1 核心闭环 / M2 记忆 / M3 插件全量与分布式 / M4 前端子程序与创作工程 / M5 深水区与分发（架构 §12）。

---

## 2. 冻结基线资产盘点【已验证：冻结 commit 的 git ls-tree 清点，2026-11-12】

| 侧 | 资产 | 数量 / 说明 |
| --- | --- | --- |
| 后端 | `Plugin/` | 96 个插件目录（77 启用 + 19 禁用），六类协议；见插件系统设计 §1.5 |
| 后端 | `modules/` | 46 项 = 39 个 `.js` 文件 + 6 个子目录（`handlers/`、`vcpLoop/`、`knowledgeBase/`、`tagmemoV10/`、`LogMonitor/`、`SSHManager/`）+ `AGENTS.md` |
| 后端 | `routes/` | 9 项（含 `admin/` 子目录） |
| 后端 | 顶层 `*.js` | 20 个核心文件 |
| 后端 | `docs/` | 约 70 份规格文档，含 `FEATURE_MATRIX.md`（1235 行） |
| 后端 | 其它 | `AdminPanel-Vue/`、`Agent/`、`TVStxt/`、`ToolConfigs/`、`config/`、`dailynote/`、`knowledge/`、`OpenWebUISub/`、`SillyTavernSub/`、`rust-vexus-lite/` |
| 前端 | `*modules` / `*Modules` | **25 个目录 = 24 个具体子程序 + 1 个通用 `modules/`** |
| 前端 | Rust 侧车 | `rust_audio_engine/`、`rust_assistant_engine/`、`rust_chat_data_service/`、`rust_projectforge_indexer/`、`rust_voice_input_engine/`、`sovits5cppmanager/` |
| 前端 | 独立子系统 | `VCPDistributedServer/`、`VCPHumanToolBox/`、`VchatManager/`、`NativeSpalash/`、`SovitsTest/`、`RMMusic/`、`audio_engine/`（分发产物） |
| 前端 | 其它 | `AppData/`（用户数据，被 .gitignore 忽略）、`apps/`、`assets/`、`styles/`、`tests/`、`docs/`、`migration/`、`launchers/`、`scripts/`、`examples/`、`artifacts/`、`preloads/`、`vendor/`、`bootstrap/` |

**口径更正**：原版 README 与插件系统设计 §1.4 的「27+ 子程序」来自原版 README 功能矩阵的条目统计，与仓库目录数 25 不是同一口径。本表以目录清单为准；功能矩阵中的 `AskNova`、`米家`、`V日报`、`Flash DeepSearch` 等条目见 SC-10；目录数不是功能完成率的分母。

---

## 3. 后端对应矩阵

「原模块」列以冻结基线目录/文件名为准；「Omnia 去向」列取架构 §2 crate 映射表与 §13 仓库结构。

### 3.1 服务入口、协议与工具循环

| 原模块 / 资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `server.js` + `modules/chatCompletionHandler.js` | HTTP 入口、中间件链、17 步处理管线 | `omnia-server` / `omnia-agent` | `1:1` | C-10、M0M1 PRD §3 |
| `modules/handlers/`（`streamHandler.js`、`nonStreamHandler.js` 等） | 流式/非流式响应、SSE 序列 | `omnia-server` | `1:1` | C-04、M0M1 PRD §3.2 |
| `vcpInfoHandler.js`、`modules/toolResultBatch.js`、`modules/vcpLoop/toolExecutor.js` | 工具结果可见域、批次包裹、双通道分发 | `omnia-agent` / `omnia-protocol` | `1:1` | C-01、契约 §1 |
| `modules/messageProcessor.js`、`modules/tvsManager.js`、`TVStxt/` | 占位符替换、变量系统、静态占位符 | `omnia-agent` / `omnia-plugin` | `1:1` | C-03、契约 §3 |
| `modules/dotenvPatch.js` + `config.env.example` | 配置加载与特殊字符补丁 | `omnia-config` | `1:1` | C-06、契约 §6 |
| `modules/toolCallRecordStore.js` | 工具调用记录 SQLite（WAL） | `omnia-plugin`（工具循环经句柄使用） | `1:1` | M0M1 PRD §5.2；架构 §8.1 |
| `modules/toolApprovalManager.js`、`modules/toolResultPrivacyGuard.js` | 审核规则、隐私过滤 | `omnia-approval`（M1 最小子集在 `omnia-plugin`） | `1:1` | C-07、M3 PRD §7 |
| `modules/contextManager.js`、`foldProtocol.js`、`roleDivider.js`、`reasoningContentAdapter.js` | 上下文修剪、折叠协议、角色切分、思考适配 | `omnia-agent` | `1:1` | C-10 步骤 3/9/11、M2 P1 |
| `modules/finalContextStore.js`、`modules/vcpLogReplayManager.js` | 重放缓存与日志回放 | omnia-agent / omnia-ws | `范围内待细化 SC-13` | C-10；M3 US-201 |
| `modelRedirectHandler.js`、`routes/specialModelRouter.js`、`modules/semanticModelRouter.js`、`SemanticModelRouter.json` | 模型重定向与语义路由 | `omnia-model` | `1:1`（重定向 M1，语义路由转 SC-14） | C-10 步骤 4/7、M3 §1 P2 |
| `modules/agentManager.js`、`Agent/`、`OneRing` 相关阶段钩子 | 多 Agent 协作 | `omnia-agent` 内阶段钩子 + 插件，**不设独立 crate** | `1:1` | 架构 §2 |

### 3.2 插件引擎与生态

| 原模块 / 资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `Plugin.js`（2763 行）、`modules/pluginBridgeRegistry.js` | 六类插件宿主、执行桥与依赖桥 | `omnia-plugin` | `1:1` | C-02、插件系统设计 §1.1 |
| `Plugin/` 96 个目录（77 启用插件类型数为 39/19/8/5/3/3；另 19 禁用） | 冻结插件生态 | sidecar 挂载 + 高频者原生化 | `1:1` / `基线` | M3 逐插件登记；Top-20 为阶段样本，不代表 96 项终验 |
| `modules/dynamicToolRegistry.js`、`asyncResultStore.js` | 动态工具注册、异步回调结果 | `omnia-plugin` / `omnia-dist` | `1:1` | M3 PRD §2.1、§5 |
| `modules/toolLifecycleVcpInfo.js`、`toolCallRecordInternalFilter.js`、`safeFilePath.js`、`safeZipExtractor.js` | 生命周期与输入防护 | `omnia-plugin` | `1:1` | 插件系统设计 §1 |
| `routes/specialModelRouter.js` 等 `routes/*.js` 中的插件路由 | 插件 HTTP 端点 | `omnia-server` | `1:1` | M0M1 PRD §3.3 |
| 原版 direct 插件零隔离 / 无并发控制 / 异步进程无回收 / 热重载不重载代码 / 能力面全量暴露 | 五个结构性缺陷 D1–D5 | 侧车 + Governor + 可选能力声明 | `偏差 DV-1/2/3/4/5` 等，见 §6.2 | 插件系统设计 §1.2、§4.3 |

### 3.3 记忆与知识库

| 原模块 / 资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `rust-vexus-lite/`（Rust 内核 + 契约测试） | 现行记忆热路径内核 | `crates/vexus-lite/` vendoring | `基线` / `1:1` | 架构 §4、M2 PRD §3 |
| `KnowledgeBaseManager.js`、`modules/knowledgeBase/`、`dailynote/`、`knowledge/` | 索引管道、日记、知识库编排 | `omnia-knowledge` | `1:1` | M2 PRD §2/§5 |
| `TagMemoEngine.js`、`TagMemoV10Engine.js`、`RiverMemoEngine.js`、`modules/tagmemoV10/` | 标签记忆与拓扑召回 | `omnia-memory`（内核句柄边界） | `1:1`（算法权威见 M2 §0.2） | M2 PRD §2、§6.3 |
| `TDBKnowledge.js` | 冷知识库 / 2-bit 检索 | omnia-knowledge | `范围内待细化 SC-12` | M2 US-101；US-427 |
| `EmbeddingUtils.js`、`TextChunker.js`、`ResultDeduplicator.js`、`modules/associativeDiscovery.js` | 向量化、分块、去重、联想锚定 | `omnia-knowledge` | `1:1`（部分 M2 P1） | M2 PRD §5/§7 |
| `TVStxt/Dailynote.txt` 等提示词资产 | 日记与占位符模板 | 资产原样复用 | `1:1` | C-03、M2 §7.4 |
| `docs/MEMORY_SYSTEM.md` vs `RIVERMEMO_TOPOLOGY_V3.md` / `RIVERMEMO_RRF_SCORE_CONTRACT.md` | 两个时期算法口径 | 以基线代码 + V3 拓扑为准 | `基线`（历史资料不作为当前算法规范） | M2 §0.2 |

### 3.4 分布式、WebSocket 与调度

| 原模块 / 资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `WebSocketServer.js` | 六类客户端、VCP_Key 认证、广播、心跳 | `omnia-ws` | `1:1` | M3 PRD §4 |
| `FileFetcherServer.js` | 跨节点透明文件访问 | `omnia-filefetch` | `1:1` | M3 PRD §6 |
| `VCPChat/VCPDistributedServer/`（`VCPDistributedServer.js` 955 行） | 分布式节点服务端（协议） | `omnia-dist`，远端可继续跑原版 | `1:1`；节点侧插件与内嵌宿主见 SC-17 | 架构 §10、M3 PRD §5 |
| `routes/taskScheduler.js` | 定时任务与结果持久化 | `omnia-scheduler` | `1:1` | M3 PRD §8 |
| `modules/browserRuntimeManager.js` + ChromeBridge 类插件 | 浏览器观察/控制通道 | `omnia-dist` | `1:1`（M3 P1） | M3 §1 P1 |
| `WorkerPool.js` | 原版 JS 工作线程池 | 由 tokio 运行时承担 | `实现替换`（任务调度行为仍对拍） | 架构 §7 并发模型 |

### 3.5 管理面、桥接与运维资产

| 原模块 / 资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `adminServer.js`、`routes/adminPanelRoutes.js`、`routes/admin/` | 管理 API 端点 | `omnia-server` admin_api | `1:1`（M1 最小子集 / M3 补全） | M0M1 PRD §1 P1、M3 §9 |
| `routes/dailyNotesRoutes.js`、`forumApi.js` | 日记与论坛 API | `omnia-server` | `1:1`（M3 P1） | M3 §9 |
| `AdminPanel-Vue/` | 管理界面及工作流 | 原生管理页，API 与页面分别验收 | `范围内待细化 SC-01` | M3 API；M4 管理页详规；US-427 收口 |
| `OpenWebUISub/`、`SillyTavernSub/`、`routes/protocolBridge.js`、`routes/searchWorker.js` | 外部客户端桥接与搜索代理 | omnia-server / omnia-model | `范围内待细化 SC-02` | 保留接入能力，外部客户端本体不属于 Omnia |
| `modules/LogMonitor/`、`modules/SSHManager/`、`modules/captchaDecoder.js`、`modules/sarPromptManager.js`、`modules/sensitiveEnv.js`、`modules/multiModalConfigStore.js` | 宿主服务、提示词和配置 | server/plugin/agent/config 按接口归属拆分 | `范围内待细化 SC-03` | US-201 提取调用方和依赖，不按文件名新增 crate |
| `modules/jev*.js` | JEV 语义决策能力 | 记忆/模型/Agent 对应接口 | `范围内待细化 SC-12` | M2 US-101；基线记录 §2 |
| `Dockerfile`、`docker-compose.yml`、`ecosystem.config.js`、`backup*.py`、`*.bat` | 部署、运行与恢复 | Omnia 运维/分发资产 | `实现替换` / SC-15 | 不照搬原脚本；独立后端部署与备份恢复不能被桌面安装包验收替代 |
| `config/`、`ToolConfigs/`、`config.env.example` | 配置样例 | `omnia-config` | `1:1`（键名与格式） | C-06、M0M1 PRD §3.5 |

---

## 4. 前端对应矩阵

### 4.1 全部 25 个 `*modules` 目录【已验证：目录清点】

| # | 原目录 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- | --- |
| 1 | `Agenttaskmodules` | Agent 任务面板 | omnia-app | `范围内待细化 SC-06` | M4 US-301；US-427 收口 |
| 2 | `Canvasmodules` | Canvas 代码/Markdown 协作工作台与 Python 执行 | omnia-app Canvas 工作台（独立于文坊白板） | `范围内待细化 SC-08` | M4 US-301；US-427 收口 |
| 3 | `Chartmodules` | V图表 | omnia-app 图表程序 | `范围内待细化 SC-05` | M4 US-301；US-427 收口 |
| 4 | `DeskPetmodules` | 桌宠 | M5 P1 | `1:1` / `断点 BP-08` | M5 §11 |
| 5 | `Desktopmodules` | VCPDesktop 挂件桌面 | M5 P0 原生版 | `1:1` / `断点 BP-06` | M5 §7 |
| 6 | `Dicemodules` | 3D 骰子 | M5 P1 | `1:1` / `断点 BP-07` | M5 §11 |
| 7 | `Flowlockmodules` | 心流锁自主循环 | M4 P0 / M5 自主生活 | `1:1` | M4 §1 P0、M5 §8.3 |
| 8 | `Forummodules` | VCP 论坛 UI | M4 P0 | `1:1` | M4 §1 P0 |
| 9 | `Gamemodules`（4 个游戏） | doudizhu / forge-tax / srpg / vcp-neon-game | M5 终验前补齐 | `范围内待细化 SC-11` | 逐游戏冻结与验收 |
| 10 | `Groupmodules` | 群聊与协作模式 | omnia-app kernel-ext | `范围内待细化 SC-04` | M4 US-301；US-427 收口 |
| 11 | `Logmodules` | 日志面板 | omnia-app window | `范围内待细化 SC-07` | M4 US-301；US-427 收口 |
| 12 | `Loommodules` | Loom 外壳与管理 | M5 P0 Loom 适配版 | `1:1` / `断点 BP-05` | M5 §6 |
| 13 | `Memomodules` | Memo 神经云图 | M4 P1「Memo 记忆中心 UI」 | `1:1` | M4 §1 P1 |
| 14 | `Musicmodules` | VMusic 三层架构 | M5 P0 | `1:1` / `断点 BP-07/BP-10` | M5 §5 |
| 15 | `Notemodules` | 笔记 + 迷你便签 | M4 P0 | `1:1` | M4 §1 P0 |
| 16 | `PluginManagerModules` | 插件管理中心 | M4 P0 | `1:1` | M4 §1 P0 |
| 17 | `ProjectForgemodules` | V工程 IDE | M4 P0 | `1:1` | M4 §5 |
| 18 | `Promptmodules` | 系统提示词编辑 | omnia-app kernel-ext | `范围内待细化 SC-07` | M4 US-301；US-427 收口 |
| 19 | `RAGmodules` | RAG Observer | omnia-app window | `范围内待细化 SC-07` | M4 US-301；US-427 收口 |
| 20 | `ScriptoriumModules` | 共笔文坊 V3 | M4 P0 | `1:1` / `断点 BP-03/BP-04/BP-09` | M4 §4 |
| 21 | `Tavernmodules` | Tavern 预设 | M4 P0 | `1:1` | M4 §1 P0 |
| 22 | `Themesmodules` | 主题管理 | omnia-app window | `范围内待细化 SC-07` | M4 US-301；US-427 收口 |
| 23 | `Translatormodules` | 翻译中心 | M4 P0 | `1:1` | M4 §1 P0 |
| 24 | `Voicechatmodules` | 语音输入 / VoiceChat | M5 P1 | `1:1` | M5 §9 |
| 25 | `modules` | 主程序通用模块（chat/、assistant/、appFeatures.js 等） | `omnia-app` ChatKernel + 通用层 | `1:1` / `基线` | C-08/C-09、M0M1 PRD §7 |

### 4.2 其它前端资产

| 原资产 | 功能 | Omnia 去向 | 处置 | 出处 |
| --- | --- | --- | --- | --- |
| `rust_audio_engine/` | 音频引擎 Rust 源码 | `crates/rust_audio_engine/` vendoring（M5 P0） | `基线` | M5 §0.1/§4、架构 §4 |
| `rust_assistant_engine/` | 麦克风捕获 / 助手引擎 | M5 P1 麦克风 | `基线` | M5 §9 |
| `rust_projectforge_indexer/` | 已存在的 AST 索引器 Rust 源码 | M4 P0 索引器重实现 | `基线` | 保留决策，纠正源码不存在的依据；M4 §5.2 |
| `rust_chat_data_service/`、`rust_voice_input_engine/`、`sovits5cppmanager/` | 数据服务 / 语音输入 / SoVITS 管理 | 对应数据/语音模块 | `范围内待细化 SC-09` | C-08 允许 M1 直接读文件；其余用户能力独立验收 |
| `VCPDistributedServer/` | 分布式节点协议；桌面端内嵌节点与 38 个节点侧插件目录 | 协议归 `omnia-dist`（M3）；内嵌宿主与节点侧插件待定 | `1:1`（协议）/ `范围内待细化 SC-17` | M3 §5；架构 §5.1 |
| `VCPHumanToolBox/`、`VchatManager/`、`SovitsTest/`、`NativeSpalash/` | 人类工具箱 / 数据维护 / TTS / Rust 启动器 | M4 P0 / M4 P1 / M5 §9 / M5 §12 | `1:1` | 对应 PRD |
| `audio_engine/`（exe 分发产物） | 音频二进制资产 | vendoring 源码构建产物 | `实现替换` | M5 US-405 |
| `RMMusic/` | Rainmeter 皮肤及外部集成 | 冻结基线接入能力 | `范围内待细化 SC-15` | 不以未声明作为排除依据 |
| `AppData/` | 用户数据目录 | `omnia-app` 兼容读写 | `1:1`（格式由代码+夹具重建，**待真实数据往返验证**） | C-08、契约 §8.0 |
| `tests/`、`docs/`、`assets/`、`styles/`、`examples/`、`migration/`、`launchers/`、`scripts/`、`bootstrap/`、`apps/`、`artifacts/`、`preloads/`、`vendor/` | 规格依据、资产与工程配套 | 按需取样 / 资产复用 | `基线` / SC-15（按功能、数据、测试、样例和构建资产分类） | M4 §7 |

---

## 5. 终验前补齐清单（SC）

以下条目均在最终复刻范围内，当前尚无完整验收证据。负责 US 先按冻结源码分解能力，写入对应契约/PRD；US-427 汇总收口，不代替各模块实现。M5 核心交付允许尚有 SC，US-426 全项目终验不允许。

| 编号 | 能力与资产 | 负责阶段 / US | 完成证据 |
| --- | --- | --- | --- |
| SC-01 | AdminPanel 管理界面及工作流 | M3 US-201 提取 API；M4 US-301 管理页；US-427 | 基线页面/操作清单逐项对应；配置、Agent、知识库、监控、日志及梦境审批不能只测 API |
| SC-02 | protocolBridge、searchWorker、OpenWebUI/SillyTavern 接入 | M3 US-201；US-427 | 各基线协议/错误/流式路径对拍，外部客户端互通 |
| SC-03 | LogMonitor、SSHManager、验证码、Sar 提示词、敏感/多模态配置 | M3 US-201；US-427 | 逐模块公开能力、宿主依赖和错误映射；相关插件可用 |
| SC-04 | Groupmodules 群聊 | M4 US-301；US-427 | 群配置、编排、消息归属和数据往返；JEV 依赖归 SC-12 |
| SC-05 | Chartmodules 图表 | M4 US-301；US-427 | 数据源、更新、协作、浮窗；原生不支持的能力登记 BP |
| SC-06 | Agenttaskmodules 任务面板 | M4 US-301；US-427 | 查看/控制/状态订阅逐入口验收 |
| SC-07 | Logmodules、Promptmodules、RAGmodules、Themesmodules | M4 US-301；US-427 | 四套独立能力清单；不以形态分类或相近子程序代替验收 |
| SC-08 | Canvasmodules 协作工作台 | M4 US-301 / M5 US-401 冻结；US-427 | 代码/Markdown 协作、Python 执行、版本回溯；运行差异按 BP-11 披露 |
| SC-09 | rust_chat_data_service、rust_voice_input_engine、sovits5cppmanager | M4 US-301 数据侧；M5 US-401 语音侧；US-427 | 区分加速器与用户能力；语音输入、模型管理和数据操作分别验收 |
| SC-10 | AskNova、Mijia、V日报、Flash DeepSearch | M4 US-301 / US-327；US-427 | 四个独立验收项；外部服务接入/失败提示、固定响应夹具；不承诺第三方持续在线 |
| SC-11 | 四个游戏、视听工坊高级、动态壁纸视频化 | M5 US-401；US-427 | 各功能独立规格与用例；已批准降级逐项记录 |
| SC-12 | JEV、四轨实验室、TDB 冷知识库、音乐日记跨设备同步 | M2 US-101；M5 US-401；US-427 | 逐能力行为/数据对拍；接口占位或关闭功能不算完成 |
| SC-13 | finalContextStore/vcpLogReplayManager、Detector、OneRing | M3 US-201；US-427 | 缓存重放、断线补发、预处理/后处理与多 Agent 钩子用例 |
| SC-14 | 语义模型路由、VCPMobile 互通、备份/容灾、停机生命周期（四态、放行清单、拒绝响应、阶段与超时；骨架见架构 §5.3） | M3 US-201；M5 US-404；US-427 | 路由、移动端接入、故障恢复演练；停机期间各响应与阶段次序录制对拍；插件原生化另属内部优化 |
| SC-15 | RMMusic、迁移/启动/分发脚本、其它资产和未展开模块 | M4 US-301 清点；M5 US-401/US-404；US-427 | 冻结树到能力清单无遗漏；每项说明复用/替换/批准排除及依据 |
| SC-16 | 各阶段延期 P1 与未闭合的插件覆盖 | 各阶段集成 US 移交；US-427 | 来源 US、负责模块、补齐用例与结果；96 插件逐项状态 |
| SC-17 | 桌面端内嵌分布式节点及节点侧插件（`VCPDistributedServer/Plugin/` 38 个目录） | M3 US-201 冻结节点协议并核定节点端实现所在 crate（不依赖 omnia-server/omnia-agent，架构 §5.1）；M4 US-301 清点节点侧插件；US-427 | 38 个目录逐项状态（启用与 .block 分开）及其承接方式（原生实现 / 兼容宿主 / 批准排除）；内嵌开关、节点名、连接参数与后端 IP 特判对拍；架构 §5.1 |

SC 是补齐责任而非实现状态。细分条目须有稳定子编号、原路径/符号、能力、目标模块、US、契约、测试与状态；一个能力不能同时标排除和待补齐。缩减最终范围须另记批准，不以未排期替代决定。

**对象区分**：文坊白板为 `ScriptoriumModules/scriptorium-board.js`（.excalidraw，M5 US-422）；Canvas 工作台为 `Canvasmodules/canvas.js`（含 executePythonCode）。二者独立验收。舞台实际清单由 US-401 核定，“8/9 模式”文档差异不代表减少模式。

---

## 6. 断点 / 偏差 / 创新总表（唯一编号入口）

> 本表汇总分散在架构 §1.1/§9、M4 §0.2、M5 §2/§7.5/§13、插件系统设计 §5、各 PRD 创新条目中的声明。原位置描述保留，但**编号、影响分类、默认行为、启用条件与回退以本表为准**。

### 6.1 兼容性断点（BP）

| 编号 | 断点 | 原版 | Omnia | 来源 | 验收 |
| --- | --- | --- | --- | --- | --- |
| BP-01 | 像素级 UI 克隆、直接执行原版 HTML/JS 资产 | Web 渲染 | GPUI 原生 | 架构 §1.1、§9 | 行为用例，不做像素比对 |
| BP-02 | V4 机制替换（无能力缩减） | DOM 机制 | 保留行为目标（IN-1） | M4 §2.0 | 迟到拒写、锚定、离屏更新与布局稳定性 |
| BP-03 | 可编程岛 Three.js / WebGL / Pyodide | 可执行岛 | 静态快照 + 审计声明；存量含 3D/WASM 岛文档不能完整运行，源码与身份保留 | M4 §0.2、架构 §9 | 存量文档打开不报错、岛内容可查看 |
| BP-04 | Mermaid / KaTeX | Web 库全量 | 原生子集（流程图/时序图、公式排版），其余显示为代码块 | M4 §0.2 | 子集用例 + 降级展示 |
| BP-05 | Loom 内置浏览器与网页自动化 | 内嵌浏览器 | 外部浏览器 + CDP 桥，应用内原生快照；14 命令语义保留 | 架构 §9、M5 §6.5 | Loom 14 命令对拍 |
| BP-06 | AI 生成 HTML 小部件 / 白板 HTML 节点 | 任意 HTML/JS 执行 | 原生 Widget DSL + 嵌入式 JS 计算子集；存量 HTML 不直接运行 | 架构 §9、M5 §7.5/§10 | DSL 等价覆盖原版沙箱变量面 |
| BP-07 | 3D 音乐舞台 / 视频 / 3D 骰子 | WebGL / 视频 | 2D 舞台 6 模式 P0，3D 或 2.5D 降级 P1；视频 M0 实测确认锁定 GPUI 栈无原生组件（GPUI 实测报告 F8），降级或外部引擎由 M5 决策 | 架构 §9、M5 §5/§11 | 舞台模式表逐项对拍 |
| BP-08 | 桌宠 Live2D、非 Windows 音频专属能力（WASAPI 独占 / DSD） | Live2D / Windows 专属 | 原生精灵动画 / 明示不可用 | M5 §4.2/§11/§13 | 降级路径用例 |
| BP-09 | DOCX/PPTX 二进制兼容、Office 导入无损、分页逐像素 | Office 兼容 | .vdocx/.vpptx 容器 1:1，二进制不兼容，导入不保证无损 | M4 §4.3 | 原版工程文件往返 |
| BP-10 | Folia 派生舞台组件（AGPL-3.0） | 含派生代码 | 清洁室重实现，禁止打开/参考/复制 | 架构 §1.2、M5 §3 | Folia 清洁室审计记录（M5 交付门禁） |
| BP-11 | Canvas 工作台运行时 | 代码/Markdown 协作与 Python/WASM 路径 | SC-08 提取各路径；不能直接承载的 Web 能力显式替代/降级 | SC-08、M4 US-301 | 独立工作台用例，文坊白板不计入本项 |
| BP-12 | `wry` WebView 后门 | — | 启用即破坏纯原生约束，须另行决策（**默认不启用**） | 架构 §9 | 决策记录 + 偏差登记 |
| BP-13 | 算法实现来源说明（无功能排除） | 冻结基线 Rust 热路径 | 原样复用内核，历史 JS 说明不作当前权威 | M2 §0.2 | 内核测试和编排行为对拍 |

### 6.2 偏差登记（DV）

分类按可观察影响：**默认差异**是已批准、随功能交付生效的例外；**可选扩展**默认关闭；**内部优化**须证明范围内行为等价。默认差异不再称为“行为完全不变”。本表是唯一 DV 定义源。

| 编号 | 原版行为 → Omnia 行为 | 分类 / 启用 | 回退或边界 | 验收 |
| --- | --- | --- | --- | --- |
| DV-1 | direct 同主进程 → Node 侧车隔离 | 默认差异 | 不提供同主进程模式；接口/数据不变 | 崩溃/死循环后主进程存活，正常调用对拍 |
| DV-2 | 同插件无限并发 → 可设 maxConcurrency | 可选扩展 / manifest 声明 | 未声明维持原并发 | 限流与默认并发用例 |
| DV-3 | 不统一回收续跑进程 → Governor 回收 | 默认差异 | shutdown 生命周期变化须披露 | 退出无孤儿、在途回执明确 |
| DV-4 | 改 direct 代码需重启整服 → 侧车热更 | 默认差异 | 在途排空/切换由 US-201 冻结 | 新旧代码切换和错误恢复 |
| DV-5 | sidecar 全权限 → WASM 按能力拒绝 | 可选扩展 / runtime=wasm | 回退 sidecar，权限随之变化 | 越权拒绝与功能用例 |
| DV-6 | 原版节点未声明取消 → Omnia 声明并处理 | 默认差异 | 保留协商；不向旧节点强发取消 | 混部与取消回执 |
| DV-7 | 注册携带插件 env → 可剔除敏感键 | 可选扩展 / 节点配置 | 默认基线报文 | 注册对拍与脱敏 |
| DV-8 | internal_request_file 无配额 → 可限额 | 可选扩展 / 配额配置 | 默认基线行为 | 超限与正常读取 |
| DV-9 | feature 开关需重启 → 即时启停 | 默认差异 | 数据/注册身份保留 | 即时生效、资源释放、重开状态 |
| DV-10 | Electron 子窗口进程隔离 → 原生边界防护 | 默认差异 / 隔离边界变化 | catch_unwind 不保证 OOM/进程终止隔离；重型进程方案见专项 | panic 与进程终止/恢复分别说明 |
| DV-11 | 任意 HTML/JS 挂件 → DSL 与受限脚本 | 默认差异 / M5 交付 | 禁任意宿主代码，允许计算子集；BP-06 | 能力覆盖、越权拒绝、降级可见 |
| DV-12 | 外部 embedding/rerank → 可选本地模型 | 可选扩展 / 用户启用 | 回退前核对模型/维度和重建，不盲用旧索引 | 外部对拍，本地精度/时延报告 |
| DV-13 | 存量插件桥接 → 可选 WASM 生态 | 可选扩展 / 独立立项 | sidecar 长期保留；权限关联 DV-5 | 分发/启动实测与权限用例 |
| DV-14 | 文本工具通道 → 按模型能力使用内部原生通道 | 内部优化 / M3 后独立立项 | 默认文本；满足能力与等价验收后自动路由，失败回退文本 | 调用/结果/错误对拍，外部契约不变 |

默认差异必须在对应发布中披露，不因称为“增强”而自动等价。协议或数据格式变更不能通过本表自动获准。IN-4 沿用原定能力路由，不增加新的用户开关。


### 6.3 创新登记（IN）

| 编号 | 方向 | 层 / 默认 | 可度量收益或验收口径 | 回退路径 | 落地 |
| --- | --- | --- | --- | --- | --- |
| IN-1 | 渲染引擎重设计 | 实现层 / 随 M1 起 | 行为目标：迟到拒写、滚动锚定、离屏零 CPU、CLS 0（M4 §2.0 行为用例） | 回退到按六机制实现同一行为目标 | M1 v1 起，M4 定案（M4 PRD §2.0） |
| IN-2 | 记忆本地自治 | 实现层（减少跨语言编排开销，收益待测）+ 扩展层（本地模型 opt-in，默认关闭） | 目标为本地模型就绪后相应记忆计算离线运行、减少外部 API 调用；对拍验收用固定外部模型，本地模型出精度/时延报告（M2 §1 P1） | 关闭本地模型并校验索引/模型兼容后回退外部 API | M2（M2 PRD §1 P1） |
| IN-3 | 插件能力沙箱 | 扩展层 / 默认关闭 | 测量冷启动、分发体积及平台覆盖；越权能力默认拒绝（M3 §1） | sidecar 兼容层长期保留 | M3 完成后独立立项（M3 PRD §1 创新条目） |
| IN-4 | 工具协议双轨 | 实现层 / 默认文本标记通道，按模型能力启用原生通道 | 双通道对同一工具集行为 diff 为零 + 契约 fixture 全过（M3 §1） | 文本标记兼容通道 | M3 完成后独立立项（M3 PRD §1 创新条目） |

> 收益与等价验证分开记录：本表的行为用例证明兼容，收益实测按使用与维护 §5 记录。不存在产品已实现或收益已测得的暗示。

---

## 7. 里程碑与优先级对照

| 阶段 | 阶段交付范围 | 出口与承接 |
| --- | --- | --- |
| M0 | 契约、骨架、fixture 脚手架、前端验证分支 | US-001～007；定稿不代表录制通过 |
| M1 | 聊天/工具、static/synchronous、中断/辅助端点、最小审核/管理、AppData | 全部 M1 P0 与四组合用例；认证遵循 C-11 |
| M2 | 记忆 P0、direct 侧车与记忆原生路径 | 不称 §3.3 全量；欠账转 SC-12/SC-16 |
| M3 | 六类宿主、分布式、审核、调度与管理 API | Top-20 是阶段样本；论坛 API 最迟在 M4 US-324 前完成 |
| M4 | 渲染、文坊/工程核心与首批子程序 | AppRegistry/扩展试点有独立 US；其它程序按 SC 补齐 |
| M5 核心交付 | P0 深水区与分发 | 可交付核心系统；须公示未完成的 P1/P2/SC |
| 全项目终验 | 所有基线能力、SC、批准例外与数据兼容 | US-427 完成后执行 US-426；不新增里程碑 |

M4 转出的音乐/Loom/桌面由 M5 P0 承接；白板/语音/骰子/塔罗/桌宠由 M5 P1 承接；游戏/视听工坊/JEV 转 SC-11/SC-12。其它 P1 延期进入 SC-16，需记录负责模块和完成用例。

---

## 8. 验收与维护

1. 最终验收必须满足：冻结树到能力清单完整、各能力有实现/验证状态、全部 SC 闭合、协议和行为用例通过、数据往返通过、BP/DV 披露。通过自选 US 或 Top-20 不足以结案。
2. 插件覆盖全部 96 个目录；禁用插件验证禁用态和启用前提，不自动启用。无第三方凭据可用固定响应测接入协议，但报告须标真实外部服务未测，不得写“全部实测通过”。
3. “300+ 云端插件”是生态背景，不属于本地冻结清单。新增来源按基线变更或独立兼容清单处理。
4. SC 分解、延期和排除须更新原条目，不保留矛盾状态；仅同步实际受影响的 PRD/契约。
5. 资产盘点读 `git ls-tree`，行为读 `git show`，不以当前目录或未跟踪文件替代冻结树。
6. 维护与收益格式见[使用与维护](Omnia-使用与维护.md)；结构检查运行 `node scripts/check-docs.mjs`。

## 9. 修订记录

- v1.4（2026-11-12）：同步架构 v2.6：§3.1 工具调用记录库去向改为 `omnia-plugin`；SC-14 纳入停机生命周期；SC-17 写明节点端实现的依赖约束。没有新增 BP/DV，范围规则不变。
- v1.3（2026-11-12）：新增 SC-17（桌面端内嵌分布式节点及 38 个节点侧插件目录），§3.4、§4.2 对应行同步；按冻结树更正清点数字：`modules/` 46 项、`Plugin.js` 2763 行、`VCPDistributedServer.js` 955 行。范围规则与其余条目不变。
- v1.2（2026-11-12）：BP-07 登记 M0 F8 实测结论（锁定 GPUI 栈无原生视频/音频能力），视频降级或外部引擎决策明确由 M5 承接；范围条目不变。
- v1.1（2026-11-12）：明确最终范围和 SC 责任；拆开 Canvas/文坊白板，修正 BP 引用；区分默认差异和内部优化、核心交付和最终验收。技术选型不变。

---


内容由 AI 生成
