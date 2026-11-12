# Omnia · M0 实施计划

日期：2026-11-12。用户已明确实施整个 M0（US-001～007）。

## 目标与依据

把规格仓库推进到可构建、可测试的 M0 工程；完整保留冻结协议，建立配置与协议解析器、基线 fixture/录制工具、GPUI 原型及验证证据。阶段完成以 M0M1 PRD §9/§12 为准；本机通过不替代三平台和原版录制验收。

依据：README §2–§7、代码风格与质量约束全文、架构 §2.1/§7/§9/§12、范围矩阵、基线记录、M0M1 PRD、C-01～C-12、前端框架选型 §6。后端固定 a8560b0ae4e7b1a7803a88093a9ebee391e21a7c，前端固定 c3e4855efa2b24c0578d76e17fd6c5f21857a539。

## 边界与技术

无既有产品实现可复用，仅修改文档不能满足可运行目标；按已批准所有者新建最小源码，不新增架构。Rust/tokio/axum；gpui-kit =0.9.1，快照由其传递锁定；工具链使用本机已安装的 1.99.1。配置由 omnia-config 持有，文本协议由 omnia-protocol 持有，UI 全部收敛到 omnia-app/ui_adapter。M1 模块仅建立明确的工程边界，不返回虚构业务成功。无既有产品逻辑需退役，无数据迁移，不改上游工作区、不运行用户插件或真实模型请求。

TDD Route: strict（auto；质量约束 §6 明确要求核心逻辑先失败测试）。配置、解析、录制器校验与 UI 状态先验证目标行为，再实现；清单、工程装配及纯文档用命令验证。需要分别验证固定输出、异常边界、调用方和生命周期，测试不调用生产算法生成预期值。

## 实施任务

1. US-001：根 Cargo.toml/Cargo.lock/rust-toolchain.toml；crates 下 M0/M1 所有者；.github/workflows/ci.yml、LICENSE、THIRD_PARTY_NOTICES.md、构建指南。真实验证 reqwest 0.13、rusqlite 0.42 DDL、cron 0.17。CI 覆盖全部自研成员，vendored 当前为空；明确 target/feature 矩阵。
2. US-002：crates/omnia-config，C-06 配置与默认值、来源信息；读取全局及插件 config.env，至少 12 个边界。源码冻结对拍，测试不得修改全局进程环境制造竞态。
3. US-003～005：crates/omnia-protocol，规范/容错标记、字段保真、转义及思考块剥离。按 C-12 与冻结原解析器逐项对拍，fixtures 在 contract/fixtures/c12-parser。
4. US-006：contract/fixtures、contract/recorder、contract/tests；C-01～C-12 正反例、来源元数据、固定模型响应，原服务器录制至少 20 组对话与对拍；报告 docs/fixture-report.md 必须区分源码构造、运行录制与未覆盖项。
5. US-007：crates/omnia-app/src/ui_adapter，原生窗口、设置页、无头交互测试；按 F1～F8 实测，独立记录脚本运行时、后端比较及视频缺口。用户任务为打开应用、修改原型设置、返回主窗口；布局用现成组件及主题，不实现 M1 聊天。
6. 独立规格审查、质量审查；修复发现后重新验证，更新 README、维护文档与报告。完整门禁为 fmt/check/clippy/test、脚本语法/测试、文档检查。仅对已执行且成功的内容给出通过结论。

## 执行与停止条件

主代理负责工程、集成、Git 与交付；按 subagent-driven-development 为独立边界委派实现和审查，每个文件单一写入者。TaskStartSnapshot：D:/code/github/omnia 无 .git，无 HEAD/分支/上游/暂存区/Git 操作；已有 README、AGENTS、docs、scripts、brainstorming、skills-lock.json 和本地技能目录均保留。无需额外工作树。

任务状态和后续接续见 docs/aegis/work/2026-11-12-m0/20-checkpoint.md。通过全部阶段证据才 done；平台/原版依赖缺失保留 needs-verification，不以源码构造替代录制，不以 CI 配置存在冒充 CI 全绿。发现精确契约冲突先核对冻结源码并记录勘误，不静默改变兼容性。
