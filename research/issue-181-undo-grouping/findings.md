# Issue #181 调研：模板插入后的撤销分组（宿主 undo 语义）与「第二次撤销吞草稿」的根因

- Issue：[#181](https://github.com/FeatherHunter/dsh-prompt/issues/181)「#178 真机：插入后第二次撤销会连插入前的草稿一起撤掉（README/ADR 未写明）」
- 日期：2026-10-29；方法：只读（本仓源码 + 宿主 web 运行时 bundle + 既有真机证据文件），不改业务代码、不提交、不做实施选型终裁。
- 范围：宿主撤销分组语义、插件两编辑序列产生的撤销栈、候选修法与未验证风险。「该修行为还是改文档」由维护者拍板（见 #181 票面 Q）。
- 宿主版本：@deepseek-ai/dsh-desktop-runtime **0.2.1-rc.3**（`D:\DeepseekHarness\resources\app.asar\dsh\package.json` 实测；bundle 内版本串 idx≈3593393）。bundle 取自 #178 真机验收同一实例的 web 运行时：`D:\Temp\dsh-assets\asset-03.js`（`fetch-bundles.mjs` 从 127.0.0.1:59337 抓的预载包，内含 @deepseek-ai/dsh-client-ui-conversation 与内联 @lexical/history）。
- 既有笔记是否够用：`research/template-escape-caret/findings.md` §4(a) 只记「多次 insertText 各算一条独立 undo（setDraft 合并进历史）」，没有撤销分组机制、没有撤销栈轨迹与修法候选；故按 /research 规则新查本笔记。

## 0. 一句话结论

宿主 `DraftEditorRuntime.setDraft` 用 `history-merge` 标签写入 ⇒ **整框写回永远并入「当前」撤销记录、不产生独立撤销步**；而 `insertText`（`insertAsyncText`）用 `paste` 标签 ⇒ **独立成条**。插件 marker 路径的第一笔是 `setDraft(含标记全文)`，撤销栈因此是「[敲字前草稿快照 C0, 带标记全文快照 C2]」：undo1 回放 C2（标记重现，与文档一致），undo2 回放 C0（= 敲入 `abc` 之前）→ 草稿清空。票面描述的「并入用户刚敲 abc 的那条记录」在机制上更准确地说是：**该条记录被改写，而它在 undoStack 里的下层快照就是敲字前的状态**。

## 1. 宿主侧：三种写入的撤销分组（bundle 源码锚点）

以下 idx 均为 `D:\Temp\dsh-assets\asset-03.js` 字符偏移（同一 bundle 内）：

- **`DraftEditorRuntime.setDraft`**（注释 idx≈6611329）：
  - 注释原文：「Replace the whole draft (persisted-draft seed and programmatic writes). … Merged into history so a seed is not an undoable step of its own.」
  - 实现：`this.editor.update(() => { nl().clear(); $appendParagraphs(clean) }, { discrete: true, tag: xo })`，其中 `xo = "history-merge"`（标签表 idx≈6374738：`mo="history-push", xo="history-merge", Co="paste"`）。
  - 副作用：`clean === projection.clipboardText && occurrences.length === 0` 时直接 return（不产生任何 update）。
- **`insertAsyncText`**（注释 idx≈6614078，函数 idx≈6614299）：
  - 注释原文：「Insert an asynchronous text result as one independent undo operation.」
  - 实现：`applyEdit(() => $replaceDetectSpanWithText(span, clean), Co)`，`Co = "paste"`。
- **`DraftEditorRuntime.paste`**（注释 idx≈6614 区段）说明了设计意图：「PASTE_TAG makes the paste its own history boundary, so one undo never removes both the paste and typing inside the merge window.」
- **`SessionInputShell.actions`**（idx≈6621143，即插件拿到的 `inputActions`）：
  - `captureInsertion()` → `{ ...caretSpan(), draftRev: this.rev }`；
  - `insertText(text, span)`：phase 为 adjudicating/submitting/disposed 或 `span.draftRev !== this.rev` 时返回 `false`，否则 `draftEditor.insertAsyncText(span, text)`；
  - `setDraft(text)` → `this.setDraft(text)`（整框、history-merge）；
  - 公开面无「指定光标/选区写入」API（#178 调研已确认）。
- **`caretSpan()`**：`projection.selection !== null` 就用它；否则回 `{ start: detectText.length, end: detectText.length }`（文末折叠）。`$projectComposer`（idx≈6600999）里 `selection` = 当前 `RangeSelection` 折成 detect 坐标的 range —— **折叠光标也算**。⇒ `insertText` 不只能写文末，也能写当前光标处/选区（前提是 projection 新鲜）；插件现在正是用它删标记（中间位置实测 3/3 光标落点正确）。
- **内联 @lexical/history**（同一 bundle）：
  - change-type 判定 `E(...)`（idx≈6564xxx）：0=OTHER、1=composing、2=插入、3=删除、4=替换；
  - merge-action getter `D(...)`（idx≈6566524）返回值：**0 = MERGE（并入 current）、1 = PUSH（把 current 压入 undoStack，再以新状态为 current）、2 = SKIP（不记）**；关键分支：
    - `if (!isPush && sameEditor && tags.has("history-merge")) return 0` —— **无时间窗口，setDraft 无条件并入 current**；
    - `paste`/`cut` 被强制 change-type 0 ⇒ 走不到 merge 窗口分支 ⇒ 返回 1（PUSH）⇒ 独立撤销步；
    - 合并窗口内同型输入（`m === prevChangeType && now < prevChangeTime + delay`）⇒ 0（连续键入并成一条）。
  - 消费方 `O(...)`（idx≈6567478）：`if (1 === g) undoStack.push({...current})`；`else if (2 === g) return`；`current = { editor, editorState: n }`。撤销 = `undoStack.pop()` 的 editorState 回放（tag `historic`）。
  - **推论**：任何带 `history-merge` 的写入（含所有 `setDraft`）都不新增撤销步，它改写 current；撤销时能回到的「上一格」是 current 被压栈时的旧快照。

## 2. 由源码推出的撤销栈轨迹（与真机 3/3 一致）

场景：空草稿 → 输入 `abc` → 面板插入 `SMART{{cursor}}END`（插件执行 setDraft(含标记) → captureInsertion → insertText('', 标记 span)）。

1. 输入 `abc`：首次输入 PUSH（undoStack = [C0 空草稿]），后续字符在 merge 窗口并入 current = C1(`abc`)。
2. `setDraft("abcSMART{{cursor}}END")`：history-merge ⇒ 并入 current（C1 → C2 带标记全文），**undoStack 不变**。
3. `insertText('', {markerAt, markerAt+10})`：paste ⇒ PUSH，undoStack = [C0, C2]，current = C3（最终文本 `abcSMARTEND`，caret=8）。
4. undo1 = 回放 C2 ⇒ `abcSMART{{cursor}}END`（标记重现，文档已写，符合预期）。
5. undo2 = 回放 **C0** ⇒ 空草稿 —— 用户敲的 `abc` 一起消失。

旁证：草稿本来为空时，C0 之后没有「输入记录」，`setDraft` 只并入 current ⇒ 插入后一次撤销**无效**（旧 12-check 脚本 `D:\Temp\cdp\phase178-undo.mjs` 的 C2：plain 插入 `NOMARK` 后 undo 文本仍是 `NOMARK`；该脚本 A3 的期望值与后续 findings 不一致，只作旁证）。

## 3. 插件侧现状（本仓）

- `src/client/template-browser.ts:669-703` `applyInsert`：
  - 无标记：`:676-679` 单次 `inputActions.setDraft(finalText)`；
  - 有标记且 `captureInsertion`+`insertText` 可用、草稿无引用 chip：`:687-699` `setDraft(withMarker)` → `captureInsertion()` → `insertText('', { draftRev, start: markerAt, end: markerAt + CURSOR_MARKER.length })`；
  - 任一环失败/无 chip 能力：`:700-702` 降级整框 `setDraft(finalText)`；
  - `:665` 的注释只写「undo 第一下会先看到标记回到正文，再 undo 才撤插入」—— 没写第二次会连带撤掉插入前编辑。
- `src/client/template-browser.ts:708-720` `insertBody`：`resolveDraft()` 取草稿与落点 → `applyInsert` → `setTimeout(focusComposer, 0)`（#180 的另一条线）。
- 文档现状：`README.md:118` 与 `docs/README.en.md:117` 只写「再按一次才撤销插入 / a second undo removes the insertion」；`docs/adr/0010-template-body-linebreaks-and-cursor-marker.md:36`（已知代价）同样只写第一次撤销可能露出标记。三者都没写「第二次撤销会连带撤掉插入前的草稿」。
- #178 验收契约：最终方案 Agent Brief 的 Desired behavior 明确要求「第二次撤销回到插入前；该宿主限制要在用户文档写明」——现状违反该条，所以「只写文档」不是补文档，而是**改验收**。

## 4. 候选修法（未真机验证，只列可行性与风险，不做选型终裁）

### A. 纯 paste 两编辑（把第一笔 setDraft 换成 insertText）

- 步骤：`cap1 = captureInsertion()`（要求 `cap1.start === cap1.end === 插件解析的落点`）→ `insertText(正文含标记, cap1)` → `cap2 = captureInsertion()` → `insertText('', 标记 span, cap2.draftRev)`。
- 撤销栈：输入 `abc`（undoStack=[C0]）→ 插入（PUSH ⇒ [C0, C1(abc)]）→ 删标记（PUSH ⇒ [C0, C1, C2(含标记)]）⇒ undo1 回标记、undo2 回 `abc`、undo3 回空。符合 #178 验收。
- 优点：只用宿主已公开 action；两笔都是 paste 语义；不再依赖 `setDraft` 的合并行为；空草稿也修（插入成为可撤销步）。
- 需真机验证的点：① 中间光标与失焦态下 `captureInsertion` 的 detect 坐标是否等于 `resolveDraft` 的落点（#180 同一条易碎面；不等就降级旧路径）；② 正文含换行时 `insertText` 写的是**文本节点裸 \n**，而 `setDraft` 是**按段切**——提交文本、持久化-重载、选区/撤销快照是否等价（/prompt 管线本来就走宿主 insertText，可作旁证）；③ 非折叠选择时 `captureInsertion` 返回的是选择区间，直接 `insertText` 会**替换选区**（与现行「按落点插入不覆盖」语义不同）⇒ 必须只在折叠且坐标一致时启用；④ chip（`CHIP_RE`）继续降级。
- 回归影响：`scripts/repro/test-issue-178.cjs` 的 K9/M9 断言「有标记 = setDraft+captureInsertion+insertText 三次交互」要随实现改；`pick.insert` 日志口径不变。

### B. 假 paste 边界 + 保留 setDraft

- 步骤：先做一笔「瞬时的 paste 编辑」（任一非空 `insertText`，内容随后被 setDraft 覆盖）把 current 顶成新记录，再走现有 `setDraft`；setDraft 的 history-merge 就会并入这笔假边界，而不是并入用户输入。
- 撤销栈：输入 `abc`（[C0]）→ 假 paste（PUSH ⇒ [C0, C1(abc)]）→ setDraft（并入假记录）→ 删标记（PUSH ⇒ [C0, C1, C3]）⇒ undo1 标记、undo2 `abc`、undo3 空。同样修好。
- 风险：瞬时的「假边界」会多一次草稿变更（draft-changed 事件、自动持久化、渲染闪烁都需要真机确认）；瞬态文本不能为空（空替换可能不产生记录）；setDraft 的「文本未变即 return」短路要防（选一个不可能与终稿相等的瞬态文本）。

### C. 上游 DSH 加 API

- `setDraft(text, { history: "independent" })` 或 `insertText(text, span, { caret })` / 可分组写入。最干净，但需 DSH 改版 + 版本门槛（本仓 engines `dsh >=0.2.0-rc.2`，旧宿主仍要降级）。可作为独立上游需求，不阻塞 A/B。

### D. 只写文档（票面「期望 2」）

- README 中英 + ADR-0010 如实写「第二次撤销可能连带撤掉插入前最近一次编辑」并给安全建议。代价：#178 验收口径要同步改；无标记路径的同类行为仍会存在。

## 5. 无标记路径：同根因，另算

- 无标记插入（`template-browser.ts:676-679`）是单次 `setDraft`：草稿非空时撤销会并掉插入前的输入；草稿为空时不产生任何撤销记录（第 2 节旁证）。这是同一根因的另一面，但票面只覆盖 marker 路径；是否纳入本票需维护者定（#181 Q3）。

## 6. 回归缺口

- `scripts/repro/test-issue-178.cjs`（`npm run check:issue-178`，477 断言）**全绿**，但全部 mock 宿主 action，撤销分组语义完全没有被门禁覆盖；本票即使修了行为，mock 回归也只能钉「调用序列」，真正的 undo 序列必须真机复验。
- 仓内没有浏览器/真机回归；#178 的真机脚本都在仓外 `D:\Temp\cdp\`（`phase178-findings.mjs`、`phase178-undo.mjs`，均用 headless Edge + CDP）。

## 7. 证据路径

- 本仓：`src/client/template-browser.ts:669-703`（applyInsert）、`:708-720`（insertBody）、`:676-679`（无标记单次 setDraft）、`:687-699`（两编辑）、`:665`（注释）；`docs/adr/0010-template-body-linebreaks-and-cursor-marker.md:36,52`；`README.md:118`；`docs/README.en.md:117`；`scripts/repro/test-issue-178.cjs`（K9/M9 调用序列断言）；`research/template-escape-caret/findings.md` §2 §4。
- 宿主 bundle：`D:\Temp\dsh-assets\asset-03.js` —— `setDraft`（idx≈6611329 注释 / 实现）、`insertAsyncText`（idx≈6614078 注释 / 6614299 函数）、`SessionInputShell.actions`（idx≈6621143）、`$projectComposer`（idx≈6600999）、Lexical history `E/D/O`（idx≈6564xxx / 6566524 / 6567478）、`history-merge/paste` 标签表（idx≈6374738）。
- 真机证据（#178 验收会话落盘，本轮未重跑）：`D:\Temp\cdp\phase178-findings.json`（undo 3/3：`abcSMARTEND` caret=8 → undo1 `abcSMART{{cursor}}END` → undo2 `""` → undo3 `""`，`undo2BackToTyped:false`）、`D:\Temp\cdp\phase178-undo-results.json`（A3/B3/C2/D3 FAIL）、`D:\Temp\cdp\phase178-undo-r.json`、截图 `D:\Temp\cdp\finding178-undo-overundo.png`、12-check 脚本 `D:\Temp\cdp\phase178-undo.mjs`。

## 8. 状态

- 只读调研（截至诊断阶段），未改业务代码、未提交、未 close 票；本笔记由 /triage 生成。2026-10-29 维护者拍板后，#181 已转 `ready-for-agent`；§9 记录决策。

## 9. 决策记录（2026-10-29）

维护者拍板「按照推荐来」（第一性原理推荐，未要求逐条 Grilling）。落点：

- **出口**：修行为，拒绝只写文档；文档出口仅在真机判定 A、B 都不可行时启用，且必须同步改 #178 验收口径。
- **路线**：A 纯 paste 两编辑为主 —— `captureInsertion()` 折叠光标 → `insertText(正文含标记)` → `captureInsertion()` → `insertText(空串, 标记 span)`；`setDraft` 只保留在降级阶梯（chip / 旧宿主 / 原语失败 / 坐标不一致 / 占位符）。B（假 paste 边界）仅作 A 失败回退；C（上游 API）记录跟进、不阻塞；D 拒绝。
- **范围**：同票一并修无标记路径（`template-browser.ts:676-679` 单笔 `insertText`），显式接受「中间插入时光标落在插入文本之后」这一契约改进。
- **验收/门禁**：真机 undo/redo/submit/persist 为硬验收；mock 回归加不变量「非降级路径不得调用 `setDraft`」；真机脚本进仓 `scripts/repro/real/` 作手动工具（零新依赖，不进 CI）。
- **保留代价**：`{{cursor}}` 模板 undo1 仍可能先露出标记（宿主无光标写入 API）；`README.md:118` / `docs/README.en.md:117` 与 ADR-0010:36 现有措辞不变。

已落：票 181 标签 `bug` + `ready-for-agent`（移除 `needs-triage`）；Agent Brief 评论（含 Step 0 真机判定树、验收表、回退条件）。Brief 链接：https://github.com/FeatherHunter/dsh-prompt/issues/181#issuecomment-6481646686

## 10. 实施记录（/implement，2026-10-29）

落点：分支 `feat/181-undo-grouping`（基于 `d64381b`，即 #180 修复之上），两个提交 —— 代码+回归一个、ADR/README 一个。

### 10.1 代码

`src/client/template-browser.ts` 的 `applyInsert`（宿主写入唯一收口，面板 onPick 与智能卡 smartInsert 都经过它）：

- **有标记（主路径，A 路线）**：先算 `markerBody = 正文前半 + {{cursor}} + 正文后半`；`captureInsertion()` 校验「rev 为数字、start === end === 落点 pos」（落点一致性守卫，坐标不可信就不插）→ `insertText(markerBody, { draftRev, start: pos, end: pos })` → 再 `captureInsertion()` 取新 rev → `insertText('', { draftRev, start: markerAt, end: markerAt + 10 })` 删标记。两笔都是 paste 记录 ⇒ undo1 露标记、undo2 回插入前草稿。
- **无标记**：同一守卫通过后单笔 `insertText(parsed.text, { draftRev, start: pos, end: pos })`；undo1 直接回插入前草稿；光标落在插入文本之后（#181 显式接受的契约变更）。
- **降级**：旧宿主缺 action / 草稿含引用 chip / 坐标不一致 / 非折叠 / `insertText` 返回 false 或抛错 → 整框 `setDraft(finalText)`、`mode='degraded'`、光标置尾；文本永远逐字符正确。
- **#180 × #181 的交叉点（顺序别对调）**：`canEdit` 时**先在失焦态**读一次 `captureInsertion`，然后才 focus、才写。理由：#180 实测对未聚焦 contenteditable 调 `focus()` 会把浏览器 caret 放回 0、模型选择跟着变 0；先 focus 再 capture 会让守卫永远失败、失焦插入全部降级成光标置尾（#180 回归）。
- **失焦且模型选择已丢时的兜底**（#180 真机场景：焦点在别处、只剩编辑期采样落点，`captureInsertion` 的 detect 坐标对不上）：退回 #178 v1 的「整框写入 + 删标记」落位以保住 #180 的光标验收，但**先做一笔瞬时 paste 编辑** `insertText('x', { draftRev, start: 0, end: 0 })` 把历史边界顶开（#181 修法 B 的有意负债）——随后的 `setDraft` 被 history-merge 并进这条假记录而不是用户输入那条，undo 仍能分两步（undo1 撤删标记露标记、undo2 回插入前草稿）。瞬时文本在随即的整框写入里被覆盖，用户不可见；用非空文本是为了绕开宿主 `setDraft`「文本未变即 return」的短路。
- 不变量：**非降级路径（`mode = span | plain`）不得调用 `setDraft`**；`applyInsert` 里 `inputActions.setDraft(` 恰好三处（无标记降级、有标记降级、失焦兜底），由 `check:issue-181` 的 F 组源码断言钉住。

### 10.2 回归与门禁

- `scripts/repro/test-issue-178.cjs`：契约版本 3（R1 + R2 + #180 失焦焦点次序 + #181 撤销分组）；span 路径断言改为「两笔 insertText + 两次 captureInsertion」；无标记断言单笔 insertText、不调用 setDraft；`#180` 的失焦用例适配新调用序列（K21–K23）并补 N13（失焦兜底序列）。**ALL PASS: #178 (662 assertions)**。
- `scripts/check-issue-181.mjs`（新建，挂进 `npm run check`）：自带 Lexical history 分组状态机的假宿主，覆盖 A 有标记 undo/redo 全序列、B 无标记 undo/redo、C 降级矩阵 20 例、D 无写入能力 13 例、E insertBody 集成、F 源码不变量、G 失焦兜底（含对照：已聚焦但落点对不上 ⇒ 直接降级、不猜位置）。**ALL PASS: #181 (495 assertions)**。
- `npm run typecheck`（tsc + tsc -p tsconfig.host.json）全绿；`npm run check:lib-sync` PASS（lib/client.js、lib/update.js、事件目录都与重建一致）。
- `npm run check` 全量：除 `check:marketplace-readme` 外全绿。该条在 HEAD 上就红、与本票无关（README 两页的联系二维码 <img> 未登记 screenshots.json、CONNECT 章节用原始 <h2>；主工作区跑同一脚本同样失败），不在本票范围。
- 真机回归脚本 `scripts/repro/real/issue-181-real.mjs`（手动工具，零新依赖，不进 CI）与真机结果见 §11。

### 10.3 有意负债与移除条件

- 失焦兜底路径仍用了 `setDraft`，并多一笔不可见的瞬时 paste 编辑（宿主内部会多一次草稿变更/可能触发 draft-changed 与持久化）——只在「宿主有 composer 根、当前失焦、且模型选择已丢」这一支触发；模型选择仍在时走纯 paste 两编辑，不碰 `setDraft`。
- 移除条件：上游 DSH 补 `setDraft` 的 history 选项、或 `insertText` 带光标参数/撤销分组能力后，兜底可整体删掉，只留 A 路线（ADR-0010 §3 已记）。

### 10.4 文档

- `docs/adr/0010-template-body-linebreaks-and-cursor-marker.md`：状态行加 #181 修订；§2 落位手法升级 v2；降级阶梯补「非折叠 / 坐标不一致」与 `mode=degraded`；新增 §3「用户意图写入必须走可撤销编辑原语，setDraft 只做 seed 与降级」（宿主源码事实、undo 序列、不变量、A/B/C/D 取舍与移除条件、Step 0 判定项）；原「已知代价」改 §4 并补第二次撤销口径；「考虑过的选项」补 B 条；「后果」补降级与门禁。
- `README.md:118` / `docs/README.en.md:117`：只改无标记插入的光标口径（「落在插入内容的末尾，与旧版一致」→「落在插入文本之后」）；undo 那句话保持原文（修好后字面为真）。
- `src/client/template-library.ts:442-444` 注释同步新口径。

## 11. 真机验收结果（2026-10-29，A 路线可行）

隔离环境：独立 `DSH_HOME` + 新建 `web181` profile + headless Edge（CDP 9231），不碰桌面实例与 #180 会话。被测 build = 工作树最终 `lib/client.js`（sha256 `2feb3efce58cfde593f7cb044491cc90b3ff7a672763d3a6940393d89c9571e2`，864270 B）；pack-181b 的 tgz 内 lib 是注释定稿前的旧 build，真机按最新 lib 覆盖安装后测得，二者行为一致（差异仅注释）。

- **终跑 v3：58/58 checks PASS，0 fail，2 unreachable；9/9 验收组 PASS；Step 0 verdict PASS。**
- 分组：Step 0 8 项、A1 10、A2 5、A3 4、A4 4、A5 3、A6 7、A7 7、B1 6、B2 4。
- **Step 0(i) 坐标一致性 PASS**：聚焦态下 `captureInsertion()` 的 detect 坐标与 `resolveDraft()` 落点全等（末尾 `{3,3}`、中间 `{1,1}`、多行草稿 `AA\nBB` 的 caret 0/1/2/3/5 逐一相等）⇒ 落点守卫不误拦，A 路线主路径在真机成立。
- **Step 0(ii) 多行等价 PASS**：多行正文经 `insertText` 上屏后，提交消息 `第一行第二行\n第三行`（真实换行、标记剥净），重载后草稿与预期一致；与 `setDraft` 按段切的初始 DOM 结构不同（单 `<p>` 软换行 vs 多 `<p>`），但提交/重载归一化后文本等价。
- **Step 0(iii) undo/redo 序列 PASS**：有标记（末尾/中间光标）插入 → `undo1` 标记重现、`undo2` 回插入前草稿、`undo3` 更早/空，`Ctrl+Y` 与 `Ctrl+Shift+Z` 均可逐步 redo；无标记插入 `undo1` 直接回插入前草稿（含空草稿 `undo1` 回空）；失焦场景 undo 分组同样两步成立。
- **Step 0(iv) 降级支路 PASS**：`insertText` 返回 false / 坐标不一致 / 旧宿主无 `captureInsertion` → `setDraft` 降级、文本逐字符正确、无标记残留、不抛。
- **失焦落点非回归**：旧包 0.4.39（#178 真机基线）同流程实测 `text=SMARTENDabc, caret=5`，与新版完全一致 —— 失焦后插入落草稿开头是既有 #76 采样语义（浏览器 selection 丢失 → `resolveDraft` 落点 0），不是 #181 引入，不在本票范围。
- 未验证（2 项）：chip 草稿降级（真机无公开构造入口，回归用 mock 覆盖）、重开会话（用页面重载覆盖持久化路径）。
- 证据：`D:/Temp/cdp181/issue-181-real-v3.json`（v3 全量）、`D:/Temp/cdp181/issue-181-verdict.json`（builds/sha 与 v1/v2/v2b/v3 对比）、`D:/Temp/cdp181/shots-v3/*.png`（10 张）、旧包对照 `D:/Temp/cdp181/oldpack-b1b2.json`。可复跑脚本已收进仓 `scripts/repro/real/issue-181-real.mjs`（零依赖、手动、不进 CI；用法见文件头）。

