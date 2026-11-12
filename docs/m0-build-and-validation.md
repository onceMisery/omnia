# Omnia · M0 构建与验证 v1.1

- 版本 / 日期：v1.1 / 2026-11-12
- 状态：生效；US-001 工程门禁与本机验证记录。质量规则见 [代码风格与质量约束](Omnia-代码风格与质量约束.md) §7–§9；fixture 证据见 [fixture 报告](fixture-report.md)，GPUI 实测见 [GPUI 实测报告](m0-gpui-validation.md)。
- 本机平台：Windows 11 x64（10.0.26200）；Rust 1.99.1（rust-toolchain.toml 锁定，含 clippy/rustfmt）；Node 22.14.0。

## 1. 工程与包矩阵

Cargo workspace（resolver 3，edition 2024）成员：`crates/*` 与 `contract`。Cargo.lock 锁定 1022 包。

| 包 | 角色 | M0 状态 |
| --- | --- | --- |
| omnia-config | C-06 配置加载 | 实现+审查通过 |
| omnia-protocol | C-12 解析/转义/思考块 | 实现+审查通过 |
| omnia-app | GPUI 开发预览（ui_adapter 收敛） | 窗口/设置/验证页；M1 聊天未实现 |
| omnia-gpui-probes | 独立实验包：gpui-shell =0.9.1（default-features=false + quickjs，显式关闭上游默认 WebView） | F4/F5 探针 |
| omnia-contract-tests（contract/） | 依赖冒烟与 Node fixture harness | 通过 |
| omnia-agent / omnia-model / omnia-plugin / omnia-server | M1 边界包 | 仅文档注释占位，无虚假业务 API |

feature 矩阵：默认后端 gpui-pre =0.3.12（gpui-kit =0.9.1 传递锁定）；`omnia-app/gpui-fast` 为可选实验 feature（gpui-fast 0.1.14），锁文件已统一其 taffy 0.15.0 / unicode-properties 0.1.3 约束。vendored 成员当前为空；CI 以 `crates/*` 自动覆盖全部自研成员，引入 vendored 成员前必须先建立显式选包边界（ci.yml 注释登记）。

## 2. 本机门禁结果（2026-11-12 复跑）

| 命令 | 结果 |
| --- | --- |
| `cargo fmt --all -- --check` | 通过 |
| `cargo check --workspace --all-targets --locked` | 通过 |
| `cargo clippy --workspace --all-targets --locked --no-deps -- -D warnings` | 通过 |
| `cargo test --workspace --locked` | 通过（38 项测试，26 个 ok 结果块，0 失败） |
| `node --test contract/tests/source-fixtures.test.mjs contract/recorder/normalization.test.mjs contract/recorder/runtime.test.mjs` | 11/11 通过 |
| `node contract/recorder/verify-source-fixtures.mjs` | 208 执行 + 12 静态 fixture、125 规则正反例通过 |
| `node scripts/check-docs.mjs` | 通过（19 份现行文档，76 个本地链接，177 个定义编号） |

依赖冒烟（contract/tests/dependency_smoke.rs，真实 I/O）：reqwest 0.13 经真实本地 HTTP socket 读取 SSE（含中文 delta）；rusqlite 0.42 建冻结 DDL、WAL、外键、事务回滚与重开索引核验；cron 0.17 拒绝原版五字段表达式——**US-010 必须显式补秒字段适配**，已登记为承接要求。

## 3. 构建与首跑（开发预览）

```powershell
rustup show                      # 安装锁定工具链 1.99.1
cargo run -p omnia-app --locked  # 原生窗口：聊天预览页 + 设置页
```

- 设置页仅本次运行生效：显示名称、深色外观；不读写原版 AppData，不连接服务器。
- 实验后端对比：`cargo test -p omnia-app --lib measure_virtualized_scroll_cpu --features gpui-fast --locked -- --nocapture`（默认后端去掉 `--features`）。
- 探针：`cargo test -p omnia-gpui-probes --locked`。
- Windows 原生启动验证：进程启动后窗口渲染中文界面，`CloseMainWindow()`（WM_CLOSE）后退出码 0（2026-11-12 实测，截图存本机 target/m0-continue/f1-window.png，不入库）。
- Linux 首跑需 CI 所列系统依赖（libasound2/xkbcommon/wayland/vulkan/fontconfig 等）；macOS 无额外步骤。两平台本机未运行。

## 4. CI 配置与执行状态

`.github/workflows/ci.yml`：windows-latest / ubuntu-24.04 / macos-15 矩阵，fail-fast=false；步骤为 fmt → check → clippy(-D warnings) → test → 冻结基线检出（VCPToolBox/VCPChat 固定 commit，供 Node 契约 harness 经 `OMNIA_*_SOURCE` 读取）→ Node contract harness（source-fixtures/normalization/runtime 测试 + 清单校验）→ gpui-fast 实验构建 → 文档检查。任一失败阻断，无 continue-on-error。

**远程 CI 尚未执行**（仓库无提交/远端）；配置存在不代表全绿。三平台构建与运行证据由 CI 或实机补齐前保持未验证。原版录制对拍（compare-original/record-original）依赖本机隔离基线与录制产物，不在 CI 运行，属本地证据。

## 5. 文档与许可状态

LICENSE（冻结 VCPToolBox 原文）与 THIRD_PARTY_NOTICES.md 基础版本已建立；后者已登记 gpui-shell 0.9.1（Apache-2.0）、quickjs-jit 0.14.1（MIT）、gpui-fast 0.1.14（Apache-2.0，仅实验）。完整分发审计由 US-425 核定。文档结构检查覆盖 docs 全部 .md 的版本元数据与 README 索引；三份报告（fixture/构建/GPUI）均已建立并复核通过（§2）。

## 6. 未验证清单

- Linux/macOS 本机构建与运行；远程 CI 全绿。
- release profile 构建与打包（M0 仅 dev profile 实测）。
- M1 服务/聊天、四象限 e2e、真实插件与 AppData 兼容（后续阶段）。
- gpui-fast 的 GPU 呈现性能与稳定性长测（M0 仅无头 CPU 对比，见 GPUI 报告 F6）。

## 7. 修订记录

- v1.1（2026-11-12）：补齐 CJK 输入无头测试后复跑门禁，`cargo test --workspace` 计数 37→38（26 个 ok 块，0 失败）；fmt/clippy/gpui-fast check 复跑全绿。
- v1.0（2026-11-12）：M0 接续会话建立；门禁复跑全绿（Rust+Node），CI 增补 Node harness 与 gpui-fast 构建步骤，归属清单补实验依赖。