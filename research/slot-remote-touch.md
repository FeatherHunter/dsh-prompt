# #79 调研：TemplateBrowser compact 挂载点约束（大面板 + 横屏 + UU远程4K触控）

- Issue：#79（part of #78 map）；日期：2026-09-28；方法：只读（本仓 `src/client/*` + `cordis.patch.yml` + `package.json` + 既有 `research/input-slot-constraints/findings.md`）；不写生产代码。
- 宿主包直读结论：`node_modules/@deepseek-ai/` 下**没有** `dsh-client-ui-slots` / `dsh-client-runtime`（2026-09-28 实测仅 `cordis/cosmokit/dsh-invariants/dsh-storage*/schemastery`）；`package.json:69-80` 仅在 `dsh.client.inject` 声明两者为注入目标（运行时注入、构建 external）。凡“宿主给了什么 prop / 槽容器样式”均**无法从本仓回答**，下文凡涉及宿主行为处均标注为“本仓实证 + 推理”。
- 现状锚点：`TemplateBrowser compact=true` 经 `PanelHost` 挂在 `conversation.input.overlay`（`src/client/index.ts:139-141`，`order:2`），再经 `PanelPortal→TopPortal` portal 到 `document.body`（`index.ts:109`，`panel.ts:687-691`）。**面板尺寸不受 input 槽约束**（`findings.md §1` 已证实 R1 真机：留在 overlay 内会被右侧面板盖，portal 后逃离）。

## 1. 最大宽高（今天写死的值 + 放大余量）

- 面板宽 **`width:560` 写死，无 `maxWidth`**（`panel.ts:781` 定位用宽 + `panel.ts:892` 样式）。左钳制 `left∈[8, vw-560-8]`（`panel.ts:783-784`）；`vw<576` 时贴边（`8 / vw-568`），`findings.md §6-E` 已预告此边界。
- 列表区 **`height:360` 写死 + `overflow:auto`**（`panel.ts:917-918`）；约 10 个单行 item 可见（同行注释）；空态同样占 `height:360`（`panel.ts:1085`）。设置页分支是自然高度（`panel.ts:919`），与 compact 无关。
- 面板总高 ≈ 头行 + 云行（可换行，`panel.ts:908` `flexWrap`）+ 搜索框 + 360 列表 +（footer=null，`panel.ts:1087`）。按当前行高估算总量 **≈500–560px**；横屏 4K（`vh≈1080–2160`，取决于 UU 缩放/浏览器 chrome）纵向放得下，但**横屏手机浏览器可视 `vh` 会被地址栏/键盘吃掉**，放大必须按实时 `vh` 封顶，不能按 4K 物理分辨率算。
- 弹窗（新增/编辑/删除确认）：`width:460` 卡片 + 全屏遮罩（`panel.ts:548-549`）；`update.ts:185` 另有 `maxWidth:92vw / maxHeight:82vh` 先例——compact 面板今天**没有**这条，可抄。
- 智能卡参照（同屏共存时别撞）：点 `12px`（`smart.ts:17`）、卡宽 `280`（`smart.ts:18`）、行区 `maxHeight:220`（`smart.ts:386`）。大面板原型若与智能卡同开，`x` 方向至少错开 `280+16`。
- **放大上限公式（原型直接用）**：`W ≤ min(放大目标, vw-16)`，`H总 ≤ vh - 按钮条高 - 16`（按钮顶边上方 8px 间隙见下节）；`left/bottom` 保留 8px 钳制；`vw<640` 时建议 `W=min(560→vw-16)` 即贴边全宽，而非保持 560。

## 2. 定位（锚点、层级、重算时机）

- 锚点：`document.querySelector('[data-dsh-prompt-entry]')` 取按钮 `getBoundingClientRect()`（`panel.ts:774-776`）；rect 全零视为未找到（`panel.ts:778`）。
- 定位：`left=btn.left` 左右缘对齐（`panel.ts:782`），`bottom=vh-btn.top+8` 即面板底边在按钮顶边上 8px（`panel.ts:785`），`position:fixed`（`panel.ts:889`）。未定位前 `visibility:hidden` 防左下角闪现（`panel.ts:891`，#35）。
- 重试：`useLayoutEffect` 首帧算 + `rAF/50ms` 至多 10 次（`panel.ts:789-801`）；10 次失败记 `panel.position.fail{attempts}` 并回退 `{left:8,bottom:8}`（`panel.ts:798-799`）。**唯一响应式订阅是 `window resize` 重算位置**（`panel.ts:803-807`）——滚动无监听，`ResizeObserver/MutationObserver` 在面板路径零使用（`findings.md §3`）。
- 层级（`panel.ts:541-546` 内决，不许自创新层）：`PANEL_Z=9999`（compact 浮层）< `MODAL_Z=11000`（弹窗遮罩，`panel.ts:548`）；气泡 `TIP_Z=MODAL_Z-100`（`about.ts:28-29`）；智能点/卡 `z=400` 普通层（`smart.ts:305,327`，`panel.ts:544` 注释）；宿主侧面板 host `z=25`/面板 `40`/遮罩 `1000`（`findings.md §5` 引 better-sidebar 实证，远低于 9999——数值从不是问题，R1 真机问题是祖先层叠上下文，已由 portal 解决，`panel.ts:682-686`）。
- 含义：大面板**层级不用动**（9999/11000 继续用）；定位逻辑不用换锚点——放大只改 `width/height` 常量与钳制公式，`bottom` 公式与重试/回退保持原样。

