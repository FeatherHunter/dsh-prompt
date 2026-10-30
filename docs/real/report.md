# 判定分类与证据报告（#189）

真机结论要能**脱离对话独立阅读**：一条 `npm run real:smoke` 之后，报告本身就该回答
「测了什么、条件是什么、看到了什么、为什么判成这样、产物在哪、下次怎么复现」。
本层把报告的**判定语义**（四类判定 + FAIL 四分型）、**证据六元组**、**产物规则**、
**退出码**与**Markdown 摘要**固定下来，并让 JSON 成为唯一事实来源。

- 判定模型（纯函数）：`scripts/real/harness/report/model.mjs`
- Markdown 渲染（纯函数）：`scripts/real/harness/report/markdown.mjs`
- 失败产物采集：`scripts/real/harness/report/artifacts.mjs`
- 记录器与落盘：`scripts/real/harness/evidence.mjs`
- 纯 Node 自证：`scripts/real/harness/report/selftest.mjs`
- 接入点：`scripts/real/run.mjs` —— 套件跑完（含抛错）先采失败产物、再清理、最后 `writeReport` 出 `report.json` + `report.md`

## 结论先说

| 关注点 | 做法 |
| --- | --- |
| 判定有哪几类 | `PASS` / `FAIL` / `BLOCKED` / `N-A` 四类，没有第五类、没有「警告」档 |
| 失败怎么分型 | `FAIL` 必带 `failureType`：`product` 产品缺陷 / `spec` 规格缺陷 / `test` 测试假象 / `tool` 工具故障，并带分型依据 |
| N-A 怎么算 | 必须写 `reason`；无理由时记录器直接抛 `ReportError`、不留下残缺检查（不转 FAIL，避免把「不适用」洗成「产品坏了」） |
| 预期失败怎么标 | `expectedFailure: true`（记录器入口 `expectFail()`；票面简写 `fail({expected: true})` 亦可），不计产品 FAIL、退出码按 0 计 |
| 每条检查记什么 | 证据六元组：`claim` / `conditions` / `steps` / `observations` / `inference` / `verdict`，原始观测与推断分字段 |
| 失败产物在哪 | `<evidence-dir>/<runTag>/artifacts/`，检查上记 `artifacts[]`（含绝对路径 `file` 与仓库内安全相对路径 `relative`）；采不到必须写 `artifactsWhy` |
| Markdown 怎么来 | `report.md` 由同目录 `report.json` **生成**（先序列化、再解析同一份 JSON 渲染），不是手写；同 JSON 两次生成字节相同 |
| 退出码 | 0 全绿 / 1 有真实 FAIL / 2 BLOCKED（含参数错误）/ 3 工具故障 |
| 兼容性 | `schemaVersion=2`；v1 顶层字段与 `checks[]` 既有字段（`expected`/`observed`/`detail`/`reason`）全保留，旧套件零改动可跑 |

## 四类判定

| 判定 | 含义 | 硬性要求 |
| --- | --- | --- |
| `PASS` | 期望成立 | 无 |
| `FAIL` | 产品/规格/测试/工具层面的期望不成立 | 证据六元组齐全；必须有 `failureType` + 分型依据；必须有产物或 `artifactsWhy` |
| `BLOCKED` | 本轮证据不足以判定产品对错（环境/装配/工具没就绪） | 必须有 `reason`；`blockerKind` ∈ `environment` / `tool`（缺省 `environment`） |
| `N-A` | 本环境/本产物/本配置不适用 | 必须有 `reason`；无理由直接抛错，本条不会进报告 |

整体结论（`overallVerdict`）：有**非预期** `FAIL` → `FAIL`；否则有 `BLOCKED` → `BLOCKED`；否则 `PASS`。
预期失败不参与整体结论。

## FAIL 四分型与判据

分型回答的是「这条红该记在谁头上」：

| 分型 | 中文 | 判据（自动推断，按优先级从高到低） |
| --- | --- | --- |
| `product` | 产品缺陷 | 断言不成立：超时/元素缺失/状态不符等（`signal=timeout` / `element-missing` / `assertion`）；这是缺省分型 |
| `spec` | 规格缺陷 | 套件显式覆盖：`fail(name, {failureType: 'spec', failureTypeBasis: …})`，例如「预期本身写错了」 |
| `test` | 测试假象 | 环境抖动/不可复现：`reproducible: false` 或 `flakySuspect: true`；报告同时记 `flakySuspect: true` |
| `tool` | 工具故障 | `HarnessError` / 驱动异常（CDP、WebSocket、`Runtime.evaluate`、输入驱动、socket、`Target closed`）/ 其它未预期异常 |

