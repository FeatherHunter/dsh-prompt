# 真机脚本静态门禁

真机套件要在「换机器 / 换宿主版本 / 换插件」时照样能跑，靠的不是跑挂之后再猜，而是写脚本时就
守住几条约束。本门禁在静态层面拦住五类写法，让它成为 `npm run check` 的一部分。

- 实现：`scripts/check-real-gate.mjs`（零依赖，只用 Node 内置）
- 规则数据：同文件的 `RULES`（id / 标题 / 适用范围 / 是否可豁免 / 检测器）
- 例外表：`scripts/real/gate/exemptions.json`
- 自证样本：`scripts/real/gate/samples/`（坏的 + 合法的一份），清单在 `samples/expected.json`

## 跑法

```console
node scripts/check-real-gate.mjs               # 正式扫描；接 npm run check
node scripts/check-real-gate.mjs --selftest    # 自证：坏样本被拒、合法样本通过、例外机制有效
node scripts/check-real-gate.mjs --help
```

输出与仓库其它 `scripts/check-*.mjs` 同风格：`PASS` / `FAIL` / `INFO` 行，最后一行
`RESULT: N FAIL`。违规行把「规则 id + 文件:行号」放在最前面，可直接跳转：

```text
FAIL: R4 scripts/repro/real/issue-181-real.mjs:28 — 绝对 Windows 路径字面量：…（命中：'D:/Temp/cdp181'）（行内容：const SHOT_DIR = process.env.SHOT_DIR || 'D:/Temp/cdp181'）
```

退出码：`0` = 全绿；`1` = 有 FAIL（违规或例外表配置错误）；`2` = 用法错误。

门禁只读文件、不写任何文件，也不读任何机器特定路径：扫描输入是仓库里的约定目录，自证输入是
`scripts/real/gate/samples/`。仓库外的脚本既不被扫描，也不受影响。

## 扫描范围

| 范围 | 说明 |
| --- | --- |
| `scripts/real/**/*.mjs` | 真机 kit：入口 `run.mjs`、`harness/`、`suites/` |
| `scripts/repro/real/**/*.mjs` | 遗留 pilot（迁移前的历史入口，见「例外政策」） |
| 排除 `scripts/real/gate/` | 门禁自己的夹具（样本、例外表），不参与正式扫描 |
| 不扫 `scripts/check-real-gate.mjs` | 门禁自身不扫自己 |

扫描时区分两层，规则按层适用：

- **入口脚本**：直接 `node <脚本>` 执行、负责「接目标入口 / 出报告 / 定退出码 / 收尾」的那一层。
  判定约定是路径形状 —— `scripts/real/*.mjs`（顶层，如 `run.mjs`）与 `scripts/repro/real/*.mjs`。
  R1–R3 只查这一层。
- **运行库**：`harness/`、`suites/` 等模块。参数由入口传进来，不自己接 `argv`，所以不适用
  R1–R3；R4/R5 对它们生效（套件里同样不该硬编码机器值或自造 CDP）。
- **vendored harness 白名单**：`scripts/real/harness/` 是唯一允许出现 CDP 协议细节与机器探测逻辑的
  地方，R4/R5 对它豁免。绑定层回答「这台机器上这些东西在哪里」，探测逻辑只能住在这里。

## 规则

| id | 检查什么 | 为什么 | 适用范围 | 可豁免 |
| --- | --- | --- | --- | --- |
| R1 | 目标入口必须是运行期输入；不得硬编码主机、端口、token | 目标 URL / 端口 / token 一旦写死，换机器就变成「环境问题」，真机验收失去意义 | 入口脚本 | 是 |
| R2 | 必须调用 `writeReport` 落 JSON 报告；退出码要能区分 0 与非 0 | 真机结论必须能脱离对话独立阅读；退出码决定 CI 与脚本调用方怎么判 | 入口脚本 | 是 |
| R3 | 必须有 `finally` 兜底块，且至少一处清理调用（`close` / `stop` / `kill` / `rmSync` / `waitForPortFree`…） | 失败路径漏掉进程、端口、临时目录，下一次运行就会撞环境 | 入口脚本 | 是 |
| R4 | 禁止硬编码机器特定值：绝对 Windows 路径、POSIX 主目录、宿主 / 浏览器安装位置、浏览器可执行文件、locale | 这些只能作为运行期参数传入，或由绑定层探测发现 | 除 harness 外全部 | 是 |
| R5 | 不得自造 CDP 客户端：`new WebSocket`、`webSocketDebuggerUrl`、直连 `/json/list`、自拼 `Runtime.evaluate` 等方法名 | 复制一份客户端会让同一套观测两处漂移；仓内 vendored harness 是唯一实现 | 除 harness 外全部 | 是 |

