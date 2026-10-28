# Issue #179 调研：悬浮列表触发方式（hover / 仅点击）做成持久化设置（事实清单）

- Issue：#179「[功能请求]允许改变prompt菜单触发方式」（外部报告者 minevery512，2026-10-27T05:05:14Z 开，仍 OPEN，无 label，无其他评论）。原文：「新增设置项，允许改变prompt菜单的触发方式（悬浮触发/点击触发）。现在默认鼠标悬浮在prompt按钮上时就会显示菜单，有时鼠标偶然划过prompt按钮时，会导致菜单显示又收回，像闪烁一样，希望能增加一个仅在点击时打开菜单的选择。」维护者 FeatherHunter 2026-10-28T18:09:40Z 回：「必须支持，安排中🌹…」。
- 日期：2026-10-29；方法：只读，只认一手来源（本仓源码 / 回归脚本 / 笔记 / CHANGELOG / 两页词汇表，本机已装 DSH 0.2.1-rc.3 的 `@deepseek-ai/dsh-client-ui-conversation` 与 `@deepseek-ai/dsh-client-ui-input-trigger` 抽取源码，抽取件在 `.dsh-tmp/hostconv`、`.dsh-tmp/trigger`；app.asar 本体未解包）。不改业务代码、不提交、不写 GitHub。
- 范围：① 这个设置能不能只靠插件侧做、宿主有没有同类旋钮；② 打开/关闭触发链的全部执行位与要改的精确触点；③ 持久化先例与成本（测试门禁、i18n、构建）；④ click-only 的关闭语义候选。只做事实与可行性，不做选型终裁（方案与开放问题留给维护者/实施票）。
- 宿主版本前提：本机 `@deepseek-ai/dsh-client-ui-conversation` / `input-trigger` 均为 0.2.1-rc.3（见两包 `package.json:4`）；本仓 `package.json:132-134` engines 为 `dsh >=0.2.0-rc.2`。故「宿主没有此设置」只在 0.2.1-rc.3 的抽取件上验证过；旧版宿主源码不在本机。好在结论是「不需要宿主配合」（§2），版本差异不构成阻碍。

## 结论摘要

- **可行性：插件侧完全可做，宿主侧无此设置、也无需改宿主。** 悬浮列表是插件自己渲染进 `conversation.input.overlay` 的内容（`src/client/index.ts:269-271`，宿主只 `renderSlot('conversation.input.overlay', {})`，`.dsh-tmp/hostconv/client.js:19183`），开合完全由插件模块布尔决定（`src/client/panel-visibility.ts:8`）；在 0.2.1-rc.3 的 conversation 包里 grep `openOnHover|triggerMode|hoverOpen|onHoverOpen|hoverToOpen|autoOpen|pointerenter` 零命中。
- **默认必须保持 hover。** 这是 #12 的原始需求（「不用点击后才打开列表——鼠标悬停即自动打开」，`gh issue view 12` 正文 §1），已写进 README 对外承诺（`README.md:63`「鼠标移到…列表自动展开」），并被 `test-issue-112` 的 R1/R5 直接断言（`scripts/repro/test-issue-112.cjs:77-89,133-145`）。新设置读侧缺省必须归一为 hover，新测试不得靠传参绕过默认。
- **click 模式要同时停用「一处开 + 三处关」**：入口 `onMouseEnter` 开（`src/client/entry-button.ts:461`）、入口 `onMouseLeave` 排 150ms 关（`:462`）、浮层根 `rootHover` 进出（`src/client/template-browser.ts:2271`）、远程大列表 `remoteHover`（`:1874-1876`），另加 #14 的「抑制解除补关」（`:1286-1304`）。最省事的接法是：**开**压在 entry 一处前置门，**关**统一压在 `panel-visibility.ts:45-49` 的 `schedulePanelClose` 一个扼流点（4 个调用位全部经它，`grep` 只命中 entry-button:462 与 template-browser:1303/1875/2271）。
- **持久化先例就是 #165**：host global 区（`storages/dsh_prompt.json`）布尔字段 + 设置页 Check + 底栏动作式按钮，三处同源（`CHANGELOG.md:84`；代码在 `src/client/template-library.ts:64-65,232-246`、`lib/index.js:114,128,201,264-271,435,986-992`、`src/client/settings-page.ts:679-694`、`src/client/template-browser.ts:1597-1605`）。沿用即得「随升级不丢」；改走 localStorage 会与 0.4.28 之后「全局位进 host」的口径分叉（§4-C）。
- **成本清单**：`test-issue-149.cjs:129` 的底栏行序断言必改（新增按钮进 merged row）；i18n 新增 4 个 STR 键要过 `check:bilingual-134`（en 零 CJK、比例 ≤5）与 `check:locale-137`；`lib/client.js` 必须 `npm run build` 重建（`scripts/check-lib-sync.mjs:5-13,30-37`）；`lib/index.js` 是**手写检入的宿主半、不构建**（`scripts/build.mjs` 头注 / `check-lib-sync.mjs:30`），schema、initial、snapshot、setter、路由、handler 六处都要手改。
- **待维护者拍板**：click 模式的关闭语义。现状面板除「× / 选中插入 / 跳设置成功」外没有任何关闭路径——无 Esc（`entry-button.ts:340-365` 只处理挑选器/齿轮/输入镜），无 outside-click（`template-browser.ts` 的 document 监听只有 focusin/selectionchange，`:161-180`）。所以「仅点击」必须顺手定义「怎么关」，不是把 hover 关掉就完事（§5）。

## 0. 请求拆解

