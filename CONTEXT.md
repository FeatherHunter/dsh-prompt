# CONTEXT.md — dsh-prompt

术语词汇表（glossary）。仅收录领域语言，不含实现细节。

## 插件 (plugin)

本仓库构建的、可发布到 npm 并随 `dsh plugin add` 安装进 DSH profile 的扩展包。装配机制（bundle：`cordis.patch.yml` + 构建产物）与发布管线（npm + GitHub Release 双通道）参照 `dsh-opencode-palette` 的写法，但两者是相互独立的插件。

## prompt 工具箱 (prompt toolbox)

本插件的产品形态：一个按钮展开的预制 / 自定义 prompt 清单，点击即插入当前对话输入框。与「主题调色板」（dsh-opencode-palette，配色切换）无关。

## 预制模板 (preset template)

随插件内置、只读的 prompt 模板。用户不可删除、默认不可编辑。

## 自定义模板 (custom template)

用户自己新增的 prompt 模板，可增删改；删除仅限自建模板，且需二次确认。

## 场景标签 (scenario tag)

旧称：领域 / 阶段 / 动作三套分类的统称。废弃中，新模板只用标签表达适用场景。

## 标签 (label)

筛选与展示共用的同一套适用场景语言。预置由派生标签构成，自定义由自选标签构成。

## 派生标签 (derived label)

预置模板的标签，由其领域、阶段、动作机械合并而来。

## 自选标签 (custom label)

自定义模板的标签，由用户选取或新造，最多三个。

## 常规模式 (regular mode)

直接按场景展示模板清单的模式。v1 完整实现。

## 智能模式 (smart mode)

根据用户当前对话内容 / 阶段智能提醒可用模板的模式。可行性待调研（T1），不可行则降级为场景标签手动筛选。

## 用量计数 (usage count)

每个模板被插入使用的累计次数。仅作排序依据，不向用户展示数字；悬浮列表按用量升序从上往下排（最常用在底部），智能卡同分时按用量升序；设置页与 /prompt 保留用量降序（管理面与菜单首屏例外）。

## 悬浮列表 (hover list)

下方对话框 ⚡Prompt 按钮 hover 触发的紧凑浮层列表（`compact=true` 的 `TemplateBrowser`），单行展示、约 10 项可见、向右上角弹出、置顶层。

## 底置排序 (bottom-up ordering)

统一的选择类列表排序方向：最优先的模板在列表最底部最先看到，向上依次递减。悬浮列表以用量为键，智能卡以评分为键（最相关在底部）；同键时置顶更贴底，仍相同时按预置原始顺序或自定义创建时间。设置页与 /prompt 为明确例外，保留用量降序。

## 插入 (insert)

点击模板后将其正文写入当前对话输入框的动作。
