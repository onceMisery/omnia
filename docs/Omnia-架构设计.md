# Omnia · 架构设计 v2.6

- 版本 / 日期：v2.6 / 2026-11-12（v2.5 提出的十项设计经用户确认后定案并同步下游；技术选型不变）
- 状态：**已批准**（方案 A 三层文档法；v2.1 创新定位经用户确认；v2.2 为文档治理修订；v2.5 提出的十项设计经用户于 2026-11-12 确认，见 §16.2）。标注【已验证】的条目只陈述冻结基线事实，证据层级见 §11.1
- 项目定位：**复刻为基，创新为显式目标**。Omnia 是 VCP 生态的 Rust 全栈原生复刻，同时在保持兼容的内部实现与明确登记的扩展中验证改进收益（见 §1.3）。复刻对象：lioensky/VCPToolBox（后端）+ lioensky/VCPChat（前端）
- 文档体系：README（入口/治理）→ 复刻范围与对应矩阵（范围）→ 本文档（决策层）→ 专项/协议契约（设计与精确规则）→ 各阶段 PRD（执行层）
- 权威仲裁：见 `README.md` §4；断点/偏差/创新统一编号见 `docs/Omnia-复刻范围与对应矩阵.md` §6
- 当前仓库状态：**M0 实施中**；实际进度与验证证据只在 `README.md` §2 及其链接的报告维护。本文的签名、依赖版本与 §13 中未列为“已建立”的结构均为目标规格

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
| vcp-agent | omnia-agent | 工具循环、提示词管线、双通道注入 | M1 |
| vcp-model | omnia-model | 上游适配、重定向、重试 | M1 |
| vcp-plugin | omnia-plugin | manifest、六类插件宿主、stdio 执行、工具调用记录库 | M1 起 |
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
- **前端边界**：omnia-app 经 HTTP/SSE/WS 访问后端，不依赖 omnia-server、omnia-agent、omnia-model、omnia-knowledge 与 omnia-memory；本地音频/桌面能力在前端。内嵌分布式节点所需的节点端协议实现与插件宿主，是唯一允许进入其依赖闭包的后端代码（§5.1）。FrontendHost 与后端 PluginHost 是不同职责，不复用含混名称。
- **跨阶段规则**：后续 PRD 追加能力，不重定义已有公共接口；原版能力到模块/阶段的映射只在范围矩阵维护。

```text
omnia-server（装配、HTTP/SSE 适配）
  → omnia-agent（管线、工具循环、handoff、注入）
      → omnia-model / omnia-plugin / omnia-knowledge / omnia-memory
  → omnia-ws / omnia-dist / omnia-filefetch / omnia-approval / omnia-scheduler
omnia-dist / omnia-approval / omnia-scheduler → omnia-plugin + omnia-ws（M3，见 §2.2）
omnia-filefetch → omnia-dist；omnia-agent → omnia-ws（M3，见 §2.2）
omnia-knowledge → omnia-memory → vexus-lite
上述业务模块 → omnia-protocol / omnia-config
omnia-app → HTTP/SSE/WS（运行时通信，不是编译依赖）
```

| 状态 / 接口 | 所有者 | 消费与责任 |
| --- | --- | --- |
| 工具注册、运行时、IPC/shim | omnia-plugin | agent 调用；侧车故障/重启/资源回收由 plugin 负责 |
| 工具循环、双通道注入、handoff | omnia-agent | server 适配 HTTP/SSE，不能另建循环状态机 |
| 工具调用记录库 | omnia-plugin | 工具循环先开记录并传入句柄、自行收尾；未传句柄的调用由 plugin 开启并收尾（§8.1） |
| 模型路由、重试、模型能力 | omnia-model | agent 消费；能力探测在 IN-4 立项时细化 |
| 知识事实、索引、内核状态 | vexus-lite，经 omnia-memory 句柄 | knowledge 编排写入，不能直接绕过句柄持有第二份状态 |
| 前端会话状态 / 子程序注册 | ChatKernel / AppRegistry | 窗口和面板消费投影；AppRegistry 的任务见 M4 US-329/330 |

### 2.2 M3 模块的依赖方向【设计】

