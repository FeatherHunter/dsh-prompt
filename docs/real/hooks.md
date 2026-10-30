# 插件测试钩子契约（v1）

真机用例（以及排障时的人）靠 `data-dsh-prompt-*` 属性在真实 DOM 里定位插件元素。本文件是这个
契约的唯一权威登记处：**哪些属性可以用、它们出现在什么元素上、值域是什么、能不能依赖**。
契约版本 **v1**（#190 落地，2026-10-30 冻结）。

- 契约的机器门禁：`scripts/check-real-hooks.mjs`（构建产物断言 + 本文件双向交叉校验）。
- 相关文档：真机 kit 说明 [`scripts/real/README.md`](../../scripts/real/README.md)、
  宿主契约 [`docs/real/host-contract.md`](host-contract.md)、静态门禁 [`docs/real/static-gate.md`](static-gate.md)。
  观测面研究 [`docs/real/observability.md`](observability.md) 与缺口清单
  [`docs/real/hook-gaps.md`](hook-gaps.md) 由 #188 产出，随该票合入（本文件引用其规则结论，不复制）。

## 1. 两条铁律

1. **真机用例只依赖「可依赖」钩子和语义文本**（按钮/标签的可见文案、`title`、`aria-label`）。
   不引用内部 CSS 类名、不依赖 DOM 层级、不依赖样式、不依赖文本以外的实现细节。
2. **「仅调试用」钩子真机套件不得依赖**。它们只为人工排障与日志证据服务，可随时改名/删除，
   不进场重要的构建产物门禁清单（`REQUIRED_HOOKS`）。

## 2. 稳定性承诺

| 档位 | 承诺 | 谁在守 |
| --- | --- | --- |
| 可依赖 | 属性名、所在元素的语义、值域保持稳定。删除或改名属于破坏性变更，必须同时更新产品代码、本文件与 `scripts/check-real-hooks.mjs`，并在真机套件里同步改定位。 | 构建产物门禁（缺一个即红）+ 本文档交叉校验 |
| 仅调试用 | 只为人工排障/证据采集服务，**不承诺稳定**，可在任意改动中调整或删除。 | 无（只登记，不钉死） |

「首次引入版本」列的含义：该钩子最早随哪个插件版本对外出现。契约 v1 冻结前就存在的钩子统一记
`≤0.4.39`（此前没有逐钩子历史，按「契约冻结时的当前版本」记为下界）；本票（#190）新增的记
`0.4.39（#190）`。若宿主上装的插件版本低于某钩子的引入版本，真机用例应报 BLOCKED（环境不满足）
而不是 FAIL。

## 3. 真机用例怎么用

