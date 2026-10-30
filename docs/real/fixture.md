# 声明式 fixture 与干净态基线（#187）

真机套件的结论只有在**已知起始态**上才可解释：上一轮留下的自定义模板、被外部改过的触发方式、
残留的远程偏好，都会让用例把"状态污染"报成"产品坏了"（假 FAIL）。本层把每轮运行的初始态
变成**一份纯数据配方**，并在套件执行前断言"起始态 = 声明值"；不符就整轮 BLOCKED，而不是带着
脏状态跑下去。

- 配方（数据）：`scripts/real/fixtures/*.json`
- 运行器（代码）：`scripts/real/harness/fixture/index.mjs`
- 纯 Node 自证：`scripts/real/harness/fixture/selftest.mjs`
- 接入点：`scripts/real/run.mjs` —— profile 装配之后、起 web 服务之前应用「重置 + 种子」；
  `preparePage` + 宿主契约 preflight 之后经产品公开路径读回当前态并与声明比对

## 结论先说

| 关注点 | 做法 |
| --- | --- |
| 初始态怎么声明 | 配方 JSON（`formatVersion` / `name` / `reset` / `seed` / `expect`），运行时用 `--fixture <名称|路径>` 选 |
| 干净态是什么 | 删除插件持久化数据（`$DSH_HOME/storages/dsh_prompt.json`）→ 插件定义（`promptDomainSpec`）的默认快照 |
| 种子怎么写 | 起宿主前按 storage-schema 契约写 store 文件（契约允许的持久化写入口，不绕过契约改内部结构） |
| 怎么读回校验 | 起宿主后 `GET /_dsh/dsh-prompt/store`（产品公开 HTTP 桥），投影成基线后与声明逐路径对比 |
| 不符怎么办 | 只记一条 `BLOCKED fixture 起始态`（reason 里列 current vs expected），**不执行套件**，退出码 2，不产生假 FAIL |
| 每轮怎么区分 | `runTag`（`<时间戳>-<pid+序号>-<随机>-<套件>`）写进 `report.json`，同秒连跑也不会撞 |
| 会不会污染真实数据 | store 路径守卫：路径必须落在本轮一次性 `DSH_HOME` 内，越界直接拒绝 |
| 失败后怎么恢复 | 无需人工清理：每轮独立一次性 home，失败/中断后直接重跑即可（证据见下） |

## 配方格式（formatVersion 1）

```jsonc
{
  "formatVersion": 1,
  "name": "templates",                 // 必填，非空；报告里用它标识配方
  "title": "模板集合初始态",             // 可选，给人看
  "description": "……",                  // 可选，说明这条配方证明什么
  "reset": true,                        // 可选，默认 true：先把插件持久化数据删掉
  "seed": {                             // 可选：起宿主前按 storage-schema 写入 store
    "global":   { "hoverTrigger": false },        // 覆盖插件默认的全局偏好
    "customs":  [ { "id": "...", "name": "...", "body": "...", "createdAt": 1700000000001 } ],
    "usage":    { "<模板 id>": 2 },               // 用量计数
    "pinned":   [ "<模板 id>" ]                   // ≤5 个，按数组顺序落 pos
  },
  "expect": {                           // 必填：起始态声明（子集语义，只查声明里出现的键）
    "storePresent": true,
    "unit": { "name": "dsh_prompt", "version": 0 },
    "customs": [ { "id": "...", "name": "...", "builtin": false, "labels": ["夹具"] } ],
    "usage":   { "<模板 id>": 2 },
    "pinned":  [ "<模板 id>" ],
    "lastUsed": null,
    "remote": { "enabled": false, "size": 5, "orientation": "auto", "density": "a" },
    "hidePreset": true,
    "hoverTrigger": true
  }
}
```

字段口径：

- **`reset`**：`true` = 删除 `storages/dsh_prompt.json`（插件唯一一份持久化数据，single 布局）。
  干净态就是「删掉后让插件定义生效」，因此 `seed: {}` 的配方**不写文件**，基线断言 `storePresent: false`。
- **`seed`** 的取值类型与宿主 schema 一致（`lib/index.js` 的 `promptDomainSpec`）：`global` 只接受
  已知键（`lastUsed` / `remoteEnabled` / `remoteSize`(1..10) / `remoteFont` / `remoteControl` /
  `remoteOrientation` / `remoteDensity` / `hidePreset` / `hoverTrigger`）；`customs` 记录必须是
  `id`+`name`+`body`+`createdAt` 合法、id 不重复；`pinned` ≤5；`usage` 计数非负。
  缺少的 `global` 键按插件默认补齐，所以配方只需要写「和默认不一样的那些」。
