# Omnia · M5 深水区功能与分发 PRD v2.3（部分冻结）

> 本文件定义 M5 核心交付与全项目终验两道出口。产品尚未实现；已有条目冻结不代表范围已经完整或已通过兼容验证。技术选型与清洁室边界不变。

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 / 日期 / 状态 | v2.3 / 2026-11-12（接入代码质量约束）/ **部分冻结**；既有条目及尚需提取的规则见 §0.2 |
| 适用阶段 | M5；US-401 承接既有待冻结项及 SC 增量规格（见 §0.2）；只阻止依赖未冻结规则的实现（见 `README.md` §5.2） |
| 范围对应 | 前端深水区对应见 `docs/Omnia-复刻范围与对应矩阵.md` §4、§7；断点/偏差编号见其 §6 |
| 事实标注 | 【已验证】= 基线源码/文档确认；「（已冻结）」仅指该章节条目；【待冻结】/【切片规则待冻结】/【算法待冻结】仅阻止依赖该规则的实现；〔待产出〕与状态定义见 `README.md` §5.2、§5.3 |
| 基线 | VCPToolBox `a8560b0ae4e7b1a7803a88093a9ebee391e21a7c`；VCPChat `c3e4855efa2b24c0578d76e17fd6c5f21857a539`（2026-11-11 冻结，不随工作区 HEAD 自动更新） |
| 前置依赖 | M0-M4 完成 |
| 契约来源 | LoomController/README（715 行，v1.9.0）、Musicmodules/README、AgentDream.md + config.env.example、VCPSleep manifest + config、SovitsTest/README、programmable-whiteboard.md、挂件运行时与远控参考.md（2026-11-01）、桌面图标与启动API指南、audio_engine/.env |

### 0.1 v2 重大更正（相对 v1）

1. **音频引擎有 Rust 源码**：VCPChat 仓库 `rust_audio_engine/`（Cargo.toml/Cargo.lock 已确认存在）。v1 误判为"仅二进制"（audio_engine/ 下的 exe 是分发产物）。策略更正：**P0 直接 vendoring 原生合并**（同 vexus-lite 策略），不再以 sidecar 为主路径。
2. **Folia AGPL-3.0 许可证冲突**（新增硬约束，见 §3）：VMusic 部分舞台组件含 Folia 派生代码（AGPL-3.0），与本项目 CC BY-NC-SA 4.0 不兼容，必须清洁室重实现。

### 0.2 v2 已冻结契约清单

Loom 全部 14 命令 + Skill 生命周期与限额（§6）；桌面沙箱变量/widgetFS/metrics/styleAutomation（§7）；VCPSleep 三配置键 + 通知独立性（§8.1）；AgentDream 全流程 + 配置全表 + 日志 Schema + 审批 + 持久化格式（§8.2）；SoVITS API 协议（§9）；文坊白板（.excalidraw）存储/六命令/编辑规则/隔离/文脉（§10）；VMusic 三层架构与舞台运行时规则（§5）。

既有【待冻结】清单（US-401）：音频引擎 WS 线协议逐消息、双语朗读切片正则、塔罗种子算法、舞台模式注册表与参数表（限非 Folia 派生的宿主注册/配置代码，遵守 §3）、SoVITS 兼容开发文档细节。

范围补齐另由 US-401 承接 SC-08/SC-09/SC-11/SC-12/SC-15 中本阶段负责的契约：Canvas 工作台、原生辅助服务与语音工具、游戏/媒体/壁纸、JEV/TDB/同步联动、附属资产与部署。US-427 汇总全部 SC 与延后 P1，逐项安排实施和验收；不能用原先的五项清单推定其他功能已冻结。

> **状态口径**：本文件为**部分冻结**。US-401 从冻结源码提取（受 §3 清洁室边界约束），按使用与维护 §4 产出阶段契约并更新引用；§6/§7/§8 的「已冻结」仅指所列条目，不代表全文或最终能力清单冻结。

---

## 1. 范围与优先级

### P0

1. 分发硬化：三平台打包、签名/公证、增量自动更新+回滚、Rust 启动器、首跑引导、doctor
2. VMusic：音频引擎 vendoring + 播放器核心 + 歌词链路 + 6 个 2D 舞台 + 舞台运行时协议
3. Loom 适配版：外部浏览器 + CDP 桥、14 命令全量、Skill 闭环、人工接管
4. 自主生活：VCPSleep、AgentDream + 审批门禁、FlowLock 自主循环、邮件唤醒
5. VCPDesktop 原生版：Widget DSL 运行时、widgetFS/metrics/内置监控/样式自动化、桌面工作空间
6. **Folia 清洁室合规审计**（交付门禁）

### P1

VoiceChat/TTS、文坊白板（.excalidraw）、3D 舞台（镜台/隧图）、星诞 AI 导演、AI 歌词生成、3D 骰子、塔罗、桌宠

### P2

游戏群、视听工坊高级、JEV 前端、动态壁纸视频化：进入 SC-11/SC-12，由 US-401/US-427 承接。P1 未交付项进入 SC-16，均须在 US-426 前完成原有能力；可选创新独立管理。

