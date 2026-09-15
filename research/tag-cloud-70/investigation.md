# #70《单行动标签云落地》第一阶段调查报告（只调查，不实现）

- 工作目录：`D:\dsh-plugin\dsh-prompt`，分支 `main`，基线 commit `3c9d52d`（以任务给定为准；本阶段未跑任何门禁/构建/测试，未执行 `npm run` / `node scripts/test-*`，未提交，未读写 gh issue）。
- 本文件是本阶段唯一允许写入的文件：`research/tag-cloud-70/investigation.md`。`src/client/panel.ts` 等其他文件均为只读观察。
- 阅读对象：第二阶段同一作者（总工程师继续），直接按 §5 清单动手。

---

## 1) `src/client/panel.ts` 顶部现状

文件总长 984 行。以下行号均指当前工作区 `src/client/panel.ts` 的实际行号，均已逐段打开核对。

### 1.1 常量：`STAGE_TABS` / `DOMAIN_FILTERS` / `CUSTOM_TAG`（L55–57）

```ts
// L55–57
const STAGE_TABS = ['all', '执行前', '执行中', '执行后'] as const
const DOMAIN_FILTERS = ['all', '思考框架', '学习', '工程', '执行'] as const
const CUSTOM_TAG = '自定义'
```

- `STAGE_TABS` 在本文件内**只作为注释性常量存在**：实际渲染页签用的是 L811–817 的 `tabs` 数组（`all/执行前/执行中/执行后/自定义`），并没有 `STAGE_TABS.map`。`STAGE_TABS` 目前是死常量（或留给外部语义对照），改顶部时不要误以为改它即改 UI。
- `DOMAIN_FILTERS` 是领域第二行的**唯一数据源**（L821 `DOMAIN_FILTERS.map`），共 5 项：`all + 4 领域`。
- `CUSTOM_TAG = '自定义'` 既是页签 id（L816），又是过滤哨兵（L660）与空标签回落词（store 侧 `LABEL_FALLBACK`，见 §2）。

文件头注释 L12–13 已锁定当前语义：

```ts
// L12–13
//  * #23 统一标签：页签/领域行/搜索框的筛选语义统一为标签包含（matchLabel），
//  * 自定义页签仍按 builtin 过滤（不是标签）；行内展示完整标签串（labelString）。
```

### 1.2 `tab` / `domain` / `q` 状态（L538–543）

```ts
// L538–543
const tabState = react.useState('all')
const tab = tabState[0]
const domainState = react.useState('all')
const domain = domainState[0]
const qState = react.useState('')
const q = qState[0]
```

- `tab` 初值 `'all'`，`domain` 初值 `'all'`，`q` 初值 `''`，全部是 `TemplateBrowser` 组件内局部 `useState`，无外部 store、无 URL 同步、无跨组件共享。
- 写入点只有三处：
  - L819：`tabState[1](tb.id)`（页签按钮 `onClick`，顺带 `refresh()`）；
  - L822：`domainState[1](d)`（领域按钮 `onClick`，顺带 `refresh()`）；
  - L912 起 search input 的 `qState[1](e.target.value)`（L912 `onChange`，L918–921 组词结束补提交）。
  - 另有 L756 `tabState[1](CUSTOM_TAG)`：复制预置为自定义后的自动跳转（`handleCopy`），与顶部手点同语义。
- `#34` 搜索框聚焦/组词抑制 hover 关窗（L552–558 注释，L637–642 effect，L913–922 handlers）只读 `searchFocused/composing/modal`，不读写 `tab/domain`，#70 动顶部时不得破坏这组门控。

### 1.3 过滤逻辑（L655–671，核心逐行）

```ts
// L655–664
// 列表组装（#23）：tab=自定义 → 仅自定义（按 builtin，不过滤标签，见待确认 1）；
// 否则按统一标签包含过滤——阶段页签与领域行是标签子集的快捷方式，底层同一判断；
// 搜索框保留全文检索（haystack）兼容。排序（#68）：悬浮置顶簇聚底，设置页忽略置顶只留用量降序。
const customs = allTemplates().filter((x) => !x.builtin)
const list = allTemplates().filter((x) => {
  if (tab === CUSTOM_TAG) return !x.builtin
  if (tab !== 'all' && !matchLabel(x, tab)) return false
  if (domain !== 'all' && !matchLabel(x, domain)) return false
  return true
})
// L665–671
const ql = q.trim().toLowerCase()
// 搜索与 /prompt 触发源共用检索底座（名称/正文/领域/阶段/动作/标签）
const filtered = ql
  ? list.filter((x) => templateHaystack(x).indexOf(ql) >= 0)
  : list
// 悬浮列表 bottom-up（#68）：compact 浮层置顶簇聚底；设置页忽略置顶、只留用量降序
const sorted = compact ? sortedTemplatesBottomUp(filtered) : sortedTemplates(filtered)
```