- **`expect`** 是**子集语义**：只检查声明里出现的键（`customs`/`usage`/`remote` 等一旦声明就整体比对，
  `remote` 四元组必须写全）。基线投影口径与宿主 `GET /store` 的 `snapshot()` 对齐：
  `customs` 只留 `{id,name,builtin,labels}` 并按 `createdAt` 升序，`usage` 是 `id→count`，
  `pinned` 按 `pos` 排序，`remote` 是归一化后的四元组。
- **参数化**：字符串里可写 `${runTag}`（含对象键，如 `usage` 的模板 id）。运行器每轮用唯一 runTag
  渲染整份配方（`seed` 与 `expect` 同参数），未知占位符直接报错 —— 不允许静默留空。
- **严格校验**：未知键、类型不符、枚举越界、id 重复、`pinned` 超限、空 `expect` 都报
  `invalid-recipe`，错误文案带路径（如 `expect.remote.density`）。

内置配方：

| 配方 | 类别 | 证明什么 |
| --- | --- | --- |
| `clean` | 干净态 | 重置后宿主读到的快照 = 插件定义默认（无模板/无用量/无置顶、远程关、悬浮触发、屏蔽预制），且插件无写入时 store 文件不存在 |
| `templates` | 模板集合 | 2 条自定义模板 + 1 条置顶 + 1 条用量按 schema 落盘，模板 id/文案带 `${runTag}`（本轮种子可追溯） |
| `trigger-hover` | 触发模式 | 触发模式显式钉在悬浮触发（防上一轮翻成点按）；三类验收用它；`#192` 的 `trigger` 套件用它做指针 + 键盘两路径 |
| `trigger-click` | 触发模式 | 点按触发（`hoverTrigger=false`）；**当前唯一 smoke 套件假设 hover**，该态下 hover 断言不适用，留给 #192 的 click 态场景 |
| `undo-group` | 撤销分组 | 3 条自定义模板：含标记单行 `SMART{{cursor}}END`、含标记多行、无标记 `NOMARK`；模板名/id 带 `${runTag}`；`#192` 的 `undo-group` 套件用真实输入验证 undo 分组 / redo |
| `remote-prefs` | 远程开关类偏好 | 远程总闸关 + `size=3` / `orientation=landscape` / `density=b` 非默认档位，覆盖 snapshot 归一化口径；总闸关不改变当前 smoke 的观测面 |

## 命令

```powershell
# 默认初始态 = clean（干净态）
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --evidence-dir <证据目录>

# 指定内置配方
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --fixture templates --evidence-dir <证据目录>
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --fixture trigger-hover
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --fixture remote-prefs

# 显式配方路径（跨仓复用/临时实验；仍只写本轮一次性 home）
node scripts/real/run.mjs --artifact <插件.tgz> --fixture D:/tmp/my-fixture.json
```

也可用环境变量：`DSH_REAL_FIXTURE`（配方名/路径）、`DSH_REAL_FIXTURE_FAULT`（故障注入）。
`--help` 里有完整参数表。纯 Node 自证：

```powershell
node scripts/real/harness/fixture/selftest.mjs
# RESULT: 108 PASS / 0 FAIL（fixture 自证全绿）
```

## 失败行为：BLOCKED 而不是假 FAIL

起始态与声明不符时，`run.mjs`：

1. 把声明、实测、差异、重置/种子/读回结果写进 `report.json` 的 `environment.fixture`；
2. 记**一条** `BLOCKED fixture 起始态`，`reason` 里按路径列出 current vs expected，例如：
   `配方 templates 起始态与声明不符，套件未执行。起始态与声明不符（2 处）：customs.length：当前=3，期望=2；hoverTrigger：当前=false，期望=true`；
3. **不调用套件**（报告里不会出现套件的检查项，也就没有因状态污染产生的 FAIL）；
4. 退出码 2（与其它 BLOCKED 一致）。

负例注入（证明它能红）：`--fixture-fault pollute` 在种子之后额外多写一条未声明模板并翻转
`hoverTrigger`，模拟"上一轮残留/外部写入把状态弄脏"：

```powershell
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --fixture templates --fixture-fault pollute
# [real] fixture templates  故障注入=pollute  起始态=与声明不符（BLOCKED）
# [real] PASS 6 / FAIL 0 / BLOCKED 1 -> BLOCKED    （6 = 契约项；套件未执行）
# 退出码 2
```

可选注入模式：`pollute`（多写未声明内容）、`skip-seed`（只重置不写种子）、`drop-store`
（写完种子又删掉）。它们只影响本轮一次性 home，不改产品、不碰真实数据。

## 与宿主契约、storage-schema 的关系

- **storage-schema 契约（`host.storage-schema`）是种子格式的权威**：`$DSH_HOME/storages/<域>.json`、
  顶层 `{unit:{name,version}, global, tables}`、插件域 `dsh_prompt.json`。配方写出的文档就是按这个
  契约构造的（`unit.name/version` 必须等于 `promptDomainSpec` 的 `dsh_prompt`/`0`，否则宿主拒读）。
