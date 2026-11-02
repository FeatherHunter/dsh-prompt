# #195 / #196 调研：hidePreset 未覆盖 /prompt 斜杠源，以及关闭/收窄该源的可行面

- 关联 issue：#195（BUG：全局「屏蔽预制模板」没有作用到 /prompt 斜杠源）、#196（enhancement：无法关闭 /prompt 源，或让它只在显式前缀之后出候选）
- 日期：2026-11-02
- 方法：只读静态取证。宿主侧读本地抽取件 `.dsh-tmp/trigger`（`@deepseek-ai/dsh-client-ui-input-trigger` 0.2.1-rc.3，见其 `package.json:2,4`）；插件侧以 `src/client/*.ts` 与构建物 `lib/client.js` 互证；测试与门禁只读脚本、未执行（脚本会往仓内写 `.rt-tmp*` 临时目录）；另跑了一次一次性运行时探针核对 #195（脚本在 OS 临时目录 `D:\Temp\dsh-triage-195`，未进仓，数据见第 4 节）。#195/#196 的 issue 原文未在本会话读取（只读要求不访问 GitHub），诉求按任务简报转述。
- 范围限制（重要）：抽取件并不完整——只有 `package.json`、`README.md`、`lib-client.js`、`lib-index.js`，没有 `.d.ts`、locale JSON 和 `src`；`node_modules` 与 `app.asar.unpacked` 里都没有这个包，`app.asar` 未解包。因此下文所有「宿主会怎样」都是对 0.2.1-rc.3 构建产物的静态阅读，不是真机验证，也不能证明运行中的宿主就是这一版。

## 结论摘要

- **#195 属实，且是「范围缺口」而非漏写一行**：全仓唯一 `applyHidePreset` 调用点是 `src/client/template-browser.ts:1678`；`/prompt` 的候选（`src/client/prompt-trigger.ts:45,47`）、智能卡的检索（`src/client/smart-score.ts:88`）与兜底行（`src/client/smart-card.ts:258`）都直接用裸 `allTemplates()`。#165 自己把范围写死为「列表与标签云」——`template-browser.ts:1689` 的注释明说 `/prompt` 与智能卡「不受影响，无需同步」，`src/client/strings.ts:55` 的提示文案也只承诺这两处。
- **宿主契约**：宿主对每个源调用 `source.candidates(projection, { query, quoted, position, drilled, signal })`（`.dsh-tmp/trigger/lib-client.js:1420-1425`）；`query` 是触发符之后到光标的**原样切片**（`lib-client.js:801`）。裸 `/` 时 `query === ''`（由 `801` 直接推出）。
- **option B 有宿主行为支撑**：状态为 `ready` 且条目为空的组会被整条跳过、不出组头也不出「无结果」行（`lib-client.js:1764`）；当所有组都空时，整个菜单被关掉（`lib-client.js:916`）。组标题默认是 `t(group.source)`，源名没有词条时原样显示（`lib-client.js:1764-1768`、`1860-1863`）。
- **option A 在 API 层可行、端到端未验证**：`registerSource` 返回 disposer 而不是 `void`（`lib-client.js:1565-1570`）；重复的 `(trigger, name)` 会抛错（`:1558`），所以「先 dispose 再 register」是唯一路径；dispose 会立刻删掉已打开菜单里该源的组（`:1311-1321`）；晚注册只 warm、不重取已开菜单（`:1329-1334`）。Cordis 的 `ctx.effect` disposer 可手动调用（`node_modules/@deepseek-ai/cordis/lib/types/fiber.d.ts:144-151,157`），但插件目前没有保存这个 disposer（`src/client/index.ts:648-651` 直接把它交给 effect）。
- **option B 会改测试契约**：`scripts/repro/test-issue-178.cjs:769-770` 明确断言空 query 的候选非空（J2）。#195 的过滤修复不破现有测试（自定义模板仍在），但 `test-issue-23` 依赖显式 `saveHidePreset(false)` 钉住全量池（`scripts/repro/test-issue-23.cjs:40-41`）。
- **门禁面**：`npm run check` 含 `check:issue-178/179/181/182`、`check:lib-sync`、`check:bilingual-134`、`check:locale-137`（`package.json:74`）；`test:issue-23/142/165` 只在 opt-in 脚本里（`package.json:87,127,134`），不在 check 链。
- **README 的 `/p` 说法与实现不符（静态推断）**：`filterPromptTemplates` 只剥 `prompt` 前缀（`prompt-trigger.ts:42-44`），`/p` 的 `query` 是 `'p'`，会走子串检索而不是「全部模板」；宿主也没有 `/p` 别名（`lib-client.js:793-810`）。
- **带空格的用法在真实输入下到不了源**：宿主扫描到空白就返回 `null`（`lib-client.js:795`），所以 `/prompt 复盘` 会在空格处关菜单；`test-issue-23.cjs:135` 与 `README.md:84` 的空格形式只在直接调用 `candidates` 时成立（推断，未真机）。

## 1. 宿主 input-trigger 契约：candidates 怎么被调用、请求里有什么

### 1.1 调用点与请求对象

