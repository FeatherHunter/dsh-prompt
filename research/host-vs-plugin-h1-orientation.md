# 插件层能否实现“OS横竖屏切换（整机真切）”——决策研究报告

- 日期：2026-09-29
- 问题：DSH web 插件（本仓 `src/client/*.ts` 跑在浏览器 DOM 里，经 `slots` 注入）在插件层能否实现“OS横竖屏切换（整机真切）”，而不依赖 DSH 宿主新增 H1 API？
- **结论（一句话）：不能。插件层能做且仅能做“自家面板内布局旋转/自适应”（本仓叫“自适应布局”）；“整机真切”（外部 Windows 整机跟着转）必须走宿主 H1，#86 应维持。**
- 范围：只改认知、不改源码、不动 issue。本文件为 research 记录，供 #86 决策引用。

## 1. 结论与边界

| 能力 | 插件层能否做 | 说明 |
|---|---|---|
| 自家面板 4×3 ↔ 3×4 自适应布局 | ✅ 能（已实现，零宿主依赖） | `deriveRemoteOrientation` 按视口宽高比切换，见 §2 |
| 自家面板 `requestFullscreen` 全屏呈现 | ✅ 能（但与旋转无关） | 全屏的是“某个 Element”，不是 OS，见 §3.2 |
| `screen.orientation.lock()` 锁“本文档”方向 | ⚠️ 调得动、但锁的不是 Windows | 锁的是 containing document，且桌面端通常直接拒绝，见 §3.1 |
| CSS `transform: rotate()` 视觉旋转 | ⚠️ 画得出来、但属于自欺 | 只转插件自己画的像素，UU 串流的 Windows 画面帧不受影响，还会打乱指针映射，见 §3.5 |
| viewport meta / CSS orientation 媒体查询 | ❌ 对整机无效 | 前者是视口尺寸提示，后者测的是 viewport 不是 device，见 §3.3–3.4 |
| 外部 Windows 整机旋转（显示方向真正改变） | ❌ 插件层做不到 | 显示方向是 OS 显示设置/No 级别的 Win32 状态，浏览器沙箱内无 API 可达；两条拓扑分支下均无通路，见 §4 |
| 经 `/_dsh/*` HTTP 桥“顺手”调到 OS 能力 | ❌ 无此端点 | 桥上只有存储/日志/更新类路由，见 §5 |

边界一句话：**插件代码的权力边界 = 宿主给的 slots（含 DOM 范围）+ 浏览器给文档的能力 + 自家 `/_dsh/dsh-prompt/*` 路由；三者都不含“改 OS 显示方向”。**

## 2. 本插件客户端实际能碰到的东西（仓内证据）

- 本插件是标准 DSH web 插件：`package.json` 第 72–87 行声明 `dsh.client.platform=web`，经 `slots` 注入，依赖 `@deepseek-ai/dsh-client-runtime` 与 `@deepseek-ai/dsh-client-ui-slots`（`D:\dsh-plugin\dsh-prompt\package.json:72-87`）。
- 客户端装配点全是 slots：`conversation.input.left`（入口按钮）、`conversation.input.overlay`（面板浮层）、`settings.section`（配置页）、`shell.overlay`（智能卡/更新自检）（`src/client/index.ts:129-149,207-214`）。
- 客户端读写的宿主面只有同源 HTTP 桥：`/_dsh/dsh-prompt/store`、`/_dsh/dsh-prompt/remote/set` 等（`src/client/remote.ts:87-88`、`src/client/store.ts:47-51`）。没有也不可能有 OS 调用——浏览器 JS 调不到 Win32。
- “自适应布局”是纯视口函数：`deriveRemoteOrientation(width, height)` 只比宽高（`w >= h` 即横屏，否则竖屏，非法回横屏），监听 `window.resize`（`src/client/remoteView.ts:46-55`、`src/client/panel.ts:878-901`）。这正是 CONTEXT 对它的定义：“远程模式下按视口比例自动切 4×3 与 3×4 的布局规则。恒开、零宿主依赖”（`CONTEXT.md:49-51`）。
- “整机真切”在本仓的定义就是宿主依赖项：“让整机（外部系统）真的跟着转横竖屏的能力。依赖宿主 H1”（`CONTEXT.md:53-55`）；宿主能力探针 `getRemoteHostCaps()` 在 #86/#87 落地前恒返回缺席（`src/client/remote.ts:60-74`）；缺席时 `computeRemoteView` 只在 `threshold.hostPending` 置 `hostNote: '整机待宿主'`，总闸不受影响（`src/client/remoteView.ts:164-190`）。
- 串流前提（ADR-0002，用户 2026-09-29 确认）：“UU远程为**全桌面适配**（整块桌面画面按屏等比缩放播放）”，“插件拿不到手机屏物理尺寸与串流缩放比”（`docs/adr/0002-remote-panel-sizing.md:3-5`）。即：**手机上看到的是 Windows 桌面的视频流像素，插件代码跑在另一端的浏览器文档里**，两者之间隔着一层单向像素流——这是后面 §4 拓扑论证的事实基点。