检测器只有三种 `kind`（见 `RULES` 的结构注释）：

- `forbid`：在「剥掉注释、保留字符串」的可见文本上逐行匹配正则，出现即违规；
- `require`：在「剥掉注释、抹掉字符串内容」的纯代码文本上找特征，缺失即违规（记在第 1 行）；
- `custom`：复杂判据（目前只有 R2 的退出码集合）。

已知的启发式边界，判红时对号入座：

- 注释不参与判定：头注里写「以前硬编码过 `D:\Temp`」不会红；但**字符串里的值照查**（规则要看
  的就是字符串字面量）。
- 模板字符串整体视为字符串：里面的插值表达式不按代码分析，别把唯一满足 `require` 的代码藏在
  `${…}` 里。
- 「入口脚本」按路径形状识别：新增入口脚本请放在 `scripts/real/` 顶层（或 `scripts/repro/real/`
  顶层）；放进 `harness/`、`suites/` 的模块按运行库对待。

## 自证：好 / 坏样本

`--selftest` 用固定样本证明门禁没退化成空转：

| 路径 | 作用 |
| --- | --- |
| `scripts/real/gate/samples/bad/r1-hardcoded-target.mjs` | 硬编码主机 / 端口 / token（R1） |
| `scripts/real/gate/samples/bad/r2-no-report.mjs` | 没有 JSON 报告、退出码只有 0（R2） |
| `scripts/real/gate/samples/bad/r3-no-cleanup.mjs` | 没有 `finally`、没有清理调用（R3） |
| `scripts/real/gate/samples/bad/r4-machine-values.mjs` | 用户主目录 / 浏览器路径 / 证据目录 / locale（R4） |
| `scripts/real/gate/samples/bad/r5-duplicated-cdp.mjs` | 自造 CDP 客户端（R5） |
| `scripts/real/gate/samples/good/valid-entry.mjs` | 五类规则全部满足的合法入口 |
| `scripts/real/gate/samples/expected.json` | 每个坏样本预期的「规则 id + 行号」，以及合法样本清单 |

自证断言（任何一条不满足都判红）：

1. 五类规则都有坏样本；
2. 每个坏样本被拒，且实际命中与 `expected.json` **完全一致**（规则 id + 行号），不会串到别的规则；
3. 合法样本零违规；
4. 例外表结构齐全（path / rules / reason / issue），指向的文件在扫描范围内且存在；
5. harness 白名单有效：`scripts/real/harness/cdp.mjs` 不被 R4/R5 误判；
6. 遗留 pilot 去掉例外会被拒、加上例外零违规（证明例外机制真的在起作用，不是摆设）；
7. `scripts/real/gate/` 与门禁脚本自己不出现在正式扫描清单里。

坏样本每个只违反自己那一类规则，其余规则保持合规 —— 这样自证才能把失败精确归因到一条规则。

## 如何新增规则

1. 在 `scripts/check-real-gate.mjs` 的 `RULES` 里加一条：
   `{ id, title, scope: 'entry' | 'nonHarness', exemptable: true, checks: [...] }`。
2. 在 `scripts/real/gate/samples/bad/` 放一个坏样本：**只**违反新规则，其余规则保持合规；
   同时给规则 id 起名并写清「怎么修」的 message（判红信息是给人看的）。
3. 在 `scripts/real/gate/samples/expected.json` 登记预期规则 id 与行号（从 1 起）。
4. 跑 `node scripts/check-real-gate.mjs --selftest`：先确认新样本被拒且归因准确，再确认合法样本没被误伤。
5. 对真实目录跑 `node scripts/check-real-gate.mjs`，处理存量违规：要么修脚本，要么按下一节的
   政策登记例外。
6. 把新规则补进本文件的规则表。

新增规则时不用改扫描器：分类、剥注释、`forbid` / `require` / `custom` 三种检测器、例外应用都是
规则无关的公共逻辑。

## 例外政策

例外表是 `scripts/real/gate/exemptions.json`，结构：

```json
{
  "schemaVersion": 1,
  "exemptions": [
    {
      "path": "scripts/repro/real/issue-181-real.mjs",
      "rules": ["R1", "R2", "R4", "R5"],
      "reason": "遗留 pilot 还没迁进 scripts/real 套件：自带 CDP 客户端、硬编码本地端口与 D:/Temp 证据目录。",
      "issue": "#192",
      "removeAfter": "#192 把 pilot 迁移成 scripts/real 下的套件并删除该文件后，删除本条豁免。"
    }
  ]
}
```