- **R1 设置项**：新增一个用户可见、可持久化的开关，取值二选一：hover 触发（现状）/ 仅点击触发（新）。
- **R2 click-only 语义**（用户原话的硬要求）：① 鼠标移入入口按钮**永不打开**面板；② 鼠标移出面板/按钮**永不关闭**面板。即「hover 只影响开」不够，必须连关一起停。
- **R3 闪烁机理**（不是 bug，是 hover 语义的固有代价）：`mouseenter` 立刻开（`entry-button.ts:461`），`mouseleave` 排 150ms 关（`:462`）。指针只是「路过」按钮时，进入即开、离开 150ms 后关，一次路过 = 一次完整的开→关；反复掠过就反复闪。需求者在 #179 里描述的正是这个时序，故不能靠「加防抖/加延迟」消除，只能让用户把触发方式切到 click。
- **R4 维护者指定**（转述自父会话 m00003；本会话只读，未复核原消息原文）：底栏按钮与设置行**两处同源联动**。等于把 #165 的「三处同源」（小列表底栏 + 大列表底部 + 设置页）减成两处；本文按此前提评估方案 A，并把「大列表是否也要」列为开放问题（§9-Q5）。
- **R5 非目标**：不改智能卡（`smart-card.ts` 不 import panel-visibility，已 grep）；不改 `/prompt` 斜杠管线（`prompt-trigger.ts:57` 只 `ensureLoaded`，不碰 panel-visibility）；不改设置页里的常驻模板列表（`compact:false` 本就没有 hover 语义，`template-browser.ts:2271` 只在 compact 分支挂 rootHover）；不动 #14/#34 的抑制门本身（它们只服务 hover 关）。

## 1. 既有笔记是否回答（逐条一行）

- `research/slot-remote-touch.md:26-30,60`（#79）：**部分相关但不足**。它给出「触控下 hover 不可靠，开面板必须走 click 闭环」与 H2「hover 的 150ms 自动关在触控下关闭或加长到 ≥1000ms」，但那是**运行时按设备能力自动降级**，不是**用户可持久化的偏好**；且它把 click 当 fallback、hover 当默认，没有「用户选 click-only 后入口 hover 永不打开」这一层。
- `research/cache-and-labels/findings.md:84-95,142`：**不足且已过时**。它记录的是 localStorage 时代的键清单与「智能开关/悬浮卡位置属纯本机 UI 偏好、不进 domain」的判断；0.4.28（#165）之后同类全局位已搬进 host global 区。可作口径参考，不能作先例。
- `CHANGELOG.md:84`（0.4.28 / #165）：**现成先例**——「小列表底栏眼睛按钮、大列表底部按钮、设置页开关三处同源联动；按钮文案是动作式的…开关持久化，随升级不丢」。本票是同构需求。
- `CHANGELOG.md:95`（0.4.27 / #14）：**约束**——8 个抑制解除点会在指针已离场时补排 150ms 关。click-only 必须让这条补关一并失效，否则「点开面板 → 聚焦搜索 → 失焦」会在指针位于面板外时把面板关掉，等于 R2② 仍被违反。
- `CONTEXT.md:113` / `GLOSSARY.md:45-47`：**词汇层面是阻碍**。两处都把 hover 写成悬浮列表的**定义**（「⚡Prompt 按钮 hover 触发的紧凑浮层列表」/「triggered by hovering the Prompt button」）。click-only 落地后不改这两句，文档与实现立刻漂移。
- **结论：全仓 `research/` 21 个子目录中没有一篇回答 trigger-mode 设置问题**；`git log --all --grep='#179'` 与 `git branch -a --list '*179*'` 均无输出（只读查询），#179 无既有分支/提交/半成品。按 /research 规则新查一次并落本笔记。

## 2. 宿主侧：没有触发方式旋钮，也不需要宿主改动

- overlay 槽的声明与渲染：`conversation.input.overlay` 是 `conversation.composer.bar` 下的 `{ kind: 'list', scope: 'session' }`（`.dsh-tmp/hostconv/client.js:20077-20106`，overlay 在 `:20085-20088`）；宿主对槽内容只做 `renderSlot('conversation.input.overlay', {})`（`:19183`），**不看内容、不参与开合**。插件把 `PanelHost` 注册进去（`src/client/index.ts:269-271`），`open===false` 时直接 `return null`（`:103-105`），面板的挂载/卸载完全由插件决定。
- 负向 grep（conversation 0.2.1-rc.3 全 bundle）：`openOnHover|triggerMode|hoverOpen|onHoverOpen|hoverToOpen|autoOpen|pointerenter` → **0 命中**；`hover` 的命中只有三类：CSS `:hover`（样式）、一条 `tool.title.hoverSymbol` 文案（`:16241,16619`）、HeroFish 的悬停动画（`:17727-17783`）。输入触发包 `input-trigger` 里的 `hover` 只指菜单高亮随指针停放（`:1150-1160,1931-1932`），与「面板触发方式」无关。
- 结论：**触发策略 100% 在插件侧**（`panel-visibility.ts:8` 一个模块布尔 + `entry-button.ts:461-471` 两个手势）。本票不需要宿主改任何东西，也不受旧宿主影响；反过来，若将来宿主给 overlay 槽加「悬停面板」策略，插件侧仍以自己布尔为准（未来行为未验证）。
- 抽取件的可信度边界：`.dsh-tmp/hostconv/client.js` / `.dsh-tmp/trigger/lib-client.js` 是 0.2.1-rc.3 的构建产物（`package.json:4`），与 `research/template-escape-caret/findings.md:4` 同一套来源；app.asar 本体（`D:\DeepseekHarness\resources\app.asar`）未解包，无法在 0.2.1-rc.3 之外复核。

## 3. 现状硬事实：触发链全路径

### 3.1 开合执行位（谁开、谁关、抑制门）

