# Omnia · 架构设计 v2.5

- 版本 / 日期：v2.5 / 2026-11-12（补运行拓扑、启动与停机、取消传播、M3 依赖方向、持久化布局、日志与证据层级；技术决策不变）
- 状态：**已批准**（方案 A 三层文档法；v2.1 创新定位经用户确认；v2.2 为文档治理修订）。v2.5 新增内容中标注“待用户确认”的【设计】条目尚未获批，确认前不构成实现准入（`README.md` §5.2）；标注【已验证】的条目只陈述冻结基线事实
- 项目定位：**复刻为基，创新为显式目标**。Omnia 是 VCP 生态的 Rust 全栈原生复刻，同时在保持兼容的内部实现与明确登记的扩展中验证改进收益（见 §1.3）。复刻对象：lioensky/VCPToolBox（后端）+ lioensky/VCPChat（前端）
- 文档体系：README（入口/治理）→ 复刻范围与对应矩阵（范围）→ 本文档（决策层）→ 专项/协议契约（设计与精确规则）→ 各阶段 PRD（执行层）
- 权威仲裁：见 `README.md` §4；断点/偏差/创新统一编号见 `docs/Omnia-复刻范围与对应矩阵.md` §6
- 当前仓库状态：**M0 实施中**——workspace 骨架、CI 配置与部分契约 fixture 已建立，尚无已验收的产品能力，以 `README.md` §2 为准；本文的签名、依赖版本与 §13 中未标明已存在的结构均为目标规格

## 1. 目标与边界

### 1.1 什么叫 1:1

纯原生约束下，1:1 定义为**行为级 / 协议级 / 数据级**：

- 协议级：VCP 文本标记工具协议、六类插件协议、HTTP/SSE/WebSocket 接口、config.env 与 plugin-manifest.json 契约对齐（包括未知字段保留和基线宽校验）
- 行为级：工具循环、记忆召回、上下文预注入、多 Agent 协作、自主唤醒等可观测行为与原版一致（用交叉验证矩阵度量）
- 数据级：日记、记忆库、话题、Agent 配置等数据格式兼容，可双向迁移

**非目标**：像素级 UI 克隆；直接执行原版 Web 资产（HTML/JS/Three.js/Pyodide）。

### 1.2 许可证约束（硬性）

- VCP 系仓库为 CC BY-NC-SA 4.0：本项目作为演绎作品须**署名、非商业、相同方式共享**。代码翻译（Node→Rust）同样属于演绎
- **Folia AGPL-3.0 冲突**（M5 冻结）：VMusic 部分舞台组件含 Folia 派生代码，与 CC BY-NC-SA 不兼容，必须清洁室重实现，禁止打开/参考/复制相关源文件（详见 M5 PRD §3）
- GPUI / gpui-kit 生态为宽松开源许可（动手前以仓库 LICENSE 原文为准）
- Zed 应用本体为 copyleft 许可：只参考架构思路，**不复制其应用代码**
- 默认用途：个人自用。商业化不在本设计范围内，不能仅凭重写推定取得商业许可

### 1.3 创新与偏差治理（v2.1 新增，用户已确认定位）

目标是复刻基线能力并改善内部结构。兼容目标与允许差异必须同时成立，不能以“实现层”“安全增强”代替行为判断。

| 分类 | 规则 | 验证 |
| --- | --- | --- |
| 协议/数据不变量 | 已纳入范围的字段、标记、存储格式与外部接口保持契约；变更须另作兼容决策 | fixture 与双向数据往返 |
| 等价内部优化 | 可以替换机制，但必须保持范围内可观测语义 | 同输入行为对拍 + 独立收益报告 |
| 已批准默认差异 | 原生约束/生命周期/隔离等可见差异，随功能交付开启；不宣称完全等价 | 矩阵 BP/DV 逐项披露、正常与异常用例 |
| 可选扩展 | 默认关闭，启用条件明确，保留兼容路径 | 独立验收、权限/数据影响与回退报告 |

唯一分类与启用规则见范围矩阵 §6：DV-1/3/4/6/9/10/11 是默认差异；DV-2/5/7/8/12/13 是可选扩展；IN-1/IN-4 是内部优化。IN-2 分为编排优化和本地模型扩展。默认差异仍须保持其未豁免的协议/数据契约。

