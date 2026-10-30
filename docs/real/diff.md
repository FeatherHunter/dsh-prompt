# 差分运行器：旧产物基线与故障注入（#191）

票 #191 要回答的问题不是「当前产物跑得绿不绿」，而是「**关键断言真的会红吗**」：把同一套件、同一 fixture、同一判定/证据协议分别跑在「旧产物」与「当前产物」上（或「干净运行」与「注入故障的运行」上），逐检查对照两侧 verdict，只有「旧红 → 当前绿」的翻转才能算作证据力。两侧都绿的检查一律标注「无区分力/无证据力」，永远不判通过。

## 结论先说

| 问题 | 结论 |
| --- | --- |
| `boundary` 对 0.4.39 时代旧产物有区分力吗？ | **没有**。0.4.39（pack-183，sha256 `30f9cd74…`）与当前产物 44 条检查全部 bothGreen → diff 判 `FAIL`（exit 1），问题 `no-discrimination`。这是正确结论：`boundary` 覆盖的行为旧版本早已实现，#190 只新增测试钩子/诊断，没有可被 `boundary` 观测到的行为变化。 |
| 那 `boundary` 本身有区分力吗？ | **有**。换 pre-#179 的 0.4.32 旧产物（sha256 `1c6def48…`）后，`⑥触发按钮：底栏触发方式…` 在旧产物红、当前绿；45 条检查中 1 条 discriminating、33 条 bothGreen（无证据力）、12 条翻转（含 BLOCKED 诊断行被当前产物消除），清单 `mustFlip` 1/1 满足 → diff `PASS`（exit 0）。 |
| 三种故障注入能证明断言有区分力吗？ | **能**。`input-actions-missing` 让两条 captureInsertion 光标检查按预期红；`insert-coordinate-offset` 让场景 2 的插入等待超时；`persistence-write-fail` 让场景 2/3 的 store 等待超时。三次 diff 模式均 `PASS`（exit 0），且没有未声明的红。 |
| 注入默认会影响正常测试吗？ | **不会**。不给 `--fault` 时注入器注册表被跳过、句柄原样传递、不 import 任何注入逻辑的副作用；`--help`、selftest、既有 `check` 链零影响。 |

## 文件清单

| 文件 | 作用 |
| --- | --- |
| `scripts/real/diff.mjs` | 差分 CLI 入口（主入口仍是 `run.mjs`） |
| `scripts/real/harness/diff/index.mjs` | 编排：参数解析、两侧子进程、证据目录、`diff.json`/`diff.md` 落盘 |
| `scripts/real/harness/diff/classify.mjs` | 纯函数：逐检查对照与分类（discriminating / regression / bothGreen / …） |
| `scripts/real/harness/diff/expect.mjs` | 期望清单加载、校验、匹配、两套评估（artifact / fault） |
| `scripts/real/harness/diff/model.mjs` | 纯函数：构建 `diff.json` 文档（唯一事实源）与判定/退出码 |
| `scripts/real/harness/diff/render.mjs` | 纯函数：从 `diff.json` 确定性渲染 `diff.md`（两次渲染字节相同） |
| `scripts/real/harness/diff/baseline.mjs` | 旧产物登记表与缓存解析（sha256 锚定） |
| `scripts/real/harness/diff/selftest.mjs` | 纯 Node 自证（43 项，无浏览器），`check:real-diff` 候选命令 |
| `scripts/real/harness/fault/injectors.mjs` | 三个故障注入器注册表与安装/卸载实现 |
| `scripts/real/harness/fault/index.mjs` | `applyFaults`：顺序安装、失败逆序回滚、元数据与证据 |
| `scripts/real/diffs/boundary.expect.json` | `boundary` 套件的期望翻转清单（纯数据） |
| `scripts/real/diffs/baselines.json` | 已用过的旧产物基线登记（sha256 + 来源，不写机器绝对路径） |
| `scripts/real/run.mjs` / `scripts/real/harness/bindings.mjs` | 加 `--fault`（逗号分隔）与 `faults`；套件前安装、finally 卸载；无 `--fault` 零影响 |

