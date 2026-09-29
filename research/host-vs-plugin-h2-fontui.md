# 插件层能否实现“更改DSH字体大小和UI大小（整机字号/控件三档）”——决策研究报告

- 日期：2026-09-29
- 问题：DSH web 插件在插件层能否实现“更改DSH字体大小和UI大小（整机字号/控件三档）”，而不依赖 DSH 宿主新增 H2 API？
- **结论（一句话）：分三层。L0 自家面放大——能，且已实现（#83），standalone 足够解决“拿远点得中”；L1 整机内容字号“观感”——插件层能改（两条路，见 §4–§5），但改的是文档级 CSS cascade，不是宿主设置值；L2 整机 UI 大小（宿主级字号设置 + 控件尺寸/布局缩放 + 稳定直达）——插件层做不到，必须宿主 H2，#87 应维持。**
- 范围：只改认知、不改源码、不动 issue。本文件为 research 记录，供 #87 决策引用。与姊妹篇 `research/host-vs-plugin-h1-orientation.md`（H1 整机真切：结论“不能”）对照看：H2 不是全否，而是有条件分层。

## 1. 结论与边界

| 能力 | 插件层能否做 | 说明 |
|---|---|---|
| L0 自家面板变大（远程大列表十二槽 + 字号/控件三档乘数） | ✅ 能（已实现，零宿主依赖） | `computeRemoteView` 纯函数 + 面板内相对单位，见 §2 |
| L1a 整机内容字号观感（官方通道 `ctx.theme.setFontSize`，12–17px） | ✅ 能（但须声明注入 theme，且范围被宿主锁死） | theme-studio 实证，见 §5.3；本仓未注入 theme，见 §2 |
| L1b 整机字号/配色观感（野路子：全局 `<style>` + `!important`） | ⚠️ 改得动，但脆弱、不同步、易碎 | font-enhancer / palette 实证，见 §5.1–§5.2；四宗罪见 §6 |
| L2a 宿主级字号设置（durable namespace + 重启 bootstrap + 与官方步进器同一值） | ❌ 插件层写不了 | 宿主 `ui-theme` namespace 归 theme service 所有；插件“只消费不管理”，见 §3 |
| L2b 整机控件尺寸/布局缩放（所谓“UI大小”、zoom、density） | ❌ 无 API | 宿主无 zoom；density 只是字号别名，见 §3.3 |
| L2c 稳定直达（配置键一点即达远程段） | ❌ 插件层只有 DOM 兜底 | `openRemoteSettings` 的 stable 分支无宿主实现，见 §2 |

边界一句话：**插件代码的权力边界 = 宿主给的 slots（含 DOM 范围）+ 声明注入换来的 `ctx.*` 服务 + 同文档 CSS cascade 的副作用；前两者都不含“写宿主设置”，后者能“看起来改了整机”但不是“宿主设置被改了”。**

## 2. 本插件客户端实际能碰到的东西（仓内证据）