语义要点（#70 必须继承）：

1. `tab === '自定义'` 是短路分支：直接按 `!x.builtin` 返回，**跳过一切 `matchLabel` 与 `domain` 判断**。因此即使将来领域行改成“单行动标签云”，`tab=自定义` 时也不应再叠加行动标签过滤（除非 #70 决议 explicitly 推翻 #23 待确认 1）。
2. 其余情况是 **AND 语义**：`tab` 过滤 AND `domain` 过滤，底层都是 `matchLabel(x, label)`（单选包含，见 §2）。`tab='all'` / `domain='all'` 表示跳过该维。
3. `q` 是第二层过滤：对已过标签的 `list` 再做 `templateHaystack` 子串匹配；`sorted` 只是排序，不改变集合。
4. 排序与过滤正交：`sortedTemplates` / `sortedTemplatesBottomUp` 来自 store（#68），顶部改动不得碰排序。

### 1.4 顶部节点的具体行号与代码摘录

| 节点 | 行号 | 摘录/说明 |
|---|---|---|
| 样式 `tabsStyle` | L717 | `const tabsStyle: any = { display: 'flex', gap: 4, padding: '4px 8px 0', flexWrap: 'wrap' }` |
| 样式 `tabBtn(on)` | L718–721 | 胶囊按钮工厂，`on` 时高亮底色；领域行复用同一工厂（L822 `tabBtn(domain === d)`），#70 若要做“云”式多标签 chips，需要新样式，不得复用 `tabBtn` 的单选高亮语义 |
| 样式 `domainRowStyle` | L722 | `const domainRowStyle: any = { display: 'flex', gap: 4, padding: '3px 8px 0', flexWrap: 'wrap' }` |
| 样式 `searchStyle` | L723 | 搜索框样式；`#34` 行为见 §1.2 |
| 页签数据源 `tabs` | L811–817 | `all(tabAll)/执行前(tabBefore)/执行中(tabDuring)/执行后(tabAfter)/自定义(tabCustom)`，`id` 即过滤词（`all` 除外走 i18n label） |
| 页签节点 `tabNodes` | L818–820 | `h('div', { style: tabsStyle }, tabs.map((tb) => h('button', { key: tb.id, style: tabBtn(tab === tb.id), onClick: () => { tabState[1](tb.id); refresh() } }, tb.label)))` |
| 领域节点 `domainNodes` | L821–823 | `h('div', { style: domainRowStyle }, DOMAIN_FILTERS.map((d) => h('button', { key: d, style: tabBtn(domain === d), onClick: () => { domainState[1](d); refresh() } }, d === 'all' ? t('domainAll') : d)))` |
| 组装顺序 | L909–924 | `tabNodes, domainNodes, search input, listNode, footer, modalNode`（见下） |
| 搜索节点 | L911–923 | `h('input', { style: searchStyle, placeholder: t('searchPh'), value: q, onChange…, onFocus/onBlur/onCompositionStart/onCompositionEnd… })`，#34 门控全在此 |
| 头行（compact/设置页两分支） | L893–908 | 标题/计数/`goSettings`/`＋`/`×`；不属于过滤语义，#70 不动 |

组装原文（L909–927，证明顺序即视觉自上而下顺序）：

```ts
// L909–927（return 根节点的 children 数组节选）
tabNodes,        // L909 第一行：阶段页签
domainNodes,     // L910 第二行：领域行（#70 要替换的正是这一行）
h('input', {     // L911–923 第三行：搜索框
  style: searchStyle, placeholder: t('searchPh'), value: q, onChange: (e: any) => qState[1](e.target.value),
  // …L913–922 #34 IME 安全 handlers…
}),
listNode,        // L924 第四块：行列表（#71 区，见 §4）
footer,          // L925（恒 null，L885）
modalNode,       // L926 弹窗 Portal
```