| 环节 | 执行位 | 现状 | click-only 需否改 |
| --- | --- | --- | --- |
| 悬停入口即开 | `src/client/entry-button.ts:461` | `cancelPanelClose(); if (!isPanelOpen()) { setPanelOpen(true); noteHoverOpen() }` | **必改**：前置门，禁用后整段不执行 |
| 离开入口排 150ms 关 | `src/client/entry-button.ts:462` | `schedulePanelClose(150)` | **必改**：不能在指针离开时收面板 |
| 同手势点击确认（#112） | `entry-button.ts:467-471` + `panel-visibility.ts:19-26` | `if (isPanelOpen() && takeHoverOpen(HOVER_CLICK_GRACE_MS)) return; setPanelOpen(!isPanelOpen())`；宽限 1000ms（`entry-button.ts:249`，注释 `:245-248`） | 逻辑可原样保留：click-only 下没人调 `noteHoverOpen`，标记永远过期，单击天然是取反 |
| 进面板取消关 | `template-browser.ts:2271`（`rootHover.onMouseEnter`） | `cancelPanelClose()` | 随 rootHover 置 null 一起失效 |
| 离开面板排 150ms 关 | `template-browser.ts:2271`（`onMouseLeave`） | `if (modal || searchFocused || composing) return; schedulePanelClose(150)` | 随 rootHover 置 null 一起失效 |
| 远程大列表进出 | `template-browser.ts:1874-1876` | `onMouseLeave` 带 `remoteSearchFocused || remoteComposing` 抑制后 `schedulePanelClose(150)` | 同上，需一起停 |
| #14 抑制解除补关 | `template-browser.ts:1286-1304` | 需 `matchMedia('(hover: hover)')`（`:1295-1296`）+ 只读 `:hover` 探测入口与浮层（`:1299-1301`），判定命中才 `schedulePanelClose(150)`（`:1303`） | **必改**；压在 `schedulePanelClose` 扼流点最省 |
| 抑制门本体（#34 IME） | `panel-visibility.ts:37-42,45-49` | `setHoverCloseSuppressed(true)` 同时清掉待关定时器；`schedulePanelClose` 首行 `if (hoverCloseSuppressed) return` | 代码保留即可（click-only 下永不排关，门成死路径，不影响默认模式） |
| 显式关：小列表 × | `template-browser.ts:2264` | `onClick: () => setPanelOpen(false)` | 不变 |
| 显式关：远程 × | `template-browser.ts:2048-2053` | `onClick: () => setPanelOpen(false)` | 不变 |
| 显式关：选中插入 | `template-browser.ts:607` | `onPick` 末尾 `setPanelOpen(false)` | 不变 |
| 显式关：跳设置成功 | `template-browser.ts:2258` | `emitGoSettings` 回调 `if (ok) { setPanelOpen(false); return }` | 不变 |
| 面板挂载 | `src/client/index.ts:103-105` | `if (!open) return null`，真挂载只有 overlay 实例 | 不变 |

### 3.2 现状没有的关闭路径（click-only 会因此变成「关不掉」）

- **无 Esc**：`entry-button.ts:340-365` 的 keydown 只处理输入镜/挑选器/齿轮三层栈（注释 `:340`「Esc 只关顶层…与收展正交」），面板本身不在栈里。
- **无 outside-click**：`template-browser.ts` 的 document 级监听只有 `focusin`（`:161-162`）、`selectionchange`（`:180`）、`resize`（`:1368,1422-1427`），没有 pointerdown/mousedown；`TopPortal`（`PanelPortal` 见 `:1200-1210`）只是把浮层挂到 body，不带遮罩。
- 因此 hover 模式下面板能「自己消失」全靠 150ms 关；把 hover 关掉 = 把唯一的自动关闭手段关掉。这是 §5 的全部由来。

### 3.3 设置读取与刷新链（照 #165 复刻的位置）

- 读：`const hide = loadHidePreset()` 在每次渲染读缓存（`template-browser.ts:1442`，装载归一 `template-library.ts:131`，读侧 `:232-234`）。
- 写：`saveHidePreset(v)` = 先改内存 → `notifyStore()`（同步回调，`template-library.ts:84-86`）→ `persist(HIDE_URL, {hide})`（fire-and-forget，`:242-246`）。
- 同步：设置页 `subscribeStore`（`settings-page.ts:230-232`）、面板刷新（`template-browser.ts:1395` 的 `ensureLoaded().then(refresh)`）。插件级只加载一次（`src/client/index.ts:183`）。
- 路由名清单 `template-library.ts:110-116`（日志只记枚举不记 URL），宿主侧 `KNOWN_ROUTES` `lib/index.js:432-438`。

### 3.4 词表与文档现状

- 动作式文案先例：`strings.ts:51-52`（`showPreset`「展示预制模板」/`hidePreset`「屏蔽预制模板」），设置页行标题/说明 `:54-55`。
- 动作式按钮形态先例：`hideToggleNode`（`template-browser.ts:1597-1605`）= 14px 眼形 SVG + 空格 + 文案，`aria-pressed` 标状态，`data-dsh-prompt-hide` 作钩子，`onMouseDown: keepComposerFocus`（#61）。
- 底栏宽度：紧凑浮层固定 `width: 560`（`template-browser.ts:1543`），merged row 已锁 `flexWrap:'nowrap'`（`:2234`，`test-issue-149.cjs:116` 断言），搜索框 `flex:'1 1 auto', minWidth:0`（`searchStyleCompact`，`:1616`），行内现有 counts、`＋新增`、眼形按钮（含 10 字中文文案）、`模板管理`、`×` 五件固定件。**再加一枚同款文字按钮的宽度影响未实测**，按 0.85em/字估算约再吃 6–9em（≈84–126px @14px 基准），搜索框会被压到 100px 以下——这是方案 A 的真实 UI 风险，建议新按钮做**纯图标 + title/aria**。

### 3.5 为什么「只在开处加门」不成立（四条反例时序）

