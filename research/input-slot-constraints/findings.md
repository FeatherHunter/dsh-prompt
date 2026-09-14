# Issue #63 调研：输入条宿主插槽能力与收缩约束（事实清单）

- Issue：#63「输入条宿主插槽能力与收缩约束调研」
- 日期：2026-09-14；方法：只读，只认一手来源（本仓源码、已装插件产物 `~/.dsh/profiles/web/node_modules/*/lib/*.js`）；不改业务代码，不提交，不 close。
- 范围：仅对话框底部栏 `conversation.input.left` + Prompt 按钮收缩位；**只做事实，不做选型决策**。
- 宿主官方 slot 包（`@deepseek-ai/dsh-client-ui-slots`）未随包落盘：本仓 `node_modules` 无此目录、`package.json` 仅在 `dsh.client.inject` 声明它（`package.json:61-76`）、`tsdown.config.ts:6-11` 将其列为 external（宿主运行时注入）。因此“宿主文档”部分以**宿主行为在已装插件中的实证**代替，凡推理均已标注。

## 1. 本插件 slot 注册事实（`src/client/index.ts:121-131`）

- 入口按钮注册：`ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name:'conversation.input.left', id:'dsh-prompt-entry', order:10, label:()=>'dsh-prompt' }, renderFn))`（`src/client/index.ts:121-131`）。
- `renderFn(props)` 签名 `(props:any)=>...` 但**完全忽略 props**，只读 `isPanelOpen()` 本地状态渲染 `EntryButton`（同文件 L123-129）。即：宿主即使透传宽度/会话信息，当前实现也未消费——无宽度 prop 被使用是**本仓实现现状**，不是宿主“没给”（宿主给了什么无法从本仓源码得知；`PanelHost` 在 `conversation.input.overlay` 上收到的 props 为 `{useInput, inputActions, sessionId}`，见 `src/client/index.ts:47-110`，`input.left` 是否同形**未验证**）。
- 同槽竞争：`order:10`（本插件）；相邻 `+`、附件、权限、识图、模型、发送按钮属宿主，布局容器 `flex/wrap` 归宿主（题面背景属实，本仓无任何宿主容器样式代码）。
- 面板浮层已逃离 input 槽约束：`PanelHost` 经 `PanelPortal→TopPortal` 挂到 `document.body`（`src/client/index.ts:109`，`src/client/panel.ts:376-380`），真机 R1 证实留在 `conversation.input.overlay` 内会被右侧面板盖住（`src/client/panel.ts:370-374`）。**面板宽度不受 `input.left` 变窄影响**，收缩问题只涉及按钮本身。

## 2. Prompt 按钮现状事实（`src/client/button.ts:15-45`）

完整 style 块（逐字）：

```js
display:'inline-flex', alignItems:'center', gap:6,
padding:'5px 10px', borderRadius:8,
background:'var(--dsw-alias-bg-layer-3)',
border:'1px solid var(--dsw-alias-border-l1)',
color: open ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-label-primary)',
cursor:'pointer', fontSize:12, fontWeight:500,
fontFamily:'var(--dsw-font-family)', whiteSpace:'nowrap',
flex:'none',
```

- 图标 `svg` 同样 `flex:'none'`（L38）；文案为无标识匿名 `h('span', null, tr(lang, STR.entryBtn))`（L44）——**无 class/style/data-* 钩子**，CSS 只能用结构选择器命中，或改代码加钩（选型票注意：这是今天唯一的“藏文案位”成本）。
- 文案恒为 `Prompt`（中英同形，`src/client/i18n.ts:23`），6 字符；收缩收益上限小。
- 反收缩三件套齐全且无对冲：`flex:none`（拒绝被 flex 容器压缩）+ `whiteSpace:nowrap`（拒绝换行）+ **无** `minWidth:0` / `maxWidth` / `overflow:hidden` / `textOverflow:ellipsis`。结论：窄容器下该按钮**溢出而非收缩**（直接推导，无需真机）。
- 全仓无第二处按钮样式：`grep "createElement('style')|document.head|@media|@container" src/` **零命中**；全仓内联 style + `var(--dsw-*)`（题面背景属实）。

