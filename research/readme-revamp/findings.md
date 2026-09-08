# README 改版调研：参考范式拆解 + 现状盘点 + 截图开拍清单

> wayfinder map #24 · research 票 #25。调研方法：`gh api` 拉参考 README base64（先 `-replace '\s',''` 再 `FromBase64String`）逐节解码 + 本地源码对照（`src/client/*.ts`）。
> 结论先行：参考范式可整体照搬，dsh-prompt 只需把"任务板"换成"三入口+24 模板"；用户开拍 8 张图（`assets/readme/01~08.png`），英文版首版复用中文图（参考英文版即如此）。

---

## 1. 参考 README 全结构解码（dsh-mattpocock-skills-deck，254 行）

来源：`gh api repos/FeatherHunter/dsh-mattpocock-skills-deck/readme`（`size: 13043`），英文版 `docs/README.en.md`。

### 1.1 头部范式：居中 H1 + 中英切换 + slogan + 求星 + 8 徽章

```html
<h1 align="center">dsh-mattpocock-skills-deck</h1>
<div align="center">
**中文** · [English](docs/README.en.md)
**拨开战争迷雾看见终点，剩下的交给 MattSkillsDeck。**  ← slogan（加粗单行）
让 [mattpocock/skills](...) 在 DSH 里化作一块看得见、派得动的任务板。  ← 价值一句话
你的 ⭐是我夜空中最亮的星。  ← 求星（独立成行）
*Part the fog of war, see the end — MattSkillsDeck handles the rest.*  ← 英文 slogan 斜体
[8 徽章同行]
</div>
```

8 徽章 URL（原样照搬，只换仓库/包名）：

| # | 显示 | URL 模板 |
|---|------|----------|
| 1 | 版本 | `https://img.shields.io/npm/v/<包>?label=%E7%89%88%E6%9C%AC` → 链到 npm 包页 |
| 2 | 下载量 | `https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2Flast-month%2F<包>&query=%24.downloads&label=%E4%B8%8B%E8%BD%BD%E9%87%8F&suffix=%2F%E6%9C%88&color=brightgreen` |
| 3 | 最近更新 | `https://img.shields.io/github/last-commit/<owner>/<repo>?label=%E6%9C%80%E8%BF%91%E6%9B%B4%E6%96%B0&color=FE7D37` → 链 commits/main |
| 4 | 提交数（月） | `https://img.shields.io/github/commit-activity/m/<owner>/<repo>?label=%E6%8F%90%E4%BA%A4%E6%95%B0&color=DFAB01` → 链 graphs/commit-activity |
| 5 | 许可证 | `https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT-lightgrey.svg` → 链 LICENSE |
| 6 | 内容背书 | `https://img.shields.io/badge/%E6%8A%80%E8%83%BD%E5%8C%85-mattpocock%2Fskills-9D7CD8` → 链上游仓库（dsh-prompt 对应：模板数 24，见 §4） |
| 7 | 期待参与 | `https://img.shields.io/badge/%E6%9C%9F%E5%BE%85%E4%BD%A0%E5%8F%82%E4%B8%8E-brightgreen.svg` → 链 issues |
| 8 | 未来展望 | `https://img.shields.io/badge/%E6%9C%AA%E6%9D%A5%E5%B1%95%E6%9C%9B-6f42c1.svg` → 链 docs/ROADMAP.md |

### 1.2 节标题范式

```html
<h2 align="center"><sub>INSTALL</sub><br>安装</h2>
```

英文副标 + 中文主标、居中。节顺序：INSTALL → BOARD → STATUSBAR → DETAIL → NEW SESSION → SKILLS → BACKENDS → FAQ → ARCHITECTURE → DEVELOPMENT → MORE → THANKS → CONNECT → star-history 图。

### 1.3 INSTALL 节（含 profile 必填警告 / 锁版本 / 重启 / 进阶 details / 发给 AI 的提示词 / 升级卸载）

