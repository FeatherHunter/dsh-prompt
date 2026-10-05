# Changelog

格式为 Keep-a-Changelog 子集：`Added/Fixed/Changed` 必写（更新面板按此渲染“更新说明”），`Unreleased` 面板忽略。

## [Unreleased]

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