US-426/US-427 是最终范围出口任务，不混入本阶段 P0 核心交付清单。

---

## 2. 资产盘点（v2 更正后）

| 资产 | 源码状态 | 策略 |
| --- | --- | --- |
| rust_audio_engine | **Rust 源码在仓库** | vendoring 原生合并（P0） |
| rust_assistant_engine（语音/截屏） | Rust 源码在仓库 | vendoring（P1 VoiceChat） |
| GPT-SoVITS 魔改（GSVI.py/my_infer.py） | Python 源码在 SovitsTest | 按原版替换部署 + HTTP 协议对接 |
| Loom 浏览器自动化 | 依赖浏览器内核 | 外部浏览器 + CDP 桥（换形态） |
| HTML Widget / 白板 HTML 节点 | 依赖 HTML/JS 执行 | 原生 DSL 替代（换形态，断点声明） |
| Folia 派生舞台组件 | AGPL-3.0 | **禁止复制，清洁室重实现**（§3） |

---

## 3. 许可证专项：Folia AGPL 冲突（硬约束）【已验证：Musicmodules/README 许可节】

- 事实：VMusic 的 Classic/Partita/Cadenza/Fume 歌词布局与演出组件、部分 Sonnet 光学/镜头/字素时序能力含 Folia（chthollyphile/folia-major，AGPL-3.0）适配或派生代码，源文件保留上游归属与 AGPL 注释。歌词后端借鉴 Folia 经验但已按 VCP 架构重实现。
- 冲突：AGPL-3.0 与 CC BY-NC-SA 4.0 不兼容；复制这些代码进本项目将造成许可证污染。
- **规则**：
  1. 本项目舞台为 GPUI 原生重实现，仅依据行为级规格（本文档 + 官方 README 的行为描述），**不得打开、参考、复制 Folia 派生源文件**（music-stage/modes/ 下相关组件）
  2. VCP 自研部分（音频引擎、播放器主 GUI、舞台宿主、模式注册调度、星诞导演、配置系统、资源生命周期、质量策略）属 VCP 原创，按 CC BY-NC-SA 演绎规则处理（署名+非商业+相同方式共享）
  3. US-425 合规审计：交付前逐文件核查舞台实现无 Folia 代码痕迹，审计记录随交付发布
  4. 上游归属声明保留在文档中（署名义务），但不构成代码复制许可

---

## 4. 音频引擎规格（vendoring）【已验证：Musicmodules/README + audio_engine/.env】

### 4.1 引擎能力基线（rust_audio_engine，Rubato 4.0）

- 内部全链路 f64 双精度样本；本地文件 + HTTP(S)/WebDAV 远程音频加载；解码与流式播放
- DSP 统一管线：卷积（IR 预设）、动态响度、True-Peak Limiter、Noise Shaper
- 重采样路由：常见比例 FFT、专用 2× 半带 FIR、特殊比例 Sinc；质量档 low/std/hq/uhq（uhq 更长 sinc）
- Windows WASAPI 输出 + 独占模式；播放进度/延迟/尾部/finish/reset 完整流式语义
- 实时线程约束：预分配、处理路径无动态分配（vendoring 后必须保留此约束，代码审查项）
- 频谱与音频特征输出（供可视化与舞台）
- 配置面 1:1：VCP_AUDIO_EQ_TYPE（FIR/IIR）、VCP_AUDIO_TARGET_SAMPLERATE（空=原始）、VCP_AUDIO_USE_CACHE、VCP_AUDIO_PREEMPTIVE_RESAMPLE（非独占抢跑到系统混音器采样率，规避 Windows SRC）、VCP_AUDIO_RESAMPLE_QUALITY

### 4.2 集成边界

- 播放状态**唯一权威来源**在引擎；播放器与舞台都只消费快照，不得各自维护歌曲时间（架构硬规则）
- 播放器↔引擎：原版 Electron bridge + WebSocket → 原生版进程内直调 + 事件流；WS 线协议逐消息冻结（US-401）后做对拍夹具
- 非 Windows 平台：WASAPI 专属能力（独占/DSD）明示不可用，CoreAudio/ALSA 输出 P1 补齐（US-421 验收平台音频链路）；各平台安装包必须明示当期音频能力，不能由三平台打包推断三平台功能等同

---

## 5. VMusic 播放器与舞台规格【已验证：Musicmodules/README】

### 5.1 三层架构

音频引擎（§4）/ 播放器交互层 / 歌词舞台，彼此解耦、协议协作。

### 5.2 播放器核心（P0）

本地曲库/播放列表/搜索/排序/队列；WebDAV 服务器管理/目录浏览/扫描/导入/远程播放；输出设备/独占/EQ/DSP/升频设置；封面/进度/频谱/歌词/状态统一呈现；普通歌词逐字高亮、弹性阻尼滚动、点击跳转、手动滚动接管。

### 5.3 歌词链路（P0）

