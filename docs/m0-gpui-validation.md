# Omnia · M0 GPUI 实测报告 v1.2

- 版本 / 日期：v1.2 / 2026-11-12
- 状态：生效；M0M1 PRD **US-007** 交付的 F1～F8 实测记录，条目定义见[前端框架选型](Omnia-前端框架选型.md) §6。质量规则见[代码风格与质量约束](Omnia-代码风格与质量约束.md)；工程门禁见 [M0 构建与验证](m0-build-and-validation.md)。
- 实测平台：Windows 11 x64（10.0.26200）单机；Rust 1.99.1（rust-toolchain.toml 锁定）；dev profile；无头测试为主，F1 含一次真实原生窗口启动。
- 锁定版本：gpui-kit =0.9.1（gpui-component/gpui-base 同版）；默认后端 gpui-pre =0.3.12；实验后端 gpui-fast 0.1.14（opt-in feature）；gpui-shell =0.9.1（default-features=false + quickjs，显式关闭上游默认 WebView）；quickjs-jit =0.14.1。

## 1. 结论摘要

| 项 | 结论 | 状态 |
| --- | --- | --- |
| F1 三平台构建/窗口 | Windows 构建+原生启动+中文渲染+正常退出实测通过；三平台构建+无头窗口 CI 全绿（run 43219179413）；Linux/macOS 原生 GPU 呈现待实机 | 构建通过 |
| F2 千条消息虚拟化 | 1000 条仅构建可见行，滚动/跳转/缩放通过（无头 CPU） | 通过 |
| F3 增量 Markdown+竞态 | 跨片段粗体/代码围栏渲染正确；session/generation/message 三元组与停止/重试竞态全部拒绝 | 通过 |
| F4 gpui-shell 运行时 | fs 二进制/WS 二进制/zlib 原 bug 三场景 + 授权/崩溃隔离/热重载全部通过 | 通过 |
| F5 HostModule 边界 | plain-data 六型往返、插入序与 Unicode 保持；回调被拒且视图存活 | 通过 |
| F6 gpui-fast 对比 | 无头 CPU 快于 gpui-pre（p50 13.189 vs 18.066ms）；证据不足以切换，保留 gpui-pre 默认 | 完成，不切换 |
| F7 无头 UI 测试 | 输入驱动+状态断言在 omnia-app 与探针包共 12 项测试跑通 | 通过 |
| F8 视频/多媒体 | 锁定 GPUI 栈无原生视频组件与音频 I/O 依赖，缺口确认；降级决策由 BP-07/SC-11 承接 | 缺口确认 |

F4/F5 全通过支持既定脚本分支（原生 QuickJS 子集、无 WebView）继续作为 M3 插件脚本运行时基础；探针级验证不代表 Omnia 自有集成已就绪。

## 2. 复现命令

```powershell
cargo test -p omnia-app --lib --locked            # F2/F3/F6/F7：验证页与流式探针
cargo test -p omnia-gpui-probes --locked          # F4/F5/F7：shell 与 HostModule 探针
cargo test -p omnia-app --lib measure_virtualized_scroll_cpu --locked -- --nocapture          # F6 默认后端
cargo test -p omnia-app --lib measure_virtualized_scroll_cpu --features gpui-fast --locked -- --nocapture  # F6 实验后端
cargo run -p omnia-app --locked                   # F1 原生窗口（聊天预览页+设置页）
```

## 3. F1 三平台构建与窗口

- Windows：`cargo check --workspace --all-targets --locked` 与 `cargo run -p omnia-app --locked` 实测通过；原生窗口渲染中文界面（聊天预览+设置页），`CloseMainWindow()`（WM_CLOSE）后进程退出码 0（2026-11-12 实测；截图存本机 target/m0-continue/f1-window.png，不入库）。
- 设置页仅本次运行生效，不读写原版 AppData、不连接服务器。
- Linux/macOS：CI 矩阵（ubuntu-24.04/macos-15，含系统依赖安装步骤）**远程 CI 已执行并三平台全绿**（run 43219179413 / commit 61c8bc8，三 job 均 success、无失败步骤）；两平台 `cargo check --workspace --all-targets`、`cargo test`（含 omnia-app/探针无头窗口测试，无平台门控）与 gpui-fast 构建均通过。hello-chat 级**无头窗口**跑通已由 CI 闭合；**原生 GPU 窗口呈现**仍待实机（CI 为无头，不含 GPU 呈现）。

## 4. F2 千条消息虚拟化

测试 `thousand_messages_virtualize_scroll_and_append_markdown`（crates/omnia-app/src/ui_adapter/validation/tests.rs）：

