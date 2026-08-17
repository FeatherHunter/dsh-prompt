# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**把常用的深度 prompt 装进口袋 —— 预制 24 条 + 自定义管理 + /prompt 触发源 + 智能推荐悬浮卡，一点即插入当前对话。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)

## 一条命令完成安装

需要 **DSH CLI**（DeepSeek Harness 命令行工具）。如果还没有，先安装：

```bash
npm install -g @deepseek-ai/dsh
```

然后把插件装进你的 profile：

```bash
dsh plugin --profile web add dsh-prompt
```

安装即完成，**零配置**：本插件采用 DSH 官方 bundle 机制——包内自带 `cordis.patch.yml`（声明 `dsh.bundle.patch`），`dsh plugin add` 装完后自动把插件加入 profile 的 `dsh.profile.bundles` 层栈，DSH 启动时直接装配；`dsh plugin remove` 卸载时自动移除。全程无需手动编辑任何文件。重启 DSH（或刷新浏览器页面）即生效。

## 它是什么

DeepSeek Harness 的对话输入框上方有一个 **⚡ Prompt** 按钮。点开是 prompt 模板面板——**点一下，模板正文就插入当前对话输入框**，不用再记忆、搜索、看文档、复制粘贴。

- **预制 24 条深度 prompt**（思考框架 10 / 学习 3 / 工程 4 / 执行 6）：第一性原理拆解、苏格拉底式追问、对抗式审查、决策博弈分析、费曼技巧、MECE 拆解、代码审查、测试用例设计、零丢失快照、过程复盘……全部采用**冒号表单式**（指令段 + 字段段，字段 = 一行「标签：」，你在冒号后直接输入，零删除）。
- **自定义模板**：＋ 弹窗新增、删除仅限自建且二次确认、设置页完整管理；预制可一键「复制为自定义」再改。
- **/prompt 触发源**：在输入框直接输入 `/prompt`（可继续输入关键词过滤，如 `/prompt 思考框架`、`/prompt 拆解`），选中即插入。
- **v1.1 智能模式悬浮卡**：全局一个 ⚡ 手柄点，可拖动（位置记忆）；输入内容匹配模板（专属词×2 + 通用词×1，≥2 分才出卡）时从点向右展开最多 3 条候选，点击即填入，光标自动定位到第一个字段冒号后。
- **场景标签**：每个模板带 领域×阶段×动作 三维标签，面板按阶段分组 + 领域筛选。
- **双语**：面板跟随 DSH 界面语言（中文 / English）。
- **本地持久化**：自定义模板、用量计数（仅排序不显示）、置顶、悬浮卡位置与开关都保存在本地，刷新不丢。

## 30 秒上手

**输入框左侧 ⚡ Prompt 按钮** → 展开面板 → 点任意模板 → 正文插入输入框（光标处优先，不覆盖），面板自动关闭：

- 顶部 tabs：全部 / 执行前 / 执行中 / 执行后 / 自定义
- 领域行：全领域 / 思考框架 / 学习 / 工程 / 执行
- 搜索框：按名称 / 正文 / 标签过滤
- ★ 置顶（≤5）、＋ 新增、编辑 / 删除（仅自定义）、「复制为自定义」

**输入框直接输入 `/prompt`** → 斜杠菜单列出模板（含自定义），继续输入即过滤，Enter / 点击选中即插入。

**智能模式（默认开）**：输入「帮我做个决策，两个选项很纠结」这类内容时，右下角 ⚡ 点会向右展开推荐卡（≤3 条候选，带「点击填入」按钮）。点 × 收起回到圆点；继续输入可再次出现。不喜欢可在设置里关闭。

## 设置

**设置 → 提示词模板**（设置面板直属页）：

- **智能模式悬浮卡**开关（默认开）
- **模板管理**：完整 CRUD（新增 / 编辑 / 删除 / 复制为自定义）

## 开发

```bash
npm run build:client   # tsdown 构建 → lib/client.js（bundle 装配产物）
npm run typecheck      # tsc 类型检查（注意：仓库 tsconfig 与源码风格存在既有偏差，见 #9 resolution）
npm run build          # 完整构建（bash scripts/build.sh）
```

- 客户端源码：`src/client/*`（面板 / 触发源 / 智能匹配 / 词表 / 桥接）
- 匹配引擎与 /prompt 共用模板数据与排序基础；智能词表覆盖 24 条预制模板
- 架构与决策记录见 [GitHub issue #1（wayfinding map）](https://github.com/FeatherHunter/dsh-prompt/issues/1)

## 许可

MIT © FeatherHunter。