- **反例一（漏入口 leave）**：click-only 下只在 `entry-button.ts:461` 加门 → 点开面板 → 指针从按钮移向面板，途中先离开按钮 → `:462` 排 150ms 关 → 面板在用户点到模板前消失。用户视角是「点了也闪」。
- **反例二（漏 #14 补关）**：点开 → 点搜索框聚焦 → 指针停在面板外 → 搜索框失焦 → `template-browser.ts:1289-1303` 判定 `hoverCapable` 且入口/浮层均未悬停 → `schedulePanelClose(150)` → 面板在用户改关键字的中途消失。这条只在 `matchMedia('(hover: hover)')` 为真时触发（`:1295-1296`），桌面端必现。
- **反例三（漏 rootHover）**：点开 → 指针扫过面板（`onMouseEnter` 取消关）→ 指针离开面板（`onMouseLeave` 排关，`:2271`）→ 面板消失。用户只是「看了一眼」。
- **反例四（漏 remoteHover）**：远程大列表点开 → 指针移开列表 → `:1875` 排关 → 大列表关闭；触屏上对应「手指抬起后 150ms」。
- 四条反例的共同点：**「关」有四个排程位，且都经 `schedulePanelClose`**（`grep` 只命中 `entry-button.ts:462`、`template-browser.ts:1303,1875,2271`）。这就是建议把门压在 `panel-visibility.ts:45-49` 的原因——一处早退覆盖四条反例，调用位一行不改，`#34` 的抑制门代码也无需动。

### 3.6 日志 / 事件目录面：无需改动（负向确认）

- `store.persist.fail` 的 `route` 字段在事件目录里只声明字段名与校验码（`ENUM`=「形状像枚举 token」），**不枚举取值**：`event-list.dsh-prompt.json:63-81`。`scripts/check-log-shape.mjs:259-269` 也只喂一个 `usage.bump` 验证形状。
- 全仓 grep `hide.set` 只有 `src/client/template-library.ts:115` 一处（客户端 `ROUTE_NAMES` 表），宿主侧按 URL 字面量注册。故新增 `trigger.set` 不需要改 `event-list.dsh-prompt.json`、不需要改 `check:log-shape`；但 `ROUTE_NAMES` 加一项是必须的，否则失败日志的 route 为空、排障时看不出是哪条写失败。

## 4. 方案候选

### A（推荐）设置页开关 + 底栏动作式按钮 + host global 持久化

与 #165 完全同构：一个布尔、两处入口、一处持久化。触点（每行都是要动的确切位置）：

1. `src/client/template-library.ts`：`TRIGGER_URL` 常量（照 `:59-65`）、`StoreSnapshot` 加字段（`:67-73`）、缓存初值（`:77`）、`ROUTE_NAMES`（`:110-116`）、`ensureLoaded` 归一（`:131`）、`normalizeHoverTrigger/loadHoverTrigger/saveHoverTrigger`（照 `:232-246`）。
2. `lib/index.js`（手写宿主半）：`GlobalSchema` 加 `hoverTrigger: z.boolean().optional()`（`:100-115`）、`initial` 加 `hoverTrigger: true`（`:126-129`）、`snapshot()` 归一（`:201`）、`setHoverTrigger()`（照 `:264-271`，**必须展开既有 global 再整体 set**，否则 lastUsed/remote* 被写没）、`KNOWN_ROUTES`（`:432-438`）、POST handler（照 `:986-992`）。
3. `src/client/panel-visibility.ts`：`let hoverTriggerEnabled = true` + `setHoverTriggerEnabled(v)` / `isHoverTriggerEnabled()`；`schedulePanelClose` 首行早退（`:45-49`）。文案注释需写清「这是整条 hover 关链的唯一扼流点」。
4. `src/client/index.ts`：在既有 `ensureLoaded`（`:183`）之后 `setHoverTriggerEnabled(loadHoverTrigger())` 并 `subscribeStore(...)` 保持同步。**这一步是刻意设计**：entry-button 目前不 import template-library（`:8-25`），把状态注入 panel-visibility 可避免新增 import 边，绕开 test-issue-82/86/104/110 里手抄的依赖表。
5. `src/client/entry-button.ts:461`：`onMouseEnter` 首行 `if (!isHoverTriggerEnabled()) return`；`onClick`（`:467-471`）不动。
6. `src/client/template-browser.ts`：`rootHover`（`:2271`）与 `remoteHover`（`:1874-1876`）改成「`compact && isHoverTriggerEnabled()` 才构造」；底栏在 `:2247`（hide 之后）插一枚 `data-dsh-prompt-trigger` 按钮，文案动作式（hover 模式显示「仅点击打开」，click 模式显示「悬停打开」），`onMouseDown: keepComposerFocus`，点击 `saveHoverTrigger(!hoverTrigger); refresh()`。
7. `src/client/settings-page.ts:679-694`：模板卡内、屏蔽行之下加一枚 `SettingRow` + `Check`（`data-dsh-prompt-trigger-toggle`），绑定 load/save，订阅刷新照 `:230-232`。
8. `src/client/strings.ts`：4 个键（`triggerMode` 行标题、`triggerToClick` 动作、`triggerToHover` 动作、`triggerHint` 说明），en 零 CJK。
9. `scripts/repro/test-issue-179.cjs` + `package.json` scripts（照 `:115` 的 `test:issue-165`），并建议并入 `check`（`:58`）。
10. `npm run build`（重建 `lib/client.js`），跑 `check:lib-sync`。

接线（单向、无环）：

```
设置页 Check / 底栏按钮 → saveHoverTrigger(v)        [template-library]
   ├─ cache.hoverTrigger = v; notifyStore()          同步
   └─ persist('/_dsh/dsh-prompt/trigger/set',{hover}) 异步落 storages/dsh_prompt.json
notifyStore → index.ts 订阅 → setHoverTriggerEnabled(v) [panel-visibility]
   ├─ entry-button:461 读它决定开不开
   └─ template-browser:2271/1874 读它决定挂不挂 hover 关
```

成本：8 个源文件 + 1 个宿主文件 + 1 个测试 + 2 个文档（CONTEXT/GLOSSARY）+ 1 次构建。
风险：① `test-issue-149.cjs:129` 行序断言必改（§7）；② 底栏宽度（§3.4，未实测）；③ `lib/index.js` 手写，schema/setter 是整对象替换，漏展开会把 remote*/lastUsed 写没（`test-issue-165.cjs:112` 有同款断言，可照抄）；④ 设置页→入口的即时生效依赖 `notifyStore` 同步回调，若将来改成异步广播则入口会滞后（现状同步，`template-library.ts:84-86`）。

