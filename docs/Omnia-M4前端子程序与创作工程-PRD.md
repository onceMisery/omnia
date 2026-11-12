# Omnia · M4 前端子程序群与创作工程 PRD v1.4

> 本文件定义 M4 阶段目标，产品尚未实现。C-08/C-09 已定义基础数据契约，M4 专项细节由 US-301 从固定基线提取；范围与断点以对应矩阵为准。技术选型不变。

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v1.4 / 2026-11-12（接入代码质量约束）/ **部分冻结** |
| 适用阶段 | M4；剩余【待冻结】由 US-301 滚动冻结，未冻结禁止实现（见 `README.md` §5.2） |
| 范围对应 | 前端 25 个目录逐项对应见 `docs/Omnia-复刻范围与对应矩阵.md` §4.1；断点编号见其 §6.1 |
| 复刻对象 | lioensky/VCPChat v2.0（NextVchat），基线 commit `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（2026-11-11 冻结） |
| 前置依赖 | M0M1（后端核心+GPUI 聊天 v1）、M2（记忆）、M3（插件全量类型+分布式+WS+审核）完成；论坛 UI 另以 US-217 完成为硬前置 |
| 源码位置 | `D:\code\github\VCPChat`（本地仓库，行号以冻结 commit 为准）：README（子程序矩阵+六大支柱）、ScriptoriumModules/README.md（652 行完整规格）、PRETEXT_INTEGRATION_CN.md、docs/projectforge-ast-indexer-blueprint.md（389 行施工图）、ScriptoriumCollaborator manifest（38KB，v3.3 全命令字段）、ProjectForge manifest（26KB）、app-features.md、chat-context-pipeline.md |
| 许可证 | VCPChat 同为 CC BY-NC-SA 4.0（README 确认）；约束同前 |
| 事实标注 | 【已验证】= 基线源码/文档确认；【待冻结】= US-301 补齐、未冻结禁止实现；【设计】/【偏差】/〔待产出〕定义见 `README.md` §5.2 |

### 0.1 本阶段的 1:1 含义

M4 是前端深水区。原则不变：**行为/协议/数据级 1:1，原生重实现**。三条具体化：

1. **文件格式完全兼容**：.vdocx/.vpptx 工程容器、话题/笔记/AppData 数据格式与原版双向可读（这是硬验收）
2. **协议完全兼容**：ScriptoriumCollaborator/ProjectForge 插件命令、PR 协议、WS 消息与原版逐字段对齐（原版后端插件可直接驱动 GPUI 前端）
3. **渲染行为对齐、实现替换**：V4 引擎的竞态防护/冻结/预排版等行为目标用 GPUI 原生机制达成；DOM 特有实现（contenteditable、CSS 动画）不照搬

### 0.2 已声明的兼容性断点（与架构设计一致）

> 本节断点的统一编号、验收口径与全项目断点总表见 `docs/Omnia-复刻范围与对应矩阵.md` §6.1（BP-01～BP-13）；新增断点须先在该表分配编号。

- **可编程岛**：原版岛内跑 Anime.js/Three.js/Pixi.js/Pyodide。原生方案：嵌入式 JS 运行时（**优先 gpui-shell**，M0 实测不通过则回退 deno_core 或原生 DSL；既定前提见 `README.md` §6.1、架构 §9）+ 原生 Canvas/动画 API 子集；Three.js/WebGL/Pyodide 岛降级为静态快照+审计声明（复用原版"未知脚本不可执行"机制）。**存量含 3D/WASM 岛的文档不能完整运行**，源码与身份保留
- **Mermaid/KaTeX**：原生渲染子集自研（Mermaid 流程图/时序图子集 P1，其余显示为代码块；KaTeX 公式原生排版 P1）
- VoiceChat/TTS、VMusic、Loom、VCPDesktop、文坊白板（.excalidraw）、3D 骰子、桌宠等 → M5，不在本 PRD

---

## 1. 范围与优先级

### P0

1. 流式渲染引擎 V4 行为升级（M1 v1 → 完整行为规格）
2. 聊天内核增强：话题多标签、拖拽独立窗口、Agent 管理、表情包 URL 修复、气泡交互按钮回调
3. Scriptorium 核心：v2 容器、混合编译器、源码事务、源码/CSS 工作面、PR 协议+文脉、Collaborator 端口、阅读渲染与导出
4. ProjectForge 核心：IDE+Git、AST 索引器（Rust 重实现）、多 Agent 编程流可视化、步骤中止与分支回退
5. 轻量子程序第一批：VchatCLI 终端、翻译中心、VNote+迷你便签、论坛 UI、心流锁、Tavern 预设、插件管理中心、人类工具箱、VchatManager
6. AppRegistry、内置清单注册与统一 FrontendHost（US-329）

### P1

Scriptorium 渲染态直接编辑（IME 全语义）、可编程岛适配层、VPPTX 场景模型、高级样式/SVG 资产、Mermaid/KaTeX 原生子集；Memo 记忆中心 UI、灵视监控面板、闪电深研/日报 UI；ProjectForge TODO/责任树/KV 阶段锁/WorkBuddy；脚本和受限内核扩展点试点（US-330）

### P2（转交 M5 或终验补齐队列）

Canvas 工作台（代码/Markdown 协作与执行）与文坊白板（.excalidraw）、VMusic、Loom、VCPDesktop、VoiceChat、3D 骰子、塔罗、VCPSleep、桌宠、游戏群、JEV 前端集成。

> **转出标注**（P2 统一口径见 `README.md` §5.4）：`VCPSleep` 由 M5 §1 P0 承接（自主生活）；`3D 骰子 / 塔罗 / 桌宠` 由 M5 §1 P1 承接；`游戏群 / JEV 前端 / 视听工坊` 由 M5 §1 P2 承接；`文坊白板` 由 M5 US-422 承接；`Canvas 工作台` 进入 SC-08，由 US-301/US-401 补齐协作、执行和数据契约后安排实施，不能由白板验收替代；`VMusic / Loom / VCPDesktop / VoiceChat` 由 M5 §1 P0/P1 承接。同一功能在 M4 为 P2、在 M5 为 P0/P1 属正常转出，不是优先级冲突；逐项对应见 `docs/Omnia-复刻范围与对应矩阵.md` §5/§7。其他 P1 延期进入 SC-16，仍须在 US-426 前完成原有功能。

---

## 2. 流式渲染引擎 V4 升级【已验证：README V4 节 + PRETEXT 文档】

### 2.0 IN-1 设计原则（创新条目，架构 §1.3，实现层）

原版 V4 六大机制是 DOM 布局/渲染分离、异步 rAF、contenteditable 竞态逼出的复杂度。在既定 GPUI 路线下，测量、状态和渲染的组织方式发生变化，**部分旧机制可能简化，须逐项用行为证据确认**。本阶段原则：

1. **保留行为目标，不复刻机制**：下表"原版行为"列是验收标准（迟到拒写、滚动锚定、离屏零 CPU、CLS 0），"GPUI 原生实现规格"列是参考路径而非强制设计——允许用更简单的原生机制达成同一行为目标
2. 每项机制实现前须回答：GPUI 模型下该问题是否天然不存在？若不存在，以行为测试证明等价即可，不引入对应机制（例：测量渲染同源可能使 PreText 高度预估退化为直接测量缓存）
3. 验收以行为用例为准（§9.4），不以"是否实现了六套机制"为准；简化设计须记录决策日志
4. 性能目标不变（万条消息滚动帧率、冻结态零 CPU、prepare≈0.2ms/条量级参考）；若原生路径显著优于原版基准，记录实测数据作为超越证据

以 M1 v1 的增量 Markdown 与基础竞态防护完成为前置。M4 补齐六项行为（行为目标清单，实现路径按 §2.0 原则裁量）：

| 机制 | 原版行为 | GPUI 原生实现规格 |
| --- | --- | --- |
| 三维校验 | 流式会话 ID + 代次序号 Revision Token + 消息身份，迟到数据拒写 | 每 chunk 携带三元组，渲染前校验；切换话题/重试后代次递增，旧代次 chunk 丢弃（用例：快速切话题+网络重发） |
| 双阶段提交 | 流式期轻量预览管线，结束后切规范终稿并清空排队任务 | 流式期增量布局；finish 时全量重解析该消息并原子替换，排队任务清空（用例：流式中未闭合围栏结束后样式归正） |
| 语义岛防御 | 未闭合/非对称 div/script/style/错误占位符不破坏消息外壳 | 原生消息边界隔离：单消息解析失败/恶意结构收敛为错误块，不影响相邻消息与主布局 |
| 涟漪渐进+滑动 AST | 视口优先渲染，超长历史移出全量解析，O(n) | 视口内消息完整布局，视口外仅保留摘要结构；滚动时按需重建（用例：万条消息滚动帧率） |
| 墓碑冻结 V2 | 离屏动态内容暂停动画/rAF/WebGL/音频，进视口唤醒 | 离屏消息冻结动画时钟与交互更新，进视口恢复；冻结态零 CPU（用例：100 条含动画消息离屏后占用） |
| PreText 预排版 | 纯算术高度预估，零重排，CLS 0.00 | 见 §2.1 |

### 2.1 预排版与滚动锚定（PreText 行为规格）【已验证：PRETEXT_INTEGRATION_CN.md】

- 高度缓存三层：预排版对象、计算高度、文本快照（变更检测）
- 消息渲染完成即填充高度缓存；离屏固化高度优先读缓存，未命中回退实测
- **滚动锚定**：流式 chunk 计算 heightDelta；用户在底部附近→跟随到底；用户已上翻→视口位置不变（scrollTop += delta 语义），不得强拉回底部
- 窗口缩放：全量缓存按新宽度重算（原版 500 条约 0.1ms，原生目标同量级）
- 字体测量用具体字体名（原版 Segoe UI/Consolas，避免 system-ui 测量偏差）；GPUI 文本系统测量与渲染同源，天然消除 Canvas/DOM 差异
- 性能基准【已验证原版数据，作为原生目标参考】：prepare≈0.2ms/条、layout≈0.0002ms、缓存查询 O(1)

---

## 3. 聊天内核增强【已验证：README 矩阵】

- 话题多标签拆分、拖拽成独立物理窗口（gpui-kit 多窗口；窗口间状态经 Chat Kernel 单一真源同步，迟到数据不串线——对齐 VCPAgentChatCore 解耦目标）
- 多 Agent 管理：创建/排序/未读红点/Agent 主动消息（以 M3 WS VCPInfo 通道完成为前置）
- AI 表情包 URL 修复器：模糊匹配纠正 404 表情包【算法待冻结：emoticonUrlFixer.js】
- 气泡内可交互 `<button>`：原生渲染为按钮组件，点击精准回调事件到后端【协议待冻结】
- 高级回复（Tavern）：SillyTavern 角色卡/预设/世界书兼容挂载，深度注入/相对注入/拖拽排序；**用户端规则仅作用于提交副本**，不污染真实历史【注入规则待冻结：Tavernmodules】

---

## 4. Scriptorium V3 规格【已验证：ScriptoriumModules/README.md】

### 4.1 可 1:1 移植的核心（纯逻辑，与浏览器无关）

**源码保持型管线**（灵魂，逐条对齐）：

```
markdown-hybrid 唯一真源 → 扫描保护区域 → 带字符区间+内容哈希的编辑索引
→ 静态渲染树/临时编辑树 → 光标映射回源码偏移 → expected 校验事务
→ 只替换变化片段 → 局部重编译修补
```

- 编译器版本标识 `vdoc-hybrid-compiler/3`；先扫描保护代码/Mermaid 围栏、可编程岛、样式块、块级/行内公式，再 GFM lexer 建 token 级编辑区
- 编辑索引字段：临时 key、内容类型、flow kind（text-flow / stable-atomic）、源码字符起止、内容哈希、MD token 类型、岛 ID；临时 key 不写回正文
- 事务结构 `{from, to, expected, insert}`；提交四检查：区间原文==expected、编辑区哈希一致、不跨稳定原子边界、文档修订未变；任一失败拒绝写入（**宁可拒绝，不伪造成功**）
- 派生渲染产物（公式输出/图表 SVG/运行时状态）永不写回真源
- 语法显隐：非当前上下文标记隐藏，光标进入行/行内范围时显现；编辑模型始终是源码字符序列

**v2 ZIP 工程容器**（文件格式 1:1，硬验收）：

```
manifest.json / source/document.md / source/document.css
lineage/checkpoints.json / resources/media/<sha256>.<ext>
resources/fonts/<sha256>.<ext> / mimetype
```

- 资源协议 `vdoc-resource://media|fonts/<sha256>`；内容寻址去重；打开时逐资源校验路径/ID/哈希；保存经临时文件原子替换
- VDOCX：markdown-hybrid 真源 + 独立 document-css；VPPTX：每页一份完整 HTML Scene + 共享 deck-css，页面稳定 ID/名称/备注/转场/时长，**slideIndex 从 1 起算**（插件内部才转数组索引）