IN-4 沿用已批准的能力路由：默认文本通道；原生通道需能力支持且通过等价验收，失败回退文本。M1 只实现文本通道，不声称已经存在能力探测方法。

复刻主线不依赖可选创新完成；但原版范围内的功能不得伪装成“可选创新”来免除终验。收益度量见使用与维护 §5，所有性能收益目前均为待验证目标。

**四个创新方向（立项索引）**：

| 编号 | 方向 | 原版痛点（源码依据） | Omnia 方案 | 层 | 落地 |
| --- | --- | --- | --- | --- | --- |
| IN-1 | 渲染引擎重设计 | V4 六大机制（三维校验/墓碑冻结/PreText 等）是 DOM 布局渲染分离与异步竞态逼出的复杂度 | GPUI 测量渲染同源：保留行为目标（迟到拒写/滚动锚定/离屏零 CPU），机制按原生模型重新设计，不复刻六套机制 | 实现层 | M1 v1 起，M4 定案（M4 PRD §2.0） |
| IN-2 | 记忆本地自治 | EmbeddingUtils/Rerank 依赖外部 API，相应调用依赖网络、外部费用与时延 | 本地 embedding/rerank 模型（candle/ort）opt-in；维度锁定与重建机制不变；减少跨语言编排及复制开销（收益待测） | 实现层+扩展层 | M2（M2 PRD §1 P1） |
| IN-3 | 插件能力沙箱 | 插件 shell=true 全权限子进程（契约 C-02）；挂件间无隔离（M5 §7.5） | WASM 运行时（wasmtime）+ manifest 能力声明（文件/网络/模型按需授权）；sidecar 保留为兼容层，存量插件渐进迁移 | 扩展层 | M3 后独立立项（M3 PRD §1 创新条目；编号见范围矩阵 §6.3） |
| IN-4 | 工具协议双轨 | 文本标记协议为无原生 function calling 的模型设计，容错/转义/剥离规则复杂 | 按模型能力自动路由：原生 function calling 内部通道 + 文本标记兼容通道；对外 SSE/可见行为不变 | 实现层 | M3 后独立立项（M3 PRD §1 创新条目；编号见范围矩阵 §6.3） |

## 2. 命名定案

| 对象 | 名称 | 说明 |
| --- | --- | --- |
| 项目名 | **Omnia** | 对外名称、文档标题、二进制产品名 |
| 仓库/workspace 根 | `omnia`（D:\code\github\omnia） | Cargo workspace 根即项目根 |
| 后端二进制 | `omnia-server` | |
| 前端二进制 | `omnia-app` | |
| crate 前缀 | `omnia-*` | 全部自研 crate |
| vendored 上游 crate | 保留原名 | `vexus-lite`、`vcp-tdb-index`、`rust_audio_engine`、`rust_assistant_engine` 原样纳入并注明基线 commit，不改名（便于上游 diff 与许可证归属） |
| 协议/数据标识 | 保留 VCP 字样 | `{{VCPXxx}}` 占位符、`VCP_Key`、`[VCP调用结果信息汇总:` 等协议标记是 1:1 契约的一部分，**禁止更名** |

### crate 映射表（旧设计 → 定案）

| 旧名 | 新名 | 职责 | 阶段 |
| --- | --- | --- | --- |
| vcp-protocol | omnia-protocol | 工具协议解析/序列化/思考块剥离 | M0 |
| vcp-config | omnia-config | config.env 与插件 config.env 加载（C-06） | M0 |
| vcp-server | omnia-server | HTTP/SSE 接口、中间件、认证 | M1 |
| vcp-agent | omnia-agent | 工具循环、提示词管线、记录存储 | M1 |
| vcp-model | omnia-model | 上游适配、重定向、重试 | M1 |
| vcp-plugin | omnia-plugin | manifest、六类插件宿主、stdio 执行 | M1 起 |
| vcp-memory | omnia-memory | 内核句柄、双通道召回、排序契约 | M2 |
| vcp-knowledge | omnia-knowledge | 索引管道、分块、Embedding、内核存储适配 | M2 |
| vcp-ws | omnia-ws | WebSocket 六类客户端 | M3 |
| vcp-dist | omnia-dist | 分布式注册/执行/节点 | M3 |
| vcp-filefetch | omnia-filefetch | 跨节点透明文件访问 | M3 |
| vcp-approval | omnia-approval | 人工审核全量 | M3（M1 最小子集在 omnia-plugin） |
| vcp-scheduler | omnia-scheduler | 定时任务 | M3 |
| vcp-app | omnia-app | GPUI 前端应用 | M0 骨架起 |
| vcp-net | 并入 omnia-dist | 旧设计独立 crate，实际与分布式一体 | — |
| vcp-multi / vcp-auto | **不设独立 crate** | 多 Agent = AgentMessage/AgentAssistant 等插件 + WS VCPInfo 通道 + OneRing（omnia-agent 内阶段钩子）；自主性 = VCPSleep/AgentDream 插件 + omnia-scheduler + FlowLock 协议。原版即如此实现，独立 crate 是过度设计 | — |
| rivermemo | vexus-lite（vendored） | 记忆内核，原名保留 | M2 |
| audio-engine | rust_audio_engine（vendored） | 音频引擎，原名保留 | M5 |