- 前置要求一句话（DSH 是什么 + 本插件把它变成什么）。
- bash 三段：① 装 DSH CLI（已装跳过）；② `--profile` 必填警告原文——"装进你实际使用的 DSH 入口对应的 profile（装错 profile 等于没装，重启多少次都不会加载）"，web/desktop 双命令；锁版本行（当前 1.7.14）+ `--registry https://registry.npmjs.org`。
- 重启说明（div 居中）："装完**重启一次对应的 DSH 入口**即生效：桌面应用完全退出并重开 DSH Desktop；web 服务重启 `dsh web` 后刷新页面。零配置。" + 窄屏 tip（顺手装 dsh-better-sidebar）。
- 👇 + 首图（见 §1.4）。
- `<details><summary>进阶安装：免全局、更新不生效、交给 AI</summary>` 内：npx 免全局、官方源强制更新、以 web 为例声明 desktop 替换规则、**发给 AI 的安装提示词**（`text` 代码块：确认 profile → 读 README → 检查环境按需安装 → 汇报结果）。
- 升级/卸载 bash（`update` / `remove`，附 desktop 替换注）。

### 1.4 功能节版式：价值描述 + 👇 + 真实截图（边框圆角）

每节 = 居中 div 内"2~3 行价值描述（讲状态变化，不讲参数）" + 加粗 `**👇 ……**` 承接句 + `<img>`。图片统一：

```html
<img src="assets/readme/02-task-board-list.png" width="640" alt="任务板列表：状态筛选、标签筛选与行动作按钮" style="border:1px solid #30363d;border-radius:6px">
```

截图文件与宽度（`assets/readme/`，注意无 06——SKILLS 节无图）：

| 文件 | 宽度 | 对应节 |
|------|------|--------|
| `01-install-board-ready.png` | 640 | INSTALL（装完重启就绪） |
| `02-task-board-list.png` | 640 | BOARD |
| `03-statusbar-capsule.png` | **720**（横向长条类加宽） | STATUSBAR |
| `04-issue-detail-comment.png` | 640 | DETAIL |
| `05-new-session-prefilled.png` | 640 | NEW SESSION |
| `07-backend-switch.png` | **560**（小弹窗类收窄） | BACKENDS |
| `08-faq-stale-version-fix.png` | 640 | FAQ（终端官方源重装回显） |

SKILLS 节无截图先例：纯文字（随包数量 + 默认推荐 + 一行讲清用途 + 点加载行为 + 外链上游教程，本插件只讲入口与推荐）。dsh-prompt 的"模板一览"有真实面板，可拍图，不必学无图。

### 1.5 FAQ / ARCHITECTURE / DEVELOPMENT 写法

- FAQ：`<details open>` 常驻展开一个最高频问题（更新后还是旧版 → pnpm `minimumReleaseAge` 解释 + 官方源命令 + 👇 终端回显图 08）。
- ARCHITECTURE：居中 div，一句话 + 在线预览（github.io）或本地 html（克隆后直接打开）。
- DEVELOPMENT：一句话 + 指向 `docs/workflow/DEV-WORKFLOW.md`（不把构建命令堆在 README）。

### 1.6 MORE / THANKS / CONNECT / star-history 写法

- MORE（作者的其他作品）：居中 div，"喜欢这个插件的话，这些可能你也用得上：" + 每个 `**[repo](url)** —— 一句话价值`（4 个）+ `---` + "有问题、有想法？[提交 ISSUE](issues)，或到[讨论区](discussions)聊聊" + 免责（个人作品，与官方没有关系）+ `MIT © FeatherHunter`。
- THANKS：`<div align="left">`，感谢语 + `@user(链接) — 反馈了 #xxx（事由一句话）、PR #xxx，感谢你让……🌹` 逐人点名 + 收尾邀约。
- CONNECT（加入我们）："扫码加入话题群——二维码永久有效。日常闲聊与快速答疑走群里，Bug 与需求请直接提 ISSUE，更高效可追溯。" + `<img src="assets/qr-topic-group.png" width="280">` + 加粗群名 + `<sub>` 有效期注。
- star-history：`<a href=".../star-history.html"><picture><source dark><source light><img></picture></a>`，双主题 svg（`docs/star-history-{dark,light}.svg?v=日期`），raw.githubusercontent 引用。

### 1.7 About（`gh api repos/.../dsh-mattpocock-skills-deck --jq` 实测）

- description：中文价值句 + 版本快照 + 主力/预览/不支持边界 + 祝福语（长描述，含中文）。
- homepage：`https://featherhunter.github.io/dsh-mattpocock-skills-deck/architecture/MattSkills-architecture.html`（架构预览页，非仓库）。
- topics（10 个）：`agent ai claude deepseek-harness dsh dsh-better-sidebar dsh-plugin github-issues skills wayfinder`。