**PR 协议与文脉**（1:1）：

- 提交携带 maid/summary/requestId/expectedRevision；预检+批准时双重修订校验；requestId 幂等；合并时重定位 target，相同目标按 startLine 选最近实例
- 审阅并排：局部源码 diff + 隔离渲染 diff；历史节点存完整 changeSet 与 before/after 状态
- 自动允许仅人类本地按操作类型开启（源码替换/新增末页/插入页/删除页）；Agent 不能自行开启；refuse 级内容不可自动批准
- 文脉节点字段：作者（人类/Agent 独立身份）、摘要、基础/结果修订、状态（pending/applied/rejected/conflict/failed）、proposal+operation、前后源码状态、审阅者与回执、内嵌快照
- 回溯=先备份当前+从目标节点快照创建新恢复记录（不删除未来）

**Collaborator 端口**：17 命令（ListFonts/GetDocumentInfo/GetRenderedText/GetOutline/GetSection/GetSource/SearchSource/GetViewportSource/GetVisualContext/GetPrHistory/SubmitSourcePr/AddSlide/InsertSlide/DeleteSlide/UpdatePresentationConfig/CreateProject/GetStorageInfo），字段以快照内 manifest v3.3 为冻结契约；command1/2/3 串行+wait/sleep/delay；中途失败停止后续但保留已成功回执（partial_failure+failedStep）；CreateProject 七步（规范化→校验→审查→依赖→打包→原子落盘→署名首节点），显式覆盖须附目标当前 SHA-256