## 两种模式

### artifact：旧产物基线 vs 当前产物（默认）

```bash
node scripts/real/diff.mjs \
  --artifact <当前产物.tgz> \
  --baseline-artifact <旧产物.tgz> \
  --suite boundary --fixture templates \
  --evidence-dir <证据目录>/diff-positive-0432
```

- 两侧各起一个 `run.mjs` 子进程，使用相同套件/fixture/超时/宿主/浏览器；证据写到 `<evidence-dir>/reference/` 与 `<evidence-dir>/candidate/` 下各自的 `runTag` 目录，**不清上一轮证据**。
- 期望清单缺省 `scripts/real/diffs/<suite>.expect.json`（可用 `--expect` 覆盖）。
- `diff.json`（唯一事实源）与 `diff.md`（确定性渲染，可直接贴 issue）写到 `<evidence-dir>/` 根下。

### fault：干净运行 vs 注入运行

```bash
node scripts/real/diff.mjs \
  --artifact <当前产物.tgz> \
  --fault input-actions-missing \
  --suite boundary --fixture templates \
  --evidence-dir <证据目录>/diff-fault-input-actions-missing
```

- 两侧是**同一个产物**：reference = 不注入，candidate = 注入；期望清单由注入器的 `expectedRed`/`expectedStayGreen` 派生（不需要手写 expect 文件）。
- fault 模式下注入侧场景可能提前中止，后续检查不会出现；对「条件性断言」（只在干净运行里才成立的检查）允许只在注入侧出现，只要它按预期变红；未出现的 expectedRed 项算「未检出」，整体 FAIL。
- 注入器元数据会写进报告（`environment.faults` / `diff.json.faults`），列出注入点、期望变红的检查与实际命中。

## 旧产物基线：生成、登记与复用

### 生成方法

任选其一，产物只需是一个可 `npm pack` 的 tgz：

1. **从旧 commit 打包**（可复现，推荐）：

   ```bash
   git worktree add ../dsh-prompt-baseline <旧commit>
   cd ../dsh-prompt-baseline
   npm ci && npm run build && npm pack --pack-destination <缓存目录>
   ```

2. **从 CI artifact 取**：release/CI 流水线里 `npm pack` 的 tgz。
3. **从 npm 历史版本**：`npm pack dsh-prompt@0.4.32 --pack-destination <缓存目录>`。

生成后不要手改产物；`sha256` 是可比性的锚。

### 登记（`scripts/real/diffs/baselines.json`）

```json
{
  "schemaVersion": 1,
  "notes": ["只写文件名/sha/来源，不写机器绝对路径；sha 不符按 BLOCKED 处理。"],
  "baselines": [
    {
      "name": "dsh-prompt-0.4.32",
      "fileName": "dsh-prompt-0.4.32.tgz",
      "sha256": "1c6def48…",
      "version": "0.4.32",
      "commit": "v0.4.32",
      "source": "旧发行版 npm 包",
      "note": "pre-#179，boundary 的 ⑥触发按钮 检查在它上面红",
      "suites": ["boundary"]
    }
  ]
}
```

字段约束：`schemaVersion` 必须为 1；`name`/`fileName`/`sha256`（64 位 hex）/`source` 必填；`version`/`commit`/`note` 可选字符串；`suites` 可选字符串数组；未知字段报错（防止手滑写错字段静默失效）。

### 解析顺序（`resolveBaselineArtifact`）

1. `--baseline-artifact <tgz>`（显式路径）；
2. `--baseline <name>`（登记表按 name 命中，再到缓存目录找 `fileName`）；
3. 环境变量 `DSH_REAL_BASELINE` / `DSH_REAL_BASELINE_DIR`；
4. 期望清单 `baseline.sha256` 或 `baseline.artifactFile` 命中登记表 + 缓存目录；
5. 都没有 → 可操作的报错（提示用 `--baseline-artifact` 或设置 `DSH_REAL_BASELINE_DIR`）。

命中登记表时会用 sha256/fileName 校验；不一致按基线不可信处理，不做「只差一点」的宽容匹配。