### B 只加设置页开关（不碰底栏）

触点 = A 的 1/2/3/4/5/6 中除底栏按钮外的部分 + 7/8/10。
成本：少一个按钮与一条顺序断言，`test-issue-149` 无需改。
风险：**不满足维护者指定的「两处同源」**（R4）；设置页是低频管理面（`src/client/index.ts:274-276` 注册为 settings.section），用户遇到闪烁时不会想到去那里找，发现性差。仅作降级方案。

### C 只加底栏按钮 + localStorage（放弃持久化一致性）

触点：`entry-button.ts:461` 门 + `template-browser.ts` 按钮 + 一个 localStorage 键 + panel-visibility 开关，完全不碰 `lib/index.js`。
成本：最低，单 PR 可完成，不涉及宿主半与 lib-sync（前端产物仍要 build）。
风险：① 与 0.4.28 之后的「全局位进 host」口径分叉（`CHANGELOG.md:84`、`template-library.ts:64`）；② `research/cache-and-labels/findings.md:142` 的 localStorage 判据只适用于「纯本机 UI 偏好」，而触发方式决定所有人默认交互、属全局配置，不是本机偏好；③ 0.4.28 后老 localStorage 键只剩智能卡/位置（`:84-95`），再引入新键会扩大将来清理面；④ 清缓存/换机器即丢，与 #179 期望的「设置项」语义不符。**不推荐**。

### 4.4 三案对比矩阵

| 维度 | A（设置行 + 底栏按钮 + host global） | B（只设置行） | C（只底栏 + localStorage） |
| --- | --- | --- | --- |
| 触点文件数 | 8 个前端 + `lib/index.js` 手改 6 处 | 7 个前端 + `lib/index.js` 6 处 | 4 个前端，宿主半零改动 |
| 持久化位置 | `storages/dsh_prompt.json` global 区 | 同 A | 浏览器 localStorage |
| 发现性 | 高（底栏 + 设置页两处） | 低（只管理面） | 高（只底栏） |
| `test-issue-149` 改动 | 行序断言 1 条（`:129`）+ `kindOf` 分支 | 无 | 同 A，1 条 |
| 满足维护者 R4（两处同源） | 满足 | 不满足 | 满足 |
| 随升级/换机保持 | 是（#165 已验证同链路） | 是 | 否 |
| 主要风险 | 560px 底栏宽度、手改宿主漏展开 global | 用户找不到 | 与 0.4.28 口径分叉、清缓存即丢 |

### 4.5 方案 A 的关键改法（示意，非最终实现）

```ts
// panel-visibility.ts —— 「关」的唯一扼流点
let hoverTriggerEnabled = true
export function isHoverTriggerEnabled(): boolean { return hoverTriggerEnabled }
export function setHoverTriggerEnabled(v: boolean): void {
  hoverTriggerEnabled = v === false ? false : true   // 只有显式 false 是 click-only
  if (!hoverTriggerEnabled) cancelPanelClose()        // 切模式时清掉在途的 150ms 关
}
export function schedulePanelClose(ms: number): void {
  if (!hoverTriggerEnabled) return                   // ← 四条排关位一处覆盖（:45-49 现状）
  if (hoverCloseSuppressed) return
  ...
}

// entry-button.ts:461 —— 「开」的唯一前置门（onClick:467-471 一行不动）
onMouseEnter: () => {
  if (!isHoverTriggerEnabled()) return
  cancelPanelClose()
  if (!isPanelOpen()) { setPanelOpen(true); noteHoverOpen() }
},

// template-browser.ts:2271 / :1874-1876 —— 不挂 hover 关
const rootHover = compact && isHoverTriggerEnabled() ? { /* 现状 */ } : null
```

- 切模式时 `cancelPanelClose()` 是必要细节：用户从 hover 切到 click 的瞬间若正好有一次在途关窗，不清掉会在新模式下面板莫名消失（这一个动作在 A 案里是唯一「新语义」代码，其余全是条件化）。
- 设置页 Check 的 `onChange` 里同时 `saveHoverTrigger(on)` 与 `setHoverTriggerEnabled(...)` 也可以（双保险）；但**单一真相**建议只经 `notifyStore` 的订阅（`index.ts`）下发，避免两处各写一次导致未来加面时漏一处。

## 5. `click` 模式的关闭语义候选（待维护者拍板）

前提：现状自动关只有 hover 一条（§3.2），所以 click-only 必须新增/选定关闭路径，否则面板在 `PANEL_Z=9999` + portal 到 body（`template-browser.ts:615,1200-1210`）下会一直压住输入区。

- **S1 仅显式**：保留现有 4 个动作——小列表 ×（`:2264`）、远程 ×（`:2048-2053`）、选中插入（`:607`）、跳设置成功（`:2258`）。零新代码、零新风险；代价是「点开 → 想改主意」只能精确点 ×，触屏上尤其别扭。
- **S2 显式 + 点面板外关闭**：document 级 `pointerdown` capture，命中 `rootRef` 与 `[data-dsh-prompt-entry]` 之外则 `setPanelOpen(false)`。符合 popover 惯例，触屏收益最大；风险是与 `keepComposerFocus`（#61，`entry-button.ts:461,2264` 的 `onMouseDown`）以及宿主 Lexical composer 的事件顺序耦合，`stopPropagation` 用不好会让「点开面板再点输入框」变成丢焦点，需真机验证；另外浮层经 `TopPortal` 挂在 body（`:1200-1210`），事件能冒到 document，判定成本低。
- **S3 显式 + Esc**：面板打开时把 keydown 接进 `entry-button.ts:340-365` 的顶层栈（排在输入镜/挑选器/齿轮之后），只关面板。改动小、键盘可达；与 #104「Esc 只关顶层」的栈语义一致，但要把面板状态纳入同一 effect 的依赖数组。
- **建议**：先落 S3 + 现状 4 个显式关；S2 单列一票，真机验证后再加。**最终由维护者拍板**（这决定测试用例集与文档措辞）。

