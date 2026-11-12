# Omnia · 前端框架选型调研 v1.2（既定选型与验证责任）

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 | v1.2 / 2026-11-12 |
| 状态 / 适用阶段 | **已批准**（gpui-component 为主 + gpui-base 兜底；gpui-shell M0 实测 + 分阶段采纳，用户确认）；适用 M0–M5。选择本身已批准，运行可用性与兼容收益待 US-007/US-330 验证，不能以“待决策 0”推断运行证明已完成 |
| 前提与传播 | 本决策为既定前提，不可变前提与可验证分支的分栏见 `README.md` §6.1；所有下游文档须写「优先 gpui-shell，M0 实测不通过则回退 <方案>」，不得写成并列二选一 |
| 性质 | 保留原调研与已批准决策，作为既定技术前提。外部事实、星标和性能数字是 2026-11-12 调研快照，不是 Omnia 实测；本次文档修订未重新联网核验 |
| 依据文档 | docs/Omnia-架构设计.md §9；docs/Omnia-插件系统设计.md §3.8；docs/Omnia-M0M1-PRD.md §7 |
| 调研方法 | WebSearch 多轮 + 权威来源原文核验 + **crates.io 稀疏索引/GitHub API/仓库源文件一手核验（经本地代理）** |

---

## 1. 结论先行

1. **GPUI 之上确有成熟封装层，主力是 Longbridge 的 gpui-kit**（0.9.1，Apache-2.0，20.3k stars，Longbridge Pro 生产验证）。文档原选型方向正确，本次细化分层用法。
2. **gpui-shell 是前端插件化的现成答案**：官方定位"plugins come first"，其能力沙箱/崩溃隔离/性能模型与 Omnia 插件系统设计高度同构，可替代自研 deno_core 方案。仍处 gpui-shell 的 milestone M0 实验阶段；**原 Windows quickjs-jit bug 上游已修复**（修复 PR 2026-11-03 合并，gpui-kit 0.9.1 已采用 quickjs-jit =0.14.1），M0 实测降级为回归确认。走 M0 实测 + 分阶段采纳。
3. **GPUI 上游发布停滞是真风险**（315 天未发 crate），但已被 gpui-kit 固定快照 + gpui-fast 后端 + 社区分支对冲。
4. **能力覆盖比原假设更全**：虚拟化/聊天气泡/Markdown/编辑器/Dock/无障碍/无头测试均有现成，流式渲染引擎自研范围收窄到 VCP 特有逻辑。

---

## 2. GPUI 上层封装生态盘点

### 2.1 主力：gpui-kit 分层框架【已核验：官网 + 中文 README】

```
gpui-kit（应用唯一依赖，固定配套 GPUI 版本，导出 gpui/base/component/assets）
├── gpui-base        无样式行为原语：focus/selection/overlay/虚拟化/AccessKit 无障碍/IME/RTL
├── gpui-component   完整带样式 UI 系统（75+ 组件，shadcn/ui 风格）
└── gpui-shell       JavaScript 扩展运行时（可选，QuickJS，详见 §4）
        ↓
      GPUI（gpui-pre-* 快照，保留 Zed Apache-2.0 许可）
```

- 当前版本 **0.9.1**（v0.9.1 release 2026-11-09，crates.io 索引一手核验）；中文 README 用法示例标 0.7（README 滞后于发布，**本项目以已记录的 0.9.1 锁定值为准**）

**版本矩阵（2026-11-12 一手核验，crates.io 稀疏索引 + gpui-kit 仓库 Cargo.toml/Cargo.lock）**：

| crate | 版本 | 说明 |
| --- | --- | --- |
| gpui-kit | **=0.9.1** | 应用唯一依赖，Omnia 精确锁定 |
| gpui-base / gpui-component / gpui-shell | 0.9.1 | 与 gpui-kit 同版发布（workspace 内 path 依赖） |
| gpui-pre（GPUI 快照） | **=0.3.12** | gpui-kit 0.9.1 精确锁定（= 要求）；gpui-pre-platform/web/macros 等同快照 |
| gpui-fast（可选后端） | 0.1.14 | M0 对比评估 |
| quickjs-jit / quickjs-jit-runtime / quickjs-jit-stdlib | **=0.14.1** | gpui-shell 0.9.1 锁定；含 Windows size_t 修复（0.12.11 为问题版本） |
| gpuikit（对照项，非依赖） | 0.9.0 | 2026-09-04 发布 |
| gpui-ce（兜底分支） | 0.3.0 | 上游停滞时的备选来源 |