### 4.2 原生重实现部分

- **阅读渲染**：GPUI 原生 Markdown/HTML 子集排版；分页器行为对齐（字素拆分、表格按行续页、列表语义保留、标题与后续同页、原子块不拆、运行态快照两帧稳定后重分页、超页原子内容产出溢出警告）
- **导出**：分页 HTML/放映 HTML 为自运行产物（生成 HTML 文件不受纯原生约束）；PDF 导出 P1；资源随导出封装，不依赖编辑期协议
- **渲染态直接编辑（P1）**：GPUI 文本编辑+源码偏移映射；不变量 `editableSourceText == 原始源码片段`，无法证明则拒绝激活；IME composition 期不重建编辑模型、延迟最终 input、屏蔽迟到事件；Enter/退格/粘贴/跨区选择全部转源码事务
- **可编程岛（P1）**：稳定语义 ID（data-vdoc-island）1:1 保留；嵌入式 JS 运行时+原生 Canvas/动画子集；生命周期跟踪（帧/计时器/interval/清理函数逆序/可见性暂停）；CDN 依赖本地化、未知脚本降级不可执行审计声明
- **安全边界 1:1**：HTML 清理（iframe/object/embed/事件属性/危险 URL）、CSS 清理（import/脚本 URL/expression）、JS 规则审查 allow/warn/refuse（refuse 覆盖 Node 模块/进程/文件系统/IPC/动态求值/构造器逃逸/file URL/特权导航）、PR 审批独立于脚本审查