## 6. 全场景影响面

- **入口 hover / click（默认模式）**：逐字节不变——`hoverTrigger` 缺省 true，`schedulePanelClose` 不早退，`rootHover`/`remoteHover` 照常构造。`test-issue-112` R1/R2/R3/R5/R6、`test-issue-14` Test D 不受影响。
- **入口 click-only**：`onMouseEnter` 早退（不 cancel、不 open、不 note），`onClick` 仍取反 → 第一次点开、再点关（与 `test-issue-112.cjs:91-103` 描述的无 hover 语义一致）。**注意**：面板已开时指针扫过按钮不会再改变任何状态，这是需求要的，但也意味着「想关」只能再点一次按钮或走 §5。
- **触屏/远程**：触屏无 hover，现状即 click 取反（`research/slot-remote-touch.md:60` 的 H2 结论）；click-only 后语义相同但更稳（不再有杂散 `mouseleave` 触发 `:1874-1876` 的 150ms 关，该风险在 `slot-remote-touch.md:30` 有记录）。远程放大档下按钮同期放大（`remoteChromeScale`，`entry-button.ts:10`），底栏宽度风险同步放大。
- **键盘**：Tab 聚焦 + Enter 走 click（`test-issue-112.cjs:92-93` 明说裸 `onClick` 是键盘/触屏的忠实代理），click-only 不改变；新增 Esc（若采纳 S3）只加不减。
- **IME / 搜索聚焦（#34）**：hover 关被整体停用后，`setHoverCloseSuppressed` 与 `:1295-1301` 的媒体查询/`:hover` 探测在 click-only 下永不生效（死路径但保留，删了反而让默认模式失去 #34 保护）。#14 的补关（`:1286-1304`）同理被 `schedulePanelClose` 早退吞掉，不会出现「搜索失焦把点开的面板关掉」。
- **Dock（#95）**：`dockState` 是 entry-button 内部布局状态（`entry-button.ts:287`，注释明确「不进持久化」），与开合正交，不受影响。
- **/prompt**：`prompt-trigger.ts:57` 只 `ensureLoaded`，不读 panel-visibility（已 grep import 面），无影响。
- **复制预置 / 设置页列表**：`compact:false` 分支不挂 rootHover（`template-browser.ts:2271`），无 hover 语义，无影响。
- **存量用户默认不变**：缺键/非法值的读侧归一为 hover（新 `normalize` 照 `hidePreset` 取反写法），升级后只有显式切过的人变；`GlobalSchema` 无 `.strict()`（`lib/index.js:100`），旧版读新键按 zod 默认剥离，回滚不会被脏数据卡住（回滚未真机验证）。
- **旧宿主 / prod 升级**：host 半与 client 同包发布（`lib/index.js` + `lib/client.js`，`package.json:20-26`），不存在「新前端旧后端」；玩家只需升级插件，无宿主版本依赖。
- **多窗口**：store 内存态不跨窗口广播（`template-library.ts:84-92` 只有本实例 listener），另一窗口要刷新才生效（宿主是否同进程共享模块未验证）。

## 7. 门禁与测试清单

新增 `scripts/repro/test-issue-179.cjs`，按 `test-issue-165.cjs:80-172` 的 A–F 分组：

- **A store 运行时**（照 `test-issue-165.cjs:80-102`，fetch 桩记录 POST body `:56-70`）：快照缺键 → hover；非法值（`'yes'`/`0`）→ hover；显式 `false` → click-only；`saveHoverTrigger(false)` 内存先行 + 出站 `{hover:false}` 打到 `/trigger/set`。
- **B lib/index.js 静态**：`hoverTrigger` 在 `GlobalSchema`/`initial`/`snapshot`；`setHoverTrigger` 布尔校验；`...this.domain.global?.get()` 展开（`test-issue-165.cjs:112` 同款正则）；路由字面量；`KNOWN_ROUTES` 含之（`:113-114` 同款）。
- **C panel-visibility 运行时**：`setHoverTriggerEnabled(false)` 后 `schedulePanelClose(10)` 不关窗（等 >10ms 断言仍 open）；`setHoverTriggerEnabled(true)` 后照常关；`setPanelOpen(false)` 清场（`panel-visibility.ts:29-35`）。
- **D template-browser 静态（先 `stripComments`）**：`rootHover` 与 `remoteHover` 都受 `isHoverTriggerEnabled` 控制；底栏有 `data-dsh-prompt-trigger`；按钮文案走动作式键（`triggerToClick`/`triggerToHover`）；`onMouseDown: keepComposerFocus` 仍在。
- **E entry-button + settings-page 静态**：`onMouseEnter` 前有 `isHoverTriggerEnabled` 门；设置页 `loadHoverTrigger/saveHoverTrigger` 绑定 + `data-dsh-prompt-trigger-toggle`（照 `test-issue-165.cjs:154-160`）。
- **F i18n 运行时**：zh 动作文案精确相等、en 非空且 ≠ zh（`:162-172` 同款）。

必须保持全绿：