## 3. 触控（tap vs hover、关闭时机）

- 开面板：按钮 `onMouseEnter→open` + `onMouseLeave→schedulePanelClose(150)`（`button.ts:86-87`）；**`onClick→toggle` 是触屏 tap / 键盘 fallback**（`button.ts:88-89`，注释原话“触屏 tap … fallback”）。触控下 hover 不可靠，**开面板必须走 click**。
- 关面板：根节点 `onMouseEnter→cancel` / `onMouseLeave→schedulePanelClose(150)`（`panel.ts:1091`，仅 compact）；`state.ts:24-32` 短计时防按钮→列表途中误关。显式关闭（行点击插入 `setPanelOpen(false)`（`panel.ts:537`）、`×`（`panel.ts:1103`）、去设置（`panel.ts:1100`））不受抑制影响（`panel.ts:822` 注释）。
- 抑制门：`modal || searchFocused || composing → setHoverCloseSuppressed(true)`（`panel.ts:824-829`）；弹窗 `onCancel/onOk` 同步清门控消竞态（`panel.ts:979,983`）。触控+UU 下风险恰在这里：手指抬起/远程指针抖动会产生杂散 `mouseleave`，150ms 后面板消失；搜索框 `onFocus/onBlur/composition` 抑制（`panel.ts:1158-1165`）在软键盘弹起/远程焦点丢失导致 `blur` 时会**提前释放**抑制。
- 行交互全是 `onClick`（`panel.ts:1038` 行、`1039` 图钉、`1019-1023` 编辑/删除/复制），tap 可达；但 `keepComposerFocus` 绑在 `onMouseDown preventDefault`（`panel.ts:406-425,1037`）——触控合成 `mousedown` 时序因浏览器/远程而异，**保焦在触屏下只能算 best-effort**，插入后 `focusComposer()` 有 `setTimeout 0` 回焦（`panel.ts:514-516`）。
- UU 远程叠加：远程帧延迟把“hover→leave→150ms 关”拉长为体感上的“莫名其妙关了又得重开”；`mouseenter` 开面板在触屏 UU 下可能根本不触发（无悬停），用户只能点按——原型必须提供**显式开/关**（按钮 toggle + 面板内 `×`），不能假设 hover 开合可用。

## 4. 滚动

- 单容器内滚：列表 `overflow:auto` 固定 360（`panel.ts:918`）；面板整体不滚，页内无 `window scroll` 监听。原生触控滚动（手指拖列表）可用；远程下滚轮→触控板→触屏拖三路都汇到同一容器。
- bottom-up 自动滚底：打开/过滤变化后双 rAF + 50ms 兜底 `el.scrollTop=scrollHeight`（`panel.ts:865-877`）；短列表（`≤10`）用 `flex-end` 贴底（`panel.ts:918`）。放大后“少翻页”的含义就是**把 360 调大**，自动滚底逻辑不用改。
- 高亮项 `scrollIntoView({block:'nearest'})`（`panel.ts:955`）；复制预置→自定义后切 `selected=CUSTOM` + 高亮 1600ms 后清（`panel.ts:948-957`）。大面板下同样成立。
- 约束：**禁止整页滚、禁止双滚**（面板整体 + 列表同时滚在触屏下极易误触关闭）；放大只放大列表容器高度，头行/云行/搜索框保持不滚（sticky 语义天然成立，因为它们在滚动容器之外，`panel.ts:1095-1167` 结构）。

## 5. IME（组词）

- 搜索框：`compositionstart→抑制关窗`，`compositionend→提交最终值 + 按条件释放`（`panel.ts:1161-1165`）；聚焦即抑制（含取消已挂起的 150ms 计时，`panel.ts:1158`）；中文组词整段只算一次输入（`panel.ts:739-742` 注释，#34）。
- 草稿合并（插入侧，不动）：`H（桥草稿） vs D（DOM 活读）` 决议（`panel.ts:434-494`），组词中未提交文字走 D（`panel.ts:104-107` 注释）。大面板不改插入管线，只需保留这组门控——**原型若重写搜索框，必须原样抄走 `onFocus/onBlur/onCompositionStart/onCompositionEnd` 四件套**，否则中文输入期杂散 leave 会关窗（#34 回归）。
- UU 远程中文输入：组词窗口由本地 IME 渲染、候选上屏经远程帧回传，`compositionend` 可能延迟；门控逻辑仍成立（抑制只与事件有关、与帧率无关）。唯一新增风险是远程焦点抖动导致 `blur` 误释放（见 §3）。

## 6. 性能边界（本地 + UU远程4K）