§2.1 的依赖图只画到 omnia-server 装配 M3 各 crate，没有说明它们彼此以及与 omnia-plugin 之间的方向。基线中这些模块互相持有对方实例【已验证，VCPToolBox 冻结 commit】：

| 基线调用关系 | 出处 |
| --- | --- |
| 调度器经 pluginManager 执行工具，经 webSocketServer 广播结果 | routes/taskScheduler.js:66、109、125、231–233 |
| FileFetcher 经 webSocketServer 按来源 IP 找节点并执行 `internal_request_file` | FileFetcherServer.js:22、109、118 |
| 审核请求由插件引擎经 WebSocket 广播到 VCPLog；停机时由插件引擎拒绝全部待审请求 | Plugin.js:749–765；C-07 §7.3 |
| WebSocket 服务反向持有 pluginManager 以登记分布式工具；启动时由 server.js 互相注入 | server.js:1407、1574–1585 |

Omnia 不保留双向持有。依赖方向如下，均为编译依赖且无环：

| crate | 依赖 | 理由 |
| --- | --- | --- |
| omnia-ws | 仅 omnia-protocol / omnia-config | 连接、认证、广播；不认识插件与节点业务 |
| omnia-dist | omnia-plugin、omnia-ws | 实现 omnia-plugin 的执行桥接口并向其注册表登记远端工具；帧收发走 omnia-ws |
| omnia-filefetch | omnia-dist | 只需“按来源 IP 定位节点”和“执行内部工具”两个操作 |
| omnia-approval | omnia-plugin、omnia-ws | 实现 omnia-plugin 持有的审核门接口（M1 最小子集已在该 crate）；请求与应答走 omnia-ws |
| omnia-scheduler | omnia-plugin、omnia-ws | 以 caller=scheduler 调用工具并广播结果 |
| omnia-agent | 新增 omnia-ws | VCPInfo、`TOOL_NO_REPLY_ACCEPTED` 等侧通道广播（C-04 §4.1） |

两处归属：

- **审核留言追加**：基线实现在 toolExecutor.js:524–541（C-01 §1.5），属于 omnia-agent 的结果格式化。M3 PRD v1.5 及以前把 `receipt.rs` 放在 omnia-approval 并写“复用 M1 规则”。同一规则只能有一个实现：留在 omnia-agent，omnia-approval 只产出留言文本，不另设 `receipt.rs`。
- **分布式节点端的宿主**（M3 PRD §11 的 `node.rs`）：见 §5.1。

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

### 5.1 运行拓扑与进程边界

基线事实【已验证：冻结 commit 静态阅读，未做运行录制】：

| 侧 | 进程 | 说明 | 出处 |
| --- | --- | --- | --- |
| 后端 | 主服务 `server.js` | 监听 `PORT`；聊天、工具循环、插件、记忆、WebSocket 与 `/admin_api` 都在这个进程 | VCPToolBox server.js:657、1411、1544 |
| 后端 | 管理进程 `adminServer.js` | 监听 PORT+1，托管 AdminPanel 静态产物；15 个本地模块就地处理（配置、日志、Agent、TVS 等文件读写），其余 `/admin_api` 请求反向代理到 `127.0.0.1:PORT`（连接失败返回 502，30s 超时返回 504） | adminServer.js:15–16、327、395–416、931–993 |
| 后端 | 进程管理 | PM2 同时拉起两个进程（kill_timeout 主服务 15000、管理进程 5000）；Docker 以 pm2-runtime 启动并暴露 6005/6006；`npm start` 只启动主服务 | ecosystem.config.js；Dockerfile:192–196；package.json scripts |
| 后端 | 插件子进程 | stdio 插件每次调用 spawn；direct 插件 require 进主进程 | C-02；插件系统设计 §1.2 |
| 前端 | Electron 主进程、渲染进程、子窗口 | 子窗口有进程级崩溃隔离 | 插件系统设计 §1.4 |
| 前端 | Rust 侧车 | 音频引擎（固定端口 63789）、助手引擎、聊天数据服务、语音输入引擎，均由主进程 spawn | VCPChat main.js:632–633；modules/assistant/assistant-rust-adapter.js:343；modules/services/chatDataService/lifecycle.js:100；modules/voice/voice-input-engine-adapter.js:110 |
| 前端 | 内嵌分布式节点 | 设置项 `enableDistributedServer` 打开时，主进程内加载 `VCPDistributedServer`，以 `vcpLogUrl`/`vcpLogKey` 连接后端，节点名固定为 `VCPChat-Desktop-Client-Distributed-Server`（后端 IP 追踪对该名字有特判）；节点侧 `Plugin/` 有 38 个目录（33 启用 + 5 禁用） | VCPChat main.js:538–551；VCPToolBox server.js:576–577；`git ls-tree` 清点 |

