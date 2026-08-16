# CONTEXT.md — dsh-prompt

术语词汇表（glossary）。仅收录领域语言，不含实现细节。

## 插件 (plugin)

本仓库构建的、可发布到 npm 并随 `dsh plugin add` 安装进 DSH profile 的扩展包。装配机制（bundle：`cordis.patch.yml` + 构建产物）与发布管线（npm + GitHub Release 双通道）参照 `dsh-opencode-palette` 的写法，但两者是相互独立的插件。

## prompt 调色板 (prompt palette)

本插件的产品形态：一个按钮展开的预制 / 自定义 prompt 清单，点击即插入当前对话输入框。与「主题调色板」（dsh-opencode-palette，配色切换）无关。

## 预制模板 (preset template)

随插件内置、只读的 prompt 模板。用户不可删除、默认不可编辑。

## 自定义模板 (custom template)

用户自己新增的 prompt 模板，可增删改；删除仅限自建模板，且需二次确认。

## 场景标签 (scenario tag)

标注每个模板适用场景的标签。用于常规模式的分组与「当前场景用哪个最好」的提示。

## 常规模式 (regular mode)

直接按场景展示模板清单的模式。v1 完整实现。

## 智能模式 (smart mode)

根据用户当前对话内容 / 阶段智能提醒可用模板的模式。可行性待调研（T1），不可行则降级为场景标签手动筛选。

## 用量计数 (usage count)

每个模板被插入使用的累计次数。仅作面板排序依据，不向用户展示数字。

## 插入 (insert)

点击模板后将其正文写入当前对话输入框的动作。
