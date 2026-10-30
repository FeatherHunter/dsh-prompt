# 真机测试 kit 的三层分层与机器绑定政策（#193）

**状态**：accepted（2026-10-31，spec #183 / 票 #193 落地）。

## 背景

- 真机测试 kit 已由 #185–#192 逐层落地：运行期绑定（#185）、静态门禁（#186）、fixture（#187）、
  观测层（#188）、判定与证据报告（#189）、钩子契约（#190）、差分与故障注入（#191）、套件迁移与第二条套件（#192）。
- 但「怎么审、怎么判、怎么留证据、怎么反审」这些方法仍散在实现文档里。后来者要跨 profile、跨机器复用，
  需要一条不复制实现的**分发通道**。
- 真机测试天然带运行期绑定（机器路径、端口、浏览器、凭据）。一旦绑进测试逻辑或文档，
  换机器即失效，跨宿主版本也说不清是产品坏还是环境坏。

## 决定

1. **三层职责固定**：
   - **方法层**：审查协议、判定分类、证据协议、反例维度、机器绑定政策；跨栈可移植；
   - **平台契约层**：DSH 宿主契约（host-contract / hooks / observability），按宿主 runtime 版本钉住，
     宿主行为变化先落在契约层与 preflight；
   - **运行期绑定层**：机器路径、端口、浏览器、凭据、被测产物；只作为运行期输入与证据 provenance 出现。
2. **方法层分发走用户级 skill**：仓内 `skills/real-evidence/` 是单一事实源；用户级 skill 根是约定位置
   `$DSH_HOME/skills`（未设置时 `~/.dsh/skills`），形态为 `<skill-root>/<name>/SKILL.md`，只扫一层，
   目录刷新由宿主 watcher 处理。**安装是运行期动作**（复制目录），不把安装命令/结果写进仓库。
3. **方法层只写方法与接口，不写实现细节**：命令参数、钩子名、套件结构属于实现层；
   方法层需要时用相对链接指回 `scripts/real/README.md` 与 `docs/real/*.md`，不复制实现。
4. **运行期绑定政策**：所有机器绑定只能是参数/环境变量（`--artifact`、`--dsh-cli`、`--browser`、
   `--evidence-dir`、`--port` 等）或运行期证据 provenance；文档与测试逻辑禁止出现本机值。
   判定细则见 `docs/real/boundary-policy.md`。
5. **政策门禁化**：方法层文档由 `scripts/check-real-method.mjs` 扫描（机器绑定 M1–M8、skill frontmatter
   S1–S4、契约常量同步 C1–C3）；测试代码由 `scripts/check-real-gate.mjs` 扫描（入口协议 R1–R3、
   机器绑定与自拼 CDP R4–R5）。方法层文档不接受例外；测试代码例外只走
   `scripts/real/gate/exemptions.json` 的临时通道。
6. **契约常量单一来源**：方法层 skill 里的判定分类、FAIL 四分型、证据六元组字段与
   `scripts/real/harness/report/model.mjs` 常量一致，由 C1–C3 规则交叉校验；两边改到不一致即门禁红。

## 后果

- 换机器：只改运行期参数，方法层与测试逻辑不动。
- 换宿主版本：契约变化被 preflight 显式拦成 BLOCKED，不会误判产品 FAIL。
- 换插件：方法层与报告协议可复用，只需重写套件的布置与断言。
- 换人：按 `docs/real/onboarding.md` 在 30 分钟内跑出第一份证据，并按六元组重放。
- 代价：方法层文档与实现常量两处维护，靠门禁 C 规则兜底；方法层文档变更受 M1–M8 约束，
  写不了任何「本机才能跑」的示例——这是刻意的。
- 不新增「仓库自动安装 skill」的动作：安装属于运行期，由使用者按 onboarding 执行。

## 参考

- 规格：[#183](https://github.com/FeatherHunter/dsh-prompt/issues/183)
- 票：[#185](https://github.com/FeatherHunter/dsh-prompt/issues/185)、[#186](https://github.com/FeatherHunter/dsh-prompt/issues/186)、
  [#187](https://github.com/FeatherHunter/dsh-prompt/issues/187)、[#188](https://github.com/FeatherHunter/dsh-prompt/issues/188)、
  [#189](https://github.com/FeatherHunter/dsh-prompt/issues/189)、[#190](https://github.com/FeatherHunter/dsh-prompt/issues/190)、
  [#191](https://github.com/FeatherHunter/dsh-prompt/issues/191)、[#192](https://github.com/FeatherHunter/dsh-prompt/issues/192)、
  [#193](https://github.com/FeatherHunter/dsh-prompt/issues/193)
- 方法层：`skills/real-evidence/SKILL.md`、`docs/real/onboarding.md`、`docs/real/boundary-policy.md`
- 实现层入口：`scripts/real/README.md`、`docs/real/report.md`、`docs/real/static-gate.md`
