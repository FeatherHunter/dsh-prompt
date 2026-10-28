# Issue #178 调研：模板正文转义与「光标回标记位」（事实清单）

- Issue：#178「对转义符的支持」（外部报告者 kBlankii）
- 日期：2026-10-28；方法：只读，只认一手来源（本仓源码、本机已装 DSH 0.2.1-rc.3 的 app.asar 内 `@deepseek-ai/dsh-client-ui-conversation` 抽取源码、`input-trigger` 0.2.1-rc.3 抽取源码）；不改业务代码、不提交、不 close。
- 范围：① 模板正文里 `\n` 等转义的落点；②「插入后光标回到模板中标记位」的宿主能力边界。只做事实与可行性，不做实现选型终裁（列候选与风险，选型留给实施票/维护者）。
- 宿主版本前提：本机安装 `@deepseek-ai/dsh-desktop` 0.2.1-rc.3（app.asar 内 conversation 包同版本，内含 Lexical 0.49）；本仓 `package.json` engines 为 `dsh >=0.2.0-rc.2`，故任何依赖宿主 action 的做法都要运行时 feature-detect + 旧版降级。旧版宿主源码不在本机，无法核对 `insertText`/`captureInsertion` 的引入版本。

## 0. 请求拆解

- **R1 换行**：正文里写 `\n`，期望插入后是换行，而不是紧跟提示词/光标处。
- **R2 光标标记**：正文里放「某种特殊转义符」，插入后光标停在该符号位置（文本里不留符号）。等价于「插入文本后设置光标位置」。
- 两请求正交：R1 改文本内容，R2 改光标位置；可以分别交付。
- R2 与既有「智能卡插入后光标定位首字段冒号后」（DEC11）语义相近，但后者依赖 textarea，现行宿主已失效（见 §1）。

## 1. 现状与冗余检查（是否已实现）

- **R1 未实现**：全仓无转义解码层（`grep '\\n' src/client` 零命中；无 escape/unescape 函数）。插入正文原样拼接后整框写回（`src/client/template-browser.ts:571-588`：`newDraft = draft.slice(0,pos) + body + draft.slice(pos); inputActions.setDraft(newDraft)`）。
- **真换行本身可用**：预制模板正文用数组 `join('\n')`（`src/client/templates.ts`）；正文编辑弹窗是多行 `textarea`（`template-browser.ts:1123`），中间的空行/换行保存后原样落库（`template-library.ts:500-553` 只写 body，不 trim）；插入时真换行也保真（`scripts/repro/test-issue-76.cjs` 22 个用例全绿，覆盖空行、尾部空行、光标处注入）。
- **R1 的真实卡点**：保存时 `const bd = body.trim()`（`template-browser.ts:1016`）会把**首尾**空白/换行删掉；再加上用户若用字面 `\n` 书写（粘贴/手机端/习惯），插入链路不做解码。
- **R2 未实现**：面板/智能卡插入后光标由宿主决定——`insertBody` 注释明言「宿主 setDraft 语义是全文替换且光标置尾（无光标级写入 API）」（`template-browser.ts:571-574`）。
- **智能卡 DEC11 在现行宿主失效**：`smartInsert` 靠 `document.querySelectorAll('textarea')` 找 `selectionStart`，再 `setSelectionRange`（`smart-card.ts:132-143,145-173`；`smart-score.ts:114-118` 的 `firstFieldCaret` 取首个「：」后）；宿主 composer 是 Lexical contenteditable、没有 textarea（`template-browser.ts:117-126` 的 #61 根因注释 + 宿主 bundle 内 Lexical 0.49）。源码级结论，未真机打点。
- **`/prompt` 斜杠管线**：插件只返回 `{ text: tpl.body }`（`src/client/prompt-trigger.ts` 全文），宿主替换触发 span（宿主 `client.js:15864` → `SessionInputShell.insertText:15383-15386` → `draftEditor.replaceText:14759-14765`）。插件拿不到替换后的光标，也没有二次动作机会（`onPick` 同步返回）。
- **插件自有输入框只有远程 Sheet**：`remote-sheet.ts:195-223` 是受控 textarea，光标完全可控；但它只是宿主草稿的镜像（去抖写回 `setDraft`），模板插入仍走宿主，不能作为 R2 的通用解。
- **冗余检查的搜索范围**：`src/client/` 全量 grep `\\n` / `escape` / `unescape` / `setSelection` / `insertText` / `caret`；`research/` 21 个子目录；`git log --all --grep=178`、全部分支名、`git status`；`.out-of-scope/`（不存在）。
- **既有笔记不回答本问题**：`research/input-slot-constraints/findings.md` 只到输入条插槽收缩/面板定位（#63）；`research/cache-and-labels/findings.md:127` 只记录「智能卡插入后定位首个冒号后」的旧设计，不涉及宿主 0.2.1-rc.3 的 InputActions 与光标能力。故按 /research 规则新查一次并落本笔记。
- **历史相关票**（均已关闭，未覆盖本请求）：#61 插入覆盖/光标处注入、#76 插入吞尾部空行、#33 插入覆盖已有内容、#9 `/prompt` 触发源、#119 输入框草稿双向同步调研。无 #178 相关分支/提交/半成品。