宿主在 `fetchCandidates(hit, roster)` 里逐源调用（`.dsh-tmp/trigger/lib-client.js:1414-1443`）：

```js
1420  for (const source of roster) source.candidates(projection, {
1421    query: hit.query,
1422    quoted: hit.quoted,
1423    position: hit.position,
1424    drilled: this.drilled,
1425    signal: controller.signal
1426  }).then((items) => {
```

- `roster` 由 `this.deps.roster.sources(hit.trigger)` 取得（`:1068`），服务的 roster 按 `order` 升序排序：`sort((a, b) => (a.order ?? 0) - (b.order ?? 0))`（`:1594`）。dsh-prompt 的源 `order` 是 5（`prompt-trigger.ts:55`）。
- 返回值直接进入 `source-settled` 事件的 `items`（`:1426-1433`）：宿主不 await 全部源、不合并、不截断、不去重（`fetchCandidates` 与 `menuReduce` 里都没有这类逻辑）。
- 单个源抛错/拒绝时只 `console.error` 并派发 `source-failed`（`:1434-1441`），该组被删除，不影响其它源。
- `signal` 是每次取候选新建的 `AbortController`（`:1415-1417`）；源应当把它透传给自己的异步工作。

### 1.2 query 从哪来：detectTrigger 的斜杠分支

```js
793  for (let i = caret - 1; i >= 0; i--) {
794    const ch = draft.charAt(i);
795    if (WHITESPACE.test(ch)) return null;
796    if (ch !== "/") continue;
797    if (guard.tier === "claimed") continue;
798    if (!boundaryOk(draft, i, ch)) continue;
799    return {
800      trigger: ch,
801      query: draft.slice(i + 1, caret),
802      quoted: false,
803      position: draft.search(/\S/) === i ? "leading" : "inline",
804      span: {
805        start: i,
806        end: caret,
807        draftRev: 0
808      }
809    };
810  }
```

- `query` 不是「命令名」，而是斜杠后到光标的整段文本；插件自己再剥前缀。
- **裸 `/`：`query === ''`**（`draft.slice(i + 1, caret)` 在 `i === caret - 1` 时为空串），`position` 为 `leading`。这是 option B 所依赖的判据。
- 扫描从光标往前，遇到**任何空白**立即 `return null`（`:795`）——所以 `/prompt 复盘` 在输入空格后菜单就关了；插件能把 `prompt 复盘` 当 query 处理只发生在测试直接调用或未来宿主改变时。
- 没有别名层：`/p` 就是 `trigger` `'/'`、`query` `'p'`。

### 1.3 什么时候根本不发请求

- 当前触发符没有已注册源：`roster.length === 0` → `close`（`:1069-1073`），不会有空菜单。
- 同一个 hit（`trigger`/`query`/`quoted`/`span` 全等且未 launched）不重复求值（`:1065-1067`）；因此源被注销后即使菜单还开着，也要等下一次输入变化才会重算 roster。

## 2. 空候选时宿主渲染什么（option B 的关键）

### 2.1 组级：ready 且空 → 整条不渲染

```js
1764  children: state.groups.map((group) => group.status === "ready" && group.items.length === 0 ? null : (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [group.showGroupTitle === false || group.items.some((item) => item.section !== void 0) ? null : (0, react_jsx_runtime.jsx)("div", {
1765    className: MenuView_module_css_default.groupTitle,
1766    role: "presentation",
1767    "data-source": group.source,
1768    children: t(group.source)
1769  }), group.status === "pending" && group.items.length === 0 ? (0, react_jsx_runtime.jsxs)("div", {
1770    role: "status",
1771    "aria-label": t("loading"),
...
1785    })]
1786  }) : group.items.map((item, index) => {
```

- 空组既没有组头，也没有占位行/「无结果」行——三元表达式直接返回 `null`。
- 只有 `pending` 且为空才渲染两行 skeleton（`:1769-1785`）。所以 option B 下裸 `/` 会先闪一下骨架屏，等 promise 完成、组转为 `ready` 且空之后消失；**宿主没有防闪机制**（推断，未真机）。
- `showGroupTitle: false` 可以让该组不出组头（`:1764` 条件的第一项），dsh-prompt 目前没有设置这个字段。

### 2.2 全部组都空 → 整个菜单关闭

- `source-settled` 归并后：`if (allReadyEmpty(groups)) return closed(state)`（`lib-client.js:916`）；`allReadyEmpty` 定义为「每个组都 ready 且 items 为空」（`:878` 附近）。
- `source-failed` 删除该源后，若没有组了或全部为空，也 `closed`（`:927-935`）。
- `closed` 清空 `groups` 并置 `open: false`（`:844-850`），`MenuView` 直接 `return null`（`:1729`）。
- 因此：**option B 下，若宿主其它源（内置命令等）对裸 `/` 有候选，菜单继续存在、只少了 prompt 组；若没有其它候选，菜单整个不出现。**没有「无结果」提示可展示。

### 2.3 组标题与源名

- 标题是 `t(group.source)`（`:1768`），locale 注释说明「group titles keyed by source name（查不到时返回键本身，未知源显示原始名）」（`:1860-1863`）；zh/en 字典只登记了 `command`/`skill`/`subagent`/`loading` 等（`:1866-1888`）。
- 结论（推断）：dsh-prompt 的源名 `prompt` 在中文界面会原样显示小写 `prompt`，不是本地化标题。

