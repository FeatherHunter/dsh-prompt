# 「设置 → 模板管理」打不开设置：只读取证报告

调查日期：2026-10-15（Asia/Shanghai）。只读调查，未改动 `src/`、`lib/`、`package.json`，无 commit / publish。
调查时宿主为 **DSH 0.2.0-rc.2**（今晨 4 点重装后的构建），实现检出 `D:\DeepseekHarness\resources\app.asar`（旧检出 `...\app.asar\dsh\packages\` 在本机已不存在）。
下文「读到的」= 我在文件里亲眼读到的原文；「推断」= 由代码推出的结论，均已标注。

---

## 0. 结论一句话

**用户点的不是"坏代码"，而是"旧装机件"**：本机安装的 `dsh-prompt@0.4.20`（`lib/client.js` 写于 2026/10/15 04:36:48）里只有旧的「找 `button[aria-haspopup="dialog"]`」启发式，而重装后的宿主把侧栏 `settings.launcher` 槽位交给了**账号菜单**（`dsh-client-ui-settings-account` 的 AccountMenu），外壳那枚 `aria-haspopup="dialog"` 的设置按钮**在 DOM 里根本不存在** → 旧启发式一条都命中不了 → 约 3.6 秒轮询耗尽 → 面板原位提示 `没打开设置：走 ⚙ → 提示词模板`。与真机现象一一对应。
（另：工作区 `src/client/index.ts` 已在今日 13:31 被改出针对该根因的三条新路径——但 `lib/client.js` 还是 13:03 的旧产物，**改了没构建、更没发版**。）

---

## 1. 宿主侧：设置界面形态与入口（全部为 asar 内原文）

宿主构建：`dsh/node_modules/@deepseek-ai/dsh-client-ui-settings/package.json` → `version: 0.2.0-rc.2`。
以下路径均相对 `D:\DeepseekHarness\resources\app.asar`（必须用 asar 探针读，PowerShell 直接读不到）。

### 1.1 设置是一个 body-portaled 模态对话框

`dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js`

- `:292` `role: "dialog"`（同处 `aria-modal: "true"`、`data-shortcut-modal: "settings"`，class 前缀 `wCInkW_overlay` / `wCInkW_panel`）
- `:337` `children: active !== void 0 && renderSlot("settings.section", { close: onClose }, { only: active })`
- `:1018-1024` 导航行由槽位账本生成：`const version = ctx.slots.getVersion("settings.section")` … `rows = ctx.slots.entries("settings.section").map((e) => ({ id … label … }))`
- `:1136` `"settings.section": {`（槽位类型声明）；`:1171-1172` `ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", …`

### 1.2 入口：`settings.launcher` 单槽 + 可被顶掉的 fallback

`dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js:432-462`（原文摘录）

```js
jsxs("div", {
  className: clsx(SettingsRoot_module_css_default.triggerRow, !wide && SettingsRoot_module_css_default.railRow),
  children: [
    renderSlot("settings.launcher", {
      wide, settingsOpen: open, openSettings: actions.open, ... },
      { fallback: jsx(Tooltip, { disabled: open, label: t("trigger"), shortcutKeys: shortcut?.keys,
          children: jsx("button", {
            type: "button",
            className: clsx(css.trigger, !wide && css.rail),
            "aria-label": t("trigger"),
            "aria-keyshortcuts": shortcut?.aria,
            "aria-haspopup": "dialog",
            "aria-expanded": open,
            onClick: () => { actions.open(); },
            children: renderSlot("settings.trigger", { wide }) }) }) }),
    jsx(ConnectionIndicator, { … })
  ]})
```

关键读到的两点：
- **`triggerRow` 容器（class `wCInkW_triggerRow`，见 `:60` CSS、`:90` 映射、`:433` 使用）无论槽位是否被占都渲染**；消失的只是 fallback 那枚按钮。
- fallback 按钮 = `button[aria-haspopup="dialog"]` + `aria-label = t("trigger")`（「设置」）+ class `wCInkW_trigger`（`!wide` 时加 `wCInkW_rail`，rail 下 36×36、label 视觉隐藏）。

槽位契约原文：
- `dsh/node_modules/@deepseek-ai/dsh-client-ui-settings/README.zh.md:53`：「可选的 `settings.launcher` 贡献接收侧栏布局、设置面板是否覆盖侧栏、设置导航回调…**未注册入口时，外壳保留普通设置按钮**。」
- `dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/README.zh.md:61`：「外壳声明 settings.launcher，供账号功能提供侧边栏菜单，**并以设置按钮作为回退**。」
- `dsh/node_modules/@deepseek-ai/dsh-client-ui-settings/README.zh.md:42`：外壳（`sidebar.settings` 占位方、导航、界面框架）位于 ui-settings-general。

⇒ **本机这枚 fallback 按钮不会渲染**（下条）。

### 1.3 谁占着槽：账号菜单（本次失败的真凶）

`dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js`

- `:4496-4497` `ctx.slots.inject("settings.launcher", () => ctx.slots.register({ name: "settings.launcher", …` —— 无条件占据（不是 `signedIn &&` 守卫）
- `:1707-1725` 触发器按钮：`jsx("button", { className: css.trigger /* ET65mq_trigger */, "data-collapsed": !wide, "data-signed-out": !signedIn, "aria-label": t("menu"), "aria-haspopup": "menu", "aria-expanded": open, … children: [signedIn ? <头像> : <IconEllipsisOutlineMedium/>, wide && <span>{signedIn ? label : t("more")}</span>] })`
- 该包 CSS（`:1612`）只有 `ET65mq_root` / `ET65mq_anchor` / `ET65mq_trigger`，**没有 `triggerRow` 类**
- i18n：`:2817 settings: "Settings"`、`:2819 menu: "Account menu"`、`:2844 more: "More"`、`:2875 settings: "设置"`

⇒ 触发器可访问名是「账号菜单 / Account menu」，可见文案是「更多 / More」（未登录）或用户名（已登录）。**都不含「设置」**。

- `:1727-1733` 菜单项第一项**无条件**存在：`{ id: "settings", label: t("settings"), icon: <IconSettingsOutlineMedium/>, ...settingsShortcut === void 0 ? {} : { shortcut: settingsShortcut } }`
- `:1753-1757` `onSelect: (id) => { if (id === "settings") { setOpen(false); trigger.current?.focus(); openSettings(); } … }` —— 这条 `openSettings()` 就是外壳 `actions.open`（`openSettings: actions.open` 由 `:438` 传入 launcher 槽位）
- 菜单行由 primitives 渲染：`dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js:4165-4168` `role: "menuitem"` + `"aria-keyshortcuts": entry.shortcut?.aria`（`:3914` 注释「each a `role="menuitem"` **button**」）⇒ 选择器 `button[role="menuitem"]` 成立

### 1.4 宿主有没有编程式打开 API：**没有给插件的公开 API**

- 宿主自己注册了命令：`dsh-client-ui-settings-general` 里 `ctx.shortcuts.register({ id: "settings.open", … resolve })`，其 `run: () => { if (modal === "settings") closeTopModal(document); else shellInstance.actions.open() }`。
- 但 `shortcuts` 服务**没有公开 `invoke`**：`dsh/node_modules/@deepseek-ai/dsh-client-shortcuts/lib/client.js:1843` `var ShortcutsService = class extends _deepseek_ai_cordis.Service`、`:1861` `super(ctx, "shortcuts")`、`:1867` `this.registry = new ShortcutRegistry(this.runtime, this.platform, initialShortcutConfig())`；public 只有 `register`（`:1901`）/`registerFixed`（`:1909`）。全仓 `registry.invoke(` 的唯一调用点是宿主原生键盘适配器 `:913` `registry.invoke(input.commandId, context)`。
- `settings.launcher` 槽位属性里确实带有 `openSettings: actions.open`（`:438`），但那是**给占位方（账号插件）的**，插件无法自行注入该槽（已被 inject 占位）。
- 插件侧：`src/client/index.ts:36` `export const inject = ['slots', 'inputTriggers']` ⇒ `ctx` 里**没有** `shortcuts` 服务。

⇒ 「有 API 就优先走 API」这条路在当前宿主上**不成立**（除非碰私有字段 `ctx.shortcuts.registry.invoke`，见 §4 兜底）。

### 1.5 本插件页在设置里的形态

- 注册：`src/client/index.ts:241-242`
  `ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-prompt-toolbox', priority: 10, order: 50, label: () => tr(getLang(), STR.sectionName) }, SettingsPage)), 'dsh-prompt: settings')`
- 文案：`src/client/i18n.ts:28` `sectionName: { zh: '提示词模板', en: 'Prompt Templates' }`
- 宿主渲染：`settings.section` 的 `{id, label}` 直接变成设置弹窗左侧**导航行**（`ui-settings-general:1018-1024`），页面体由 `:337` 挂载。

⇒ 它是**一行导航项**（不是 iframe、不是搜索项、不是卡片）。`label()` 即「提示词模板」，与面板 `clickCell()` 的精确文本匹配一致（推断，见 §5 未核实 4）。

---

## 2. 插件侧：装机件 vs 工作区（决定性差异）

| 项 | 真机装机件 | 工作区 |
|---|---|---|
| 路径 | `C:\Users\辰辰洋洋\.dsh\profiles\desktop\node_modules\dsh-prompt\` | `D:\dsh-plugin\dsh-prompt\` |
| 版本 | `package.json` → `0.4.20` | `package.json` → `0.4.20`（未 bump） |
| `lib/client.js` | 710407 B，LastWriteTime **2026/10/15 04:36:48** | 710489 B，LastWriteTime **2026/10/15 13:03:37** |
| `src/client/index.ts` | 不适用 | mtime **2026/10/15 13:31:31**，`git status` = `M`，`git diff --stat` = **+60/-8** |

装机件 `lib/client.js` 的关键标识符 grep（全部 **NONE**）：`launcherAnchor`、`settingsMenuItem`、`hostOpenSettings`、`settings.open`、`triggerRow`、`menuitem`。
装机件里**只有**旧实现：`goSettingsFail`（1873、5621、5622、5623）、`isOwnChrome`（20217）、`__dshPromptGoSettings`（12916）、本插件自己弹窗的 `aria-haspopup: "dialog"`（16723、16797）。

工作区 `lib/client.js`（13:03:37 产物）同样**没有**这六个新标识符 ⇒ **新代码只在 src 里，产物/装机件都还没有**（`git status`：` M lib/client.js`、` M src/client/index.ts`）。

工作区 `src/client/index.ts` 现状（13:31 之后读到的原文）：
- `:259-377` `goSettings`：`:279-297 clickCell()`（按 `label` 精确文本点导航行）；`:300-310 hostOpenSettings()`（`(ctx as any).shortcuts.invoke('settings.open', { modal: null })`）；`:311-324 launcherAnchor()`（`document.querySelector('[class*="triggerRow"]')` → `row.querySelector('button[aria-haspopup]') || row.querySelector('button')`）；`:325-333 settingsMenuItem()`（`button[role="menuitem"]` 里文案命中 `/设置|Settings/i` 或带 `aria-keyshortcuts`）；`:343-346` 旧的三条 dialog 启发式；`:347-354` 串成三条互补路径；`:355-375` 200ms×18 轮 + 第 6 轮（≈1.2s）补点；`:373` `n > 18 → finish(false)`；`:378-379` `setGoSettingsHandler(goSettings)` / `globalThis.__dshPromptGoSettings`
- 注释 `:311-317` 已写明根因（与 §1.3 独立取证一致）
- `:36` `export const inject = ['slots', 'inputTriggers']`

旧版（=装机件）逻辑：`dialogTriggers()`（`button[aria-haspopup="dialog"]`）按 `named()`（`aria-label / title / textContent` 命中 `/设置|Settings/i`）→ 退到 class 含 `trigger` → 退到带 `aria-keyshortcuts` → 最后 `allButtons().find(named)`；全落空即 `finish(false)`。

---

## 3. 失败链路定位（代码级确定，非"可能"）

前提：真机 = **旧装机件**（§2）× **新宿主 0.2.0-rc.2**（§1）。

1. 面板按钮点下 → `goSettings()`。设置弹窗未开，故 `clickCell()` 走空（它只在弹窗已开、页面已挂载时命中）。
2. 外壳 fallback 按钮不渲染 —— 因为 `settings.launcher` 被 `dsh-client-ui-settings-account` 占据（`account:4496`），而它是 `{ fallback: … }` 语义（`general:435-463`）⇒ `document.querySelectorAll('button[aria-haspopup="dialog"]')` 里**没有**它，`:456` 那枚从未进 DOM。
3. 最后的 `allButtons().find(named)` 也不会命中账号触发器：它的 `aria-label = t("menu")` =「账号菜单 / Account menu」（`account:1713`、i18n `:2819`），可见文案 `t("more")` =「更多 / More」（`account:1724`、i18n `:2844`）或已登录时的用户名 —— **均不含「设置 / Settings」**，正则 `/设置|Settings/i` 不匹配。
4. `trig` 为空 ⇒ 旧代码**一次点击都没发出**，200ms×18 轮耗尽（≈3.6s，含 ~1.2s 补点）→ `done(false)`。
5. `panel.ts` 渲染失败态：`goHint ? t('goSettingsFail') : …`（`src/client/panel.ts:1990-2010`），文案 `src/client/i18n.ts:58 goSettingsFail` = `没打开设置：走 ⚙ → 提示词模板` —— 与真机所见逐字一致。

**结论：不是"找到了但点不动"，而是"根本没找到入口"**：宿主换了入口形态（账号菜单顶掉了设置按钮），旧启发式的识别条件（dialog + 文案含"设置"）在新宿主上同时失效。

---

## 4. 修法建议

### 首选（= 工作区已有 ②+③ 的思路；关键是**构建并装机**）

1. **`launcherAnchor()` 保持不变**：我已核实宿主 `general:432-434` 的 `wCInkW_triggerRow` 容器在 launcher 被占时**仍然渲染**，账号触发器就在其中（`account:1710` class `ET65mq_trigger`、`aria-haspopup="menu"`）⇒ `row.querySelector('button[aria-haspopup]')` 命中它。
2. **`settingsMenuItem()` 保持不变**：`button[role="menuitem"]`（`primitives:4165`）中文案「设置」（`account:1730` label = `t("settings")`，i18n `:2875` 「设置」）或带 `aria-keyshortcuts` 的那行；点它触发 `account:1757 openSettings()`。
3. **第三步 `clickCell()` 保持不变**：设置弹窗打开后按导航行文本「提示词模板」点击（导航行正是 `settings.section` 的 `label()`，`general:1018-1024`）。
4. **必须清理的一处**：新代码路径 ① `hostOpenSettings()` 在当前宿主上**必然返回 false**（插件 `inject` 无 `shortcuts`，`src/client/index.ts:36`；且 `ShortcutsService` 根本没有公开 `invoke`，`dsh-client-shortcuts:1843/1861/1867`）。它被 try/catch 包着无害，但注释里"唯一不碰 DOM 的路"是错的，别把它当主路径。
5. 交付动作：`npm run build`（产出 `lib/client.js`）→ bump 版本 → 发版 → 装机；否则真机永远还是旧启发式。

### 兜底

- **A（不碰 DOM，走私有字段）**：`ctx.shortcuts.registry.invoke('settings.open', { modal: null })` —— 需要 `inject: ['shortcuts']`，且必须在设置**未打开**时调用（该命令 resolve 在 `modal === "settings"` 时会**关闭**设置）。私有 API，建议只在 ② 失败时 try/catch 尝试。
- **B（体验兜底，最稳）**：面板失败态不只说"走 ⚙"，而是**给可复制/可点的一步**：提示宿主快捷键（`settings.open` 命令存在，桌面 Windows 默认 `Ctrl+,`）+ 在插件页内提供等价入口（打开插件自己的模板管理视图，不依赖宿主设置）。这保证"模板管理"这件事在任何宿主形态下都可达。
- 不建议做的：合成 `keydown` 触发 Ctrl+,（桌面上按键由 native preload 拦截转发，`dsh-client-shortcuts:1891 installKeyboard(..., native)` 路径，DOM 合成事件不可靠）。

---

## 5. 未核实 / 不确定项（请勿当结论使用）

1. **真机 DOM 未取得**：尝试用桌面截图核对，但截到的 DSH 窗口左栏底部被屏幕边缘裁掉，既没看到账号触发器也没看到设置按钮 ⇒ 本轮所有宿主结论都来自 asar 内代码，不是现场 DOM 快照。
2. **未登录时账号菜单里是否出现「设置」项**：按 `account:1727-1733`（items 第一项无条件）与 `:1753-1764`（onSelect 分支）推断"总是有"，但未实机点击确认；`signedIn` 只影响 signout/signin 项与 label（`more`）。
3. **页面上是否存在多个 `[class*="triggerRow"]`**：我只在 ui-settings-general 里见到 `wCInkW_triggerRow`（`:60/90/433`），`document.querySelector` 取第一个；若别的包也有同名类，锚点可能取错。
4. **导航行的 DOM 细节**：`clickCell()` 依赖"某个 button 的 `textContent` 恰好等于「提示词模板」"。导航行的实际渲染节点（button？内层 span？）我没有逐字读到，只读到数据来源 `{id, label}`（`general:1018-1024`）。
5. **装机件与工作区只做了关键标识符 grep 对比**（两边版本号都是 0.4.20），未做全文件 diff；结论"装机件是旧逻辑"依据的是新路径字符串（含 `'settings.open'` 字面量，构建不会改名）在装机件中完全缺失。
6. **旧检出 `D:\DeepseekHarness\resources\app.asar\dsh\packages\client\ui-settings\src\client\contract\slots.ts`（#149 对账引用的原文）在本机已不存在**；本报告的槽位契约证据改引自 asar 内各包 README.zh.md 与 lib/client.js。#149 进度区的对账记录属于旧构建，已失效。

---

## 附：取证方法（可复现）

- asar 只读探针：`scripts\.rt-tmp-asar\asar.mjs`（子命令 `list` / `cat` / `grep`），例：`node asar.mjs cat "D:\DeepseekHarness\resources\app.asar" "dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js" > general.client.js`
- 装机件核对：对 `C:\Users\辰辰洋洋\.dsh\profiles\desktop\node_modules\dsh-prompt\lib\client.js` 做标识符 grep + mtime 比对
- 未启动任何服务、未改动仓库源文件；临时产物只在 `scripts\.rt-tmp-asar\`。