### 1.8 英文版策略

`docs/README.en.md`：同结构，节副标英文（IN ACTION 等），**首版复用中文截图**（`../assets/panel-list-zh.png` width 640 / `statusbar-zh.png` 720 / `issue-detail-zh.png` 640 等），QR 图共用。dsh-prompt 英文版照此办理，零额外拍摄成本。

---

## 2. 现状盘点（dsh-prompt）

### 2.1 README.md（122 行，全 SVG 占位）

- 头部：`# ⚡ dsh-prompt`（非居中 H1，无 slogan/求星/英文斜体）+ 中英切换行 + 一句话价值 + **仅 4 徽章**（license/npm/dsh-plugin/platform，无下载量/最近更新/提交数/内容背书/参与/展望）。
- 快速导航：8 个 SVG 按钮（nav-*.svg）。
- INSTALL：有 DSH CLI 前置、web 单 profile 命令、锁版本 0.1.6、npm view 查版本、零配置 bundle（`cordis.patch.yml` 自动装配）+ 重启/刷新。**缺**：`--profile` 必填警告（装错=没装）、desktop 变体命令、`--registry` 显式源、进阶 `<details>`（免全局/AI 提示词）、升级/卸载命令（`remove` 只在正文提一句）。
- 三入口 / 模板 / 自定义 / 隐私 / FAQ 各节均为单张 SVG 占位图，无价值描述、无 👇 承接、无真实截图、无 details。
- 同作者节：4 项（palette/ui-debug/skills-deck/chinese-patch），缺一句话价值打磨与 ISSUE/讨论区分工。
- 作者的话（SVG）+ `assets/author-contact.png` + ISSUE 邀约；许可节 SVG。**缺**：THANKS 点名、CONNECT 扫码群、star-history、ARCHITECTURE、DEVELOPMENT（仅 2 行 build 命令）。

### 2.2 docs/README.en.md（106 行）

与中文镜像，中英 SVG 成对（`-en.svg`），缺的节与中文一致（多 1 条 palette 英文描述，少 chinese-patch/ui-debug 两条）。

### 2.3 assets（38 个文件：37 SVG + 1 PNG）

- 中文 SVG 19 个：`hero-zh nav-{install,ways,templates,settings,faq,npm,issues,releases} who-zh panel-zh prompt-trigger-zh smart-card-zh templates-zh custom-zh privacy-zh faq-zh author-zh license-zh`。
- 英文 SVG 18 个（同名 `-en`，nav 系列为 `nav-*-en.svg`）。
- 唯一真实图片：`assets/author-contact.png`（作者联系方式；改版后由 CONNECT 节话题群二维码接替，见 §4）。
- 无 `assets/readme/` 目录（需新建）。

### 2.4 About（`gh api repos/FeatherHunter/dsh-prompt --jq` 实测）

- description：✅ 已是中英双语长描述（24 模板 + /prompt 与智能推荐 + 开箱即用可自定义），与参考同构，无需重写。
- homepage：⚠️ `null`（参考填架构预览页；dsh-prompt 暂无预览页——建议填 npm 包页或留空待架构页上线，见 §4）。
- topics（7 个）：`ai deepseek deepseek-harness dsh-plugin llm prompt templates`；参考 10 个，差 3 个（见 §4）。

---

## 3. 截图开拍清单（用户照着拍，拍完放入即用）

通用要求（8 张一致）：**DSH Web 端（`dsh web`）· 中文界面 · 浅色主题**；浏览器内容宽度 ≥1280（截图再按目标宽度导出）；图片写法统一：

```html
<img src="assets/readme/XX-*.png" width="640" alt="……" style="border:1px solid #30363d;border-radius:6px">
```

（深色边框在浅色正文下即参考原文，保持 GitHub 深浅主题都可见。）英文版首版复用中文图（参考即如此）。