另有定位/滚动 effect 与顶部相关但 #70 不动：L572–621 面板定位（仅 `compact`），L675–687 自动滚到底部（依赖 `[compact, tab, domain, q, filtered.length, sorted.length]`，#70 若增删过滤维度必须同步更新该 deps，否则云切换后不滚底）。

---

## 2) `store.ts` 的 `allKnownLabels` / `matchLabel` / `labelString` 调用点与语义

文件 `src/client/store.ts` 总长 430 行。三个函数是 #23 收敛的“唯一纯函数”（L11–12，L201 注释）。

### 2.1 定义（语义逐字）

```ts
// L227–229 标签串（展示共用；分隔符 '/'，与 #19 R2 附录记法一致）
export function labelString(t: PromptTemplate, sep = '/'): string {
  return templateLabels(t).join(sep)
}
// L232–234 标签命中（筛选共用；单选语义：包含所选标签即命中，#19 R3 D5）
export function matchLabel(t: PromptTemplate, label: string): boolean {
  return templateLabels(t).indexOf(label) >= 0
}
// L237–244 已有词（自定义标签输入的选取来源：预置 23 词 + 在用自定义词，去重保序）
export function allKnownLabels(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (l: string) => { if (l && !seen.has(l)) { seen.add(l); out.push(l) } }
  for (const t of PRESET_TEMPLATES) templateLabels(t).forEach(push)
  for (const t of cache.customs) templateLabels(t).forEach(push)
  return out
}
```

依赖链：三者都基于 `templateLabels(t)`（L213–224）。`templateLabels` 读时兼容旧形状：有 `labels` 用 `labels`；预置缺失时按 `[domain, stage, ...action]` 派生；自定义缺失时取旧 `tag` 或回落 `['自定义']`。`normalizeLabels`（L247–258，去空去重保序）与 `validateLabels`（L268–280，最多 3、每词 1–10 字、禁 `任意`、空回落 `自定义`）只用于写入校验，不参与筛选，#70 只读即可。

### 2.2 全仓调用点（`grep` 实测，共 20 命中，分组列出）

**`matchLabel`（筛选语义，4 处）：**

| 调用点 | 行号 | 语义 |
|---|---|---|
| `panel.ts` L661 | `if (tab !== 'all' && !matchLabel(x, tab)) return false` | 阶段页签过滤（含 `执行前/中/后` 三个同名标签） |
| `panel.ts` L662 | `if (domain !== 'all' && !matchLabel(x, domain)) return false` | 领域行过滤（#70 要替换的判断；单选 AND） |
| `trigger.ts` L41 | `matchLabel(x, q) \|\| templateHaystack(x).indexOf(needle) >= 0` | `/prompt` 过滤：标签包含 OR 全文兼容（超集，#23 B 锁定 haystack 行为不变） |
| 定义 `store.ts` L232 | 见 §2.1 | 单选包含，无大小写折叠、无分词 |

**`labelString`（展示语义，7 处）：**

| 调用点 | 行号 | 语义 |
|---|---|---|
| `panel.ts` L844（compact 行 `title`） | `title: labelString(x) + ' · ' + t('insertHint')` | 悬浮行悬停显示完整标签串 |
| `panel.ts` L853（compact 行内） | 行内三段式中间段显示 `labelString(x)` | 悬浮行内展示（#23 B 断言含 `思考框架/执行前/拆解` 且无裸领域串） |
| `panel.ts` L861（设置页行 `title`） | `title: labelString(x)` | 设置页行悬停 |
| `panel.ts` L874（设置页行内勋章） | `h('span', { style: tagStyle }, labelString(x))` | 设置页勋章式标签（#71 区，#70 不动） |
| `trigger.ts` L54 | `description: labelString(t) + ' — ' + body前42字` | `/prompt` 描述行（#23 B/F 锁定格式） |
| `smart.ts` L354 | `labelString(c.tpl) + ' ' + (·常用/·分N)` | 智能卡展示行（评分后缀保留，评分链不动） |
| 定义 `store.ts` L227 | 见 §2.1 | `join('/')`，默认分隔符 `/` |

**`allKnownLabels`（词表语义，2 处 + 定义）：**

