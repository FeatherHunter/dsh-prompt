# 取色浮层三项改动（真机反馈 2026-10-15）

用户原话（截图：浮层里用红框圈出「默认（跟随主题） + #1380ec」这一行）：

1. 「文字描边应该在红色框框区域，在同一行」
2. 「这一行的控件高度需要一致，现在不一致」
3. 「调色板页面内的 所有 可以点击交互的控件和按钮需要有交互效果，让用户能感觉到 鼠标点到了、有焦点等」

预览：[preview.png](preview.png)（由 [mock-popover.html](mock-popover.html) 渲染；左＝改前 0.4.20 装机版的真实内联样式，右＝改后）。**注**：这张图渲染于审查之前，悬停环颜色后来从 `label-primary` 改成了中性令牌 `--dsw-alias-border-l2`（见文末审查节），图形状不变、色略变。

## 改了什么

| # | 改动 | 位置 |
| --- | --- | --- |
| ① | 「文字描边」开关从独立一行搬进「默认 + 十六进制」那一行；行容器加钩子 `data-dsh-prompt-ink-row` | `src/client/panel.ts:822-857`（开关在 `:842-852`） |
| ② | 三个控件共用公共皮 `inkRowCtlStyle`（固定 `height:32` + `box-sizing:border-box` + `1px` 边框 + `0.9em` + `6px` 圆角）；选中态 `inkRowCtlOnStyle` 只改 `borderColor` + `inset 0 0 0 1px` 环，不再把边框加粗到 2px；十六进制框只留公共皮 + 它独有的两条（填充底 `bg-layer-3`、`outline:none`） | `src/client/panel.ts:700-711`、`:832-841` |
| ③ | 新增交互反馈样式段 `INK_UI_CSS`（色块、默认键、完成、×、十六进制框、描边开关行的 `:hover` / `:active` / `:focus` / `:focus-visible`），经归属缝注入（私有标记 `ink-ui` 只在 `index.ts` 一处） | 定义 `src/client/panel.ts:593-620`；注入 `src/client/index.ts:124-136`（函数）、`:213`（调用点） |
| ③ | 「完成」「×」加钩子 `data-dsh-prompt-ink-done` / `data-dsh-prompt-ink-close`（反馈段据此挂到它们身上） | `src/client/panel.ts:786-787` |

为什么走 `filter` / `box-shadow` / `transform` 而不是背景变色：这些控件自身的底色与边框都是**内联**样式（内联优先级高于任何选择器），只有这三条通道没被内联占用；十六进制框内联写了 `outline:'none'`，所以它的聚焦环也用 `box-shadow`。

## 验证

- `node scripts/test-issue-158.cjs`（R3 组，14 条新断言：同行、同高 32、同 `box-sizing`、选中态不加粗边框、反馈段覆盖四类伪类且零写死颜色/零描边通道）：PASS。其中「三个控件等高 32」是对渲染出来的节点 `props.style.height` 直接断言的。
- `npm run typecheck` / `npm run build`（`lib/client.js`）/ `npm run test:lib-sync`：全绿。
- 全量 `test:*` 52 个脚本：50 绿；红的两条 `test:issue-89`、`test:issue-59` 在本次改动前就红（require 失败 / `src/client/updauto.ts` 已不存在，已用「同时回退 src+lib」复验），与本改动无关。审查后又重跑一遍，结果不变。
- 观感：`preview.png`（headless Chrome 实渲；颜色墙用 `panel.ts:671` 的真取样逻辑现算，交互反馈段直接内联构建产物里的 `panel.INK_UI_CSS` 原文）。

## 未做

- **未发版**：桌面装机件仍是 0.4.20，这三项要装机必须 bump + 发版 + 重装（同 #149：装机版是旧产物，源码改了不等于用户能看到）。

## 对抗式审查（2026-10-15 下午：Lead 自查 + 两个只读子 agent + headless Chrome 实测）

### 真问题（已修、已进 `lib/client.js`、已加断言）