### 4.3 明确边界（原版声明，照单继承）

不与 DOCX/PPTX 二进制兼容；Office 导入为语义/静态转换不保证无损；分页不追求 Word 逐像素；无法证明安全映射的区域保持原子或拒绝编辑。

---

## 5. ProjectForge 规格【已验证：README + AST 施工图 + manifest】

### 5.1 IDE 与 Git

- gpui-kit CodeEditor（20 万行+LSP+Tree-sitter）为编辑地基；工作区感知、智能目录过滤、渐进展开、Token 预算管理
- Git：git2 crate；分支管理、可视化 Branch Diff、多历史分支步进备份与安全回退、每细粒度步骤显式中止
- 编辑算子：全文件/行级 Diff/模糊 Diff/意图级函数块选取/行范围圈选/函数导航/智能回退/语法检查修复/格式规范化（置信度模糊编辑语义从 ProjectForge manifest 冻结）

### 5.2 AST 索引器（Rust 重实现）

**冻结基线事实**：原版提供 indexerClient.js、预编译 win32-x64 二进制，并包含 `rust_projectforge_indexer/Cargo.toml` 与 `rust_projectforge_indexer/src/` Rust 源码。既定决策仍是 **tree-sitter Rust 重实现**（跨平台）；理由不再使用“源码缺失”。施工图是设计参考，精确行为以冻结源码与原版可执行程序对拍为准；US-301 提取协议、降级和语言覆盖，US-319 验证。