### 2.1 职责与所有权约定

- **依赖方向**：箭头表示编译依赖；装配发生在 omnia-server，运行时回调经提供方接口传入，不倒置编译依赖。
- **公共接口归属**：ModelAdapter 属 omnia-model，PluginHost/ToolOutcome 属 omnia-plugin；omnia-agent 是消费方。协议共享值在 omnia-protocol；底层模块不依赖 omnia-agent。
- **存储所有权**：知识事实/索引由 vendored 内核拥有；omnia-memory 暴露句柄与操作接口；omnia-knowledge 负责文件监听、分块、Embedding 与写入编排，不自建一份平行事实库。M2 store.rs 是适配入口。
- **进程边界**：direct 的“进程内加载”专指 Node 侧车内部 require，不是在 Rust 主进程中加载 JS。IPC/shim 由 omnia-plugin 拥有，业务能力由各提供方实现。
- **前端边界**：omnia-app 经 HTTP/SSE/WS 访问后端，不依赖后端业务 crate；本地音频/桌面能力在前端。FrontendHost 与后端 PluginHost 是不同职责，不复用含混名称。
- **跨阶段规则**：后续 PRD 追加能力，不重定义已有公共接口；原版能力到模块/阶段的映射只在范围矩阵维护。

```text
omnia-server（装配、HTTP/SSE 适配）
  → omnia-agent（管线、工具循环、handoff、注入）
      → omnia-model / omnia-plugin / omnia-knowledge / omnia-memory
  → omnia-ws / omnia-dist / omnia-filefetch / omnia-approval / omnia-scheduler
omnia-dist / omnia-approval / omnia-scheduler → omnia-plugin + omnia-ws（M3，待用户确认，见 §2.2）
omnia-filefetch → omnia-dist（M3，待用户确认，见 §2.2）
omnia-knowledge → omnia-memory → vexus-lite
上述业务模块 → omnia-protocol / omnia-config
omnia-app → HTTP/SSE/WS（运行时通信，不是编译依赖）
```

| 状态 / 接口 | 所有者 | 消费与责任 |
| --- | --- | --- |
| 工具注册、运行时、IPC/shim | omnia-plugin | agent 调用；侧车故障/重启/资源回收由 plugin 负责 |
| 工具循环、双通道注入、handoff | omnia-agent | server 适配 HTTP/SSE，不能另建循环状态机 |
| 模型路由、重试、模型能力 | omnia-model | agent 消费；能力探测在 IN-4 立项时细化 |
| 知识事实、索引、内核状态 | vexus-lite，经 omnia-memory 句柄 | knowledge 编排写入，不能直接绕过句柄持有第二份状态 |
| 前端会话状态 / 子程序注册 | ChatKernel / AppRegistry | 窗口和面板消费投影；AppRegistry 的任务见 M4 US-329/330 |

## 3. 基线定案

| 仓库 | 冻结 commit | 本地路径 |
| --- | --- | --- |
| VCPToolBox | `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` | D:\code\github\VCPToolBox |
| VCPChat | `c3e4855efa2b24c0578d76e17fd6c5f21857a539` | D:\code\github\VCPChat |

- 旧冻结 f23275aa → a8560b0 的核心源码 diff 仅 jevToolCallExp.js（P2），只说明这些文件未变化，不证明旧文档描述正确；本次勘误和引用复核仍适用
- 上游跟进流程、行号口径见 docs/基线记录.md
- M0M1 全部关键契约已从基线源码冻结，见 docs/Omnia-M0M1-协议契约.md（C-01～C-12）

