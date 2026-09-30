# 远程 1–10 档能否联动 DSH 整机字体——桥接研究报告

- 日期：2026-09-29
- 问题：DSH 宿主有没有“整机字体大小”能力，可供本插件远程模式统一大小 1–10 档（`REMOTE_SIZE_SCALES=[1,1.25,…,3.25]`）联动，让 DSH 所有字体按档位等比例放大？
- **结论（一句话）：建议不做——宿主没有可供 1–10 档等比联动的整机字体能力（官方写面只有 12–17px 内容字号、无控件/UI 缩放），且本仓“禁止依赖官方”拍板下任何整机跟手都要么走野路子、要么新增官方依赖，都不值得。**
- 范围：只读调研，不改业务代码（`src/`、`scripts/`、`lib/` 均只读）；不碰 deck、不关票、不提交。本文件为 research 记录，存 `research/` 惯例位。
- 前作：姊妹篇 `research/host-vs-plugin-h2-fontui.md`（H2 分层结论 L0/L1/L2）在宿主 `0.1.7-rc.2` 上仍成立，本篇是其在“统一大小 1–10 档 + 去宿主化拍板后”的增量裁决。

## 0. 本插件现状快照（仓内证据）

- 统一大小 1–10 档已落地：`REMOTE_SIZE_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25]`，非法回默认 2 档（`src/client/remoteView.ts:86-92`）；控制面吃同一全额、无封顶（`remoteChromeScale`，同文件 `:98-100`）；`computeRemoteView` 里字号与控件吃同一倍数、仅远程开时生效（同文件 `:193-216`）。
- 目前只缩放自家面：远程面板 `fontSize = 'calc(1em * ' + remoteFontScale + ')'` 与底栏键高类乘数（`src/client/panel.ts:1192-1193` 附近取值、`src/client/panel.ts:1056,1076` 的 `uiFontScale` 面板字号）；入口按钮字号/图标吃 `entryFontScale`（`src/client/button.ts:134-135,169,189,211`）；智能卡吃 `smartFontScale`（`src/client/smart.ts:203,345`）；设置页大小预览用 `transform: scale(...)` 仿射预览、不触发布局（`src/client/settings.ts:431-450`）。
- 去宿主化已拍板：`CONTEXT.md:47`（远程模式“只管大/小…不含整机缩放”）、`:52-57`（方向偏好替代整机真切）、`:63-65`（“整机字号跟随…明确不做…字号/控件…只作用于本插件自家面”）。门槛恒可用、无灰字（`src/client/remoteView.ts:196-221`，`void hostCaps` 兼容保留）；回归显式断言设置源码无 `整机待宿主`/`remote-sys-font` 灰行（`scripts/test-issue-82.cjs:98`，`scripts/test-issue-83.cjs:238`）。
- 机会主义桥现状：`openRemoteSettings` 先试 `globalThis.__dshPromptStableOpen('remote')`（stable），缺席落自家 DOM 钩（`src/client/remote.ts:306-344`）；`getRemoteHostCaps` 读 `globalThis.__dshPromptHostCaps`，但已废弃恒缺席、不得门控（同文件 `:76-97`）。
- 残留 stale 文案（非活面）：`src/client/i18n.ts:109-113` 仍有 `整机待宿主`/`整机字号跟随（需宿主 H2）` 词条，`lib/client.js:1704` 有同款英文——但 `src/client/settings.ts:377-465` 当前远程段只渲染总闸+大小滑块+预览+方向偏好+失败明示，无灰行引用这些词条（以 settings.ts 为准）。
- 本插件自实现先例（仅方向）：整机方向真切走自家 host 半 `GET/POST /_dsh/dsh-prompt/system/orientation`（`src/client/systemOrientation.ts:1-10`），路由见 `lib/index.js:390-396`（`KNOWN_ROUTES` 含 `remote/set` 与 `system/orientation`，**无 `system/font` 路由**）。这是“去宿主化自实现”的唯一先例，字体无对应物。

## 1. 宿主字体能力（一手来源）

