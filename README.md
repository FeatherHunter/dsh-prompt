<h1 align="center">dsh-prompt</h1>

<div align="center">

**中文** · [English](docs/README.en.md)

**别再复制粘贴——点一下，模板进对话。**
24 条深度模板，`/prompt` 与智能推荐主动兜底。<br>
装好即用，可自定义。

你的 ⭐ 是我夜空中最亮的星。

*Stop copy-pasting — one click, template in chat.*

[![版本](https://img.shields.io/npm/v/dsh-prompt?label=%E7%89%88%E6%9C%AC)](https://www.npmjs.com/package/dsh-prompt) [![下载量](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2Flast-month%2Fdsh-prompt&query=%24.downloads&label=%E4%B8%8B%E8%BD%BD%E9%87%8F&suffix=%2F%E6%9C%88&color=brightgreen)](https://www.npmjs.com/package/dsh-prompt) [![最近更新](https://img.shields.io/github/last-commit/FeatherHunter/dsh-prompt?label=%E6%9C%80%E8%BF%91%E6%9B%B4%E6%96%B0&color=FE7D37)](https://github.com/FeatherHunter/dsh-prompt/commits/main) [![提交数](https://img.shields.io/github/commit-activity/m/FeatherHunter/dsh-prompt?label=%E6%8F%90%E4%BA%A4%E6%95%B0&color=DFAB01)](https://github.com/FeatherHunter/dsh-prompt/graphs/commit-activity) [![许可证](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT-lightgrey.svg)](LICENSE) [![模板-24](https://img.shields.io/badge/%E6%A8%A1%E6%9D%BF-24-blueviolet.svg)](https://github.com/FeatherHunter/dsh-prompt/blob/main/src/client/templates.ts) [![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt) [![期待你参与](https://img.shields.io/badge/%E6%9C%9F%E5%BE%85%E4%BD%A0%E5%8F%82%E4%B8%8E-brightgreen.svg)](https://github.com/FeatherHunter/dsh-prompt/issues)

</div>

<h2 align="center"><sub>INSTALL</sub><br>安装</h2>

<div align="center">

前置要求：[DSH](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）。<br>
在 DSH 里，你下指令、AI 干活。<br>
dsh-prompt 把常用提示词变成随手可点的模板。

</div>

```bash
# ① 安装 DSH CLI（已装跳过）
npm install -g @deepseek-ai/dsh

# ② 安装 dsh-prompt —— --profile 必填：装进你实际使用的 DSH 入口对应的 profile
#    （装错 profile 等于没装，重启多少次都不会加载）
dsh plugin --profile web add dsh-prompt     # 用自启 web 服务（dsh web）
#     或者
dsh plugin --profile desktop add dsh-prompt   # 用 DSH Desktop 桌面应用
# 锁定最新版更稳（当前 0.1.6）：
dsh plugin --profile web add dsh-prompt@0.1.6 --registry https://registry.npmjs.org
#     或者
dsh plugin --profile desktop add dsh-prompt@0.1.6 --registry https://registry.npmjs.org
```

<div align="center">

装完**重启一次对应入口**即生效。<br>
桌面端完全退出重开，web 端重启后刷新页面。<br>
零配置：装了即用，卸了即走。

**👇 装完重启，输入框左侧多出这枚按钮就是成功。**

<img src="assets/readme/01-install-ready.png" width="720" alt="安装成功后输入框左侧的 Prompt 按钮" style="border:1px solid #30363d;border-radius:6px">

</div>

<details>
<summary>进阶安装：免全局、更新不生效、交给 AI</summary>

下面命令以 web profile 为例——**DSH Desktop 桌面应用用户请把所有 `--profile web` 换成 `--profile desktop`**。

```bash
# 免全局安装（想更稳，像上面一样锁版本）
npx --yes @deepseek-ai/dsh plugin --profile web add dsh-prompt

# 更新被静默忽略时，显式指定官方源
dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org
```

复制下面这段发给你的 AI，它会确认 profile、检查环境并按需安装：

```text
请帮我安装 DeepSeek Harness 插件 dsh-prompt。先读仓库 README：https://github.com/FeatherHunter/dsh-prompt
先确认我实际使用的 DSH 入口对应哪个 profile（DSH Desktop 桌面应用 → desktop；自启 web 服务 → web），把插件装进正确的 profile；
然后自行检查环境并按需安装（已装的跳过），完成后简要汇报结果。
```

</details>

升级 · 卸载（desktop profile 用户把 `--profile web` 换成 `--profile desktop`）：

```bash
dsh plugin --profile web update dsh-prompt   # 升级
dsh plugin --profile web remove dsh-prompt   # 卸载
```

<h2 align="center"><sub>PROMPT BUTTON</sub><br>入口一 · Prompt 按钮</h2>

<div align="center">

鼠标移到输入框左侧的 ⚡Prompt 按钮，面板自动展开（点一下也行）。<br>
阶段 tabs + 领域筛选 + 搜索，点一条，正文进输入框。<br>
最常用的沉在底部，离按钮最近。

**👇 按钮一点，面板长这样。**

<img src="assets/readme/02-panel-button.png" width="640" alt="Prompt 按钮悬浮面板：阶段筛选与模板列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<h2 align="center"><sub>TRIGGER</sub><br>入口二 · /prompt 触发源</h2>

<div align="center">

键盘党的最爱：输入框敲 `/prompt`，候选实时过滤。<br>
每行写清“名称 + 标签·阶段 — 正文前 42 字”。<br>
只记得半个名也行：`/prompt 复盘`。

**👇 输一半，候选自动收窄。**

<img src="assets/readme/03-trigger-prompt.png" width="640" alt="/prompt 触发源：输入过滤后的候选列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<h2 align="center"><sub>SMART CARD</sub><br>入口三 · 智能悬浮卡</h2>

<div align="center">

你不用找模板，模板来找你。<br>
输入框里正常描述任务，命中关键词自动推荐。<br>
默认开启，设置页可关；只看本地词表，不联网。

</div>

<h2 align="center"><sub>TEMPLATES</sub><br>模板一览</h2>

<div align="center">

随包 24 条预制模板，覆盖四大领域与三个阶段。<br>
只读，删不掉改不坏，放心点。<br>
想改哪条，复制为自定义再改。

**👇 24 条全貌在设置页一次看完。**

<img src="assets/readme/05-templates-gallery.png" width="640" alt="模板一览：设置页中的 24 条预制模板" style="border:1px solid #30363d;border-radius:6px">

</div>

<h2 align="center"><sub>CUSTOM</sub><br>自定义与管理</h2>

<div align="center">

自己的话术存成模板：设置页一点新增，标题 + 正文写好即存。<br>
常用置顶（最多 5 条），删除一次确认。<br>
自定义与预制分开存，升级不丢。

**👇 新增弹窗长这样，填完点添加。**

<img src="assets/readme/06-custom-manage.png" width="640" alt="自定义管理：新增自定义模板弹窗" style="border:1px solid #30363d;border-radius:6px">

</div>

<h2 align="center"><sub>PRIVACY</sub><br>隐私</h2>

<div align="center">

只存本地浏览器，零网络上报。<br>
删插件即删数据。

</div>

<h2 align="center"><sub>FAQ</sub><br>常见问题</h2>

<details open>
<summary>更新之后还是旧版本？</summary>

先显式指定官方源装一次（desktop 用户把 `--profile web` 换成 `--profile desktop`）：

```bash
dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org
```

装完重启对应入口。<br>
桌面端完全退出重开，web 端重启后刷新页面（Ctrl+F5）。

</details>

<details>
<summary>装完没看到 Prompt 按钮？</summary>

先确认插件装进了当前入口对应的 profile（装错等于没装）。<br>
桌面应用对应 `--profile desktop`，web 服务对应 `--profile web`。<br>
确认无误后重启一次再看。

</details>

<details>
<summary>自定义模板与用量存在哪？会上传吗？</summary>

存在本地浏览器，不上传。<br>
换浏览器或清数据会丢，常用模板备一份正文。

</details>

<details>
<summary>有英文文档吗？截图为什么是中文？</summary>

有，见 [English](docs/README.en.md)。
截图首版中英共用一套，后续补英文截图。

</details>

<h2 align="center"><sub>MORE</sub><br>作者的其他作品</h2>

<div align="center">

喜欢这个插件的话，这些可能你也用得上：

**[dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette)** —— 34 款 opencode 经典配色一键换装 DSH，即点即换，重启不丢

**[dsh-plugin-ui-debug](https://github.com/FeatherHunter/dsh-plugin-ui-debug)** —— 用真实 Chrome 无头浏览器，给 DSH 插件 UI 做闭环调试

**[dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck)** —— 25 个工程技能包，面板上直接调用，无需手动装技能

**[dsh-chinese-skill-patch](https://github.com/FeatherHunter/dsh-chinese-skill-patch)** —— 让 DSH 直接用中文技能名，技能不必改英文名

---

有问题、有想法？[提交 ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)，用法交流、新模板点子、需求与 Bug 都欢迎

个人作品，与 DeepSeek Harness 官方没有关系。
MIT © FeatherHunter

</div>

<h2 align="center"><sub>THANKS</sub><br>致谢</h2>

<div align="left">

感谢每一位点星、提 Issue 的朋友，是你们让这个工具箱一点点变好。

dsh-prompt 还在等第一位外部贡献者。<br>
提交 Issue、PR 或分享自定义模板，你的名字就会出现在这里。<br>
已经做过的朋友，请直接告诉我。

</div>
