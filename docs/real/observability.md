# 边界观测层与真实输入驱动（#188）

本页是 `scripts/real/harness/observe/` 与 `scripts/real/harness/input.mjs` 的**契约文档**：
观测什么、怎么定位、每个值算哪种证据、真实输入怎么发、同一场景两条执行路径的差异怎么记录。
配套缺口清单见 [`hook-gaps.md`](hook-gaps.md)（交 #190 落成钩子契约）。

## 一句话

先记录**原始观测**（页面里采到的 JSON，不做解释），再按**来源等级**把原始值解释成可断言字段；
关键结论至少两路证据（界面 / 公开接口 + 持久化 store），期望值只来自 fixture 声明与产品契约，
不来自实现内部。输入走 CDP 公开协议发真实指针/键盘事件；合成点击保留为显式可选路径并标注。

## 观测面（六个）

| 面 | 采什么 | 定位方式 | 主要来源等级 |
| --- | --- | --- | --- |
| ① 面板根与开关 | 根 holder 数、可见子元素、面板矩形、底栏是否在 | `[data-dsh-prompt-panel-root]`、`[data-dsh-prompt-bar]` | 公开接口 / 用户可见 |
| ② 模板列表行 | 行 id、行文本、行矩形、列表容器 | `[data-dsh-prompt-list]` + `[data-dsh-prompt-id]`；行按**语义文本**匹配 | 公开接口（id）+ 用户可见（文本） |
| ③ 编辑器草稿与光标 | 草稿文本、字数、DOM 选区偏移、`captureInsertion` 的 start/end/draftRev、焦点 | `[data-composer-input]` + 宿主 inputActions 契约 | 用户可见（文本/选区）+ 公开接口（caret） |
| ④ 设置页区块与控件 | 宿主设置弹窗（role=dialog/aria-modal）、分区导航行、插件区块、屏蔽预置 checkbox、触发方式按钮 | 弹窗按语义 role，导航行按产品文本 `提示词模板`、控件按 `data-dsh-prompt-hide-toggle` / `data-dsh-prompt-trigger` | 用户可见 / 公开接口 |
| ⑤ 弹层 / 远程列表 | `[data-dsh-prompt-modal]` 计数与矩形、远程面板、设置弹窗 | `data-dsh-prompt-modal`、`data-dsh-prompt-remote-panel` | 公开接口 + 用户可见 |
| ⑥ 触发按钮及状态 | 入口按钮、底栏触发方式按钮的 `aria-pressed` / 文本 / 矩形 | `[data-dsh-prompt-entry]`、`[data-dsh-prompt-trigger]` | 用户可见 |

原始观测字段清单以 `harness/observe/probes.mjs` 的 `collectSnapshotInPage` 为准（`PROBE_VERSION=1`）；
页面内诊断证据（命中链 `hitTestExpression`、滚动日志 `scrollLog*Expression`）同样由 `probes.mjs` 导出；
布局落定等待在 `harness/observe/settle.mjs` 的 `waitForLayoutSettled`（都属观测层，套件只调用不实现）。
解释后的分级字段清单以 `harness/observe/interpret.mjs` 为准。

## 来源等级（自述 < 内部状态 < 公开接口 < 用户可见 < 持久化）

| 等级 | id | 含义 | 本层的例子 |
| --- | --- | --- | --- |
| 1 | `self-report` | 产品/脚本自己说 | 页面里自报的版本号、日志文案 |
| 2 | `internal-state` | 实现内部状态 | 从 React fiber 上翻到的对象引用等（本层只用于兜底发现，不直接当判据） |
| 3 | `public-api` | 插件/宿主公开契约 | `data-dsh-prompt-*` 钩子、`aria-pressed`、宿主 `captureInsertion` 返回值 |
| 4 | `user-visible` | 用户能看到/摸到 | 渲染文本、矩形、勾选状态、DOM 选区 |
| 5 | `persisted` | 落盘数据 | `GET /_dsh/dsh-prompt/store` 读回的 store 投影 |

`grade(value, source)` 产出 `{value, source, rank}`；`summarizeGrading(fields)` 汇总一组字段的
最低来源等级与弱字段。**失败信息里必须带 source**，报告读者才能判断证据硬度。
来源更硬 ≠ 自动正确：高等级来源也按契约断言，仍要双通道。

## 语义定位规则（不靠内部类名）

- 只允许两类选择器：`data-dsh-prompt-*` 契约钩子、宿主契约层公开的语义属性（`role` / `aria-*` /
  `contenteditable` / `data-composer-input`）。**禁止**内部类名、组件名、React 属性名。