**锁定策略**：Omnia 声明 `gpui-kit = "=0.9.1"`，GPUI 快照由 gpui-kit 传递锁定（=0.3.12），不手动指定 gpui-pre；升级 gpui-kit 时快照随之整体迁移（gpui-kit 仓库有 check-gpui-pin 脚本防止快照漂移，issue #3156 曾因此破坏编译）。
- 许可：软件 Apache-2.0；文档 CC BY 4.0；gpui-pre-* 快照保留 Zed 许可与声明
- 生产背书：Longbridge Pro 商业桌面应用从第一天使用并持续打磨
- 平台：macOS/Windows/Linux + WebAssembly（wasm32-unknown-unknown）；移动端 0.6.2 起实验性
- 可选 **gpui-fast** feature：统一切换到 Longbridge 的 GPUI Fast 后端，无需 [patch] 或别名；默认仍是上游 GPUI 快照
- 官方提供 AI 编码技能库（`npx skills add longbridge/gpui-kit`），含组件目录与 GPUI 机制指南——对 Omnia 的 AI 辅助开发是直接利好

### 2.2 其他封装与分支【已核验：检索】

| 项目 | 性质 | 对 Omnia 的意义 |
| --- | --- | --- |
| gpui-ce | 社区版 GPUI 分支 | 上游停滞时的兜底来源之一 |
| adabraka-gpui | GPUI 分支，加系统托盘/全局热键/通知/自动更新 | 桌面集成能力参考（M5 分发） |
| gpui-unofficial / gpui-archipelago | Zed GPUI crate 的自动构建发布 | 上游不发版时的 crate 来源 |
| fluix / gpui-ui-kit / Yororen UI | 小型组件库 | 补充组件参考，非主力 |
| iamnbutler/gpuikit | SwiftUI 风格 Rust toolkit（个人项目） | 设计思路参考，**非主框架**（详见 §2.2.1） |
| makepad | 独立 GPU UI 框架（非 GPUI 封装） | 跨平台备选，但偏离 GPUI 生态 |

**结论**：gpui-kit 是事实标准与生产首选；分支生态作为上游风险的对冲来源，不作主依赖。

#### 2.2.1 命名澄清与 gpuikit 未选理由【已核验：gpuikit why.md + issue #127】

**gpuikit ≠ gpui-kit，是两个项目，名字只差一个连字符**：

- gpuikit（iamnbutler）：2023-10 诞生名 vitesse → 2024-05 改名 gpui-kit → 2025-11 去连字符成 gpuikit
- gpui-kit（longbridge）：2026-09-03 才从 gpui-component 改名 gpui-kit
- gpuikit 反而更早用过"gpui-kit"名；本项目选的是 **longbridge gpui-kit（带连字符）**

**未选 gpuikit 作主框架的理由**：

| 维度 | gpuikit（iamnbutler） | gpui-kit（longbridge） |
| --- | --- | --- |
| 维护 | 个人项目，**201 stars / 7 forks**，30 open issues | 团队维护，**20397 stars / 1245 forks** |
| 生产背书 | 作者自己的 tasks 应用 | Longbridge Pro 商业应用 |
| 分层 | 组件库 + 主题系统 | base/component/shell 三层框架 |
| 插件运行时 | 无 | gpui-shell（与 Omnia 插件设计同构） |
| 编辑器 | 拆出独立 gpui-editor | Rope 编辑器内置（20 万行+LSP） |
| 版本 | 0.9.0（2026-09-04） | 0.9.1 |
| 活跃度 | 最近 push 2026-10-29 | 最近 push 2026-11-11 |

**流式 Markdown 的事实更正**（一手核验 issue #127）：该缺陷（无 append、每个流式 delta 在 UI 线程重解析整段源码、回复闪烁）**2026-08-16 当天提出当天关闭修复**，并非长期未解。但有两点对选型仍有意义：

1. gpuikit 作者自己在 #127 中明确把 **gpui-component 的 `crates/ui/src/text/state.rs`（Apache-2.0）当作流式 Markdown 状态机的参考实现**，并建议搭配 mdstitch 预处理闭合未终止标记——这反向印证 gpui-component 的流式文本处理是社区公认更成熟的参照
2. 该缺陷的存在与修复过程说明 gpuikit 的流式聊天渲染仍在打磨期；Omnia 以流式聊天为核心，选生产验证更充分的 gpui-kit 更稳