## 3. 浏览器 API 第一手来源：每个都够不着“外部 Windows 整机”

### 3.1 Screen Orientation API（`screen.orientation.lock/unlock`）——锁的是“本文档”，且桌面端通常不可用

- MDN：`lock()` “locks the orientation of the **containing document** to the specified orientation”（锁的是包含文档）。“Typically orientation locking is **only enabled on mobile devices, and when the browser context is full screen**.”
  来源：https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
- MDN（接口页）：`ScreenOrientation` “provides information about the **current orientation of the document**”（读的是文档方向，不是 OS 显示方向）。
  来源：https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation
- W3C 规范（Screen Orientation）：lock 的语义是“the screen can only be rotated **by the user** to a specific screen orientation”（约束用户可转的范围，不是替用户转 OS）；“Depending on platform conventions, **change how the viewport is drawn** to match orientation”（落点是 viewport 绘制）；“A user agent **MUST restrict** the use of `lock()` to **simple fullscreen documents** as a pre-lock condition”（强制前置：简单全屏文档，否则 `NotAllowedError`）；“pre-lock conditions are optional requirements that a user agent **MAY** impose”（UA 可加更多前置）。
  来源：https://w3c.github.io/screen-orientation/
- 桌面端后果（直接引用上面两条即得，无需猜测 UA 行为）：DSH web 的宿主浏览器跑在 Windows 桌面上（Chromium/Edge 系桌面 UA），`lock()` 在桌面上下文要么因非全屏/非移动设备被拒（`NotSupportedError`/`NotAllowedError`），要么即便“成功”也只改变该文档视口的绘制方式。**Windows 显示方向本身（设置 → 显示 → 显示方向管的那个状态）不在该 API 的作用域里。**
- 覆盖度备注：caniuse 显示 Screen Orientation 在各浏览器“Supported”率高（https://caniuse.com/screen-orientation ）——但那统计的是“读文档方向 + 锁文档方向”这个 API 的存在性，不是“能转 OS”。存在 ≠ 够得着整机。

### 3.2 Fullscreen API（`requestFullscreen`）——全屏的是“某个 Element”，不旋转任何东西

- MDN：“adds methods to present **a specific Element (and its descendants)** in fullscreen mode… removing all of the browser's UI elements as well as all other applications from the screen until fullscreen mode is shut off.”
  来源：https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- 推论：全屏是“把一个元素铺满用户屏幕”，语义里没有“旋转”一词；且铺满的是**插件所在屏幕**（若 DSH web 跑在 Windows 浏览器里，铺满的是那块 Windows 显示器），与“让 Windows 显示方向从横变竖”正交。

### 3.3 CSS `orientation` 媒体查询——测的是 viewport，原文明确“不是 device”

- MDN：“can be used to test the orientation of **the viewport** (or the page box, for paged media). **Note:** This feature does **not** correspond to _device_ orientation.”
  来源：https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/orientation
- 本插件的 `deriveRemoteOrientation` 与此同构（读视口宽高比），所以它天然属于“自适应布局”一侧，永远长不成“整机真切”。

### 3.4 viewport meta——视口尺寸提示，不碰 OS

- MDN：`<meta name="viewport">` “gives hints about how the viewport should be sized”；键只有 `width/height/initial-scale/maximum-scale/minimum-scale/user-scalable/interactive-widget/viewport-fit`，全是布局视口缩放语义。
  来源：https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
- 在 UU 全桌面适配下，页面 viewport meta 管的是 DSH web 文档自己的布局视口，管不到串流对端 Windows 的显示模式，更管不到手机 OS。

### 3.5 CSS `transform: rotate()`——能转自家像素，但那不是“真切”，且有害

- 这是纯渲染变换：转的是插件自己在文档里画的盒子。UU 场景下手机看到的 Windows 桌面是**串流视频帧**，插件文档里的旋转不进入那路像素。
- 有害面：旋转后的点击热区与视觉错位（`transform` 不改变布局盒，指针命中需额外映射），在“拿远了也点得中”的远程诉求下是倒退。结论：**视觉旋转 ≠ 整机真切**，验收时必须按“外部系统显示方向真的变了”判定，否则就是拿 (a) 冒充 (b)。

