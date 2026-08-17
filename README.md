# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**DeepSeek Harness 的 Prompt 调色板：24 条深度模板、自定义管理、/prompt 触发源、智能推荐悬浮卡——点一下，插入当前对话。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

## 这是给你的吗

写对话时，你是不是也这样：**想不起来该用什么 Prompt**、**满屏翻历史记录找那条好用的**、**复制粘贴改来改去**。

如果是，这个插件就是给你的：**点一下，模板正文进输入框**——不用记忆、不用搜索、不用复制粘贴。

> 经常和 DeepSeek 对话、想把好用的 Prompt 沉淀成自己的库、希望 AI 在合适的时机主动提醒"这里有模板"的人，都值得一试。

## 一条命令安装

需要 **DSH CLI**（DeepSeek Harness 命令行工具）。还没有就先装：

```bash
npm install -g @deepseek-ai/dsh
```

安装进你的 profile：

```bash
dsh plugin --profile web add dsh-prompt
```

**零配置**：DSH 官方 bundle 机制，包内自带 `cordis.patch.yml`，`dsh plugin add` 自动加入 `dsh.profile.bundles` 装配层；`dsh plugin remove` 干净卸载。重启 DSH（或刷新页面）即生效。

## 三种方式叫出模板

装好后，模板可以从三个入口出来——选顺手的：

### 1 · ⚡Prompt 按钮

输入框左侧的 ⚡Prompt 按钮 → 面板展开 → 点任意模板 → 插入（光标处优先、不覆盖），面板自动关闭。

面板按 阶段 tabs（全部/执行前/执行中/执行后/自定义）+ 领域行（思考框架/学习/工程/执行）+ 搜索过滤；📌 置顶（≤5）、＋新增、编辑/删除（仅自定义）、预制一键「复制为自定义」。

### 2 · /prompt 触发源

![prompt trigger](assets/prompt-trigger-zh.svg)

输入框直接输 `/prompt`，继续输入即按 名称/正文/领域/阶段/动作/标签 过滤，回车或点选即插入。

### 3 · 智能悬浮卡

![smart card](assets/smart-card-zh.svg)

输入内容命中模板时，全局圆点（可拖动、位置记忆）向右上展开推荐卡，点整行即填入。

- 评分 = 专属词×2 + 通用词×1，**≥2 分才出卡**（宁缺毋滥）；≤3 候选（top-2 匹配 + 最近使用）；
- **不捕获键盘**，Enter 发送不受影响；× 收起回圆点，继续输入可再次出现；
- 插入后**光标定位到第一个字段的冒号后**，直接开写；设置里可关。

## 模板长这样

- **第一性原理拆解** —— `请用第一性原理分析以下主题…5. 基于以上推演给出你的原创见解。主题：`
- **对抗式审查** —— `请对以下方案做对抗式审查（红队角色）…4. 什么证据能让你改变立场。方案/结论：`
- **决策博弈分析** —— `你是一位冷静的决策分析师…6. 有没有哪条路是「没有回头路」的。我的处境：`
- **零丢失快照** —— `把我们从会话开始至今的关键信息逐条列出——不压缩、不合并，宁可啰嗦不可省略。`
- **MECE 拆解** —— `请用 MECE 原则拆解以下问题…4. 给出按重要性排序后的关键子问题清单。问题：`

共 **24 条**（思考框架 10 / 学习 3 / 工程 4 / 执行 7）。全部**冒号表单式**：正文 = 指令段 + 字段段，字段是一行「标签：」，你在冒号后直接输入，零删除。

## 自定义与管理

**设置 → 提示词模板**（设置面板直属页）：

- **模板管理**：＋新增 / 编辑 / 删除（仅自建 + 二次确认）/ 复制为自定义
- **智能模式悬浮卡**开关（默认开）
- 顶部：**GitHub 仓库** / **反馈故障**（一键跳转）

界面双语（中文/English），字体、字号、颜色跟随 DSH 主题。

## 隐私

所有数据都在本地：模板、用量、置顶、悬浮卡位置只存 localStorage，不上传任何内容。

## 常见问题

- **装完没生效？** 重启 DSH 或刷新页面。
- **预置模板能删吗？** 不能直接删，但可以一键复制成自定义再改。
- **智能卡太吵？** 设置里关掉就行，面板和 /prompt 不受影响。
- **换电脑数据会丢吗？** 目前是本地存储；导出/迁移在计划里，着急的话开个 Issue 催我。

## 开发

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # 完整构建
```

源码 `src/client/*`（面板/触发源/智能匹配/词表/设置页）；匹配引擎与 /prompt 共用数据与排序基础；决策记录见 [issue #1（wayfinding map）](https://github.com/FeatherHunter/dsh-prompt/issues/1)。

## 同作者

还写了两款 DSH 插件：

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) —— 喜欢 opencode 的配色？让 DSH 也穿上它 —— 34 款经典主题，眼睛舒服了，码字也开心。
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) —— 25 个工程技能包，粘贴一段安装 Prompt 即用。

## 参与贡献

新预制模板（冒号表单式）、词表打磨、UI 细节、文档翻译——Issue / PR 都欢迎。

## 作者的话

做这个插件是因为我自己也烦"现找 Prompt"这件事。如果你的使用体验里有什么卡点，直接开 Issue，我会认真看。

## 许可

MIT © FeatherHunter。