```
┌ 常用定位 ────────────────────────────────────────────────────────────────┐
│ 入口按钮            [data-dsh-prompt-entry]                                │
│ 面板开合状态        [data-dsh-prompt-entry][data-dsh-prompt-panel-state]   │
│ 面板根（开时才有）  [data-dsh-prompt-panel-root]                           │
│ 底栏 / 列表 / 远程  [data-dsh-prompt-panel-surface="bar|list|remote"]      │
│ 模板行              [data-dsh-prompt-row-role="insert|settings"]           │
│                     [data-dsh-prompt-row-name="名称"]                      │
│ 设置跳转状态        [data-dsh-prompt-go-settings-state="failed"]           │
│ 设置页根            [data-dsh-prompt-settings-root]                        │
│ 弹层类型            [data-dsh-prompt-modal-kind="create|edit|delete-confirm|remote-input"] │
│ 远程列表状态        [data-dsh-prompt-remote-panel][data-dsh-prompt-remote-state]          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **面板关时 `[data-dsh-prompt-panel-root]` 整体不存在**（PanelPortal 卸载）。判断「面板是关的」
  请读入口按钮上的 `data-dsh-prompt-panel-state="closed"`，不要拿「找不到面板根」当断言失败。
- 行元素带 `data-dsh-prompt-id`（模板 id，稳定但由用户数据决定，**不要**写死具体值）。
- 行内的操作按钮（复制/编辑/删除）没有独立钩子：在 `[data-dsh-prompt-act]` 范围内按语义文本找。
- 宿主侧弹窗内部结构**没有**插件钩子（宿主归宿主）：找不到宿主元素时应按 BLOCKED 处理，
  规则见 [`docs/real/observability.md`](observability.md)（#188）的「语义定位」节。

## 4. 新增 / 修改钩子的流程（三处同步，缺一处门禁就红）

1. **产品侧**：在既有 `src/client/*.ts` 模块里加 `data-dsh-prompt-*`（语义化命名、与既有风格一致；
   不新增 `src/*.ts` 文件——命名规范与 `check:target-tree` 都冻结了）。
2. **契约**：在本文件对应区域的表格里登记一行（属性名 / 所在元素与区域 / 语义 / 稳定性 / 首次引入版本）。
   所有标「可依赖」的钩子会经构建产物验证；标错的会被交叉校验揪出来（文档吹了门禁没查、门禁查了
   文档没写，两个方向都算红）。
3. **门禁**：标「可依赖」的钩子加入 `scripts/check-real-hooks.mjs` 的 `REQUIRED_HOOKS`（含 `area`）；
   改完跑 `node scripts/check-real-hooks.mjs --selftest && node scripts/check-real-hooks.mjs`。

> 改诊断开关的标记（`__dshPromptDiag` / `dsh-prompt-diag` / `[dsh-prompt:diag]`）同样要同步门禁
> 的 `DIAG_MARKERS` 与本文第 5 节。

## 5. 诊断输出（#190）

真机/用户现场排障用的**按需**诊断面。默认关闭；开启后把只读快照挂到
`window.__dshPromptDiag`，并可用固定前缀打印到 `console.debug`。

### 5.1 怎么开（三选一，默认全关）

| 方式 | 写法 | 生命周期 |
| --- | --- | --- |
| URL 参数（推荐一次性排障） | 页面地址加 `?dsh-prompt-diag=1`；显式关用 `?dsh-prompt-diag=0` | 只影响本页，不落盘，刷新后按配置重新决定 |
| localStorage（跨刷新常开） | 控制台执行 `localStorage.setItem('dsh-prompt-diag', '1')`，刷新；关掉用 `'0'` 或 `removeItem` | 直到用户自己改回 |
| 控制台 API（已开启后反复开关） | `__dshPromptDiag.snapshot()` / `.dump()` / `.disable()` / `.enable()` | 会话内即时，幂等 |

优先级：URL 参数 > localStorage > 默认关。布尔值接受 `1/0`、`true/false`、`on/off`、`yes/no`。

### 5.2 快照内容（`__dshPromptDiag.snapshot()`）

```
{
  contract: 1,                       // 诊断契约版本
  at: "2026-10-30T…",                // ISO 时间
  panel: { open: bool, state: "open|closed", surface: ["bar","list",…] },
  trigger: { mode: "hover|click" },
  rows: { total, insert, settings, names: [最多 20 个显示名] },
  settings: { hidePreset: bool|null, triggerMode: "hover|click",
              remote: { enabled, size, orientation, density } },
  remote: { state: "loading|ready|empty"|null, open: bool },
  modal: { kind: "create|edit|delete-confirm|remote-input"|null, open: bool },
  log: { enabled: bool|null }
}
```

快照是**只读聚合**：不读模板正文/输入草稿、不触发渲染、不写常规日志；无 `document` 时各字段
降级为 `null`（安全）。

### 5.3 为什么这样设计

- **不新增 UI 入口**：AC 明确不污染产品界面；URL/localStorage/控制台都是排障者或用户的主动动作。
- **默认零成本**：关闭时不挂 `window` 对象、不注册监听、不打一行 `console`，常规用户无感知。
- **不混常规日志**：日志事件清单（`src/client/log/manifest` 与 `scripts/check-log-shape.mjs`）是冻结
  契约，没有这类瞬时快照字段；诊断走 `console.debug` + 固定前缀 `[dsh-prompt:diag]`，与业务日志隔离。
- **可重复**：`enable()/disable()` 幂等，`disable` 只把 `enabled` 置 false（对象留在原地供再次
  `enable`）；URL 只读不写回，localStorage 只在用户自己写时参与；刷新后完全按配置重新决定，
  不残留上次会话状态。
- **门禁钉住**：`scripts/check-real-hooks.mjs` 断言构建产物含 `__dshPromptDiag`、`dsh-prompt-diag`、
  `[dsh-prompt:diag]` 三个标记，排障入口被摇掉会立刻红。

## 6. 区域索引

| 区域 | 可依赖 | 仅调试用 | 说明 |
| --- | --- | --- | --- |
| 入口与底栏 | 12 | 4 | 入口按钮、齿轮、折叠、dock、远程输入浮层 |
| 面板框架 | 12 | 5 | 面板 holder、底栏、列表、搜索、范围三钮 |
| 模板行 | 8 | 1 | 插入行与设置页行、行内操作 |
| 触发方式与设置跳转 | 5 | 0 | 触发方式按钮、「设置 → 模板管理」导航状态 |
| 设置页 | 13 | 0 | 设置页根、各设置行、远程区块与方向/密度控件 |
| 弹层与标签 | 6 | 1 | 模态遮罩、类型、标签挑选器 |
| 远程大列表 | 18 | 1 | 远程面板、卡片、底栏分页 |
| 取色 | 12 | 6 | 取色入口、色板、弹层、描边开关 |
| 工作区挑选器 | 10 | 23 | 挑选器核心定位面（装饰钩子归调试用） |
| **合计** | **96** | **41** | 可依赖集合 = 门禁 `REQUIRED_HOOKS` |

## 7. 入口与底栏

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-entry` | 入口按钮（`conversation.input.left` 插槽，光标左侧） | 值 `1`。插件装配成功且宿主渲染该插槽即存在；点击开合面板。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-label` | 入口按钮内的文字标签 | 值 `1`。窄栏下文字被视觉隐藏但元素仍在；文案是插件名（随语言变化，**不要**写死）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-settings-modal` | 齿轮设置弹窗遮罩（挂 body 的顶层） | 值 `1`。仅在齿轮打开的独立设置弹窗里出现；遮罩本身可点击关闭。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-settings-modal-close` | 上述弹窗的关闭按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-gear` | 入口旁的远程齿轮按钮 | 值 `1`。仅远程模式开启时渲染；点击打开插件设置弹窗。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-workspace-picker` | 工作区挑选器入口按钮 | 值 `1`。点击打开挑选器（面板在 `picker-*` 区域）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-sidebar-toggle` | 侧栏折叠按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-workspace-left` | 工作区左折叠按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-input` | 远程输入浮层根 | 值 `1`。把 composer 输入搬到远程面板下方的浮层入口。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-input-root` | 远程输入浮层的顶层 holder | 值 `1`。挂 body，含遮罩与面板。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-input-sheet` | 远程输入浮层的面板卡片 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-input-ta` | 远程输入浮层里的 textarea | 值 `1`。真正的输入控件（可直接填字/断言值）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-dock` | 宿主底栏里的按钮横条容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-dock-collapse` | dock 的折叠按钮 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-dock-pill` | dock 折叠后的胶囊 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-update-entry` | 更新提示入口 | 值 `1`。 | 仅调试用 | ≤0.4.39 |

## 8. 面板框架

面板本体：`conversation.input.overlay` 插槽 → `PanelPortal` → body 顶层 holder。**面板关时整棵
卸载**（所以没有「关」状态的面板根）。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-panel-root` | 面板的 body 顶层 holder（PanelPortal 创建） | 值 `1`。面板打开时存在；关时整体消失。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-panel-state` | 入口按钮上 | 值 `open`/`closed`。面板开合的机器可读状态；面板关时它是唯一稳定载体。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-panel-surface` | 面板三个可交互面的根元素上 | 值 `bar`（底栏）/`list`（模板列表）/`remote`（远程大列表）。同一屏可能同时出现多个；不是状态机。`list` 也出现在设置页内嵌的模板列表上（与面板同一组件）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-bar` | 面板底栏容器 | 值 `1`。含范围钮、搜索、计数、添加、触发方式、设置入口、关闭。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-close` | 面板关闭按钮 | 值 `1`。点击关闭面板。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-list` | 模板列表容器（插入模式与设置页模式各一） | 值 `1`。列表空态也是同一个容器。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-counts` | 底栏计数文本 | 值 `1`。显示的已选/总数文案随语言变化。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-search` | 底栏搜索输入框 | 值 `1`。直接输入即过滤列表。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-row` | 底栏里的按钮横排容器 | 值 `1`。**注意：不是模板行**——模板行用 `data-dsh-prompt-id` + `data-dsh-prompt-row-role`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-cloud` | 范围/标签词云行 | 值 `1`。含范围三钮与标签词按钮。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-scope` | 范围三钮（全部/预置/自定义） | 值 `all`/`preset`/`custom`，标在对应按钮上。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-templates-toggle` | 设置页内嵌模板列表的折叠头 | 值 `''`（空串，历史原因保留）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-more` | 「更多」菜单容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-top-root` | 顶层 portal holder（无 rootAttr 时的默认值） | 值 `1`。用于定位任意挂 body 的浮层。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-tip` | 悬停提示 popover | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-tip-root` | 悬停提示 popover 的 holder | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-style` | 插件注入的 style 标签 | 值 = 样式段标记（如 `dsh-prompt-narrow`）。 | 仅调试用 | ≤0.4.39 |

## 9. 模板行

插入行（compact 面板）与设置页行（设置页内嵌列表）共用 `data-dsh-prompt-id` 与四个行语义钩子。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-id` | 模板行根 / 远程卡片根 | 值 = 模板 id。**不要**写死具体值；用它在行与卡片之间对账。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-row-role` | 模板行根 | 值 `insert`（插入行）/`settings`（设置页行）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-row-name` | 模板行根 | 值 = 该行显示名（已按语言与标签回退解析；不含正文）。可能为空串。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-row-labels` | 模板行根 | 值 = 逗号分隔的标签列表（可为空串；标签本身随用户数据变化）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-row-preview` | 模板行根 | 值 = 正文首个非空行生成的一句话简介（单行；可能为空串）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-pin` | 行内图钉按钮 | 值 `1`。点击切换置顶。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-act` | 行内操作组容器 | 值 `1`。自定义模板内含「编辑/删除」，预置模板内含「复制」；内部按钮无独立钩子，按语义文本找。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-hide` | 行内「屏蔽/取消屏蔽预置」按钮 | 值 `1`。仅预置模板行出现。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-chrome-kind` | 行内辅助定位元素（用量/名称等） | 值 = 该元素提供的属性列表（如 `title aria-label`）。 | 仅调试用 | ≤0.4.39 |

## 10. 触发方式与设置跳转

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-trigger` | 触发方式按钮（底栏与设置页同一组件） | 值 `1`。点击在「悬浮/点击」之间切换。**`aria-pressed` 语义反向**（true = 点击模式），判断当前值请读 `data-dsh-prompt-trigger-mode`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-trigger-mode` | 同上（同一按钮） | 值 `hover`/`click`，当前触发方式。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-chrome` | 插件「铬」元素上的稳定键名 | 值 = 词表键（如 `goSettings`/`plusGlyph`/`insertHint`/`rowExpandHint`/`usageTitle`/`tabAll`/`tabCustom`/`pickerPrev`/`pickerNext`）。既有键不改名；新键可能随功能增加。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-go-settings-state` | 底栏「模板管理」按钮 | 值 `idle`/`navigating`/`ok`/`failed`：点击导航的生命周期状态。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-go-settings-error` | 同上（仅 failed 时出现） | 值 = 失败原因：`no-document`（无 DOM）/`no-trigger`（找不到宿主设置入口）/`timeout`（约 3.6 秒内设置页未出现）/`exception`（异常）/`no-handler`（面板未接上宿主回调）。 | 可依赖 | 0.4.39（#190） |

## 11. 设置页

设置页由插件在宿主设置面板里注册的 `settings.section` 渲染；齿轮弹窗里渲染的是同一组件。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-settings-root` | 设置页根容器 | 值 `1`。宿主设置面板与本插件齿轮弹窗共用。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-setting` | 设置行根 | 值 = 该行的语义键：`hidePreset`（隐藏预置模板）/`triggerMode`（触发方式）/`remotePrefs`（远程总闸）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-hide-toggle` | 「隐藏预置模板」勾选框 | 值 `1`；`checked` 为当前值。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-toggle` | 远程模式总闸勾选框 | 值 `1`；`checked` 为当前值。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-section` | 远程设置区块 `section` | 值 `1`。方向/字号/密度控件都在区块内。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-size-value` | 远程字号数值 pill | 值 `1`；文本为当前字号。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-size-slider` | 远程字号滑块 | 值 `1`；`value` 为当前字号档位。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-orientation` | 方向控件容器 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-orientation` | 方向按钮 | 值 `auto`/`landscape`/`portrait`；`aria-pressed` 为选中态。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-orientation-effective` | 当前生效方向说明文本 | 值 `1`；文本为解析后的实际方向（随整机方向变化）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-orientation-note` | 方向说明提示文本 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-density` | 密度控件容器 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-density` | 密度按钮 | 值 `a`/`b`；`aria-pressed` 为选中态。 | 可依赖 | ≤0.4.39 |

## 12. 弹层与标签

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-modal` | 任意模态遮罩根 | 值 `''`（空串，历史原因保留；**不要**改成类型串，既有回归脚本钉着空串）。有遮罩即存在；类型看 `data-dsh-prompt-modal-kind`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-modal-root` | 模态的 body 顶层 holder（ModalPortal 创建） | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-modal-kind` | 模态遮罩根 / 远程输入浮层根 | 值 `create`（新建模板）/`edit`（编辑模板）/`delete-confirm`（删除确认）/`remote-input`（远程输入浮层）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-label-picker` | 标签挑选器容器（模板编辑弹窗内） | 值 `1`。点击打开标签网格。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-label-grid` | 标签网格 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-label-cell` | 标签网格里的单个标签格 | 值 `1`。点选 = 切换该标签。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-label-grid-mask` | 标签网格弹层遮罩 | 值 `1`。 | 仅调试用 | ≤0.4.39 |

## 13. 远程大列表

远程模式开启后，面板底栏下方渲染「大列表」：可搜索、分页、复制/编辑。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-remote-panel` | 远程大列表面板根 | 值 `1`。关闭（远程模式关）时不渲染。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-state` | 同上（同一根元素） | 值 `loading`（远程数据未就绪）/`ready`（有可见卡片）/`empty`（就绪但无卡片）。「closed」由根元素不存在表达。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-remote-enabled` | 同上（同一根元素）；同一属性也出现在设置页远程总闸勾选框上 | 值 `true`/`false`，远程总闸的只读镜像（不随面板开合变化）。 | 可依赖 | 0.4.39（#190） |
| `data-dsh-prompt-remote-orient` | 同上（同一根元素） | 值 `landscape`/`portrait`，当前实际方向。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-size` | 同上（同一根元素） | 值 = 当前字号档位（数字字符串）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-orientation-pref` | 同上（同一根元素） | 值 `auto`/`landscape`/`portrait`，用户选择的方向偏好。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-grid` | 远程卡片网格容器 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-card` | 单张远程模板卡片 | 值 `1`；同一元素还带 `data-dsh-prompt-id`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-use` | 卡片内的主操作按钮 | 值 `1`。点击即插入该模板。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-act` | 卡片内的次操作按钮 | 值 `copy`（复制预置）/`edit`（编辑自定义）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-empty` | 空槽占位 | 值 `1`。网格里的空格子。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-search-input` | 远程搜索输入框 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-add` | 远程底栏「新建」按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-search` | 远程底栏「搜索」按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-prev` | 远程底栏上一页按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-next` | 远程底栏下一页按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-page` | 远程底栏页码 | 值 `1`；文本为当前页码。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-close` | 远程底栏关闭按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-remote-input-mask` | 远程输入浮层遮罩 | 值 `1`。 | 仅调试用 | ≤0.4.39 |

## 14. 取色

模板编辑弹窗里的名字颜色 + 描边。取色弹层挂 body 顶层。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-ink-field` | 取色入口容器 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-field-btn` | 打开取色弹层的按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-swatch` | 入口上的当前色色块 | 值 = 颜色（如 `#RRGGBB`）或 `default`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-pop` | 取色弹层卡片 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-cell` | 色板网格单元 | 值 = 该格颜色（`#RRGGBB`）。点选即选色。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-hex` | 十六进制颜色输入框 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-default` | 「恢复默认」按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-outline` | 「描边」勾选框 | 值 `1`；`checked` 为当前值。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-close` | 取色弹层关闭按钮（×） | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-done` | 取色弹层「完成」按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-preview` | 颜色预览条 | 值 = 颜色或 `default`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-tint` | 应用了染色描边的名字元素 | 值 = 颜色值。只在选了颜色且描边开启时出现。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-ink-mask` | 取色弹层遮罩 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-ink-wall` | 色板容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-ink-hue-col` | 色板里的色相列 | 值 = 色相度数（字符串）。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-ink-row` | 弹层底部按钮行 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-ink-outline-row` | 描边行容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-ink-warn` | 非法颜色提示文本 | 值 `1`。 | 仅调试用 | ≤0.4.39 |

## 15. 工作区挑选器

从入口旁的工作区挑选按钮打开，用于把模板投递到其它工作区。只承诺下面 10 个核心定位面；
其余装饰/内部结构钩子归「仅调试用」。

| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |
| --- | --- | --- | --- | --- |
| `data-dsh-prompt-picker-root` | 挑选器根容器 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-sheet` | 挑选器面板卡片 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-mask` | 挑选器遮罩 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-close` | 关闭按钮 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-search` | 搜索输入框 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-grid` | 工作区卡片网格 | 值 = 列数（数字字符串）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-row` | 单个工作区行/卡片容器 | 值 = 工作区 id（**不要**写死具体值）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-card` | 选择该工作区的可点卡片 | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-loading` | 加载态容器（含取消按钮） | 值 `1`。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-empty` | 空态容器 | 值 `true-none`（真的一个都没有）/`search`（搜索无结果）。 | 可依赖 | ≤0.4.39 |
| `data-dsh-prompt-picker-cancel` | 加载态的取消按钮 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-closebar` | 面板标题栏 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-tabrow` | 标签筛选行 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-group` | 分组容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-groupcard` | 分组卡片 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-count` | 计数文本 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-time` | 时间文本 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-dot` | 状态圆点 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-badge-blank` | 空数据徽标 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-badge-cur` | 当前工作区徽标 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-badge-fail` | 加载失败徽标 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-failed` | 失败态容器 | 值 `probe`（探测失败）/`switch`（切换失败）。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-retry` | 失败态重试按钮 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-flat` | 平铺列表容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-switching` | 切换中的状态容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-pager` | 分页容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-tail` | 列表尾部容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-opbar` | 底部操作栏 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-wspane` | 工作区列表滚动面板 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-wsscroll` | 工作区列表滚动容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-sspane` | 搜索面板 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-ssscroll` | 搜索滚动容器 | 值 `1`。 | 仅调试用 | ≤0.4.39 |
| `data-dsh-prompt-picker-sstitle` | 搜索标题 | 值 `1`。 | 仅调试用 | ≤0.4.39 |

## 16. 不属于本契约的东西

- 内部 CSS 类名（`className`）、内联样式、DOM 层级、组件名、React 内部结构：一律不是契约。
- 宿主侧结构（设置弹窗分区导航、composer 光标与输入框）：宿主归宿主，规则见
  [`docs/real/observability.md`](observability.md)（#188）第「语义定位」节；宿主元素找不到时按 BLOCKED。
- `data-dsh-prompt-*` 之外的自定义属性（如 `data-dsh-style`）不是测试接缝。
