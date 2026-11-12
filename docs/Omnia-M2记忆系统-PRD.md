# Omnia · M2 记忆系统 PRD v1.4

> 本文件定义 M2 阶段目标，产品尚未实现。M0M1 精确契约见协议契约；M2 专项契约由 US-101 产出后成为本阶段定义源。既定技术选型不变。

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v1.4 / 2026-11-12（接入代码质量约束）/ **部分冻结** |
| 适用阶段 | M2；剩余【待冻结】由 US-101 滚动冻结，未冻结禁止实现（见 `README.md` §5.2） |
| 范围对应 | 后端模块见 `docs/Omnia-复刻范围与对应矩阵.md` §3.3；创新/偏差见其 §6.2、§6.3 |
| 1:1 基线 | VCPToolBox commit `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c`（与 M0M1 PRD 同基线；事实引用须逐条核验，不能从文件 diff 未变推定描述正确） |
| 前置依赖 | M0M1 PRD 的 US-001~022 完成（协议循环、插件引擎、交叉验证脚手架） |
| 源码位置 | `D:\code\github\VCPToolBox`（本地仓库，行号以冻结 commit 为准）：RiverMemoEngine.js、TagMemoEngine.js、TagMemoV10Engine.js、KnowledgeBaseManager.js、TDBKnowledge.js、EmbeddingUtils.js、TextChunker.js、ResultDeduplicator.js、modules/contextManager.js、foldProtocol.js、**rust-vexus-lite/（Rust 内核完整源码 + 契约测试）**、docs/MEMORY_SYSTEM.md、RIVERMEMO_TOPOLOGY_V3.md、RIVERMEMO_RRF_SCORE_CONTRACT.md、TVStxt/Dailynote.txt、RAGDiaryPlugin 与 LightMemo manifest、日记格式样本 |
| 事实标注 | 【已验证】= 基线源码/文档逐行确认；【待冻结】= M2 启动时从本地源码提取补齐，未冻结禁止实现；【设计】/【偏差】/〔待产出〕定义见 `README.md` §5.2 |

### 0.1 范围调整（相对架构设计文档）

1. **direct/hybridservice 插件协议从 M3 提前到 M2**：RAGDiaryPlugin 与 LightMemo 均为 `pluginType: hybridservice`、`communication.protocol: direct`（原版为 Node 进程内模块）。Omnia 由侧车承接原 JS 接口，Rust 原生记忆路径由 omnia-memory 实现，二者的选择和对应由 US-101 冻结【已验证：两插件 manifest】
2. M0M1 PRD 中"日记提取后处理"更正为：**日记写入主要经 DailyNote 工具调用完成**（模型在回复末尾主动落笔，archery no_reply），不是服务端自动抽取【已验证：TVStxt/Dailynote.txt】
3. JEV 语义决策服务：两插件 `requiresJevClient: true`，但 `JevAdvancedRerank` 默认 false。M2 实现 JEV 客户端接口占位（不可用时走传统 Rerank/无重排路径），完整 JEV 集成列 P2

### 0.2 版本口径声明（重要）

docs/MEMORY_SYSTEM.md 标注 VCP 6.4（2026-02-13），其"浪潮 V3.7 + EPA + SVD"算法描述为 **JS 层旧实现口径**；rust-vexus-lite/README.md（2026-10-29）确认当前基线热路径已下沉 Rust 内核：**AGS 统一几何已取代 SVD**，RiverMemo 拓扑 V3 + TDB 2-bit 检索 + Spike 有界传播 + 动态虫洞为现行算法。本 PRD 规定：**内核源码与 RIVERMEMO_TOPOLOGY_V3.md 为算法权威**；MEMORY_SYSTEM.md 仅作为编排层（索引管道、Schema、参数、标签提取）规格参考，两者冲突时以基线代码为准。禁止混用两个时期的算法描述。

---

## 1. 范围与优先级

### P0（M2 必须）