Omnia 目标拓扑：

| 进程 | 内容 | 依据 |
| --- | --- | --- |
| omnia-server | 单个 Rust 进程承载主服务全部职责 | §4、§5 |
| 插件子进程 | stdio 每次调用 spawn（M1）；direct 插件迁入 Node 侧车宿主（M2）；预热进程池（M3 P1）。全部由 omnia-plugin 跟踪与回收 | §10；DV-1、DV-3 |
| omnia-app | 单个 GPUI 进程；音频引擎进程内直调；重型子程序可选独立进程 | M5 PRD §4.2；插件系统设计 §3.8.5；DV-10 |
| 外部浏览器 | Loom 经 CDP 控制，不属于 Omnia 进程 | BP-05 |

基线的两项拓扑此前没有承接方案，v2.6 定案如下：

1. **管理端口 PORT+1**【设计】。C-11 §12.1 已冻结“主端口 `/AdminPanel` 重定向到 PORT+1”，但没有规定 Omnia 在 PORT+1 上提供什么。不监听则这个重定向落空，原版部署的端口映射（6005/6006）和指向 PORT+1 的管理客户端也随之失效，属于可观测差异。定案：不拆第二个进程，由 omnia-server 同时监听 PORT 与 PORT+1，在 PORT+1 暴露 `/admin_api`。注意基线两个端口对同一路径的行为并不完全相同：管理进程的本地模块使用空实现的 pluginManager，例如保存配置后不会重载插件（adminServer.js:426–432）。US-201 须逐端点提取两个端口的差异，再决定保留哪些；提取完成前不实现 PORT+1 上的端点，决定不保留的差异须在范围矩阵 §6.2 登记 DV。原版 AdminPanel 静态产物是否托管归 SC-01 决定。
2. **桌面端内嵌分布式节点**【设计】。后端工具经由这个节点到达用户本机的音乐、桌面、Loom、文件与终端等能力。范围矩阵此前只登记了节点协议（M3），没有登记节点侧插件和内嵌宿主，现登记为 SC-17。M3 PRD v1.5 及以前把节点端实现写成“omnia-server 作为分布式节点”，与基线的主要部署形态（节点在桌面端）不同。定案：节点端协议实现放在不依赖 omnia-server 和 omnia-agent 的位置（§2.1 的前端边界），使 omnia-app 与独立节点进程都能装配；内嵌开关沿用 `enableDistributedServer`。它具体落在哪个 crate 由 US-201 冻结节点协议时核定，核定前不实现节点端。

### 5.2 启动顺序

基线顺序【已验证：VCPToolBox server.js:3–30、1377–1594，静态阅读】。要点是**全部初始化完成后才开始监听端口**，WebSocket 与 FileFetcher 在监听回调里才挂上：

1. 模块加载期：应用 dotenv 补丁并读取 `config.env`，初始化日志器并接管 console
2. IP 黑名单 → Agent 目录、TVS 目录 → `ModelRedirect.json` → `SemanticModelRouter.json` → Agent、TVS、Toolbox、SarPrompt 管理器
3. 工具调用记录库 → 知识库 → TDB 冷知识库（都在加载插件之前就绪，再注入插件引擎）
4. 动态工具注册表 → 加载插件 → 注入 WebSocket 服务引用 → 初始化服务类插件并注册其路由 → 挂载 `/admin_api` 与 `/admin_api/forum`
5. 向预处理器与服务插件注入依赖 → 初始化 static 插件 → 预热 Python 插件 → 载入表情包列表缓存
6. 启动插件清单监听（放在最后，避免启动期写文件触发重载）→ 初始化任务调度器
7. 监听端口 → 初始化 WebSocket 服务（`VCP_Key` 先取 VCPLog 插件配置，其次进程环境）→ 初始化 FileFetcher
8. 启动流程抛错：记录后以退出码 1 结束

