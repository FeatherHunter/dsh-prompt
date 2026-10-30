# docs/real：真机测试文档索引

真机测试 kit 的文档按「方法层 / 平台契约层 / 实现层」分开；先读方法层，再按需要下钻。

## 方法层（跨机器、跨宿主版本可复用）

| 文档 | 作用 |
| --- | --- |
| `skills/real-evidence/SKILL.md` | 用户级 skill 的仓内单一事实源：对抗式审查协议、判定分类、证据六元组、反例维度、安装步骤 |
| `docs/real/onboarding.md` | 30 分钟从零到第一条检查：环境、打包、跑一轮、读报告、写一条新检查 |
| `docs/real/boundary-policy.md` | 机器绑定允许/禁止清单、判据、门禁分工与例外政策 |
| `docs/adr/0011-real-test-kit-layering.md` | 三层分层的决定、分发通道、契约常量同步与后果 |

## 平台契约层（按宿主 runtime 版本钉住）

| 文档 | 作用 |
| --- | --- |
| `docs/real/host-contract.md` | 宿主契约六项、版本钉、契约 preflight 与负例自检 |
| `docs/real/hooks.md` | 插件钩子契约与诊断通道（#190） |
| `docs/real/observability.md` | 观测层：页面快照语义、观测面与来源分级（#188） |

## 实现层（kit 自身怎么工作）

| 文档 | 作用 |
| --- | --- |
| `scripts/real/README.md` | kit 入口：装配过程、参数、退出码、证据格式、模块地图 |
| `docs/real/fixture.md` | 初始态配方语义、内置配方清单、负例自检 |
| `docs/real/report.md` | 判定分类与证据报告协议、JSON schema v2、Markdown 生成 |
| `docs/real/static-gate.md` | 测试代码静态门禁（入口协议、机器绑定、自拼 CDP、例外表） |
| `docs/real/diff.md` | 差分运行器：旧产物基线、区分力分类、故障注入 |
| `docs/real/hook-gaps.md` | 已知钩子缺口与后续补点 |

## 维护约束

- 方法层文档由 `scripts/check-real-method.mjs` 扫描：出现本机绑定值即失败；skill 的契约常量必须与
  `scripts/real/harness/report/model.mjs` 同步。
- 实现层测试代码由 `scripts/check-real-gate.mjs` 扫描：入口协议与机器绑定规则见 `docs/real/static-gate.md`。
- 两者都通过后，方法层改动才算完成。