- 输入：1000 条合成中文消息，行高 6/7rem 交替；960×680 窗口。
- 断言：首帧仅构建 1～30 个 ListItem（虚拟化生效）；滚轮 -250px 后偏移为负；点击「末条」后 message-999 可见且 message-0 不存在，「首条」反向同理；resize 至 720×540 + scale factor 1.5 后重渲染，行几何按新 rem 失效重建，跳转仍正确。
- 结果：通过。组件路径为 gpui-component Bubble/Message + gpui-base v_virtual_list。
- 局限：无头 CPU 证据；「滚动流畅」的 GPU 呈现帧率未实测（见 §11）。

## 5. F3 增量 Markdown 与竞态防护

- 增量渲染：4 个片段把粗体（`**中`/`文**`）与 rust 代码围栏拆在片段边界，逐次点击追加后 `rendered_text()` 含「正文 中文」「let answer = 42;」「已完成」；4/4 后追加按钮禁用。
- 竞态三元组：`stale_triples_and_cancelled_streams_cannot_change_rendered_markdown`（crates/omnia-app/src/ui_adapter/stream_probe.rs）断言错误 session/generation/message 的追加全部被拒（BAD_* 不进入渲染），stop 后追加被拒（AFTER_STOP），restart 换新 generation 后旧 key 迟到追加被拒（LATE_RETRY），最终渲染恰为「新话题」。
- 验证页「重试」按钮递增 session+generation 并重置 next_chunk=0，与探针语义一致。
- 结果：通过。生产流式生命周期属 US-019，本探针仅验证可行性。

## 6. F4 gpui-shell 0.9.1 Windows 运行时

探针包 omnia-gpui-probes，7 项测试全部通过（2026-11-12 本机独立复跑与最终门禁复跑一致；日志 target/m0-continue/probes-rerun.log 与 final-test.log）：

| 子项 | 测试 | 证据要点 |
| --- | --- | --- |
| fs 二进制+zlib+HostModule | shell.rs `native_shell_round_trips_binary_files_zlib_and_host_values` | 脚本经 fs/promises 写读 `[0,255,42,128]`，deflate/inflate 往返，host 函数返回中文；落盘字节逐一相等 |
| 能力授予 | shell.rs `a_script_cannot_write_without_a_grant` | 无 write_roots 授权时写入被拒（denied），文件不存在 |
| WS 二进制 | shell_runtime.rs `websocket_binary_frames_round_trip_through_an_echo_server` | Rust 起 127.0.0.1 回环 tungstenite 回显服务器；脚本 WebSocket 发送非 UTF-8 字节 `[0,255,42,128,7,254]`，回读为 Uint8Array 且逐字节相等；network_hosts 授权 |
| 崩溃隔离 | shell_runtime.rs `a_render_error_is_observable_and_the_runtime_keeps_loading` | render 抛错记录 build_error、首帧无快照；崩溃窗口继续渲染不 panic；同一 runtime 随后加载健康应用正常渲染 |
| 热重载 | shell_runtime.rs `hot_reload_replaces_the_view_when_main_js_changes` | try_load+watch 公开 API；改写 main.js 后视图由 before-reload 更新为 after-reload，无需重新挂载 |

- 原 bug 三场景（fs 写入/WS 二进制/zlib）在 quickjs-jit =0.14.1 下全部通过，无回归。
- 局限：WS 为环回合成服务器而非真实远端；授权按主机名匹配（不校验端口，与 0.9.1 行为一致）；热重载为轮询 watcher（250ms executor 时钟 + 200ms 墙钟 debounce），非瞬时；崩溃隔离验证脚本异常/render 错误层，非原生进程级 segfault。

## 7. F5 HostModule plain-data 边界

测试 host_bridge.rs（2 项，均通过）：

- `host_calls_round_trip_plain_data_in_insertion_order`：脚本传入含中文、小数、布尔、null、嵌套数组/对象的 plain object；Rust 侧逐字段断言 HostValue 六型与插入序；host 返回 Object 字段序（z/a/echo）经 JSON.stringify 原样保持，Unicode（中文/末/二）无损。
- `host_calls_reject_callbacks_without_breaking_the_view`：脚本向 host 函数传回调被拒，错误信息含 "plain data only"；视图 build_error 为空、正常渲染拒绝文本；host 函数体未被执行。
- 结论：Rust 函数可安全借给脚本，边界只允许 plain data；业务桥（M3）按此约束设计。

## 8. F6 gpui-fast 与上游快照对比

- 方法：`measure_virtualized_scroll_cpu`，130 次首/末条交替跳转，前 10 次预热，120 样本取 p50/p95/max；dev profile、无头，测的是布局+输入处理的 CPU 时间，**不含 GPU 呈现**。
- 结果（2026-11-12，Windows 本机，max_rows=5 两后端一致）：