判据优先级（`classifyFailure`）：

1. 显式 `failureType`（`basis.source='explicit'`，其它信号一律不覆盖）；
2. `flakySuspect: true` 或 `reproducible: false` → `test`；
3. 传入的 `error instanceof HarnessError` → `tool`；
4. `error instanceof CheckFailure` → `product`；
5. 其它 `Error`：命中驱动类特征（`CDP` / `WebSocket` / `DevTools` / `Runtime.evaluate` / 输入驱动 / `driver` / `socket` / `Target closed`）→ `tool`；否则 `tool`（`signal=unexpected-error`）；
6. 文本线索（`detail`/`observed`/`reason`）：`等待超时|超时|timeout` → `product`/`timeout`；`元素不存在|找不到元素|未找到|缺少…（几何/矩形/选择器）` → `product`/`element-missing`；
7. 兜底 `product`/`assertion`（note 提示 8：若预算本身不合理，请显式覆盖为 `spec`）。

`failureTypeBasis` 形如 `{source: 'inferred'|'explicit', signal, note}`，`note` 必填（校验会拒空）。
工具故障**不得**记成产品失败：`tool` 分型的真实 FAIL 会把退出码导向 3，而不是 1。

## 预期失败（差分/负例，供 #191）

差分运行器（#191）会用「旧产物应当红」来证明用例有区分力。这类红不是产品缺陷：

- 记录入口：`recorder.expectFail(name, opts)`，或 `recorder.fail(name, {expectedFailure: true, …})`，
  或票面简写 `recorder.fail(name, {expected: true, …})`（`expected` 恰好是布尔 `true` 且未显式给
  `expectedFailure` 时生效；显式布尔标记优先）。
- 判定仍是 `FAIL`，但报告把这些检查放进 `expectedFailures[]`，**不计入** `summary.FAIL`、
  不改变整体 `verdict`、退出码按 0 计；Markdown 有独立分区「预期失败（N 条，不计入产品失败）」。
- 反向对账：`recorder.expectFailures(['用例名', …])` 声明「这些本轮应该红」。`finish` 时逐条对账，
  没红（PASS/缺失）就追加一条**真实** FAIL：`预期失败未成立：<用例名>`（`failureType: 'test'`，
  `signal=expected-not-met`，推断里写明「无区分力」）。**预期失败没成立 = 测试假象，必须红**。
- 兼容说明：v1 的 `expected` 字段语义是「期望值本身」（`fail({expected, observed})`），保持不变；
  预期失败标记是新增字段 `expectedFailure`，两件事不混用。

### 差分聚合层的分型（#183 评审整改 S3）

差分运行器（#191）自己也产标准报告；它的 FAIL 分型按**问题来源**映射，不再写死 `product`：
清单缺陷/期望未满足/无区分力/注入器串扰/环境漂移记 `test`，候选侧真实回归或候选产物自身未预期 FAIL 记 `product`。
映射表与判据见 `scripts/real/harness/diff/classify.mjs` 的 `DIFF_PROBLEM_FAILURE_TYPES` 与
[`diff.md`](diff.md) 的「差分侧 FAIL 分型」节；`diff/selftest.mjs` 覆盖映射与未知码 fail-closed。

## 证据六元组

每条检查（尤其 FAIL）都记录六元组，字段名即报告 JSON 键名：

| 字段 | 含义 | 缺省怎么补 |
| --- | --- | --- |
| `claim` | 声称：这条检查在证明什么（可独立阅读的完整句子） | 缺省 = 检查名 |
| `conditions` | 条件：artifact / host / browser / fixture / runTag / suite（套件可追加 section、locale 等） | 由 `setEnvironment()` 注入的轮次环境自动拼装；套件用 `setConditions()` 或单条 `conditions` 覆盖 |
| `steps` | 步骤：按顺序执行的可见动作 | 缺省一条「执行检查「<名称>」（套件未声明逐步操作）」 |
| `observations` | **原始观测**：未解释的页面/接口状态（先记录） | 由旧字段 `expected`/`observed`/`detail`/`reason` 搬入；全无时写 note 提示补观测 |
| `inference` | **推断**：由观测到结论的解释（后解释，不混进观测） | 按判定自动生成；FAIL 会引用分型 |
| `verdict` | 判定（四类之一） | 记录入口决定 |