| 调用点 | 行号 | 语义 |
|---|---|---|
| `panel.ts` L421 | `const known = allKnownLabels()`（`TemplateModal` 内） | 新建/编辑弹窗 `datalist#dsh-prompt-labels` 的候选词（L440），预置 23 词 + 在用自定义词，去重保序 |
| `test-issue-23.cjs` 间接 | 经弹窗交互覆盖（§3 F 段未直接断言词表长度，但 D/E 段覆盖校验与落盘） | 回归侧无独立词表断言 |
| 定义 `store.ts` L237 | 见 §2.1 | 只读派生，无缓存，调用时实时遍历 `PRESET_TEMPLATES + cache.customs` |

**#70 含义**：单行动标签云的数据源几乎必然是 `allKnownLabels()` 的子集（只取行动词）或 `templateLabels` 的行动位，但当前 `allKnownLabels()` 返回的是**全标签扁平词表**（含领域 4 + 阶段 3 + 行动 N + 自定义词），没有“行动”维度标记。旧 `domain/stage/action` 三件套已声明废弃只读镜像（`templates.ts` L16–18，`store.ts` L127–134 落盘时剥离），读时派生仍可用（`templateLabels` L217），但新自定义模板不再写 `action`。因此 #70 若要精确得到“行动词云”，必须先决定词源公式（见 §5 步骤 1），不能直接把 `allKnownLabels()` 全量铺成云。

---

## 3) `scripts/test-issue-23.cjs` 结构与可扩展点（行号）

文件总长 233 行。性质：Node 回归脚本，把 `src/client/*.ts` 用 `typescript.transpileModule` 转译到 `scripts/.rt-tmp/*.cjs` 后用 `react-test-renderer` 做行为断言。**本阶段未运行它**（门禁独占归 #71 lane），以下均为静态阅读。

| 段 | 行号 | 内容 |
|---|---|---|
| 文件头验收映射 | L1–9 | A–F 六条验收（预置回填 / 三处同集合 / 跨入口可找 / 校验矩阵 / 迁移落盘 / 描述行与智能卡） |
| 转译底座 `MODULES` | L16–27 | 11 个模块 + 依赖重写表；`panel.ts` 依赖 `['./templates','./store','./state','./i18n','./smartstore']`（L25） |
| 转译循环 | L28–33 | 读源码 → `transpileModule(CommonJS/ES2020)` → `require("…")` 改写为 `*.cjs` → 写 `.rt-tmp/` |
| 测试 harness | L34–43 | `require('react')` + `react-test-renderer`，`req()` 加载转译产物，`zh()` 取中文串 |
| 断言 helpers | L45–68 | `assert`（失败即 `process.exit(1)`）、`ids`、`rowIds`（按 `data-dsh-prompt-id` 取行）、`texts/rowTexts/textOf/byText/byButton`（按文本找按钮/行） |
| A 预置回填 | L71–81 | 24 条、逐条 `templateLabels == [domain, stage, ...action]`、词表 23、无 `任意` |
| B 三处同集合 | L83–126 | 领域行 `执行`==7 条（L84–93）、页签 `执行前`==同名标签集（L95–102）、`/prompt` haystack 超集兼容（L103–107）、悬浮/设置行内完整串（L108–115）、`/prompt` 描述行格式（L116–126） |
| C 跨入口 | L128–140 | 动作词 `复盘` 命中 `retro`（L129–132）、阶段词 `执行中` 横跨 ≥3 领域（L132–134）、旧找法名称搜索（L135）、自定义页签按 `builtin` 且空库 0 条（L136–140） |
| D 校验矩阵 | L142–158 | 合法/去空去重/超数/超长（11 拦 10 放）/`任意`拦/空回落/单字符串逗号兼容 |
| E 迁移落盘 | L160–171 | 旧 `tag` 为首元、空回落、占位不污染、`addCustom` 新形状无旧字段、`updateCustom` 生效、复制预置照搬标签 |
| F 弹窗交互 | L173–200 | 新增按钮 → 名称框+标签框存在 → 超数 `a,b,c,d` 行内 `labelsTooMany` 且未落盘 → 回车并入 chips 后合法保存 |
| G 智能卡 | L202–213 | 有候选、`retro` 在列、分数升序、阈值 2、`smart.ts` 含 `labelString(c.tpl)` 与 `·常用/·分` 后缀 |
| H 排序 | L215–222 | `bumpUsage` 后设置页降序首位最高频、悬浮升序末位最高频、`/prompt` 降序首位最高频 |
| I 智能默认关 | L224–228 | 无 `localStorage` 时默认关且 `set` 不崩 |
| 出口 | L233 | `main().then(process.exit(0), fail→exit(1))` |