## 2. 宿主公开插入面（0.2.1-rc.3，抽取源码）

`SessionInputShell.actions`（`.dsh-tmp/hostconv/client.js:14941-14967`）对外只有：

- `captureInsertion(): { start, end, draftRev }`——取当前 draft 选择（`caretSpan`，`:14745-14752`：有选择就返回选择，否则返回文末折叠 span）与当前修订号。
- `insertText(text, span): boolean`——在 detect 坐标 span 处做一次可撤销纯文本替换；`span.draftRev !== 当前 rev` 或 phase 为 adjudicating/submitting/disposed 时返回 `false`；光标落在插入文本之后（`$replaceDetectSpanWithText`，`:14515-14528`，注释 "The caret lands after the insertion."）。
- `setDraft(text)`——整框替换：清 root、按 `\n` 切段（空行=空段）、光标 `root.selectEnd()`（`DraftEditorRuntime.setDraft`，`:14686-14696`；`$appendParagraphs`，`:14556-14564`）；合并进历史，不算独立可撤销步。
- `persistDraft() / addAttachments / removeAttachment / pruneAttachments / submit()`。
- **没有 `setCaret` / `setSelection` / 「插入后指定光标」API**（全 bundle grep `setSelection|setCaret|moveCaret|placeCaret` 只命中宿主内部 `focusDraftEditor(editor, revealSelection)`，`:18482`，那是焦点恢复不是定位）。
- README 原文（`README.md:167`）："`InputActions.captureInsertion()` captures the draft selection and revision; `insertText(text, span)` inserts one undoable plain-text edit only while that revision is current and the editor permits editing."；另 `README.md:99` 说明 `SessionInput.focus()` 只把光标还回草稿上次位置，不能指定位置。
- `insertText` 的换行行为：Lexical `RangeSelection.insertText` 最终走 `TextNode.spliceText`，把字符串直接塞进文本节点（bundle `:7803-7813`）；`\n` 是文本节点内的裸换行。编辑器 root 设了 `whiteSpace: 'pre-wrap'`（`:10539`），视觉上会断行，但与 `setDraft` 的「按段切」是两种模型（提交/撤销/选区同步差异未真机验证）。
- `insertText` 的坐标是宿主 **detect 坐标**：`$projectComposer`（`:14406-14443`）把引用 chip 归并成占位符（`REFERENCE_PLACEHOLDER_RE = /[\uE100-\uE11D\uFFFC]/gu`，`:14550`），与插件读到的 visible 文本坐标可能不一致；插件 #61/#76 已为「chip 存在时信桥草稿、光标回尾」建过策略（`resolveDraft`，`template-browser.ts:482-564`）。

## 3. R1 的两个落点（事实 + 风险）

- **落点 A：插入期解码**（`decode(body)` 后再走现管线）。
  - 优点：面板/智能卡/`/prompt` 三条出栈文本共用一处；不改编辑/存储。
  - 风险：对**存量**正文里本就要字面反斜杠+n 的内容（Windows 路径 `C:\new`、正则 `/\n/`、代码片段）会不可逆误伤；定义 `\\` 只能保护「今后按新语法书写」的数据，保护不了存量。与本仓既有「用户数据逐字节不变」原则（ADR-0007 的同类价值观）冲突。
- **落点 B：保存期编解码**（编辑弹窗保存时把字面 `\n` 落成真换行、字面 `\\n` 落成字面反斜杠；打开时做逆编码保证往返幂等）。
  - 优点：存量数据零改动；插入管线零改动；落库就是真换行，任何读取面（简介、搜索、复制、`/prompt`）都自然正确。
  - 代价：只在「经弹窗保存」的路径生效（代码/存储直写不保证）；编辑框里字面 `\\n` 的显示形态会变（需要 hint/预览）；用户要理解「弹窗里打的 `\n` 保存后变真换行」。