1. vexus-lite 内核原生集成（去 N-API，作为 Rust crate 直接编译进后端）
2. 知识库索引管道：文件监听 → 批处理 → 分块 → Embedding → SQLite 事务 → 向量索引 → 共现矩阵
3. 日记工具链：DailyNote create/update、日记文件格式、Tag 有序语义
4. 被动记忆通道（RAGDiary）：占位符门控 + 召回 + 生成前注入
5. 主动记忆通道（LightMemo）：显式回忆工具
6. RRF 评分契约遵循（ranking_score / final_score 分离）
7. 记忆行为 diff 验证装置（固定语料 + 固定查询 + 对拍原版）

### P1

Rerank 服务集成、DailyNoteManager（list/organize/associate）、DailyNoteSearcher（BM25/正则）、rag_params.json 热调控、联想锚定 `[@x]`/`[@!x]` 解析、上下文折叠协议（foldProtocol.js）接入

**IN-2 记忆本地自治（创新条目，架构 §1.3；层归属 = 实现层 + 扩展层，与范围矩阵 §6.3 一致）**：本地 embedding/rerank 模型后端（candle/ort，如 bge-m3 类小模型）属**扩展层 opt-in、默认关闭**；去 JS 编排层与 N-API 边界属**实现层优化**，由 US-102 实现；是否减少复制及降低延迟须测量，不能由 vendoring 自动推导。本地模型加载和语料索引准备齐全后，目标是相应记忆计算可离线运行、减少外部 API 调用。约束：向量维度锁定与换模型全量重建机制不变（§5 第5项）；对拍验收仍用固定外部模型保证可比性，本地模型单独出精度/时延报告。偏差登记 **DV-12**（范围矩阵 §6.2）：原版依赖外部 API → Omnia 可选本地供给，召回行为目标不变；启用条件 = 用户 opt-in 本地模型，回退 = 恢复与原模型/版本/维度匹配的索引快照，或使用外部模型全量重建后切回；相同维度也不意味着向量可比，验收 = 固定外部模型行为 diff 为零 + 本地模型精度/时延报告。

### P2

JEV 高级重排完整集成、四轨实验室、TDB 冷知识库（TDBKnowledge.js）、音乐日记跨设备同步、AdminPanel 记忆调参面板（SC-01）。JEV/TDB/四轨/同步由 SC-12、US-101/US-401 补齐规格并经 US-427 核验，不因 P2 排除出最终范围。

P1 如延期，必须登记 SC-16 的承接任务；US-118 阶段验收不替代 US-426 最终验收。

---

## 2. 记忆架构规格

### 2.1 内核五层【已验证：rust-vexus-lite/README.md】

| 层 | 职责 |
| --- | --- |
| SQLite 权威事实层 | 正文、原始 FP32 向量、有序 Tag 事实、版本、操作回执、派生资产元数据 |
| TDB 2-bit 冲程检索 | 紧凑位码图导航/全局扫描出候选，再读原始向量精排（crates/vcp-tdb-index） |
| AGS 统一背景场 | 原空间重正交化统一几何：局部残差/锚增益 + 全局星团主题面（取代旧 SVD） |
| Spike 有界传播 + 请求级动态虫洞 | 沿共享传输图传播，深层残差为历史边提供请求级动态席位，形成节点势 + 实际边流河网 |
| RiverMemo 双场 + 统一泛函 | 局部场/迁移场求解，共享选点预算投影，有序 Tag 曲线 + 相对拓扑统一裁决（Ω 泛函） |

### 2.2 双通道【已验证：README + manifest】

| 通道 | 触发 | 入口 |
| --- | --- | --- |
| RAGDiary 被动 | 消息预处理阶段，按记忆占位符声明 + 对话语义 + 门控条件唤起，生成前注入 | Plugin/RAGDiaryPlugin（hybridservice/direct） |
| LightMemo 主动 | Agent 显式工具调用，给定查询与范围 | Plugin/LightMemo（hybridservice/direct） |

门控原则：无占位符声明的普通请求直接跳过记忆管线；召回受日记本作用域与排除目录约束（LightMemo `EXCLUDED_FOLDERS` 默认 `已整理,夜伽,MusicDiary`）【已验证】。不是无条件全库召回。