Omnia 装配规则【设计】：

- 装配只发生在 omnia-server 的启动入口，按上面的依赖次序显式构造并传入，不使用全局单例，也不在构造之后互相注入（基线第 4、7 步的 setter 注入由构造参数取代）。
- 保持“就绪后才监听”：端口可连接即表示插件、记忆与路由均已就绪。
- 可观测的次序须保留：服务类插件的路由先于 `/admin_api` 总路由挂载；static 插件首轮执行在监听之前；插件清单监听在首轮执行之后启动。
- 启动失败返回非零退出码并说明失败的阶段，不带着半初始化状态继续运行。基线对单个插件加载失败的容忍策略由 US-201 提取，这里不作假定。

### 5.3 停机生命周期

基线事实【已验证：VCPToolBox server.js:145–300、634–651、1055–1061、1597–1767；WebSocketServer.js:165–170、652–700；Plugin.js:732–796，静态阅读】。C-11 §12.1 把细化责任放在 SC-14；这里只记录已核实的骨架，供该项冻结时对照。

- **四态**：RUNNING → DRAINING → SHUTTING_DOWN → EXITING。`GET /admin_api/server/lifecycle` 返回 `{status:'success', lifecycle:{state, reason, startedAt, uptimeMsInState, activeRequestCount}, shutdownExitCode}`。
- **触发**：SIGINT、SIGTERM（退出码 0）；管理端重启（退出码缺省 1，reason 为 `admin_restart`，依赖外部进程管理器重新拉起）。重复触发复用同一次停机。
- **非 RUNNING 时的新请求**：只放行 `/admin_api/server/restart`、`/admin_api/server/lifecycle`、`/v1/interrupt` 和 `/plugin-callback/` 前缀；放行不免认证（C-11）。其余请求，`stream:true` 时返回 200 SSE：一个 id 为 `chatcmpl-draining-{ts}` 的 chunk（内容“服务正在重启/关闭中，暂时不再接受新的请求。”，`finish_reason:'stop'`，附 `lifecycle`）加 `[DONE]`；否则返回 503 JSON `{error:'Service Unavailable', message, lifecycle}`。
- **阶段**（整体 60s 后强制退出）：
  1. WebSocket 停止接受升级并停心跳，已有连接保留
  2. 销毁空闲 socket，关闭 HTTP 监听
  3. 等待在途聊天请求结束，最多 30s
  4. 仍有在途请求则逐个中止，再等最多 5s
  5. 状态切到 SHUTTING_DOWN
  6. 停任务调度器
  7. 关闭全部 WebSocket 连接
  8. 插件引擎停机：停清单监听，拒绝全部待审核请求（`error_type:'plugin_manager_shutdown'`），依次调用预处理器与服务插件的 shutdown，取消 static 定时任务；随后关闭工具调用记录库
  9. 关闭 TDB 冷知识库，再关闭知识库
  10. 关闭日志文件流，状态切到 EXITING，退出
- 插件先于知识库关闭，是因为常驻插件要先排空自己对知识库的写入（Plugin.js:767–769）。
- **未捕获异常与未处理的 Promise 拒绝**：基线记录后继续运行，不退出。

Omnia 处理【设计】：

- 阶段次序、放行清单、两种拒绝响应和各超时值属于对端可观测行为，按 1:1 保留。精确字节由 SC-14 的负责 US 录制后冻结。
- 第 8 步之后增加一步：由 omnia-plugin 回收仍存活的插件子进程与侧车。这是 DV-3 已登记的默认差异，不是新增偏差。
- 关闭次序的约束：使用者先于被使用者关闭（调度器、连接、插件 → 记录库 → 知识库），与 §2.1 的依赖方向相反。
- Rust 的 panic 与 Node 的未捕获异常不等价。请求级任务的 panic 收敛为该请求的错误响应，进程继续服务；内存安全或状态已损坏的情况不在此列（代码质量约束 §5.2）。对拍中若出现可观测差异，登记为 DV，不默认等价。
- 管理端重启依赖外部进程管理器拉起新进程。Omnia 的独立后端部署由什么承担这一角色，归 SC-15 的部署资产决定；没有进程管理器时“重启”只会停机。

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
- 中断：每请求 CancellationToken（tokio_util），取消上游 fetch 并让工具循环在轮次边界退出；在途工具是否随之终止见下文“取消传播”
- SQLite：WAL；写路径单连接串行化（Mutex<Connection>），读路径连接池
- 插件进程：每次调用 spawn（M1），预热进程池 M3 P1
- 背压：SSE 发送用有界 channel，客户端断开触发取消链