本地缓存优先 → 后端多来源聚合（网易云/QQ 音乐/酷狗/AMLL TTML Database）→ 候选评分（歌名/歌手/专辑/时长辅助匹配）→ 逐级降级。格式：LRC / 逐字 YRC/KRC / TTML 高精度；原文/翻译/罗马音；结构化缓存；旧文本歌词与 LyricData 兼容。AI 听歌识曲 + 即时 .lrc 生成（P1）。

### 5.4 舞台运行时协议（P0，硬规则）

- 宿主通常只保留**一个活动模式**；星诞转场最多短暂持有当前+退场两个子模式；歌词切句只保留受控数量的当前/退场场景
- **模式不能控制播放后端**：播放/暂停/切歌/音量/进度永远由播放器负责；舞台只消费状态快照（播放绝对时间、逐字进度、歌词上下文、主题色、频段）并发出演出意图
- 所有模式由宿主帧时钟驱动；禁止私自创建不可追踪的永久帧循环
- 基于播放绝对时间的**确定性动画**；快速切歌/拖动进度/异步初始化的**代际保护**
- 三档质量策略（节能/标准/极致）；模式参数持久化/暂停/恢复/缩放/销毁；有界缓存 + Canvas/WebGL/监听器/动画资源回收（原生对应：GPUI 资源作用域）

### 5.5 舞台模式表

| 模式 | 演出方向 | 原生方案 | 优先级 |
| --- | --- | --- | --- |
| 凝彩 Tempera | 实时图形歌词 MV：色块分镜/网点/文字反色/逐字动势 | GPUI 2D + 后处理 | P0 |
| 商籁 Sonnet | 编辑排版与节目包装：诗稿/HUD/标尺/几何/镜头编排 | GPUI 2D + 变换 | P0 |
| 浮名 Fume | 连续文字世界：长卷/跨栏/逐字追焦/镜头飞行 | GPUI 2D | P0 |
| 流光 Luminous | 辉光与呼吸：逐字光晕/弹性浮动/旋转/矢量伴奏 | GPUI 着色器 | P0 |
| 云阶 Partita | 阶梯节奏排版：语义分块/错落字阶/引导线/节奏脉冲 | GPUI 2D | P0 |
| 心象 Cadenza | 空间化词片：断行/英雄词强调/非对称布局/镜头漂移 | GPUI 2D | P0 |
| 镜台 Diorama | 三维歌词空间：文字场景/空间路径/点云/景深/运镜 | 自研 GPU 3D 或 2.5D 降级 | P1 |
| 隧图 Tunnel | 3D 隧道（主 README 列出） | 同上 | P1 |
| 星诞 Starborn | 自动导演：按歌词密度/标点/段落边界/音频特征选子舞台并转场 | 导演逻辑原生实现 | P1 |

**版本漂移注**：主 README 列 9 模式（含隧图），Musicmodules/README 表列 8（无隧图）。以基线 `music-stage/modes/` 注册表为准（US-401 冻结实际清单），不凭任一 README 断言。

---

## 6. Loom 契约（已冻结）【已验证：LoomController/README v1.9.0】

### 6.1 命令全表（工具名 LoomController，hybridservice/direct，统一 command 字段，兼容 action/commandIdentifier）

| 命令 | 能力 | 需打开应用 |
| --- | --- | --- |
| ListApps | 查询全部已注册 LoomAPP | 否 |
| ListOpenApps | 感知当前打开的 LoomAPP | 否 |
| CreateApp | 创建完整 LoomAPP（1.9.0 支持 Agent 手绘图标） | 否 |
| OpenApp | 打开或聚焦 | 否 |
| CloseApp | 关闭 | 否 |
| GetAppSources | 查询配置/CSS/JS | 否 |
| GetRuntimeSource | 当前运行时 DOM HTML | 是 |
| GetRenderedText | 已渲染成功文本 | 是 |
| EditAppSources | 编辑配置/CSS/JS | 否 |
| CreateSkill | 提交标题/描述/占位符声明/已跑通的完整编号串语法（**不经过录制器**） | — |
| ManageSkill | 列出/读取/删除 Skill，返回保存时验证状态 | — |
| EditSkill | 改元数据或整链替换+重新验证 | — |
| ExecuteSkill | 同步/异步执行 | — |
| GetSkillTask | 查询异步任务 | — |

### 6.2 编号串语法与 DOM 固化

- 步骤参数：commandN/targetN/textN/waitMsN/keysN…；命令含 type/wait/send_keys/getrenderedtext 等；目标为 vcp-h-* 句柄
- CreateSkill 路由先识别顶层命令，编号步骤只编译不被串行执行器抢先执行
- createPersistentTarget：句柄→真实 DOM，保存页面来源+唯一选择器+关键元素特征；**输入框当前值不进定位特征**
- 验证模式：`current`（默认，只读验证；固化失败可保留原始目标但 validated=false + fallback=raw-vcp-id，该兜底跨刷新/导航/重启不可靠）；`trial`（用占位符 example/default 真实执行一次，任何固化或动作失败都不创建文件）；`none`（不访问 DOM，标记未验证）
- 执行时持久目标必须**唯一匹配**；来源改变/找不到/歧义→停止该步；原始 VCP ID 过期→明确失败，**不模糊匹配、不自动重放**