- 语义候选（待维护者拍板）：只认 `\n` + `\\`，其余 `\x` 原样；不建议 `\t`（与 Windows 路径/正则冲突面更大）。是否为老用户提供一次性迁移（把存量字面 `\n` 转真换行）应单列，默认不做。

## 4. R2 的三类做法（事实 + 边界）

- **(a) 插件侧多次编辑把光标留在标记处**（不新增宿主 API）：
  - 思路：最后一次编辑必须是「在标记位置结束的非空插入」——例：`setDraft(head)` → `captureInsertion()` 得 rev → `insertText(post+tail, span)` → 再取新 rev、用同一 `start` 构造折叠 span → `insertText(pre, span2)`；最终文本 `head+pre+post+tail`，光标在 `head+pre` 后（=标记位）。`span` 的绝对位置来自宿主 `captureInsertion()`，不需要插件自己算 detect 坐标，chip 存在时也成立。
  - 已知限制：① 标记在插入点最前（前缀为空）时无解——最后一次编辑必须插入非空文本才能移动光标，只能降级为光标置尾；② 最后一次插入里的换行会变成文本节点裸 `\n`（视觉可断行，模型与 `setDraft` 不同）；③ 多次 `insertText` 各算一条独立 undo（`setDraft` 合并进历史），撤销体验会变；④ `insertText` 有 phase/rev 守卫，任一步返回 `false` 需兜底整框 `setDraft`（光标置尾）；⑤ 临时中间态（`setDraft(head)` 会瞬态清掉 tail）只在同一同步任务内存在，但若宿主在该步触发持久化/渲染，需真机确认无闪烁；⑥ 插件此前已有「点击面板后宿主 selection 新鲜度」易碎面（#61/#76 的 H/D 兜底），`captureInsertion()` 返回的 span 在「键盘/搜索框导航后插入」时是否仍等于插件解析的插入点**未真机验证**。
- **(b) 上游宿主加 API**（如 `insertText(text, span, { caret })` 或 `setSelection(span)`）：最干净，但需 DSH 侧改动 + 版本门槛；本仓 engines `>=0.2.0-rc.2`，旧宿主降级。
- **(c) 不实现光标**：只解码文本，光标按现状置尾；文档说明。最简单，但不满足 R2。
- **管线覆盖**：`/prompt` 斜杠管线在 (a) 下**也做不到**——插件只返回文本，宿主负责替换且插件无二次动作；R2 只可能覆盖面板/智能卡管线（或 (b) 全局生效）。
- **可行性判断**：宿主 API 面足以表达 (a)（`captureInsertion` + `insertText` 均公开、有 rev CAS），但**未真机验证**；仓内无浏览器自动化，只有 React 渲染级回归（`react-test-renderer`），无法模拟 Lexical 真机选择模型。建议单开 spike 票真机打点后再定实施。

## 5. 全场景影响面（改 R1/R2 会碰到的面）

- 插入入口：面板悬浮列表（`insertBody`）、智能卡（`smartInsert`）、`/prompt` 斜杠触发（`prompt-trigger.ts`）、复制预制为自定义（`copyPresetToCustom` 直接复制 body）、设置页行简介（`body.split('\n')[0]`）与复制按钮（`navigator.clipboard.writeText` 写 body 原文）。
- 读侧：列表简介首行、搜索 haystack（`templateHaystack`）、`/prompt` 候选 description（`body.replace(/\s+/g,' ').slice(0,42)`）。若 R1 落点 B，读侧自然看到真换行；落点 A 则读侧仍看到字面 `\n`，只有插入瞬间变。
- 编辑 UI：正文 textarea、保存 trim、`MAX_BODY=10000`（解码后长度可能变）、转义语法 hint/预览。
- 存储/兼容：host 存储 body 原样（`template-library.ts:164-171` 的 `toHostShape` 只删旧字段、不改 body）；R1 落点 A 会让存量正文语义变化，与 ADR-0007 的「存量逐字节不变」价值观冲突。
- 日志/用量：`pick.insert` 只记 `draftChars/caret/draftLines` 等统计（`template-browser.ts:590-608`），解码后长度变化不影响契约。
- 测试面：需新增解码回归与（若做）光标降级路径回归；仓内 8 个旧回归脚本各自手抄「转译哪些模块 + 改哪些 require」表（`template-browser.ts:42`、`template-library.ts:21-22` 注释），新增模块/import 边会打红旧脚本，成本要计入实施票。
- 版本兼容：`insertText`/`captureInsertion` 需 feature-detect；`PICK_ACT_NAMES` 探针（`template-browser.ts:2361-2396`）已把 `insertText` 是否存在记进 `actMask` 日志，可直接复用。