## 4. 技术栈定案

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 后端 | Rust（tokio + axum） | 完整重写 VCPToolBox，不引入 DeepSeek Harness 运行时 |
| 记忆内核 | vexus-lite 原生合并 | Rust 内核 vendoring 为 workspace crate（rlib），去 N-API |
| 音频引擎 | rust_audio_engine 原生合并 | vendoring，运行在前端侧（本地设备播放） |
| 前端 | gpui-kit（GPUI）纯原生 | 无 WebView；精确锁定匹配的 GPUI 快照版本 |
| 架构参考 | DeepSeek Harness | 仅借鉴"一切皆插件"思想，不引入代码与运行时 |
| 存量插件 | Node/Python 桥接宿主 | sidecar 挂载冻结的 96 个插件目录；300+ 为未冻结云端生态背景，高频者分批 Rust 化 |

收益假设：记忆和音频内核的直接集成减少对应桥接与序列化开销；存量插件的 Node/Python 兼容层仍保留。收益须按同环境实测，不能由同语言直接推定行为保真。

## 5. 总体架构

保持原版客户端-服务器分离（服务器可远程部署，分布式能力 1:1 的前提）：

```
模型 API（OpenAI 兼容 / 多厂商路由）
        ↑
┌─────────────────────────────────────────────┐
│ omnia 后端整体（Rust 单进程 + 插件桥接进程池） │
│  omnia-server：HTTP/SSE 适配、装配、中间件/认证       │
│  omnia-agent：工具循环、提示词管线；调用 model       │
│  omnia-memory + vexus-lite：日记/召回/引力注入   │
│  omnia-plugin：六类插件、manifest、direct 宿主   │
│  omnia-dist / ws / filefetch：分布式、连接与文件         │
│  omnia-approval / omnia-scheduler：审核/调度     │
└─────────────────────────────────────────────┘
        ↑ VCP 协议契约（HTTP/SSE/WS，1:1）
┌─────────────────────────────────────────────┐
│ omnia-app 前端（gpui-kit 原生应用）              │
│  聊天内核 + 自研流式渲染引擎                      │
│  子程序群（按范围矩阵，分批移植）                        │
│  rust_audio_engine crate + 桌面集成             │
└─────────────────────────────────────────────┘
```

**关键性质**：后端协议 1:1 ⇒ 原版 VCPChat 可直连 omnia-server；omnia-app 也可直连原版 VCPToolBox。过渡期可用"Rust 后端 + 原版前端"组合，原生前端逐步生长。

## 6. 数据流（三条主时序）

### 6.1 聊天请求管线（契约 C-10，17 步）

```
Bearer 认证 → specialModelRouter → 重放缓存检查 → activeRequests 注册
→ contextTokenLimit 修剪 → 模型重定向 → 占位符扫描 → VCPTavern 预处理
→ 语义路由定模型 → 有序预处理管线（占位符替换嵌于其内，仅 system）
→ TransBase64 还原 → Detector → RoleDivider → name 清理 → OneRing 冻结
→ 批次上游投影 → fetchWithRetry → 工具循环 → 后处理（OneRing/缓存/门控释放）
```

M1 裁剪映射见契约 C-10：骨架位置 1:1 保留，未实现阶段为空链占位。

### 6.2 工具循环（单轮，契约 C-01/C-04/C-05）

```
上游流/响应 → stripReasoningBlocks → 工具块解析（含转义/容错）
→ separate()：normal / archery 两组
→ normal：join_all 并发执行 → 双通道分发：
    可见通道：域块+摘要 → 批次 chunk → 分隔符 chunk（ShowVCP 门控，摘要恒发）
    AI 通道：assistant 消息 + <!-- VCP_TOOL_PAYLOAD --> user 消息
→ archery：成功仅 WS 广播；失败/留言生成错误块
→ handoffGate 检查（armed 则等待 ≤2s，fail-open）
→ 未达 MaxVCPLoop 且有 normal 结果 → 下一轮上游调用
→ 无工具调用 → stop chunk + [DONE]；达上限 → finish_reason:length
```

### 6.3 插件 stdio 执行（契约 C-02）