- 列表行先取整个列表，再按归一化文本匹配：`normalizeText` 去掉零宽字符、折叠所有空白（含
  `\u00a0`、`\u3000`）、trim，然后按 `exact` / `contains` / `regex` / `any` 匹配。
- 默认 `contains` 用于「用户能读到的名字出现在这一行」；`exact` 留给导航行这类精确文案。
- 定位失败是**产品面/契约面结论**（行没有出现 → FAIL 并列出现有行文本），不是工具异常。

## 真实输入驱动（`harness/input.mjs`）

统一走 `harness/cdp.mjs` 的公开方法（`Input.*` 协议），页面里只装一个事件日志：

- 指针：多段 `mouseMoved` → `mousePressed(buttons:1)` → `mouseReleased(buttons:0)`；支持按钮、
  clickCount、修饰键；`move(from,to,{steps})` 的中间点由 `input-plan.mjs` 构造。
- 键盘：`key(name,{modifiers})` / `shortcut('Ctrl+A')` / `keyRepeat`；键位表在 `input-plan.mjs`。
- 文本：`typeText` 走 `Input.insertText`（真实输入事件，`beforeinput/input` 可见）。
- 焦点/失焦：`focus(selector)` / `blur()`。
- 选区：shift+方向键路径或 `setSelection(selector,start,end)`（DOM Selection API，全局文本偏移）。
- 机械预备：`scrollIntoView(selector)` 只负责把目标滚进可点击区域，不算业务断言。它**不用原生
  `el.scrollIntoView()`**：宿主设置弹窗是固定定位 + 内部滚动容器，原生调用实测会把控件滚到视口外
  （#188 真机：触发按钮被滚到 `y=-64`，点击坐标落在视口外、产品完全收不到事件）。实现改为
  「不完全可见时才滚 → 逐层最小位移 → 滚完复核」，返回 `{ok, rect, steps}`；`ok=false` 时套件记
  BLOCKED —— 物理点击前的几何准备失败是工具/宿主滚动容器限制，不能算产品失败。
- 布局落定与命中验证（真机时序，非断言放宽）：打开插件设置页后，产品自己会把远程段滚进视野
  （`src/client/index.ts` 的 `goSettings` 用 200ms 轮询 + `scrollIntoView`，是 #82 直达行为），
  这个滚动可能发生在设置弹窗出现之后，让刚采集的控件几何失效。套件先等「触发按钮矩形 + scroll
  日志长度连续两拍不变」再采集（`harness/observe/settle.mjs` 的 `waitForLayoutSettled`），并且每次物理点击前用
  `document.elementFromPoint` 验证命中链上确实是目标控件；命中不对或点击后状态没翻转才重新采集
  重点（≤3 次，每次都是真实指针）。三次真实物理点击后状态仍未翻转 → FAIL，不放宽判定。
- 页面事件日志：`input.log.install()` 后在 capture 阶段记录 pointer/mouse/click/key/input/focus/
  selection 事件（含 `isTrusted`）。事件目标记录**契约链** `chain`：目标自身 + 祖先上的
  `data-dsh-prompt-*`。真实指针事件的 target 常是行内 span（例如只带 `data-dsh-prompt-label`），
  只看单层 attrs 会把「命中入口组件」误判成没命中；`attrs` 仍是最近组件的属性，`owner` 是最近的
  带契约属性祖先，`chain` 让内层元素的事件也能归到外层组件。

**合成点击是显式可选路径**：`input.syntheticClick(selector)` 调 `element.click()`，返回
`method='synthetic.click()'`，日志里是 `isTrusted=false` 的 click。套件必须标明走了哪条路，
两路结果都要落进报告。物理输入不得用合成事件冒充。

## 双通道策略

关键断言至少两路：

1. 界面/公开接口：可见文本、`aria-pressed`、`captureInsertion` 返回的光标位置；
2. 持久化：`createPersistence({origin, storePath})` 经 #187 的 HTTP 读回（`GET /_dsh/dsh-prompt/store`）
   轮询到期望投影（`hidePreset` / `hoverTrigger` / `usage` / `lastUsed` / customs 等）。

`compareDualChannels(a, b)` 统一对账：两侧各带 `{name, value, source}`，`agree=false` 时报告里同时列
两路值与来源，并明确「双通道不一致」。写盘是异步的，所以对持久化的断言一律 `persistence.waitFor`，
不用固定 sleep。

