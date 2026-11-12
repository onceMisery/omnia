# Omnia · M0 fixture 与基线对拍报告 v1.2

- 版本 / 日期：v1.2 / 2026-11-12
- 状态：生效；M0（US-006）证据记录。责任 US：US-006；契约权威见 [M0M1 协议契约](Omnia-M0M1-协议契约.md)，基线见 [基线记录](基线记录.md)。
- 平台：Windows x64（本机实测）；Rust 1.99.1、Node 22.14.0。远程 CI 三平台全绿（源码 fixture harness + 门禁，run 43219179413）；Linux/macOS 本机原版录制未运行，见 §6。

本报告区分三类证据：**冻结源码构造**（固定输入在冻结源码 VM/静态切片上执行）、**真实 HTTP 录制**（隔离原版服务器 + 合成模型/插件）、**未覆盖项**。源码构造通过不等于运行链路通过；录制通过不等于原版 VCPChat 界面端到端通过。

## 1. fixture 库清单（392 份，全部含 meta 出处）

| 目录 | fixture 数 | 覆盖 |
| --- | --- | --- |
| c01-injection | 42 | 双通道注入、批次/摘要、base64 分支、archery、审核留言 |
| c02-stdio | 40 | C-02 执行协议九条、C-12.5 格式化；另含冻结 DDL `tool-call-records.sql` |
| c03-instructions | 10 | 指令模板逐字符、占位符首处展开/VCPAllTools |
| c04-sse | 14 | 事件序列、心跳/超时出处、批次/分隔符/final-stop |
| c05-interrupt | 32 | 硬中止四态、门控 8 分支、2s fail-open |
| c06-dotenv | 38 | C-06 补丁语义边界（重复键/插件文件名/引号/NUL 等） |
| c07-approval | 8 | 审核开关/工具名匹配/拒绝 JSON/超时文案 |
| c08-appdata | 18 | topics/history/瞬态过滤/原子写/路径校验 |
| c09-connection | 20 | 请求构造、SSE 主/备用提取链、中断时序 |
| c10-pipeline | 8 | 17 步管线骨架与 M1 裁剪映射 |
| c11-http | 28 | 认证/中间件顺序/回调/只读边界 |
| c12-parser | 134 | 规范/容错标记、字段、转义、思考块剥离 |

规则覆盖：`node contract/recorder/verify-source-fixtures.mjs` 于 2026-11-12 复跑通过——**208 份冻结源码执行 fixture + 12 份静态证据 fixture，125 条规则具备正例+反例**；清单校验拒绝缺失 fixture、runner/输入/规则/出处漂移。meta 区分 `frozen-source-execution` 与静态证据来源，禁止以源码构造冒充运行录制。

## 2. 冻结源码差分（本机 2026-11-12 复跑）

| 包 | 命令 | 结果 |
| --- | --- | --- |
| omnia-config | `cargo build -p omnia-config --example parse_dotenv --locked --target-dir target/config-check` 后 `node crates/omnia-config/tests/verify-baseline.mjs D:/code/github/VCPToolBox target/config-check/debug/examples/parse_dotenv.exe` | 32 份 C-06 固定用例一致；**4032 组** Rust/冻结 Node 差分一致（seed 0xC06） |
| omnia-protocol | `cargo build -p omnia-protocol --example protocol_probe --locked --target-dir target/protocol-check` 后 `node crates/omnia-protocol/tests/verify-baseline.mjs D:/code/github/VCPToolBox target/protocol-check/debug/examples/protocol_probe.exe` | 134 份 C-12 fixture 一致；**36134 组**差分一致（seed 0xC12） |

独立审查期间的额外定向对拍（config 19200 组、protocol 8154 组）记录于 [M0 实施检查点](aegis/work/2026-11-12-m0/20-checkpoint.md)，属前次会话证据；本日复跑以上表为准。单元测试：omnia-config 17+1、omnia-protocol 4 项 API 测试，随 `cargo test --workspace --locked` 通过（2026-11-12 终态，38 项全过）。

## 3. 真实 HTTP 录制（35 组，两次运行一致）

隔离环境：`prepare-original.mjs` 从冻结 commit 白名单导出 139 文件（含原生 vexus-lite 内核），逐文件 SHA-256 校验；`npm ci` 安装冻结锁文件依赖（785 包）。不复制私人配置、用户插件或数据。