行为目标【依据：施工图 §1；精确契约由 US-301 对照源码冻结】：

1. 区间以内容为准：读写符号时现场解析刚读到的内容，按 sha256(内容)+lang 缓存，区间与内容哈希严格对应
2. 只给确定值：AST 定义+完整区间；引用/调用链仅字面量与声明层解析，标注置信度
3. 行号契约：1 起算，基于去 BOM、CRLF/CR→LF 归一文本；不传字节偏移
4. 永远可降级：索引器缺失/协议不匹配/崩溃/超时→回退正则启发式，不阻塞施工
5. 进程独占：懒启动、stdin 关闭即退出、无孤儿进程

语言覆盖：JS/TS/TSX/Py/Rust 起步（原版 P0 五语言），C/C++/Go/Java/HTML 扩展 P1。性能参考基准（原版实测，作为目标量级）：1201 文件/47.9 万行冷扫描 578ms、热扫描 77ms、常驻 4.1MB/满缓存 65MB。Outline/FindSymbol/symbol 寻址读写/Trace 链路图按施工图 §5 冻结。

### 5.3 多 Agent 协作与工程治理

- ProJectModule 可视化：实时追踪多 Agent 后台并发编程流，vchat/groupchat 显式指挥；通知栏常规/工程双视图
- 工程 TODO 实时追踪、代码责任归属树、编程代际分支仲裁、编译测试与虚拟环境沙箱（P1）
- **KV Cache 阶段锁定**：施工期锁定记忆区系统变量，仅工程阶段推进时刷新（后端提示词管线配合，M2 注入层加锁标志）
- WorkBuddy：Agent 异步调度外部 CLI（Claude Code/Codex 等）——进程管理+输出回传（P1）
- 专属 Agent Kerr 预设资产随仓库（CC BY-NC-SA 署名）

---

## 6. 子程序第一批规格表【已验证：README 矩阵；细节 US-301 冻结】

| 子程序 | 核心功能点 | 原生实现要点 | 优先级 |
| --- | --- | --- | --- |
| VchatCLI 终端 | 持久会话、多指令流、PowerShell/WSL、一键提权 | portable-pty；gpui-kit 终端组件；提权走系统 UAC | P0 |
| 翻译中心 | 全语种互译、自然语言指定输出结构（LaTeX/CSV/MD） | 独立窗口；流式翻译；模型档位选择 | P0 |
| VNote+迷你便签 | 树状关系+双向标签、Win+Alt+Z 呼出、MD/LaTeX/Mermaid、图片粘贴转存、聊天气泡存入并同步知识库 | 全局快捷键；与 M2 知识库 API 对接 | P0 |
| 论坛 UI | 发帖/回帖/点赞/附件/交互图表 | 以 M3 US-217 论坛 API 完成为前置；gpui-kit 列表+富文本 | P0 |
| 心流锁 | 锁定 Agent+话题、AI 自主思考与主动发起、冷却时限/引导语配置 | 后端 FlowLock 协议（flowlockProtocol.js 冻结）| P0 |
| Tavern 预设 | 角色卡/预设/世界书挂载、深度/相对注入、拖拽排序、提交副本隔离 | §3 | P0 |
| 插件管理中心 | 配置热更监控、README 阅读、JevCall 权限声明 | M3 admin_api 对接 | P0 |
| 人类工具箱 | 分布式插件自动转 GUI 表单、流程条件/数据转换编排 | manifest→表单生成器（configSchema 驱动） | P0 |
| Memo 记忆中心 | 神经云图拓扑可视化、批量编辑/合并记忆 | M2 内核诊断数据→GPUI 图绘制 | P1 |
| 灵视监控 | CoT/回忆触发/拓扑寻道/Agent 私信/后台任务实时窗 | WS VCPLog/VCPInfo 消费 | P1 |
| VchatManager | AppData 一致性校验修复、JSON 深编辑、附件浏览、全局检索 | 独立窗口 | P0（US-325） |
| 深研/日报 UI | 研究军团进度、论文/报纸成品展示 | 后端驱动，前端渲染 DIV 报纸→原生富文档 | P1 |

