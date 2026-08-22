# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**DeepSeek Harness 的 Prompt 工具箱：24 条深度模板、自定义管理、/prompt 触发源、智能推荐悬浮卡——点一下，插入当前对话。**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

## 快速导航

[![一条命令安装](assets/nav-install.svg)](#一条命令安装)

[![三种方式叫出模板](assets/nav-ways.svg)](#三种方式叫出模板)

[![24 条深度模板](assets/nav-templates.svg)](#模板长这样)

[![自定义与管理](assets/nav-settings.svg)](#自定义与管理)

[![常见问题](assets/nav-faq.svg)](#常见问题)

[![npm 发布](assets/nav-npm.svg)](https://www.npmjs.com/package/dsh-prompt)

[![反馈故障](assets/nav-issues.svg)](https://github.com/FeatherHunter/dsh-prompt/issues/new)

[![更新日志](assets/nav-releases.svg)](https://github.com/FeatherHunter/dsh-prompt/releases)


## 这是给你的吗

![这是给你的吗](assets/who-zh.svg)

## 一条命令安装

需要 **DSH CLI**（DeepSeek Harness 命令行工具）。还没有就先装：

```bash
npm install -g @deepseek-ai/dsh
```

安装进你的 profile（`0.1.6` 为当前最新，已发布至 [npm](https://www.npmjs.com/package/dsh-prompt) 与 [GitHub Release](https://github.com/FeatherHunter/dsh-prompt/releases/tag/v0.1.6)）：

```bash
dsh plugin --profile web add dsh-prompt
# 或锁定版本
dsh plugin --profile web add dsh-prompt@0.1.6
```

查看最新版本：

```bash
npm view dsh-prompt version --registry=https://registry.npmjs.org --prefer-online
# → 0.1.6
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

还写了多款 DSH 插件与工具，欢迎关注：

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) —— 34 款 opencode 官方主题，DSH 界面一键换肤。
- [**dsh-plugin-ui-debug**](https://github.com/FeatherHunter/dsh-plugin-ui-debug) —— 用真实 Chrome 无头浏览器对 DSH 插件 UI 做闭环调试的利器。
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) —— 25 个工程技能包，粘贴一段安装 Prompt 即用。
- [**dsh-chinese-skill-patch**](https://github.com/FeatherHunter/dsh-chinese-skill-patch) —— 让 DSH 正确识别中文 `SKILL.md` 的补丁，中文社区必备。

## 作者的话

![作者的话](assets/author-zh.svg)

![作者联系方式](assets/author-contact.png)

> 欢迎大家提交 ISSUE，一起把 prompt 工具箱做得更好！[提交 ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues/new)

## 许可

![许可](assets/license-zh.svg)