# Omnia · M0 实施检查点 v1.5

- 版本 / 日期：v1.5 / 2026-11-12
- 状态：M0 DoD 达成——本机门禁全绿 + 远程 CI 三平台全绿（`61c8bc8`，run 43219179413）；原生 GPU 呈现/release/长测属 M1+

| 任务 | 状态 | 证据与剩余 |
| --- | --- | --- |
| US-001 工程与 CI | 本机门禁全绿 + 远程 CI 三平台全绿 | CI 含冻结基线检出（固定 commit + OMNIA_*_SOURCE）、Node harness、gpui-fast 构建；run 43219179413 三 job（windows/ubuntu/macos）均 success；LICENSE + THIRD_PARTY_NOTICES.md 已建立 |
| US-002 配置 | 通过 | 17+1 测试、38 fixture、4032 组差分；ApiRetryDelay 勘误已同步基线记录 v1.2 |
| US-003～005 协议 | 通过 | 134 fixture + 4 API 测试、36134 组差分；独立审查通过；契约 v1.2 九条勘误经复核全部落实 |
| US-006 fixture 与录制 | 通过 | 392 fixture（208 冻结源码执行 + 12 静态证据，125 规则正反例）；35 组录制（26 对话 + 9 HTTP 边界）两次运行对拍一致；见 [fixture 报告](../../../fixture-report.md) |
| US-007 原生前端 | F1～F8 逐项记录 | F2～F7 通过；F1 三平台构建+无头窗口 CI 全绿、Windows 原生启动实测、Linux/macOS 原生 GPU 呈现待实机；F6 决策保留 gpui-pre；F8 视频/音频缺口确认并登记 BP-07/SC-11；见 [GPUI 实测报告](../../../m0-gpui-validation.md) |
| 审查与交付 | 本机完成 | 三份报告 + README/矩阵 v1.2/基线记录 v1.2 同步；本批变更独立审查通过（无阻断，4 条证据一致性建议已全部落实） |

接续顺序：用户最新范围 → [意图](10-intent.md) → 父计划 → 本检查点 → 当前文件/Git/测试实际状态。漂移判断：continue，既定范围和架构未变。未实际运行的平台与录制仍为未验证。

## 当前执行证据与接续

- 本机 Windows x64（10.0.26200），Rust 1.99.1、Node 22.14.0。Git main 已建首个提交并推送：root-commit `2109a06`（918 文件，M0 工程/契约/文档产物）+ 合并 GitHub 初始提交 `fdc6fa4` → `61c8bc8`，经 7890 代理推送至 `https://github.com/onceMisery/omnia.git`，远端 ref 与本地 HEAD 一致。提交精确挑选，排除本地技能（.agents/.claude/.workbuddy/skills-lock.json）、target/录制/config.env；作者 onceMisery <cmiracle@163.com>。用户已确认其设计评审与运行时决策文档修改（架构 v2.6 十项定案、PRD v2.4、契约 v1.3、矩阵 v1.4 等）为权威；这些 M1/M3+ 精修与本检查点收口仍为未暂存修改，待提交授权。
- 最终门禁（2026-11-12 复跑，日志 target/m0-continue/final-*.log）：fmt/check/clippy(-D warnings)/test 全过（38 项 Rust 测试，0 失败）；gpui-fast feature 构建过；Node 11/11 + 208/12 fixture、125 规则过（含 CI 同款 OMNIA_*_SOURCE 环境变量本地验证）；check-docs 过（19 份文档、76 链接、177 编号）。
- 探针终态：omnia-app 5/5（含新增 CJK 输入测试）+ omnia-gpui-probes 7/7（shell 2 + shell_runtime 3 + host_bridge 2），主代理独立复跑确认；F6 数字 gpui-pre p50=18.066/p95=30.722ms vs gpui-fast p50=13.189/p95=19.098ms（无头 CPU、dev profile）。
- 原版隔离基线 target/baseline/vcptoolbox（139 文件冻结导出 + hash，含 jev_tool_call_exp.json 与 JevToolCallDecision.txt 两个 mandatory 静态文件；npm ci 785 包）；录制产物 contract/recordings/original（gitignore）；不含真实配置/用户插件/数据。
- 文档终态：契约 v1.3、PRD v2.4、矩阵 v1.4、架构 v2.6（含用户设计评审与运行时决策同步）、基线记录 v1.2（ApiRetryDelay 行）、fixture 报告 v1.2、GPUI 实测报告 v1.2、构建与验证 v1.2 均入 README 索引。
- 远程 CI 结论（2026-11-12 经 7890 代理读取 GitHub 公共 API）：run `43219179413`（commit `61c8bc8`）三 job 均 `completed | success`、无失败步骤；本机 check-docs 复跑过（20 份现行文档、97 链接、178 编号，含用户新增设计评审/运行时决策）。