**结论**：gpuikit 的 SwiftUI 风格 API 优雅、可作设计参考，版本也跟进到 0.9.0；但社区规模差两个数量级（201 vs 20397 stars）、缺插件运行时、流式渲染仍在打磨，作承载复杂生产应用的主框架不如 longbridge gpui-kit 稳妥。命名易混（§2.2.1 开头），引用时务必带连字符区分。

### 2.3 上游 GPUI 状态与风险【已核验：检索 + 社区报料】

- **发布停滞**：gpui-component 作者 huacnlee 公开喊话 Zed"315 天未发布 GPUI crate、523 个 commit 堆在 crates/gpui"（2026-09 社区报料）。上游持续改动但不积极发版
- **碎片化信号**：Discord 2026-11 官宣弃 Electron 改 GPUI（Phoenix 客户端，内存从 1-4GB 降至 290MB），但参与重构的开发者透露"使用的版本已接近私有分支"，希望未来贡献回上游
- **对冲手段**：① gpui-kit 固定 gpui-pre-* 快照，不依赖上游发版节奏；② gpui-fast 可选后端；③ gpui-ce/gpui-unofficial 社区分支兜底；④ Omnia 的 ui_adapter 隔离层 + 精确锁版本
- **正面背书**：Zed 1.0（2026-04）改善 Windows/Linux 体验；Discord 大厂采用证明 GPUI 承载复杂生产应用的能力

---

## 3. 能力覆盖映射（Omnia 需求 → gpui-kit 现成能力）

| Omnia 需求 | gpui-kit 现成 | 自研范围 |
| --- | --- | --- |
| 聊天消息列表虚拟化 | VirtualList（不同尺寸项）/ List / Table（数十万行） | 离屏冻结策略、滚动锚定 |
| 聊天气泡/消息原语 | Bubble / Message 组件 | 工具卡片、思考链折叠 |
| Markdown 渲染 | 原生 Markdown + HTML 渲染、语法高亮 | 增量解析（流式尾部未闭合结构） |
| 代码编辑（文坊/IDE） | Rope 编辑器（20 万行）+ Tree-sitter + LSP 诊断/补全/悬浮 | Scriptorium 共笔协议、版本控制 |
| 子程序面板布局 | DockArea/DockLayout/TabGroup（可序列化） | AppRegistry 注册表集成 |
| 图表（系统监控等） | 内置图表 | — |
| 主题/壁纸 | 语义化 Theme/ThemeColor/ActiveTheme | VCP 主题格式兼容 |
| 无障碍 | AccessKit role/name/state/relationship/action | — |
| 无头 UI 测试 | gpui_kit::test / TestWindowExt（headless 渲染+输入驱动+断言） | VCP 行为用例 |
| CJK/RTL/IME | gpui-base 内置 | — |
| 流式竞态防护 | 无（VCP 特有） | 竞态三元组、消息岛隔离 |
| 前端插件运行时 | gpui-shell（§4） | 能力授予策略、HostModule 业务桥 |

**关键收益**：原"必须自研流式渲染引擎"的范围收窄——虚拟化/气泡/Markdown 基础/编辑器都有现成，自研聚焦增量解析 + 竞态防护 + 工具卡片 + 离屏冻结这些 VCP 特有逻辑（对齐 IN-1"保留行为目标，不复刻机制"原则）。

---

## 4. gpui-shell 深度评估（前端插件化的现成路径）

### 4.1 定位与架构【已核验：gpui-kit.com/shell】

- 官方明确"**The primary goal is plugin extension**"——宿主编译发布一次，新面板/工具/业务逻辑以脚本加载，无需重编译/重分发/fork
- 架构：脚本描述界面（builder 链写入 arena），Rust 回放成真实元素；**布局/绘制/命中测试/滚动/IME/文本编辑全在 Rust，永不回调脚本**
- 引擎：QuickJS（quickjs-ng），宿主线程运行；引擎接缝设计（未来可换 VM）
- 不是 Electron/Tauri：无 WebView/DOM/HTML/CSS/浏览器引擎/Node.js
- 与 gpui-component 平级（都是 gpui-base 消费者）：component 提供 Rust 成品视觉，shell 提供脚本自绘视觉的机制

### 4.2 与 Omnia 插件系统设计的同构映射