### 取消传播

基线事实【已验证：冻结 commit 静态阅读】：

- 显式中断、客户端断联和停机中止走同一条链：置 `aborted` 标志并触发该请求的 AbortController（server.js:289–300、1093–1099；modules/chatCompletionHandler.js:813–847）。
- 信号只传给上游 fetch（modules/handlers/streamHandler.js:611、757）。循环在每轮开始和下一次上游调用之前检查它（:492、600、746）。
- 工具执行不接收该信号：`executeAll` 与 `processToolCall` 的参数里没有它（modules/vcpLoop/toolExecutor.js:432–435、459–463）。stdio 插件进程只在自身超时时被终止（Plugin.js:1755–1765）；direct 调用的 AbortController 是为超时单独新建的（Plugin.js:1195–1201）。
- 因此基线中断后，在途工具继续运行到结束或超时，调用记录照常落库；结果不再回灌模型，也不再写入已关闭的响应（streamHandler.js:537、746）。

本文 v2.4 写的是“级联取消上游 fetch 与工具执行”，M0M1 PRD §6.2 的 `ExecContext` 也带有 `cancel` 字段。按字面实现会在中断时终止在途插件进程，这与基线不同：有副作用的工具会被截断，`tool_call_records` 的终态也会不同。范围矩阵 §6.2 没有登记这项差异。

处理【设计】：按基线，中断不终止在途工具；`ExecContext.cancel` 的用途限于已登记的路径，即停机回收（DV-3）与分布式节点取消（DV-6）。若希望中断时终止在途工具，须先在范围矩阵 §6.2 新登记一项 DV，写明受影响的记录终态与副作用边界，再实现。

### 日志与诊断

基线事实【已验证：静态阅读】：主服务启动时接管 console，写入 `DebugLog/ServerLog.txt`；单文件超过 5MB 轮转，归档到 `DebugLog/archive/<日期>/ServerLog/<三位序号>.txt`，默认保留 7 天（modules/logger.js:8–9、17–18、46、50–53）。管理面按这个固定路径读取日志（adminServer.js:419–421）。

Omnia【设计】：

- 日志后端只在 omnia-server 与 omnia-app 的启动入口初始化一次；库 crate 只产生事件，不配置输出，也不直接写文件。
- 日志文件的位置和轮转规则被管理端的日志读取接口消费，属于可观测面，随 M3 US-214 的 server-log 端点一起对齐。每行文本格式是否属于契约，由 US-201 提取该端点时决定。
- 脱敏在产生事件处完成：`Key`、`VCP_Key`（含 WebSocket URL 路径中的明文）、Bearer 与 Basic 凭据、插件 `config.env` 的值不进入日志（M0M1 PRD §10、M3 PRD §13）。

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

### 8.1 后端持久化布局与写入者

基线事实【已验证：冻结 commit 静态阅读】。路径相对后端项目根，括号内是可以重定向它的环境变量。