| 发现 | 处理 |
| --- | --- |
| **固定 `height:32` 在大字档下装不下内容**。我先前用 mock 目测得出「盒子会被 flex 顶高、不会裁切」，**这个结论是错的**（mock 没有忠实复刻固定高度）。headless Chrome 三方案实测（[_probe-variants.html](_probe-variants.html)）：A `height:32` 在 1 档 32/32/32 装得下，2 档起 0.9em 文字溢出（3 档 50.4px 文字塞进 32px 盒）；B `min-height:32` 三控件**高不相等**（2 档 32/35/32、5 档 456/133/229）；**C `height:2.6em` 在 1/2/3/5 档全部「三控件等高 + 零溢出」**（1 档 33px ≈ 原来的 32） | `panel.ts:700-707` 改 `height:'2.6em'`；158 门禁改成断「三个值彼此相等且以 em 结尾」，不再钉魔数 32 |
| 十六进制框三层样式叠加（`inkRowCtlStyle` → `modalFieldStyle` → 逐条覆写 height/padding/圆角/字号/行高），注释与本文档却写「不再整段套 modalFieldStyle」——当时**代码与说法不符** | 删掉 `...modalFieldStyle`，只留它真正贡献的两条（填充底 `bg-layer-3`、`outline:none`）；注释改成与代码一致 |
| 色块悬停环用 `label-primary`，与选中态（2px `label-primary` 边框）同形 ⇒ 悬停一个未选中的格子看起来就是已选中；描边行悬停用背景令牌画环，几乎看不见 | 悬停环统一改中性令牌 `--dsw-alias-border-l2`；`label-primary` 只留给选中/聚焦；门禁加正反两条断言 |
| 焦点环挂在不可聚焦的 `<label>` 上（`outline-row:focus-visible` 永不亮）⇒ Tab 到描边 checkbox 没有插件焦点反馈 | 焦点环改挂 `[data-dsh-prompt-ink-outline]:focus-visible`；门禁加断言 |
| `INK_UI_MARKER` 从 `panel.ts` 导出但全仓零 import，`index.ts:128` 另有同值字面量（同一私有标记两处真相） | 删掉 `panel.ts` 的导出，标记只在 `index.ts` 一处；门禁加「`panel.ts` 不得出现 `'ink-ui'`」 |
| #149 门禁把钉行为的正则降级成 `includes('if (n === 6) {')`（只判 token 存在）；`kicked` 的实义是「registry 上有 invoke」而不是「命令点着了」 | 换回钉行为的正则；改名 `commandSent`，两处断言同步 |
| 新断言的红检：6 条断言分别喂「改前 / 改后」源码，逐条可区分（改前红、改后绿） | `scripts/.rt-tmp-scratch/gate-redcheck.cjs`（临时件、gitignore） |

### 驳回的（子 agent 报了，核后不成立或不该改）

- **「`n === 6` 无条件重发宿主命令会反关设置」不成立**：插件固定传 `{ modal: null }`（`index.ts:325`），宿主 `resolve` 只在 `modal === 'settings'` 时走 `closeTopModal`，否则一律 `actions.open()`（宿主 `settings-general/lib/client.js:1097-1107`）⇒ 反关分支从插件调用点不可达。保留无条件重发（这正是「命令静默无效时还有第二次机会」的价值），并把这段推理写进注释。
- **遮罩 `data-dsh-prompt-ink-mask` 不加反馈**：它是全屏遮罩（点击＝关浮层），加 hover 反馈等于整屏闪一下，不属于「控件」。
- **①「文字描边必须在同一行」在大字档下做不到**：实测（[_probe-metrics.html](_probe-metrics.html)）1 档同一行＝是；2/3/5 档同一行＝否 —— 三控件在 2 档就要 269+288+174+间隙 ≈ 731px，超过卡片 `min(470px,92vw)`。这是「卡片宽度用 px × 控件尺寸用 em」的结构问题，不是 `flexWrap` 的错（去掉 wrap 只会横向溢出）。要真收口得让卡片宽度也随字号走（如 `min(33em,92vw)`），代价是 5 档变成接近满屏的浮层 —— 取舍留给用户拍板。
- **色块墙横向溢出是既有问题**：实测 2/3/5 档墙宽 622/1063/2323 > 卡宽 527/571/697，属 #160 范畴，本次未动。

### 与 #149 的关系

- #149 的三级入口（`hostOpenSettings` / `launcherAnchor` / `settingsMenuItem`）是**另一件事**，与这三项 UI 无关，只是躺在同一批未提交改动里 —— 提交时应分成两个 commit。
- `inject`（`index.ts:36`）里没有 `shortcuts` ⇒ 本宿主里 `ctx.shortcuts` 为 undefined ⇒ `hostOpenSettings()` **当前恒 false**：① 是「等声明后才生效」的路径，真干活的是 ②③。要做实需改用宿主插件通用的 `ctx.inject(['shortcuts'], …)`（宿主里有 4 处先例），属独立决定。