| Omnia 设计需求（插件系统设计.md） | gpui-shell 现成机制 |
| --- | --- |
| 能力沙箱默认拒绝（IN-3/DV-5） | `Capabilities::default()` 空集；宿主加载前逐项授权；fs 单一 resolver 拒绝越界 |
| 插件崩溃不拖垮宿主（D1/DV-10） | 脚本故障 = 可恢复异常，宿主进程存活 |
| 插件间隔离 | 每插件独立 Policy；原型冻结（防 Object.prototype 污染）；unload 取消全部任务 |
| 性能不被插件拖累 | 脚本不在帧路径：render 仅 invalidate 时跑，重绘回放 Snapshot 不进 VM |
| 能力注入（HostModule） | 宿主把 Rust 函数借给脚本，plain-data 边界，生成 gpui-kit.d.ts 类型 |
| 前端面板插件化（AppRegistry） | Dock PanelRegistry 按名重建面板 + 状态持久化；shell 补"脚本实现面板" |
| 语言级沙箱 | 禁 eval/4 个函数编译器；堆 256MiB/栈 1MiB/render 单次 50ms（不可被 catch 吞） |

**结论**：gpui-shell 几乎逐条实现了 Omnia 前端插件化的安全与性能需求。采纳它可省去自研 JS 沙箱的大量工作，且安全模型经过专门设计（比自研 deno_core 方案更贴合插件场景）。

### 4.3 性能与体积【调研来源：官方基准，Apple M3 MacBook；不是 Omnia 实测】

- 脚本 render 不在每帧跑：443 节点基准，render+记录 Snapshot 1.1ms，缓存帧 1.3ms（无脚本 render）
- 体积代价：**+13.5MiB 二进制 +14MiB 内存**（常量，不随应用规模比例增长）
- 完整脚本应用：26.1MiB 二进制 / 81MiB 常驻

### 4.4 风险（必须 M0 实测）

| 风险 | 事实 | 对策 |
| --- | --- | --- |
| **gpui-shell milestone M0 实验阶段** | 官方"milestone M0：可行性基线，非稳定接口"；脚本 API 实验性会变；crates.io 0.8.1 起，当前 0.9.1 | 精确锁版本 + ui_adapter 隔离；不阻塞主线 |
| **Windows 运行时 bug（上游已修复）** | quickjs-jit 0.12.11 的 size_t 绑定问题曾致 fs 写入/WebSocket 二进制/zlib 失败；**修复 PR #36 于 2026-11-03 合并（rquickjs 0.14 基座），gpui-kit 0.9.1 已锁定 quickjs-jit =0.14.1**（仓库 Cargo.lock 一手核验） | M0 Windows 回归确认（原失败三场景：fs 写入/WS 二进制/zlib）；仍异常则 deno_core 备选 |
| 上游 GPUI 停滞 | 见 §2.3 | gpui-kit 快照 + gpui-fast 对冲 |
| 体积 +13.5MiB | 官方实测 | 评估可接受（桌面应用） |

---

## 5. 选型决策（已批准）

### 5.1 框架分层

- **gpui-component 为主**：聊天窗口、子程序面板、设置页等用带样式组件系统快速搭建，统一视觉
- **gpui-base 兜底**：流式渲染引擎等需要完全掌控视觉与行为的部分，基于无样式行为原语自建（复用 focus/虚拟化/无障碍/IME，自绘呈现）
- 精确锁 `gpui-kit = "=0.9.1"`（2026-11-12 一手核验；GPUI 快照 =0.3.12 由其传递锁定）；所有调用收敛 ui_adapter/；升级走整体迁移窗口
- M0 评估 gpui-fast 0.1.14 后端（性能/稳定性对比 gpui-pre 0.3.12 快照）

### 5.2 gpui-shell 分阶段采纳

| 阶段 | 动作 | 决策门 |
| --- | --- | --- |
| M0 / US-007 | Windows 实测 gpui-shell 0.9.1 运行时（fs/网络/能力授予/崩溃隔离/热重载）；quickjs-jit 修复回归确认（上游已修，=0.14.1） | 可用→采纳路线；不可用→deno_core 备选 |
| M4 / US-330 | 前端第三方扩展试点：用 gpui-shell 承载 1-2 个脚本面板插件，验证 HostModule 业务桥 | 试点达标→推广 |
| M5 | Widget DSL / 可编程岛运行时优先 gpui-shell（替代自研 deno_core）；Loom 沙箱仍走外部浏览器+CDP | 与 M5 DSL 设计合并 |

**不阻塞原则**：gpui-shell 是增强项非主线依赖；M0 实测不通过则回退 deno_core/原生 DSL，复刻主线 DoD 不受影响。