| 路径 | 内容 | 基线写入者 | 出处（VCPToolBox） |
| --- | --- | --- | --- |
| `config/tool-call-records.sqlite3`、`config/tool-call-records.config.json` | 工具调用记录库（WAL、foreign_keys）及其配置 | 工具调用记录模块 | modules/toolCallRecordStore.js:9–11、134–135 |
| `VectorStore/`（`KNOWLEDGEBASE_STORE_PATH`） | `knowledge_base.sqlite` 与向量索引 | 知识库管理器与内核 | KnowledgeBaseManager.js:54、330 |
| `dailynote/`（`KNOWLEDGEBASE_ROOT_PATH`）、`knowledge/`（`TDB_KNOWLEDGE_ROOT_PATH`） | 日记与冷知识库的源文件 | 日记类插件与主进程的管理 API；知识库只监听并摄取 | server.js:1329–1334；adminServer.js:409–411 |
| `VCPAsyncResults/` | 异步插件回调结果 `<插件名>-<taskId>.json` | 回调端点，临时文件 + rename | server.js:1367；modules/asyncResultStore.js:18–43 |
| `VCPTimedContacts/`、`VCPTimedResults/` | 定时任务文件与执行结果 | 调度器监听前者、写入后者；任务文件的写入入口由 US-201 提取 | routes/taskScheduler.js:12–13、28–31、182–186 |
| `.file_cache/` | 跨节点文件缓存 | FileFetcher | FileFetcherServer.js:10 |
| `DebugLog/` | 服务日志与归档 | 日志器 | modules/logger.js:8–9 |
| `ip_blacklist.json` | IP 黑名单 | 主服务 | server.js:126、522 |
| `Agent/`（`AGENT_DIR_PATH`）、`TVStxt/`（`TVSTXT_DIR_PATH`） | Agent 预设与 TVS 文档 | 管理进程的本地模块 | server.js:35–48、79–84；adminServer.js:402–403 |
| `config.env`、`toolApprovalConfig.json` | 全局配置与审核配置 | 管理进程的本地模块 | adminServer.js:399 |

两点说明：

- 基线里配置、Agent 与 TVS 文件由管理进程写、主进程读。日记则特意交给主进程处理，因为只有主进程持有知识库实例（adminServer.js:409–411）。
- 基线的 docker-compose 把 `VectorStore/` 放在命名卷上，注释说明 SQLite/WAL 放在 Docker Desktop 的跨系统 bind mount 上会损坏数据库。Omnia 的容器部署资产（SC-15）须保留这条约束。

Omnia【设计】：

- 路径、文件名和用于重定向的环境变量按 1:1 保留，使原版数据目录在停写并备份后可以顺序挂载（使用与维护 §3）。
- 每个路径只有一个写入模块：`VectorStore/` 归 vexus-lite（经 omnia-memory 句柄）；`VCPAsyncResults/` 归 omnia-plugin；`VCPTimedContacts/` 与 `VCPTimedResults/` 归 omnia-scheduler；`.file_cache/` 归 omnia-filefetch；`DebugLog/` 与 `ip_blacklist.json` 归 omnia-server。
- 配置、Agent 与 TVS 文件由 omnia-server 的管理 API 写入，读取与热重载仍由各自的所有者负责。Omnia 是单进程，不再有两个进程读写同一份文件的情况。

**工具调用记录库归 omnia-plugin**（v2.6 定案）。此前本文 §2 与 M0M1 PRD §6.1 把它放在 omnia-agent（`records.rs`），插件系统设计 §3.1 把它放在插件引擎的治理层，M0M1 PRD 又把“记录存储”的验收写在插件执行器的 US-012 里。基线中，工具循环先开记录，再把句柄传给插件引擎（modules/vcpLoop/toolExecutor.js:382、432–435）；调用方没有传句柄时，插件引擎自己开记录并收尾（Plugin.js:1313–1321），调度器走的就是这条路径（routes/taskScheduler.js:95）。omnia-plugin 不能依赖 omnia-agent（§2.1），所以记录库放在 omnia-agent 时，不经过工具循环的调用无法落库。因此由 omnia-plugin 持有，omnia-agent 经句柄使用；§2 的 crate 表、M0M1 PRD §6.1、范围矩阵 §3.1 与插件系统设计 §3.1 已同步。

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
| 3D 音乐舞台 / 视频渲染 | GPUI 为 2D GPU | 2D 舞台重制（6 模式 P0）；3D 自研或降级 2.5D（P1）；视频：M0 实测确认锁定的 GPUI 栈没有原生视频组件（GPUI 实测报告 F8），降级或外部引擎由 M5 决策（BP-07） |

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

### 11.1 证据层级

“已验证”有不同的强度。引用时写明属于哪一级，不能用低一级的证据签署高一级的结论。中间两级沿用 [fixture 报告](fixture-report.md)的分类。