- 运行前 `verifyBaselineTree` 复核全部冻结哈希；`loopback.cjs` 仅改 listen 地址为 127.0.0.1（有专项测试），冻结路由/处理器不变。
- 26 组对话场景：单/多工具、流式/非流式、ShowVCP 隐藏/强制、mark_history、内外层错误、JSON/字符串结果、富文本/图片/base64、valet、archery 成功/失败/混合、循环上限、流式/非流式中断。
- 9 组 C-11 HTTP 边界：admin 无认证/错误 Basic、AdminPanel JSON 401 与 HTML 302、只读端点、回调无/错误/有效 Bearer、特殊模型路由认证。
- 归一化只替换服务器生成的时间戳/编号，保留 SSE 空行、事件顺序与正文；批次 START/END 配对与时间单调性被强制校验。
- 首轮 `contract/recordings/original`（09:37 UTC）与复跑 `contract/recordings/final-checked`（10:13 UTC）均 35/35 断言通过；`node contract/recorder/compare-original.mjs contract/recordings/final-checked` 本日复核：**35 组与入库 expected 快照完全一致**。
- 失败路径清理：请求失败/取消后 finally 杀进程树（Windows `taskkill /T /F`）、关闭日志与 mock；manifest 以 `wx` 独占写入，成功才认证断言与清理完成。

录制证明的是**原版 HTTP 服务链路 + 合成模型/插件**，不是原版 VCPChat Electron 界面 e2e，也不是逐规则全量运行覆盖。

## 4. 契约勘误回写

录制与差分发现的文档事实错误已按基线记录流程回写 [协议契约 v1.2](Omnia-M0M1-协议契约.md)：C-01 base64 仅 fallback JSON 分支、C-04 心跳/超时出处（streamHandler.js:191,297-338）、C-07 超时实现出处（Plugin.js:1364-1379）、C-09 主/备用 SSE 提取链、C-12 子串匹配/ESCAPE 变体/maid 镜像/JS 对象与保护域规则。配置缺省 `ApiRetryDelay` 1000ms（示例 200ms）勘误见 PRD v2.3。勘误后重新对拍通过（§2、§3）。

## 5. 复现命令汇总

```powershell
cargo test --workspace --locked
node --test contract/tests/source-fixtures.test.mjs contract/recorder/normalization.test.mjs contract/recorder/runtime.test.mjs
node contract/recorder/verify-source-fixtures.mjs
node contract/recorder/compare-original.mjs contract/recordings/final-checked
# 重新录制（需先 prepare + npm ci；输出目录必须为空）
node contract/recorder/prepare-original.mjs D:/code/github/VCPToolBox target/baseline/vcptoolbox
node contract/recorder/record-original.mjs target/baseline/vcptoolbox contract/recordings/<new-run>
```

## 6. 未覆盖与未验证（不得据此签署全产品兼容）

- 四象限 e2e（US-021/022）、原版真实插件目录挂载、真实 AppData 往返：M1 责任，未运行。
- Linux/macOS 上的原版录制（§3）与 Rust/冻结 Node 差分（§2 `verify-baseline`）：未运行，仅 Windows 本机实测；prepare 脚本支持三平台 x64 内核导出。CI 在三平台运行的是源码 fixture harness（`verify-source-fixtures`，§1），不含 §2 差分与 §3 录制。
- 远程 CI：已执行并三平台全绿（run 43219179413 / commit 61c8bc8，windows/ubuntu/macos 三 job success、无失败步骤）。CI 运行源码 fixture harness（source-fixtures/normalization/runtime + 清单校验）与全部门禁，**不含原版 HTTP 录制**（compare-original/record-original 依赖本机隔离基线与录制产物）。
- 逐规则运行级覆盖：125 条规则的正反例为源码构造/静态证据，运行级录制仅覆盖 §3 场景集。
- 原版 VCPChat 前端行为：未验证。

## 7. 修订记录

- v1.2（2026-11-12）：远程 CI 三平台全绿确认（run 43219179413 / commit 61c8bc8）；§6「远程 CI 未执行」改为已执行全绿，并区分 CI 运行的源码 fixture harness 与仅 Windows 本机的 §2 差分/§3 原版录制。fixture/录制/差分证据本身不变。
- v1.1（2026-11-12）：同步 `cargo test --workspace` 终态计数 37→38（补齐 CJK 输入无头测试后复跑）；fixture/录制证据本身不变。
- v1.0（2026-11-12）：M0 接续会话复跑差分/清单/对拍后建立；汇总 392 fixture、35 组录制与契约 v1.2 勘误闭环。