## 两条执行路径的差异记录

套件把结果写进报告 `environment.boundary`：

- `observations.*`：每个场景每条路径的**原始观测**（未解释的页面 JSON）与关键解释快照；
- `diffs.scenarioNFacets`：两路在「用户该看到什么」上的扁平观测差分
  （`diffObservations`，0 条 = 两路径行为一致）；
- `diffs.scenarioNEvents`：两路页面事件类型的多重集差（`diffEventSequences`，
  `onlyLeft` / `onlyRight`），物理路径独有的 pointer 序列与两条路径的 click `isTrusted` 差异是预期差异；
- `inputMethods`：两条路径各自的方法说明；
- `completedScenarios` / `currentScenario` / `finishedAt`：场景进度，失败时也保留完整现场。

差分断言分两层：**行为差分必须为 0**（同一场景两路应得到同一用户可见结果）；**事件差异必须
可解释**（物理独有真实指针序列、合成独有非 trusted click），把预期差异写死在断言里，
不让「有差异」被静默接受。

## boundary 套件

    node scripts/real/run.mjs --artifact <tgz> --suite boundary --fixture templates --evidence-dir <evidence-dir>

三个代表性场景：

1. **打开面板**：物理多段悬停入口 ↔ `element.click()`；断言面板可见、入口事件 `isTrusted`、
   底栏触发方式与 fixture 声明一致、行 id 与 store 自定义模板 id 双通道一致；两路行为差分 0，
   事件差异清单落报告。
2. **行插入落位**：按用户可见名称定位模板行，物理点行后逐字断言 composer 草稿 = fixture 正文、
   光标在正文末尾（`captureInsertion` + DOM 选区两路），store `usage+1` / `lastUsed` 双通道；
   再用合成点击重复一遍，断言结果一致（差分 0）。
3. **设置页控件切换**：物理点底栏「模板管理」进设置页（导航失败按 BLOCKED 记，不冤枉产品），
   断言弹窗/分区/控件挂载；物理点「屏蔽预制模板」→ UI 勾选翻转 + store `hidePreset` 落盘；
   物理点触发方式 → `aria-pressed` 语义翻转 + store `hoverTrigger` 落盘，各自双通道对账。

## 纯 Node 自证

    node scripts/real/harness/observe/selftest.mjs
    # RESULT: 208 PASS / 0 FAIL（观测层自证全绿）
    # package.json 建议行：check:real-observe（见报告，#188 不直接改 package.json）

自证覆盖：来源等级模型、语义文本定位、扁平差分与双通道、输入序列构造（指针路径/点击/快捷键）、
六面解释器（用合成 RAW 快照）、句柄装配（`snapshotExpression()` 可解析、接口封闭、参数校验）。

## 模块地图

    scripts/real/harness/
      observe/
        source.mjs       来源等级模型（比较/分级/汇总）
        text.mjs         语义文本归一化与匹配、行定位
        compare.mjs      原始观测扁平差分、双通道对账（含同源校验）、事件序列差分
        interpret.mjs    六个观测面的解释器（raw → 分级字段，不判期望）
        probes.mjs       页面内采集函数 + HOOKS + snapshotExpression + hitTestExpression + scrollLog*Expression + 轮询等待
        settle.mjs       布局落定等待（矩形 + 滚动日志连续两拍不变；只等时序、不下判定）
        index.mjs        统一入口：createObserver / createPersistence / 重导出
        selftest.mjs     纯 Node 自证（零浏览器/零宿主）
      input-plan.mjs     指针路径/点击/按键/快捷键/文本输入序列构造（纯函数）
      input.mjs          真实输入驱动 + 页面事件日志 + 显式合成点击
    suites/boundary.mjs  三个代表性场景（物理 vs 合成、双通道）
    docs/real/observability.md（本页）、docs/real/hook-gaps.md（缺口交 #190）

## 边界与限制

- 观测层**不修改插件**：所有页面侧采集是只读 `evaluate`；不会为了好测去改产品。
- 页面里没有稳定钩子的地方（面板开关状态、行名字段、设置页分区等）目前用替代观测，
  逐条记录在 [`hook-gaps.md`](hook-gaps.md)，等 #190 落成 `data-*` 钩子后收紧。
- 宿主 composer 的草稿/光标属宿主契约（`docs/real/host-contract.md`），本层只消费、不改动。
- 合成点击路径只用于对照/兜底，不得作为产品行为的主证据；报告里通过 `method` 与 `isTrusted=false`
  可以区分，不允许含糊。