### 2.3 编排层（JS → Rust 移植对象）

KnowledgeBaseManager（双索引：diaryIndices Map 每日记本独立 + 全局 tagIndex 容量 50000）、TextChunker（cl100k_base）、EmbeddingUtils（OpenAI 兼容批量）、ResultDeduplicator、共现矩阵、rag_params 热调控。算法热路径不在移植范围——内核原样复用。

---

## 3. 内核集成规格

### 3.1 集成方式

- vendoring：`rust-vexus-lite/` 与 `crates/vcp-tdb-index` 整体纳入 workspace（记录基线 commit，禁止顺手升级）
- crate-type 由 `cdylib` 改为 `rlib`（保留 cdylib 可选用于对拍工具）；N-API 导出层剥离策略：napi 依赖移入 feature gate，核心逻辑不依赖 napi【待冻结：US-101 评估 lib.rs 耦合度后定剥离方案】
- 工具链按仓库 rust-toolchain.toml 锁定

### 3.2 依赖基线【已验证：Cargo.toml】

tokio 1（full）、bincode 1.3、reqwest 0.12（rustls）、serde 1、serde_json 1（**float_roundtrip 必须保留**：artifact 反序列化要求比特级一致）、base64 0.21、sha2 0.10、md5 0.7、regex 1.13、tiktoken-rs 0.12.1（cl100k_base，与 TextChunker.js 对齐）、flate2 1.0、memmap2 0.9、bytemuck 1、hashbrown 0.14。

### 3.3 内核契约测试（集成后必须全绿）

- `cargo test --manifest-path rust-vexus-lite/Cargo.toml --lib`
- RRF 评分契约：tests/fixtures/rrf_score_contract.json（合成可执行输入）+ rrf_real_output_evidence.json（85 组 ABBA 输出证据）【已验证：RIVERMEMO_RRF_SCORE_CONTRACT.md】
- 注意：证据数据集是**输出证据而非重放输入**，不能独立复现图观测；行为对拍须自建固定语料（§10）

### 3.4 API 映射

以 index.d.ts（483 行）+ index.js 导出为 API 面权威，US-101 产出「N-API 函数 → Rust 直调」映射表。关键类型【已验证】：MemoPipelineResult{metadataJson, enhancedVector}、GeometryResult{artifactSig, configHash, algorithmVersion, ...}、NativeKnowledgeRuntimeStats、RegisteredDiaryIndexState。句柄语义：完整 Observation/双场/投影保留在内核 MemoRuntime，上层只拿句柄 + 诊断摘要 + 增强查询向量——Rust 直调后此边界保持不变（不要为省事把内核状态摊平到后端）。

---

## 4. 数据层规格

### 4.1 物理布局【已验证：MEMORY_SYSTEM.md §2.2】

```
VectorStore/
├── knowledge_base.sqlite
├── index_global_tags.usearch      # 全局 Tag 索引（容量 50000）
├── index_diary_{md5(日记本名)}.usearch
dailynote/<日记本名>/<时间戳文件名>.txt
```

### 4.2 SQLite DDL【待冻结：US-101 复核内核 Schema】

> **2026-11-12 引用核验更正**：原标注「【已验证：KnowledgeBaseManager.js:166-206，WAL】」失配——冻结基线中该文件 166-206 行是配置解析逻辑，全文件无 `CREATE TABLE`；`TDBKnowledge.js:128-170` 虽有 WAL 与 `files`/`chunks` 表，但字段（library / doc_node_id / ingest_queue）与下表不同。下表仅为待核候选，**不得据此新建平行事实库或标【已验证】**。事实与索引由 vendored 内核拥有，omnia-memory 管理句柄，omnia-knowledge 通过适配层调用；由 US-101 从内核 Schema 核定字段、事务边界与迁移规则后转正。

```sql
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  diary_name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector BLOB,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  vector BLOB
);
CREATE TABLE IF NOT EXISTS file_tags (
  file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (file_id, tag_id),
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
-- kv_store（EPA/几何缓存等）结构【待冻结：US-101 从基线代码提取】
```