---

## 7. 数据与文件兼容

- AppData 目录结构、话题/Agent/连接契约：**已由 C-08/C-09 冻结**（契约文档 §8/§9，勿再标「US-301 从 VCPChat 源码冻结」）；US-301 冻结笔记格式与其余前端细节；**硬验收：停写并备份后，原版 AppData 可顺序迁移使用并无损往返**（格式由代码+夹具重建，待真实客户端数据往返验证，US-018）
- .vdocx/.vpptx：§4.1 容器 1:1；验收用原版工程文件（含资源/文脉/岛）打开-编辑-保存-原版 reopen 往返
- 表情包/主题/壁纸资产目录兼容（资产文件原样复用）

---

## 8. 结构增量（文件级）

```
omnia/crates/omnia-app/src/
├── render/
│   ├── stream_guard.rs      # 三维校验+代次
│   ├── two_phase.rs         # 预览-终稿提交
│   ├── viewport.rs          # 涟漪+滑动窗口+冻结
│   ├── prelayout.rs         # 高度缓存+滚动锚定
│   └── islands.rs           # 消息边界隔离
├── chat/                    # 多标签/多窗口/Agent 管理/表情包修复
├── scriptorium/
│   ├── container.rs         # v2 ZIP+资源寻址
│   ├── compiler.rs          # vdoc-hybrid-compiler/3
│   ├── transaction.rs       # expected 事务引擎
│   ├── lineage.rs           # 文脉+快照+回溯
│   ├── pr.rs                # PR 协议+双 diff
│   ├── agent_port.rs        # 17 命令端口
│   ├── pagination.rs        # 分页器
│   ├── flow_editor.rs       # 渲染态编辑（P1）
│   └── island_runtime.rs    # 岛适配层（P1）
├── projectforge/
│   ├── ide.rs / git.rs
│   ├── indexer/             # tree-sitter 重实现（冻结源码/施工图映射）
│   ├── flow_monitor.rs      # 多 Agent 编程流
│   └── governance.rs        # TODO/责任树/KV 锁（P1）
├── app_registry.rs          # 清单、编译期工厂与生命周期（US-329）
├── frontend_host.rs         # 能力句柄与受限扩展点（US-329/US-330）
└── apps/                    # §6 子程序，每个独立模块+无头测试
```

新增依赖：zip（容器）、git2、tree-sitter + 各语言 grammar、portable-pty、image（替代 sharp）、**gpui-shell 优先**（岛，P1；M0 实测不通过则 deno_core 回退，见架构 §9 / 前端框架选型 §5.2）。

---

## 9. 验证计划

1. **文件往返**：原版 .vdocx/.vpptx（含岛/资源/文脉）→ GPUI 打开-编辑-保存 → 原版 reopen 校验；AppData 停写、备份后顺序往返，禁止双写
2. **协议对拍**：原版 ScriptoriumCollaborator/ProjectForge 插件（Node）驱动 GPUI 前端，17 命令+PR 全流程逐字段对拍；交叉组合按前端承载端/后端调用端分别记录，避免混淆插件调用方与被调用端
3. **事务安全**：过期 expected/哈希不符/跨原子边界/修订冲突四类拒绝用例；IME 合成期并发编辑用例
4. **渲染行为**：§2 六机制逐项用例（含万条消息滚动、迟到 chunk 拒写、上翻不被拉回）
5. **索引器对拍**：同一代码库，重实现索引器 vs 冻结源码构建或随基线发布的 exe（Windows）符号区间/行号 diff；降级路径用例
6. **子程序逐个验收**：每个子程序对照原版功能清单走查（正常+异常路径），产出验收记录

---

## 10. 用户故事（按依赖排序）

