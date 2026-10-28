# dsh-prompt

Prompt toolbox plugin: one button opens a list of preset and custom prompt templates, clicking inserts the text into the current conversation input.

## Language

### Templates and labels

**Preset Template**:
A prompt template shipped with the plugin, read-only and not deletable.
_Avoid_: preset, template, 预制 (as a bare word)

**Custom Template**:
A prompt template created by the user, editable and deletable with confirmation.
_Avoid_: custom, template, 自定义 (as a bare word)

**Label**:
The single shared language for filtering and display that describes when a template applies.
_Avoid_: tag, 标签 (as a loose synonym), domain, stage, action (as separate filters)

**Derived Label**:
A preset template's label, mechanically composed from its domain, stage and action.
_Avoid_: 派生标签 outside this definition, preset tag

**Custom Label**:
A custom template's label, picked or invented by the user, at most three.
_Avoid_: 自选标签 outside this definition, user tag, folksonomy tag (as a substitute)

**Color Tag**:
An optional appearance marker the user picks for their own template so it stands out in the list. It never participates in filtering, search, sorting or recall.
_Avoid_: label, tag, color label (as a synonym for Label)

**Usage Count**:
The cumulative number of times a template has been inserted, used for sorting and display.
_Avoid_: usage, count, 用量 (as a bare word)

**Bottom-Up Ordering**:
The selection-list sort direction where the most preferred template sits at the bottom, least preferred at the top.
_Avoid_: bottom-up (as a bare adjective), reverse order, 底置 (as a bare word)

**Insert**:
Writing a template's text into the current conversation input on click.
_Avoid_: inject, paste, apply, 插入 (as an implementation verb)

**Hover List**:
The compact floating template list opened from the Prompt button — by default on hover, or only on click when the Trigger Mode is set to click.
_Avoid_: hover menu, popup list, 悬浮列表 outside this definition

**Trigger Mode**:
Whether the Hover List opens as soon as the pointer enters the Prompt button (hover, the default) or only after a click.
_Avoid_: trigger, open mode, 触发方式 outside this definition

### Smart suggestions

**Smart Mode**:
Reminding the user of applicable templates based on the current conversation content and stage.
_Avoid_: smart, intelligent mode, 智能模式 outside this definition

**Smart Draft**:
The current conversation input as seen by the smart suggestion surface for the active session.
_Avoid_: smartstore, draft (as a bare word), input state

**Smart Words**:
The strong and weak word lists distilled from scenario labels that score preset templates.
_Avoid_: words, keywords, 强词, 弱词 (as bare words)

**Smart Score**:
The recommendation ranking behind a smart card, strongest match at the bottom per Bottom-Up Ordering.
_Avoid_: score (as a bare word), match score, 评分 (as a bare number)

### Remote touch surface

**Remote Mode**:
The large-touch form of the prompt list in the dialog. On means large, off means small, with no direct large-to-small switching.
_Avoid_: remote (as a bare word), tablet mode, 远程 (as a bare word)

**Remote Grid**:
The twelve-slot layout math of the large-touch list: paging and slot assignment only, no sorting, matching, storage or DOM.
_Avoid_: remoteView, view model (as a bare phrase), twelve-grid outside this definition

**Remote Draft**:
The mirrored remote input plus the model-choice dormancy rule: what the user typed elsewhere, shown here read-only, with no invented model list.
_Avoid_: remoteInput, mirror (as a bare word), 遥控输入 (as a bare phrase)

**Remote Sheet**:
The bottom-anchored sheet that hosts the Remote Draft for touch input.
_Avoid_: remoteInputSheet, sheet (as a bare word), popup keyboard

**Touch Bar**:
The single action strip pinned to the bottom of the window in Remote Mode; future remote action buttons only extend it.
_Avoid_: toolbar, dock, 触控栏 outside this definition

**Workspace Picker**:
The full-screen session switcher grouped by workspace, where clicking a row switches sessions.
_Avoid_: picker (as a bare word), session picker, 全屏挑选器 outside this definition

**Workspace**:
A project grouping that owns sessions. Ownership lives on the workspace side, never on the session object.
_Avoid_: group, project, 工作区 outside this definition

**Session**:
One switchable conversation, shown with title, workspace name and relative time.
_Avoid_: conversation, chat, 会话 outside this definition

**Adaptive Layout**:
The viewport-ratio rule that switches the remote layout between 4x3 and 3x4. Always on, never a user option.
_Avoid_: responsive layout, auto layout, 自适应 (as a bare word)

**Orientation Preference**:
The user-configurable rule deciding whether the large list follows the system orientation or locks to landscape or portrait.
_Avoid_: orientation (as a bare word), rotation, 方向 (as a bare word)

### Packaging and dependencies

**Host Runtime Package**:
A package the DSH host itself provides at runtime (the @deepseek-ai/dsh* family and the Cordis framework). The plugin may consume one, but never ships its own copy into a profile: it declares the package as an optional peer and keeps only a local development copy.
_Avoid_: DSH package (as a loose synonym), host dependency, bundled dependency

### Language and identity

**Locale**:
The resolved interface language plus its subscription. Resolution only, never writes back to the host language flag.
_Avoid_: i18n, language, lang, locale utils

**Strings**:
The bilingual word table resolved per Locale. The only place display text comes from.
_Avoid_: i18n, dictionary, 词表 (as a bare word)

**Label Identity**:
The stable language-independent identity behind a scope or a stored value, resolved to display text per Locale. User-word identity is always the original text, never translated.
_Avoid_: keys, key, normalize (as a bare verb)

### Update and diagnostics

**Update Capability**:
The built-in check-for-update and one-click update of dsh-prompt itself to the npm release.
_Avoid_: update (as a bare word), updater, auto-update, 更新 (as a bare word)

**Log System**:
The plugin's diagnostic ability: structured records of key paths and errors written to local files for troubleshooting.
_Avoid_: logger, logging (as a bare activity), 日志 (as a bare word)

**Log Switch**:
The single configuration-page master switch, default off. Errors, warnings and resident traces are always recorded regardless of its position.
_Avoid_: log toggle, debug switch, 日志开关 outside this definition

**Event List**:
The authoritative definition place for log events: each event's name, level, allowed fields and redaction reference is defined here exactly once.
_Avoid_: event catalogue, log schema, 事件清单 outside this definition

**Log Export**:
Handing the original log text to the user for fault reports, alongside clearing which deletes all but today's protected file.
_Avoid_: export logs (as a bare verb), log download, 日志导出 outside this definition

**Template Library**:
The managed collection of preset and custom templates with their labels, usage, pins and last-used order, persisted through the host bridge.
_Avoid_: store (as a bare word), storage, 数据 (as a bare word)