### 4.3 日记文件格式【已验证：样本 + Dailynote.txt】

- 文件头：`[YYYY.MM.DD] - <Maid名>`，正文以 `[HH:MM]` 标记聊天时间演进
- Tag 为 Content 必需尾行（`Tag: a, b, c`），或作为独立字段提供（覆盖 Content 内 Tag 行）
- **Tag 顺序即语义**：有序河道曲线，检索时逐段读取——写入、存储、召回全链路禁止重排/去重乱序
- 文件名：默认时间戳自动生成，可自定义；一事一记，update 更新同篇
- 知识类日记结构骨架（核心概念/简明释义/关键原理/应用场景/关联节点/反思与洞察/信源出处）为提示词引导，非格式校验项

### 4.4 标签提取规则【已验证：KnowledgeBaseManager.js:1206-1230】

- 行匹配：`/Tag:\s*(.+)$/gim`（多行）
- 分隔符：`[,，、;|｜]`；去尾部 `[。.]+`；Embedding 预处理；`[EMPTY_CONTENT]` 过滤；黑名单过滤；去重（提取集合层面去重，曲线顺序在召回链路保留）

### 4.5 共现矩阵 SQL【已验证：KnowledgeBaseManager.js:1233-1258】

```sql
SELECT ft1.tag_id AS tag1, ft2.tag_id AS tag2, COUNT(ft1.file_id) AS weight
FROM file_tags ft1 JOIN file_tags ft2
  ON ft1.file_id = ft2.file_id AND ft1.tag_id < ft2.tag_id
GROUP BY ft1.tag_id, ft2.tag_id;
```
对称填充内存 Map；批处理完成后异步重建。

---

## 5. 索引管道规格【已验证：MEMORY_SYSTEM.md §8 + 附录 A】

1. 监听：notify crate 对齐 chokidar 行为（add/change/unlink；忽略隐藏目录；启动全扫描可配）
2. 过滤：仅 `.md/.txt`；IGNORE_FOLDERS（默认 VCP论坛）、IGNORE_PREFIXES（默认 已整理）、IGNORE_SUFFIXES（默认 夜伽）
3. 批处理：固定收集窗口 KNOWLEDGEBASE_BATCH_WINDOW_MS=1000（后续文件不重置截止）、KNOWLEDGEBASE_MAX_BATCH_SIZE=50
4. 分块：TextChunker 语义（cl100k_base，tiktoken-rs）；分块边界规则【待冻结：US-101 对拍 TextChunker.js】
5. Embedding：OpenAI 兼容批量接口；模型与维度锁定（VECTORDB_DIMENSION 默认 3072）；**换模型必须全量重建索引，不同模型向量不可比**
6. 事务写入：tags/files/chunks/file_tags 单事务；先删旧向量再加新向量
7. 索引保存延迟：日记本 120000ms、全局 Tag 300000ms（KNOWLEDGEBASE_INDEX_SAVE_DELAY / TAG_INDEX_SAVE_DELAY）
8. 每日记本独立索引懒加载，索引名 `diary_{md5}`；单索引损坏不影响其他（故障隔离）

---

## 6. 召回与注入规格

### 6.1 被动通道（RAGDiary）

- 占位符门控：Agent 系统提示词声明记忆占位符才启用；注入发生在模型生成前（消息预处理阶段）
- 占位符清单、注入文本模板、门控条件细节在 RAGDiaryPlugin.js（未提取，1382+ 行）——【待冻结：US-101 首要任务】
- 召回走内核 MemoPipeline；可选 Rerank：RerankMultiplier 默认 2.0（前 K 放大）、RerankMaxTokensPerBatch 默认 30000【已验证：manifest】

### 6.2 主动通道（LightMemo）

- 工具声明与参数（查询、范围、k、minScore 等）从 LightMemo.js 冻结【待冻结】
- EXCLUDED_FOLDERS 默认 `已整理,夜伽,MusicDiary`；原生过滤全局 TDB-SM 检索 + RiverMemo V3【已验证：manifest description】