宿主版本：`C:\Users\辰辰洋洋\.dsh-versions\dsh-0.1.7-rc.2\node_modules\@deepseek-ai\`（`dsh@0.1.7-rc.2`）。以下逐条第一手。

### 1.1 `--dsw-font-*` 等变量是谁定义的、作用域

- `--dsw-font-family` 定义在 **`:root`**：`base.css` 包内 `:root{--dsw-font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", …}`（宿主 `dsh-client-ui-theme/lib/client.js:1142` 内联 bundle 行）。
- `--dsw-font-markdown-*` / `--dsw-font-xl/l/m/s/xs/*` 等排印阶梯定义在 **`body`**：`gradient-shadow-text.css` 包内 `body{--dsh-content-font-delta:calc(var(--dsh-content-font-size,14px) - 14px); … --dsw-font-markdown-base-font-size:var(--dsh-content-font-size,14px); …}` 全量派生链（同文件 `:1160` 内联 bundle 行）。其中内容相关字号由 `--dsh-content-font-size` 派生；`small/code` 类（`--dsw-font-markdown-small:12px`、`code:12px`、`code-block:11px` 等）**定死 px，不跟 delta**（同行可验）。
- `--dsh-content-font-size` 本体由宿主写在 **`body` 行内样式（inline style）**，两处：
  1. 首屏 bootstrap：`bootThemeBodyScript` 内 `document.body.style.setProperty('--dsh-content-font-size', '"<n>px"')`（宿主 `dsh-client-ui-theme/lib/index.js:47-60`）；
  2. 每次快照应用：`ThemePresenter.apply` 内 `body.style.setProperty('--dsh-content-font-size', snapshot.fontSize + 'px')`，随后把上次 token 逐个 `removeProperty` 再写入本次 `active.tokens`（宿主 `dsh-client-ui-layout/lib/client.js:532-547`），并订阅 `theme/change` 每次重放（同文件 `:677-678` 起 `presenter.apply(ctx.theme.getTheme())` + `ctx.on("theme/change", …presenter.apply…)`）。
- 含义：派生链的“水龙头”是 body 行内 `--dsh-content-font-size`；行内样式优先级高于任何样式表规则，插件靠样式表覆盖赢不了水龙头，只能改“下游观感”（见 §2）。

### 1.2 宿主设置里的字号/缩放/无障碍选项及其存储

- 只有两行外观设置：README “Users switch the color scheme and content font size from two rows in Settings (General section)”；“The stepper accepts integer values from 12 through 17 px and defaults to 14 px… Each accepted change writes through the Host settings API.”（宿主 `dsh-client-ui-theme/README.md`，Use/Appearance and font size 两节）。
- Schema 硬锁：`z.number().step(1).min(12).max(17).default(14).volatile()`，`FONT_SIZE_MIN=12`、`FONT_SIZE_MAX=17`（宿主 `dsh-client-ui-theme/lib/index.js:19,21,26,82`）。客户端写面唯一且抛错：`setFontSize(px)` 非整数或越界即 `throw font size ${px} is outside 12..17`（宿主 `dsh-client-ui-theme/lib/client.js:1417-1430`）。
- 渲染行：`FontSizeRow` 步进器（同文件 `:1050-1087`），`{ setFontSize, id: "font-size" }` bridge（同文件 `:1614-1620`）。
- 存储：`ui-theme` settings namespace，经 Host settings API 落盘，loopback 默认持久到 `$DSH_HOME/cordis.patch.yml`；“Non-loopback pages keep both choices process-local.”（README Summary + Preference persistence 节；`THEME_SETTINGS_NAMESPACE="ui-theme"` 见 `lib/index.js:11`）。
- 无障碍/缩放缺席（零命中即证据）：
  - `zoom` 在宿主 `dsh-client-ui-theme/lib/{index,client}.js` **零命中**（本次复验）；
  - `dsh-client-ui-settings-general/lib/*.js` 内 `font|zoom|scale|access` 命中仅组件自身固定 px CSS 与 `prefers-reduced-motion` 装饰，无任何缩放设置项（本次复验，见 §4 来源清单）；
  - `accessibility|a11y` 在 `dsh-client-ui-settings/lib/*.js` **零命中**（本次复验）。
  - 结论：宿主设置里**没有字号之外的缩放项、没有控件尺寸/界面密度/UI 缩放、没有无障碍字体开关**。姊妹篇指出的 theme-studio density 三档只是字号别名（compact 13 / comfortable 14 / spacious 16）在此版本语义下依然成立——宿主侧无 density 设置位。

### 1.3 globalThis 桥与 `ctx.theme` 上有无字体钩子

- `globalThis` 上**没有宿主提供的字体钩子**：本仓读到的 `__dshPrompt*` 全是自家槽——`__dshPromptHostCaps`（`remote.ts:87-104`，已废弃）、`__dshPromptStableOpen`（`remote.ts:318`，宿主 0.1.7 无此函数）、`__dshPromptGoRemoteSettings`/`__dshPromptGoSettings`（自家 DOM 钩，`settings.ts:240`、`index.ts:199`）、`__dshPromptLog`（自家日志槽）。宿主 0.1.7 包内无 `StableOpen` 语义的全局函数。
- 官方字体钩子存在，但在本仓门外：`ctx.theme`（需在 `package.json` 的 `dsh.client.inject` 声明 `"@deepseek-ai/dsh-client-ui-theme"` 才能拿到）。宿主 README 原文：“Feature plugins **consume the current snapshot through `ctx.theme`** and read the `--dsw-*` tokens in CSS; **they do not manage theme state themselves.**”（Use this package 节）；“Registering a theme … Removing one never overwrites the last durable built-in preference. **Third-party theme ids remain an in-process extension and do not cross the built-in settings schema.**”（Registering a theme 节）。
- `ctx.theme` 能力面（`lib/client.js`）：
  - `getTheme()` 读快照（含 `fontSize`）；
  - `setFontSize(px)`——“the only font-size write entry”，12–17 整数，外抛错（`:1417-1430`）；
  - `overrideTokens(source, tokens)`——别名 token 覆盖层，按 `seq` 折叠、传 `{}` 卸载恢复，**只管 token 层**（`:1468-1490`）。往 override 里写 `--dsh-content-font-size` 是错误的——应走 `setFontSize`（姊妹篇已引 theme-studio `apply.js:19-25` 立规矩，本次不复拉包，结论沿用）。
- 本仓今天没有 `ctx.theme`：`package.json:82-85` 的 `dsh.client.inject` 只有 `@deepseek-ai/dsh-client-runtime` 与 `@deepseek-ai/dsh-client-ui-slots`，`engines.dsh >=0.1.5-rc.1` 只声明版本下限（`package.json:87-89`）。要碰官方写面，必须先新增 inject（= 新增权限面，见 §3.4）。

### 1.4 插件能否合法改 `:root`／`body` 变量，改了有什么后果

- 技术上能（同一 document，slot 只管挂载点纪律、不管全局 cascade）：slot 是“parent-owned extension positions”，“registering into an undeclared slot … throws at load”（宿主 `dsh-client-ui-slots/README.md:12,28,46`）；但 `document.head.appendChild(style)` 不需要 slot 授权——这是姊妹篇 §3.4 已确立的“文档共享”边界，本次复验 slot README 同文。
- 法理上**不合法**：宿主 README 限定插件“consume…do not manage theme state”（§1.3 引文）。改 `:root`/`body` 变量属于 manage（改了全文档 cascade 的上游），不在授权通道内。
- 后果（按触发顺序）：
  1. **被 presenter смыв**：任何一次 `theme/change`（切主题、调官方步进器、重连 refetch）都会重放 `body.style.setProperty('--dsh-content-font-size', snapshot.fontSize)` 并 `removeProperty` 上次 token 后重写（`ui-layout/lib/client.js:539-543,677-678`）。插件写 `:root` 的同名变量会被 body 行内值在派生链上游赢掉；插件直接写 body 行内则在下一次重放时被宿主值覆盖——“谁后写谁赢”，宿主有持续重放权，插件没有。
  2. **重启被 bootstrap 覆盖**：`bootThemeInjections` 按 durable 值重写 body 行内 var（`lib/index.js:67-80`），插件靠自启重注续命——两套持久化各说各话（本仓 `remote.ts` 落盘 vs 宿主 `ui-theme` namespace），关插件即“掉妆”。
  3. **官方步进器显示旧值**（两个真相）：宿主值没变，设置页仍显示原 px；用户在两处看到两个“真相”（姊妹篇 §6 第 1 宗罪；theme-studio 曾把静默 shadow 定性为 bug）。
  4. **px 定死处不跟**：`small/code` 阶梯与静态字号 token（`--dsw-font-xl-24:24px`、`--dsw-font-s-14:14px` 等，见 `:1160` 行）不读 delta——整机“等比放大”在此即破（用户要的恰恰是等比）。
  5. **冲突无仲裁**：后来者居上的 cascade 军备竞赛（姊妹篇 font-enhancer 实证），宿主 snapshot 有注册顺序折叠语义，野路子没有。

## 2. 插件能合法触达的整机缩放手段（归属表）

| # | 手段 | 归属 | 插件能否合法触达 | 能否实现“1–10 档等比放大整机” |
|---|---|---|---|---|
| A | `ctx.theme.setFontSize(12–17)` | 宿主 theme 服务（官方写面） | 需新增 `dsh.client.inject` 声明 theme（新权限面）；本仓今天没有（`package.json:82-85`） | ❌ 范围锁死 6 档整数（越界抛错，`client.js:1422`），只管内容字号，不管控件/布局/缩放；10 档→6 档映射必然有损（§3.2） |
| B | `ctx.theme.overrideTokens` 别名覆盖 | 宿主 theme 快照层（官方通道） | 同上需 inject | ❌ 只管配色/别名 token，不管字号轴；写 `--dsh-content-font-size` 是错误用法 |
| C | 全局 `<style>` + `!important` 改整机观感 | 无归属（文档级 cascade 副作用） | 技术上能、法理上野路子（§1.4） | ⚠️ 看起来大了、宿主值没变；§1.4 的 5 条后果全中；且定死 px 处不跟，不等比 |
| D | 自家 host 半新增 `/_dsh/dsh-prompt/system/*` 路由 + Node 调 OS（如方向先例 `system/orientation` 经 spawn powershell 调 Win32，`lib/index.js:649-750`，`research/windows-orientation-pathways.md`） | 本插件自家 host 半（Node 与屏同机时可达 OS） | 能（自实现，不求官方） | ⚠️ 能动的只会是 **OS 显示层**（DPI 缩放/分辨率/方向），不是“DSH 字体”；且 DPI 是整机显示模式（改分辨率布局、闪屏、需控制台会话、RDP 受限，见 orientation 研究 §4.4–4.5），与“所有字体等比放大”语义不同，杀鸡用牛刀 |
| E | UU 串流缩放/显示模式 | UU 应用（串流端） | ❌ 插件观测不到手机视口与串流比（`docs/adr/0002-remote-panel-sizing.md:3-5`），更写不了对端配置 | ❌ 归属错位：那是视频流缩放，不是字体 |
| F | 浏览器 chrome 缩放 | 浏览器（用户/agents 侧） | ❌ 文档内 JS 无设浏览器整机缩放的 API（插件权力边界 = slots + 声明注入的 `ctx.*` + 同文档 cascade，姊妹篇 §1 边界句；H1 篇 §3–§4 document vs OS 论证） | ❌ 归属错位；CSS `zoom`/transform 只转自家盒子（H1 篇 §3.5 同理） |
| G | OS DPI/显示缩放（设置→显示→缩放） | OS（Windows 显示设置） | 仅经 D 路径（自家 host 半调 Win32）可达ire，直改字体无 API | ❌ 同 D：动的是整机显示模式，不是 DSH 字号；副作用（闪屏/布局重排/多屏/注销持久）远超字体诉求 |

一句话归属：**DSH 字体归 theme 服务（A/B），整机显示模式归 OS（D/G），串流画面归 UU（E），浏览器 chrome 归浏览器（F）——插件文档 JS 的合法手只够得着 A/B（还需先申请 inject），C 是无门槛但不合法的副作用，D/G 是自家 host 半能走但语义不对的远路。**

## 3. 桥接方案建议（如果非要做）

### 3.1 机会主义调用的形状（唯一可辩护的形状）

只允许“官方通道 + 失败回退自家”，不允许写 `:root`/body 行内、不允许全局 `<style>`：

```ts
// 伪形：仅示意调用顺序，不引入新依赖
async function applyRemoteSizeToHost(size: 1|2|…|10): Promise<'applied-host'|'self-only'> {
  try {
    const theme = (globalThis as any).__dshHostTheme /* 或 ctx.theme（需 inject） */;
    if (!theme || typeof theme.setFontSize !== 'function') return 'self-only';
    const px = sizeToHostPx(size);          // §3.2 映射，钳制 12–17 整数
    theme.setFontSize(px);                  // 宿主承认的值，官方步进器同步
    return 'applied-host';
  } catch { return 'self-only'; }            // 失败一律回退：自家面照大
}
// 关闭/卸载时：setFontSize(originalPx) 恢复（抄 theme-studio reset 形状）；总闸永不因失败置灰。
```

要点：调用位只在“用户改档/开关”边上；`__dshPromptStableOpen` 式“宿主有就顺手用、没有就只管自家”（`remote.ts:311-313` 注释）是本仓已接受的体例，字体桥若做必须同体例——**不门控、不灰行、不明示待宿主**（去宿主化后回归已禁止灰字，`test-issue-83.cjs:117,238`）。

### 3.2 档位映射（必然有损）

宿主只有 6 个整数位（12–17），插件有 10 档等距（100%–325%，步进 25%）。任何映射都是单向有损，例如 `1→12, 2→13, 3→13, 4→14, 5→14, 6→15, 7→15, 8→16, 9→16, 10→17`——高档（275%–325%）在宿主侧全部钳死在 16–17px，自家面 3.25x vs 整机 17px 的观感落差会直接暴露“联动”名不副实。且宿主步进器语义是“内容字号”，插件档位语义是“面板整体倍数”，两者量纲不同，硬映射是范畴嫁接。

### 3.3 失败回退

- 无 `ctx.theme`（未声明 inject）→ `self-only`，静默只大自家；
- `setFontSize` 抛错（越界/非整数）→ `self-only`；
- presenter 重放 смыв（用户随后动了官方设置）→ 以宿主为准，插件不重写、不 clobber，只记一条 `warn` 日志（事件清单需先收敛）；
- 关闭远程/卸载 → 恢复进入前记录的 `originalPx`（一次性 `getTheme().fontSize` 快照）。

### 3.4 风险清单

1. ** смыв**：`theme/change` 每次重放 body 行内字号（`ui-layout/lib/client.js:539,677-678`）；插件若试图补写就会打乒乓，不补写则“联动”随时掉线。
2. **px 定死处不跟**：small/code/静态阶梯不读 delta（`client.js:1160`），“等比”在宿主侧即不成立，高档落差最大。
3. **布局顶爆**：宿主各面按 12–17px 设计，插件档位上到 250%–325% 时即使宿主字号钳在 17px，自家面板（锚点上方全高 + 内部相对缩放，ADR-0002）与宿主 chrome 的尺寸假设也会打架；小窗/窄视口下顶爆风险由用户认（`remoteView.ts:94-96` 已言明自家面风险，整机侧风险更大）。
4. **双真相**：官方步进器 vs 插件滑块各说各话（除非全走 `setFontSize` 且映射可解释，否则必现）。
5. **插件冲突**：与其他主题/字体插件（palette/font-enhancer/theme-studio 类）的 cascade/override 叠加无仲裁，后注者赢。
6. **持久化分叉**：本仓 `remote/set` 落盘 vs 宿主 `ui-theme` namespace 落盘（`$DSH_HOME/cordis.patch.yml`），卸载/重装/多端漫游时两套值打架。

### 3.5 是否建议推翻“禁止依赖官方”拍板

**不建议。** 理由：

- 可选桥（A）的全部收益 = “官方步进器同步显示 + 重启不掉妆”这两项体面，代价 = 新增 `dsh-client-ui-theme` inject 权限面 + 10→6 有损映射 + 只管字号不管控件 + 恢复/冲突/分叉整套运维。收益是装饰性的（ADR-0002 已证明“点得中不依赖整机字号”，姊妹篇 §4），代价是结构性的。
- 野路子（C）与 OS 远路（D/G）更不值得：前者违反宿主“只消费不管理”契约（README 原文），后者把字体诉求翻译成显示模式变更，副作用等级完全不对等。
- 若将来宿主官方出“整机缩放”设置位（今天没有，§1.2），届时再以 H 需求重议；今天为 6 档字号去推翻整仓去宿主化 posture，是倒挂。
- 唯一可接受的例外（仍不建议现在做）：把 A 做成“等待期改善”而不关闭任何立场——声明 inject、用官方通道、映射文案写明“字号可跟官方 12–17，控件整机无位”（姊妹篇 §7 第 3 条原提案）。但在当前 CONTEXT “明确不做”（`:63-65`）+ 回归“禁灰字”（`test-issue-82/83`）下，连这个例外也会重新引入“宿主依赖项”的心智负担，**本次仍建议不做**。

## 4. 来源清单（每个主张的落点）

- 本仓拍板：`D:\dsh-plugin\dsh-prompt\CONTEXT.md:47`（远程只管大/小）、`:52-57`（方向偏好替代整机真切）、`:63-65`（整机字号跟随明确不做）。
- 档位与自家面：`src/client/remoteView.ts:86-100`（倍数表/Chrome 全额）、`:193-216`（同一倍数/仅开生效/兼容保留 hostCaps）；`src/client/panel.ts:1056,1076,1192-1193`（面板字号与远程乘数）；`src/client/button.ts:134-135,169,189,211`（入口跟随）；`src/client/smart.ts:203,345`（智能卡跟随）；`src/client/settings.ts:431-450`（预览 transform）；`src/client/remote.ts:306-344`（stable-else-dom）、`:76-97`（caps 废弃）。
- 去宿主化回归：`scripts/test-issue-82.cjs:98`（禁灰行）、`scripts/test-issue-83.cjs:117,238`（恒可用/禁灰字）；`src/client/settings.ts:377-465`（当前远程段无灰行）；stale 词条 `src/client/i18n.ts:109-113`、`lib/client.js:1704`（非活面）。
- 自实现先例与路由表：`src/client/systemOrientation.ts:1-10`（对端自实现声明）；`lib/index.js:390-396`（KNOWN_ROUTES，无 system/font）；`lib/index.js:649-750`（orientation powershell/Win32 实现）；`research/windows-orientation-pathways.md`（Win32 通路一手）。
- 宿主 theme（`C:\Users\辰辰洋洋\.dsh-versions\dsh-0.1.7-rc.2\node_modules\@deepseek-ai\dsh-client-ui-theme\`）：`README.md`（Summary 12–17px + `$DSH_HOME/cordis.patch.yml`；“consume…do not manage”；Registering a theme in-process extension）；`lib/index.js:11`（ui-theme）、`:19,21,26,82`（12/17/schema/volatile）、`:47-60`（body 行内 bootstrap）、`:67-80`（index 注入）；`lib/client.js:1142`（`:root --dsw-font-family`）、`:1160`（body 派生链 + 定死 px）、`:1050-1087`（步进器行）、`:1417-1430`（唯一写面越界抛错）、`:1468-1490`（overrideTokens 层语义）、`:1614-1620`（bridge id font-size）。
- 宿主 presenter：`dsh-client-ui-layout/lib/client.js:532-547`（apply 重放 body 行内 + token 替换）、`:677-678`（theme/change 订阅）。
- 宿主 slots 纪律：`dsh-client-ui-slots/README.md:12,28,46`（parent-owned；undeclared throws）。
- 宿主无缩放（零命中复验，2026-09-29）：`zoom` 于 theme `lib/{index,client}.js` 零命中；`accessibility|a11y` 于 settings `lib/*.js` 零命中；settings-general 命中仅组件固定 px/`prefers-reduced-motion`。
- 本仓形态：`package.json:82-89`（inject 仅 runtime+slots；engines 下限）；`docs/adr/0002-remote-panel-sizing.md:3-5`（串流等比、观测不到手机视口与缩放比）。
- 规格史：`.tmp-verify/issue-edit/issue-85.md:12,22,37-39,53-55`（旧三档/H1/H2/宽门槛原文——已被去宿主化修订覆盖，仅作史料）；`docs/adr/0002-remote-panel-sizing.md`（现行尺寸决策）。
- 第三方机制（沿用姊妹篇，不复拉包）：`research/host-vs-plugin-h2-fontui.md §5–§6`（font-enhancer 全局 style、palette 双轨、theme-studio 官方通道 ceiling、四宗罪）。