### 2.4 尺寸与排序

- `MAX_HEIGHT = 400`（`:1677`，注释「fits the two headings and eight built-in command rows」）；CSS `max-height: 400px`（`:1628`）；`TOP_MARGIN = 84`（`:1683`）。超过约 8 行即内部滚动。
- 组顺序 = 源 `order` 升序（`:1594`）；dsh-prompt `order 5`，与内置源（通常更小）并排时的相对位置由宿主源决定。
- 宿主不按条目数截断、不去重；`MAX_ITEMS` 是插件自己的 30（`prompt-trigger.ts:23`）。

## 3. 源的注册、注销与运行时重注册（option A 的关键）

### 3.1 registerSource 的契约

```js
1549  /**
1550   * Register one trigger source. Live session controllers are notified so a
1551   * source arriving after scope birth still warms and joins the lexicon.
1552   * @param src - the source; (trigger, name) must be unique — duplicates throw.
1553   * @returns the disposer (callers wrap registration in ctx.effect). Disposal
1554   * while a controller shows the source's menu group drops that group.
1555   */
1556  registerSource(src) {
1557    const { live } = this;
1558    if (live.sources.some((s) => s.trigger === src.trigger && s.name === src.name)) throw new Error(`slash source "${src.trigger}${src.name}" is already registered`);
1559    live.sources.push(src);
1560    for (const controller of live.controllers.values) try {
1561      controller.sourceAdded(src);
1562    } catch (error) {
1563      console.error(`[ui-input-trigger] source "${src.trigger}${src.name}" late-registration setup failed:`, error);
1564    }
1565    return () => {
1566      const at = live.sources.indexOf(src);
1567      if (at < 0) return;
1568      live.sources.splice(at, 1);
1569      for (const controller of live.controllers.values) controller.sourceRemoved(src);
1570    };
1571  }
```

- **返回 disposer，不是 `void`**；disposer 幂等（`indexOf < 0` 直接 return）。
- **重复注册抛错**，不是替换；所以运行时切换必须先调旧 disposer，再 `registerSource` 新的。
- 注销会对每个活控制器调 `sourceRemoved`（`:1569`）：若菜单开着且 `hit.trigger === source.trigger`，立刻派发 `source-failed` 删掉该组（`:1311-1321`）；同时清理 lexicon 订阅。
- 晚注册会对活控制器调 `sourceAdded`（`:1560-1564`）：warm + 订阅 lexicon（`:1329-1334`），**不重取已打开菜单**；`refreshOpenMenu` 也只按同一 hit 重取（`:1343-1349`）。也就是说重注册后，已开的菜单要等下一次击键才会出现新组。

### 3.2 ctx.effect 与运行时开关

- Cordis `fiber.d.ts:157`：`effect(execute: () => SyncEffect, label?: string): Disposable<Promise<void>>`；`:144-151` 注释说明 execute 立即执行、产生的 disposer 在手动调用或 fiber 卸载时执行、二次调用 no-op。→ **手动调用 effect 的 disposer 再重新 `effect` 在 API 层成立**。
- 插件当前写法（`src/client/index.ts:648-651`）：`ctx.effect(() => ctx.inputTriggers.registerSource(buildPromptSource()), 'dsh-prompt: /prompt source')`，外面只有 `typeof registerSource === 'function'` 守卫；disposer 没有存到任何状态里。要做条件注册，必须自己保存句柄（事实陈述，不是实现方案）。
- 抽取件 README 的已知限制：「Global source layer only — session-scope source registration (per-session shadowing) is designed but not enabled」（`.dsh-tmp/trigger/README.md:80`）。所以注销/重注册是**全局**效果，不过 `hidePreset` 本身也是全局偏好（`lib/index.js:114,130,203`），作用域恰好一致。
- **未验证**：没有官方示例或测试覆盖「运行中 dispose + 重注册」；dsh-prompt 也从未这样做过。`ctx.effect` 的 disposer 类型是 `Disposable<Promise<void>>`，手动调用后的清理时序（尤其与已开菜单的 `source-failed` 竞态）没有真机证据。

## 4. #195 的代码路径：所有模板选择点与 applyHidePreset

`applyHidePreset` 定义在 `src/client/template-library.ts:254-257`；全仓（`src/client`）grep 只有 3 处命中：定义、`template-browser.ts:29` 的 import、`template-browser.ts:1678` 的调用。构建物对应 `lib/client.js:5016-5017`。