## 期望清单怎么写

文件：`scripts/real/diffs/<suite>.expect.json`（纯数据，不允许注释/逻辑）。

```json
{
  "suite": "boundary",
  "baseline": {
    "name": "dsh-prompt-0.4.32",
    "artifactFile": "dsh-prompt-0.4.32.tgz",
    "sha256": "1c6def48ca527dc84e716b7ef8bb31c8e8dc125feddb1ab1ddf12da194736d10",
    "version": "0.4.32",
    "commit": "v0.4.32",
    "note": "本清单的基线声明；用 0.4.39 时代产物跑会得到“无区分力”的正确负例。"
  },
  "mustFlipRedOnBaseline": [
    "⑥触发按钮：底栏触发方式与 fixture 声明一致"
  ],
  "mustStayGreen": [
    "fixture 起始态",
    "①面板开关：场景开始时面板处于收起状态",
    "②模板行：行数等于 store 自定义模板数（hidePreset=true 时只列自定义）",
    "③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）",
    "双通道·持久化：插入后 usage 计数 +1（store，期望=声明值+1）"
  ],
  "notes": [
    "mustFlip：旧产物必须红、当前产物必须绿；否则该断言无区分力，整体 FAIL。"
  ]
}
```

规则：

- `mustFlipRedOnBaseline`：**每项**必须在旧产物下有匹配检查且该检查为 FAIL、在当前产物下为 PASS（= `discriminating`），否则整体 FAIL。匹配不到检查（改名/删除）也 FAIL（防止清单腐烂）。
- `mustStayGreen`：两侧都必须 PASS；旧产物侧红按「环境/基线问题」分类（BLOCKED 或 FAIL），当前侧红按产品回归处理。
- 匹配模式：`exact`、前缀（`"场景 2"` 匹配所有以它开头的检查）、或含 `*` 的 glob（如 `"③光标位置*"`）。
- 只能基于**产品行为差异**选 `mustFlip`。不要写「钩子存在性」：钩子缺失在观测层会退化成 null/0/false，套件可能根本不检查它们（`boundary` 就没有引用 #190 的新钩子），这类断言在旧产物上也不会红。
- 写清单时建议先用一次 artifact 模式跑当前真实基线，确认 `mustFlip` 命中的是 FAIL，而不是 BLOCKED（BLOCKED 是环境问题，不算区分力）。

## 逐检查分类与判定

分类由 `classifyPair(reference.verdict, candidate.verdict)` 决定，`diff.json.checks[]` 每行都带 `name / area / reference.verdict / candidate.verdict / classification / flipped`：

| 分类 | 含义 | 计入证据力 |
| --- | --- | --- |
| `discriminating` | 对照侧 FAIL、判定侧 PASS（唯一「翻转」方向） | ✅ |
| `bothGreen` | 两侧都 PASS —— **无区分力/无证据力，不得判通过** | ❌ |
| `bothRed` | 两侧都 FAIL（可能是产品同缺陷，也可能是环境） | ❌ |
| `regression` | 对照侧 PASS、判定侧 FAIL（变差，必须醒目） | ❌（且整体 FAIL） |
| `baselineBlocked` / `candidateBlocked` / `bothBlocked` | 某侧 BLOCKED，环境/tool 原因 | ❌ |
| `missingInBaseline` / `missingInCandidate` / `missingBoth` | 某侧报告没有这条检查（场景中止/条件性检查） | ❌ |
| `bothNa` / `naMismatch` / `unknown` | N-A 或无法判断 | ❌ |

整体判定（`model.mjs.decide`）：

1. 任一 `TOOL_FAULT` 问题 → `TOOL_FAULT`（退出码 3）——工具故障不冒充产品判定；
2. 任一侧报告整体 `BLOCKED` → `BLOCKED`（退出码 2）；
3. 有 `BLOCKED` 级问题 → 2；有 `FAIL` 级问题 → 1；
4. 否则 `PASS`（退出码 0）。