- 本插件是标准 DSH web 插件：`package.json` 第 72–87 行声明 `dsh.client.platform=web`，`inject` 只有 `@deepseek-ai/dsh-client-runtime` 与 `@deepseek-ai/dsh-client-ui-slots`——**没有 `@deepseek-ai/dsh-client-ui-theme`**，即没有 `ctx.theme`（`D:\dsh-plugin\dsh-prompt\package.json:72-87`）。
- 客户端装配点全是 slots：`conversation.input.left`（入口按钮）、`conversation.input.overlay`（面板浮层）、`settings.section`（配置页）、`shell.overlay`（智能卡/更新自检）（`src/client/index.ts:129-149,207-214`）。
- 样式只读不写：全仓 `var(--dsw-*)` 均为**引用**（`src/client/settings.ts:33-43` 的 `TOK` 表、`src/client/panel.ts:972-1025` 的样式常量），无一处向 `document`/`body` 写变量、无 `zoom`、无全局 `<style>` 注入（`grep zoom|documentElement|setProperty src/` 零命中，见任务记录）。
- 自家 portal 仍在同一文档：`TopPortal` 把面板挂到 `document.body`，逃的是**层叠上下文**不是文档（`src/client/panel.ts:651-673`，注释写明“逃离宿主 slot 的祖先层叠上下文”）。含义：别人（font-enhancer 之流）的全局 CSS 同样能盖到我们头上，反之我们若注入全局 CSS 也能盖到别人——文档是共享的，slot 只是挂载点纪律。
- 字号/控件三档今天只作用于自家面：`remotePanelStyle.fontSize = 'calc(1em * ' + remoteFontScale + ')'`（`src/client/panel.ts:1108-1122`），底栏大键 `minHeight: 'calc(3em * ' + remoteControlScale + ')'`（`src/client/panel.ts:1204-1214`）；乘数定义 `remoteFontScale` 0.85/1/1.32、`remoteControlScale` 0.85/1/1.45（`src/client/remoteView.ts:57-69`）。**“控件三档”是本仓自创概念，宿主侧无对应物**（§3.3）。
- 宿主两行灰行 + 稳定直达兜底：设置页 `remote-sys-orientation` / `remote-sys-font` 两行 `disabled: !caps.has*` 并后缀“整机待宿主”（`src/client/settings.ts:385-397`）；`getRemoteHostCaps()` 在 #86/#87 落地前恒缺席（`src/client/remote.ts:60-74`）；`openRemoteSettings()` 的 stable 分支要求宿主提供 `globalThis.__dshPromptStableOpen`，缺席即落到 `__dshPromptGoRemoteSettings` DOM 触发（点设置按钮→轮询等导航项→滚入视野，`src/client/remote.ts:272-301`，`src/client/index.ts:157-199`）。**宿主 0.1.7 无此全局函数**（host 包内无 `StableOpen` 符号，能力位是本仓自封形状）。
- 术语锚点（`CONTEXT.md:47-57`）：远程模式“只管大/小这一件事，不含整机缩放”；“整机真切依赖宿主 H1”；自适应布局“恒开、零宿主依赖”。

## 3. DSH 宿主侧：插件今天能调用什么、不能调用什么