### 6.3 RRF 评分契约（硬约束）【已验证：RIVERMEMO_RRF_SCORE_CONTRACT.md】

- `ranking_score` = 多路由**最大值** RRF（非求和）+ Omega 门控；所有路径（含早退）从 `final_score` 初始化 ranking_score
- `final_score` = 候选自身裁剪后的基线分量和，虫洞不改写它
- **输出数组顺序是检索顺序的权威**；score 不保证单调递减；TimeDecay 等显式后处理器可按自身策略重排
- 禁止：额外虫洞质量加分、分数重指派、按 score 排序替代按 ranking_score 稳定排序（平局保持基线序）

---

## 7. 日记工具链规格【已验证：TVStxt/Dailynote.txt】

### 7.1 DailyNote 工具

- create：`maid`（男性 Agent 用 `valet`，镜像逻辑以 M1 契约为前置）、`command:create`、`Date`、`fileName?`、`folder?`（缺省写角色默认索引）、`Content`（含 Tag 尾行）、`archery:no_reply`
- update：`command:update`、`folder?`、`target`（需替换原句，≥15 字保证唯一）、`replace`、`archery:no_reply`
- Content 常经 `「始ESCAPE」` 转义域传入（由 M1 解析器契约承接，待实现验证）
- 写入后进入索引管道（§5），Tag 曲线顺序保真

### 7.2 管理与检索工具（P1）

- DailyNoteManager：list（folder/startDate/endDate）、organize（urls 多行相对路径 + 归档总结，旧日记归档至[已整理]）、associate（种子路径多行、range、k 默认 10、minScore 默认 0.65）
- DailyNoteSearcher：query（关键词/正则）、folder、mode:bm25、bm25_limit 默认 10、is_regex、context_lines

### 7.3 联想锚定（P1）

- 回复任意位置（工具调用除外）的 `[@概念]` 分支锚点与 `[@!概念]` 核心锚点；解析后写入会话内联想拓扑，影响下一次浪潮召回
- 精确解析与存储规则【待冻结：从基线 associativeDiscovery.js 提取】

### 7.4 提示词资产

TVStxt/Dailynote.txt、MemoToolBox.txt 逐字纳入仓库资产（CC BY-NC-SA 署名要求），禁止改写后冒充原版。

---

## 8. 热调控规格【已验证：MEMORY_SYSTEM.md §7】

rag_params.json 文件监听热加载；参数默认值：activationMultiplier [0.5,1.5]、dynamicBoostRange [0.3,2.0]、coreBoostRange [1.20,1.40]、deduplicationThreshold 0.88、techTagThreshold 0.08、normalTagThreshold 0.015、languageCompensator.penaltyUnknown 0.05、penaltyCrossDomain 0.1。注意：这些参数作用于 JS 编排层旧算法路径；内核侧调参面以 index.d.ts / RiverMemoV3ControlPanel 为准【待冻结：US-101 核对哪些参数仍生效】。

---

## 9. Rust 结构（文件级，增量）

```
omnia/crates/
├── vexus-lite/               # vendored 内核（基线 commit 锁定，rlib，保留原名）
│   └── crates/vcp-tdb-index/ # vendored 子 crate，保留原名
├── omnia-knowledge/src/
│   ├── store.rs              # 经 memory 句柄访问内核事实库；不自行建平行 Schema
│   ├── chunker.rs            # cl100k 分块（对拍 TextChunker.js）
│   ├── embedding.rs          # 批量 Embedding 客户端
│   ├── pipeline.rs           # §5 监听/批处理/事务/索引更新
│   ├── tags.rs               # §4.4 提取 + §4.5 共现
│   └── params.rs             # §8 热调控
├── omnia-memory/src/
│   ├── runtime.rs            # 内核句柄管理（§3.4 边界）
│   ├── passive.rs            # RAGDiary 门控+注入
│   ├── active.rs             # LightMemo 工具
│   ├── ranking.rs            # §6.3 契约 + TimeDecay 钩子
│   └── rerank.rs             # 可选 Rerank 客户端
└── omnia-plugin/src/direct.rs  # Node 侧车 direct/hybridservice 兼容宿主（M3 提前项）
plugins-native/dailynote/     # DailyNote/Manager/Searcher 原生实现
contract/memory/              # 固定语料 + 查询集 + 对拍录制
```