- 行数：`rows = sorted(allTemplates filtered)` 全量渲染、无虚拟化（`panel.ts:1006-1082` map）；预置 24 + 自定义 N。每次搜索键入全量重渲染（`qState`，`panel.ts:708-709,1155`），行内每行读一次 `loadUsage()`（`panel.ts:1029`）。N≤60 且单行结构不变时本地无感；N 持续 büyür 或单行变高行/富媒体时，重渲染 + 自动滚底（双 rAF）+ 远程全帧编码会叠加。
- 定位重试 ≤10 帧（`panel.ts:793`）；`panel.open` 仅记 `{mode,rows}`（`panel.ts:749`）；`pick.probe` 仅记计数（`panel.ts:1184-1216`）——面板路径本身无轮询（智能卡的 300/350ms 轮询在 `index.ts:96` / `smart.ts:196`，面板不受影响）。
- UU 远程 4K 成本模型（推理，已标注）：远程桌面是视频编码，大面板 = 每帧更多变化宏块；`boxShadow:lv3 + borderRadius:12 + fixed overlay`（`panel.ts:894-895`）本就是重绘贵的组合；键入过滤每字一次全列表重排 + 滚底 + 整屏帧上传，在 4K + 触屏软键盘同开时最吃力。**放大高度省翻页次数，但单次打开/过滤的传输量变大**——这是“占大空间少翻页”的真实 trade-off。
- 数量级建议（经验值，非实测）：行数 ≤60、列表高 ≤ `min(560, vh*0.6)` 时沿用现状直渲染；超过则原型必须做条数封顶（`trigger.ts:17,53` 的 `MAX_ITEMS=30` 即先例）或窗口化渲染，否则远程下输入跟手性先崩。

## 7. “占大空间少翻页”是否可行

- **可行，但有条件**：overlay 已 portal 到 body，槽位对面板无尺寸上限（§1）；宽度/高度是自家常量（560/360），放大是改两个数字 + 钳制公式的事，不碰宿主契约。但必须同时满足 §8 三条硬约束，否则在横屏触屏 + UU 下会以“误关、误触、卡顿”形式失败。
- 不可行的一条路：指望宿主槽容器自适应（改 `[data-slot]` flex/wrap）——`findings.md §6-D` 已判为“可写但无契约”，本调研维持该结论。

## 8. 给原型的三条硬约束（H1–H3，原型验收按此卡）

- **H1 尺寸只许在视口钳制内放大**：`W≤min(目标, vw-16)`，`H总≤vh-按钮条-16`，保留 `left/bottom 8px` 钳制（`panel.ts:783-785`）与 `resize` 重算（`panel.ts:803-807`）；`vw<640` 时贴边全宽；抄 `update.ts:185` 的 `maxWidth:92vw/maxHeight:82vh` 做第二道保险。层级不动（9999/11000），锚点不动（按钮 rect）。
- **H2 触控必须走 click 闭环，不依赖 hover**：开面板用按钮 `onClick toggle`（`button.ts:89`），关面板用 `×` / 插入自动关 / 外部显式手势；hover 的 150ms 自动关（`button.ts:87`，`panel.ts:1091`，`state.ts:24-28`）在触控原型里默认关闭或加长到 ≥1000ms，且搜索聚焦/组词抑制四件套（`panel.ts:1158-1165`）原样保留。验收：在纯触屏（无悬停）下开→滚→选→关全程可达。
- **H3 大列表必须内滚封顶，禁止整页滚**：单滚动容器 `overflow:auto` + 固定高度（现 360，可按 `vh` 比例放大但必须封顶，`panel.ts:918`）；保留 bottom-up 自动滚底（`panel.ts:865-877`）；行数>~60 或单行变高时做条数封顶（抄 `trigger.ts:53` 的 30 条先例）或虚拟化。验收：过滤键入时面板外框不动（今天 360 固定高度的动机，`panel.ts:915` 注释），只有列表内滚。

## 证据路径（行号供复核）

- 挂载/portal：`src/client/index.ts:109,126-141,170-178`；`src/client/panel.ts:646-691`；`cordis.patch.yml:4-7`（仅 bundle 条目，无 slot 声明）。
- 尺寸/定位：`panel.ts:774-807`（compute+重试+resize）、`panel.ts:887-901`（panelStyle）、`panel.ts:917-919`（listStyle）、`panel.ts:548-549`（modal）；`smart.ts:17-20,305-327,386`（共存参照）。
- 层级：`panel.ts:541-546`；`about.ts:28-29`；`smart.ts:298,327`。
- 触控/关闭：`button.ts:86-89`；`panel.ts:1091`；`state.ts:9-32`；`panel.ts:406-425,514-516,537,1103`。
- 滚动：`panel.ts:865-877,918,948-957,1085`。
- IME：`panel.ts:104-128,434-494,739-742,824-829,1154-1165`。
- 性能/先例：`panel.ts:708-709,749,1006-1082,1184-1216`；`trigger.ts:17,53`；`index.ts:96`；`smart.ts:196`；`research/input-slot-constraints/findings.md §1-§7`。