| 层级 | 证明什么 | 不能证明什么 |
| --- | --- | --- |
| 静态阅读 | 冻结 commit 的源码写了什么 | 运行时确实走到这条路径，以及各分支的先后时序 |
| 冻结源码构造 | 固定输入在冻结源码（VM 或静态切片）上执行得到的输出 | 完整运行链路上的行为 |
| 真实运行录制 | 隔离的原版服务在合成模型与插件下的实际报文 | 原版前端界面端到端的行为；真实外部服务 |
| 四象限 e2e | 上表某一组合的端到端行为 | 其它组合；未纳入用例的能力 |

本文 §2.2、§5.1–§5.3、§7 取消传播与 §8.1 的基线事实目前都只到“静态阅读”一级。负责任务冻结对应契约时，须把其中对端可观测的部分补到录制一级。

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
├── Cargo.toml                    # 已建立；另有 Cargo.lock、rust-toolchain.toml
├── crates/
│   ├── omnia-protocol/           # 协议类型与解析（M0，已建立）
│   ├── omnia-config/             # 配置加载（M0，已建立）
│   ├── omnia-server/             # axum API / SSE / 中间件（M1；已建立空 crate）
│   ├── omnia-agent/              # 循环 / 提示词管线 / 双通道注入（M1；已建立空 crate）
│   ├── omnia-model/              # 模型适配与路由（M1；已建立空 crate）
│   ├── omnia-plugin/             # 插件引擎 + 桥接宿主 + 工具调用记录库（M1 起；已建立空 crate）
│   ├── omnia-knowledge/          # 索引管道（M2）
│   ├── omnia-memory/             # 内核句柄 + 双通道（M2）
│   ├── omnia-ws/                 # WebSocket（M3）
│   ├── omnia-dist/               # 分布式（M3）
│   ├── omnia-filefetch/          # 跨节点文件（M3）
│   ├── omnia-approval/           # 审核全量（M3）
│   ├── omnia-scheduler/          # 调度（M3）
│   ├── omnia-app/                # GPUI 前端（M0 骨架起；已建立开发预览）
│   ├── omnia-gpui-probes/        # M0 框架能力实验（US-007 探针，已建立；不属于产品运行时，产品 crate 不得依赖）
│   ├── vexus-lite/               # vendored 记忆内核（M2，原名）
│   │   └── crates/vcp-tdb-index/
│   ├── rust_audio_engine/        # vendored 音频引擎（M5，原名）
│   └── rust_assistant_engine/    # vendored 助手/麦克风引擎（M5，原名；与 §2 命名表一致）
├── plugins-native/               # Rust 原生化插件
├── contract/                     # 契约测试 + fixture 库 + recorder 录制工具（已建立；规范见契约文档 §11，含 c10-pipeline/）
├── scripts/                      # 文档检查脚本（已建立）
├── .github/workflows/            # CI 配置（已建立；运行结果见 README §2）
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
| 视频渲染：锁定的 GPUI 栈没有原生视频组件（M0 F8 已确认） | 外部播放器、帧预览降级或外部引擎，由 M5 决策（BP-07） |
| 运行拓扑、停机与取消等基线事实只有静态阅读证据 | 按 §11.1 分级引用；负责任务冻结契约时补到录制一级，录制与本文不符即勘误本文 |
| 多个会话并行修改同一批文档 | 修改前核对文件状态，只改本次任务负责的文件；每次修订后运行文档检查 |
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
- v2.5 提出的十项设计：用户于 2026-11-12 确认（“按你的建议修改文档”），清单见 §16.2，决策存档 brainstorming/plans/2026-11-12-architecture-runtime-decisions.md；基线事实的证据只到静态阅读一级（§11.1）

文档导航只在 [README §8](../README.md) 维护。各文件自身元数据是版本/状态来源；范围和偏差只在[范围矩阵](Omnia-复刻范围与对应矩阵.md)维护，本站不保留第二份索引或状态表。

### 16.1 修订记录