```
toolArgs（裸参数，含 maid 镜像）→ JSON.stringify（空则不写）
→ spawn（command 空格拆分，cwd=插件目录，shell=true）
   env = process.env → pluginConfig（schema 键）→ additionalEnv
→ stdin 写入 + end（无尾随换行）
→ 同步：等 exit → JSON.parse(stdout.trim())，JSON 状态优先于退出码
   异步（M3）：首个合法 JSON 即 resolve，进程续跑，回调走 HTTP
→ stderr 附 pluginStderr → tool_call_records 落库 → recordId 回附
→ 超时：杀进程树（Windows taskkill /T /F，Unix 进程组信号）
```

## 7. 核心类型与接口（签名级）

架构拥有接口归属，签名只在对应详规维护，避免摘要与完整字段不一致。

| 接口 | 定义源 |
| --- | --- |
| ToolCall、ParseOptions、解析函数 | M0M1 PRD §6.2；语义 C-12 |
| ModelAdapter、UpstreamRequest | M0M1 PRD §6.2；IN-4 只保留演进边界 |
| PluginHost、ExecContext、ToolOutcome | M0M1 PRD §6.2 |
| 注册表、执行桥、运行时与治理接口 | 插件系统设计 §3.2 |
| MemoRuntime 句柄 | M2 PRD §3.4，US-101 API 映射 |
| FrontendHost、AppRegistry、前端扩展点 | 插件系统设计 §3.8；M4 US-329/330 |

### 错误模型

- crate 内：`thiserror` 定义领域错误枚举（ModelError/PluginError/ProtocolError/…）
- 业务跨 crate 接口继续返回提供方的领域错误（与 trait 签名一致）；启动/装配和命令边界可用 `anyhow::Result` 汇总上下文
- HTTP 层：按每个路由契约保留响应状态、字段与精确文本（含 C-11 认证错误），不能用统一包装破坏原响应形状
- SSE 错误不中断流语义：错误文本作为 delta.content + finish_reason:stop + [DONE]
- 内核 panic 防护（M2）：句柄调用边界 catch_unwind + 降级为无记忆回答

### 并发模型

- tokio 多线程运行时；每请求一个 task，工具批内 join_all（对齐 Promise.all）
- 中断：每请求 CancellationToken（tokio_util），级联取消上游 fetch 与工具执行
- SQLite：WAL；写路径单连接串行化（Mutex<Connection>），读路径连接池
- 插件进程：每次调用 spawn（M1），预热进程池 M3 P1
- 背压：SSE 发送用有界 channel，客户端断开触发取消链

## 8. 存储定案

| 数据 | 方案 | 依据 |
| --- | --- | --- |
| 工具调用记录 | SQLite WAL，tool_call_records 表（DDL 见 M0M1 PRD §5） | 原版 toolCallRecordStore.js 1:1 |
| 知识库事实层 | vendored 内核的 SQLite/WAL；Schema 由 US-101 核定 | 经 omnia-memory 句柄访问；M2 候选 DDL 不能视为已核验事实 |
| 向量索引 | USearch：index_global_tags.usearch（容量 50000）+ index_diary_{md5}.usearch | 原版布局 1:1 |
| 配置 | config.env + 插件 config.env（dotenv 补丁语义，契约 C-06） | 原版 1:1 |
| 前端数据 | AppData 兼容 JSON：Agents/<id>/config.json + UserData/<id>/topics/<tid>/history.json（契约 C-08） | 原版 VCPChat 1:1，双向挂载 |
| 异步回调结果 | 文件式 JSON `<pluginName>-<taskId>.json`（M3） | 原版 asyncResultStore.js |

**存储技术已定案**；Schema、迁移及并发细节按各契约冻结并通过往返验证，不能由技术相同推定数据兼容。

## 9. 前端架构（GPUI）

**框架选型已深化**（详见 docs/Omnia-前端框架选型.md，2026-11-12 调研批准）：gpui-kit 是 GPUI 之上的事实标准封装层（0.9.1，Apache-2.0，Longbridge Pro 生产验证），分层为 gpui-base（无样式行为原语）/ gpui-component（带样式组件系统）/ gpui-shell（JS 扩展运行时）。