### 可扩展点（给 #70 第二阶段加断言用，全部是“加法”，不改既有断言）

1. **转译表 L25**：#70 若新建模块（如 `actioncloud.ts`），必须在 `MODULES` 加一行并声明其 `deps`，否则转译产物缺失。不动既有 11 行。
2. **`byButton` 找云标签（复用 L68）**：云的每个行动词按钮天然可用 `byButton(cloudTree, '复盘')` 定位；新增断言时沿用 `rowIds()` 对比 `matchLabel` 集即可，与 B 段（L93/L102）同式。
3. **B 段 L89–93 领域行用例是 #70 的改写模板**：把 `byButton(full, '执行')` 换成云标签（如 `byButton(full, '复盘')`），把 `want` 换成对应行动标签的 `matchLabel` 集，其余 `TR.act → rowIds 对比` 三行照抄。这是最省的扩展位。
4. **C 段 L132–134 阶段横跨断言**：可照抄为“行动词横跨多领域”断言，证明云不是领域换皮。
5. **H 段 L215–222 排序**：#70 不动排序，但新增“云过滤 + 用量排序正交”断言时直接复用 `store.bumpUsage` + `sortedTemplates/sortedTemplatesBottomUp` 首末位模式。
6. **禁止扩展位**：L103–107 haystack 超集、`trigger.ts` L41、`smart.ts` L354、`panel.ts` L844–874 行内串格式是 #23 冻结语义，#70 不得为云而改这些断言；云只改“选什么”，不改“搜什么/排什么/行内显什么”。

---

## 4) 与 #71 行渲染区的精确分界线（行号区间，证明两不越界）

约定：**#70 拥有“顶部过滤区”（选什么），#71 拥有“行渲染区”（行内怎么画）**。共享的 `list/filtered/sorted`（L655–671）是只读输入，两 lane 都不许改其语义（#70 可增过滤维但须同步到 §5 步骤 3 的 deps；#71 不得改集合）。

### 4.1 #70 区（本票可动，全部在 `panel.ts`）

- 常量：L55–57（`STAGE_TABS` 死常量不动，`DOMAIN_FILTERS` 待替换数据源，`CUSTOM_TAG` 哨兵不动）。
- 状态：L538–543（`tab/domain/q`；#70 新增云状态必须另起 `useState`，不得复用 `domainState` 变量名以免与 #71 混淆——或明确复用并全局改名，见 §5）。
- 样式：L717–723（`tabsStyle/tabBtn/domainRowStyle/searchStyle`；云样式新增在 L722 附近，勿改 `tabBtn` 既有单选语义）。
- 顶部节点定义：L810–823（`tabs/tabNodes/domainNodes`；`domainNodes` L821–823 是 #70 主改点）。
- 组装引用：L909–923（`tabNodes/domainNodes/search input` 的引用行；只增删引用，不在组装区写逻辑）。
- 过滤判断：L659–664 中的 `domain !== 'all'` 分支（L662 单行）；L675–687 滚动 effect 的 deps 数组（含 `tab, domain, q`）若增维必须同步。

### 4.2 #71 区（本票禁入，全部在 `panel.ts`）

- 行映射：**L824–880**（`const rows = sorted.map((x) => { … })`），其中：
  - L825–834：`pinned/custom/acts/itemBg/intro` 行级派生；
  - L839–857：`if (compact)` 悬浮单行分支（含 L844 `title`、L845–850 图钉、L851–855 名/串/简介三段、L856 操作）；
  - L859–879：设置页两行分支（含 L861 `title`、L863–869 图钉、L871–877 名/勋章/简介、L878 操作）。
- 列表容器：**L881–883**（`listNode = rows.length > 0 ? h('div', { ref, style: listStyle }, rows) : 空态`）。
- 行样式：L726–736（`listStyle/itemStyle/pinStyle/nmStyle/subStyle/tagStyle/actStyle/actBtn/footStyle/footLink`），尤其 L734 `tagStyle` 勋章是 #71 的，#70 云 chips 不得复用它。
- 行事件：L741–776（`handlePick/handlePin/handleCopy/handleDel/handleEdit`），#70 不动。

### 4.3 不越界证明（区间算术）