| 位置 | 用途 | 是否过滤预制 |
|---|---|---|
| `src/client/template-browser.ts:1677-1678` | 面板可见池 `const pool = applyHidePreset(allTemplates(), hide)` | **是（唯一调用点）** |
| `src/client/template-browser.ts:1709` | 远程列表 `remoteListBase = pool` | 是（同一池） |
| `src/client/template-browser.ts:2294` | 标签云 `cloudWords = actionCloudLabels().filter(...customWordSet)` | 是（`customWordSet` 由 pool 派生，`:1679-1686`） |
| `src/client/template-browser.ts:1547` | `logEvent('panel.open', { rows: allTemplates().length })` | 否（仅日志，无 UI 影响） |
| `src/client/prompt-trigger.ts:45` | 空 query：`return sortedTemplates(allTemplates())` | **否** |
| `src/client/prompt-trigger.ts:47` | 非空 query：`sortedTemplates(allTemplates().filter(...))` | **否** |
| `src/client/smart-score.ts:88` | 智能卡候选：`for (const tpl of allTemplates())` | **否** |
| `src/client/smart-card.ts:258` | 手动打开时的兜底：`[...allTemplates().slice(0, 3)]` | **否** |

- 复现报告的判断成立：`prompt-trigger.ts` 的 import 面（`:15-20`）根本没有 `applyHidePreset`/`loadHidePreset`；`filterPromptTemplates` 两条分支都是裸 `allTemplates()`。构建产物 `lib/client.js:21886-21893` 与源码一一对应（`:21891` 空 query 返回 `sortedTemplates(allTemplates())`，`:21893` 过滤），同样没有过滤。
- **运行时探针（2026-11-02，一次性，未进仓）**：以 `hidePreset=true` 的桩 store 加载真实 `prompt-trigger.ts` 后，`filterPromptTemplates('')` 返回 26 条、其中 `builtin=24`、自定义 2 条；`candidates({ query: '' })` 返回 26 条，前三条是预制（第一性原理拆解 / 苏格拉底式追问 / 深度多维分析）；同一批再经 `applyHidePreset(all, true)` 后只剩 2 条、`builtin=0`。这是 #195 的直接复现，也说明源侧套同一函数即可得到与面板一致的可见池（可行性事实，非修复方案）；探针只覆盖纯逻辑，不覆盖宿主菜单。
- **但这不是「忘了同步」**：`template-browser.ts:1689` 的注释原文是「云只是面板本地 useState 过滤，/prompt（prompt-trigger.ts）与智能卡（smart-card.ts）走 template-library 独立检索，不受影响，无需同步」；`:1705` 又写「#165：远程与悬浮/设置吃同一个可见池」。`#165` 的 CHANGELOG 也只列了「小列表底栏眼睛按钮、大列表底部按钮、设置页开关三处同源联动」（`CHANGELOG.md:123`）。所以 #195 是**已知并被接受的范围边界**，现在被用户当成 bug 报回来。
- 文案层面同样只承诺两处：`strings.ts:55`「打开后列表与标签云不再展示预制模板」/ "hidden from the list and label cloud"；`strings.ts:52` 的标题却叫「屏蔽预制模板」（全局口吻）。这是 #195 的语义张力来源。
- 设置页只有 `hidePreset`（`settings-page.ts:710-725`）与触发方式（`:728-735`）两行，没有斜杠源开关（`:737` 直接是 `TemplateBrowser compact:false`）。

## 5. #196 三个选项的插件侧约束

### 5.1 option B：空 query 返回 []

- 判据现成：`req.query === ''` 即裸 `/`；宿主行为见 `1.2`。实现只需在最前面按空 query 返回 `[]`（现状是全部模板，`prompt-trigger.ts:45`）。
- 宿主行为支持：空组不渲染（`lib-client.js:1764`），全空则整菜单关闭（`:916`）。**不会出现空组头或「无结果」行**。
- 副作用：`test-issue-178.cjs:769-770` 的 J2 会红（断言空 query 候选非空）；`/p` 仍然会出候选，而且按字母 `p` 子串检索（`prompt-trigger.ts:42-44`），不是「全部模板」。
- 「只在显式 /prompt 之后出候选」的实际边界：`/prompt`（`query === 'prompt'`，剥前缀后为空，结果仍是全部模板）可以；`/prompt词`（无空格）可以；`/prompt 词`（有空格）在宿主层就到不了源（`lib-client.js:795`）。如果产品文案要写「/prompt 后加空格再筛选」，当前宿主不支持。

### 5.2 option A：持久化开关 + 条件注册

- 现有持久化管线可复用：`lib/index.js` 的 `hidePreset` 是 `GlobalSchema` 的可选布尔（`:114`）、缺省 `true`（`:130`）、快照归一（`:203`）、`setHidePreset` 校验后 `global.set` 并立即返回（`:269-271`）；路由 `/_dsh/dsh-prompt/hide/set` 在 `KNOWN_ROUTES`（`:447`）与 POST handler（`:999,1006`）里。`hoverTrigger` 是同一套（`:116,279-281`），#179 已证明「加一个全局开关」的完整链路。
- 缺的是：插件没有保存 `registerSource` 的 disposer（`index.ts:648-651`），也没有「按偏好决定是否注册」的分支；设置页没有对应行（`settings-page.ts:710-737`），`strings.ts` 没有 slash 相关键。
- 契约支持度见 `3`：注销会即时删组、重复注册抛错、晚注册只 warm、**不重取已开菜单**（宿主 `sourceAdded` 不重播 roster，`:1329-1334`；`refreshOpenMenu` 是宿主内部方法，插件调不到，`:1343-1349`）。**API 层支持，真机未验证**；因此开关变化后，已开的菜单是「组立刻消失」还是「下一次击键才更新」，静态代码更支持前者（注销分支立即删组）但未真机。
- 默认值建议层面：若默认关（即不注册），所有既有用户升级后 `/prompt` 直接消失，属于破坏性变更；默认开则保持现状。