- **分层用法**：gpui-component 为主（聊天窗口/子程序/设置页快速搭建）；gpui-base 兜底（流式渲染引擎等需完全掌控视觉处自建，复用 focus/虚拟化/无障碍/IME）
- gpui-kit 精确锁 `=0.9.1`（2026-11-12 一手核验；GPUI 快照 gpui-pre =0.3.12 由其传递锁定，不手动指定）；所有调用收敛 `ui_adapter/` 隔离 API 漂移；M0 评估 gpui-fast 0.1.14 后端
- 直接复用：VirtualList 虚拟化、Bubble/Message 聊天原语、Markdown+HTML 渲染、Rope 编辑器（Tree-sitter+LSP，20 万行）、Dock/Tiles、图表、主题、AccessKit 无障碍、无头 UI 测试、CJK/RTL/IME
- 自研范围收窄（VCP 特有，对齐 IN-1）：流式增量 Markdown 解析、竞态三元组防护、工具卡片/思考链折叠、离屏冻结、滚动锚定；Scriptorium 共笔文坊、VMusic 舞台、子程序群
- **gpui-shell 分阶段采纳**：M0 Windows 实测（gpui-shell 自身 milestone M0；quickjs-jit Windows bug 上游已修复，gpui-kit 0.9.1 锁定 =0.14.1，实测为回归确认）→ M4 脚本面板插件试点 → M5 Widget DSL/可编程岛运行时优先 gpui-shell（替代自研 deno_core）；不可用则 deno_core 备选，不阻塞主线
- M1 前端核心结构：ChatKernel（单一真源状态机）+ SSE 消费 task + 竞态三元组（会话 ID/代次 Revision/消息身份），详见 M0M1 PRD §7
- 数据层：AppData 兼容读写（契约 C-08），原子写（tmp+rename），Windows 目录名小写规则
- 子程序插件化：AppRegistry 单一真源取代原版五处硬编码目录，app-manifest.json 统一清单，**四档形态（window/embedded/kernel-ext/script，见插件系统设计 §3.8.3）**，生命周期 register/activate/deactivate/dispose；第三方扩展可走 gpui-shell 脚本面板（能力沙箱与 Omnia 插件设计同构）；详见 docs/Omnia-插件系统设计.md §3.8
- **上游风险对冲**：GPUI 上游发布停滞（315 天未发 crate）+ Discord 私有分支碎片化 → gpui-kit 固定 gpui-pre-* 快照 + gpui-fast 可选后端 + gpui-ce/gpui-unofficial 社区分支兜底 + ui_adapter 隔离

### 三个 Web 依赖断点（已确认换形态）

| 原功能 | 断点原因 | 适配方案 |
| --- | --- | --- |
| Loom 内置浏览器 + 网页自动化 | 纯原生无浏览器内核 | 外部浏览器 + CDP 桥；应用内原生展示快照与 grounded 文本；人工接管切外部窗口；14 命令语义保留（M5 已冻结） |
| AI 生成 HTML 小部件 / 可编程岛 | 无法执行任意 HTML/JS/Pyodide | 原生部件 DSL + 嵌入式 JS 计算子集（**优先 gpui-shell**，M0 实测；deno_core 备选）；存量 HTML 资产不能直接运行，为最大兼容性断点 |
| 3D 音乐舞台 / 视频渲染 | GPUI 为 2D GPU | 2D 舞台重制（6 模式 P0）；3D 自研或降级 2.5D（P1）；视频 M0 实测后定降级 |

备选后门：gpui-component 实验性 WebView（wry）。启用即破坏纯原生约束，须用户另行决策。

> 本节三个 Web 依赖断点与全项目全部兼容性断点的统一编号、验收口径见 `docs/Omnia-复刻范围与对应矩阵.md` §6.1（BP-01～BP-13）；前端形态已按插件系统设计 §3.8.3 统一为四档（含 `script`），本文不再使用「三档形态」这一旧表述。

## 10. 插件兼容策略

1. plugin-manifest.json 与六类插件协议 1:1，原版插件目录直接挂载
2. 桥接宿主 = Node/Python sidecar 进程池（Rust 管理生命周期/IPC/超时取消）；嵌入式运行时（deno_core/pyo3）为后续优化项
3. direct/hybridservice Node 侧车宿主 **M2 实现**（记忆双通道依赖，已从 M3 提前）
4. 高频插件分批 Rust 原生化，与桥接版做行为 diff
5. 分布式协议照搬，远端节点可继续跑原版 VCPDistributedServer（双向混部验证；原节点未声明取消时保留其能力边界）
6. 演进方向（IN-3，扩展层 opt-in）：WASM 能力沙箱运行时，manifest 增加能力声明；sidecar 兼容层长期保留，存量插件渐进迁移，不强制