`PASS` 的必要条件（不是「谁绿谁对」）：期望清单内所有 `mustFlip` 都有 discriminating 证据、`mustStayGreen` 两侧全绿、没有 regression、没有未声明的红；`bothGreen` 只作为「无证据力」统计，永远填不满 `mustFlip`。

退出码：`0` PASS / `1` FAIL（含无区分力、回归、清单未满足）/ `2` BLOCKED（环境、基线、场景装配）/ `3` TOOL_FAULT（子进程异常、报告缺失/坏、差分工具自身异常）。

## 故障注入

三个注入器都在 harness 层（不改产品 `src/`），只在显式 `--fault` 时生效、可逆、默认零影响：

| 注入器 | 注入点（接缝） | 期望变红的检查 | 期望保持绿 |
| --- | --- | --- | --- |
| `input-actions-missing` | 页面内沿 React fiber 找到宿主 `props.inputActions`，把 `captureInsertion` 置 `undefined`（卸载恢复） | `③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）`、`③光标位置（合成路径）：插入后光标在正文末尾` | `fixture 起始态`、`③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）`、`双通道·持久化：插入后 usage 计数 +1（store，期望=声明值+1）` |
| `insert-coordinate-offset` | 包 `input.clickAt`：落点命中模板行时把 x 移到行右侧空白处（真实指针点到错位），未命中透传 | `场景 2：行插入落位：等待观测条件超时`（条件性检查：只在注入侧出现） | `fixture 起始态` |
| `persistence-write-fail` | 页面内覆写 `window.fetch`：`POST/PUT/PATCH/DELETE` 且命中 `/_dsh/dsh-prompt/` 写路由时 reject，GET `/store` 放行 | `场景 2：行插入落位：等待观测条件超时`、`场景 3：设置页控件切换：等待观测条件超时` | `fixture 起始态`、`③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）`、`④设置页：物理点勾选框后 UI 状态翻转（true→false）` |

真机证据（当前产物 pack-191，`--suite boundary --fixture templates`，全部实跑）：

| 注入器 | 直接跑 `run.mjs`（证据在 `<证据根>/fault-<id>/`） | diff 模式（`<证据根>/diff-fault-<id>/`） |
| --- | --- | --- |
| `input-actions-missing` | FAIL 2 = 两条 captureInsertion 光标检查，其余 42 条 PASS，exit 1 | PASS exit 0，expectedRed 2/2 检出，stayGreen 3/3 保持绿 |
| `insert-coordinate-offset` | FAIL 1 = `场景 2：行插入落位：等待观测条件超时`，exit 1 | PASS exit 0，expectedRed 1/1 检出，stayGreen 1/1 |
| `persistence-write-fail` | FAIL 2 = 场景 2、场景 3 的等待超时，exit 1 | PASS exit 0，expectedRed 2/2 检出，stayGreen 3/3 |

安全阀：

- 未知/重复 id 在参数解析阶段就报错（exit 2），不会跑到一半才失败；
- 安装顺序执行，任一注入器安装失败会逆序回滚已装部分；卸载失败记为 toolFault（exit 3）；
- 每个注入器把「实际影响面」（页面状态、命中次数）写进报告 `environment.faults`；diff 模式若出现**未声明的红**，单列 `unexpected-fault-influence` 问题（FAIL），不会混进回归统计。

## 差分侧 FAIL 分型（#183 评审整改 S3）

差分命令自己也写标准 `report.json`，它的 FAIL 不能一律记成 `product`：有些问题出在**清单/注入器/期望表达**上，归 `test` 才诚实。分型映射表在 `scripts/real/harness/diff/classify.mjs` 的 `DIFF_PROBLEM_FAILURE_TYPES`，由 `failureTypeForProblems(problems)` 汇总（只要有一个 `product` 码就判 `product`，否则 `test`；未知码 fail-closed 按 `test`）：