### 5.3 option C：空 query 只给置顶/最近

- `MAX_ITEMS = 30`（`prompt-trigger.ts:23`），空 query 先 `sortedTemplates(allTemplates())` 再 `slice(0, 30)`（`:45` + `:60`）。当前 24 条预制 + 自定义通常不超过 30，所以「看到全部模板」在多数用户那里成立（`README.md:86`）。
- 排序数据在 `cache`：`sortedTemplates` 只按 `usage` 降序（`template-library.ts:486-493`），注释明确「设置页与 /prompt 忽略置顶」（`:483-485`）；置顶在 `cache.pinned`，只被 `sortedTemplatesBottomUp` 使用（`:516-521`）。「最近使用」没有现成的 lastUsed 排序键（用量计数不等于时间）。
- 因此 C 是纯插件侧改动（筛选 + 可选新数据），不动宿主；但「置顶/最近」需要新语义，且会改变 `/prompt` 首屏的既有承诺。

## 6. 测试与门禁影响

### 6.1 断言了 /prompt 候选的测试

- `scripts/repro/test-issue-178.cjs` J 组（`:765-788`）：
  - `:768` `eq(src.trigger, '/', 'J1 trigger = /')`
  - `:769-770` `const cands = await src.candidates({}, { query: '' })` / `ok(Array.isArray(cands) && cands.length > 0, 'J2 候选人非空')`
  - `:771-775` 断言 `x-marker` 与 `description` 不含光标标记；`:777-783` 断言 `x-lines` 多行；`:784-787` 断言 `onPick` 只返回 `{ text }`。
  - 种子是三条自定义模板 `builtin: false`（`:192-196`），fetch 桩里 `hidePreset: true`（`:202`）。
  - **option B（空 query → []）必破 J2**；#195 的过滤修复不破（自定义仍在，J2 的 `length > 0` 仍成立）。
- `scripts/repro/test-issue-23.cjs`：
  - `:40-41` 显式钉住展示态：注释「#165：缺省=屏蔽会藏预置云词/行，本票断言标签语义（全量池），显式钉住展示（屏蔽态由 165 门禁覆盖）」，随后 `try { if (store.saveHidePreset) store.saveHidePreset(false) } catch (e) {}`。
  - `:108-111` `filterPromptTemplates('prompt 执行')` 的 id 序列必须等于 `store.allTemplates()` 里 haystack 含「执行」的子集（注释「24 条，同改前」）；`:120-130` 断言 `candidates` 数等于该子集长度、`description` 等于 `labelString + ' — ' + body 42 字`；`:135-139` 覆盖 `'prompt 复盘'` / `'prompt复盘'`；`:328-329` 断言 `filterPromptTemplates('prompt')[0].id === 'fp'`。
  - 若 #195 改成「无条件应用 hidePreset」，这些断言在默认 `hidePreset=true` 下会红——但测试自己把偏好钉成 `false`，所以**现有测试不会红**；新测试需要补「`hidePreset=true` 时 /prompt 不含预制」。
- `scripts/repro/test-issue-142.cjs`：`:205-207` 用 `query: 'prompt'` 找 `cEmpty` 并断言 `descEn.indexOf('Custom') === 0`；`:230-232` 中文版同理找「自定义」。目标始终是自定义模板，**#195 过滤修复不破**。
- `scripts/repro/test-issue-165.cjs`：覆盖面是 A store / B `lib/index.js` 静态 / C panel 静态 / D index 静态 / E settings 静态 / F i18n（`:3-17`），断言包括缺省 `loadHidePreset() === true`（`:84`）、`normalizeHidePreset`（`:85-88`）、`applyHidePreset` 纯函数（`:90-94`）、保存先行 + POST `/hide/set`（`:96-101`）、panel 侧 `hide && builtin`/`presetCount`（`:121-143`）、中文 `hidePreset === '屏蔽预制模板'`（`:166-167`）。**全文没有 /prompt 断言**，不钉斜杠源，也不覆盖 #196。

### 6.2 门禁脚本