- 顶部节点定义区间 `[810, 823]` 与行映射区间 `[824, 880]` 是**首尾相邻、端点不重合**：L823 是 `domainNodes` 定义的闭括号 `}))`，L824 是 `const rows = sorted.map` 的首行。逐行核对：L818–820 `tabNodes`、L821–823 `domainNodes`、L824 `rows`——同一 `// ── 组装 ──` 注释块内三段顺序排列，无交叉、无嵌套。
- 组装引用区 `[909, 927]` 同时引用两区（L909 `tabNodes`、L910 `domainNodes`、L924 `listNode`），但该区只有**引用**没有**定义**：改引用顺序不算越界，在定义区写逻辑才算。#70 只许动 L910 一行（把 `domainNodes` 换成云节点或改名）与 L821–823 定义；#71 只许动 L824–883 定义。L924 `listNode` 引用行两 lane 都不许改。
- 样式区间 `[717, 723]`（顶）与 `[726, 738]`（行）同样相邻不重合：L723 `searchStyle` 末行之后空一行即 L726 `listStyle` 首行（L724–725 是两行注释），无共享变量（唯一的共享是 `tabBtn` 工厂被领域行复用——#70 若改 `tabBtn` 即踩 #71 页签样式，必须新建云按钮样式，见 §5 风险点）。
- 状态区间 `[538, 543]` 与行区间 `[824, 880]` 相距 280+ 行，行内只读 `tab/domain/q/filtered/sorted`，不行内 `setState`；顶部不直接操作 `x.name/labelString/intro` 行内字段。双向只读即不越界。
- 过滤集合 `[655, 671]` 是两区之间的**只读契约**：上游（顶）产出 `sorted`，下游（行）消费 `sorted`。`sorted` 的定义行 L671 与 `rows` 首行 L824 之间隔着 150+ 行样式与事件定义，无其他写入点。`grep sorted` 全文件仅 L671 定义、L687（deps）、L727（`sorted.length` 读）、L824（`sorted.map`）四处，无第二写入点——改集合语义即动契约，必须两 lane 会审，#70 单方面只许在 L659–664 内增减过滤谓词。

---

## 5) 给下一阶段（同一作者）用的实现步骤清单

> 前提：本清单假设 #70 目标是“把第二行领域单选行替换/升级为单行动标签云”（多标签云、单选过滤）。若立项会实际是“保留领域行、另加第三行云”，把步骤 2 的“替换”读作“新增一行”，其余不变。

- [ ] **步骤 1：先定云词源公式（只读 `store.ts`，先写注释再写码）**
  - 候选 A（推荐）：`allKnownLabels()` 过滤掉 `4 领域 + 3 阶段 + ['自定义']`，剩下的即行动词 + 自定义词。需在报告里逐词列出 23 词的去留表（以 `test-issue-23` L81 词表 23 为基准）。
  - 候选 B：从 `PRESET_TEMPLATES` 取 `action` 数组扁平去重（`templates.ts` L19 `action?: string[]`），自定义词另行并入。优点是维度纯净，缺点是自定义新词若不用 `action` 字段则进不了云。
  - 以 A 为默认起手，因为 `allKnownLabels()` 已含自定义在用词（L242），云对自定义开箱即用；B 仅当 A 的去留表出现争议词时启用。
  - 改动点：`panel.ts` L821 附近新增 `CLOUD_FILTERS` 派生（或独立小函数 `actionCloudLabels()`，建议放 `panel.ts` 顶部 L55–57 旁边，避免新开模块导致 `test-issue-23.cjs` L25 转译表连锁改）。
  - 断言：`node` 手算（非门禁脚本）打印云词表，人工核对去留表；正式断言留到转译脚本扩展（下一步）。
- [ ] **步骤 2：替换 `domainNodes` 定义（L821–823），不动 `tabNodes`（L818–820）**
  - 把 `DOMAIN_FILTERS.map` 换成云词表 `.map`，按钮 `onClick` 语义二选一并在 PR 描述里写明：
    - (a) 单选复用：沿用 `domainState`（改名 `cloudState` 可选），`domain === d` 高亮，点击已选项回 `all`（当前领域行无 toggle，点 `all` 才回；云建议加 toggle，手感更好，但这是行为变更，要显式记录）；
    - (b) 若保留领域行，则在 L910 下加第三行 `cloudNodes`，过滤时 `domain AND cloud` 双 AND（L662 下加一行 `if (cloud !== 'all' && !matchLabel(x, cloud)) return false`）。
  - 无论 (a)/(b)，**新建云按钮样式**（如 `cloudBtn(on)`），禁止复用/修改 `tabBtn`（L718–721 是页签与领域共享的，改它即踩 #71 页签）。
  - 断言：在 `scripts/test-issue-23.cjs` ** Add 新段（建议 L140 后插 `B2 云与领域同集合`）**，照抄 B 段三行式：`byButton(full, '复盘') → act → rowIds == matchLabel('复盘')集`；再加一段“云标签横跨多领域”（照抄 C 段 L132–134）。既有 A–I 断言一行不改。