| # | 文件 | 宽度 | 场景：拍什么 | 操作步骤（点哪里、输什么、停在哪一屏） |
|---|------|------|--------------|----------------------------------------|
| 01 | `assets/readme/01-install-ready.png` | **720**（输入条横幅类，同参考 STATUSBAR 加宽） | 安装就绪：一条干净的新会话，输入框左侧可见 ⚡Prompt 按钮（源码 `src/client/button.ts`：输入框左侧 `conversation.input.left` 入口，hover 即开、click 兜底） | ① 新开 DSH Web 会话，不输入任何字；② 确认输入框左侧有"⚡Prompt"按钮；③ 截输入框整条横幅（含按钮 + 空输入框 + 发送键），停在未展开面板的一屏 |
| 02 | `assets/readme/02-panel-button.png` | 640 | 入口一·Prompt 按钮悬浮面板：模板浏览浮层（阶段 tabs 执行前/中/后 + 领域筛选 + 搜索；bottom-up：最常用沉底，置顶簇在底部，见 `panel.ts` #13） | ① 鼠标移到输入框左侧 ⚡Prompt 按钮（或单击），悬浮面板展开；② 停在"全部 tabs + 若干模板行（图钉+标题+简介+hover 操作）"的首屏；③ 截面板完整浮层（含背后的输入框按钮锚点） |
| 03 | `assets/readme/03-trigger-prompt.png` | 640 | 入口二·/prompt 触发源：在输入框输 `/prompt` 弹出候选（`trigger.ts`：trigger=`/` name=`prompt`，行格式"名称 + 标签·阶段 — 正文前42字"，支持 `/prompt 复盘` 按词过滤） | ① 输入框输 `/prompt`（半角斜杠），候选列表弹出；② 再输 `/prompt 复盘` 展示过滤后行；③ 截"输入框内 `/prompt 复盘` + 下方候选列表 3~5 行"的一屏 |
| 04 | `assets/readme/04-smart-card.png` | 640 | 入口三·智能悬浮卡：输入命中时自动出卡（`smart.ts`/`words.ts`：专属词×2+通用词×1，≥2 分出卡，≤3 候选；卡 280px 从圆点向右展开，可拖动） | ① 新会话输入框逐字输入 `这次任务做砸了，我想复盘一下，总结可复用经验`（命中 retro 强词"复盘/可复用经验"，必出卡）；② 等悬浮卡展开（默认开；若无卡：检查设置页智能开关）；③ 截"输入框文字 + 右侧展开的候选卡（2~3 行）"；备选触发句：`两个选项很纠结，有沉没成本，帮我决策`（decision） |
| 05 | `assets/readme/05-templates-gallery.png` | 640 | 模板一览：24 条预制全貌（`templates.ts` PRESET_TEMPLATES；思考框架/学习/工程/执行 × 执行前/中/后） | ① DSH 设置 → 插件 → dsh-prompt 设置页（`settings.ts`：`compact=false` Top-down 全量）；② 停在"阶段 tabs + 领域筛选 + 模板行铺满"首屏；③ 截设置页模板区完整一屏 |
| 06 | `assets/readme/06-custom-manage.png` | 640 | 自定义管理：新增/编辑弹窗 + 删除二次确认 + 置顶（≤5，`store.ts`）+ 预制复制为自定义（面板常开不闪退，见 `panel.ts` 注释） | ① 设置页点"＋新增"，弹窗填标题 `我的复盘模板`、正文 `请复盘：主题：`，截弹窗；②（同张或另截）hover 某行出现图钉/编辑/删除，点删除截二次确认框；③ 若拼图：左弹窗右确认框，二合一 |
| 07 | `assets/readme/07-privacy-smart-toggle.png` | 640 | 隐私 + 智能开关：设置页顶部（仓库链接行 + `智能模式悬浮卡（输入匹配时推荐模板；默认开）` checkbox，`i18n.ts` 原文）+ 隐私节文字对照（本地存储、无上报） | ① 设置页顶部，截"仓库/反馈链接行 + 智能开关勾选行"；② 同屏带出 1~2 行模板区以示位置；③ 隐私节正文写"模板与用量存本地浏览器、无网络上报"，本图即配图 |
| 08 | `assets/readme/08-faq-reinstall.png` | 640 | FAQ：更新不生效 → 官方源重装回显（对标参考 08 图；`dsh plugin update` 静默跳过时用） | ① 终端执行 `dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org`；② 等成功回显；③ 截"命令 + 成功回显"完整终端区（desktop 用户把 `--profile web` 换成 `--profile desktop`，FAQ 注明） |

拍摄顺序建议：01 → 05/07/06（设置页连拍）→ 02 → 03 → 04（04 若不出卡：先在设置页确认开关开，再换备选触发句；仍不出则截圆点 + 注"输入匹配时出卡"）。

---