### 6.3 占位符规则

{{变量名}} 必须在 placeholders 声明，执行经 inputs 传值；所有变量在任务创建与任何页面动作之前检查；缺必填值→**零副作用失败**；替换发生在已编译结构化字段内（换行/逗号/类工具调用文本只作字段值，不生成新步骤）；**目标字段禁用占位符**。

### 6.4 限额与生命周期（硬数字）

| 项 | 值 |
| --- | --- |
| 插件同步调用超时 | 2 分钟（同步 Skill 与 trial 须在此内完成） |
| 异步总时长 | 无 2 分钟限制；单步等待仅受 JS 定时器安全范围约束 |
| 异步结果保留 | 完成后 30 分钟；查询不续期；进程重启丢失 |
| 任务/步数/文件/回执 | 最多 100 任务；每 Skill ≤100 步；文件 ≤256KB；每任务回执预算 4MB |
| 失败语义 | 任一步失败停止后续、保留此前回执；**异步任务 ID≠执行成功** |
| 并发 | 同一应用的 Skill 不能并发 |
| 不支持 | 录制、递归 Skill、任意主进程代码、自动变量推理 |

### 6.5 原生适配（外部浏览器 + CDP）

浏览器拉起/附着、per-LoomAPP 独立 profile（持久会话）、应用内原生面板展示快照与 Grounded Markdown；三段式输入管线（动作准备→CDP 输入→状态回读）；动作已发出与业务已成功分别报告；人工接管期禁止 Agent 页面写；授权走 M3 审核。上述命令/限额/失败语义逐条 1:1，仅宿主形态改变。

---

## 7. VCPDesktop 契约（已冻结）【已验证：挂件运行时与远控参考.md，2026-11-01】

### 7.1 原版沙箱变量面（DSL 需等价覆盖）

| 变量 | 语义 |
| --- | --- |
| document | 代理：querySelector/getElementById 限定本挂件，body→内容容器 |
| window | Proxy：setInterval/setTimeout/addEventListener/rAF 登记到本挂件，移除/刷新自动回收 |
| widgetId | 本挂件 ID |
| vcpAPI | fetch(endpoint, opts) / post(messages, opts) / weather() |
| musicAPI | play / pause / getState / setVolume / seek / send |
| widgetFS | 挂件私有文件（§7.2） |
| PIXI | 包装 Pixi v8，实例随挂件销毁 |
| _realDoc/_realWindow | 真实桌面 document/window；**挂件间无安全隔离，只运行可信挂件** |

### 7.2 widgetFS 规则

saveFile（可选 base64）/loadFile{success,content,encoding}/listFiles{files:[{name,size,isText}]}；存 `AppData/DesktopWidgets/{savedId}/`，必须有 savedId（来源：收藏/预设恢复、DESKTOP_PUSH 已归档、CreateWidget 的 preSavedId/autoSave）；**widget.html/meta.json/thumbnail.png 受保护不可写**；同 savedId 多实例共用目录**无锁、后写覆盖**（需隔离则文件名带 widgetId）。

### 7.3 系统指标与内置监控

window.VCPDesktop.metrics：九类快照 cpu/memory/disk/network/gpu/battery/docker/sensors/processes；getSnapshot/getCapabilities（30s 缓存；状态 supported/permission_denied/provider_missing/error/unsupported）+ 九个具名函数；字段含 cpu.usagePct、memory.usagePct/usedBytes/totalBytes、GPU memoryUsedMB/temperatureC/fanPercent/powerWatts、Docker cpuPercent/memPercent；Windows loadAverage=null；格式化 formatBytes/formatRate/formatPercent/formatDuration。metricWidgets：list() 九项，固定 ID `builtin-monitor-{key}`；spawn 同 ID 已存在返回 reused:true；spawnMany 依次错开 24px；CreateWidget 传 builtinWidgetKey 走此路径。

### 7.4 styleAutomation

intervalMs 250ms–60s 拉指标快照，按**结构化规则**写 CSS 变量或壁纸滤镜；不执行任意 JS/CSS。

### 7.5 原生 DSL 映射与偏差声明