- `test:issue-112`（`scripts/repro/test-issue-112.cjs:77-145`）——R1 要求 hover 后跟进单击保持开、R5 要求离开 150ms 自动关：这两条只在**默认 hover** 下成立，新测试不得改它的传参（`:71` 只传 `{open:false}`）。
- `test:issue-149`（`:96-163`）——**加底栏按钮必改 `:129`** 的期望串（`search,counts,add,hide,go,close` → 插入 `trigger`）并在 `kindOf`（`:118-128`）加分支；`:116` 的 `nowrap`、`:130-133` 的搜索弹性、`:146-163` 的 ×／＋行为断言不变。若改用纯图标按钮，`:104-105` 的「各只一枚」不受影响。
- `test:issue-34`（IME 抑制）、`test:issue-165`（同源联动先例）：应原样全绿。
- `npm run check`（`package.json:58`）：含 `typecheck`、`check:lib-sync`、`check:bilingual-134`、`check:locale-137`、`check:log-shape`、`check:host-deps` 等 20 项；**注意 `check` 并不包含 test:issue-112/149/165**，所以新测试只有写进 `package.json` scripts（并建议并入 `:58`）才真的挡人。
- i18n 门禁：新键必须过 `check-bilingual-134.mjs`（字典完备 + en 零 CJK，`:33`；P1 三档预算 `:34-39`；`DICT_FLOOR=150` `:42`）与 `research/i18n-audit/scan.mjs --check`（`strings.ts` 的 `.zh` 自动归 C1，`scan.mjs:140`）；`check-locale-137.mjs:76` 把 `entry-button.ts`/`settings-page.ts`/`template-browser.ts` 列为根文件，禁止裸中文字面量。
- 构建：`npm run build` 后 `lib/client.js` 必须提交，否则 `check:lib-sync` 红（`scripts/check-lib-sync.mjs:5-13,30-37`）；`lib/index.js` 不构建、手改即终态（`:30` 注释「lib/index.js 是检入的源码、不构建」）。发布脚本只跑 `npm run build`（`scripts/publish-token.ps1:109-110`），仓库无测试 CI（`.github/workflows` 只有 star-history / thanks 两条）。

### 7.1 真机验收清单（实施票跑，逐条手动）

1. **默认回归**：hover 移入入口即开；指针离开按钮且不进面板 → 约 150ms 关；同手势「hover + 点击」保持开（#112）；再点一次关。
2. **切到 click-only**：移入入口**不开**；单击开；再单击关；面板开着时指针反复扫过按钮/面板，状态不变。
3. **关闭三出口**：×、选中插入、跳设置成功，各自都能关；远程大列表 ×（`template-browser.ts:2048-2053`）同样。
4. **Esc（若采纳 S3）**：只关面板；输入镜/挑选器/齿轮打开时 Esc 先关它们（`entry-button.ts:340-365` 的栈序不变）。
5. **#14 / #34**：click-only 下搜索聚焦再失焦，面板不被关；hover 下行为与今天一致。
6. **触屏 / 远程**：tap 开合正常、指针移开不关；远程放大档下底栏不换行、不出现横向滚动（`:1543` 宽 560 + `nowrap`）。
7. **两处同源**：设置页 Check 翻转后，底栏按钮文案立即变；底栏翻转后，设置页 Check 立即变（`template-library.ts:84-86` 同步通知）。
8. **持久化**：重启 DSH 后设置保持；`<home>/storages/dsh_prompt.json` 的 global 区出现 `hoverTrigger`，且 `lastUsed`/`remote*` 未被写没（`lib/index.js:264-271` 展开）。
9. **升级保持**：旧用户（文件中无该键）升级后仍是 hover；显式切过的人保持 click-only。
10. **回滚**：换回旧版插件，hover 行为恢复、文件里多余键不报错（zod 默认剥离，未真机验证）。

## 8. 负向发现（未找到 / 未验证）

- 未找到宿主侧的触发方式设置或插件 API（§2 的 grep 口径，仅覆盖 0.2.1-rc.3 抽取件；app.asar 未解包）。
- 面板**没有** Esc 关闭与 outside-click 关闭（§3.2）——click-only 的关闭语义是新增行为，不是现成开关。
- 未验证（需真机）：闪烁的实际复现率与 150ms 手感；560px 底栏再加一枚按钮后的搜索框宽度（尤其远程放大档）；旧版宿主（<0.2.1-rc.3）对 overlay 槽的渲染是否一致；多窗口是否共享同一模块实例；回滚到旧版后新键被 zod 剥离的实际表现。
- 未验证：S2 的 outside-click 与 `keepComposerFocus`（#61）在真机上的事件顺序；S3 的 Esc 栈与输入法组词（composing）是否冲突。

## 9. 开放问题（maintainer decisions，附建议答案）

- **Q1 默认值**：hover。建议维持现状（#12 原始需求、`README.md:63` 对外承诺、`test-issue-112` R1/R5 直接断言），新设置的缺省归一只负责把缺键/脏值拉回 hover。
- **Q2 字段形状**：布尔 `hoverTrigger`（缺省 true）vs 枚举 `triggerMode: 'hover'|'click'`。建议布尔——与 #165 的 `hidePreset` 同构（读侧归一、schema `optional`、无迁移脚本）；枚举的扩展性目前没有第二维需求，归一与文案成本更高。
- **Q3 底栏按钮位置**：merged row（会破 `test-issue-149.cjs:129`，但符合 #165 眉心位「＋新增 与 设置入口之间」）vs tab/cloud 行（不破 149，但把「模式设置」混进过滤语义，与 #70/#141 的「范围身份」纯度冲突，`CONTEXT.md:117`）。建议 merged row，改一条断言，换语义正确。
- **Q4 关闭语义**：S3+现状显式关先落，S2 另起票。建议如此（§5）。
- **Q5 远程大列表是否也加按钮**：#165 是「小列表底栏 + 大列表底部 + 设置页」三处（`CHANGELOG.md:84`），维护者本次只点名「底栏 + 设置行」两处。建议远程大列表**不加**（保持最小面），但 click-only 必须让 `remoteHover` 一起失效，否则大列表仍会因指针离开而关。
- **Q6 设置页控件形态**：复用 `Check`（`settings-page.ts:138-148`，原生 checkbox + accent）vs 新分段控件。建议 Check——零新样式、过 #156 色彩门禁无风险；分段控件要新增一套 UI 与门禁覆盖。
- **Q7 文案**：动作式（hover 下显示「仅点击打开」）vs 状态式（「悬停打开：开/关」）。建议动作式，与 #165 定稿一致（`CHANGELOG.md:84`「按钮文案是动作式的」）。
- **Q8 文档**：`CONTEXT.md:113`/`GLOSSARY.md:45-47` 是否同步改成「触发方式可配置（缺省 hover）」？建议改，否则词汇表把已可配置的行为写成定义。