## 4. 徽章 / About / 旧 SVG 对照结论（施工队直接执行）

### 4.1 徽章：4 → 8（保留 4，新增 4，改 1 label）

保留：许可证 MIT、npm 包版本（label 改中文`版本`）、dsh-plugin、platform。
新增（URL 模板照 §1.1，把包名换 `dsh-prompt`）：下载量（dynamic/last-month）、最近更新（last-commit）、月提交（commit-activity/m）、内容背书 `模板-24-blueviolet`（对标参考"技能包"徽章，链 `#模板长这样` 锚点）+ `期待你参与-brightgreen`（链 issues）。
取舍：参考"未来展望"徽章需 ROADMAP 文档支撑——dsh-prompt 暂无路线图，先不加，用"期待参与"凑第 8 枚。

### 4.2 About：description 不动，homepage 建待办，topics 补 3 个

- description：已达标，不动。
- homepage：`null` → 施工票建待办（有架构预览页后填；此前可填 `https://www.npmjs.com/package/dsh-prompt`，一票定夺）。
- topics：7 → 10：保留全部 7 个，新增 `prompt-engineering`、`productivity`、`toolbox`（均为 GitHub 现实存在的高频 topic；若校验不存在则顺延 `templates` 已有、`chatgpt` 不取——保持 DSH 生态口径，对标参考的 `dsh-better-sidebar` 生态互带，建议第 10 个用 `dsh`）。

### 4.3 旧 SVG：37 个全删，1 个 PNG 待定，新增 10+2

- 删除：`assets/*.svg` 37 个（19 中文 + 18 英文，§2.3 名单即删除清单；中英 README 同步改真实截图引用）。
- `assets/author-contact.png`：保留待定——若为作者个人联系二维码，移到 CONNECT 节"作者直连"位；话题群二维码另拍 `assets/qr-topic-group.png`（width 280）。
- 新增：`assets/readme/01~08.png`（§3）+ `docs/star-history.{html,json}` 与 `docs/star-history-{dark,light}.svg`（star-history 图床，抄参考 `docs/` 现成三件套做法，后续票生成）+ `docs/ROADMAP.md`（还"未来展望"徽章的债，可后置）。
- `docs/README.en.md`：同结构翻译，图片复用中文图（`../assets/readme/0X-*.png`），QR 共用——零复拍。

---

## 5. 参考原文关键写法（施工时原文抄）

- `--profile` 警告："装进你实际使用的 DSH 入口对应的 profile（装错 profile 等于没装，重启多少次都不会加载）"。
- AI 安装提示词（把包名/仓库换掉即用）："请帮我安装 DeepSeek Harness 插件 dsh-prompt。先读仓库 README：https://github.com/FeatherHunter/dsh-prompt ；先确认我实际使用的 DSH 入口对应哪个 profile（DSH Desktop 桌面应用 → desktop；自启 web 服务 → web），把插件装进正确的 profile；然后自行检查环境并按需安装（已装的跳过），完成后简要汇报结果。"
- CONNECT 分工句："日常闲聊与快速答疑走群里，Bug 与需求请直接提 ISSUE，更高效可追溯。"
- 节承接句式：`**👇 ……**`（每功能节一条，如"👇 三个入口，选顺手的先看按钮。"）。

## 6. 来源

- 参考 README 全文：`gh api repos/FeatherHunter/dsh-mattpocock-skills-deck/readme`（base64 解码，254 行，2026-09-08 拉取）。
- 参考英文版：`.../contents/docs/README.en.md`；参考资产：`.../contents/assets/readme`、`.../contents/assets`；参考 About/docs：`.../repos/FeatherHunter/dsh-mattpocock-skills-deck --jq`。
- 现状：本地 `README.md`（122 行）、`docs/README.en.md`（106 行）、`assets/`（38 文件）、`gh api repos/FeatherHunter/dsh-prompt --jq`、版本 `package.json@0.1.6`。
- 交互事实：`src/client/button.ts`（入口按钮 hover/click）、`panel.ts`（tabs+筛选+bottom-up+插入关面板）、`trigger.ts`（`/`+`prompt`，42 字描述）、`smart.ts` + `words.ts`（×2/×1 计分、≥2 出卡、≤3 候选）、`settings.ts` + `i18n.ts`（智能开关原文）、`store.ts`（置顶≤5）、`cordis.patch.yml`（bundle 自动装配）。