- DSL 数据源/动作声明等价覆盖 vcpAPI/musicAPI/widgetFS/metrics；定时器/监听登记与自动回收 1:1；内置监控九件套与 spawn 语义 1:1；样式自动化用结构化规则（原生主题变量/壁纸滤镜）
- **运行时选型（2026-11-12 更新）**：可编程岛/Widget DSL 的嵌入式 JS 运行时**优先 gpui-shell 0.9.1**（QuickJS，能力默认拒绝、宿主逐项授权、脚本故障可恢复、脚本不在帧路径——与 Omnia 插件能力模型同构，见 docs/Omnia-前端框架选型.md §4）；M0 US-007 实测、M4 US-330 试点后推广（quickjs-jit Windows bug 上游已修复，=0.14.1，实测为回归确认），不通过则 deno_core 备选。HostModule 把 vcpAPI/musicAPI/widgetFS 等宿主能力借给脚本
- **偏差声明 DV-11**：定义、影响分类、默认行为和验收以范围矩阵 §6.2 为准。原版挂件可访问真实桌面对象，Omnia 改为受限宿主能力；这会限制存量脚本能力，必须与 BP-06 一起披露。脚本仅在授权的子集内执行，不开放任意宿主代码；不得将“无任意代码执行”写成“完全没有脚本执行”或推定天然隔离。US-414 验证能力拒绝、授权、资源回收和越界行为。
- **断点**：存量 HTML Widget 不直接运行（源码存档保留）；PIXI 特效以原生 GPU 子集替代

---

## 8. 自主生活契约（已冻结）

### 8.1 VCPSleep【已验证：manifest + config.env.example】

- synchronous stdio，timeout 43500000ms（12h）；睡眠期工具链静默，到点带睡前 tips 醒来
- 三配置键：`VCPSLEEP_VCPINFO_ENABLED=true`（**主进程发送入睡/醒来/失败/超时通知，不依赖子进程——插件被超时终止后主进程仍发结束状态**）；`VCPSLEEP_DREAM_ENABLED=false`（须 AgentDream 已手动启用；禁用时安静跳过不影响睡眠）；`VCPSLEEP_DREAM_PROBABILITY=1`（本层概率门，**不覆盖** AgentDream 的白名单/时间窗/冷却/概率判定）
- vcpInfoLifecycle：type=VCP_SLEEP，消息模板含 `{{args.maid|args.Maid|args.agent_name}}` 回退链

### 8.2 AgentDream【已验证：AgentDream.md + config.env.example】

**触发**：定时（时间窗内按 DREAM_PROBABILITY 掷骰）或手动 triggerDream(agentName) / action:triggerDream。

**记忆采集**：个人+公共知识库随机 1-5 篇种子 → TagMemo 语义检索（tag_boost+rerank）→ 联想碎片最多 12 条，个人:公共=3:1。

**叙事**：dreampost.txt 模板渲染种子+碎片 → AI 第一人称意识流 → VCPInfo WS 实时广播。

**三类操作**（VCP 工具格式 + 编号串语法，参数后缀递增）：

| 操作 | 命令 | 参数 |
| --- | --- | --- |
| 合并 | DiaryMerge | sourceDiariesN, newContentN（自动读取源原文） |
| 删除 | DiaryDelete | targetDiaryN, reasonN（自动读取待删内容） |
| 感悟 | DreamInsight | referenceDiariesN, insightContentN（创建新日记） |