## 3. panel.ts 定位钳制逻辑事实（`src/client/panel.ts:439-475, 551-561`）

- 锚点：`document.querySelector('[data-dsh-prompt-entry]')` 取按钮 `getBoundingClientRect()`（L441-443）；rect 全零视为未找到、不提交垃圾位置（L445）。
- 尺寸：面板 `width:560` **写死**，无 `maxWidth`（L556）；`left` 钳制 `[8, vw-560-8]`（L449-451）；`bottom = vh - br.top + 8`（L452，面板底边在按钮顶边上 8px）。
- 时序：`useLayoutEffect` 首帧计算 + rAF/50ms 轮询至多 10 次（L425-469）；10 次失败记 `panel.position.fail{attempts}` 并回退 `{left:8, bottom:8}`（L463-466，保证可见可点）。
- 唯一响应式订阅：`window.addEventListener('resize', compute)`（L471-474）——**只重算面板位置，不碰按钮**；滚动无监听；`ResizeObserver/MutationObserver` 在面板路径**零使用**（唯一的 `MutationObserver` 是 `html[lang]` 语言跟随，L478-484）。
- 未定位前 `visibility:hidden` 防左下角闪现（L555，#35）。

## 4. 三种响应式手段：可用 / 不可用（事实 + 证据）

| 手段 | 结论 | 证据 |
|---|---|---|
| ResizeObserver | **可用（技术上无禁令），本仓未用** | `src/` 零命中（§2 grep）；宿主未禁用 DOM API 的旁证：同机三插件在用——`dsh-im-companion/lib/client.js:928`（`new ResizeObserver(relayout).observe(el)`，需 `typeof ResizeObserver!=='undefined'` 守卫）、`dsh-mattpocock-skills-deck/lib/client.js:10831-10837`（双 RO 观察胶囊+父容器+`window resize`+`document.fonts.ready`+2s 轮询五重触发）、`dsh-better-sidebar` 多处（`client-registry.js:15260` 等）。本插件已有 `window resize` 监听先例（`panel.ts:472`, `about.ts:103-108`），加 RO 无新权限需求。可观察目标：自身按钮 `[data-dsh-prompt-entry]`、宿主槽 wrapper `[data-slot="conversation.input.left"]`、输入卡 `[data-composer-card]`（后两者存在性见 §5）。 |
| Container query（`@container` + `container-type`） | **可注入但缺宿主侧容器锚点；仅插件自有子树内闭环可行** | 本仓/已装插件中**零条 CSS container query 实证**（`@container` 命中全是 mermaid 图语法，非 CSS；`container-type` 零命中）。技术链条事实：① 注入 `<style>` 本身可行（见下行）；② `@container` 生效要求**祖先**设 `container-type`，而 `input.left` 的祖先链（槽 wrapper → 输入条容器）归宿主，本插件今天没设过、设了也属“改宿主 DOM”（脆弱，未见官方支持声明）；③ 插件**能**给自己按钮设 `container-type`，但那只对其**子元素**生效（图标/文案之间），对“宿主容器变窄”这个外因无感——这是 container query 在此槽位的结构性错位（推导，已标注）。 |
| 样式覆盖（ injected `<style>` / 全局 CSS） | **可用（无禁令，有先例），本仓未用** | 本仓零 `<style>` 注入（§2 grep）；vision-router 实证：`document.createElement('style')` + `tag.dataset.plugin` + `document.head.appendChild(tag)`（`dsh-vision-router/lib/client.js:1334-1347`），CSS 内含 `@media(max-width:640px)` 两条（同文件 L1331-1332）与大量 `.vr-*` 覆盖。这证明：① 插件可挂全局样式；② `@media`（视口级）可用；③ `data-slot`/`data-composer-card` 是跨构建稳定的覆盖钩（vision-router 注释原文 L1710-1714：“DSH web hashes its CSS-module class names… addressed through slot wrappers (data-slot), data-composer-card…”）。约束见 §6。 |