**完整插件系统设计见 docs/Omnia-插件系统设计.md**（统一插件模型：后端四层引擎 + 前端 AppRegistry 四档形态；原版五缺陷修复 D1-D5；偏差定义统一引用范围矩阵 DV-1～DV-14；前端第三方走 Loom 沙箱 + DSL，不开放任意原生代码）。**偏差与创新的统一编号、层归属、默认开关以 `docs/Omnia-复刻范围与对应矩阵.md` §6.2、§6.3 为准（DV-11～DV-14 在该表分配）**。

## 11. 验证矩阵

| 组合 | 用途 |
| --- | --- |
| 原版后端 × 原版前端 | 基线录制：协议报文、SSE 序列、记忆召回样本 |
| omnia-server × 原版 VCPChat | 后端协议/行为回归（原版前端当测试夹具） |
| 原版后端 × omnia-app | 前端行为回归（原版后端当测试夹具） |
| omnia-server × omnia-app | 最终集成验证 |

- 契约测试：fixture 库按契约文档 §11 规范建立，CI 持续比对；录制为验证手段而非冻结手段（契约已从源码冻结）
- 记忆行为 diff：固定合成语料 + 固定查询集，比对召回顺序与注入内容（M2）
- 前端：gpui-kit 无头 UI 测试 + AppData 双向往返验证
- 每阶段通用检查与交付审查见[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)；具体契约、数据和平台门禁仍按阶段 PRD 验收。

## 12. 分阶段路线

| 阶段 | 范围 | 验收标准 | 量级 |
| --- | --- | --- | --- |
| M0 契约冻结 + 骨架 | 契约文档（已完成）；workspace 骨架；gpui-kit 锁版本 + ui_adapter；交叉验证脚手架；视频能力实测 | 契约测试对原版后端跑通；GPUI hello-chat 窗口 | M |
| M1 核心闭环 | 工具循环 + 聊天 API + 模型适配 + static/synchronous 插件；GPUI 主聊天窗口（渲染引擎 v1） | 原版 VCPChat ↔ omnia-server 聊天+工具；omnia-app ↔ 原版后端聊天 | XL |
| M2 记忆系统 | 日记、vexus-lite 集成、引力预注入、direct 宿主、双通道 | 固定样本集记忆行为 diff 达标 | XL |
| M3 插件全量 + 分布式 | 四类插件补全、WS、星型网络、审核全量、调度器、管理 API | Top-20 插件行为一致；原版节点双向混部 | L |
| M4 子程序群 + 文坊 + IDE | 渲染引擎 V4 行为版；Scriptorium；ProjectForge；AppRegistry/FrontendHost；轻量子程序第一批 | P0 文件往返与协议对拍零差异，P1/SC 单列承接 | XL |
| M5 深水区 + 分发 | VMusic、Loom、自主生活、VCPDesktop、打包更新与合规 | P0 核心交付；全部 SC/P1/P2 补齐后再由 US-426 终验 | XL |

## 13. 仓库结构（cargo workspace）

```
omnia/                            # workspace 根 = 项目根
├── Cargo.toml
├── crates/
│   ├── omnia-protocol/           # 协议类型与解析（M0）
│   ├── omnia-config/             # 配置加载（M0）
│   ├── omnia-server/             # axum API / SSE / 中间件（M1）
│   ├── omnia-agent/              # 循环 / 提示词管线 / 记录（M1）
│   ├── omnia-model/              # 模型适配与路由（M1）
│   ├── omnia-plugin/             # 插件引擎 + 桥接宿主（M1 起）
│   ├── omnia-knowledge/          # 索引管道（M2）
│   ├── omnia-memory/             # 内核句柄 + 双通道（M2）
│   ├── omnia-ws/                 # WebSocket（M3）
│   ├── omnia-dist/               # 分布式（M3）
│   ├── omnia-filefetch/          # 跨节点文件（M3）
│   ├── omnia-approval/           # 审核全量（M3）
│   ├── omnia-scheduler/          # 调度（M3）
│   ├── omnia-app/                # GPUI 前端（M0 骨架起）
│   ├── vexus-lite/               # vendored 记忆内核（M2，原名）
│   │   └── crates/vcp-tdb-index/
│   ├── rust_audio_engine/        # vendored 音频引擎（M5，原名）
│   └── rust_assistant_engine/    # vendored 助手/麦克风引擎（M5，原名；与 §2 命名表一致）
├── plugins-native/               # Rust 原生化插件
├── contract/                     # 契约测试 + fixture 库（规范见契约文档 §11，含 c10-pipeline/）
├── README.md                     # 文档入口与治理规则
├── docs/                         # 本文档体系（含复刻范围与对应矩阵）
└── brainstorming/plans/          # 设计存档（规则见 README §7）
```