校验（`assertEvidenceTuple` / `assertValidReport`）：FAIL 缺任一字段、`conditions` 为空对象、
`steps` 不是非空数组、`observations` 为空对象都会拒绝报告（`ReportError`）。原始观测与推断分开存，
报告读者能自己复核「观测 → 推断」这一步。

## 失败产物

规则：**FAIL 检查必须保存可打开产物，或者显式说明为什么没有。**

- 目录：`<evidence-dir>/<runTag>/artifacts/`；产物引用形如
  `{kind, name, file, relative, bytes}`：
  - `kind` ∈ `screenshot` / `page-state` / `store` / `input-log`；
  - `file` 是本机绝对路径（便于直接打开，`report.json` 里保留）；
  - `relative` 是 POSIX 风格、以 `artifacts/` 开头的相对路径（Markdown 只写这个，贴 issue 不泄露本机路径）。
- 自动采集（`captureFailureArtifacts`，`run.mjs` 在套件之后、关 CDP/浏览器之前调用）：
  只处理「非预期 FAIL 且既无产物、又无说明」的检查（最多 8 条），依次尝试
  截图（`client.screenshot`）→ 页面状态（`observe.observe()`/`snapshot()`）→ store（`persistence.read()`）
  → 输入日志（`input.log.read()`）；每一步独立 `try/catch`，部分缺失记
  `artifactsWhy='部分产物缺失：…'`，全缺记 `artifactsWhy='自动采集失败：…'`。采集失败绝不改变判定。
- 兜底：`writeReport` 对仍缺产物/说明的 FAIL 显式补 `artifactsWhy`（预期失败写「预期失败（差分基线/负例）
  不保存产物」，其余写「本轮没有可用的证据句柄或产物采集未执行」），不做静默省略。
- 套件也可以自己写：`recorder.saveArtifact({kind, name, content})`、
  `recorder.artifactPath({kind, name, ext})` + `registerArtifact({file})`。

## 退出码

| 退出码 | 含义 | 判定条件（`exitCodeFor`） |
| --- | --- | --- |
| 0 | 全绿 | 无非预期 FAIL、无 BLOCKED、无工具故障；**只有预期失败也算 0** |
| 1 | 产品/规格/测试失败 | 有非预期 FAIL，且其中至少一条不是 `tool` 分型 |
| 2 | BLOCKED | 有 BLOCKED（含工具型阻塞之外的场景）；参数错误、未知套件、fixture 名拼错同样 2 |
| 3 | 工具故障 | 非预期 FAIL **全部**是 `tool` 分型，或存在 `blockerKind='tool'` 的 BLOCKED，或运行器崩溃（未预期异常） |

`run.mjs` 直接 `return result.report.exitCode`；装配失败/参数错误仍走 2，只有「工具/驱动/运行器自身」
异常才允许 3。工具故障不得冒充产品失败。

## JSON schema v2

`schemaVersion=2`。顶层字段（v1 字段全部保留）：

```jsonc
{
  "schemaVersion": 2,
  "runTag": "20261030-…-boundary",
  "suite": "boundary",
  "verdict": "PASS | FAIL | BLOCKED",
  "startedAt": "ISO-8601", "finishedAt": "ISO-8601",
  "exitCode": 0,
  "environment": { /* v1 原样：平台、产物、宿主、浏览器、fixture、边界观测等 */ },
  "summary": {
    "total": 45, "PASS": 44, "FAIL": 0, "BLOCKED": 0, "N-A": 1,
    "expectedFailures": 0,                       // 预期失败（不计产品 FAIL）
    "failureTypes": { "product": 0, "spec": 0, "test": 0, "tool": 0 },
    "toolFaults": 0,                             // 工具故障（FAIL+BLOCKED 里 kind=tool）
    "flakySuspects": 0
  },
  "meta": {
    "runTag": "…", "suite": "…", "startedAt": "…", "finishedAt": "…",
    "timezone": "Asia/Shanghai", "locale": "zh-CN",
    "artifact": { "name": "dsh-prompt", "version": "0.4.39", "fileName": "…tgz", "sizeBytes": 123456, "sha256": "…" },
    "host":    { "cli": "…", "version": "0.2.1-rc.3", "source": "PATH" },
    "browser": { "id": "…", "source": "…", "runtime": "Edg/…" },
    "fixture": { "name": "templates", "ok": true },
    "evidenceDir": "…"
  },
  "checks": [ /* 每条带六元组；FAIL/BLOCKED/N-A 见下 */ ],
  "failures": [ /* 非预期 FAIL 检查（同一对象引用） */ ],
  "expectedFailures": [ /* 预期 FAIL 检查 */ ]
}
```