补充：内联 `style` 对象**表达不了** `@media/@container/伪类`——要做响应式必须新增 `<style>` 注入（或改构建引 CSS），这是今天“全仓内联 style”的硬边界（事实：React inline style 规范行为 + 本仓零注入现状）。

## 5. 宿主 DOM 钩子清单（覆盖/观察位）

- `[data-dsh-prompt-entry]`：自有钩，按钮根（`button.ts:27`；查询侧 `panel.ts:441`）。**最稳的观察+覆盖位**。
- `[data-slot="conversation.input.left"]`：宿主槽 wrapper。存在性由 vision-router 的通用机制旁证（`client.js:1711-1718` 列 `[data-slot="conversation.input.model"]` 实证 + 注释称 slot wrappers 通用；`input.left` 同名前缀，按命名规则推断存在，**未在真机 DOM 实测**，已标注）。
- `[data-composer-card]`：输入区卡片锚点（vision-router toast anchor `client-presentation-boundary-main.js:1151-1154`；guide fallback `client.js:1718`）。
- `[data-dsh-panel-host]`（宿主面板 host，`z-index:25`）：better-sidebar 注入 CSS 实证（`client-registry.js:2715` 等），说明宿主关键层 z 远低于本插件面板 `PANEL_Z=9999`/`MODAL_Z=11000`（`panel.ts:234-235`）——面板层无收缩关联，仅备查。
- 宿主布局变量（ sibling 观测到的**可读**变量，可在覆盖 CSS 里 `var()` 引用或回退）：`--dsh-composer-card-max-width`、`--dsh-composer-side-clearance`、`--dsh-conversation-column-width`（skills-deck `client.js:490-492, 10827-10829`）。宿主主题变量 `--dsw-*` 全仓已在用（§2 末 grep），覆盖样式应沿用。
- 同槽 sibling 实证：`conversation.input.right` 被 vision-router 占用（`👁` 模式开关，`client-presentation-boundary-main.js:1160-1197`，按钮同样 `whiteSpace:nowrap` L1097）——**左右两槽的插件按钮都不收缩**，窄条下是叠加溢出关系；`conversation.input.dock` 被 skills-deck 占用（胶囊区，`client.js:15086-15087`）。

## 6. 收缩 / 隐藏文字 / 溢出收纳的可行位与约束