- `package.json:74` 的 `check` 链包含 `check:issue-178`（`:57`）、`check:issue-179`（`:59`）、`check:issue-181`（`:58`）、`check:issue-182`（`:60`），以及 `check:lib-sync`（`:44`）、`check:bilingual-134`（`:48`）、`check:locale-137`（`:49`）。`test:issue-23`（`:87`）、`test:issue-142`（`:127`）、`test:issue-165`（`:134`）**不在** check 链，属 opt-in。
- `scripts/check-lib-sync.mjs:1-21`：把 `lib/` 快照到临时目录 → 完整构建 → 行尾归一双字节比对；`lib/index.js` 是检入源码、不参与构建（`:30`）。任何 `src/client` 改动都要求同步重建 `lib/client.js`。
- `scripts/check-bilingual-134.mjs:1-22`：A 组逐键 zh/en 非空、en 零 CJK、zh 必须有 CJK（例外 `panelTitle`/`entryBtn`）；B 组 7 个面的英文 chrome 不得含 CJK；C 组上限 `PILL_MAX=10`、`BADGE_MAX=16`、`HINT_MAX=45`、`RATIO_MAX=5.0`。若给 #196 加设置项文案，会走这套预算。
- `scripts/check-locale-137.mjs:373-378`：`export const inject` 必须保留 `'slots'` 与 `'inputTriggers'`（断言信息「inject 原两项应保持」），且不得加 `'locale'`。**条件注册不能靠改 inject 实现**。
- `scripts/check-target-tree.mjs:1-24`：`--expect=target` 用 `docs/naming-169-spec.md` 的 33 行 rename map；新增源文件要进命名规格（`docs/naming-169-spec.md:51` 已登记 `prompt-trigger.ts`）。
- `scripts/check-log-shape.mjs:623` 与 `scripts/repro/test-issue-59.cjs:293` 用 `inputTriggers: { registerSource: () => undefined }` 桩，不校验返回值——若改成保存 disposer，桩需要跟着改（推断）。

## 7. 文档与设计意图

- `README.md:77-90`「入口二 /prompt 触发源」：`:83`「输入框敲 `/prompt` 或者 `/p`。」；`:84`「`/prompt 复盘` 可以缩小范围。」；`:86`「`/prompt` 看到全部模板。」——三句都建立在「有候选」上，option B 会让 `:86` 与裸 `/` 的说法失效，`:84` 的空格形式本身还与宿主合同冲突（见 `1.2`）。
- `CHANGELOG.md:123` #165：「屏蔽预制全局开关……小列表底栏眼睛按钮、大列表底部按钮、设置页开关三处同源联动……持久化」——三处都在面板，**没有 /prompt**。`CHANGELOG.md:30` #179：触发方式可切（`hoverTrigger`），门禁 `check:issue-179`。
- `CONTEXT.md`：`:13-15` prompt 工具箱、`:17-19` 预制模板、`:107-109` 用量计数（设置页与 /prompt 用量降序）、`:113` 悬浮列表、`:115` 触发方式、`:119` 底置排序（设置页与 /prompt 例外）、`:127` 光标标记（/prompt 只剥标记）。**没有 `hidePreset` 词条**。
- `GLOSSARY.md`：`:9-11` Preset Template、`:33-39` Usage Count / Bottom-Up Ordering、`:45-47` Hover List、`:49-50` Trigger Mode。**没有 `hidePreset` / slash-source 词条**。
- 既有 research：`research/trigger-mode-setting/findings.md`（#179）`:22-23` R5 明确把「不改 /prompt 斜杠管线（`prompt-trigger.ts:57` 只 `ensureLoaded`，不碰 panel-visibility）」列为非目标；`:97-108` 列出 #165 的同构触点；`:203-210` 是它的测试清单。也就是说，#179 立项时就**主动排除**了这条管线，这正是 #195 今天暴露的缺口。
- 其它笔记只在讲别的事时顺带提 `/prompt`，**没有一篇回答 #195/#196**：`research/template-escape-caret/findings.md:22,26`（/prompt 只返回 `{text: body}`）、`research/cache-and-labels/findings.md:119`（trigger 的 L26-56 描述）、`research/tag-cloud-70/investigation.md:155,166`（过滤与描述行格式）、`research/blurred-composer-caret/findings.md:158`（插件不 focus）、`research/small-list-pills/findings.md:15`、`research/issue-182-checkbox-hover/findings.md:19`、`research/host-vs-plugin-h1-orientation.md:79`、`research/locale-sources/findings.md:197`、`research/settings-open-investigation/findings.md:85,117`。
- 因此本笔记不重复既有结论：#195 的机制、#196 的三个选项与宿主空组行为此前**没有**任何一篇笔记覆盖，值得单独成篇。
- 引用提醒：`CHANGELOG.md:84` 也出现「#196」，但那指 `dsh-plugin-update` 上游仓库的第 196 号（更新器自检与面板副本身份），**不是本仓 #196**，别混。

## 8. 负向发现 / 未验证