| 后端 | p50 | p95 | max |
| --- | --- | --- | --- |
| gpui-pre 0.3.12（默认） | 18.066ms | 30.722ms | 42.199ms |
| gpui-fast 0.1.14（实验） | 13.189ms | 19.098ms | 22.339ms |

- 决策：**保留 gpui-pre 为默认后端，不切换**。gpui-fast 保持 opt-in 实验 feature，CI 单独构建验证（三平台构建全绿）。理由：M0 仅有单机无头 CPU 证据，无 GPU 呈现、长稳与三平台性能数据；切换收益不足以抵消未验证风险。M4 US-330 引用本结果，M5 US-414 推广前须按选型 §6 重新验证。

## 9. F7 无头 UI 测试

- harness：`gpui_kit::test` + TestAppContext/TestWindowExt；输入驱动（click/press 键盘/scroll/resize/scale factor/时钟推进）+ 状态断言（可见性、禁用态、checked、主题、渲染文本、build_error）。
- 覆盖：omnia-app 5 项（设置页鼠标+空格键切换主题并返回聊天、CJK 显示名输入并经无障碍标签回读聊天问候、千条消息、CPU 测量、竞态三元组）+ omnia-gpui-probes 7 项（F4/F5），全部无头通过，无跳过/忽略。
- CJK 输入：`cjk_input_reaches_the_display_name_and_chat_greeting`（crates/omnia-app/src/ui_adapter/tests.rs）向显示名输入框键入「星野测试」，断言 InputState 值含中文且保留原占位「用户」（光标处插入而非整段替换）；返回聊天页后通过 `chat-greeting` 的无障碍标签回读问候语含该中文名。问候语 div 为此加 `.aria_label` + `.test_support()`，使无头测试可回读渲染文本（纯文本快照不覆盖普通 div）。
- 结果：通过。真实窗口事件循环与 GPU 帧不在本项范围（F1 已单独实测原生启动）。

## 10. F8 视频/多媒体缺口

- 证据：gpui-component 0.9.1 源码无 video 组件；Cargo.lock（1022 包）无音频采集/播放 crate（cpal/rodio/ffmpeg 等均不存在）；objc2-core-video 仅为 gpui-pre/gpui-fast 的 macOS 平台绑定传递依赖，zed-scap/screencapturekit 为屏幕采集绑定，均不构成视频播放或音频 I/O 能力。
- 结论：锁定 GPUI 栈**无原生视频与音频 I/O 能力**，缺口确认。
- 影响与承接：BP-07（3D 音乐舞台/视频/3D 骰子）按既定降级路径——2D 舞台 6 模式 P0，3D/2.5D 降级 P1；视频化能力（含 SC-11 动态壁纸视频化）与 M5 P1 语音须在 M5 规划时决策降级或引入外部引擎，逐项记录批准差异。clean-room 边界不变：当前工作区无 vendored 音频引擎，不复制 Zed/Folia 源码。

## 11. 未验证清单

- Linux/macOS 本机原生 GPU 窗口呈现（远程 CI 已验证三平台构建 + 无头窗口测试全绿，F1 构建出口已闭合；原生呈现仅 Windows 实测）。
- GPU 呈现帧率与长稳（F2「流畅」与 F6 切换决策的补充证据）。
- release profile 构建（M0 仅 dev profile）。
- 真实远端 WebSocket、进程级崩溃隔离（F4 局限）。
- M1+ 聊天/服务集成后的运行时行为（本报告仅探针与验证页）。

## 12. 修订记录

- v1.2（2026-11-12）：远程 CI 三平台全绿确认（run 43219179413 / commit 61c8bc8，windows/ubuntu/macos 三 job success、无失败步骤）；F1 由「部分通过」改为「构建通过」——三平台构建 + 无头窗口测试 CI 闭合，Linux/macOS 原生 GPU 呈现仍待实机；§3/§11 同步，F6 决策理由精确为「三平台性能数据」（CI 给构建/无头正确性，非性能）。F2～F8 实测证据不变。
- v1.1（2026-11-12）：补齐 CJK 输入无头测试（`cjk_input_reaches_the_display_name_and_chat_greeting`），F7 计数 omnia-app 4→5、合计 11→12；问候语 div 加 `.aria_label`+`.test_support()` 以支持无头回读。
- v1.0（2026-11-12）：M0 接续会话建立；F1～F8 逐项实测记录，F4/F5 探针补齐（shell_runtime.rs、host_bridge.rs），F6 决策保留 gpui-pre，F8 缺口确认并登记承接。