政策：

- 例外只能临时用：用来给「已知存量 + 有迁移/修复票」的脚本留一条明路，不是给新写法开后门。
- 每条必须有 `path`、`rules`（规则 id 数组，或单数 `rule`；`"*"` 表示全部规则）、`reason`、
  `issue`（关联票号或链接）。结构不全、规则 id 未知都判红。
- **过期即红**：例外指向的文件不存在、或不在扫描范围内，都会 FAIL —— 文件迁走 / 删除后必须同步
  删条目，否则门禁会一直提醒。
- 例外只对「文件 + 规则」精确生效；不要用宽泛路径掩盖新文件。
- 修好或迁走后删掉条目；删完再跑一次 `--selftest` 和正式扫描。

### 现有例外：遗留 pilot（#192）

`scripts/repro/real/issue-181-real.mjs` 是 #181 的真机验收 pilot，还没迁进 `scripts/real` 套件：
它自带一份 CDP 客户端、硬编码本地 CDP 端口与 `D:/Temp` 证据目录，正是 R1 / R2 / R4 / R5 要拦的
历史写法。**#192 负责把它迁移成套件并删除该文件；#192 完成后删除本条豁免**（文件不存在时门禁会
判红，不会忘）。在那之前，`--selftest` 里「去掉例外后 pilot 被拒」这一条会持续证明例外表在替
真实违规兜底，而不是空转。

## 接入 `npm run check`

本票**不改 `package.json`**（由 Lead 统一加）。建议的 script 行：

```json
"check:real-gate": "node scripts/check-real-gate.mjs --selftest && node scripts/check-real-gate.mjs"
```

前半段让「门禁有效」本身也成为每次 check 的一部分（很快，纯静态）；只跑正式扫描也可以换成
`"node scripts/check-real-gate.mjs"`。

链上位置建议放在 `check:remote-zoom-167` 之后、`check:marketplace-readme` 之前：

```text
… && npm run check:remote-zoom-167 && npm run check:real-gate && npm run check:marketplace-readme && …
```

不要插到 `check:issue-177` 与 `check:issue-178` 之间：`scripts/repro/test-issue-178.cjs` 的 A4 断言
`check:issue-178` 紧跟在 `check:issue-177` 之后（既有接线约定）。接入后既有红项
（`check:marketplace-readme`、`check:target-tree`）的输出不受影响，门禁本身输出 `RESULT: 0 FAIL`。

## CI 范围

`.github/workflows/check.yml` 在 `push` 与 `pull_request` 上只跑两条命令：

```text
npm ci            # 有 package-lock.json，装锁文件里的确切版本；prepare = npm run build
npm run typecheck
npm run check     # 静态检查链（含本门禁）
```

**浏览器 / 真机套件不进 CI**，也不跑 `npm run real:smoke`。理由：

- 真机套件要装配一次性 DSH 宿主：需要 DSH CLI、本机浏览器（Edge / Chrome）与可写的临时 profile，
  CI runner 上既没有稳定版本也不代表真机环境；
- 真机判定依赖宿主启动遮罩、真实点击与渲染，天然比静态检查更慢更飘，放进 PR 门禁会把「环境没就绪」
  和「产品坏了」混成同一种红；
- 真机证据（`report.json` + 截图）本来就是给人复盘的产物，放本地 `D:/Temp/evidence-*` 或仓库
  `.tmp-real/` 留档即可，不需要 CI 存档。

### 既有基线红项（不是本门禁引入的）

在 #184 的集成分支 tip 上，`npm run check` 本来就有两项红：

1. `check:marketplace-readme` —— `README.md` / `docs/README.en.md` 的「反馈与联系」段用了原始
   `<img>`（3 张未登记 `screenshots.json`）与原始 `<h2>`；
2. `check:target-tree --expect=target` —— `stragglers: src/client/hover-tip.ts`（rename map 未登记）。

本门禁不改这两处、也不改变它们的输出。在它们修好之前，CI 的 `npm run check` 步骤会是红的：那是
基线事实，不是本 workflow 引入的噪声；本 workflow 的作用是让**新增红**无处可藏。

## 与 spec #183 的关系

本门禁是 #183 的 T8（#186）：把「真机脚本必须可复跑」的约定变成静态门禁 + 自证 + CI。
后续票：pilot 迁移后删除本条例外（#192）；观测层 / 判定层 / 证据层若新增入口脚本，同样受本门禁
约束（新增入口脚本放在 `scripts/real/` 顶层即可被当作入口层检查）。