- **未真机**：第 4 节的探针只覆盖 `prompt-trigger.ts` 的纯逻辑；没有在运行中的 DSH 里实际输入 `/`、`/prompt`、`/p`、`/prompt ` 观察菜单；所有宿主行为来自 `.dsh-tmp/trigger/lib-client.js` 的静态阅读，且该抽取件不含 `src`、类型与 locale，版本一致性未证明。
- **未跑测试/门禁**：`test-issue-178/23/142/165` 与 `check:*` 均只读脚本；`J2` 会红、`test-issue-23` 会因钉住 `false` 而不红，都是静态推断。
- **未找到宿主「无结果」行**：locale 字典（`lib-client.js:1860-1888`）没有对应键，`MenuView` 也没有空态分支；这是「没有」的负向证据，不是没找到代码位置。
- **未找到宿主侧候选上限/去重**：`fetchCandidates`（`:1414-1443`）与 `menuReduce`（`:892-935`）只做 settled/failed 归并；`MAX_ITEMS=30` 是插件行为。
- **未验证运行时重注册**：`registerSource` 的 disposer 语义有代码与 JSDoc（`:1549-1570`），Cordis `effect` 也允许手动释放（`fiber.d.ts:144-151`），但没有官方示例、没有 dsh-prompt 先例、没有真机证据；注销与已开菜单的时序（`sourceRemoved` 立即删组，`:1311-1321`）只从代码推断。
- **未验证 `/p` 的真实体验**：静态推断是「按字母 p 子串检索」；若宿主未来加别名层，结论会变，但 0.2.1-rc.3 的 `detectTrigger` 没有别名（`:793-810`）。
- **未验证「空格后关菜单」是否被宿主其它层补偿**：`detectTrigger` 遇空白返回 `null`（`:795`），插件注释也承认（`prompt-trigger.ts:34-36`），但 `README.md:84` 仍宣传空格用法；两者矛盾，需真机确认这是文档错误还是宿主有另一条路径（当前代码里没看到）。
- **未找到 #196 相关的既有设置/文案**：`settings-page.ts` 只有 `hidePreset` 与触发方式两行（`:710-735`），`strings.ts` 没有 slash 键，`lib/index.js` schema 也没有 `showInMenu` 之类字段。
- **未确认 `/prompt` 组标题在真机的样子**：按 locale 注释推断是原样 `prompt`，但没有截图证据。
- **未确认「骨架屏闪现」的可见性**：`pending` 且空会渲染两行 skeleton（`:1769-1785`），promise 很快时可能只有一帧；未真机。
- **未访问 GitHub**：#195/#196 的标签、作者、评论、是否已有 maintainer 表态均未读取；本笔记只做技术取证，不做 triage 结论。

## 9. 开放问题（maintainer decisions，附建议答案）

1. **#195 算 bug 还是「按设计」？**
   建议：算 bug。理由：用户可见的开关叫「屏蔽预制模板」（`strings.ts:52`）且默认开，用户无法预期它在 `/prompt` 失效；但要在实现时同步把 `strings.ts:55` 的文案从「列表与标签云」扩到「所有入口」，否则修完仍自相矛盾。另一条路是维持范围、把开关改名为「面板屏蔽预制」并把 #195 转 enhancement——不建议，因为默认值让新用户第一时间撞上矛盾。
2. **#195 的修复要不要连智能卡一起？**
   建议：分开决策。`smart-score.ts:88` 与 `smart-card.ts:258` 同样裸用 `allTemplates()`，但兜底行是「预设前 3」的产品设计（注释 `smart-card.ts:255-256`）；过滤后零自定义用户会得到空卡，需要空态设计。建议 #195 先修 `/prompt`，智能卡另开一票并明确空态。
3. **#196 选 A、B 还是 C？**
   建议：若诉求是「别让裸 `/` 被模板挤满」，选 **B**——纯插件侧、宿主行为已从代码读实、无新持久化、无重注册风险；代价是破 `test-issue-178` J2，需要同步改断言。若诉求是「我根本不想要这个源」，只有 **A** 能做到；A 的 API 面可行但端到端未验证，且要新增全局偏好 + 设置行 + 路由 + 文案，成本最高。C 是折中但语义最弱（仍占裸 `/` 的位置），不解决「关不掉」。
4. **若选 A，默认开还是关？**
   建议：默认开（保持现状），否则升级即功能消失；开关文案要说明「关闭后 `/prompt` 不再出现在斜杠菜单」，而不是「隐藏模板」。
5. **若选 B，`/p` 算不算「显式前缀」？**
   建议：不算，或者先把 `/p` 做成真正的别名。现状 `/p` 会按字母 `p` 子串检索（`prompt-trigger.ts:42-44`），与 `README.md:83` 的「或者 `/p`」不符；若 B 只认 `query === ''`，`/p` 仍会出（奇怪的）候选，用户会觉得「说好的只在 /prompt 后出呢」。
6. **B 的判定要不要看 `position`？**
   建议：只看 `query === ''` 就够；行首 `/` 与行中 `hello /` 都是「裸触发」，用户预期一致。若产品只想管行首，再加 `position === 'leading'`，但宿主对 `position` 的取值只有 `leading`/`inline`（`lib-client.js:803`），没有第三种。
7. **测试契约可以改吗？**
   建议：B 必须改 `test-issue-178.cjs:769-770`（J2 从「非空」改成「空 query 为空、`query: 'prompt'` 非空」），并新增一条 `check:issue-196` 进 `check` 链（`package.json:74`）；同时给 #195 补一条 `hidePreset=true` 下 `/prompt` 不含 `builtin` 的断言（现有 `test-issue-165` 不覆盖）。
8. **组标题要不要本地化 / 隐藏？**
   建议：本票不做。宿主支持 `showGroupTitle: false`（`lib-client.js:1764`），但隐藏标题会让 prompt 组与内置命令组视觉粘连；本地化又不能加 `locale` inject（`check-locale-137.mjs:373-378` 禁止）。维持原样 `prompt` 最省事，若要改另开票。