---

## 10. 行为 diff 验证计划

1. **内核层**：§3.3 契约测试全绿（含 RRF 合成输入与 85 组输出证据复核）
2. **分块对拍**：固定文本集，Rust chunker 与 TextChunker.js 输出逐块 diff（边界、token 数）
3. **召回对拍**：自建固定语料（≥200 篇合成日记，覆盖 Tag 曲线/多日记本/排除目录场景）+ 固定 Embedding 模型 + 固定查询集（≥50 条）；原版服务与 omnia-server 各自建索引，比对：召回 ID 顺序（权威）、注入文本、诊断摘要。**不使用原版私有语料**（未发布），合成语料随仓库发布
4. **注入对拍**：相同对话前缀下，被动通道注入的系统提示词片段逐字 diff（模板冻结后）
5. **端到端**：聊天中 DailyNote 落笔 → 索引 → 新会话召回注入 → 回复引用记忆，四象限矩阵扩展记忆场景
6. 随机性控制：Embedding 固定模型、温度 0；内核确定性由 float_roundtrip + 契约测试保障；仍存浮点平台差异时记录容差并标注

---

## 11. 用户故事（按依赖排序）

**US-101 M2 契约冻结**
验收：提取 RAGDiaryPlugin.js/LightMemo.js/DailyNote 插件源码；产出 N-API→Rust API 映射表、原生/侧车选路规则、注入模板与门控规格、占位符清单、内核 Schema 与事务边界、分块边界规则、联想锚定及折叠协议、内核调参面核对表；〔待产出〕docs/m2-spec.md 评审通过（含 §4.2 DDL 出处核定）。SC-12 中本阶段负责的后台能力逐项形成契约或明确承接 US，不能以“降级”删除最终功能。

交付与转正规则见使用与维护 §4；M2 契约使用 M2-C-xx 命名空间。待冻结清单为 §3.1 N-API 剥离、§3.4 API 映射、§4.2 Schema/kv_store、§5 分块、§6 门控/模板/参数、§7.3 锚定、§8 调参及折叠协议。仅阻止依赖该规则的实现。

**US-102 内核 vendoring + 去 N-API**
验收：rlib 编译进 workspace；napi 剥离不触碰算法代码（diff 审查）；§3.3 测试全绿；基线 commit 记录在案。

**US-103 存储层**
验收：通过 memory 句柄操作内核事实库；Schema/WAL/kv_store 以 US-101 冻结结果为准；事务回滚、旧库兼容和适配层职责用例，禁止额外维护平行事实库。

**US-104 分块 + Embedding**
验收：分块对拍 diff 为零（固定文本集）；批量 Embedding 客户端含重试/维度校验；换模型触发重建警告。

**US-105 索引管道**
验收：§5 八条逐项用例；监听增删改 → 索引一致性；忽略规则；批窗口不重置行为用例。

**US-106 索引生命周期**
验收：懒加载、保存延迟、单索引损坏隔离（损坏一个日记本不影响其余检索）。

**US-107 direct 插件兼容宿主**
验收：Node 侧车加载和调用 hybridservice/direct；由 omnia-plugin 提供 shim，依赖句柄来自对应模块；RAGDiary/LightMemo 原版 manifest 可识别、JS 挂载与原生路径分别对拍；避免重复注册/注入；侧车超时、退出和错误隔离。

**US-108 DailyNote 工具**
验收：create/update 全参数用例；target≥15 字唯一性校验；Tag 曲线顺序端到端保真；archery no_reply 静默语义与 M1 一致。

**US-109 被动通道**
验收：占位符门控（无声明跳过）；注入模板逐字对齐冻结规格；召回走内核句柄边界。

**US-110 主动通道**
验收：LightMemo 工具声明与参数对齐；EXCLUDED_FOLDERS 生效；TDB-SM 检索路径用例。