`checks[]` 条目（公共）：`name` / `verdict` / `at` / `claim` / `conditions` / `steps` /
`observations` / `inference`；沿用 v1 的 `expected` / `observed` / `detail` / `reason`。
按判定追加：

- FAIL：`failureType` + `failureTypeBasis{source,signal,note}` + `expectedFailure: boolean`；
  `flakySuspect: true` 时要求 `failureType: 'test'`；`artifacts[]` 或 `artifactsWhy` 至少一个；
- BLOCKED：`reason` + `blockerKind`（`environment` | `tool`）；
- N-A：`reason`（非空）。

产物引用：`{kind, name, file, relative, bytes}`。

## Markdown 生成规则

`report.md` 与 `report.json` 同目录，**由 JSON 生成**：`writeReport` 先 `JSON.stringify` 报告，
再对同一份 JSON 文本 `JSON.parse` 后调用 `renderMarkdown`。因此：

- 同目录两份文件永远一致（JSON 是唯一事实源，Markdown 是投影，不要手改 Markdown）；
- 同一份 JSON 两次生成字节相同（`renderMarkdown` 是纯函数，不读时钟、不读本机路径）；
- 固定分区：标题（suite + 判定中文）、环境与版本、判定统计、失败明细（六元组要点 + 分型依据 + 产物）、
  预期失败、阻塞、N/A、通过检查、证据路径；空分区也写「（无）」，字段缺失写「（未记录）」而非省略；
- 只写产物相对路径（`artifacts/…`），不写本机绝对路径；绝对路径只留在 `report.json` 的 `artifacts[].file`；
- 环境表包含：被测产物名@版本、sha256 短（前 12 位）、产物大小、宿主 CLI 与 runtime 版本、浏览器与 runtime、
  fixture、平台/架构/Node、locale/时区、runTag、起止时间、报告 schema —— 可直接贴 issue。

## 自证（纯 Node，无浏览器/无宿主）

```bash
node scripts/real/harness/report/selftest.mjs
# RESULT: 205 PASS / 0 FAIL（判定分类与证据报告自证全绿）
```

覆盖 A–J 十节：协议常量与退出码；四类判定样例；FAIL 四分型（自动推断与显式覆盖）；六元组完整性与
自动补全；N-A 必须写理由；预期失败（含未成立对账、票面简写、显式否定优先）；失败产物（真实落盘文件、
自动采集、无产物说明）；Markdown 由 JSON 生成且一致（同 JSON 两次字节相同、手改被 JSON 覆盖）；schema v2
与 v1 向后兼容；退出码映射矩阵。

落盘样例（每个目录一份 `report.json` + `report.md`，可直接打开）：

```bash
node scripts/real/harness/report/selftest.mjs --out <目录>
# pass / fail-product / blocked / na / tool-fault / expected / artifacts-auto / …
```

## 接入约定

- 套件只需用记录器入口：`pass(name, detailOrOptions)` / `fail(name, opts)` / `blocked(name, reason)` /
  `na(name, reason)` / `toolFault(name, reason)` / `expectFail(name, opts)` / `expectFailures(names)`；
  旧套件传字符串 detail、`{expected, observed, detail}` 的行为不变。
- `run.mjs` 负责：给 `Recorder` 传 `evidenceDir`、跑完套件后（含抛错）调用 `captureFailureArtifacts`、
  最后 `writeReport` 落盘 JSON+Markdown，并以 `report.exitCode` 作为进程退出码。
- 六元组里的 `conditions` 自动带本轮环境（runTag/suite/artifact/host/browser/fixture）；套件要补的只是
  它自己知道的执行条件（如视口、数据变体），用 `recorder.setConditions()` 或单条 `conditions`。

## 与 #183 的关系

本层是 #183「证据与门禁层」的报告/判定部分（#189）：

- #187 提供声明式 fixture 与干净态基线（`docs/real/fixture.md`）；
- #188 提供边界观测层与真实输入（`docs/real/observability.md`）；
- #189（本文件）把判定语义、分型、六元组、产物、JSON/Markdown 与退出码固定成可复用协议；
- #191 差分运行器在此基础上用 `expectFail` / `expectedFailures` 做「旧产物应当红」的区分力证明；
- #190 的插件测试钩子补齐后，边界观测与断言的来源等级会继续沿用六元组的观测/推断分离。
