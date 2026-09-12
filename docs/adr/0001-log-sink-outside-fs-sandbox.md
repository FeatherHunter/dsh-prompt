# 日志落盘绕过 ctx.fs 沙箱，直写 ~/.dsh/logs

诊断日志的落点必须稳定、不随工作区漂移，而 DSH 的 `ctx.fs` 在 workspace-write 下把可写集限定为 `workspaceRoot + /tmp + os.tmpdir()`（围栏只挂在 `writeText`/`editText` 上），`~/.dsh` 必被拒；它且连 `mkdir` / `unlink` / `rename` 都没有，建目录与清理做不到。因此本插件的日志落盘由宿主半用 `node:fs/promises` 直接写 `<home>/logs/dsh-prompt/`（`<home>` 按 `$DSH_HOME` → `~/.dsh` 解析），不经 `ctx.fs`；写失败降级到 `os.tmpdir()/dsh-prompt/`，再失败则彻底不落盘并只在 stderr 告警一次。同 profile 的第三方插件 dsh-vision-router 走的是同一条路（`lib/file-logger.js` 用 `node:fs/promises` 写 `~/.dsh/logs/vision-router/`），本仓 `lib/index.js` 也已有 `node:fs` 先例。

**状态**：accepted（2026-09-12，map #45 / 子票 #46）

## 考虑过的选项

- **走 `ctx.fs`，落点降到 workspaceRoot（如 `<cwd>/.dsh-prompt-cache/`）** —— 守沙箱，但日志跟着工作区跑。本仓已有反例：dsh-mattpocock-skills-deck 这么做，它的日志现在躺在 dsh-prompt 的工作区里（`.dsh-mattskillsdeck-cache/logs/2026-09-11.log`），而它自己的注释写明「`~/.dsh` 在沙箱外被拒 → 缓存永不写入」；换工程就找不到旧日志。
- **走 `ctx.fs`，落到 `os.tmpdir()`** —— 守沙箱且必然可写，但系统重启或清理临时目录后日志就没了，而日志的价值恰恰是事后回溯。
- **放弃 `ctx.fs`、用 `node:fs` 写 `~/.dsh/logs/dsh-prompt/`（选定）** —— 与 DSH 自身日志布局并列，位置稳定；代价是绕过平台围栏，且插件必须自己管住写什么。

## 后果

- 本插件在宿主进程里持有不受 `ctx.fs` 沙箱约束的写权限。**落点与写入点必须由本仓自己收敛，不得出现第二个写日志的地方** —— 这也是 map 里「单条事件序列化后不超过 1KB」与事件清单字段白名单两条硬约束存在的原因。
- `ctx.fs` 没有 `mkdir` / `unlink`，所以 dsh-log 需要的文件服务（`resolve` / `readText` / `writeText` / `mkdir` / `unlink` / `listDir`）要由本仓用 `node:fs/promises` 自建一个适配器传给它，否则「清空」无得可用。
- **不要写 `inject: ['platform']`** —— 0.1.5-rc.1 平台没有 `platform` 服务（全档 22094 文件中 `ctx.platform` 与 `provide("platform"` 零命中）；`getPlatform` 由本仓自建，形状为 `{ os: process.platform, path: node:path, fs: <上面的适配器> }`。
- `@deepseek-ai/dsh-home-paths` 是**库不是服务**（无 inject，官方 README 明确说不要经 cordis.yml 加载），本仓不依赖它，自行解析 `$DSH_HOME` 与 `~/.dsh`。
