# Omnia 代码风格与质量约束补充记录

- 日期：2026-11-12
- 状态：已完成文档补充与核验；过程记录，不是另一份规范或产品 CI 执行报告。
- 授权：用户要求代码编写质量高、可维护，遵守 DRY、YAGNI 等设计原则，并补充代码风格约束。
- Goal：把质量要求转成可执行规则、检查命令和审查门禁，使后续编码任务能自动发现并遵守。
- Architecture：规范仅在 docs/Omnia-代码风格与质量约束.md 定义；AGENTS.md 负责发现入口，README 负责导航，PRD 引用公共门禁。
- Tech Stack：既定 Rust/GPUI、框架版本、sidecar、vendoring 与兼容边界不变。
- Baseline/Authority Refs：README §4–§7、架构 §2.1/§7、M0M1 PRD US-001、使用与维护 §4/§6。
- Compatibility Boundary：不得用简洁、强类型或去重改变原版协议、默认值、错误/时序和数据往返；上游/vendor 代码不做无关风格改写。
- ArchitectureReviewRequired: yes
- Verification：node scripts/check-docs.mjs；人工核对引用、重复规则退役、技术版本与契约边界；没有产品 workspace，不宣称 Rust CI 已运行。

## 执行步骤与影响

- [x] 新增唯一规范：DRY/YAGNI/KISS、职责与接口、Rust 风格、错误/并发/数据、测试、机械门禁、人工审查与窄范围例外。
- [x] 新增简短 AGENTS.md，只引用规范及现行文档，不复制规则或额外规定技术选型。
- [x] README、架构与使用维护接入规范；US-001 承接 CI 落地，M0–M5 共用质量门禁，阶段专属验证保持不变。
- [x] 文档结构检查和语义复核；记录检查证据。

## 取舍与退役

不为本次文档工作添加产品代码、Cargo 配置、新 lint 依赖或另一套治理目录。当前工具链命令是 US-001 的实现要求；文档检查脚本不会冒充 DRY/YAGNI 语义检查器。

各 PRD 重复的通用 Cargo 命令改为引用新规范；特殊契约/无头 UI/内核/跨平台验证仍由原阶段 PRD 定义。短 AGENTS.md 不持有第二份质量标准。

规则以真实责任与风险为依据：不设机械的文件/函数行数或百分比覆盖率指标，不强制为单实现增加 trait，不以零重复文本替代领域正确性。上游风格隔离不得隐藏自研代码告警或跳过必需契约测试。

## 验证与结果

- 工作前快照：`C:\Users\miracle\AppData\Local\Temp\omnia-before-code-quality-hH6KoN`。
- `node scripts/check-docs.mjs`：14 份现行文档、45 个本地链接、177 个定义编号通过；AGENTS 内入口链接另外核对存在。
- 与快照逐段比较：README 技术前提、架构目标/模块/接口/技术章节及 M0–M5 行为规格未变；只更新版本、公共质量门禁引用、US-001 的质量交付责任和维护导航。
- 原通用 Cargo 三命令副本从架构和各 PRD 退役；内核、无头 UI、协议对拍和跨平台专属验收仍保留。
- 人工复核：DRY 不强制合并变化原因不同的相似代码；YAGNI 不豁免必要质量保障，也不否定契约明确要求的阶段占位；vendored 风格隔离不能漏检自研代码或跳过必需兼容验证。
- 架构一致性复核完成：新规范只定义编码和交付质量，不改变模块归属、运行时或兼容边界；AGENTS 是入口，不是第二个规则所有者。
- 未新增产品代码、Cargo/CI 配置或工具链依赖；当前仍无 Cargo workspace，未执行或宣称 Rust 检查通过。CI 的具体包列表和平台矩阵由 US-001 在工程建立时落地。
