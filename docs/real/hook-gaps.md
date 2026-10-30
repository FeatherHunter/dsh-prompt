# 观测面缺口清单（交 #190 钩子契约）

#188 的边界观测层不靠内部类名，只用**已存在的** `data-dsh-prompt-*` 契约钩子、宿主契约层的
语义属性（`role` / `aria-*` / `contenteditable`）与用户可见文本。下面这些地方目前**没有稳定钩子**，
只能用替代观测（文本/几何/邻接关系/宿主接口）推断，属于要收紧的契约缺口。
每一条都按 #190 需要的四段写：**缺什么 / 当前替代观测 / 影响场景 / 建议 `data-*` 钩子语义**。

## 插件侧缺口

### G1. 面板开关状态没有显式钩子

- **缺什么**：`[data-dsh-prompt-panel-root]` 是常驻 holder div，开/关不是属性，只能靠「holder 里第一个
  有尺寸子元素」判断。
- **当前替代观测**：`panel.visible = 可见子元素存在且 getBoundingClientRect 有面积`；底栏/列表存在性辅助。
- **影响场景**：场景 1（打开面板）、场景 2（插入后自动收起）——「收起」目前是几何推断，不是状态声明。
- **建议语义**：holder 上加 `data-dsh-prompt-panel-state="open|closed"`（或 `data-dsh-prompt-panel-open="true"`）；
  真正渲染的面板子元素加 `data-dsh-prompt-panel-surface="bar|list|remote"`，让「哪个子元素算面板」不再靠猜。

### G2. 模板行只有 id，名称/标签/简介没有机器可读字段

- **缺什么**：行根只有 `data-dsh-prompt-id`；名称、标签、简介混在 `innerText` 里，`title` 还是
  「名称 + 插入提示」拼接串。
- **当前替代观测**：整行文本归一化后 `contains` 模板名（fixture 声明的名字）；插入正文从 fixture 的
  `seed.customs[].body` 反查，不从 DOM 读。
- **影响场景**：场景 2（按语义文本定位行）；未来按标签/简介筛行的场景。
- **建议语义**：行根加 `data-dsh-prompt-row-name="<名称>"`、`data-dsh-prompt-row-labels="标签1,标签2"`
  （或 `data-dsh-prompt-row-label` 可重复）、`data-dsh-prompt-row-preview="简介首行"`；再加
  `data-dsh-prompt-row-role="insert|settings"` 区分布局行与设置页行（目前靠 `data-dsh-prompt-chrome`
  的实现标记区分，语义不纯）。

### G3. 设置页插件区块根没有钩子

- **缺什么**：插件向宿主 `settings.section` 注入的内容没有容器级 `data-dsh-prompt-*`；只能靠区块内
  `[data-dsh-prompt-hide-toggle]` 或 `[data-dsh-prompt-remote-section]` 存在来证明「插件设置页已挂载」。
- **当前替代观测**：`settings.section.hideToggle.present || remoteSection.present` + 宿主弹窗语义定位。
- **影响场景**：场景 3（设置页控件切换）——「插件区块存在」这条断言目前是间接证据。
- **建议语义**：插件设置区块根加 `data-dsh-prompt-settings-root="1"`（可带 `data-dsh-prompt-settings-version`）；
  各设置行加 `data-dsh-prompt-setting="hidePreset|triggerMode|remotePrefs"`。

### G4. 宿主设置弹窗的分区导航行没有可识别 id

- **缺什么**：插件注册的分区在宿主导航里只是一个 `button`，靠产品文本（`提示词模板` /
  `Prompt Templates`）精确匹配；宿主 nav 没有把 slot/section id 暴露到 DOM。
- **当前替代观测**：宿主弹窗 `role="dialog"` + `aria-modal="true"`（宿主契约层语义），再从弹窗内按钮文本
  里精确匹配 `SECTION_NAMES`。
- **影响场景**：场景 3——插件改名/本地化文案一变，定位就断（断的是观测，不是产品）。
- **建议语义**：这一条在**宿主侧**（插件无法标注宿主 nav）：宿主给分区导航项加
  `data-settings-section-id="<id>"`（与 `settings.section` 注册 id 对齐）；在落地前继续按产品文本匹配，
  失败按 BLOCKED「宿主设置入口可能变化」记，不判产品 FAIL。

### G5. 触发方式按钮的模式语义藏在 `aria-pressed` 里

- **缺什么**：`[data-dsh-prompt-trigger]` 的 `aria-pressed=true` 表示「仅点击触发」（反向语义），
  没有直接可读的 `hover|click` 字段。
- **当前替代观测**：`aria-pressed` 映射 `true→click`、`false→hover`（#179 契约），按钮文本/`title` 辅助。
- **影响场景**：场景 1（底栏状态）、场景 3（设置页切换）——两处都断言这个映射。
- **建议语义**：按钮加 `data-dsh-prompt-trigger-mode="hover|click"`，与 `aria-pressed` 并存；
  设置页那一行再加 `data-dsh-prompt-setting="hidePreset|triggerMode"` 定位。