宿主版本：`C:\Users\辰辰洋洋\.dsh-versions\dsh-0.1.7-rc.2\node_modules\@deepseek-ai\`（`dsh@0.1.7-rc.2`）。以下全部第一手。

### 3.1 宿主的字号设置长什么样（theme 包 README + schema 源码）

- `dsh-client-ui-theme/README.md`（Summary）：“lets Web GUI users choose `light`, `dark`, or `system` and **set conversation content text from 12 to 17 px in Settings**”，持久化在 `ui-theme` settings namespace。Appearance and font size 节：“stepper accepts integer values **from 12 through 17 px and defaults to 14 px** … Each accepted change writes through the **Host settings API**.”
- 关键约束句（Use this package）：“Feature plugins **consume the current snapshot through `ctx.theme` and read the `--dsw-*` tokens in CSS; they do not manage theme state themselves.**”（插件只消费、不管理主题状态。）
- schema（`dsh-client-ui-theme/lib/index.js:19-26,82`）：`FONT_SIZE_MIN = 12`、`FONT_SIZE_MAX = 17`（`:19,:21`），`z.number().step(1).min(12).max(17).default(14)`（`:26`），live Config 同值 `.volatile()`（`:82`）。
- bootstrap（同文件 `bootThemeBodyScript`）: `document.body.style.setProperty('--dsh-content-font-size', '"14px"')`——宿主把字号写在 **body 行内样式**（inline style），这是插件 stylesheet 规则覆盖不了的那一层（行内 > 样式表）；插件要改“宿主承认的字号”只能走服务，不能靠 CSS 覆盖。
- client 侧（`dsh-client-ui-theme/lib/client.js`）：`setTheme(id)`（`:1409`）、“Change the conversation content font size — the only font-size write …”（`:1417` 起）、`document.body.style.getPropertyValue("--dsh-content-font-size")`（`:1531`）、bridge `{ setTheme, …, id: "font-size" }`（`:1599-1600,:1620`）。

### 3.2 `ctx.theme` 给插件的писан契约（由 theme-studio 的用法反推 + 宿主 README 印证）

插件须在 `package.json` 的 `dsh.client.inject` 里声明 `"@deepseek-ai/dsh-client-ui-theme"` 才能拿到 `ctx.get('theme')`（theme-studio 的 manifest 即如此，§5.3）。能力面（theme-studio 实测可用）：

- `ctx.theme.overrideTokens(sourceId, { token: { light, dark } })`——别名 token 覆盖层，按注册顺序折叠进 active snapshot；传 `{}` 即卸载恢复（`dsh-theme-studio@0.6.3 lib/theme-studio.web.js:1376,1394,1406`）。
- `ctx.theme.setFontSize(px)` / `ctx.theme.getTheme().fontSize`——**官方内容字号的唯一写面**，12–17 外抛错（同文件 `:1382-1385`；`FONT_SIZE_MIN/MAX` 常量与宿主同值）。
- 宿主 README 印证（Registering a theme）：“register alias-token overrides through `ctx.theme` … **Removing one never overwrites the last durable built-in preference. Third-party theme ids remain an in-process extension and do not cross the built-in settings schema.**”（第三方只是在进程内叠加，不进入内置 settings schema。）

### 3.3 宿主没有的东西：zoom、UI 缩放、控件尺寸

- `zoom` 在 `dsh-client-ui-theme/lib/{index,client}.js` **零命中**；`dsh-client-ui-settings-general` 内 `zoom|uiScale|fontSize` 命中全是组件自身固定 px CSS（如 `font-size:14px` 行内组件样式），无任何缩放设置项。
- 宿主 settings schema 里与“大小”相关的只有 `fontSize` 12–17（§3.1）。**没有“控件尺寸”“界面密度”“UI 缩放”设置项。** theme-studio 的 density（三档 compact/comfortable/spacious）经查只是官方字号的别名：`DENSITY_FONT_SIZE = { compact: 13, comfortable: 14, spacious: 16 }`（`dsh-theme-studio@0.6.3 lib/theme-studio.web.js:266-270`），面板文案自述“直接写入官方「外观」的字号设置（当前 {px}px），与官方控件始终一致”（同文件 `:52` / `:100` 中英）。**density ≠ UI 缩放，密度三档就是字号三档。**
- 推论：本仓“控件三档”（按钮键高乘数）在宿主侧没有对应设置位；“整机控件跟手”在宿主 0.1.7 **无 API 可达**，这是 H2 必须存在的核心理由之一。

### 3.4 DOM 隔离边界（slot 纪律 vs 文档共享）

- slot 是“父拥有的扩展位”：`dsh-client-ui-slots/README.md`（Use this package）“register a component into a slot your parent declared”；Declaration discipline 节：“registering into an undeclared slot, … throws at load”（向未声明的槽注册直接抛错）；entry disposer 会递归坍缩其声明的子槽。
- 但文档是共享的：任何插件的 client JS 都跑在同一 document 里，`document.head.appendChild(style)` 不需要 slot 授权（§5.1–§5.2 两个活例子）。所以隔离边界是：**DOM 挂载点受 slot 纪律约束，全局 CSS cascade 不受任何约束**——“整机字号观感”走的正是后者这条无门槛小路。

## 4. 先回答“自家面先大是否已足够”：是，对远程诉求已足够

- ADR-0002 的构造性论证（`docs/adr/0002-remote-panel-sizing.md:3`）：UU 全桌面适配下屏占比是不变量，面板取“锚点上方全部可用高度 + 内部相对缩放”，字号/控件三档是自动基准之上的乘数，“与分辨率解耦是构造性成立”。即：**点得中不依赖整机字号**，自家面先大即满分交付。
- #85 宽门槛（`src/client/remote.ts:8-9`、`src/client/remoteView.ts:186-189`）：总闸只以自家面能否真变大为准，宿主缺席不清零、仅灰行写明“整机待宿主”。 posture 正确，无需回退。
- 整机跟手是加分项（一致性、切回小屏不晃眼、用户心理“整机都大了”），不是远程可用的必要条件。验收 #84 不应把整机跟手列为远程总闸的前置。

## 5. “其他人做的DSH插件能够更改DSH字体大小和UI大小”——核实结果：半真，偷换了概念

核实方法（与 H1 姊妹篇同）：只认源码/文档。`npm pack` 拉三家真实插件的发布 tarball（包名+版本见下），解包后读 client 注入表与作用机制。tarball 解包留存 `D:\Temp\palette-probe\`、`D:\Temp\font-probe\fe|ts\`、`D:\Temp\sidebar-probe\package\` 可复验。

### 5.1 dsh-font-enhancer@1.4.13 —— 野路子改整机字号观感的活证据（无 theme 注入）

- 包：`dsh-font-enhancer@1.4.13`，slogan“DSH 界面字体全权 DIY：按区域自定义中英文字体/**字号**/字重/颜色”（`fe/package/package.json:3`，description）。README：“15 个预校准区域…每区域独立设置：中文字体、英文字体、**字号**、行距、字重…「统一字体」：一种字体+**字号**应用到所有启用区域；「框选区域」：在实时页面上拖框直接选中元素”（`fe/package/README.md` 功能总览节）。npm：https://www.npmjs.com/package/dsh-font-enhancer
- 注入表：`@deepseek-ai/dsh-client-connection, dsh-client-runtime, dsh-client-ui-settings, dsh-client-ui-slots, dsh-client-locale`（`fe/package/package.json` 的 `dsh.client.inject`）——**没有 ui-theme，没有 `ctx.theme`**。
- 机制（`fe/package/lib/client.js`）：`buildRegionCss` 逐区域拼 `font-size: <size>px !important;`（`:596-613`，字号行 `:609`，另有 family/weight/style/color 全 `!important`）；`applyAll` 把启用区域的 CSS 写进 **`document.head` 里的全局 `<style id="dsh-font-enhancer-style">`**（`:614-644`，建标签 `:636-642`）。默认区域直接定位**宿主 chrome**：`[data-slot="sidebar"]`、`[data-slot="markdown"]`、`[data-slot="conversation.composer"]` 等 9 项（`:469-494`，注释“校准自 DSH 2.0.4 真实 DOM”）；`withText` 把选择器扩成 `sel, sel *, sel text`（`:584-595`，注释承认 `body *` 会命中所有元素、可能破坏交互布局，`:589-591`）。
- 定性：**真改了整机字号观感**（文档级 cascade + `!important` 压过宿主组件样式），但（1）宿主 `ui-theme` namespace 的值没变（官方步进器显示原值、重启 bootstrap 按原值重写行内 var）；（2）`[data-slot]`/`CSS-Modules` 哈希类名随宿主升级可变（源码注释自认“尽量用 data-slot 定位”，`:470-473`）；（3）`!important` 军备竞赛（自家注释“(re)append last to beat the !important base css”，`:246`）。——**观感级整机，无设置级整机。**

### 5.2 dsh-opencode-palette@2.0.5 —— 授权通道（overrideTokens）+ 野路子（全局排印 CSS）双轨

- 包：`dsh-opencode-palette@2.0.5`，38 款皮肤一键换（`package/package.json:3` description）。npm：https://www.npmjs.com/package/dsh-opencode-palette ；仓库 https://github.com/FeatherHunter/dsh-opencode-palette
- 注入表：`dsh.client.inject = ["@deepseek-ai/dsh-client-ui-theme"]`（`package/package.json` 的 `dsh.client` 节）——**有 `ctx.theme`**。
- 机制（`package/lib/client.js`）：`apply(ctx)` 取 `ctx.get('theme')`（`:10230`）；`applyStyle()` 三步：清旧层→重生成→**`tokenDispose = theme.overrideTokens('opencode-palette', render.tokens)`**（`:10316`，授权通道改整机配色）+ 自家 `<style data-plugin="dsh-opencode-palette">` 挂 `document.head` 写 `render.css`。`buildTypographyCss` 输出选择器是 **`body,body[data-ds-dark-theme]`**（`:1529`），内容含 `--dsw-font-family`、`--dsw-font-markdown-base:<size>px/<lh>px`、`--dsw-font-markdown-base-font-size:<size>px` … 及 **`body{font-size:<size>px;}`**（`:1530-1567`、`generateTheme :1573-1586`，默认 size=13）。
- 定性：配色是**授权整机**（overrideTokens 进 active snapshot，卸载 `clearStyle` 恢复）；字号是**观感整机**（全局样式表短路宿主 `--dsw-font-markdown-*` 派生链——宿主这些 var 由 `--dsh-content-font-size` 派生，`gradient-shadow-text.css`，见 §3.1——但宿主行内 `--dsh-content-font-size` 本体与官方步进器值不动）。同样是观感级字号 + 授权级配色。**没有 UI 缩放，没有控件尺寸。**

### 5.3 dsh-theme-studio@0.6.3 —— 官方通道改“宿主承认的字号”，范围锁死 12–17

- 包：`dsh-theme-studio@0.6.3`，“12 accent presets … **density, font family**, animation toggle, and raw design-token overrides”（`ts/package/package.json:3`）。npm：https://www.npmjs.com/package/dsh-theme-studio
- 注入表：`["@deepseek-ai/dsh-client-ui-renderer", "@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-settings", "@deepseek-ai/dsh-client-ui-theme"]`（`ts/package/package.json` 的 `dsh.client.inject`）——**有 `ctx.theme`**。
- 机制（`ts/package/lib/theme-studio.web.js`）：bridge 读 `ctx.theme.getTheme().fontSize`（`:1382`）、写 `ctx.theme.setFontSize(px)`（`:1383-1385`，先记 `originalFontSize`）；卸载/reset 恢复 `overrideTokens(SOURCE, {})` + `setFontSize(originalFontSize)`（`:1393-1408`）。density 三档只是字号别名（`:266-270`，compact 13 / comfortable 14 / spacious 16），面板文案自证“直接写入官方外观的字号设置”（`:52/:100`）。源码注释三处立规矩：`apply.js:19-25` “WHAT THIS MODULE DELIBERATELY DOES NOT DO: write `--dsh-content-font-size`（走 overrideTokens 写它是错的）… `ctx.theme.setFontSize()` in client”；`tokens.js:183-191` 同；`types.js:35-42` 记录历史事故——density 默认 comfortable **静默写了 14px 并 shadow 了官方步进器**，“installing the plugin and touching nothing silently …”（装上不动就改宿主观感是 bug，不是 feature）。
- 定性：这是插件层能摸到的**天花板**——宿主承认的字号值（同一 namespace、官方步进器同步显示），代价是（1）必须声明 theme 注入（本仓今天没有）；（2）范围锁死 12–17（`setFontSize` 越界抛错）；（3）只管内容字号，不管控件/布局/缩放。**“UI大小”不在其射程内。**

### 5.4 对照组 dsh-better-sidebar@0.24.1 —— 大 UI 面 ≠ 整机字号

- 包：`dsh-better-sidebar@0.24.1`（文件树/编辑器/侧聊大面板，https://github.com/omdsh-dev/DSH-better-sidebar ）。client 内 `font-size:\d+px !important` / `dsh-content-font-size` / `overrideTokens` / `setFontSize` **全零命中**；唯一沾边命中是自家 scoped CSS-Modules（`package/lib/client.js:13487`，`d2hvtW_*` 哈希类，只画自家画布/节点）。——证明“自家面做大做全”是常态操作，不附带整机字号；拿“某插件 UI 很大”论证“它改了整机字号”是范畴错误。

### 5.5 小结：声称的真实所指与概念纠偏

| 声称里的词 | 真实所指（源码级） | 宿主设置被改了吗 | UI 缩放了吗 |
|---|---|---|---|
| “改 DSH 字体大小”（font-enhancer） | 全局 `<style>` + `!important` 按区域写字号 | ❌（官方步进器值不动） | ❌ |
| “改 DSH 字体大小”（palette） | 全局排印 CSS 重写 `--dsw-font-markdown-*` + `body{font-size}` | ❌（行内 `--dsh-content-font-size` 本体不动） | ❌ |
| “改 DSH 字体大小”（theme-studio density） | `ctx.theme.setFontSize(13/14/16)` | ✅（同一值，官方步进器同步）但范围锁 12–17 | ❌（density 只是字号别名） |
| “改 DSH UI 大小” | **查无实据**：三家无一家碰 zoom/控件尺寸/布局缩放；宿主侧亦无此设置位 | — | ❌ |

若声称方指的是 L1 观感（“装了 font-enhancer，整机字都大了”），**属实**；若指的是 L2（“宿主设置里的字号/控件档跟着走”“整机 UI 缩放”），**不属实**，建议向声称方索要**包名+版本+“UI大小”的操作定义**（改的是哪个设置项的值？重启还在吗？官方步进器同步吗？），按本节方法复验后再议。在那之前，“插件能改 UI 大小”按传言处理，不作为 #87 决策依据。

## 6. 野路子（全局 `<style>` !important）的四宗罪——为什么它不能替代 H2

1. **不同步**：宿主 `ui-theme` 值不动 → 官方外观步进器显示旧值、用户在两处看到两个“真相”；theme-studio 历史事故（§5.3 `types.js:35-42`）已证明静默 shadow 是 bug 级别行为。
2. **不持久于宿主语义**：重启 bootstrap 按 durable 值重写 body 行内 var（§3.1），插件靠自启重注续命（font-enhancer state 放 localStorage；palette `state.enabled` 默认 true 重 `applyStyle`）——两套持久化各说各话，关插件即“掉妆”，且与宿主 `storageDomain` 语义（本仓 `remote.ts:6-9` 的 fail-soft）无交集。
3. **冲突无仲裁**：文档级 cascade 后来者居上；装 font-enhancer + palette + theme-studio 三家，字号真相 = 注入顺序 + `!important` 军备竞赛（font-enhancer 源码自述 “(re)append last to beat the !important base css”）。宿主 snapshot 有注册顺序折叠语义（§3.2），野路子没有。
4. **升级易碎**：`[data-slot]` 定位 + CSS-Modules 哈希类名随宿主发版可变（font-enhancer `:470-473` 自认）；`sel *` 扩散曾把兄弟区域染色（`:577-583` 注释记录的 bleed 事故）。宿主每发一版都是一次回归抽奖。

结论：**野路子是“看起来整机”，H2 要的是“宿主承认的整机”**——durable、可仲裁、可恢复、与官方控件同一值。两者差的正是 H2 的全部工作量。

## 7. 对 #87 的影响建议：维持宿主需求，可加短期桥接，不拆 H2

#87（H2 宿主需求：整机字号控件 API + 稳定直达）维持，理由：

1. **维持 #87**：L2（宿主级字号设置位 + 控件尺寸/布局缩放 + 稳定直达）在插件权力边界之外（§1–§3）；“其他插件能做”的传言经三家源码核实，最多只到 L1 观感（§5），且野路子有四宗罪（§6）。撤销 #87 等于宣判“宿主承认的整机”不存在。今天的宽门槛 posture（总闸不因 H2 缺席清零、仅两行置灰写明“整机待宿主”，`src/client/settings.ts:385-397`）正确，无需回退。
2. **不改为“纯插件自做”**：若用野路子全局 `<style>` 实现“整机跟手”，验收 #84 会被污染——“看着大了”与“宿主设置大了”混淆，且与官方步进器打架（theme-studio 踩过的坑，§5.3）。ADR-0002 的验收口径（记录 UU 显示模式）也要求效果可归因，野路子给不出。
3. **可选短期桥接（提案，不动 issue，仅供 #87 讨论）**：在 H2 落地前，本仓可声明 `dsh.client.inject` 追加 `@deepseek-ai/dsh-client-ui-theme`，用**官方通道**实现“字号跟手”——把自家字号三档映射到官方 12–17（如 small→13 / medium→14 / large→16，沿 theme-studio density 别名），经 `ctx.theme.setFontSize` 写宿主承认的值；卸载/关闭时恢复原值（抄 theme-studio `:1393-1408` 的 reset 形状）。代价与红线：① theme 注入是新权限面，需用户知情（安装时不动声色改宿主字号 = theme-studio 定性的 bug）；② 映射是单向有损的（自家三档 vs 官方 6 档），大档 16 ≠ 自家 1.32 乘数的观感；③ **控件档仍仅自家面**（宿主无控件尺寸位，§3.3），灰行文案可细化为“字号可跟官方 12–17，控件整机待宿主”。桥接不关闭 #87，只改善等待期体验。
4. **H2 合约建议形状**（沿 H1 姊妹篇 §7 的拆分体例）：H2a 查询（`hasSystemFont`/`hasStableOpen`，`src/client/remote.ts:54-74` 已预留形状）；H2b 切换（字号：建议直接复用既有 `ctx.theme.setFontSize` 语义而非另起端点，缺的是**控件/布局缩放**新端点 + 稳定直达 `__dshPromptStableOpen('remote')`，`src/client/remote.ts:268-277` 已预留调用位）；#84 验收拆两项：H2 缺席验“两行置灰 + 总闸可用 + 自家三档照常”；H2 落地加验“整机跟手 + 卸载恢复 + 失败码明确”。
5. **若宿主最终宣判不做**：两行永久置灰并写明（现有分支已就绪，`src/client/settings.ts:385-397`）；自家三档与自适应布局不受任何影响（零宿主依赖，`src/client/remoteView.ts:57-69` + ADR-0002）。

## 8. 来源清单（每个主张的落点）

- 仓内定义：`D:\dsh-plugin\dsh-prompt\CONTEXT.md:47`（远程只管大/小、不含整机缩放）、`:49-51`（自适应零宿主依赖）、`:53-57`（整机真切依赖 H1）。
- 插件形态与注入面：`D:\dsh-plugin\dsh-prompt\package.json:72-87`（inject 仅 runtime+slots；engines）；`src/client/index.ts:129-149,207-214`（四处 slot 装配）；`src/client/index.ts:157-199`（goSettings DOM 触发）。
- 自家三档实现：`src/client/remoteView.ts:57-69`（乘数）、`:164-190`（threshold）；`src/client/panel.ts:1108-1122`（面板 fontSize）、`:1204-1214`（键高）、`:1360`（整机待宿主）；`src/client/panel.ts:651-673`（TopPortal）；`src/client/remote.ts:15-22`（三档类型）、`:54-74`（caps 恒缺席）、`:272-301`（openRemoteSettings）；`src/client/settings.ts:33-43`（TOK 只读）、`:339-401`（远程段）、`:385-397`（两行灰行）。
- 尺寸决策：`D:\dsh-plugin\dsh-prompt\docs\adr\0002-remote-panel-sizing.md:3-5,16-17`。
- 宿主 theme（`C:\Users\辰辰洋洋\.dsh-versions\dsh-0.1.7-rc.2\node_modules\@deepseek-ai\dsh-client-ui-theme\`）：`README.md`（Summary 12–17px + ui-theme namespace；“consume…do not manage”；Registering a theme／in-process extension）；`lib/index.js:19,21,26,82`（12/17/schema/volatile）；同文件 `bootThemeBodyScript`（body 行内 `--dsh-content-font-size`）；`lib/client.js:1409,1417,1531,1599-1600,1620`（setTheme／字号写面／读回／bridge）。
- 宿主 slots（`dsh-client-ui-slots/README.md`）：Use（parent-owned extension positions）；Declaration discipline（undeclared slot throws at load）。
- 宿主无缩放：`zoom` 于 theme `lib/{index,client}.js` 零命中；settings-general 命中仅组件固定 px；settings schema 唯一尺寸位 = `fontSize`。
- 第三方插件（`npm pack` tarball 留存 `D:\Temp\palette-probe\`、`D:\Temp\font-probe\fe|ts\`、`D:\Temp\sidebar-probe\package\`）：
  - `dsh-opencode-palette@2.0.5`（https://www.npmjs.com/package/dsh-opencode-palette ，https://github.com/FeatherHunter/dsh-opencode-palette ）：`package/package.json`（inject ui-theme）；`package/lib/client.js:10230`（apply）、`:10316`（overrideTokens）、`:10337`（setTheme）、`:1529,1573-1586`（全局排印 CSS／generateTheme）。
  - `dsh-font-enhancer@1.4.13`（https://www.npmjs.com/package/dsh-font-enhancer ）：`fe/package/package.json:3`（描述）、`fe/package/README.md`（15 区域／统一／框选）；`fe/package/lib/client.js:246`（re-append 军备竞赛）、`:469-494`（data-slot 区域）、`:584-595`（withText 扩散）、`:596-613`（字号 `!important`，`:609`）、`:614-644`（全局 style 标签）。
  - `dsh-theme-studio@0.6.3`（https://www.npmjs.com/package/dsh-theme-studio ）：`ts/package/package.json`（inject 含 ui-theme）；`ts/package/lib/theme-studio.web.js:52,100`（density 文案）、`:266-270`（13/14/16 别名）、`:1226`（density→setFontSize）、`:1376`（overrideTokens）、`:1382-1385`（bridge）、`:1393-1408`（reset／dispose）；`ts/package/lib/apply.js:19-25`（禁写 `--dsh-content-font-size`）、`tokens.js:183-191`（同）、`types.js:35-42`（静默 shadow 事故）。
  - `dsh-better-sidebar@0.24.1`（https://github.com/omdsh-dev/DSH-better-sidebar ）对照：全局字号／overrideTokens／setFontSize 全零命中；`package/lib/client.js:13487` 仅自家 scoped CSS。
- npm 检索：https://registry.npmjs.org/-/v1/search?text=dsh-plugin&size=20 、https://registry.npmjs.org/-/v1/search?text=dsh+theme+font&size=20 （2026-09-29 抓取，font-enhancer／theme-studio／catppuccin／dream-skin 等在列）。
- #87：任务给定标题“H2 宿主需求：整机字号控件 API + 稳定直达”（未读 issue 本体，未改动）。