- **A. 按钮内文案位（唯一可独立收缩位）**：今天匿名 span（§2）→ 可行动作是给文案加 `minWidth:0 + overflow:hidden + textOverflow:ellipsis + flex:0 1 auto` 并把按钮根 `flex:none` 改为可收缩（本仓已有**同款先例**：设置页更新入口 `entryRowStyle{minWidth:0,maxWidth:100%}` + `entryLabelStyle{ellipsis}` + 徽标/图标 `flex:none`，`src/client/update.ts:224-235`；头行按钮组 `headBtnsStyle{flex:'0 1 auto',minWidth:0}` + 图标 `flex:none`，`src/client/about.ts:35-42`）。约束：① 需改 `button.ts`（调研后选型票的事）；② `Prompt` 仅 6 字符，隐藏全文案最多省约 60px（含 gap/padding，按 12px 字号估算，已标注为估算）；③ 图标应保留（对标先例“徽标与图标必须留着”）。
- **B. 图标化（隐藏文字只留 💡+✦）**：A 的极限态（`display:none` 文案 span）。JS 切换（RO/宽度阈值）或纯 CSS（注入 `<style>` + 容器/视口查询）均可表达；纯 CSS 需要 §4 的 `<style>` 新增量。无障碍注意：按钮已有 `title`（`button.ts:26`），图标化后 `title/aria-label` 必须保留（事实：今天有 `title` 无 `aria-label`）。
- **C. 溢出收纳（把按钮收进“…”菜单）**：**槽内无可行位**。收纳需要一个宿主容器级的溢出菜单，而 `input.left` 的布局容器与兄弟按钮全归宿主；插件只能收纳**自己子树内**的东西（本按钮仅含图标+一词，无可收纳结构）。反例即正例：skills-deck 的 `data-fold-priority` + `scrollWidth<=clientWidth` 逐级加 `.dsws-folded{display:none}`（`client.js:500-508, 10805-10824`）之所以成立，是因为它**拥有整个胶囊容器**（`conversation.input.dock` 整条归它画）；`input.left` 插件只拥有一个按钮，不具备收纳宿主兄弟的条件（推导，已标注）。
- **D. 宿主容器级覆盖（改 flex/wrap/order/overflow）**：技术可达（`<style>` 命中 `[data-slot]`，vision-router 式），但**支持性未知**：宿主未声明 slot 布局契约，类名哈希化（vision-router 注释原话），`order` 语义仅见插件侧传参（本仓 `order:10`），改宿主容器有随版本失效风险。只列为“可写但无契约”，不建议选型票将其当稳定方案（标注为风险提示，非决策）。
- **E. 面板侧**：无需收缩（已 portal 到 body，§1）；若对话框极窄，面板 `width:560` 写死 + 左右钳制在 `vw<576` 时会贴边（`8 / vw-568`），后续可选 `maxWidth:min(560px,92vw)`（update 弹窗已有 `maxWidth:92vw` 先例，`update.ts:185`），与本票按钮收缩正交。

## 7. 负向发现（同样是事实）

- 本仓 `src/` 无 `ResizeObserver` / `container` / `@media` / `<style>` 注入 / `matchMedia`（§2、§3 grep）。
- `conversation.input.left` 的 render props 未被读取（§1），故“宿主是否给宽度”**无法从本仓回答**，需真机 `console.log(props)` 一行确认（未做，超出只读调研但属无害观测，留给选型票）。
- 未找到宿主官方 slot 文档 URL 与 `input.left` 布局契约（overflow/wrap/断点）——`dsh-client-ui-slots` 包不在任何可读 `node_modules`（本仓、`~/.dsh/profiles/web/node_modules/@deepseek-ai` 仅余 cosmokit/storage-domain/schemastery、Desktop `app.asar` 已打包不可读）。以上均为“未找到”，不是“不存在”。

## 8. 证据路径（供选型票引用）

- 本仓：`src/client/index.ts:121-131`（注册）、`src/client/button.ts:15-45`（按钮）、`src/client/panel.ts:439-475`（定位重试）、`src/client/panel.ts:551-561`（面板样式）、`src/client/panel.ts:478-484`（唯一 MutationObserver）、`src/client/about.ts:35-42,88-110`（可收缩先例+resize 跟随）、`src/client/update.ts:184-235`（可收缩入口+92vw 先例）、`src/client/i18n.ts:23`（文案）、`package.json:61-76` + `tsdown.config.ts:6-11`（slot 包 external 声明）。
- 已装插件：`~/.dsh/profiles/web/node_modules/dsh-im-companion/lib/client.js:903-928`（RO 守卫写法）、`dsh-mattpocock-skills-deck/lib/client.js:480-508`（fold CSS+优先级注释）、同文件 `:10805-10848`（applyFold+双 RO+五重触发）、同文件 `:15086-15087`（dock 槽注册）、`dsh-vision-router/lib/client-presentation-boundary-main.js:1077-1098,1118-1197`（right 槽按钮）、`dsh-vision-router/lib/client.js:1331-1347,1710-1719`（<style> 注入+@media+data-slot 注释）。