| 差分问题码 | failureType | 判据 |
| --- | --- | --- |
| `regression` / `expect-regression` | `product` | 对照侧绿、判定侧红，是候选侧行为变差 |
| `candidate-product-fail` / `expect-candidate-not-green` | `product` | 候选产物自身有未预期 FAIL，不是差分工具的锅 |
| `candidate-missing-checks` | `test` | 候选侧缺检查记录，先把套件/场景中断处置清楚 |
| `empty-expectations` / `expect-missing-check` / `no-discrimination` / `no-flip` / `expect-baseline-not-green` | `test` | 期望清单没写到点子上或缺证据力，属 test 假象 |
| `fault-not-detected` / `fault-partial-red` / `fault-reference-not-green` / `fault-stay-green-reference` / `fault-stay-green-broken` / `unexpected-fault-influence` | `test` | 注入器声明与实际影响面不符（注入器/清单缺陷） |
| `environment-mismatch` | `test` | 两侧环境漂移，先修运行环境 |

`failureTypeBasis` 固定为 `{source:'diff', signal:<命中的码集合>, note:…}`，报告里能看出这个 `test`/`product` 是怎么来的；`diff/selftest.mjs` 对映射表、未知码 fail-closed、以及「真实 doc 推导出 product/test」都有断言。

## 与 #189 报告协议的关系

- 每侧仍是标准 `report.json`（schemaVersion 2）：`verdict`、`summary`、逐检查六元组（claim/conditions/steps/observations/inference/verdict）都不变；差分只读、不重定义判定。
- `diff.json` 是**聚合层**：只引用两侧报告的检查与证据路径（相对路径），不复制原始观测；`diff.md` 由 `diff.json` 纯函数渲染，同一份 JSON 两次渲染字节相同，可直接贴 issue。
- 工具故障与产品判定的边界保持 #189 的约定：子进程异常/超时/报告缺失 → `TOOL_FAULT` 问题 → 退出码 3；不把工具问题算成产品红。
- 差分命令**自己也产一份标准报告**：证据根目录下除 `diff.json`/`diff.md` 外，还有 `report.json`/`report.md`（`scripts/real/diff.mjs` 用 `harness/evidence.mjs` 的 `Recorder` + `writeReport` 写成，判定与退出码和 `diff.json` 一致）。这样差分也是「用同一套判定/证据协议」的入口：静态门禁 R2/R3 对入口脚本的要求（JSON 报告、可区分退出码、`finally` 兜底回收子进程）同样成立。

## 自证（纯 Node，无浏览器）

```bash
node scripts/real/harness/diff/selftest.mjs
# [diff-selftest] PASS 43 项（差分判定/期望清单/基线登记/注入器/退出码/CLI）
```

覆盖：逐检查分类与对照表生成、四类区分力（尤其 bothGreen 不算通过）、`mustFlip` 未翻转 → FAIL、`mustStayGreen` 破坏 → FAIL、regression 识别、未声明注入影响 → FAIL、md 与 JSON 一致性（重复渲染字节相同、JSON 往返后一致）、退出码 0/1/2/3、注入器注册表/默认关闭/安装-卸载可逆/半装回滚、真实仓库清单与基线登记表结构、CLI `--help` 与用法错误。

建议在 `package.json` 的 `check` 链加（位置在 `check:real-report` 之后）：

```json
"check:real-diff": "node scripts/real/harness/diff/selftest.mjs"
```

## 边界与已知限制

- **旧产物无区分力是合法结论，不是工具缺陷**：`boundary` 不引用 #190 的新钩子，所以 0.4.39 时代产物与当前产物跑出完全相同的 44 条 PASS；差分工具只能如实标 `bothGreen` 并判 FAIL。要证明 `boundary` 有区分力，必须选真正有行为差异的旧产物（当前登记表里的 0.4.32）。
- 差分需要两次真实运行（各约 1–2 分钟），不进入默认 `check` 链。
- 基线 tgz 不进仓库（仅登记 sha256/文件名/来源）；缓存目录由 `DSH_REAL_BASELINE_DIR`/`--baseline-dir` 指定。
- fault 模式下注入侧常因场景提前中止而缺检查：这些缺失记入覆盖风险，不重复算「缺失即失败」；但 expectedRed 未出现在注入侧仍然 FAIL。
- 证据目录不清旧 run：每次子进程生成新 `runTag` 子目录，便于复用历史证据；`--keep` 同时保留工作目录。