## 远程 CI 结论（已闭合）

- 远程 CI 三平台全绿：GitHub Actions run `43219179413`（workflow「M0 quality gates」，commit `61c8bc8`，2026-11-12T12:34:44Z）三个 job 均 `completed | success`、无失败步骤——`quality (windows-latest)`、`quality (ubuntu-24.04)`、`quality (macos-15)`。每个 job 跑完 fmt/check/clippy(-D warnings)/test + 冻结基线检出 + Node 契约 harness（source-fixtures/normalization/runtime + 清单校验）+ gpui-fast 构建 + check-docs。据此 M0 DoD「骨架 CI 全绿 + GPUI 空窗口三平台构建」达成：三平台 `cargo check --workspace --all-targets` 与 `cargo test`（含 omnia-app/探针无头窗口测试，无平台门控）均编译并通过。
- 证据边界：CI 验证的是三平台**构建 + 无头窗口测试 + 源码 fixture harness**，非原生 GPU 窗口呈现；Linux/macOS 本机原生启动、release profile、原版 HTTP 录制（仅 Windows 本机）仍未跑。读取经 7890 代理访问 GitHub 公共 API（出口 IP 限流，已取到 run/jobs 结论；逐平台测试计数日志未取）。

## 未完成（M1+，非 M0 出口）

- release profile、GPU 呈现与长测、真实远端 WS、四象限 e2e（M1+）：见两份验证报告的未验证清单。
- 用户设计评审 R-01～R-09（Loom 36 命令、Scriptorium 3.4.0/33、M2 标签/共现按代码重写、manifest 值域容错等）属 M2/M4/M5 与 M1 实现前冻结责任，非 M0 出口；见 [设计文档评审](../../../Omnia-设计文档评审-2026-11-12.md)。

## 修订记录

- v1.5（2026-11-12）：远程 CI 三平台全绿经 7890 代理读取 GitHub API 确认（run 43219179413 / commit 61c8bc8，windows/ubuntu/macos 三 job success、无失败步骤）；M0 DoD「骨架 CI 全绿 + GPUI 空窗口三平台构建」达成。审计 US-001～007 与 DoD 全部满足（LICENSE/THIRD_PARTY_NOTICES 存在、GPUI 无头测试无平台门控、US-006 35 组录制 ≥20）。同步检查点与三份验证报告（fixture/GPUI/构建 v1.2）记录 CI 结论，诚实区分三平台构建/无头窗口与原生 GPU 呈现。用户设计评审与运行时决策（架构 v2.6 等）为 M1/M3+ 精修，不改 M0 骨架与 fixture。
- v1.4（2026-11-12）：用户授权后提交并推送——root-commit `2109a06`（918 文件）合并 GitHub 初始提交 `fdc6fa4` 得 `61c8bc8`，经 7890 代理推送至 onceMisery/omnia，远端 ref 核对一致；CI 由 push 触发，结论待 Actions 确认（本机 API 限流/无 gh）。在制架构文档新增保留为未暂存。
- v1.3（2026-11-12）：跨平台静态就绪审查（非实际构建）——冻结基线 owner、工具链组件、cfg 门控、CI 依赖均核对通过，无需代码修复；Linux/macOS 实际构建仍待提交授权后由 CI 闭合。
- v1.2（2026-11-12）：补齐交接清单最后一项「CJK 输入」——新增 `cjk_input_reaches_the_display_name_and_chat_greeting` 无头测试（问候语 div 加 aria_label+test_support 以回读）；omnia-app 4→5、Rust 总数 37→38；fmt/clippy/test/gpui-fast 复跑全绿；GPUI 报告升 v1.1、构建与验证升 v1.1。
- v1.1（2026-11-12）：M0 接续会话收尾；F1～F8 证据闭合（除跨平台）、三份报告建立、最终门禁 8/8 通过、文档版本同步；剩余项收敛为远程 CI/跨平台外部依赖。
- v1.0（2026-11-12）：M0 实施中断检查点。