**梦日志 Schema**（dream_logs/*.json，全部 pending_review）：

```json
{ "dreamId": "dream-2026-02-18-Nova-a1b2c3d4",
  "agentName": "Nova", "timestamp": "ISO8601",
  "operations": [ { "type": "merge", "operationId": "op-1",
    "sourceDiaries": ["file:///..."], "sourceContents": {"file:///...": "原文"},
    "newContent": "合并内容\nTag: ...", "status": "pending_review" } ] }
```

**审批（硬门禁）**：管理面板梦境审批页；批准→经 DailyNoteWrite 执行实际文件操作（保持 Tag/格式一致）；拒绝→仅更新 JSON 状态。**未批准零执行**，无任何绕过路径。

**梦记忆持久化**：梦结束 AI 调 DailyNote create 写入 `[Agent的梦]` 索引；maid 格式 `[Nova的梦]Nova`；Content 含 `[梦记忆] 日期` + 梦境叙事/记忆锚点/隐藏连接 + Tag。

**配置全表**（以基线 config.env.example 为准；文档表与示例文件存在漂移，下表示例值优先）：

| 参数 | 示例值 | 文档表值 | 说明 |
| --- | --- | --- | --- |
| DREAM_FREQUENCY_HOURS | 3 | 8 | 梦最小间隔（小时） |
| DREAM_TIME_WINDOW_START | 1 | 1 | 时间窗起（24h） |
| DREAM_TIME_WINDOW_END | 8 | 6 | 时间窗止 |
| DREAM_PROBABILITY | 0.6 | 0.6 | 窗内触发概率 |
| DREAM_TAG_BOOST | 0.25 | 0.15 | TagMemo 权重增幅 |
| DREAM_CONTEXT_TTL_HOURS | 4 | 4 | 梦上下文缓存 TTL |
| DREAM_AGENT_LIST | Nova | Nova | 可做梦 Agent（逗号分隔） |
| DREAM_ASSOCIATION_MAX_RANGE_DAYS | — | 180 | 文档列；示例注明联想已由涟漪算法动态控制，按动态处理 |
| DREAM_SEED_COUNT_MIN/MAX、DREAM_RECALL_K、DREAM_PERSONAL_PUBLIC_RATIO | — | 1/5、12、3 | 同上，采集行为规格仍按 1-5 种子/12 碎片/3:1 验收 |

**Per-Agent 配置**：`DREAM_AGENT_<NAME>_MODEL_ID / CHINESE_NAME / SYSTEM_PROMPT / MAX_OUTPUT_TOKENS / TEMPERATURE`；SYSTEM_PROMPT 支持 `{{agent:DreamNova}}` 与 {{MaidName}}/{{Date}}/{{Time}}/{{Today}}；配套资产 Agent/DreamNova.txt + agent_map.json + TVStxt/dreamtool.txt + VarDreamTool 配置。

**梦中工具白名单**（dreamtool.txt）：AgentDream、LightMemo、VSearch、AgentAssistant（说梦话）、TarotDivination、BilibiliFetch、DailyNote。

### 8.3 FlowLock 自主循环 + 邮件唤醒

FlowLock 后端自主模式（锁定 Agent+话题、自主思考/主动发起、冷却/引导语）与 M3 调度器联动；VCPMail 收信唤醒休眠 Agent；唤醒频率上限/勿扰时段/全局暂停开关。

---

## 9. VoiceChat / TTS 契约（P1）【已验证：SovitsTest/README】

- **当前协议**：客户端固定发送 **v2ProPlus** 版本标签，**Bearer 请求头鉴权**；端口可配置，URL 留空默认 **8000**（设置界面 9880 仅示例）；旧 v4 文档为历史参考；兼容细节见〔待产出〕docs/local-sovits-tts-server-compatibility.md（US-401 提取）
- `POST /v1/audio/speech`：{model, input, voice, response_format(wav/mp3), speed, other_params:{app_key, text_lang(中文/英文/日文/中英混合), prompt_lang, emotion, top_k, top_p, temperature, text_split_method(按标点符号切), batch_size, batch_threshold, split_bucket, fragment_interval, parallel_infer, repetition_penalty, sample_steps, if_sr, seed(-1=随机)}}
- `POST /models` {version} → models（含支持语言/情感）
- 麦克风：vendoring rust_assistant_engine（三平台捕获源码在仓库）
- 双语混合朗读：正则切片引擎（中日/中英）【切片规则待冻结】；流式剪枝延迟实测验证（原版宣称值仅作目标参考，方法见使用与维护 §5）

---

## 10. 文坊白板（.excalidraw）契约（P1）【依据：programmable-whiteboard.md / ScriptoriumModules/scriptorium-board.js】

本节对象是 Scriptorium 白板。`Canvasmodules/canvas.js` 的代码/Markdown 协作工作台、预览和本地执行属于 SC-08，需另行冻结契约与验收，不能以 US-422 替代。

- **存储**：.excalidraw 格式，`<appDataRoot>/ScriptoriumDocument/VDOCX/Boards`；普通保存/读取限 **40MB**（含内嵌文脉）；重命名拒绝覆盖；首页"用户白板"分类
- **Agent 六命令**：
  - CreateBoard：maid/name/title/elements JSON/background?/requestId?/openAfterCreate?(默认 true)；落盘与打开分别判断（saved/opened）；幂等缓存为**有界会话缓存，非跨进程幂等**
  - GetBoard：元素摘要+revision（ids/region/sinceRevision/limit）
  - GetBoardNodeSource：id/startLine/endLine（≤2000 行）→ HTML 真源+revision
  - UpdateBoard：maid/summary/expectedRevision/requestId/add/update/delete/background；默认提交白板文脉并**自动批准**+保存；save=false 只应用不保存；人类关闭自动允许→pending（GetBoardHistory 查询）；冲突→success=false/status=conflict，画布不改
  - SaveBoard：expectedRevision 显式保存
  - GetBoardHistory：状态/署名/回执（不展开快照与提案源码）
- **HTML 节点**：{id, type:html, title, x, y, width, height, source}；局部编辑 replacements[{target, replace}] 基于同一原始源码，**target 不唯一/零命中/重叠均拒绝**；source 整体替换与 replacements 互斥；单节点源码 ≤512KB
- **隔离模型（原版）**：iframe sandbox 仅 allow-scripts、无 allow-same-origin、不暴露宿主 API；禁网络/外部脚本/子框架/表单/任意文件资源；允许内联 JS/CSS/data 图片；scriptorium-page://board-<token> + 响应 CSP；删除/切换/关闭释放令牌与 iframe；不承诺 CPU/内存强隔离
- **文脉**：vcpBoard.records 嵌场景顶层；默认自动允许（仅人类 UI 可改）；提案串行+基础修订校验；首次修改前留基线；回溯先备份再建恢复记录不删历史；快照仅场景不嵌套文脉；HTML 恢复源码不恢复 JS 闭包/动画现场；**重新打开时取消磁盘恢复的 pending 提案**（防外部文件自动执行旧提案——安全规则 1:1）
- **视觉导出**：纯图形导出内容图片（ids/region）；含 HTML 时 GetVisualContext 用真实视口截图且 ids/region 明确拒绝
- **原生适配**：画布/图形/文脉/六命令 1:1 原生实现；HTML 节点为断点——以原生 DSL 节点或嵌入 JS 子集替代（与 Widget DSL 同源），隔离语义对齐原版 sandbox 约束

---

## 11. 其余子程序（P1/P2）

3D 物理骰子（d4~d100、材质/音效、物理魔法；原生 3D 或 2D 降级）；塔罗（宿命论确定性种子：行星倾角轨道+经纬天气+农历节气+日程，剔除伪随机【算法待冻结】）；桌宠（Live2D→原生精灵动画降级）；游戏群/视听工坊/JEV 前端（P2）。

## 12. 分发硬化（P0）

三平台打包（release strip+LTO）；Windows 安装器/macOS dmg+公证/Linux deb/AppImage；stable/preview 通道；签名+增量更新+失败回滚（更新前快照，用户数据目录原地兼容）；Rust 启动器（参考 NativeSpalash 源码）；首跑引导前置（用户名+后端管理员凭据，缺失会致依赖服务报错）；doctor 一键体检（环境/端口/模型连通/音频设备/CDP 可用性）。

## 13. 全项目终验（US-426；晚于核心交付）

1. 四象限全功能矩阵：先按冻结原版能力清单核对，再映射 M0–M5 US；SC-01～SC-16 全部完成，P1/P2 中的原有能力不得因优先级标签豁免。US-427 先提交覆盖审计，US-426 再签终验
2. 数据兼容终验：原版 AppData/VectorStore/dailynote/.vdocx/.vpptx/.excalidraw/插件目录停止旧端写入、备份并顺序迁移后跑一个完整"生活周"（聊天/工具/记忆/梦境/睡眠/音乐/文坊/工程/白板/桌面），挂回原版验证无损
3. 断点清单公示（HTML Widget/白板 HTML 节点/可编程岛 3D/WASM/Canvas 工作台执行边界/桌宠 Live2D/非 Windows 音频专属能力/像素级视觉差异/Folia 清洁室重实现声明）；**须按 `docs/Omnia-复刻范围与对应矩阵.md` §6.1 的 BP 编号逐项列出并标注验收结果**
4. 许可证合规：CC BY-NC-SA 署名+相同方式共享+非商业；**Folia 清洁室审计记录**；Zed 代码零复制审计
5. 性能实测报告（启动/内存/帧率/记忆时延/索引扫描/音频链路；原版宣称值仅作目标参考）

## 14. 用户故事（按依赖排序）

**US-401 M5 契约冻结与范围补齐**：按 §0.2 清单提取音频 WS、双语切片、塔罗算法、非派生舞台注册/参数、SoVITS 及 SC 增量能力；产出〔待产出〕docs/m5-spec.md（M5-C-xx 命名空间）与〔待产出〕docs/local-sovits-tts-server-compatibility.md。冻结后按使用与维护 §4 更新 PRD 引用与范围矩阵承接，新增文件进入 README 索引；未覆盖能力逐项进入 US-427，禁止留空后签全项目完成。
**US-402 三平台打包**：安装包产出+安装/卸载干净+体积报告。
**US-403 签名与自动更新**：签名验证；增量+回滚；用户数据零丢失。
**US-404 启动器+首跑+doctor**：进程监护/日志；引导前置；全项诊断；交付实测安装、启动、网络端口/认证、外部依赖、混部、升级回滚、备份恢复与故障排查文档；SC-15 部署资产补齐（使用与维护 §4）。
**US-405 音频引擎 vendoring**：rust_audio_engine 编入 workspace；实时线程无分配约束审查；配置面逐项；独占/升频/缓存/抢跑用例；非 Windows 降级提示。
**US-406 播放器核心+WebDAV**：曲库/队列/设置/远程播放用例。
**US-407 歌词链路**：多来源聚合/评分/降级；LRC/YRC/KRC/TTML；逐字高亮/弹性滚动/点击跳转/手动接管。
**US-408 2D 舞台六模式+运行时协议**：§5.4 硬规则逐条用例（单活动模式/禁控后端/帧时钟/代际保护/资源回收/三档质量）；确定性动画对拍。
**US-409 AI 歌词生成（P1）**：无歌词→毫秒级 .lrc；精度报告。
**US-410 Loom 桥+应用九命令**：CDP 拉起/附着/profile 隔离；命令逐条对拍。
**US-411 Loom 感知操作+串语法执行器**：Grounded Markdown；三段式；动作/业务分离；编号参数编译。
**US-412 LoomSkill 闭环**：五命令；三验证模式精确语义；占位符零副作用失败；§6.4 限额逐项；失败保留回执；同应用禁并发。
**US-413 人工接管**：接管期写禁止；恢复感知。
**US-414 Widget DSL 运行时**：依赖 US-007/US-330 的验证或已批准回退结果；按 BP-06/DV-11 验证能力映射、受限脚本授权、定时器登记/回收、越权拒绝与故障恢复；审计不允许任意宿主代码执行。
**US-415 widgetFS+metrics+内置监控+样式自动化**：保护文件/无锁语义；九类快照+能力状态；builtin ID/spawn/reused/24px；结构化规则。
**US-416 桌面工作空间+AI 闭环**：Dock/收藏/布局/--desktop-only；查询→读→改→用。
**US-417 VCPSleep**：三键语义；主进程通知独立性（子进程被杀仍发结束态）；入梦门链。
**US-418 AgentDream 引擎**：采集参数/叙事广播/三操作串语法/日志 Schema 逐字段。
**US-419 梦境审批+持久化+per-Agent**：未批准零执行审计；DailyNoteWrite 格式一致；[Agent的梦] 持久化；DREAM_AGENT_* 配置；梦中工具白名单。
**US-420 自主循环+邮件唤醒**：FlowLock 自主推进；收信唤醒；频率上限/勿扰/全局暂停。
**US-421 VoiceChat 与平台音频链路（P1）**：麦克风三平台、CoreAudio/ALSA 输出；v2ProPlus+Bearer+8000 默认；payload 全字段；双语切片；打断。
**US-422 文坊白板（P1）**：.excalidraw 兼容+40MB；六命令精确语义；replacements 三拒绝；文脉规则；重开取消 pending；HTML 节点适配。
**US-423 3D 舞台+星诞（P1）**：3D/降级决策落地；导演输入（密度/标点/段落/音频特征）与转场。
**US-424 骰子/塔罗/桌宠（P1）**：组合与魔法；确定性种子复算一致；降级行为。
**US-425 Folia 清洁室合规审计（P0 门禁）**：舞台实现逐文件核查无 Folia 代码痕迹；审计记录发布；核对 US-001 建立的 LICENSE 与逐资产第三方归属，保留适用声明并随包分发。
**US-427 最终范围覆盖审计**：依据范围矩阵逐一核对两仓模块、96 插件目录（启用与 .block 分开）、SC-01～SC-16、全部延期 P1/P2。每项必须具备源路径、目标模块、冻结契约、实施 US、正常/异常验证证据；发现未排任务即分配后续 US，完成前保持未关闭。BP/DV 例外须附影响与验收，可选创新不得用来抵消未完成的复刻功能。输出逐项覆盖报告，全部必需项完成后才允许 US-426。

**US-426 全项目终验**：依赖 US-427 完成；§13 五项通过；1:1 验收报告、逐项断点/偏差清单、合规文件和维护说明签署。

每个 US 遵守[代码质量约束 §7–§8](Omnia-代码风格与质量约束.md)的通用检查与交付审查；另须完成本文无头 UI、集成、分发与最终兼容验证。

## 15. 安全与异常路径

- 梦境审批门禁不可绕过（唯一执行入口=批准）；审计全量
- 白板重开取消磁盘 pending 提案（1:1 安全规则）；HTML 节点隔离对齐 sandbox 约束
- Widget DSL 仅执行已授权的受限脚本子集，不开放任意宿主代码；widgetFS 保护文件；数据源白名单；AI 调用走后端鉴权
- Loom：接管期写禁止；CDP 仅本机；不绕过网站登录/权限
- 音频：独占失败降级共享并提示；实时线程禁止动态分配（审查项）
- 自主行为：全局暂停最高优先；唤醒风暴防护
- 更新：失败回滚；断电保护（快照+原子替换）

## 16. 完成定义（DoD）

**核心交付出口**：本阶段 P0 US 通过（含 US-425）；三平台安装包经过安装/更新/回滚验证，并标明各平台当期能力与未交付项；交付 M5 阶段验收记录、部署维护说明、断点/偏差与合规文件。P1/P2 及 SC 未完成项仍在清单中，不宣称已完成全功能复刻。

**最终兼容性出口**：SC 与全部必需能力补齐，US-427 覆盖审计完成，US-426 的 §13 五项通过后，才可宣布冻结基线下、已公示 BP/DV 边界内的 1:1 复刻完成；交付 M0M1、M2、M3、M4、M5 的验收及数据往返证据。

## 17. 风险

| 风险 | 对策 |
| --- | --- |
| Folia 许可证污染 | §3 硬规则+US-425 审计门禁；只依据行为规格重实现 |
| 音频引擎 vendoring 耦合度 | US-401 评估；实时线程约束保留；WS 协议对拍夹具 |
| 舞台模式清单漂移（8 vs 9） | 以 modes/ 注册表冻结，不凭 README |
| 梦境配置文档/示例漂移 | 示例文件优先；漂移表留档；动态联想按涟漪算法 |
| 3D 舞台工作量 | P1 决策自研 vs 2.5D；不阻塞 P0 |
| SoVITS 宣称性能 | 一律实测 |
| 深水区功能长尾 | 分阶段交付；US-427 防遗漏，US-426 不豁免未完成的原有能力 |

---

## 18. 修订记录

- v2.3（2026-11-12）：通用检查与审查引用代码质量规范，保留分发及最终兼容门禁。
- v2.2（2026-11-12）：区分核心交付与最终兼容性出口，新增 US-427 覆盖审计；拆分白板/Canvas，扩展 SC 规格承接；统一受限脚本边界和使用维护交付责任。

内容由 AI 生成