**US-301 M4 契约冻结**：使用已冻结 commit，不再重复冻结基线。基础数据遵守 C-08/C-09；提取笔记格式、表情包修复、按钮回调、Tavern/FlowLock、索引器协议与岛适配范围，冻结 AppRegistry 清单/工厂/生命周期和 FrontendHost 能力边界，形成〔待产出〕docs/m4-spec.md（M4-C-xx 命名空间；交付规则见使用与维护 §4）。

验收：按 SC-04/SC-05/SC-06/SC-07/SC-08/SC-10 逐项核对原版模块、用户流程、后台依赖、持久化及异常路径，分配实施 US 与验收；工程多 Agent 流必需的群聊调用路径先于 US-320 冻结并具备。缺少详规的群聊/图表/任务面板/日志/提示词编辑/主题/Canvas 等仍属于最终范围，不能凭一个目录映射算已完成。

**US-302 渲染引擎：竞态与提交**：验收：三维校验+双阶段提交用例全过（切话题/重发/未闭合结构）。

**US-303 渲染引擎：视口与冻结**：验收：涟漪+滑动窗口+离屏冻结用例；万条消息滚动与冻结态占用报告。

**US-304 预排版与滚动锚定**：验收：§2.1 行为逐项用例；上翻不被拉回；缩放重算性能报告。

**US-305 多标签与独立窗口**：验收：话题拆分/拖拽成窗/窗口间状态一致/迟到数据不串线。

**US-306 Agent 管理与表情包修复**：验收：管理操作全集；404 表情包模糊修复用例；交互按钮回调对拍。

**US-307 Scriptorium 容器**：验收：原版 .vdocx/.vpptx 打开+资源哈希校验+原子保存+往返一致。

**US-308 混合编译器**：验收：保护区域识别、编辑索引全字段、token 级切分用例；与原版编译产物对拍（固定文档集）。

**US-309 事务引擎**：验收：四类拒绝+正常提交+局部修补+光标恢复用例。

**US-310 源码/CSS 工作面**：验收：CodeEditor 直连真源、实时诊断、document-css/deck-css 独立编辑。

**US-311 PR 与文脉**：验收：双重修订校验、幂等、target 重定位、双 diff、自动允许策略、回溯不删未来，逐条用例。

**US-312 Collaborator 端口**：验收：17 命令按 manifest v3.3 对拍；串行/partial_failure；CreateProject 七步+覆盖 SHA-256 校验。

**US-313 阅读渲染与导出**：验收：分页行为对齐（§4.2）；导出 HTML 自运行（浏览器打开验证）；溢出警告。

**US-314 渲染态编辑（P1）**：验收：不变量校验、IME 全生命周期、语法显隐、格式变换走源码事务。

**US-315 岛适配层（P1）**：验收：稳定 ID 保留、生命周期释放、JS 子集执行、3D/WASM 降级声明、安全审查 1:1。

**US-316 VPPTX（P1）**：验收：场景模型、1 起算页码、放映预览、页面 PR。

**US-317 高级样式与 SVG、图表公式、PDF 导出（P1）**：验收：样式包导入导出/内置只读、SVG 资产清洗配额/ID 重写/自包含快照；Mermaid/KaTeX 原生子集与超出子集的已登记降级；PDF 导出按 US-301 冻结范围对拍。

**US-318 ProjectForge IDE+Git**：验收：编辑算子清单、分支 diff/回退、步骤中止。

**US-319 AST 索引器**：验收：施工图五原则逐项；五语言符号区间对拍（vs 原版 exe）；降级路径；性能报告。

**US-320 多 Agent 编程流**：验收：并发流可视化、显式指挥、双视图切换。

**US-321 工程治理（P1）**：验收：TODO/责任树/KV 阶段锁（后端联动）/WorkBuddy 外部 CLI。

**US-322 终端**：验收：持久会话、PowerShell/WSL、提权、断线恢复。

**US-323 翻译+笔记**：验收：§6 功能点逐项；知识库同步对拍。

**US-324 论坛+心流锁+Tavern**：前置 US-217 论坛 API 已完成；验收：§6 功能点；提交副本隔离用例。

**US-325 插件管理+人类工具箱+VchatManager**：验收：manifest→表单生成、热更监控、AppData 校验修复。

**US-326 Memo UI+灵视（P1）**：验收：拓扑可视化、批量记忆编辑、实时监控窗。

**US-327 深研/日报 UI（P1）**：验收：进度与成品渲染。

