# Changelog

格式为 Keep-a-Changelog 子集：`Added/Fixed/Changed` 必写（更新面板按此渲染“更新说明”），`Unreleased` 面板忽略。

## [0.4.1] - 2026-10-06

### Changed
- 远程标签区移除（#132）：过滤只走搜索框全文；底栏动作组左起单行。

### Fixed
- 会话少时挑选器面板自适应收矮沉底（多时顶满内滚），内容贴工作区上方。

## [0.4.0] - 2026-10-06

### Added
- 遥控输入镜（#123，承 #119–#122 定稿）：触控栏新增输入框键（注册式续加，插挑选器后、收起前），底贴 Sheet 复用挑选器尺寸数学（ADR-0005，不另起第三套；62dvh + em 地板 + 键盘感知），草稿桥双写唯一 `setDraft`（不伪造发送）、单模态互斥 + Esc/遮罩关 + 焦点回 opener + isComposing 门。
- 模型键休眠门（#120 ABSENT）：宿主无模型面即零占位隐藏，有面后自动插输入框后；会话弹窗改双区横滑两行、当前会话优先。
- 回归 `test:issue-123`（含 ADR-0005 禁第三套 math 断言）+ `package.json` 入口。

## [0.3.4] - 2026-10-06

### Changed
- 更新入口切 `direct`：点“检查更新”即开弹窗（面板挂载自查，不预查）；手写“更新档案”按钮与更新卡删除，弹窗只由入口按需打开。

## [0.3.3] - 2026-10-06

### Fixed
- 更新弹窗不再自动弹出：改为标题栏“检查更新”右边的“更新档案”按钮按需打开；更新卡留壳放提示行。

## [0.3.2] - 2026-10-06

### Added
- 跟进 `dsh-plugin-update` 0.5.0：弹窗关闭落地（点“关闭”/按 Esc 由调用方撤 DOM，包随后自停轮询；入口打开的 dialog 包已内置闭环）。
- 更新面板与入口换新主题首选名 `archive`。

### Fixed
- 弹窗点“关闭”没反应（此前只停轮询不撤 DOM，入口打开的 dialog 还会卡死；现走关闭落地）。

## [0.3.1] - 2026-10-05

### Added
- 更新面板切弹窗形式（dialog，默认主题；Esc 可关），更新日志有新版自动展示。

### Changed
- 更新通道显式 opt-in 预发布（`releaseChannel: 'prerelease'`；`latest` 指稳定版时行为不变）。
- 更新电话由三条加到四条（新增 `updateChangelog` 取日志，网关路由 `/_dsh/dsh-prompt/update/changelog`）。

## [0.3.0] - 2026-10-05

### Added
- 切到 `dsh-plugin-update` 0.3.1 整组件：入口 `mountUpdateEntryHttp(button)` + 面板 `mountUpdatePanelHttp`，宿主复用 `createHostUpdate`，面板挂载只查、安装只走用户点击。

### Changed
- 删除自研更新 UI 与客户端 bridge/垫片/派生产物约 92KB，只留对新包的几行集成调用；宿主网关改裸回包。

### Fixed
- 回归 39/40/41 按 0.3.1 http 口径重写全绿，37 顺带修绿。
