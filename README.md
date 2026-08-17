# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**DeepSeek Harness 的 Prompt 调色板：24 条深度模板、自定义管理、/prompt 触发源、智能推荐悬浮卡——点一下，插入当前对话。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

## 这是给你的吗

![这是给你的吗](assets/who-zh.svg)

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

![方式一 · Prompt 按钮面板](assets/panel-zh.svg)

### 2 · /prompt 触发源

![方式二 · /prompt 触发源](assets/prompt-trigger-zh.svg)

### 3 · 智能悬浮卡

![方式三 · 智能悬浮卡](assets/smart-card-zh.svg)

## 模板长这样

![真实模板](assets/templates-zh.svg)

## 自定义与管理

![自定义与管理](assets/custom-zh.svg)

## 隐私

![隐私](assets/privacy-zh.svg)

## 常见问题

![常见问题](assets/faq-zh.svg)

## 开发

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # 完整构建
```

源码 `src/client/*`（面板/触发源/智能匹配/词表/设置页）；匹配引擎与 /prompt 共用数据与排序基础；决策记录见 [issue #1（wayfinding map）](https://github.com/FeatherHunter/dsh-prompt/issues/1)。

## 同作者

还写了两款 DSH 插件：

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) —— 34 款 opencode 官方主题，DSH 界面一键换肤。
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) —— 25 个工程技能包，粘贴一段安装 Prompt 即用。

## 作者的话

![作者的话](assets/author-zh.svg)

## 许可

![许可](assets/license-zh.svg)
