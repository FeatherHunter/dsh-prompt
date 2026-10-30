# 边界政策：机器绑定允许出现在哪里

判定对象：真机测试的**方法层**（skill、onboarding、分层 ADR、本文件、`docs/real/README.md`）
与**实现层**（`scripts/real/**`、套件、fixture、报告）。
核心判据一句话：**换一台机器、换一个宿主版本、换一个插件、换一个人，文档与测试逻辑不需要改。**

## 1. 三层与绑定归属

| 层 | 内容 | 机器绑定 | 可移植性 |
| --- | --- | --- | --- |
| 方法层 | skill、onboarding、边界政策、分层 ADR、docs 索引 | 禁止 | 跨栈可移植，随 skill 分发 |
| 平台契约层 | 宿主契约、钩子契约、观测语义 | 只钉宿主 runtime 版本，不钉机器 | 换宿主版本时按契约版本升级 |
| 运行期绑定层 | 被测产物、CLI、浏览器、端口、证据根、凭据 | 允许，且**只能**作为运行期输入或证据 provenance | 每次运行由参数/环境注入 |

绑定进入仓库文件的唯一合法通道是「占位符 + 运行期参数」，见下节允许清单。

## 2. 允许清单

| 形态 | 示例（占位符） | 为什么允许 |
| --- | --- | --- |
| 运行期参数占位 | `--artifact <pack-dir>/dsh-prompt-<version>.tgz` | 值由本次运行给出，机器无关 |
| 证据根占位 | `<evidence-root>/<runTag>/report.json` | 运行期目录，不入库 |
| 约定位置 | `$DSH_HOME/skills`、`~/.dsh/skills` | 跨机器的约定，不指具体机器 |
| 系统分配端口 | `--port 0`；地址写作 `<host>:<port>` | 端口由系统分配，不写死 |
| 仓内相对路径 | `scripts/real/run.mjs`、`docs/real/report.md` | 相对仓库，迁移仓库仍成立 |
| 版本号 | `Node >= 22`、`<宿主 runtime 版本>` | 版本是产品事实，不是机器绑定 |
| 证据 provenance | `report.json` 里运行期产生的绝对路径 | 只在运行期证据里出现，不入库、不作断言 |

## 3. 禁止清单

| 禁止形态 | 为什么 | 替代 |
| --- | --- | --- |
| 带盘符的绝对路径 | 换机器即失效 | `<pack-dir>` / `<evidence-root>` 占位符 |
| 用户主目录或系统目录绝对路径 | 含用户名，泄漏且不可移植 | 约定位置 `$DSH_HOME` / `~/.dsh` |
| 本机用户名目录 | 同上 | 同上 |
| 固定主机与端口 | 端口冲突、换机不可用 | `--port 0` + `<host>:<port>` |
| 浏览器安装路径或可执行文件名 | 换机、换版本即失效 | `--browser <path>` 运行期注入 |
| 固定 locale / 语言地区代码 | 机器环境差异会改变 UI 文案 | 使用与语言无关的语义定位 |
| 宿主安装位置 / 本机数据目录 | 换机即失效 | `--dsh-cli <path>`、`$DSH_HOME` |
| IPv4 字面量 | 固定地址即绑定 | `<host>` 占位符 |
| 凭据 / token / 口令 | 泄漏风险 | 运行期环境注入，不写文档 |

禁止形态的具体正则判据由门禁 `scripts/check-real-method.mjs` 给出（规则号 M1–M8，文件中可查）。

## 4. 门禁分工

| 门禁 | 扫描对象 | 规则 |
| --- | --- | --- |
| `scripts/check-real-method.mjs` | 方法层文档：`skills/**/*.md`、`docs/real/{README,onboarding,boundary-policy}.md`、分层 ADR | M1–M8 机器绑定；S1–S4 skill frontmatter；C1–C3 契约常量同步 |
| `scripts/check-real-gate.mjs` | 真机入口与套件代码（`scripts/real/**`、`scripts/repro/real/**`） | R1–R3 入口协议；R4–R5 机器绑定与自拼 CDP |

两者都不把运行期证据当违规：`report.json` 里的绝对路径属于 provenance，不参与门禁扫描。

## 5. 例外政策

- 方法层文档**不接受例外**：发现违规就改文档，把值换成占位符或运行期参数。
- 测试代码的例外只走 `scripts/real/gate/exemptions.json` 的临时通道：必须写 `reason` / `issue` / `removeAfter`，
  过期或文件不存在时门禁 fail-closed。
- 产品 README 等产品文档里的历史示例若有机器值，由各自门禁治理，不在本政策适用范围。

## 6. 可移植四问复核

每次提交方法层或测试逻辑前，用四问过一遍：

1. **换机器**：是否只剩运行期参数差异？
2. **换宿主版本**：契约变化是否被 preflight 显式拦成 BLOCKED，而不是混进产品 FAIL？
3. **换插件**：方法层与报告协议是否仍可复用？
4. **换人复现**：只按 onboarding 与六元组 steps 能否重放？

四问有任何一问答不上，先改文档/代码，再提交。