## 14. 风险与对策

| 风险 | 对策 |
| --- | --- |
| GPUI 快照 API 漂移 / 上游发布停滞 | 精确锁版本；ui_adapter 隔离；gpui-kit 固定 gpui-pre-* 快照 + gpui-fast 后端 + 社区分支兜底；升级窗口集中迁移 |
| gpui-shell M0 实验（Windows bug 上游已修复） | M0 回归确认决策门（quickjs-jit =0.14.1）；不通过回退 deno_core/原生 DSL；不阻塞复刻主线 DoD |
| GPUI 多媒体/无障碍缺口 | M0 实测；缺口自研或降级预案 |
| 视频渲染 Windows/Linux 不完善 | M0 实测；外部播放器或帧预览降级 |
| Rust 开发节奏慢 | 分阶段交付，M1 闭环优先；桥接宿主避免冻结插件集同步重写 |
| 上游持续迭代 | 基线冻结 + changelog diff 流程（基线记录.md） |
| 许可证传染 | 非商业 + 署名 + 相同方式共享；Folia 清洁室审计门禁；Zed 零复制 |
| 单人断档 | 职责文档 + 契约/fixture + 维护说明 + 决策记录提供接续依据；缺失项仍须显式登记 |
| 契约与实现漂移 | 契约文档为唯一权威；fixture CI 门禁；实现差异必须回写契约 |
| 创新范围蔓延拖累复刻主线 | 三层分治（§1.3）：扩展层 opt-in 独立排期不阻塞 DoD；实现层创新以行为 diff 为界，越界即回退 |

## 15. 关键假设（可推翻）

1. 个人非商业用途
2. Windows 优先（VCP 生态主平台），macOS/Linux 随后
3. 单人开发 + AI 辅助，按量级估算而非日历承诺
4. 基线冻结，不追每日更新
5. 前后端进程分离（保留远程部署与分布式能力）

## 16. 审批与文档索引

- 技术栈定案：用户于 2026-11-11 确认（Rust + GPUI，DSH 仅作架构参考）
- 三个 Web 断点适配：已随技术栈决策确认
- v2 重构方案（命名/基线/范围/组织）：用户于 2026-11-11 批准（方案 A）
- v2.1 创新定位（复刻为基，创新为显式目标；四个创新方向 IN-1～IN-4）：用户于 2026-11-11 确认
- 设计存档：brainstorming/plans/2026-11-11-omnia-docs-redesign-design.md

文档导航只在 [README §8](../README.md) 维护。各文件自身元数据是版本/状态来源；范围和偏差只在[范围矩阵](Omnia-复刻范围与对应矩阵.md)维护，本站不保留第二份索引或状态表。

### 16.1 修订记录

- v2.4（2026-11-12）：通用质量门禁引用代码质量规范；模块职责、接口和技术决策不变。
- v2.3（2026-11-12）：统一依赖/状态所有权和侧车语义；区分默认差异与内部等价优化；签名、索引和偏差收敛到定义源；区分核心交付和最终兼容验收。技术选型未改。

- v2.1（2026-11-11）：创新定位与三层分治（§1.3）、IN-1～IN-4 立项。
- v2.2（2026-11-12，一致性修订，技术决策不变）：补权威仲裁与仓库现状说明；澄清实现层/扩展层默认开关；IN-3/IN-4 落地位置改为「M3 后独立立项」；§13 补 vendored `rust_assistant_engine`、README 与范围矩阵；§16 索引与状态字典对齐；全文技术选型前提不变。

---

内容由 AI 生成