**US-111 排序契约**
验收：§6.3 全部硬约束逐条用例；TimeDecay 钩子可插拔；平局稳定序。

**US-112 Rerank 集成（P1）**
验收：multiplier 2.0 / 批 token 30000 语义；Rerank 不可用时降级路径有用例。

**US-113 热调控（P1）**
验收：rag_params.json 变更热生效；生效参数面按 US-101 核对表。

**US-114 DailyNoteManager（P1）**
验收：list/organize/associate 按 §7.2 参数用例；归档进[已整理]后被默认排除。

**US-115 DailyNoteSearcher（P1）**
验收：BM25/正则/上下文行数用例。

**US-116 联想锚定（P1）**
验收：[@x]/[@!x] 解析规则对齐冻结规格；锚点影响下次召回的对拍用例。

**US-117 行为 diff 装置**
验收：§10.2-10.4 对拍流水线入 CI；固定语料与查询集随仓库发布；diff 报告产出。

**US-118 M2 集成验收**
验收：§10.5 端到端通过；四象限矩阵记忆场景全绿；P1/P2 承接记录齐全；M2 阶段 DoD 签署。

**US-119 上下文折叠协议（P1）**
验收：按 US-101 从 foldProtocol.js 冻结的标记、折叠/展开、上下文恢复和异常语义对拍；延期进入 SC-16。

每个 US 遵守[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)的通用检查与交付审查；本阶段内核、记忆行为与数据兼容验证另按本文执行。

---

## 12. 安全与异常路径

- Embedding API 失败：重试后跳过该批并告警，不阻塞对话；欠账文件下次扫描补偿
- 索引损坏：单日记本隔离 + 重建入口；SQLite WAL + 事务保证事实层一致
- 隐私：事实库与日记本地持久化；使用外部 Embedding/Rerank/JEV 时，相应正文片段、查询或候选仍会传给配置的服务。本地存储不等于全流程离线；启用界面与部署文档须说明发送内容和目的端。日志脱敏；对拍用合成数据
- 密钥：Embedding/Rerank Key 按原配置归属放入全局 config.env 或插件目录 config.env，级联见 C-06；禁止日志明文
- 内核 panic 防护：句柄调用边界 catch_unwind + 降级为无记忆回答（明确告知），不崩服务

## 13. 完成定义（DoD）

- P0 全部 US 验收通过；内核契约测试常态化 CI
- 固定语料召回顺序对拍达标（顺序一致率阈值在 US-101 依据基线波动实测设定，不预设虚假精度）
- 原版 dailynote/ 在停止旧程序写入、备份后可挂载建索引；不承诺双进程共同写；原版 RAGDiary/LightMemo 配置语义兼容
- 交付：记忆子系统 + 对拍报告 + m2-spec.md + 数据/模型切换与恢复说明（使用与维护 §3–§4）
- P1 未完成项进入 SC-16；P2 进入 SC-01/SC-12。此阶段通过不代表最终范围完成

## 14. 风险

| 风险 | 对策 |
| --- | --- |
| 内核去 N-API 耦合度未知 | US-101 先评估；最坏保留 napi 兼容层编译（功能等价，体积代价） |
| 文档与代码版本漂移（V6.4 vs 10 月内核） | §0.2 口径声明：代码权威；冲突逐项记录决策日志 |
| Embedding 模型差异导致对拍失真 | 锁定同一模型同一维度；合成语料自建；容差显式标注 |
| 浮点平台差异 | float_roundtrip + 契约测试；跨平台 diff 容差记录 |
| RAGDiary 门控细节遗漏 | US-101 强制冻结，未冻结禁止 US-109 实现 |
| JEV 依赖 | 接口占位 + 基线默认关闭；完整集成归 SC-12，终验前必须补齐原有能力 |

---

## 15. 修订记录

- v1.4（2026-11-12）：通用检查与审查引用代码质量规范，保留内核和阶段专属验证。
- v1.3（2026-11-12）：统一内核事实库与模块边界、侧车与原生路径；把零拷贝改为待测收益，补充模型/索引切换与外部数据流边界；完善契约和延期承接。

内容由 AI 生成