- [ ] **步骤 3：同步滚动 effect deps（L687）与空态文案**
  - L687 `}, [compact, tab, domain, q, filtered.length, sorted.length])`：若新增 `cloud` 状态，必须加入 deps，否则云切换后不自动滚底（compact 浮层验收可感）。
  - 空态 `t('noMatch')`（L883）不动；若云导致空集更常见，文案由 i18n 侧另票处理，本票不改。
- [ ] **步骤 4：核对三处“不动”并逐项打勾**
  - `tab === CUSTOM_TAG` 短路（L660）保持：云在自定义页签下不生效（或明确生效，二选一写入本报告 §1.3 第 1 条的修订）。
  - 排序（L671 `sorted`）不动；搜索（L667–669 haystack）不动；行内串（L844/853/861/874 `labelString`）不动；`/prompt`（`trigger.ts` L41/54）与智能卡（`smart.ts` L354）不动。
  - `STAGE_TABS`（L55 死常量）不动；`CUSTOM_TAG` 哨兵不动；`#34` handlers（L913–922）与 hover 门控（L637–642/L889）不动。
- [ ] **步骤 5：风险点与回滚线**
  - R1 词表漂移：`allKnownLabels()` 含自定义在用词，自定义增删会导致云长度抖动。缓解：云按“预置行动词固定序 + 自定义词追加”排序并在空态/换行处做 `flexWrap`（沿用 L722）；回归断言只锁预置行动词子集，不锁全量长度。
  - R2 旧 `action` 字段缺失：新自定义模板只写 `labels`（`store.ts` L371），若云词源选 B 会漏新词。缓解：默认选 A；若选 B 则 `addCustom/updateCustom` 必须同步写 `action`，那是 store 合约变更，要另起评审，本票不建议。
  - R3 与 #71 合并冲突：两票同文件 `panel.ts`。#70 只碰 `[55–57, 538–543, 655–664, 717–723, 810–823, 909–923(仅L910), 687 deps]`；行区间 `[726–736, 741–776, 824–883]` 一行不碰。提 PR 前 `git diff --stat` 自查越界行号，越界即回滚。
  - R4 门禁独占：实现阶段仍**禁跑** `npm run` / `node scripts/test-*`（#71 lane 独占）。自查只用只读 `read/grep` + 肉眼对行号；把新增断言写对但不运行，留给 #71 lane 的门禁窗口统一执行。
  - R5 i18n：云标签是数据词（`复盘/拆解/…`），直接原文渲染（现领域行 L822 亦如此，`all` 除外走 `t('domainAll')`）。不要给每个行动词加 i18n key，否则 `STR` 表膨胀且中英映射无规范。

### 下阶段 DoD（照此验收即 PASS）

1. 第二行不再是 `DOMAIN_FILTERS` 五按钮（或按立项明确为新增第三行），云词表有明确去留表注释；
2. 点云任一标签，`rowIds == matchLabel` 集（含自定义在用词用例）；
3. `tab=自定义` 短路语义有显式注释说明去留；
4. 既有 `test-issue-23` A–I 断言零修改，新增 B2 段只加法；
5. `git diff` 触及行全部落在 §4.1 区间，§4.2 区间零行变更。

---

## 附：关键文件指纹（供第二阶段开工前 30 秒核对）

- `src/client/panel.ts`：984 行；头注释 L1–14；常量 L55–57；状态 L538–543；过滤 L655–671；样式顶 L717–723 / 行 L726–738；事件 L741–776；组装 L810–927；探针与日志 L938–984。
- `src/client/store.ts`：430 行；`labelString` L227 / `matchLabel` L232 / `allKnownLabels` L237；`templateLabels` L213 / `normalize/validate` L247–280；排序 L290–336。
- `scripts/test-issue-23.cjs`：233 行；转译表 L16–27；helpers L45–68；A–I 段 L71–228。
- `src/client/trigger.ts`：65 行，过滤 L41、描述行 L54。`src/client/smart.ts` 展示行 L354。