## 4. 拓扑论证：两种走法都到不了“外部 Windows 整机旋转”

事实基点（ADR-0002）：手机经 UU 看到的是整块 Windows 桌面的等比缩放视频流；插件 JS 跑在 DSH web 文档（Windows 本机浏览器）里（`docs/adr/0002-remote-panel-sizing.md:3-5`）。

- **分支一（实际拓扑：DSH web 跑在 Windows 本机浏览器，手机只看串流）：** `screen.orientation.lock()` 的作用对象是 Windows 浏览器里的那个文档。桌面 UA 下通常直接拒绝；即便不拒绝，改的也是该文档视口绘制。Windows 显示方向（OS 级显示模式）没有任何 Web API 可达——W3C 规范给 API 的最大权力就是“change how the viewport is drawn”（§3.1 引文）。**此路不通是规范级的不通，不是“还没试出来”。**
- **分支二（假设拓扑：手机浏览器直接打开 DSH web）：** `lock()` 锁的是**手机浏览器里 DSH 页面的方向**（手机 OS 配合旋转的是手机自己的屏幕），而用户要转的是**远端那台 Windows**。手机页面的方向与远端 Windows 显示方向是两个 OS 的两件事，之间没有 API 关联。**此路转的不是用户要的那台机器。**
- 因此“插件层真切整机”无通路：不是缺一个调用技巧，而是**作用对象错位**（document/viewport vs OS display mode）+ **机器错位**（本地文档 vs 远端 Windows）双重错位。唯一正解是宿主在能碰到 OS 的那一侧（Node/host 进程）实现 H1，再经已验证的 `/_dsh/*` 桥暴露给客户端。

## 5. DSH 宿主侧：插件今天能调用什么、不能调用什么

- 本插件 host 半的装配依赖只有 `storageDomain`（持久化）与 `webServer`（HTTP 桥）（`lib/index.js:35`，`export const inject = ["storageDomain", "webServer"]`，`D:\dsh-plugin\dsh-prompt\lib\index.js:34-35`）。
- 桥上实际注册的路由（`lib/index.js:370-376` 的 `KNOWN_ROUTES` 即路由表自述）：`/_dsh/dsh-prompt/store`、`/_dsh/dsh-prompt/log`、`/_dsh/dsh-prompt/customs/{put,delete}`、`/_dsh/dsh-prompt/usage/bump`、`/_dsh/dsh-prompt/pinned/set`、`/_dsh/dsh-prompt/remote/set`、三条 `update/*` 路由。**无任何 orientation/system/display 路由。**
- 客户端 `package.json` 的 `dsh.engines.dsh >=0.1.5-rc.1`（`package.json:84-86`）只声明宿主版本下限，不带来新能力；客户端 `inject` 只有 `slots` 与 `inputTriggers`（`src/client/index.ts:33`），即“槽位 + 触发源”，没有系统调用槽。
- #86 的 H1 拟议合约（查询 `hasSystemOrientation` + `POST /_dsh/dsh-prompt/system/orientation`，失败码 `unsupported|busy|denied|unknown`）今天的状态是**提案**，宿主侧无实现、本仓无切换函数——#86 自述“切换调用 ❌（宿主侧）：本仓无切换函数、宿主无对应端点 —— 这正是本票 OPEN 的理由”（issue #86，`gh issue view 86`，标题“H1宿主需求：系统横竖真切能力（OS orientation真切API）”，状态 OPEN，`ready-for-human`）。
- 结论：**今天没有任何已安装/已发布的宿主能力可被插件“顺手调用”来实现整机旋转**。`/_dsh/*` 桥是插件自家 host 半注册的路由，只能做 host 半代码写了的事（存取 JSON、记日志、查更新）；host 半是 Node 代码，理论上宿主未来可以在那里调 OS 能力——但那正是 H1 本体，不是绕过 H1 的捷径。

## 6. “其他人插件能切 OS 横竖屏”——核实结果：查无实据，抽查的三家全是 (a) 或无关