### G6. 底栏「模板管理」入口没有导航状态

- **缺什么**：点 `[data-dsh-prompt-chrome="goSettings"]` 后可能点火、轮询、失败；失败只在按钮原位显示
  4 秒文案，没有状态属性。
- **当前替代观测**：轮询等待宿主设置弹窗 + 插件区块出现（12s）；失败只快照当时的 dialog/bar/section。
- **影响场景**：场景 3——导航失败时只能靠超时 BLOCKED，报告里说不清「试了几条路径、卡在哪」。
- **建议语义**：入口按钮加 `data-dsh-prompt-go-settings-state="idle|navigating|ok|failed"`，
  失败原因放 `data-dsh-prompt-go-settings-error="<kind>"`（如 `no-nav-cell` / `no-dialog`）。

### G7. 弹层没有类型标识

- **缺什么**：`[data-dsh-prompt-modal]` 只标记「这是一个插件弹层」，不区分编辑器弹窗、删除确认、
  远程表单、设置弹窗。
- **当前替代观测**：`modal` 计数 + 矩形 + 内部文本片段；设置弹窗另按宿主 `role=dialog` 识别。
- **影响场景**：⑤ 弹层/远程列表观测面；未来「打开编辑器→取消」这类场景。
- **建议语义**：`data-dsh-prompt-modal="edit|delete-confirm|remote-form|…"`（把当前布尔值升级成类型值），
  需要时再带 `data-dsh-prompt-modal-open`。

### G8. 远程列表的展开态没有钩子

- **缺什么**：`[data-dsh-prompt-remote-panel]` 只在渲染时存在；总闸开关 `[data-dsh-prompt-remote-toggle]`
  是开/关状态，但「远程列表当前是否展开/加载中/空」没有字段。
- **当前替代观测**：远程面板 present/visible + `textSnippet` + 行数；设置页只断言远程区块存在。
- **影响场景**：⑤ 远程列表观测面（本票只覆盖存在性，没做远程交互场景）。
- **建议语义**：面板加 `data-dsh-prompt-remote-state="closed|loading|ready|empty|error"`，
  总闸开关加显式 `data-dsh-prompt-remote-enabled="true|false"`（现在只能读 `checked` 或文本）。

### G9. 「插入行」与「设置行」的用途没有独立字段

- **缺什么**：紧凑面板行点一下插入，设置页行点一下只展开简介；两者都只有 `data-dsh-prompt-id`，
  目前靠 `data-dsh-prompt-chrome` 的 UI 标记值（`insertHint` / `rowExpandHint`）区分。
- **当前替代观测**：`data-dsh-prompt-chrome` 属性值。
- **影响场景**：场景 2 的定位正确性（不该把设置页行当插入行）。
- **建议语义**：行根 `data-dsh-prompt-row-role="insert|settings"`，与 G2 合并落地。

## 宿主侧缺口（跨票，记录在本清单供 #190 与宿主契约票对齐）

### H1. composer 光标位置没有直接契约钩子

- **缺什么**：草稿文本有 `[data-composer-input]`（innerText 口径），光标位置只能靠
  `window.getSelection()` 或从 React fiber 上翻到的宿主 `inputActions.captureInsertion()`。
- **当前替代观测**：两路——`captureInsertion` 的 `start/end/draftRev`（公开接口级）+
  `Selection` 的全局偏移（用户可见级）；场景 2 同时断言，两者都落在正文末尾。
- **影响场景**：场景 2（光标落位）；任何需要断言选区的插入场景。
- **建议语义**：宿主 composer 契约补一个只读出口（例如 `data-dsh-composer-caret="start,end"` 属性，
  或页面级 `getCaret()` 契约方法）；`captureInsertion` 的 fiber 路径作为兜底继续保留。

### H2. 宿主设置弹窗内部结构没有稳定钩子

- **缺什么**：宿主设置弹窗只有 `role=dialog` / `aria-modal` / `data-shortcut-modal=settings` 三件语义；
  分区导航行、内容区没有 `data-*`。插件设置入口要跨「侧栏账号菜单 → 设置 → 分区」多步导航。
- **当前替代观测**：`role=dialog` + `aria-modal` 定位弹窗；导航行按产品文本精确匹配。
- **影响场景**：场景 3（导航部分）。
- **建议语义**：与 G4 一并（`data-settings-section-id`）；宿主导航结构变更时本条是首要排查点。

## 使用方式

本清单是 #190 的输入，不是 #188 的阻塞项：#188 的套件在缺口存在时仍可跑，但替代观测会：
1. 在报告里标注来源等级（文本/几何 = user-visible，推断值不冒充公开接口）；
2. 定位不到时按 BLOCKED/FAIL 区分「宿主导航变了」与「产品行为不对」；
3. 钩子落地后只需收紧 `probes.mjs` 的采集字段与 `HOOKS` 列表，套件断言不用改结构。