9. **文档要不要同步？**
   建议：无论选哪个，`README.md:83-86` 都要改——`/p` 的别名说法（`:83`）与空格筛选说法（`:84`）当前都与实现/宿主不符；B 还要删掉「`/prompt` 看到全部模板」的裸 `/` 暗示（`:86`）。

## 10. 证据路径

宿主（抽取件，0.2.1-rc.3）：
- `.dsh-tmp/trigger/package.json:2,4` —— 包名与版本
- `.dsh-tmp/trigger/README.md:80` —— global source layer / 无 per-session
- `.dsh-tmp/trigger/lib-client.js:776-812` —— detectTrigger（`:795` 空白、`:799-809` query/position/span）
- `.dsh-tmp/trigger/lib-client.js:1038-1081` —— track（`:1068-1073` roster 空、`:1074` seedGroups）
- `.dsh-tmp/trigger/lib-client.js:831-842` —— seedGroups（`showGroupTitle` 透传、`pending`）
- `.dsh-tmp/trigger/lib-client.js:844-850` —— closed 清空
- `.dsh-tmp/trigger/lib-client.js:892-935` —— menuReduce（`:916` allReadyEmpty、`:927-935` source-failed）
- `.dsh-tmp/trigger/lib-client.js:1311-1321` —— sourceRemoved 即时删组
- `.dsh-tmp/trigger/lib-client.js:1329-1334` —— sourceAdded 只 warm
- `.dsh-tmp/trigger/lib-client.js:1343-1349` —— refreshOpenMenu 只重取
- `.dsh-tmp/trigger/lib-client.js:1414-1443` —— fetchCandidates 请求字段与 settled/failed
- `.dsh-tmp/trigger/lib-client.js:1549-1571` —— registerSource 契约与 disposer
- `.dsh-tmp/trigger/lib-client.js:1594` —— roster 按 order 排序
- `.dsh-tmp/trigger/lib-client.js:1628,1677,1683` —— 400px / MAX_HEIGHT / TOP_MARGIN
- `.dsh-tmp/trigger/lib-client.js:1729,1764-1786` —— 空组不渲染、组头、skeleton
- `.dsh-tmp/trigger/lib-client.js:1860-1888` —— 组标题取源名、未知源原样
- `node_modules/@deepseek-ai/cordis/lib/types/fiber.d.ts:144-151,157` —— effect/disposer

插件（源码）：
- `src/client/prompt-trigger.ts:15-20,22-23,29,34-36,38-48,51-75` —— 源定义、空 query、MAX_ITEMS、前缀剥离
- `src/client/template-library.ts:65-67,69-80,113-136,237-257,279-281,483-521` —— hidePreset 存取、`applyHidePreset`、`allTemplates`、排序
- `src/client/template-browser.ts:1547,1669-1709,1759,2294-2295` —— 唯一过滤点、注释、远程池、标签云
- `src/client/smart-score.ts:82-92` —— 智能卡候选
- `src/client/smart-card.ts:125,174,255-261,413` —— 兜底 3 条与计数
- `src/client/settings-page.ts:237,256,710-737` —— hidePreset 行、触发方式行
- `src/client/strings.ts:52,54,55,69` —— hidePreset 文案与触发提示
- `src/client/index.ts:12,230,234,648-651` —— inject 与注册
- `src/client/template-library.ts:254-257` —— `applyHidePreset` 定义（grep 唯一调用点 `template-browser.ts:1678`）

插件（构建物）：
- `lib/client.js:711,721,740` —— hidePreset/allTemplates 运行时
- `lib/client.js:5016-5017` —— panel 的 hide+pool
- `lib/client.js:21880-21893` —— /prompt 源（无过滤）
- `lib/client.js:22348,22526,22575` —— smart-score / smart-card
- `lib/index.js:114,116,130,203,269-271,279-281,447,999,1006` —— schema/默认/快照/set/路由

测试与门禁：
- `scripts/repro/test-issue-178.cjs:192-202,765-788`
- `scripts/repro/test-issue-23.cjs:40-41,108-139,328-329`
- `scripts/repro/test-issue-142.cjs:205-207,230-232`
- `scripts/repro/test-issue-165.cjs:3-17,84-101,121-143,166-167`
- `scripts/repro/test-issue-59.cjs:293` —— registerSource 桩
- `scripts/check-lib-sync.mjs:1-30`
- `scripts/check-bilingual-134.mjs:1-22`
- `scripts/check-locale-137.mjs:373-378`
- `scripts/check-target-tree.mjs:1-24`
- `package.json:44,48,49,57-60,74,87,127,134` —— 脚本与 check 链

文档与既有笔记：
- `README.md:63,69,71,77-90`
- `CHANGELOG.md:30,84,123`（`:84` 的 #196 是上游，不是本仓）
- `CONTEXT.md:13-19,107-127`
- `GLOSSARY.md:9-11,33-39,45-50`
- `research/trigger-mode-setting/findings.md:1-6,22-23,97-108,203-210`
- `research/template-escape-caret/findings.md:22,26`
- `research/cache-and-labels/findings.md:119`
- `research/tag-cloud-70/investigation.md:155,166`
- `research/blurred-composer-caret/findings.md:158`
- `research/settings-open-investigation/findings.md:85,117`
- `docs/naming-169-spec.md:51`
