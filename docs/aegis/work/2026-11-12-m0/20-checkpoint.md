# Omnia · M0 实施检查点 v1.3

- 版本 / 日期：v1.3 / 2026-11-12
- 状态：本机工作完成；M0 整体签署待跨平台与远程 CI 闭合

| 任务 | 状态 | 证据与剩余 |
| --- | --- | --- |
| US-001 工程与 CI | 本机门禁全绿 | CI 含冻结基线检出（固定 commit + OMNIA_*_SOURCE）、Node harness、gpui-fast 构建；远程 CI 未运行 |
| US-002 配置 | 通过 | 17+1 测试、38 fixture、4032 组差分；ApiRetryDelay 勘误已同步基线记录 v1.2 |
| US-003～005 协议 | 通过 | 134 fixture + 4 API 测试、36134 组差分；独立审查通过；契约 v1.2 九条勘误经复核全部落实 |
| US-006 fixture 与录制 | 通过 | 392 fixture（208 冻结源码执行 + 12 静态证据，125 规则正反例）；35 组录制（26 对话 + 9 HTTP 边界）两次运行对拍一致；见 [fixture 报告](../../../fixture-report.md) |
| US-007 原生前端 | F1～F8 逐项记录 | F2～F7 通过；F1 Windows 实测通过、Linux/macOS 待验证；F6 决策保留 gpui-pre；F8 视频/音频缺口确认并登记 BP-07/SC-11；见 [GPUI 实测报告](../../../m0-gpui-validation.md) |
| 审查与交付 | 本机完成 | 三份报告 + README/矩阵 v1.2/基线记录 v1.2 同步；本批变更独立审查通过（无阻断，4 条证据一致性建议已全部落实） |

接续顺序：用户最新范围 → [意图](10-intent.md) → 父计划 → 本检查点 → 当前文件/Git/测试实际状态。漂移判断：continue，既定范围和架构未变。未实际运行的平台与录制仍为未验证。

## 当前执行证据与接续

- 本机 Windows x64（10.0.26200），Rust 1.99.1、Node 22.14.0。Git main 无任何提交，所有文件未跟踪；不得整仓提交原有文件/本地技能。
- 最终门禁（2026-11-12 复跑，日志 target/m0-continue/final-*.log）：fmt/check/clippy(-D warnings)/test 全过（38 项 Rust 测试，0 失败）；gpui-fast feature 构建过；Node 11/11 + 208/12 fixture、125 规则过（含 CI 同款 OMNIA_*_SOURCE 环境变量本地验证）；check-docs 过（19 份文档、76 链接、177 编号）。
- 探针终态：omnia-app 5/5（含新增 CJK 输入测试）+ omnia-gpui-probes 7/7（shell 2 + shell_runtime 3 + host_bridge 2），主代理独立复跑确认；F6 数字 gpui-pre p50=18.066/p95=30.722ms vs gpui-fast p50=13.189/p95=19.098ms（无头 CPU、dev profile）。
- 原版隔离基线 target/baseline/vcptoolbox（139 文件冻结导出 + hash，含 jev_tool_call_exp.json 与 JevToolCallDecision.txt 两个 mandatory 静态文件；npm ci 785 包）；录制产物 contract/recordings/original（gitignore）；不含真实配置/用户插件/数据。
- 文档终态：契约 v1.2、PRD v2.3、矩阵 v1.2（BP-07 登记 F8 结论）、基线记录 v1.2（ApiRetryDelay 行）、fixture 报告 v1.1、GPUI 实测报告 v1.1、构建与验证 v1.1 均入 README 索引。

## 未完成（外部依赖，非本机可闭合）

- 远程 CI 全绿与 Linux/macOS 构建/窗口证据：仓库无提交、无远端；需用户决定提交与推送后方可触发（M0 DoD 的「骨架 CI 全绿 + 三平台构建」因此未签署）。静态就绪审查（非实际构建）已通过：冻结基线 GitHub owner `lioensky/VCPToolBox`、`lioensky/VCPChat` 与 CI checkout 一致；rust-toolchain.toml 锁 1.99.1 含 clippy/rustfmt；crates 平台专属代码均 cfg 门控（config 大小写测试 Windows/Unix 各有覆盖），无未门控 Win32 代码；CI Linux 依赖齐备、macOS 无额外依赖。Linux/macOS 实际编译与运行仍待 CI。
- release profile、GPU 呈现与长测、真实远端 WS、四象限 e2e（M1+）：见两份验证报告的未验证清单。

## 修订记录

- v1.3（2026-11-12）：跨平台静态就绪审查（非实际构建）——冻结基线 owner、工具链组件、cfg 门控、CI 依赖均核对通过，无需代码修复；Linux/macOS 实际构建仍待提交授权后由 CI 闭合。
- v1.2（2026-11-12）：补齐交接清单最后一项「CJK 输入」——新增 `cjk_input_reaches_the_display_name_and_chat_greeting` 无头测试（问候语 div 加 aria_label+test_support 以回读）；omnia-app 4→5、Rust 总数 37→38；fmt/clippy/test/gpui-fast 复跑全绿；GPUI 报告升 v1.1、构建与验证升 v1.1。
- v1.1（2026-11-12）：M0 接续会话收尾；F1～F8 证据闭合（除跨平台）、三份报告建立、最终门禁 8/8 通过、文档版本同步；剩余项收敛为远程 CI/跨平台外部依赖。
- v1.0（2026-11-12）：M0 实施中断检查点。