# Omnia 技术文档体系重构 · 设计文档

> 修订：2026-11-12 一致性修订（历史六份说明、7 步管线、IN 落地位置）。本文件为**决策存档，不是规格**；新决策按 `README.md` §7.9 另建 ADR 文件，不再追加到本文件。文中「架构设计 v2.1」指当时版本，现行版本见 `README.md` §8（v2.2）。

- 日期：2026-11-11
- 状态：**已批准**（用户于本轮对话确认"批准，按方案 A 执行"）
- 背景：omnia 项目是 VCP（VCPToolBox 后端 + VCPChat 前端）的 Rust 全栈复刻。现有六份文档存在命名脱节（VCP/vcp-rs 前缀 vs 项目名 omnia）、架构层泛泛而谈、关键契约全部推迟到未来"冻结故事"导致无法直接落地的问题。

## 1. 已确认决策

| 决策项 | 结论 |
| --- | --- |
| 命名 | 项目名 Omnia；workspace 与 crate 全套更名 omnia-*；vendored 上游内核（vexus-lite、audio-engine、vcp-tdb-index）保留原名并注明出处 |
| 完善范围 | 架构设计重写 + M0M1 深度冻结（全部【待冻结】项从本地源码转正）；M2-M5 更名与架构同步，深度冻结留待各阶段启动时滚动 |
| 基线 | 后端 VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c` + 前端 VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（均为本地当前 commit，2026-11-11） |
| 文档组织 | 新建 docs/ 目录存放修订版；历史六份草案**未随当前仓库保留**（2026-11-12 核查：仓库根仅 `docs/` 与 `brainstorming/`），本记录为唯一决策存档 |
| 组织方式 | 方案 A 三层文档法：架构（决策层）+ PRD（执行层）+ 协议契约规格（契约层）分离 |

### 基线核验结论（已验证）

- 旧冻结基线 `f23275aa` 存在于本地仓库；本地 HEAD 为 `a8560b0`（同日更新）
- `git diff f23275aa..a8560b0 -- server.js Plugin.js modules/ routes/` 仅 `modules/jevToolCallExp.js` 变化（+333/-119，JEV 实验模块，P2 范围）
- 结论：现有文档全部【已验证】结论可直接沿用，换基线零复核成本

## 2. 产出结构

```
D:\code\github\omnia\docs\
├── Omnia-架构设计.md                  ← 重写
├── Omnia-M0M1-PRD.md                  ← 重写（待冻结清零）
├── Omnia-M0M1-协议契约.md             ← 新增（核心交付，源码逐项冻结）
├── Omnia-M2记忆系统-PRD.md            ← 更名 + 同步补丁
├── Omnia-M3插件与分布式-PRD.md        ← 更名 + 同步补丁
├── Omnia-M4前端子程序与创作工程-PRD.md ← 更名 + 同步补丁（前端 commit 冻结）
├── Omnia-M5深水区功能与分发-PRD.md    ← 更名 + 同步补丁
└── 基线记录.md                        ← 新增
```

> 后续追加（本文件 §7/§8/§9）：`docs/Omnia-插件系统设计.md`、`docs/Omnia-前端框架选型.md`；2026-11-12 追加 `README.md`、`docs/Omnia-复刻范围与对应矩阵.md`。完整索引见 `README.md` §8 与架构 §16。

## 3. 各文档设计要点

### 3.1 架构设计重写

- 命名定案与 crate 映射表（vcp-* → omnia-*）
- 基线定案（双仓库 commit + diff 结论）
- 存储定案：SQLite WAL + USearch；前端 AppData 兼容 JSON（删除"候选待定"）
- 模块分解与 PRD 实际结构对齐；多 Agent/自主性归属澄清（插件 + 调度器，非独立 crate）
- 三条时序数据流：聊天 **17 步管线**（旧「7 步」描述已由契约文档 §10 更正，本行 2026-11-12 修订）、工具循环、插件 stdio 执行
- 核心 trait/类型（ModelAdapter、PluginHost、ToolExecutor、记忆内核句柄边界）、错误模型、并发模型
- 同步路线变更：direct 插件提前 M2、M5 音频 vendoring、Folia AGPL 约束

### 3.2 协议契约规格（新增，核心工作量）

从本地源码逐项冻结，每条标注出处文件与行号：

| 冻结项 | 源码出处 |
| --- | --- |
| 工具结果注入域精确排版 | modules/vcpLoop/ + chatCompletionHandler.js |
| 插件 stdin payload 精确构造 | Plugin.js executePlugin |
| 工具指令注入拼接模板 | Plugin.js |
| interrupt READY 握手状态机 | server.js + chatCompletionHandler.js |
| dotenv 特殊字符补丁语义 | modules/dotenvPatch.js |
| ShowVCP 可见性 / chatvcp 差异 | chatCompletionHandler.js |
| M1 工具审核最小语义 | toolApprovalManager.js |
| VCPChat 话题/Agent 文件格式 | VCPChat 源码取样 |

每项附正例 + 反例 fixture 描述与命名规范。

### 3.3 M0M1 PRD 重写

- 全部【待冻结】替换为对契约文档的引用
- Rust 设计细化到签名级：pub 类型、关键函数签名、错误枚举、异步边界
- US-006 从"录制冻结"改为"fixture 实现 + 对拍验证"
- 前端补 ChatKernel 状态结构、SSE 消费任务、竞态三元组设计

### 3.4 M2-M5 同步补丁（内容深度不变）

标题/命名/基线/源码路径改指本地仓库；M4 前端 commit 冻结；剩余【待冻结】保留并标注"该阶段启动时滚动冻结"。采用复制 + 定点编辑，保留原文实质内容。

### 3.5 基线记录

双仓库 commit、冻结日期、diff 结论、上游跟进流程。

## 4. 执行顺序

基线记录 → 协议契约（源码精读，并行提取）→ 架构设计 → M0M1 PRD → M2-M5 同步。每份 AI 生成文档末尾附合规标识。

## 5. 审批记录

- 四项关键决策：用户经澄清卡确认（Omnia 全套更名 / 架构重写+M0M1 深度冻结 / 本地当前 commit / 新建 docs/ 重组）
- 方案 A 设计：用户明确批准（"批准，按方案 A 执行"）
- 下一步：按第 4 节顺序执行文档产出（本任务交付物即文档，无代码实现）——**已完成**，产出见 `README.md` §8；本记录自此转为存档，不再追加新决策

## 6. 后续决策：创新定位（2026-11-11 同日追加）

用户问"不止借鉴，是否能创新"，经澄清卡确认：**复刻为基，创新为显式目标**。

落地为架构设计 v2.1 §1.3 三层分治框架（协议层 1:1 硬约束 / 实现层自由创新行为 diff 验收 / 扩展层 opt-in 偏差声明），四个创新方向立项：

| 编号 | 方向 | 层 | 落地文档 |
| --- | --- | --- | --- |
| IN-1 | 渲染引擎重设计（保留行为目标，不复刻 DOM 式六套机制） | 实现层 | M4 PRD §2.0 |
| IN-2 | 记忆本地自治（本地 embedding/rerank opt-in + 零拷贝编排） | 实现层+扩展层 | M2 PRD §1 P1 |
| IN-3 | 插件能力沙箱（WASM + manifest 能力声明） | 扩展层 | M3 PRD §1 创新条目 |
| IN-4 | 工具协议双轨（原生 function calling + 文本标记，按模型能力路由） | 实现层 | M3 完成后独立立项（M3 PRD §1 创新条目）；M0M1 PRD 预留 ModelAdapter 能力探测位 |

治理规则：扩展层默认关闭、启用即登记偏差、不阻塞复刻主线 DoD；先例为 M5 Widget DSL 已声明偏差机制。

## 7. 后续决策：插件化专项设计（2026-11-11 同日追加）

用户要求"重点分析插件化设计，更详细具体"，并补充"包括前端是否也能做成插件化系统"。

四路源码精读（后端引擎核心 / 六类插件协议 / 分布式与动态注册 / 前端子程序机制）后确认：
- 后端原版五结构性缺陷：D1 direct 零隔离 / D2 无并发控制 / D3 异步子进程无人回收 / D4 热重载不重载代码 / D5 能力面全量暴露
- 前端原版"半插件化"：无统一注册表（五处硬编码），但已有 feature.json / loom.json / 主题扫描三套清单机制；LoomApps 是完整的用户可扩展插件活样板

经澄清卡确认：**方案 A 统一插件架构** + **前端内置清单化 + Loom 沙箱承接第三方**（不开放任意原生代码）。设计骨架经用户批准。

产出 docs/Omnia-插件系统设计.md：统一插件模型（五抽象前后端同构）、后端四层引擎（路由/执行桥/运行时/治理）+ 签名级接口 + 六类执行时序 + manifest 完整 Schema + 三档运行时（Stdio/Direct 侧车/WASM）+ 分布式 1:1；前端 AppRegistry 单一真源 + app-manifest.json + 三档形态（window/embedded/kernel-ext）+ 受限内核扩展点；兼容矩阵 + 逐缺陷验收 + 偏差登记 DV-1～DV-10。架构设计 v2.1 已挂接引用。

## 8. 后续决策：前端框架选型深化（2026-11-12 追加）

用户要求"深度调研 GPUI 上再度封装的框架，优化技术方案"。联网调研核实（gpui-kit 官网/中文 README/gpui-shell 文档 + 多轮检索）：

- GPUI 之上事实标准封装层 = Longbridge gpui-kit（0.9.1，Apache-2.0，20.3k stars，Longbridge Pro 生产验证），分层 gpui-base/gpui-component/gpui-shell
- gpui-shell 官方定位"plugins come first"，能力沙箱/崩溃隔离/性能模型与 Omnia 插件设计高度同构，可替代自研 deno_core；但 M0 实验阶段 + Windows quickjs-jit bug 待验证
- GPUI 上游发布停滞（315 天未发 crate）+ Discord 私有分支碎片化是真风险，已被 gpui-kit 固定快照 + gpui-fast + 社区分支对冲
- 能力覆盖比原假设更全（虚拟化/气泡/Markdown/Rope 编辑器/Dock/无障碍/无头测试），流式渲染自研范围收窄

经澄清卡确认：**gpui-component 为主 + gpui-base 兜底**；**gpui-shell M0 实测 + 分阶段采纳**（M0 验证→M4 试点→M5 推广，不通过回退 deno_core，不阻塞主线）。

产出 docs/Omnia-前端框架选型.md（带来源）；同步架构设计 §9/断点表/风险表/索引、M0M1 PRD §7.1、M5 PRD §7.5、插件系统设计 §3.8.4/§3.8.5（新增 script 档与 gpui-shell 隔离）。

## 9. 后续决策：版本一手核验与修订（2026-11-12 追加）

用户提供本地代理（7890）后，对选型涉及的全部版本与风险状态做一手核验（crates.io 稀疏索引 + GitHub API + 仓库源文件），选型文档升级 v1.1：

**核验结论**：
- gpui-kit 0.9.1（release 2026-11-09），精确锁定 =0.9.1；GPUI 快照 gpui-pre =0.3.12 由其传递锁定（workspace Cargo.toml 的 = 要求）
- **quickjs-jit Windows bug 上游已修复**：修复 PR #36 于 2026-11-03 合并（rquickjs 0.14 基座）；gpui-kit 0.9.1 锁定 quickjs-jit =0.14.1（问题版本 0.12.11）——风险状态从"已知 bug 待验证"降级为"回归确认"
- gpui-fast 0.1.14（M0 对比评估）；gpuikit 0.9.0（对照项）；gpui-ce 0.3.0（兜底）
- 后端依赖修订：tower-http 0.6→0.7、reqwest 0.12→0.13、thiserror 1→2（三个大版本落后）；cron 0.12→0.17、rusqlite ≥0.32→0.42；其余写入核验时最新稳定版
- M2 vendored 内核依赖不随本表升级（保持基线）

同步修订：前端框架选型 v1.1（版本矩阵+风险状态）、架构设计 §9/风险表、M0M1 PRD §6.3 依赖表/§7.1、M5 PRD §7.5、插件系统设计 §3.8.4。

---

内容由 AI 生成