## 10. 证据路径

- `src/client/entry-button.ts:8-25`（import 面，含 `:11` panel-visibility）、`:245-249`（`HOVER_CLICK_GRACE_MS=1000` 与理由注释）、`:251-287`（EntryButton props / dockState）、`:340-365`（Esc 栈，不含面板）、`:448-482`（入口按钮：`:461` hover 开、`:462` 150ms 关、`:467-471` 点击确认/取反）、`:486`（非远程早退）。
- `src/client/panel-visibility.ts:8-57`（开合布尔、hover 打点 `:19-28`、`setPanelOpen :29-35`、抑制门 `:37-42`、`schedulePanelClose :45-49`、`cancelPanelClose :51-53`、`onPanelOpen :54-57`）。
- `src/client/template-browser.ts:607`（onPick 关窗）、`:1200-1210`（PanelPortal 挂 body）、`:1243`（showList）、`:1267-1304`（#34 状态与 #14 补关，`:1295-1296` 媒体查询、`:1299-1301` `:hover` 探测、`:1303` 排关）、`:1395`（ensureLoaded→refresh）、`:1439-1442`（hide 渲染期读）、`:1597-1605`（眼形按钮=动作式按钮范式）、`:1613-1616`（搜索样式，`:1616` compact）、`:1874-1876`（remoteHover）、`:2048-2053`（远程 ×）、`:2229-2266`（底栏两行，`:2234` merged row、`:2247` hide、`:2258` 跳设置关、`:2264` ×）、`:2271`（rootHover）、`:2272-2281`（根渲染）。
- `src/client/settings-page.ts:31`（store import）、`:56`（SettingRow）、`:138-148`（Check）、`:215-216`（hideState）、`:230-232`（subscribeStore 刷新）、`:664-667`（根样式）、`:679-694`（模板卡：`:679` hide 行、`:693` 分隔线、`:694` TemplateBrowser）。
- `src/client/template-library.ts:59-65`（URL 常量，`:64-65` #165 注释）、`:67-73`（StoreSnapshot）、`:77`（缓存初值）、`:84-92`（notifyStore/subscribeStore）、`:110-116`（ROUTE_NAMES）、`:119-159`（ensureLoaded，`:131` 归一、`:155-156` 置位+通知）、`:232-252`（normalize/load/save/apply）。
- `lib/index.js:100-115`（GlobalSchema）、`:126-129`（initial）、`:174-202`（snapshot，`:201` 归一）、`:264-271`（setHidePreset=整体替换范式）、`:432-438`（KNOWN_ROUTES，`:435` hide 路由）、`:946-1000`（POST handler 群，`:986-992` hide/set）。`lib/index.js` 为手写检入宿主半、不构建。
- `src/client/index.ts:40`（inject）、`:44-106`（PanelHost，`:103-105` open 才挂载）、`:183`（store 装载）、`:269-271`（overlay 注册）、`:274-276`（settings.section 注册）。
- `.dsh-tmp/hostconv/client.js:19183`（宿主 `renderSlot('conversation.input.overlay', {})`）、`:20077-20106`（槽声明，overlay `:20085-20088`）、`:16241,16619`（唯一 hover 文案）、`:17727-17783`（HeroFish 悬停动画）；`.dsh-tmp/trigger/lib-client.js:1150-1160,1931-1932`（菜单高亮 hover）；两包 `package.json:4` 版本 0.2.1-rc.3。
- `scripts/repro/test-issue-112.cjs:20-29`（buildFlat 清单）、`:71`（只传 open）、`:77-89`（R1）、`:91-103`（R2 键盘/触屏代理）、`:118-131`（R4）、`:133-145`（R5）、`:147-164`（R6）。
- `scripts/repro/test-issue-149.cjs:27,37,41,50,54`（构建/清场/桩/挂载）、`:62,70-79`（面板与列表几何）、`:96-98`（列表在底栏前）、`:113-133`（merged row 断言，`:116` nowrap、`:118-128` kindOf、`:129` 行序）、`:146-163`（×／＋）。
- `scripts/repro/test-issue-165.cjs:56-70`（fetch 桩）、`:80-102`（A 组 store）、`:104-115`（B 组 lib 静态）、`:117-144`（C 组 panel 静态）、`:146-160`（D/E 组）、`:162-172`（F 组 i18n）。
- `scripts/check-bilingual-134.mjs:6-11`（三组口径）、`:33-39`（CJK 与 P1 预算）、`:42-43`（`DICT_FLOOR`/`HOOK_FLOOR`）；`scripts/check-locale-137.mjs:76`（根文件清单）；`scripts/check-lib-sync.mjs:5-13,30-37`（产物比对）；`research/i18n-audit/scan.mjs:137-140`（strings.ts 归 C1）。
- `package.json:20-26`（exports/lib）、`:33-58`（scripts，`:58` check 组合）、`:96,112,115`（issue 专用测试）、`:132-134`（engines）；`scripts/publish-token.ps1:109-110`（发布只跑 build）。
- `README.md:63`（悬停展开的对外描述）；`CONTEXT.md:113`（悬浮列表定义）；`GLOSSARY.md:45-47`（Hover List 定义）；`CHANGELOG.md:84`（#165 三处同源 + 动作式）、`:95`（#14 补关）。
- `research/slot-remote-touch.md:26-30,60`（触控 click 闭环 / H2 150ms 关）；`research/cache-and-labels/findings.md:84-95,142`（localStorage 清单与「本机 UI 偏好不进 domain」旧判断）。
- GitHub：#179 正文与维护者评论（`gh issue view 179 --json body,comments`）；#12 正文 §1（`gh issue view 12`，CLOSED，hover 触发的原始需求）。