- v2.6（2026-11-12）：v2.5 提出的十项设计经用户确认后定案（§16.2）：去掉待确认标记；工具调用记录库改归 omnia-plugin（§2、§8.1、§13）；§2.1 前端边界写明内嵌分布式节点的例外；管理端口与节点端宿主由建议改为定案（§5.1）。同步范围矩阵、插件系统设计、M0M1 PRD、协议契约 C-11 指引、M3 PRD 与使用与维护。没有新增 BP/DV；技术选型与冻结 commit 不变。
- v2.5（2026-11-12）：对照冻结源码补充 §2.2 M3 依赖方向、§5.1 运行拓扑、§5.2 启动顺序、§5.3 停机生命周期、§7 取消传播与日志、§8.1 持久化布局与写入者、§11.1 证据层级；§13 标注已建立的工程结构；更正 §7“中断级联取消工具执行”的表述（基线不终止在途工具）；登记工具调用记录库归属冲突。新增【设计】条目待用户确认（§16.2）；技术选型与冻结 commit 不变。
- v2.4（2026-11-12）：通用质量门禁引用代码质量规范；模块职责、接口和技术决策不变。
- v2.3（2026-11-12）：统一依赖/状态所有权和侧车语义；区分默认差异与内部等价优化；签名、索引和偏差收敛到定义源；区分核心交付和最终兼容验收。技术选型未改。

- v2.1（2026-11-11）：创新定位与三层分治（§1.3）、IN-1～IN-4 立项。
- v2.2（2026-11-12，一致性修订，技术决策不变）：补权威仲裁与仓库现状说明；澄清实现层/扩展层默认开关；IN-3/IN-4 落地位置改为「M3 后独立立项」；§13 补 vendored `rust_assistant_engine`、README 与范围矩阵；§16 索引与状态字典对齐；全文技术选型前提不变。

### 16.2 v2.5 设计条目的定案（2026-11-12 用户确认）

下列十项由 v2.5 提出，用户于 2026-11-12 全部确认，自 v2.6 起是现行设计。最后一列是已同步的下游文档。定案不等于可以直接实现：第 3、4、5、6、8 项里仍依赖源码提取或录制的细节，在对应章节写明了负责任务，提取完成前不实现。

| # | 条目 | 定案 | 章节 | 已同步的下游文档 |
| --- | --- | --- | --- | --- |
| 1 | M3 各 crate 的依赖方向 | omnia-ws 不依赖业务 crate；dist / approval / scheduler 依赖 plugin 与 ws；filefetch 依赖 dist；agent 新增依赖 ws | §2.2 | M3 PRD §11 |
| 2 | 审核留言追加的归属 | 留在 omnia-agent，omnia-approval 只产出留言文本 | §2.2 | M3 PRD §11（`receipt.rs`） |
| 3 | 管理端口 PORT+1 | 不拆第二进程，omnia-server 同时监听两个端口；逐端点差异由 US-201 提取 | §5.1 | C-11 §12.1、M3 PRD §9、使用与维护 §2 |
| 4 | 桌面端内嵌分布式节点的宿主 | 节点端协议实现不依赖 omnia-server / omnia-agent，omnia-app 与独立节点进程都能装配 | §5.1 | M3 PRD §11（`node.rs`）、范围矩阵 SC-17 |
| 5 | 启动装配规则 | 构造参数取代 setter 注入；就绪后才监听；失败非零退出 | §5.2 | M0M1 PRD §6（omnia-server 启动入口） |
| 6 | 停机生命周期 | 阶段次序、放行清单、拒绝响应与超时值 1:1；增加插件子进程回收一步（DV-3） | §5.3 | 范围矩阵 SC-14、C-11 §12.1 |
| 7 | 中断是否终止在途工具 | 按基线不终止；要终止须先在范围矩阵登记新 DV | §7 取消传播 | M0M1 PRD §6.2（`ExecContext.cancel` 的用途说明） |
| 8 | 日志落点与脱敏 | 只在两个启动入口初始化；文件位置与轮转随 server-log 端点对齐；脱敏在事件产生处 | §7 日志与诊断 | M3 PRD §9 |
| 9 | 后端持久化目录的写入者 | 路径与环境变量 1:1；每个路径只有一个写入模块 | §8.1 | 使用与维护 §3 |
| 10 | 工具调用记录库的归属 | 由 omnia-plugin 持有，omnia-agent 经句柄使用 | §8.1 | 本文 §2 crate 表与 §13、M0M1 PRD §6.1、范围矩阵 §3.1、插件系统设计 §3.1 |

---

内容由 AI 生成
