# Issue #180 调研：输入框失焦时插入含 {{cursor}} 的模板，光标落到草稿开头

- Issue：[#180](https://github.com/FeatherHunter/dsh-prompt/issues/180)「【BUG】#178 真机：输入框失焦时插入含 {{cursor}} 的模板，光标落到草稿开头」（bug / needs-triage，2026-10-28）。
- 日期：2026-10-29；方法：只读（#180 票面、本仓源码、本机 DSH 0.2.1-rc.3 的宿主 bundle 抽取件、#178/#180 真机验收留下的探针脚本与 JSON），不改业务代码、不改测试、不改票面、不提交、不做实施。
- 范围：只回答「失焦插入后光标为什么在 0」「影响面」「怎么修、怎么验」。撤销分组属 #181（`research/issue-181-undo-grouping/findings.md`），不展开。
- 宿主版本：@deepseek-ai/dsh-desktop-runtime **0.2.1-rc.3**（`D:\DeepseekHarness\resources\app.asar\dsh\package.json` 实测）；bundle 抽取件 `.dsh-tmp/hostconv/client.js`（取自 #178 真机同一实例的 web 运行时，与 `research/template-escape-caret/findings.md` 的字符偏移同源，内含 Lexical 0.49）。插件 `package.json` version 0.4.39。
- 证据分级：**【实测】**= 真机探针 JSON 或本次只读命令的直接结果；**【源码】**= 本仓/宿主源码字面；**【推断】**= 由前两者推出、真机未直接观测。
- 与既有笔记的关系：`research/template-escape-caret/findings.md` 只到宿主 InputActions 能力边界与「两编辑留在标记位」的候选（§2、§4(a)），没有焦点时序与 DOM 选区同步；`research/slot-remote-touch.md:29` 只有一句「插入后 `setTimeout` `focusComposer`」是触屏兜底。两篇都不回答本问题 ⇒ 按 /research 规则新查并落本笔记。

## 0. 结论（先看这段）

1. **根因只有一处，不是票面猜的「两段偏差」**：失焦时两笔宿主编辑在 Lexical 模型里已经把选区留在标记位（本票为 8），但编辑器无焦点时宿主显式跳过 DOM 选区回写（`skip-dom-selection`）；紧跟着 `insertBody` 尾部的 `setTimeout(() => focusComposer(), 0)` 用**裸 `el.focus()`** 把焦点送回，浏览器在「root 内没有可用选区」的 contenteditable 里把光标放在开头（0），Lexical 随后的选区同步再把模型也改成 0——覆盖标记位。票面第①段「宿主删标记后光标留在末尾」是探针假象（§2.4、§5.1）。
2. **`caret = 11` 不能当证据**：`page-api.mjs` 的 `composerState()` 在选择点不在 composer root 内时兜底成 `text.length`（`D:/Temp/cdp/page-api.mjs:76,81-84`），而 `abcSMARTEND` 正好 11 字符。11 只等于「根内读不到选择」，不等于 Lexical 选择或视觉光标在末尾。
3. **普通模板（无 `{{cursor}}`）大概率同样错位（【推断】，真机未验）**：普通路径 `setDraft` 把模型选区置尾，同一个延迟裸 focus 会把它归零 ⇒ 失焦插入普通模板后光标在开头，而期望是末尾。票面只报了含标记用例；这会扩大修复范围、改变验收口径（§6.2）。
4. **修复主推**：把聚焦从「末尾延迟」提前到「`resolveDraft` 取到 `pos` 之后、`applyInsert` 之前」**同步**执行，让两笔编辑在持焦态落位（这正是 #178 真机已验证正确的路径）；末尾 `setTimeout` 保留作兜底。次序不能反：先 focus 再 `resolveDraft` 会把失焦落点读成 0（§7.1）。
5. **证据边界（会改变严重度判断）**：票据复现脚本用的是合成 `.click()`（`phase178-findings.mjs:22` → `page-api.mjs:32` 的 `r.click()`），**不派发 mousedown**，因此绕过了面板行 `onMouseDown` 上的 `keepComposerFocus`（`template-browser.ts:2256,549-568`）。物理鼠标从 BODY 点行时会先保焦、走聚焦路径，未必复现；真实可复现路径更可能是「焦点在面板搜索框」（`keepComposerFocus` 对面板内元素直接 return，`556-561`）或键盘/程序化激活。此点必须真机验（§6.4）。

## 1. 票面事实（【实测】：`gh issue view 180`）

- 现象：0.4.39 真机；草稿敲 `abc`，点空白让输入框失焦（`document.activeElement` = `BODY`），再点模板 `SMART{{cursor}}END`。
- 正文正确：`abcSMARTEND`（两笔宿主编辑都生效）。
- 光标错：插入后 `caret = 0`，期望 8（= 插入点 3 + 前缀 `SMART` 5 字符）；再敲 `X` 得 `XabcSMARTEND`，期望 `abcSMARTXEND`。
- 对照：聚焦态同一模板 `caret = 8` 正确 ⇒ 差异只在「插入那一刻 composer 是否持焦」。
- 复现率 3/3；脚本 `D:/Temp/cdp/phase178-findings.mjs`，结果 `D:/Temp/cdp/phase178-findings.json`，截图 `finding178-blur-caret.png`、`finding178-blur-caret-afterX-1..3.png`（四张图本次只读确认都在，45–46KB）。
- 票面自述影响面：从悬浮面板 / 远程 / 智能卡点插入时输入框通常失焦；票面自述机制是两段偏差（① 宿主删标记后光标留末尾 ② 插件延迟 focus 归零）——本笔记纠正的正是这一段。

## 2. 真机证据与一处测量假象（【实测】）

### 2.1 `phase178-findings.json` 的 blur 组：3/3 一致

- 第 1 条（`:3-32`）：`typed.text=abc, caret=3`（`:11-16`）→ `blurActive="BODY|"`（`:17`）→ `inserted.text=abcSMARTEND, caret=0`（`:19-24`）→ 敲 X 后 `XabcSMARTEND, caret=1`（`:25-30`），`caretOk=false, textOk=false`。
- 第 3 条（`:65-95`）逐字段相同；第 2 条同构 ⇒ 「BODY 持焦时插入，读完是 0」确定。
- 同一文件的 undo 组（聚焦态，`:98-118`）：`inserted.caret=8`（`:110`）、`activeAfterPick="DIV|true"`（`:113`）⇒ 「聚焦态同一套两编辑落点 8」也确定。这是后面判定的关键对照。

### 2.2 `focus-probe.json`：focus 与归零发生在同一瞬间

- `focus-probe.mjs` 在插入前装了两层探针：猴补 `HTMLElement.prototype.focus` 记录 before/after 选区（`:9-11`），以及 rAF 采样 `document.activeElement` 与 `window.getSelection()`（`:31`）。
- 结果（`focus-probe.json`）：`inserted.text=abcSMARTEND, caret=0`（`:2-7`）；`log` 里**只有一条** focus 记录——`tag=DIV, cls=GRgSLq_input`，focus 前后都是 `rc=1` 的折叠选区、`txt` 为空（`:8-21`；`txt` 取自 `String(selection).slice(0,30)`，折叠选区恒为空，只能证明「有一条选区」，不能定位）；`sel` 采样里 `activeElement` 一直是 BODY，直到 `t=1190` 变 DIV（`:449-460`）。
- 注意 `t` 是 rAF 采样起点的时间，不是「pick 之后多久」：`pick()` 里先 mouseMove、开面板、`setSearch`、`sleep(500)`，最后才 `clickRow`（`focus-probe.mjs:13-21`）⇒ 1190ms 那个跳变就是**插入那一刻**，不是「1.2 秒后才聚焦」。结合 `caret-probe.json:2-10`（插入后立刻读：`caret=0, active=DIV|true`），可确认聚焦发生在插入的同一任务/下一拍。
- 另一条重要信息：整个插入过程**只有一次 `HTMLElement.focus` 调用** ⇒ 合成点击路径里确实没有 `keepComposerFocus` 产生的第二次 focus（§6.4）。

### 2.3 `focus-delay-probe`：把 0ms 改成 700ms，caret 从 11 跳到 0

- 脚本（`focus-delay-probe.mjs`，35 行）第 24 行把 `window.setTimeout` 对 0ms/null 的延迟改成 700ms；第 25 行同样用合成 `clickRow`；第 27 行每 200ms 采一次 `composerState()`。
- 结果（`focus-delay-probe.json`）：t=200/400/600 → `text=abcSMARTEND, caret=11`（`:3-17`）；t=800 起文本不变、`caret=0`（`:18-42`）。
- 含义：**延迟的 focus 执行前，文本已正确、根内读不到选择；focus 执行后，根内选择变成 0**。文本没变、只有选择变 ⇒ 纯选择问题。
- 限制：猴补是全局的，页面上所有 0ms 定时器都被推迟（不只插件那条），所以它只能当「focus 尚未执行」的对照，不能当「插件不 focus 时宿主如何」的纯净观测。

### 2.4 `caret=11` 是读取兜底，不是「在末尾」

- `page-api.mjs` 的 `composerState()`（`:56-115`）：先 `let caret = text.length`（`:76`）；只有 `selection.anchorNode` 是 root 自身或在 root 内（`:81`）才按锚点重算；锚点在 root 上但段落匹配不到仍取 `text.length`（`:84`）；末尾 clamp（`:114`）。
- 失焦时 `anchorNode` 根本不在 composer root 里（焦点在 BODY）⇒ caret 恒为 `text.length`。`abcSMARTEND`.length = 11，**这个 11 是巧合式恒等，不是位置证据**。票面第①段很可能就是把它读成了「光标在末尾」。
- 插件自己的 `readEditable` 有同款兜底（`src/client/template-browser.ts:469`，只有锚点在 root 内才换成真实偏移，`:475-483`；尾部换行门控依赖 `selInside`，`:508-511`），所以失焦时 `resolveDraft` 的 `live-blur` 读数同样只是兜底（本例草稿 `abc`、光标恰在末尾，兜底 3 刚好对）。真机上失焦落点的唯一可信来源是编辑期采样 `caretSample`（§3.2），不是失焦后的活读。

## 3. 插件侧时序（【源码】）

### 3.1 `insertBody`：先算、再写、最后延迟聚焦

- `src/client/template-browser.ts:708-720`：`armInputFocusTrack()`（710）→ `resolveDraft()`（711）→ 取 `pos`（713）→ `applyInsert(inputActions, draft, pos, body)`（715）→ `setTimeout(() => focusComposer(), 0)`（716-718）→ 返回插入前长度。
- 即：**写入发生在 composer 失焦的状态下**，聚焦是事后、异步的一步。这就是本 bug 的时间窗。

### 3.2 `resolveDraft`：失焦时靠采样

- `577-651`：H = 宿主模型草稿（`tapDraft`，579），D = 点击瞬间 DOM 活读（585-588）。
- 落点：持焦 `'live'`、失焦 `'live-blur'`（592）；失焦且采样来自同一 root 时用 `mapCaret(st, caretSample.caret, d || st)` 覆盖，来源记 `'sample'`（595-604）。
- 注释里已有前科（575）：「真机实证失焦后选择会被归一化到上一行末尾，字就插错了行」。⇒ 失焦后的 DOM 选择本来就不可信，`caretSample` 才是落点权威。
- chip 存在时信 H、光标只能回尾（615）；其余分歧信 D（629-630）。
- 对本 bug 的意义：失焦时「插到哪」本来就算对了（靠采样），错的是「插完之后光标在哪」。

### 3.3 `applyInsert`：两条路，落点都由文本算

- `669-703`。`finalText = src.slice(0,pos) + parsed.text + src.slice(pos)`（673）。
- 无标记（`parsed.caret === null`）：`inputActions.setDraft(finalText)` 单编辑（676-679），光标由宿主置尾。
- 有标记：`markerAt = pos + parsed.caret`（680，**纯文本算术，不读 DOM 选择**）→ `setDraft(withMarker)`（689）→ `captureInsertion()` 取 `draftRev`（690-691）→ `insertText('', { draftRev, start: markerAt, end: markerAt + CURSOR_MARKER.length })`（693）→ `mode='span'`（694-696）。
- 任一环失败（缺 action / 草稿含 chip / `insertText` 非 true / 抛错）：`setDraft(finalText)` 降级、`mode='degraded'`（682-686、699-702）。
- `CURSOR_MARKER = '{{cursor}}'`（`src/client/template-library.ts:440`），10 字符 ⇒ 删除区间正好是标记本身。

### 3.4 `focusComposer` 与 `keepComposerFocus`

- `focusComposer`（537-545）：`pickEditable()`（540）后**裸 `el.focus({preventScroll:true})`**（542）——不调用宿主的 `focusDraftEditor`，没有选区恢复。这就是「恢复焦点」的全部实现。
- `pickEditable`（515-534）：activeElement > 最后摸过的 `lastFocusEl` > 首个非空 > 首个。
- `keepComposerFocus`（549-568）：先 `sampleCaret()`（551，mousedown 是最后可信落点时刻）→ `preventDefault`（552，拦焦点转移、不拦 click）→ activeElement 在面板根/弹窗根内**直接 return**（556-561）→ contenteditable / textarea 内也 return（562-565）→ 否则 `focusComposer()`（566）。
- 绑定：紧凑面板行 `mousedown`（`2256`；`2264` 的 `onClick` 才是 `handlePick`）、远程卡 `onMouseDown`（`2023`）、面板 portal 根属性（`1355`）。⇒ 面板里本来就有一套「插入前保焦」，**只有 activeElement 在面板内（搜索框）时不保焦**。这一点决定 §6.4。

## 4. 宿主为什么「模型对了、DOM 没跟上」（【源码】，0.2.1-rc.3 抽取）

### 4.1 两笔编辑写的是什么

- `DraftEditorRuntime.setDraft`（`client.js:14686-14696`）：`nl().clear()` + `$appendParagraphs(clean)`，`discrete: true`，`tag: xo`（= `history-merge`，`7496`）。
- `$appendParagraphs`（`14556-14564`）：按 `\n` 切段、空行成空段，末尾 **`root.selectEnd()`**（14563）⇒ 整框替换后模型选区在文末。
- `insertAsyncText`（`14772-14779`）→ `$replaceDetectSpanWithText`（`14522-14528`）：注释「The caret lands after the insertion.」（`14517`）；空串且选区非折叠时 `selection.removeText()`（14525），否则 `selection.insertText(text)`（14526）。
- Lexical `removeText`（`8357-8359`）：删除选中区间后塌缩到区间起点 ⇒ 删掉 10 字符标记后模型选区 = `markerAt` = 8。聚焦态实测 `caret=8`（§2.1）正是这条的证明。

### 4.2 失焦时宿主故意不写 DOM 选区

- `preserveExternalSelection`（`14606-14610`）：`if (root !== null && !root.contains(root.ownerDocument.activeElement)) Al(bo)`；`bo = "skip-dom-selection"`（`7496`），`Al(t)` 只把标签塞进当前 update（`11001-11004`）。它同时被注册成命令与节点 transform（`14611-14614`；SELECTION_CHANGE 命令处理器在 `6495`/`14614`）。
- Lexical 提交时把选区写回 DOM 的条件带 `!m.has("skip-dom-selection")`（`9331`）⇒ activeElement 不在输入框里（BODY / 搜索框）时，**编辑只改模型，不写 `window.getSelection()`**。
- 这解释了 §2.3 的 200–600ms 采样：文本已正确（模型改了），根内却读不到选择（DOM 没写）。此时 DOM 选区还停在 composer 外面。

### 4.3 宿主自己的「恢复焦点」是带选区的

- `focusDraftEditor(editor, revealSelection)`（`18482-18487`）：先 `editor.getRootElement().focus({preventScroll:true})`，再 `editor.focus(cb)`。
- Lexical `editor.focus`（`10615-10623`）：模型已有选区就恢复（`o.dirty || o.clone()`），没有才按 `defaultSelection` 走 `selectStart`/`selectEnd`（默认 end）。
- 对照：宿主路径能「DOM focus + 把模型选区写回去」，插件的 `focusComposer` 只有前半步。ADR-0010 说的「没有 `setCaret`」指公开 `InputActions`（`14941-15050`：`captureInsertion` / `insertText` / `setDraft` / `persistDraft` / 附件 / `submit`，无 `setCaret` / `setSelection` / 「插入后指定光标」），不是指宿主内部没有恢复能力（`docs/adr/0010-template-body-linebreaks-and-cursor-marker.md:10,26,44`）。

## 5. 根因判断：一段，不是两段

### 5.1 票面第①段不成立

三条反证：

1. **同一段代码在聚焦态实测落点 8**（§2.1，`phase178-findings.json:110`）。失焦与聚焦走同一个 `$replaceDetectSpanWithText` → `removeText`，差别只在 4.2 的「写不写 DOM」；模型侧的塌缩规则不看焦点。
2. **源码语义是塌缩在区间起点**（§4.1），不是末尾。
3. **「末尾」这个观察本身就是兜底**（§2.4）：11 = `text.length`。

⇒ 第①段是**读数误差**，不是机制。

### 5.2 真正发生的事（单段）

1. 插入瞬间 composer 失焦（BODY 或面板搜索框持焦）；`applyInsert` 两笔编辑改模型：文本正确、模型选区 = 8（或普通路径的末尾）；因 `skip-dom-selection`，DOM 选区没被写进 root（4.2）。
2. `insertBody` 的 0ms 定时器执行 `focusComposer()`——裸 `el.focus({preventScroll:true})`（3.4）。
3. 浏览器给 root 造一个 DOM 选区：root 里没有可用选区，落到位置 0（【推断】：浏览器行为未在源码里读到；证据是 focus 后 `composerState` 立即读到 0（`caret-probe.json:2-10`）且随后键入得 `XabcSMARTEND`（`phase178-findings.json:25-30`）。`focus-probe.json:8-21` 的 focusLog 只能证明 focus 前后各有一条折叠选区，不能定位）。
4. Lexical 的 focus/`selectionchange` 把 DOM 的 0 同步回模型，覆盖 8；此后输入落在开头。
5. 用户看到「正文对、光标在开头」。

一句话：**一次延迟的裸 focus，把「模型里正确、DOM 里没写」的选择，替换成了「DOM 里的 0，并同步回模型」**。

### 5.3 置信度与还差哪一环

- 高：失焦时模型正确（文本 3/3、聚焦态 8）、失焦时根内无选择（11 是兜底）、focus 之后是 0（2.2/2.3）。
- 中高：0 由 focus 造成（时间点、唯一 DOM 动作、文本不变、focusLog 只有一条）。
- 未直接观测：focus 时的 `selectionchange` 时序，以及失焦态 `insertText` 到底走了 `mode='span'` 还是降级 `setDraft`。
- 后者是真正的诊断缺口：`applyInsert` 明明返回 `mode`（674、684、695），但 `insertBody` 丢弃了它（715），`onPick` 的 `pick.insert` 只记 `caret` / `caretSrc` / `draftLines`（729-737），现有日志无法回答「失焦时 span 路是否命中」：
  - 命中 ⇒ 模型 8 → focus → 0（本笔记的机制）；
  - 降级（比如 `captureInsertion` 在失焦时被拒）⇒ 模型 11 → focus → 0。**用户症状一样**，但修复必须保证失焦时 span 路真能走，否则「先 focus 再插」还要额外兜住降级分支。
- 建议（研究结论，不是实施）：把 `mode` 记进 `pick.insert`，下一次真机一眼可辨；这值得写进修复票的验收。

## 6. 影响面

### 6.1 含 `{{cursor}}` 的模板（【实测】）

- 失焦插入：正文对、`caret=0`（期望 8），再输入落到开头，3/3。
- 聚焦插入：`caret=8`，正确。

### 6.2 普通模板（无标记）：【推断】，真机未验

- 路径：`applyInsert` 676-679 单 `setDraft(finalText)` → `$appendParagraphs` → `root.selectEnd()`（4.1），模型选区在末尾。
- 同一个 `insertBody` 末尾、同一段延迟裸 focus 对**所有分支**生效 ⇒ 失焦插入普通模板后 DOM 0 被同步回模型，光标在开头；期望是末尾（旧行为契约：`setDraft` 置尾）。
- 票面只报了含标记用例，**这条没被真机验过**，但源码上它与 marker 路径共享同一个 focus。含义：
  - 修复范围：只给 span 路补 focus 会漏掉普通模板；最小改法应落在 `insertBody` 的共同路径（§7.1）。
  - 验收：必须加「失焦 + 普通模板 → caret = 文本长度；再敲字落在末尾」用例，否则修完仍可能被用户报同一现象。
- 证伪点：若真机验出普通模板**不**受影响，说明 focus 时序之外还有别的因素（例如宿主对 `setDraft` 有单独的聚焦/选择路径），单段结论要重审。

### 6.3 其它入口

- **智能卡**：`smartInsert`（`src/client/smart-card.ts:148-168`）直接调 `applyInsert`（155），**没有** `focusComposer`，只有对旧式 textarea 的 `setTimeout` 定位（158-168，Lexical 下自然落空）⇒ 不受本机制影响；它另有「插入后不回焦」的旧问题（用户得自己点回输入框），与 #180 不是同一现象。
  - 本机现存的智能卡真机证据不可用：`D:/Temp/cdp/phase178-smart-results.json` 里 S7/S11 卡片 `shown=false`、S8/S12 `clicked=false`，`D:/Temp/cdp/smart-card-results.json` 的 `clicked=null`、`inserted.text=""` ⇒ 插入根本没触发，无法据此判断智能卡路径的落点。此条仍需真机重测。
- **`/prompt` 斜杠**：插件只返回正文、宿主替换，插件不 focus ⇒ 不在本机制内。
- **远程 Sheet**：插入仍走 `onPick` → `insertBody`，同一段延迟 focus；但 `pickEditable` 会把焦点送到谁（宿主 composer 还是远端 textarea）本次未核 ⇒ 【推断】同样受影响，需真机确认。

### 6.4 复现路径的证据边界（会改变严重度判断）

- 票据脚本走的是 `phase178-findings.mjs:22` 的 `__T.clickRow(...)`，其实现是 `r.click()`（`page-api.mjs:32`）——**只派发 click，不派发 mousedown**；面板行把 `keepComposerFocus` 挂在 `onMouseDown`（`template-browser.ts:2256`），所以这条路径绕过了「插入前保焦」。`focus-probe.json` 的 focusLog 只有一条（插件那条）也印证了这点。
- 物理鼠标点行：mousedown → `keepComposerFocus` → activeElement 是 BODY（不在面板内、不是可编辑）→ `focusComposer()`（566）⇒ **插入时 composer 已聚焦**，走聚焦路径，本 bug 很可能不复现；随后末尾延迟 focus 是 no-op。
- 真实可复现的路径更可能是：
  - 焦点在面板搜索框（`keepComposerFocus` 对 `[data-dsh-prompt-panel-root]` 内元素直接 return，`556-561`）——用户先搜模板再点行，插入时 composer 仍失焦；
  - 键盘/程序化激活（行的 `onClick` 无 mousedown；卡片 Enter/Space 在 `2042`）；
  - 测试脚本的合成事件。
- 现有证据分不清「真实用户走哪条」，而它直接决定这是「常见路径的高优 bug」还是「合成事件才触发」。**修复票第一件事应是真机补物理点击用例**，再决定是否要动 `keepComposerFocus` 的搜索框分支。

## 7. 修复方向（只研究，不实施）

### 7.1 主推 A：插入前同步聚焦

    const r = resolveDraft()
    const draft = r.text
    const pos = ...            // 713
    focusComposer()            // ← 新增：同步，在宿主写入之前
    applyInsert(inputActions, draft, pos, body)   // 715
    setTimeout(() => focusComposer(), 0)          // 716-718：保留作兜底

- 为什么对：
  1. 真机已证「聚焦态两编辑落点 8」（§2.1），把编辑挪回持焦态就回到已验证正确的路径。
  2. 两条分支的落点都由文本算：marker 路 `markerAt = pos + parsed.caret`（680），普通路 `root.selectEnd()`（14563）⇒ 即使 focus 先造了一个 0 选择、甚至同步触发 `selectionchange`，`applyInsert` 之后模型仍是确定值，并且这次是**持焦态**写回 DOM（`9331` 的条件成立）。
  3. 不改宿主、不加 API、不动降级阶梯，不违反 ADR-0010。
- **次序不能反**：先 focus 再 `resolveDraft` 会把失焦落点读成 0（focus 造出 0 选择、活读变 0；采样只在「未聚焦」分支用，595）⇒ 文本会插到开头。必须是「先算 pos（含采样）→ 再 focus → 再写」。
- 聚焦目标：建议 `resolveDraft` 回传它读的 root，避免 `pickEditable` 二次选择把焦点送到别的 root（`pickEditable` 515-534）。实现时复用 `focusComposer()` 或直接 `root.focus({preventScroll:true})` 都行。
- 兜底：`focusComposer` 吞异常（537-545），composer 不在场时 no-op；末尾延迟 focus 保留，可覆盖「`applyInsert` 之后又被别处抢焦点」的残余场景。

### 7.2 备选（都不如 A）

- **B 插后恢复选区**：公开 `InputActions` 无 `setCaret`（4.3），只能靠「在标记位做一次非空插入」把光标带过去（`research/template-escape-caret/findings.md:53-55` 的 (a) 路线）；失焦时 DOM 选区不在 root 内，仍要先 focus，等于 A + 更复杂的两编辑 ⇒ 收益低、undo 结构更乱。
- **C 不恢复焦点**（删掉延迟 focus）：插入后直接打字会丢输入，UX 退化，且普通模板的「期望置尾」仍不成立。
- **D 上游加 `setSelection` / 带光标参数的 `insertText` / 导出 `focusDraftEditor`**：最干净，但需 DSH 侧改动 + engines 版本门槛（ADR-0010:44 已记为长期解），不在本票。

### 7.3 风险与待验证

1. **focus/selectionchange 时序**：focus 造的 0 若在 `applyInsert` 之后才被 Lexical 消费，会不会把 8 覆盖回 0？按 §5.2，selectionchange 读的是**当前 DOM**（此时已是 8），风险低；但这是异步事件，必须真机 instrument 一次（记录 focus / selectionchange / applyInsert 的顺序）。
2. **焦点被抢**：同步 focus 在 `handlePick` 的同一任务里执行；若用户正在搜索框输入，插入后焦点会从搜索框移到 composer（大概是期望行为，但要确认面板不会因失焦误关，见 `2400` 的 `searchFocused` 抑制与 #34）。
3. **普通模板**：同一条改法应让普通模板回到末尾；必须同时验（§6.2）。
4. **降级分支**：失焦 + chip / 旧宿主走 `setDraft` 降级；同步 focus 后仍置尾，但要确认降级不再被延迟 focus 归零（同步 focus 后再 `setDraft`，持焦写回应当正确）。
5. **远程 Sheet / 智能卡**：`pickEditable` 可能把焦点送到宿主 composer 而不是远端 textarea（§6.3），需要真机确认不会把用户从远端面板拽走。
6. **撤销语义不变**（#181 另票）：本改不改变编辑笔数与 tag，只改聚焦时机。

## 8. 验证建议

### 8.1 mock 层（能断言「顺序」，不能断言光标）

- 现有 `scripts/repro/test-issue-178.cjs`：mock 的 `calls` 记录在 468-474（无标记路径）、525-536（标记路径，`draftRev=7`），顺序断言例 576-587（`setDraft` → `captureInsertion` → `insertText`）、次数断言 621-628；集成用例 M1/M8 在 984-1017 只断言返回值与 `setDraft` 文本。
- DOM 桩在 96-164：`mkEl.focus()` 是空函数（107），`document.querySelectorAll` 只回 textarea（134）⇒ 现在即使 `insertBody` 调了 focus，mock 也看不见。
- 建议：给桩加一个假 composer root（contenteditable，能被 `composerRoots` 选中），让 `mkEl.focus()` 往 `calls` 里写一条 `focus`，然后断言：
  - 失焦态下 `insertBody` 的 `calls` 顺序里 `focus` 在第一次 `setDraft` 之前；
  - 普通模板（无标记）同样如此；
  - 持焦态不产生重复的额外 focus（或允许，但顺序仍在前）。
- 这类断言只钉调用顺序，钉不住浏览器光标（自造 DOM 没有 Lexical 的选择模型）——光标必须真机。

### 8.2 真机 CDP（唯一能证明光标的手段）

- 复用 `phase178-findings.mjs` 的结构：`cdp-lib.mjs:2` 的 `CDP_PORT` 默认 9223、`helpers.mjs:5-10` 的 `boot`（navigate + 注入 `pageApi` + `gateOff`）、1440x900 视口、每步 `screenshot`。
- 必须补的三类用例：
  1. 含标记 + 失焦（票面用例）：断言 `inserted.caret === 8`、敲字后 `abcSMARTXEND`；
  2. **普通模板 + 失焦**：断言 `inserted.caret === text.length`、敲字落在末尾（§6.2）；
  3. **物理点击**（派发 `mousedown`/`mouseup`/`click`，而不是 `.click()`），分别在 BODY 失焦与搜索框聚焦两种前置下各跑一遍（§6.4）。
- 另建议包一层记录 `focus` / `selectionchange` / `applyInsert` 的实际顺序（§5.3、§7.3-1），并把 `applyInsert` 的 `mode` 记进日志。

### 8.3 环境重建（原验收环境已关闭）

- 现状：CDP 9222/9223 都不在（本次实测）；残留还在但不可直接用：`D:\Temp\dsh-home-178`、`D:\Temp\pack-178`（内含 `dsh-prompt-0.4.39.tgz`）、`D:\Temp\edge-178`。
- 重建：新建隔离 `DSH_HOME`（不要复用用户真实 home）→ `npm pack` 出 tgz → 在隔离 home 安装 → headless Edge 开 `--remote-debugging-port=9223` → 跑脚本。验收实例一关，脚本里的选择器/坐标都要重校（面板位置与窗口尺寸相关）。

## 9. Sources

**票面与真机证据**

- `gh issue view 180 -R FeatherHunter/dsh-prompt --json body`（#180 正文；§1 全部事实）。
- `D:/Temp/cdp/phase178-findings.json:3-32,65-95`（blur 3 run）、`:98-118`（undo 组，聚焦态 caret=8，`:110`、`:113`）。
- `D:/Temp/cdp/phase178-findings.mjs:16-22`（悬停开面板 + `__T.clickRow` 合成点击）、`:35`（真鼠标点空白致失焦）、`:39-44`（截图与断言）。
- `D:/Temp/cdp/focus-probe.mjs:9-11,13-21,31`（focus 猴补、pick 时序、rAF 采样）；`D:/Temp/cdp/focus-probe.json:2-21,449-460`（caret 0、唯一一条 focus、BODY→DIV 跳变）。
- `D:/Temp/cdp/caret-probe.json:2-10,20-25`（插入后立即 caret 0 + active DIV；敲 X 得 `XabcSMARTEND`）。
- `D:/Temp/cdp/focus-delay-probe.mjs:24-27`、`D:/Temp/cdp/focus-delay-probe.json:3-42`（11 → 0）。
- `D:/Temp/cdp/page-api.mjs:32`（`clickRow = r.click()`）、`:56-115`（`composerState` 兜底：76、81-84、114）。
- `D:/Temp/cdp/phase178-smart-results.json:30-45,58-78`、`D:/Temp/cdp/smart-card-results.json:20-38`（智能卡真机用例失败，不作证据）。
- 截图：`D:/Temp/cdp/finding178-blur-caret.png`、`finding178-blur-caret-afterX-1.png`、`-2.png`、`-3.png`（存在性实测，45–46KB）。

**插件源码**

- `src/client/template-browser.ts:708-720`（insertBody）、`:669-703`（applyInsert；markerAt 680、span 693、降级 682-686/699-702）、`:577-651`（resolveDraft；采样 595-604、chip 615）、`:537-545`（focusComposer；裸 focus 542）、`:515-534`（pickEditable）、`:549-568`（keepComposerFocus；面板内 return 556-561、focus 566）、`:469-511`（readEditable 兜底与 selInside）、`:274-311`（caretSample / composerFocused）、`:243-272`（armInputFocusTrack）、`:725-740`（onPick / pick.insert 日志）、`:2253-2264`（行 mousedown/click）、`:2020-2048`（远程卡，键盘 2042）、`:1355`（面板 portal 根属性）、`:2400`（searchFocused 抑制关窗）。
- `src/client/smart-card.ts:148-168`（smartInsert 无 focus）。
- `src/client/template-library.ts:440`（CURSOR_MARKER）。
- `docs/adr/0010-template-body-linebreaks-and-cursor-marker.md:10,26,44`。
- `research/template-escape-caret/findings.md:6,21,53-55`（宿主版本、Lexical 0.49、备选 (a) 的限制）；`research/issue-181-undo-grouping/findings.md`（撤销分组，本票不展开）。
- `scripts/repro/test-issue-178.cjs:96-164,468-474,525-536,576-587,621-628,952-963,984-1017`。

**宿主抽取源码（0.2.1-rc.3）**

- `.dsh-tmp/hostconv/client.js:6495`（SELECTION_CHANGE 命令）、`:7496`（tag 常量，`bo=skip-dom-selection`）、`:9331`（写回 DOM 的 skip 条件）、`:8357-8359`（Lexical removeText）、`:10563-10564`（root focus/blur 事件桥）、`:10615-10623`（editor.focus 恢复选区）、`:11001-11004`（Al 打 tag）、`:14503-14514`（selectSpan）、`:14517`（注释）、`:14522-14528`（$replaceDetectSpanWithText）、`:14556-14564`（$appendParagraphs / selectEnd 14563）、`:14606-14614`（preserveExternalSelection）、`:14686-14696`（setDraft）、`:14772-14779`（insertAsyncText）、`:14941-15050`（InputActions 公开面）、`:18482-18487`（focusDraftEditor）。

## 10. Open questions

1. **普通模板失焦插入是否同样归零**（§6.2）：源码推断为是，真机未验；这是修复验收必须补的第一条，也是单段结论的证伪点。
2. **物理鼠标点击是否复现**（§6.4）：从 BODY 点行会先 `keepComposerFocus` 保焦，可能不复现；搜索框聚焦时才会。真实用户路径没被现有证据覆盖。
3. **focus / selectionchange / applyInsert 的实际时序**（§7.3-1）：需要一次 instrument 过的真机运行，确认 0 不会在写入之后反噬。
4. **失焦态 `insertText` 是 `mode='span'` 还是降级**（§5.3）：`mode` 没进日志，需补日志后重跑。
5. **智能卡路径的真实落点**：源码上它不 focus，但本机三个智能卡真机用例都没触发（§6.3），需要重测；远端 Sheet 的 `pickEditable` 目标也未核。
6. **重建真机环境的成本**（§8.3）：原隔离实例已关，坐标/选择器要重校。

## 11. 实施补充（2026-10-29，修复落地后回填）

- **修复位置改为 `applyInsert` 收口**（本文 §7 原建议写在 `insertBody`）：`applyInsert(inputActions, draft, caret, body, root?)` 在首次 `setDraft` 之前执行「`focusRoot = root || pickEditable()`，未聚焦则 `focusComposerRoot(focusRoot)`」；`insertBody` 把 `resolveDraft` 带回的 `root` 传下去，智能卡 `smartInsert` 不传、就地 `pickEditable()`。理由：注释与代码都把 `applyInsert` 定义为宿主写入收口，智能卡行没有 `onMouseDown: keepComposerFocus`（§6.3），守卫若只挂在 `insertBody` 会漏掉这条路径。
- **§10 开放问题 1、2 已由真机回答**：无标记模板失焦插入修复后 `abcNOMARK` → caret=9、键入 X 得 `abcNOMARKX`（修复前同路径 caret=0，见旧构建对照）；物理点击搜索框造成失焦后点行（`Input.dispatchMouseEvent` 真实 mousedown/mouseup）修复后 caret=8、键入 X 得 `abcSMARTXEND`，说明「搜索框聚焦」是真实可复现路径，从 BODY 直接点行仍会被 `keepComposerFocus` 保焦。
- **真机证据（不进仓）**：`D:/Temp/cdp/phase180-verify.mjs`、`D:/Temp/cdp/phase180-fixed.json`、`phase180-fixed-blurred.png`；隔离环境为 `D:/Temp/dsh-home-180` 上装 `D:/Temp/pack-180/dsh-prompt-0.4.39.tgz`，headless Edge 156 + CDP 9241。
- **§10 开放问题 3、4 仍未验**：focus 后 selectionchange 是否会反噬（真机只验了最终 caret，未 instrument 时序）；`mode` 仍不进 `pick.insert` 日志（面板侧 `insertBody` 丢掉 applyInsert 返回值），本次以「两编辑调用序列」断言 `span` 路径，未补日志字段。
- **§10 开放问题 5（智能卡）**：修复已按同一收口覆盖 `smartInsert`，单测 K18–K20 钉住「首次 setDraft 前焦点已归位」；面板外真实智能卡触发仍未真机验证。
- 回归门禁：`scripts/repro/test-issue-178.cjs` 契约 v3 共 492 条；去掉守卫复跑恰红 6 条（K18、N2、N3、N4、N9、N11），加回后全绿。- **旧构建对照（同一脚本、同一路径）**：pre-fix 包（`D:/Temp/pack-178/dsh-prompt-0.4.39.tgz`）跑出 7/11 —— 失焦带标记用例 `abcSMARTEND` 后 caret=0、键入 X 得 `XabcSMARTEND`；失焦无标记用例 `abcNOMARK` 后 caret=0、键入 X 得 `XabcNOMARK`；持焦用例仍 8/正确。证据 `D:/Temp/cdp/phase180-old.json`。新构建同脚本 11/11（`D:/Temp/cdp/phase180-fixed-final.json`），说明验收脚本能红能绿、不是自证。
