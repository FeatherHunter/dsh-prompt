# DSH 客户端能力调查 — findings

> wayfinder research 票「DSH 客户端能力调查：UI 表面 / 输入注入 / 对话感知」(#2)
> 调查对象：DSH Desktop checkout（D:\\0Tools\\DSHDesktop\\DSH Desktop\\resources\\app，node_modules 内 @deepseek-ai/* 客户端包）+ 参考插件 dsh-opencode-palette（已发布 v1.6.0）
> 结论先行：**prompt 调色板插件的三个关键面全部可行**；智能模式可行（输入触发器系统是现成原语）。

---

## 0. 插件客户端架构总览（必读）

- **交付形态**：bundle 插件。宿主侧 \`cordis.patch.yml\` 声明条目（如 \`{id, name, config}\`），客户端侧 \`package/lib/client.js\` 是 \`window.__ModuleLoader__.load({id, factory})\` 格式的 CJS bundle（参考 \`dsh-client-ui-input-trigger/lib/client.js\` 第 1-3 行），\`package/lib/index.js\` 为宿主侧 no-op 元数据。由 \`dsh plugin add\` 装配（\`dsh.bundle.patch\` 机制）。
- **客户端插件主体**：\`function apply(ctx)\`，核心 API：
  - \`ctx.effect(fn, key)\` — 生命周期；返回的函数即清理器（cordis 语义）
  - \`ctx.plugin(Class)\` — 注册一个 cordis Service 类（如 InputTriggerService）
  - \`ctx.inject([...services], (scope) => {...})\` — 注入服务：\`slots\`、\`sessions\`、\`remote\`、\`locale\`、\`inputTriggers\`、\`theme\`、\`commandUi\`、\`conversation\` 等（参考 \`dsh-client-ui-commands/lib/client.js:1079-1104\`、\`dsh-client-ui-input-trigger/lib/client.js:815-849\`）
  - \`ctx.get('theme')\` — 主题服务（\`overrideTokens(scope, tokens)\`）
  - \`ctx.locale.register(ns, {zh, en})\` — 双语词典；文案跟随 \`html[lang]\`（MutationObserver 监听，参考调色板 runtime/client.mjs）
  - \`ctx.sessions.scope(sessionId)\` → 会话级 actx（per-session 服务与事件）
- **构建**：零依赖 mini-bundler（调色板 \`scripts/build-client.mjs\`）：源码约束为单行 import / 无 default export / 无 re-export / 无动态 import（DESIGN.md §7）。

## 1. ① UI 表面（可用 slot 清单，均已核实）

| slot | 位置 | 性质 | 对本插件的用途 |
|---|---|---|---|
| \`conversation.input.left\` / \`conversation.input.right\` | 输入框左右两侧（composer bar 内，dsh-client-ui-conversation/lib/client.js:6873-6874）| list | **悬浮按钮入口** ← 首选 |
| \`conversation.input.overlay\` | 输入框上层浮层（:3757-3760）| list | 命令面板/斜杠菜单用（slash-menu order 0、command-popup order 1）— 现成的「调色板浮层」先例 |
| \`conversation.composer.bar\` | 输入条本体（:6859，默认条目）| chain | 自定义输入条 |
| \`conversation.composer.dock\` | 输入区下方 dock（:6875）| list | 建议条/智能提醒条 |
| \`conversation.composer\` | 整个 composer（:6888，chain+fallback）| chain | 整块替换 |
| \`settings.plugins.tab\` / \`settings.section\` / \`settings.plugin.item\` | 设置页（:482 / agent-preset:1706）| list | **设置/模板管理页**（调色板已证实）|
| \`conversation.session.header.actions\` / \`.utilities\` | 会话头（:6989/6993）| list | 次要入口 |
| \`sidebar.footer.action\` | 侧栏底部（cordis:1317）| list | 备选入口 |
| \`tool.view.cordis\` / \`tool.call.toolview\` | cordis 工具视图 | list | 调试视图 |

无独立「状态栏」slot；最接近的常驻按钮面是 \`input.left/right\` 与 \`session.header.utilities\`。
**注册模式**（调色板 runtime/client.mjs:418-440）：\`slots.inject(target, () => slots.register({name, id, order, label, inject}, ReactComponent))\`；list slot 必须给 \`id\`；排序按 \`priority\` + \`order\`；slot 组件用 React（\`require('react')\` 或 \`globalThis.React\`）。

## 2. ② 输入注入（把模板正文写进输入框）

- 输入框是受控 React textarea（\`value: draft\`，dsh-client-ui-conversation/lib/client.js:3791-3794），草稿存于 per-session 输入机 \`SessionInputShell\`（:892-940）。
- **官方写入路径**：\`SessionInputShell.actions.setDraft(text)\`（:899-902）——唯一草稿写入口（machine dispatch \`draft-changed\`）；\`actions.submit()\` 发送（:910-912）。
- **从插件组件写入**：
  1. 触发器系统路径（推荐，现成）：注册 inputTriggers source，pick 后 \`execute(outcome, span)\` 用 \`actx.bail(actx, "slash/input-insert-text", {text, span})\` 做 **span 替换**（\`draft.slice(0,span.start)+text+draft.slice(span.end)\`，:1158）——选中模板即替换触发 token 为模板正文。
  2. 直接路径：组件内 \`sessions.scope(sessionId)\` → actx → 访问会话输入 shell 调 \`setDraft\`（追加/替换当前草稿）。
- **触发器系统（inputTriggers，智能模式的现成原语）**：\`dsh-client-ui-input-trigger\`。\`/\` 与 \`@\` 在词边界触发菜单（:49-69）；source 契约：\`{trigger, name, order, onPick({candidate, session, position, via, span}) → {text}|{claim}|{insert}, matchSpace?}\`（:598-613, :330-348）；item 形状 \`{label, description, icon, ...}\`。注册：\`ctx.inputTriggers.registerSource({trigger:'/', name:'prompt', order, ...})\`。slash-menu 与 command-popup 都挂在 \`conversation.input.overlay\`。

## 3. ③ 对话感知（智能模式可行性）

- **可行**。信号源：
  - \`sessions\` 服务：\`ctx.sessions.scope(id)\` → actx；会话 store 暴露 \`composerPhase\`、\`running\`、\`subagent\`、\`draft\`、队列（组件侧 \`useSession\`/\`useInput\`/\`useProjection\`，:3328-3341）
  - \`remote\` RPC（dsh-client-connection）：\`session.history\`、\`session.list\` 等 —— 可读历史消息
  - 当前会话 id 持久化于 localStorage \`dsh.sessions.current\`
  - inputTriggers 提供实时的 draft+caret 信号（「用户正在输入什么」）
- 落地形态建议：\`composer.dock\` 建议条（根据 draft/阶段推荐模板）或 inputTriggers source（\`/prompt\` 触发）。**v1 可先做常规模式 + 触发源，智能建议留 T4 定夺**。

## 4. ④ 持久化

- **localStorage**（调色板先例：\`dsh.opencode-palette.v2\`，含旧键迁移模式）——模板数据 + 用量计数足够，插件自身键空间独立。
- 可选：\`settings\` RPC（\`settings.describe/update/replace/mutate\`，dsh-client-connection:511-515）——服务端 settings 文件持久化，跨设备/跨重启更稳（适合模板配置）。

## 5. 风险与注意

- 客户端源码需符合 mini-bundler 约束（单行 import 等），或直接复用调色板的构建管线。
- \`conversation.input.left/right\` 在 hero（无会话）态不渲染（:6873-6874 \`zone === void 0 ? null\`）；按钮组件需处理无会话态（禁用/占位）。
- 本机 Electron Desktop 内嵌的 dsh-web-frontend 为已构建产物；开发/验证应以 web GUI（\`dsh web\`，127.0.0.1:59519）为靶，用 dev_* 注入器运行时验证，shell 变更需重建 web 产物。
- 事件/API 均为代码核实（node_modules 内 \`@deepseek-ai/*\` lib 源码）；官方文档未单独验证，实现时以运行时代码为准。

## 6. 结论

- ① 入口：**\`conversation.input.left\`（或 right）放按钮** + **\`conversation.input.overlay\` 或自有浮层放面板** + **\`settings.plugins.tab\` 放模板管理页**。
- ② 注入：**inputTriggers source（/prompt 风格）或会话输入 shell 的 setDraft**，两者皆有先例。
- ③ 智能模式：**可行**，信号齐备；形态交给 grilling 票 T4。
- ④ 持久化：**localStorage** 起步即可（模板+计数），settings RPC 为可选增强。
