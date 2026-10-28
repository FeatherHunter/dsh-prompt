# Issue #182 调研：#179 勾选框 hover 反馈失效（根因与门禁缺口）

- Issue：[【BUG】#179 真机：设置页「屏蔽预制模板」勾选框 hover 无高亮（Check 不透传 data 钩子）](https://github.com/FeatherHunter/dsh-prompt/issues/182)，labels bug / needs-triage，0 评论。
- 日期：2026-10-29。方法：只读——本仓源码、回归脚本、#179 真机证据（D:\Temp\cdp\c3-bug-evidence.json、D:\Temp\cdp\phase179c-results.json）、本地渲染探针（D:\Temp\probe-182.cjs，不改仓）、git / npm 面。未改业务代码、未提交、未写 GitHub。

## 结论摘要

- 根因：`Check` 只建 `input{type,checked,disabled,style,onChange}`，不透传 `data-*/aria-*`（`src/client/settings-page.ts:142-152`）。同文件 `Btn` 自 #110 已有透传循环（`:119-127`），`Check` 没跟上。
- 后果：`BAR_UI_CSS` 的 `[data-dsh-prompt-hide-toggle]` 规则（hover / checked:hover / focus-visible）全部空转；`[data-dsh-prompt-remote-toggle]` 钩子同样被丢，但全仓没有该选择器的样式（见 §3）。
- 门禁漏因：现有回归只在源码文本与 `Check` 复合组件 props 上断言，没有 host `<input>` 的 DOM 断言（§4）。
- 非回归：`Check` 自 #110 起就不透传，#179 是第一次让缺口可见；0.4.39 未发布，npm 0.4.38 用户无感。
- 未实现：main@54b34ba 无改动、无分支/提交/PR/stash；工作树仅 0.4.38→0.4.39 version bump。

## 1. 源码事实（main @ 54b34ba）

- `Check`：`src/client/settings-page.ts:142-152`——`react.createElement('input',{type:'checkbox',checked:props.checked,disabled:props.disabled,style:{...},onChange:props.onChange})`，无 prop spread。
- `Btn`：`src/client/settings-page.ts:103-136`；`:119` 注释「#110 收尾：透传 title/disabled/data-*/aria-*」；`:124-126` 循环把 `data-*`/`aria-*` 收进 `extra`；`:134` `...extra` 展开。
- 调用点：远程总闸 `h(Check,{checked:!!remote.enabled,'data-dsh-prompt-remote-toggle':'1',...})`（`:541-543`，所在 `remote-switch` 行 `:538`）；「屏蔽预制模板」`h(Check,{checked:hideOn,'data-dsh-prompt-hide-toggle':'1',...})`（`:693-695`，行 `:688-702`）；日志开关 `h(Check,{checked:logOn,disabled:!log,...})`（`:644`，无钩子）。
- `BAR_UI_CSS`：`src/client/template-browser.ts:823-861`；选择器 `hideToggle='[data-dsh-prompt-hide-toggle]'`（`:831`）；`:845` transition；`:846` hover（`box-shadow:0 0 0 3px rgba(240,164,92,.3)` + `filter:brightness(1.12)`）；`:847` checked:hover（`.55`）；`:848` focus-visible（`outline:2px solid var(--dsw-specific-accent)`）。`trig='[data-dsh-prompt-trigger]'`（`:830`）与胶囊规则另在 `:837-850`。
- 构建产物：`lib/client.js` CSS 在 `:3776-3779`，`function Check(props)` 在 `:15496`（同样丢属性），hide 钩子调用在 `:16162`——修复必须重建 lib（`check:lib-sync` 校验）。
- 全仓 grep：`[data-dsh-prompt-remote-toggle]` 只在 `src/client/settings-page.ts:543` 与测试出现；无任何 CSS 规则。

## 2. 运行时证据

- 本地渲染探针（只读）：`D:\Temp\probe-182.cjs` 用 `scripts/lib/transpile-client.cjs:buildFlat` 转译 `settings-page.ts`（13 模块），`react-test-renderer` 挂载 `SettingsPage` 后检查 host `<input>`：
  - 3 个 `Check` 复合组件：hide / remote / log；前两者 props 带各自钩子，log 无。
  - 3 个 host checkbox 的 props 只有 `checked/disabled/onChange/style/type`，data/aria 全空 → 钩子止步于复合组件、没落到 DOM。
  - `BAR_UI_CSS` 含 `[data-dsh-prompt-hide-toggle]:hover`、`:checked:hover`；不含 `[data-dsh-prompt-remote-toggle]` 规则。
- 真机（票面已有，复核一致）：`c3-bug-evidence.json` reproduced 3/3、`hasDataHook=false`、hover 前后 `boxShadow/filter=none`；`phase179c-results.json` 16 项仅 C3a/C3a2 FAIL，C3b 胶囊 PASS。
- React 行为注记：`checked/disabled` 是 DOM property、`onChange` 不渲染为 attribute，所以「DOM 属性只有 type/style」不是 Check 的问题；但 `data-*` 若透传会作为 attribute 出现——实测没有，即证明被丢弃。

## 3. 范围校正（#179 承诺边界）

- `D:\Temp\dsh-prompt-179-handoff-2026-10-29.md:30-33`：C 组「设置面板观感」C3 悬浮反馈只列「屏蔽预制模板」勾选框（accent 外环+提亮；checked hover 更强）与「触发方式」胶囊（环/提亮；aria-pressed=true 更强）。**远程模式总闸不在 C3。**
- #182 正文「远程那枚也不会有 #179 承诺的 hover 反馈」：远程确实被丢钩子，但 #179 从未给它写样式（全仓无该选择器 CSS），不构成「承诺未兑现」，只是同根因顺带暴露。
- C3b 胶囊 PASS + `BAR_UI_CSS` 规则文本存在 → 样式注入链路正常，坏点只在勾选框 DOM 属性。

## 4. 门禁缺口

- `scripts/repro/test-issue-179.cjs` E 组（`:162-189`）断言 `BAR_UI_CSS` **源码文本**含 hideToggle 选择器/规则；F 组（`:191-201`）断言 `settings-page.ts` 源码文本含钩子/组件字符串。两者都不跑渲染、不碰 DOM。
- `scripts/repro/test-issue-82.cjs:225-228`、`scripts/repro/test-issue-110.cjs:228` 起在 `Check` 复合组件 props 上 `findByProps` → 天然看不到 host input 丢属性。
- 建议（供实施票）：新增 `scripts/repro/test-issue-182.cjs`，按 test-issue-116/179 的 buildFlat 挂载 `SettingsPage`，断言 host `<input>` 带两枚钩子；接入 `package.json` 的 `check` 链。

## 5. 未实现 / 发布面核对

- HEAD `54b34ba`（= `origin/main`）；无 `*182*` 分支、`git stash list` 空、`git log --all --grep 182` 只有无关 docs commit、`gh pr list --state all --search 182` 空。
- `git status`：仅 `package.json`/`package-lock.json` 修改（0.4.38→0.4.39，未提交）；`npm view dsh-prompt version` = 0.4.38。

## 6. 待维护者拍板（与票面同步）

- Q1 远程总闸是否一并补同款视觉（推荐：一并补，共用选择器组；属性透传是必须，视觉是扩展）。
- Q2 修后真机复核范围（推荐：#179 C3 三态 + C3b 对照）。
- Q3 修复随哪批发（推荐：随未发布的 0.4.39 同批）。

## 7. 来源

- 本仓：`src/client/settings-page.ts`、`src/client/template-browser.ts`、`lib/client.js`、`scripts/repro/test-issue-179.cjs`、`scripts/repro/test-issue-82.cjs`、`scripts/repro/test-issue-110.cjs`、`package.json`。
- 真机/探针（仓外临时）：`D:\Temp\cdp\c3-bug-evidence.json`、`D:\Temp\cdp\phase179c-results.json`、`D:\Temp\dsh-prompt-179-handoff-2026-10-29.md`、`D:\Temp\probe-182.cjs`。
- 既有笔记：`research/trigger-mode-setting/findings.md`（#179 触发方式设置；不覆盖本票问题）。
