<h1 align="center">dsh-prompt</h1>

<div align="center">

**中文** · [English](docs/README.en.md)

**将所有重复的Prompt变成模板。**<br>
点击一下即可注入到对话框中。

你的 ⭐ 是我夜空中最亮的星。

*Stop copy-pasting — one click, template in chat.*

[![版本](https://img.shields.io/npm/v/dsh-prompt?label=%E7%89%88%E6%9C%AC&color=2563EB)](https://www.npmjs.com/package/dsh-prompt) [![下载量](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2Flast-month%2Fdsh-prompt&query=%24.downloads&label=%E4%B8%8B%E8%BD%BD%E9%87%8F&suffix=%2F%E6%9C%88&color=059669)](https://www.npmjs.com/package/dsh-prompt) [![最近更新](https://img.shields.io/github/last-commit/FeatherHunter/dsh-prompt?label=%E6%9C%80%E8%BF%91%E6%9B%B4%E6%96%B0&color=7C3AED)](https://github.com/FeatherHunter/dsh-prompt/commits/main) [![提交数](https://img.shields.io/github/commit-activity/m/FeatherHunter/dsh-prompt?label=%E6%8F%90%E4%BA%A4%E6%95%B0&color=DB2777)](https://github.com/FeatherHunter/dsh-prompt/graphs/commit-activity) [![期待你参与](https://img.shields.io/badge/%E6%9C%9F%E5%BE%85%E4%BD%A0%E5%8F%82%E4%B8%8E-EA580C.svg)](https://github.com/FeatherHunter/dsh-prompt/issues)

</div>

<div align="center">

## 安装 <sub>INSTALL</sub>

</div>

<div align="center">

前置要求：[DSH](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）。

</div>

```bash
# ① 安装 DSH CLI（已装跳过）
npm install -g @deepseek-ai/dsh

# ② 安装 dsh-prompt —— --profile 必填：装进你实际使用的 DSH 入口对应的 profile
#    （装错 profile 等于没装，重启多少次都不会加载）
dsh plugin --profile web add dsh-prompt     # 用自启 web 服务（dsh web）
#     或者
dsh plugin --profile desktop add dsh-prompt   # 用 DSH Desktop 桌面应用
# 锁定最新版更稳（当前 0.4.35）：
dsh plugin --profile web add dsh-prompt@0.4.35 --registry https://registry.npmjs.org
#     或者
dsh plugin --profile desktop add dsh-prompt@0.4.35 --registry https://registry.npmjs.org
```

<div align="center">

安装完成后重启一次DSH。

**👇 装完重启，输入框左侧多出这枚按钮就是成功。**

<img src="assets/readme/01-install-ready.png" width="720" alt="安装成功后输入框左侧的 Prompt 按钮" style="border:1px solid #30363d;border-radius:6px">

</div>

### 进阶安装

#### 更新不生效怎么办？

下面命令以 web profile 为例——**DSH Desktop 桌面应用用户请把所有 `--profile web` 换成 `--profile desktop`**。

```bash
# 更新被静默忽略时，显式指定官方源
dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org
```

#### 复制下面这段发给你的 AI，在AI帮助下进行安装

```text
请帮我安装 DeepSeek Harness 插件 dsh-prompt。先读仓库 README：https://github.com/FeatherHunter/dsh-prompt
先确认我实际使用的 DSH 入口对应哪个 profile（DSH Desktop 桌面应用 → desktop；自启 web 服务 → web），把插件装进正确的 profile；
然后自行检查环境并按需安装（已装的跳过），完成后简要汇报结果。
```

**升级**

```bash
dsh plugin --profile web update dsh-prompt   # 升级
```

**卸载**

```bash
dsh plugin --profile web remove dsh-prompt   # 卸载
```

<div align="center">

## 入口一<br>Prompt 按钮

</div>

<div align="center">

鼠标移到“⚡Prompt 按钮”，列表自动展开。

**👇 按钮一点，面板长这样。**

<img src="assets/readme/02-panel-button.png" width="640" alt="Prompt 按钮悬浮面板：阶段筛选与模板列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 入口二<br>/prompt 触发源

</div>

<div align="center">

输入框敲 `/prompt`，提供选择。<br>
`/prompt 复盘`可以缩小范围。

**👇 /prompt 看到全部模板。**

<img src="assets/readme/03-trigger-prompt.png" width="640" alt="`/prompt` 触发源：输入过滤后的候选列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 设置面板<br>SETTINGS

</div>

<div align="center">

**👇 设置面板提供各种功能。**

<img src="assets/readme/05-templates-gallery.png" width="640" alt="模板一览：设置页中的 24 条预制模板" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 自定义与管理<br>CUSTOM

</div>

<div align="center">

**👇 新增自定义Prompt提示词模板。**

<img src="assets/readme/06-custom-manage.png" width="560" alt="自定义管理：新增自定义模板弹窗" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 作者的其他作品 <sub>MORE</sub>

</div>

喜欢这个插件的话，这些可能你也用得上：

**[dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck)** —— 27 个工程技能包，面板上直接调用，无需手动装技能

**[dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette)** —— 38 款 opencode 经典配色一键换装 DSH，即点即换，重启不丢

**[ilife](https://github.com/FeatherHunter/ilife)** —— 爱生活：DSH 里的居家生活套件，一个仓库七个可独立安装的插件

**[dsh-im-companion](https://github.com/FeatherHunter/dsh-im-companion)** —— 以助理和家的概念增强 dsh-im：哪个工作区有助理在管、在不在线尽收眼底，搬家拖一下就行

<div align="center">

有任何问题、建议、想法、IDEA、灵感、随谈：欢迎提交 [ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)🌹

</div>

<div align="center">

## 致谢 <sub>THANKS</sub>

</div>

<div align="left">

感谢每一位提交 Issue、PR 与Star的朋友，是你们让这个工具箱一点点变好。万分感谢！🎉🎉🎉🎉🎉🎉🎉🎉🎉

[@wqzhellohhwy](https://github.com/wqzhellohhwy)🌹🌹🌹 — [#146](https://github.com/FeatherHunter/dsh-prompt/issues/146) 运行时样式缺归属（已修）、[#147](https://github.com/FeatherHunter/dsh-prompt/issues/147) 依赖声明拖累插件 pending（已修）、[#148](https://github.com/FeatherHunter/dsh-prompt/issues/148) 关远程档整机字号被打回 14px（已修）

[@dagangwo](https://github.com/dagangwo)🌹 — [#175](https://github.com/FeatherHunter/dsh-prompt/issues/175) 悬浮列表最上边一项选不到、窗口自动关闭（待复现）

[@jheroy](https://github.com/jheroy)🌹 — [#165](https://github.com/FeatherHunter/dsh-prompt/issues/165) 屏蔽预制模板需求，并拍板按钮方案与交互细节

</div>

<div align="center">

## DSH 插件交流群 <sub>GROUP</sub>

</div>

<div align="center">

扫码加入话题群——二维码永久有效。日常闲聊与快速答疑走群里，Bug 与需求请直接提 [ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)，更高效可追溯。

**👇 飞书扫码，加入 DSH 插件交流群。**

<img src="assets/readme/09-feishu-group.png" width="280" alt="DSH插件交流群飞书二维码" style="border:1px solid #30363d;border-radius:6px">

</div>