核实方法：只认源码/文档。`npm pack` 拉三家真实插件的发布 tarball（包名+版本见下），解包后 grep `orientation|fullscreen|screen\.|横竖|旋转|横屏|竖屏|rotate|landscape|portrait`（客户端与 host 半分开查），命中逐条看上下文。tarball 留存 `D:\tmp-plugcheck\`（b1/b2/b3 目录）可复验。

### 6.1 dsh-better-sidebar@0.24.1 —— (a) 自家面板内响应式，兼有 OS  соседство但与旋转无关

- 包：`dsh-better-sidebar@0.24.1`，仓库 https://github.com/omdsh-dev/DSH-better-sidebar（`D:\tmp-plugcheck\b1\package\package.json`）。
- host 注入：`inject = ["webServer", "sessions", "webRuntime", "tools"]`（`b1/package/lib/index.js:3683-3688`）——无显示/系统能力。
- host 半确实用了 `spawn`（`b1/package/lib/index.js:10`），但用途仅三件：`revealCommand`（按平台调 `explorer.exe /select,`、`open -R`、`xdg-open` 打开 OS 文件管理器并选中文件）、`urlCommand`（把自定义 scheme URL 交给 OS 协议处理器）、按需 spawn 系统 `git` 二进制（`b1/package/lib/index.js:1049-1075,1597-1694` 注释与实现）。**这是“打开文件/链接”级的 OS 接触，不是显示方向控制；无任何 display/orientation 调用。**
- client 半的 `fullscreen/narrow viewport` 命中是自家列的响应式逻辑：窄视口（`<768px`，`isNarrowWidth(window.innerWidth)`）下宿主把右侧列画成 fullscreen，插件把任务页“park”起来不抢屏（`b1/package/lib/client.js` `activateTasksPage` 上方大段注释，约第 20030–20060 行）。`rotate` 命中是 SVG 图标 `transform: rotate(...)`、`aria-orientation` 无障碍属性与 CSS 属性白名单；`orientation` 在 `client-editor.js` 的命中来自 vendored 编辑器/monaco CSS 属性表与 mermaid 图表方向（`chartOrientation`、`orientation: "V"/"H"` 为图表布局方向）。**全部是 (a) 或无关，没有 (b)。**

### 6.2 dsh-opencode-palette@2.0.5 —— 与旋转完全无关（换肤插件）

- 包：`dsh-opencode-palette@2.0.5`，仓库 git+https://github.com/FeatherHunter/dsh-opencode-palette.git（`D:\tmp-plugcheck\b2\package\package.json`）。
- host 注入：`export const inject = ['connection']`（`b2/package/lib/index.js:34`）；通道常量 `CHANNEL='/api'`、`ENDPOINT='opencode-palette'`（`b2/package/lib/channel.mjs`）——主题/日志/更新电话载体。
- client 半：只有 `slots.inject(slotTarget…)` 与 `slots.inject('settings.section'…)`（`b2/package/lib/client.js`），grep orientation/横竖/旋转/rotate **零命中**。产品是 38 款皮肤一键换（包描述语），即 CSS 变量换肤。**连 (a) 的旋转都没有，更无 (b)。**

### 6.3 dsh-usage-statistics-panel@0.3.1 —— (a) 顶多算图表自转，无整机

- 包：`dsh-usage-statistics-panel@0.3.1`，仓库 https://github.com/HaoyueQin/dsh-usage-statistics-panel.git（`D:\tmp-plugcheck\b3\package\package.json`）。
- host 注入含 `webServer` + `storageDomain`（`b3/package/lib/index.js:1059-1063` 起）——与本仓同构的存储+桥形态，无系统能力。
- client slots：`plugins.bundle.config`、`main`、`sidebar.panellist`、`conversation.composer.dock`（`b3/package/lib/client.js`）——全是面板挂载点。
- `rotate/fullscreen` 命中仅两类：lucide 图标名（`RotateCw`、`Rotate3d`、`Fullscreen`）与 SVG 图表 `transform: rotate(-90…)`（`b3/package/lib/client.js:12600,21627-21676,29684`）；orientation/横竖/旋转/横屏/竖屏 **零命中**。**是 (a) 侧的图表装饰，没有 (b)。**

### 6.4 小结

三家真实插件的源码/文档中，**没有一家实现 (b) 整机 OS 旋转**；最接近的也只是 (a) 自家面板响应式/图表装饰。若“用户声称”的所指是某家插件在手机上“看着像转了”，最可能的解释是：手机 OS 自转/串流 App 自转/某面板的响应式重排——三者都不等于“外部 Windows 整机显示方向被插件切换”。建议向声称方索要**包名+版本+复现步骤**，按本节方法复验后再议；在那之前按“传言”处理，不作为决策依据。

## 7. 对 #86 的影响建议：维持宿主需求，不改插件自做，建议拆分

1. **维持 #86（H1 宿主需求）**：整机真切在插件权力边界之外（§1–§5），撤销 #86 等于宣判该能力不存在。今天的“宽门槛”状态（总闸不因 H1 缺席清零、仅对应行置灰写明“整机待宿主”）已是正确 posture，无需回退。
2. **不改为“插件自做”**：三条看似可走的路（`lock()`、fullscreen、CSS 旋转）经第一手来源逐一证伪（§3）；“其他插件能做”的传言经三家源码核实不成立（§6）。插件自做若强行上线，只能产出“看着转了”的仿真（CSS 旋转/仿横屏样式），验收时与“整机真切”混淆会污染 #84 的验收口径——ADR-0002 已要求验收记录 UU 显示模式（`docs/adr/0002-remote-panel-sizing.md:16-17`），仿真会直接违反该口径。
3. **建议拆分（可选，不动 issue，仅提案）**：
   - H1a（查询）：宿主暴露 `hasSystemOrientation`（客户端 `getRemoteHostCaps()` 直读，`src/client/remote.ts:60-74` 已预留形状）。
   - H1b（切换）：`POST /_dsh/dsh-prompt/system/orientation`（沿用 `/_dsh/dsh-prompt/*` 前缀 + `{ok, error:{code}}` 形状，失败码沿用 #86 提案的 `unsupported|busy|denied|unknown`）。
   - 客户端 wrapper（本仓侧，需新票）：`setSystemOrientation()` 薄封装 + 设置页该行就绪时调用；缺席保持 disabled（`src/client/settings.ts` 的 `remote-sys-orientation` 行已有缺席分支，见 #86 自述）。
   - #84 验收拆两项：H1 缺席时只验“该行置灰 + 总闸可用 + 自适应 4×3↔3×4 照常”；H1 落地后加验“一次调用整机跟手转 + 失败码明确”。
4. **若宿主最终宣判不做**：按 #86 关闭条件后半句执行——配置面板该行永久置灰并写明，本票以“明确不做”关闭；自适应布局不受任何影响（它是零宿主依赖的纯函数，`src/client/remoteView.ts:46-55`）。

## 8. 来源清单（每个主张的落点）

- 仓内定义：`D:\dsh-plugin\dsh-prompt\CONTEXT.md:47`（远程模式只管大/小）、`:49-51`（自适应布局零宿主依赖）、`:53-57`（整机真切依赖 H1；旧词作废说明）。
- 插件形态与注入面：`D:\dsh-plugin\dsh-prompt\package.json:72-87`；`src/client/index.ts:33`（inject）、`:129-149`（input slots）、`:207-214`（shell slots）。
- 桥边界：`D:\dsh-plugin\dsh-prompt\lib\index.js:34-35`（inject）、`:370-376`（路由表）、`:680-685`（remote/set 路由示例）；客户端桥调用 `src/client/remote.ts:87-88`、`src/client/store.ts:47-51`。
- 宿主能力 stub：`src/client/remote.ts:60-74`；自适应实现 `src/client/remoteView.ts:46-55,164-190`；视口监听 `src/client/panel.ts:878-901`。
- 串流事实：`D:\dsh-plugin\dsh-prompt\docs\adr\0002-remote-panel-sizing.md:3-5,16-17`。
- #86：issue #86（`gh issue view 86`），标题“H1宿主需求：系统横竖真切能力（OS orientation真切API）”，OPEN，`ready-for-human`；H1 拟议合约见其 Notes。
- MDN ScreenOrientation.lock：https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock（含 “containing document” 与 “only enabled on mobile devices…full screen”）。
- MDN ScreenOrientation：https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation。
- W3C Screen Orientation 规范：https://w3c.github.io/screen-orientation/（lock 语义、viewport 绘制落点、fullscreen 前置 MUST、pre-lock MAY）。
- MDN Fullscreen API：https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API。
- MDN orientation 媒体查询：https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/orientation（含 “does not correspond to device orientation”）。
- MDN viewport meta：https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport。
- caniuse screen-orientation：https://caniuse.com/screen-orientation（存在性统计，非 OS 能力证明）。
- 第三方插件证据：`dsh-better-sidebar@0.24.1`（https://github.com/omdsh-dev/DSH-better-sidebar ）、`dsh-opencode-palette@2.0.5`（https://github.com/FeatherHunter/dsh-opencode-palette ）、`dsh-usage-statistics-panel@0.3.1`（https://github.com/HaoyueQin/dsh-usage-statistics-panel ），tarball 解包于 `D:\tmp-plugcheck\b1|b2|b3\package\`，关键行号见 §6。