**US-329 AppRegistry 与内置清单化（P0）**：依赖 US-301。验收：window/embedded/kernel-ext 的编译期工厂与清单一一对应；托盘、Dock、启动台、启停入口统一消费注册表；FrontendHost 能力句柄取代跨模块全局访问；生命周期和状态持久化、无效清单/重复 ID/异常卸载有用例；不开放第三方任意原生动态库。各子程序集成以此为前置。

**US-330 脚本与受限扩展点试点（P1）**：依赖 US-007 的运行时验证结果、US-301 契约及 US-329。验收：选定试点验证 ChatInterceptor/ComposerExtension/MessageRenderer 边界、script 清单/能力授权、热加载与卸载、故障恢复和资源回收；沿用已批准的 gpui-shell 优先及回退分支，输出 M5 推广或回退依据。延期进入 SC-16；后续依赖此运行时的任务须先取得验证结果。

**US-328 M4 集成验收**：验收：§9 对应 P0 的文件、协议、行为门禁与 US-329 通过；首批 P0 子程序验收记录齐；P1 功能与文件往返的保留/降级边界单列，不以未完成的 VPPTX 放映等能力签署已兼容；承接记录齐全后签署 M4 阶段 DoD。

每个 US 遵守[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)的通用检查与交付审查；另须完成本文对应无头 UI、协议和文件往返用例。

---

## 11. 安全与异常路径

- Scriptorium 八道防线 1:1（§4.2）；脚本审查关闭须人类二次确认，且不关闭 CSP 类比约束/依赖本地化/PR 审批
- 岛运行时资源配额：帧/计时器数量上限、离屏强制暂停、关闭文档全量释放（泄漏检测用例）
- 终端提权：仅系统原生 UAC 路径，不自造提权；危险命令提示对齐原版
- 索引器崩溃：降级正则路径必须无感；子进程 stdin 关闭即退出
- 大文档：分页/编译超时保护，失败保留上一可用渲染
- 多窗口状态：单一真源+事件投影，窗口崩溃不丢未保存事务（事务日志）

## 12. 完成定义（DoD）

- P0 全部 US（含 US-329）验收通过；P0 范围文件往返与协议对拍零差异，未实现 P1 内容的源码/资源必须保留
- 原版 AppData 与文坊容器按 P0 范围可读写往返；VPPTX 场景编辑/放映等 P1 功能另行验收。原版后端插件可驱动 GPUI 前端完成 P0 文坊 PR 与工程施工闭环
- §6 所列 P0 子程序逐个验收记录发布；AppRegistry/FrontendHost 有集成证据
- 交付：渲染引擎 V4 行为版 + Scriptorium 核心 + ProjectForge 核心 + 子程序第一批 + 注册表与宿主 + m4-spec.md + 对拍报告
- P1/P2 按 SC 清单与 M5 对应 US 承接；本阶段出口不等于最终 1:1 完成

## 13. 风险

| 风险 | 对策 |
| --- | --- |
| Scriptorium 渲染态编辑是全场最难点 | P0 先交付源码工作面+完整事务/PR 闭环，渲染态编辑 P1 独立攻坚；不变量不满足宁可拒绝 |
| 索引器重实现产生行为漂移 | US-301 对照现有源码与施工图冻结契约，US-319 逐语言对拍 |
| 岛生态断点 | 已声明降级策略；存量文档源码/身份保留，运行时子集渐进扩大 |
| gpui-kit 组件缺口（终端/图表/分页） | US-301 盘点缺口；自研收敛在 ui_adapter 内；必要时向 gpui-kit 上游提 PR |
| 子程序数量多、长尾碎 | 每个子程序独立模块与验收；P0 不能跳过，P1/P2 延期须有 SC 承接及最终验收证据 |
| VCPChat 上游迭代快 | commit 冻结+changelog diff 流程（同 M0 机制） |

---

## 14. 修订记录

- v1.4（2026-11-12）：通用检查与审查引用代码质量规范，保留 UI 与阶段专属验证。
- v1.3（2026-11-12）：纠正索引器源码事实，保留重实现选择；拆开 Canvas 工作台与文坊白板；补齐注册表/宿主和脚本试点 US，统一优先级与前置依赖，明确 P0/P1 文件能力边界。

内容由 AI 生成