- **读回走产品公开路径**（`GET /_dsh/dsh-prompt/store`，同源围栏内），不是直接读盘：这样断言的是
  "宿主实际看到的起始态"，覆盖了 `snapshot()` 的归一化（旧数据缺键回落默认、labels 归一、远程偏好
  归一）。盘上文件只用于报告里的存在性/字节数与离线自证。
- **preflight 先于 fixture 基线**：宿主契约（启动输出/门/输入/存储/语言/版本）不成立时先报宿主项
  BLOCKED，不再叠加 fixture 结论；契约全绿后才断言起始态。
- 种子写入在起宿主**之前**：写文件（同目录临时文件 + rename 原子发布）是最确定的入口，不依赖页面
  就绪；读回在起宿主之后用公开桥，形成"写—读"闭环。

## 恢复语义：失败后直接重跑

每轮运行使用独立的 `runTag` 目录：一次性 `DSH_HOME` = `<workRoot>/<runTag>/home`，store 也在里面。
收尾删掉本次运行目录（`--keep` 时保留）。因此：

- 上一轮失败/中断不会留下影响下一轮的状态（下一轮是新目录、新 home、新 store）；
- 失败后**不需要人工清理**，直接重跑同一条命令即可；
- 路径守卫再从代码层兜底：store 路径必须落在本轮一次性 `DSH_HOME` 内，否则抛
  `store-path-outside-home` 并记 BLOCKED（拒绝越界写真实用户数据）。

证据（同一台机器、同一产物）：

```text
templates + pollute  → BLOCKED / FAIL 0 / 退出码 2   <证据>/<runTag1>/report.json
templates（直接重跑） → PASS 12/12 / 退出码 0          <证据>/<runTag2>/report.json
```

## 给 #188（观测层/真实输入）用的 API

`scripts/real/harness/fixture/index.mjs` 的导出就是稳定接缝：**布置**用 `prepareFixture`（或
`loadFixture`+`resolveFixture`+`applyFixture`），**断言**用 `captureBaselineFromOrigin`+`checkBaseline`。

```js
import {
  prepareFixture, makeFixtureParams, captureBaselineFromOrigin,
  checkBaseline, formatDiffs, baselineFromSnapshot, diffBaseline,
} from '../../harness/fixture/index.mjs';

// ① 布置：在 一次性 home 上重置 + 种子（run.mjs 已在起宿主前做过一次；场景内也可再布置）
const prepared = prepareFixture({
  fixture: 'templates',
  homeDir,                                   // 本轮一次性 DSH_HOME
  params: makeFixtureParams({ runTag }),     // ${runTag} 参数
  fault: null,                               // 负例时传 'pollute' / 'skip-seed' / 'drop-store'
});
prepared.declared;   // 声明的 expect
prepared.storePath;  // 守卫通过后的 store 绝对路径

// ② 场景动作之后读回（产品公开路径）并断言
const captured = await captureBaselineFromOrigin({ origin: server.origin, storePath: prepared.storePath });
const check = checkBaseline(prepared.recipe, captured.baseline);
if (!check.ok) {
  recorder.fail('场景后的模板集合', {
    expected: check.declared,
    observed: check.observed,
    detail: formatDiffs(check.diffs),
  });
}

// ③ 只要投影/差分的场合
baselineFromSnapshot(snapshot, { storePresent: true });   // 宿主 GET /store → 基线
diffBaseline({ hoverTrigger: false }, captured.baseline); // 子集语义逐路径对比
```

约定：

- 套件只读 `prepared.*` 与自己的动作结果，不碰 store 内部结构；断言失败用 `recorder.fail` 带
  expected/observed，工具/读取失败用 `recorder.blocked`。
- 场景内改状态（插入、置顶、切偏好……）优先走产品公开路径（页面动作或 HTTP 桥），再读回断言；
  fixture 层不提供绕过产品的内部改写入口。
- 新增配方 = 加一个 JSON 文件（含 `expect` 声明）+ 在 `selftest.mjs` 的清单里登记名字；
  不需要改用例代码。

## 证据字段（report.json）

`environment.fixture`：

- `name` / `request` / `title` / `params`（含 `runTag`）/ `fault`；
- `storePath`（本轮一次性 home 内的绝对路径）与 `storeGuard.ok`；
- `applied`：`reset`（`existed`/`removed`）、`seed`（`written`/`bytes`/`sha256`/`skipped`）、
  `storeBefore`/`storeAfter`、`document`（落盘文档摘要：global + 表键）；
- `declared`（声明）、`observed`（实测基线）、`ok`、`diffs`（逐路径差异）；
- `http`（读回状态码/字节数）、`storeFile`（写盘后存在性与字节数）。

`checks[]` 里对应一条：PASS/`BLOCKED fixture 起始态`；`runTag` 在报告顶层，供两份报告互相区分。