## 6. 负向发现

- 未找到宿主任何光标/选区写入 API；README 的 InputActions 说明也只到 `captureInsertion`/`insertText`/`setDraft`。
- 未找到宿主官方 slot/InputActions 文档；以上宿主事实来自 app.asar 抽取源码（0.2.1-rc.3），`insertText` 引入版本未知。
- 未真机验证：点击面板/键盘导航后 `captureInsertion()` 的 span 是否仍等于插件解析的插入点；(a) 路线光标最终落点；`insertText` 裸 `\n` 的提交/渲染/撤销表现。
- 无 `.out-of-scope/` 目录，无既往拒绝记录可引；无 #178 相关实现/分支/提交。

## 7. 证据路径

- 本仓：`src/client/template-browser.ts:482-564`（resolveDraft）、`:571-588`（insertBody）、`:590-608`（onPick/log）、`:1015-1022`（保存 trim）、`:1123`（正文 textarea）、`:117-126`（#61 根因注释）、`:2361-2396`（actMask 探针）、`:459-480`（keepComposerFocus）；`src/client/prompt-trigger.ts`（全文）；`src/client/smart-card.ts:132-143,145-173,286`；`src/client/smart-score.ts:114-118`；`src/client/template-library.ts:29,164-171,500-553`；`src/client/templates.ts`（join('\n')）；`src/client/remote-sheet.ts:165,195-223`；`scripts/repro/test-issue-76.cjs`（真换行回归全绿）；`scripts/repro/test-issue-61.cjs`（插入位置回归全绿）。
- 宿主/触发源抽取：`.dsh-tmp/hostconv/client.js:14406-14443`（$projectComposer）、`:14456-14496`（resolvePoint）、`:14503-14536`（selectSpan/$replaceDetectSpanWithText）、`:14556-14564`（$appendParagraphs）、`:14686-14717`（setDraft/appendDraft）、`:14745-14790`（caretSpan/replaceText/insertAsyncText）、`:14941-14967`（SessionInputShell.actions）、`:15016-15048`（onEditorUpdate/setDraft）、`:15383-15386`（slash 路径 insertText）、`:15787-15883`（slash 事件接线与 shell 创建）、`:18482`（focusDraftEditor）、`:18928-19255`（InputBar/renderSlot）、`:19897-19913`（uiSession.provide props inputActions）、`:20077-20159`（composer bar 子槽声明/inject）、`:7803-7813`（TextNode.spliceText）、`:10539`（root white-space:pre-wrap）；`.dsh-tmp/hostconv/README.md:79,99,167`；`.dsh-tmp/trigger/lib-client.js:1364-1380`（execute → slash/input-insert-text）、`:1459-1473`（settle 调 onPick）；安装版本：`D:\DeepseekHarness\resources\app.asar` 内 `@deepseek-ai/dsh-desktop` 0.2.1-rc.3。

## 8. 维护者已拍板（2026-10-29）

- 结论：§3/§4 的候选收口为一个方案 —— **R1 不做 `\n` 转义语言，只放宽保存 trim；R2 用 `{{cursor}}` 标记 + 宿主两编辑（setDraft → captureInsertion → insertText('') 删除标记），任何一环不可用即降级**。
- R1：保存只去首尾空格/tab、保留所有换行（含首尾空行）；显示/检索/`/prompt` 剥标记并处理空首行；新增一条 ADR 记录「能力优先、不引入反斜杠转义语言」。
- R2：先 `setDraft(全文含 {{cursor}})`（标记插在目标位、长 10 字符），`captureInsertion()` 取新 `draftRev`，再 `insertText('', { start: markerAt, end: markerAt + 10, draftRev })`；Lexical `removeText` 删除后光标塌缩在删除区间起点（§2 证据链），故光标落在标记处、标记消失。§4(a) 的「前缀为空无解」限制被删除式两编辑绕开，不再适用。
- 降级阶梯：无标记 → 现状（单编辑、光标尾）；草稿含引用 chip → 剥标记 + 整框 setDraft、光标尾；旧宿主缺 action / `insertText` 返回 false / 抛错 → 同上。`/prompt` 只剥标记、不定位。
- 已知代价：插入后第一次撤销可能恢复标记文本（两次编辑结构），文档写明；字面 `{{cursor}}` 文本暂不支持表达。
- 票面：`enhancement` + `ready-for-agent`；Agent Brief 见 https://github.com/FeatherHunter/dsh-prompt/issues/178 最新评论。本笔记 §3/§4 保留为决策前的候选与风险记录，不再作为实施建议。