### 5.3 流式渲染引擎自研范围（收窄）

复用 gpui-kit：VirtualList 虚拟化、Bubble/Message 气泡、Markdown 基础渲染、Rope 编辑器。
自研聚焦（VCP 特有，对齐 IN-1）：增量 Markdown 解析（流式尾部未闭合）、竞态三元组防护、工具卡片/思考链折叠、离屏冻结策略、滚动锚定。

---

## 6. M0 实测清单（前端框架）

F1–F8 统一由 M0M1 PRD **US-007** 交付报告，M4 US-330 引用其运行时分支结果；M5 US-414 推广前须验证所选分支。每项记录平台、设备、版本、输入、测量方法、结果与失败/回退依据；未执行时保持“待验证”。技术选型不因文档检查通过而变成已实测。

| # | 实测项 | 通过标准 |
| --- | --- | --- |
| F1 | gpui-kit =0.9.1 三平台构建（Windows 优先） | hello-chat 窗口跑通 |
| F2 | gpui-component 聊天原语（Bubble/Message/VirtualList） | 千条消息滚动流畅 |
| F3 | gpui-base 自建流式渲染原型 | 增量 Markdown + 竞态防护用例 |
| F4 | gpui-shell 0.9.1 Windows 运行时 | fs 写入/WS 二进制/zlib（原 bug 三场景）+ 能力授予/崩溃隔离/热重载全通过（quickjs-jit =0.14.1 修复回归） |
| F5 | gpui-shell HostModule 业务桥 | Rust 函数借给脚本，plain-data 边界验证 |
| F6 | gpui-fast vs 上游快照对比 | 性能/稳定性数据，决定是否切换 |
| F7 | 无头 UI 测试（gpui_kit::test） | 输入驱动 + 状态断言跑通 |
| F8 | 视频/多媒体能力 | 确认缺口与降级预案（沿用 M0 原清单） |

---

## 7. 来源

- [longbridge/gpui-kit（GitHub）](https://github.com/longbridge/gpui-kit)
- [gpui-kit 官网](https://gpui-kit.com/)
- [gpui-kit 中文 README](https://raw.githubusercontent.com/longbridge/gpui-kit/main/README.zh-CN.md)
- [gpui-shell 文档](https://gpui-kit.com/shell/)
- [gpui-pre（crates.io）](https://crates.io/crates/gpui-pre)
- [gpui-web-gpui-unofficial（lib.rs）](https://lib.rs/crates/gpui-web-gpui-unofficial)
- [GPUI 上游发布停滞社区报料（CSDN，2026-09）](https://blog.csdn.net/hoolooday/article/details/164359521)
- [Discord 弃 Electron 改 GPUI（InfoQ，2026-11-10）](https://www.infoq.cn/news/MQTTu6dgGxHBZm1wOLPI)
- [Zed 1.0 发布（网易，2026-04-30）](https://www.163.com/dy/article/KRPBEBLT0511BLFD.html)
- [gpui-kit 0.6.2 跨平台实测（CSDN，2026-10-16）](https://blog.csdn.net/gitblog_01061/article/details/168123780)
- [gpuikit 命名渊源 why.md（一手核验）](https://raw.githubusercontent.com/iamnbutler/gpuikit/main/why.md)
- [gpuikit issue #127 流式 Markdown 缺陷（一手核验，已关闭）](https://github.com/iamnbutler/gpuikit/issues/127)
- [gpuikit（crates.io，0.9.0）](https://crates.io/crates/gpuikit)
- gpuikit / gpui-kit 仓库元数据（stars/forks/版本/push 时间）：2026-11-12 经 GitHub API 一手核验

> 注：v1.1 已完成一手核验闭环——quickjs-jit 修复 PR #36 合并状态（2026-11-03）、gpui-kit 0.9.1 锁定 quickjs-jit =0.14.1（仓库 Cargo.toml/Cargo.lock）、gpui-pre =0.3.12 快照锁定（workspace Cargo.toml）、全部版本号（crates.io 稀疏索引）均于 2026-11-12 经本地代理直接核验。实施日复核锁定版本与修复证据的可用性；新版本只登记为候选，须经整体验证窗口和变更记录后升级，不自动追随 latest。

---

内容由 AI 生成


## 8. 修订记录

- v1.2（2026-11-12）：保留既定选型和锁定版本，区分历史调研数据与 Omnia 实测，明确 US-007/US-330/US-414 的验证交接及升级规则。
