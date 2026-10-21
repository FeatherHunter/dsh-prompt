# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Release

Ship npm releases with the token script `scripts/publish-token.ps1` (unattended, no human clicks; usage is in the script header); never hand the publish/OTP steps back to the user. Token path: the `NODE_AUTH_TOKEN` value lives in the User-scope environment (read it into the process with `$env:NODE_AUTH_TOKEN = [Environment]::GetEnvironmentVariable('NODE_AUTH_TOKEN','User')`, name only, never print the value) → `pwsh -NoProfile -File scripts\publish-token.ps1 -Probe` first (must be PROBE-OK; on a fresh version it reports PROBE-SKIP, which is expected — prove the write chain against the current published version instead) → `pwsh -NoProfile -File scripts\publish-token.ps1` (gates → publish → one-pass sampling; add `-FullPost` before announcing). Do not use `scripts/publish-window.ps1` (interactive 2FA window) unless the token path is unavailable. Accepted ≠ visible: `E409 previously-staged` means received, wait minutes, do not republish or bump.

## Star History

两页 README 的交流群（GROUP）段下面挂着星标增长曲线，图是自己画的：GitHub API 拉「每颗星何时被点亮」→ 按 UTC 天聚合 → 纯函数画一张自包含 SVG。视觉照源仓 B3 版（2026-10-21）：双 Y 轴、每系列一色的刻度、横排轴名、峰值标注。

- **取数与出图**：`npm run star:history`（`scripts/update-star-history.ts`）—— 自己调 `gh api -H "Accept: application/vnd.github.star+json" "repos/FeatherHunter/dsh-prompt/stargazers?per_page=100" --paginate --jq ".[].starred_at"`（Accept 头不能省，默认返回里没有时间），写 `docs/star-history.json`（数据）与 `docs/star-history.svg`（图）。画图纯函数在 `scripts/star-history.ts`：`aggregateByDay` 按 UTC 日聚合、`buildSvg` 出图（手绘抖动来自 `fnv1a`+`mulberry32` 种子，同数据同字节）。
- **一张图顶两套配色**：SVG 里用 CSS 变量 + `@media (prefers-color-scheme: dark)`，不拆深浅两个文件 —— 拆了就得靠 `<picture>` 切换，而市场详情页渲染器整段丢弃原始 HTML，`<picture>`/`<img>` 在那边都不显示，所以两页 README 用 **markdown 图片**引用。
- **图片走绝对 raw 直链**（`https://raw.githubusercontent.com/FeatherHunter/dsh-prompt/main/docs/star-history.svg?v=YYYYMMDD`）：GitHub / npm 包内副本 / 市场详情页三处都能出图；`?v=` 是缓存戳，GitHub 图片代理按 URL 缓存，**图换了必须换戳**。
- **每日自动更新**：`.github/workflows/star-history.yml`（cron UTC 02:17 + `workflow_dispatch`）拉数 → 重画 → 改两页 README 的 `?v=` 戳 → 有变化才提交。脚本不裸 `git push`（任务跑得久、期间远端可能又前进，裸 push 会被拒）：先 `git pull --rebase origin main`，冲突就当天跳过不报错。Node 用 22.18（本仓 `.ts` 靠原生类型剥离直跑，Node 20 跑不了）。
- **双轴视觉契约**（B3，2026-10-21）：左轴 `Total Stars`、右轴 `Daily New`，两轴各自按自己的最大值缩放 —— 共用一根轴时总量一大，每日新增就被压成贴着 X 轴的一条平线。每套主题里一个系列一个色值（深色红 `#ff6b6b` / 蓝 `#38bdf8`，浅色压深到过 AA 的 `#b93a34` / `#1d4ed8`），曲线、轴线、轴名、刻度数字、峰值标注共用；轴名横排放在各自轴的正上方兼作色键，所以没有图例、也没有竖排文字；两条曲线各自的最高点直接标数字（`data-peak`）。**曲线圆滑契约**：不要尖锐折角 —— Daily 先走两轮 `[1,2,1]/4` 二项平滑（`smoothDaily`）削掉针尖，两条曲线再各做两轮 Chaikin 角切（`chaikin`）后穿 Catmull-Rom；平滑与角切都只是凸组合，只会削峰、不会造假峰，峰值数字仍取原始数据最大值。
- **门禁**：`npm run test:star-history`（`scripts/check-star-history.mjs`）钉住「同数据同字节」「盘上 SVG = 现画的 SVG（改了数据忘了重画就红）」「B3 双轴契约（两轴各带 `data-axis`、两列刻度各用系列色、没有 `rotate(`、峰值标注等于数据最大值）」「曲线圆滑契约（全是 C 段、无折线；`smoothDaily`/`chaikin` 不越出原始范围；Daily 顶点不高过原始峰值）」「两页 README 都在 GROUP 之后引用图且带 `?v=` 戳」。
