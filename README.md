<h1 align="center">dsh-prompt</h1>

<div align="center">

**中文** · [English](docs/README.en.md)

**别再复制粘贴——点一下，模板进对话。**
24 条深度模板，`/prompt` 与智能推荐主动兜底。<br>
装好即用，可自定义。

你的 ⭐ 是我夜空中最亮的星。

*Stop copy-pasting — one click, template in chat.*

[![版本](https://img.shields.io/npm/v/dsh-prompt?label=%E7%89%88%E6%9C%AC&color=2563EB)](https://www.npmjs.com/package/dsh-prompt) [![下载量](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2Flast-month%2Fdsh-prompt&query=%24.downloads&label=%E4%B8%8B%E8%BD%BD%E9%87%8F&suffix=%2F%E6%9C%88&color=059669)](https://www.npmjs.com/package/dsh-prompt) [![最近更新](https://img.shields.io/github/last-commit/FeatherHunter/dsh-prompt?label=%E6%9C%80%E8%BF%91%E6%9B%B4%E6%96%B0&color=7C3AED)](https://github.com/FeatherHunter/dsh-prompt/commits/main) [![提交数](https://img.shields.io/github/commit-activity/m/FeatherHunter/dsh-prompt?label=%E6%8F%90%E4%BA%A4%E6%95%B0&color=DB2777)](https://github.com/FeatherHunter/dsh-prompt/graphs/commit-activity) [![期待你参与](https://img.shields.io/badge/%E6%9C%9F%E5%BE%85%E4%BD%A0%E5%8F%82%E4%B8%8E-EA580C.svg)](https://github.com/FeatherHunter/dsh-prompt/issues)

</div>

<!-- 本 README 同时供三个地方读：GitHub 仓库页、npm 包页，以及 awesome 插件市场的详情页正文。
     市场正文那侧会丢弃全部原始 HTML（只认 markdown），所以标题一律用 `##`（写成 <h2> 那边就没了）。
     截图跟 dsh-mattpocock-skills-deck 同一套写法：`<img src="…" width="640|720|560" …>` 定宽——
     GitHub 与 npm 认 `width`，图按定宽渲染、点开仍可看原图；市场 web 详情页那侧连标签一起丢，
     正文只剩文字（skills-deck 的详情页同样是 0 张图），图片改由根目录 `screenshots.json`
     的截图字段带给各 storefront：写进 README 的本仓截图必须登记在那儿，
     `npm run test:marketplace` 会核这一条。另一处声明也在本文件之外：`package.json` 的
     `repository` 把 npm 包认到本仓（下载量、「可从 npm 安装」）。 -->

<div align="center">

## 安装 <sub>INSTALL</sub>

</div>

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
# 锁定最新版更稳（当前 0.2.0）：
dsh plugin --profile web add dsh-prompt@0.2.0 --registry https://registry.npmjs.org
#     或者
dsh plugin --profile desktop add dsh-prompt@0.2.0 --registry https://registry.npmjs.org
```

<div align="center">

装完**重启一次对应入口**即生效。<br>
桌面端完全退出重开，web 端重启后刷新页面。<br>
零配置：装了即用，卸了即走。

**👇 装完重启，输入框左侧多出这枚按钮就是成功。**

<img src="assets/readme/01-install-ready.png" width="720" alt="安装成功后输入框左侧的 Prompt 按钮" style="border:1px solid #30363d;border-radius:6px">

</div>

### 进阶安装：免全局、更新不生效、交给 AI

<details>
<summary>展开命令</summary>

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

<div align="center">

## 支持的 DSH 版本 <sub>SUPPORTED DSH</sub>

</div>

开发与验证基线：**DSH CLI `0.2.0-rc.2`** · **DSH Desktop `2.0.9`**。<br>
比基线更低的 DSH 版本未验证——装得上，但能不能跑对不保证；遇到了问题欢迎[提 ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)。

下面这段是唯一的版本声明，`package.json` 的 `dsh.engines.dsh` 与它逐字一致（`npm run test:issue-42` 会比对，改一处忘另一处就变红）。声明只作说明：安装时不拦版本。

```text
dsh.engines.dsh = >=0.2.0-rc.2
dsh.cli = 0.2.0-rc.2
dsh.desktop = 2.0.9
```

<div align="center">

## 入口一 · Prompt 按钮 <sub>PROMPT BUTTON</sub>

</div>

<div align="center">

鼠标移到输入框左侧的 ⚡Prompt 按钮，面板自动展开（点一下也行）。<br>
阶段 tabs + 领域筛选 + 搜索，点一条，正文进输入框。<br>
插在光标处：已有的字和末尾空行都保留，不覆盖不粘连。<br>
鼠标移开即收回；在里面开弹窗办完事后，指针已在外面也会跟随关闭，不粘留。<br>
最常用的沉在底部，离按钮最近。

**👇 按钮一点，面板长这样。**

<img src="assets/readme/02-panel-button.png" width="640" alt="Prompt 按钮悬浮面板：阶段筛选与模板列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 入口二 · /prompt 触发源 <sub>TRIGGER</sub>

</div>

<div align="center">

键盘党的最爱：输入框敲 `/prompt`，候选实时过滤。<br>
每行写清“名称 + 标签·阶段 — 正文前 42 字”。<br>
只记得半个名也行：`/prompt 复盘`。

**👇 输一半，候选自动收窄。**

<img src="assets/readme/03-trigger-prompt.png" width="640" alt="`/prompt` 触发源：输入过滤后的候选列表" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 入口三 · 智能悬浮卡 <sub>SMART CARD</sub>

</div>

<div align="center">

你不用找模板，模板来找你。<br>
输入框里正常描述任务，命中关键词自动推荐。<br>
默认开启，设置页可关；只看本地词表，不联网。

</div>

<div align="center">

## 模板一览 <sub>TEMPLATES</sub>

</div>

<div align="center">

随包 24 条预制模板，覆盖四大领域与三个阶段。<br>
只读，删不掉改不坏，放心点。<br>
想改哪条，复制为自定义再改。<br>
预制默认是屏蔽的（只看自己的）：点底栏眼睛按钮或设置页开关即可展示。

**👇 24 条全貌在设置页一次看完。**

<img src="assets/readme/05-templates-gallery.png" width="640" alt="模板一览：设置页中的 24 条预制模板" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 自定义与管理 <sub>CUSTOM</sub>

</div>

<div align="center">

自己的话术存成模板：设置页一点新增，标题 + 正文写好即存。<br>
常用置顶（最多 5 条），删除一次确认。<br>
自定义与预制分开存，升级不丢。

**👇 新增弹窗长这样，填完点添加。**

<img src="assets/readme/06-custom-manage.png" width="560" alt="自定义管理：新增自定义模板弹窗" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## 隐私 <sub>PRIVACY</sub>

</div>

<div align="center">

只存本地浏览器，零网络上报。<br>
删插件即删数据。

</div>

**本地诊断日志（默认关，只写你自己的电脑）**

排查故障时，本插件会写一份结构化日志到本机 `<DSH 家目录>/logs/dsh-prompt/YYYY-MM-DD.log`（Windows 上是 `C:\Users\<你>\.dsh\logs\dsh-prompt\`）。开关在 **设置 → 插件 → 提示词模板**，默认关；关着的时候只记错误、告警与关键轨迹（启动、面板打开这类常驻事件），打开后才记其余信息与调试。开关以宿主为准，刷新页面不会改变它。

- **绝不记录模板名称与提示词正文**——日志只记事件名、事件级别、计数、布尔值、时长与不可逆的短散列；模板身份只记一个 8 位散列。字段白名单写在仓库的 `event-list.dsh-prompt.json`，白名单之外的字段在客户端与宿主两侧各拦一次，写不进文件。
- **绝不自动上报**。日志只落本机磁盘，导出要你自己点「导出日志」（下载成文件）或「复制正文」（进剪贴板）才会离开插件。
- **自动轮转与保留**：按天一个文件；当天文件超过 5 MB 会先原子封存成 `YYYY-MM-DD.N.log` 再接着写，早于最近 14 天的日志文件自动删除。两者都是上游包 dsh-log 的默认口径，本插件不另设旋钮。
- **「清空日志」（两步确认）删掉今天以前的日志文件**：今天正在写的那一份由引擎保护、不会被删，提示里报出删掉的份数。
- **想自己先看一眼**：`npx dsh-log tail <上面那个目录>` 直接在终端里读（`--level warn`、`--since 1h`、`-f`、`--json` 都有），`npx dsh-log export <目录>` 打一份目录摘要（文件清单、级别与事件计数、启动头）。两个命令都只读，不写任何文件。
- 日志能力失败不影响插件本身：目录写不进去时自动降级到系统临时目录，再失败就彻底不落盘，只往 stderr 告警一次。

<div align="center">

## 常见问题 <sub>FAQ</sub>

</div>

### 更新之后还是旧版本？

<details>
<summary>展开回答</summary>

先显式指定官方源装一次（desktop 用户把 `--profile web` 换成 `--profile desktop`）：

```bash
dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org
```

装完重启对应入口。<br>
桌面端完全退出重开，web 端重启后刷新页面（Ctrl+F5）。

</details>

### 装完没看到 Prompt 按钮？

<details>
<summary>展开回答</summary>

先确认插件装进了当前入口对应的 profile（装错等于没装）。<br>
桌面应用对应 `--profile desktop`，web 服务对应 `--profile web`。<br>
确认无误后重启一次再看。

</details>

### 自定义模板与用量存在哪？会上传吗？

<details>
<summary>展开回答</summary>

存在本地浏览器，不上传。<br>
换浏览器或清数据会丢，常用模板备一份正文。

</details>

### 有英文文档吗？截图为什么是中文？

<details>
<summary>展开回答</summary>

有，见 [English](docs/README.en.md)。
截图首版中英共用一套，后续补英文截图。

</details>

<div align="center">

## 作者的其他作品 <sub>MORE</sub>

</div>

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

<div align="center">

## 致谢 <sub>THANKS</sub>

</div>

<div align="left">

感谢每一位提交 Issue、PR 与点星的朋友，是你们让这个工具箱一点点变好。

[@wqzhellohhwy](https://github.com/wqzhellohhwy)🌹🌹🌹 — [#146](https://github.com/FeatherHunter/dsh-prompt/issues/146) 指出 5 处运行时注入的 `<style>` 缺 `data-plugin` 归属（已修）、[#147](https://github.com/FeatherHunter/dsh-prompt/issues/147) 报出依赖声明把 DSH 运行时包装进 profile、CLI 0.2.1 线插件 pending，[#148](https://github.com/FeatherHunter/dsh-prompt/issues/148) 揪出关闭远程档位会把整机字号打回 14px（已修）

[@jheroy](https://github.com/jheroy)🌹 — [#165](https://github.com/FeatherHunter/dsh-prompt/issues/165) 提出屏蔽预制模板的需求（小列表、大列表、设置页三处开关，默认屏蔽），并参与原型评审拍板了按钮方案与交互细节

提交 Issue、PR 或分享自定义模板，你的名字就会出现在这里。

</div>
