# i18n 审计分类（#135）—— CJK 字面量逐条归类 + 「预制/预置」术语统一

> 票：#135（父图 #134）｜分支 `feat/135-audit`｜基线 `integration/134-bilingual-en`（b5392e5）
> 产物：`scan.mjs`（扫描 + 归类脚本，可复跑）· `cjk-literals.csv`（逐条产物，759 行 = 表头 + 758 条）· 本文件（人工归类与分析）
> 本票只审计不改码：`src/**` 一字未动；结论全部交给 ticket 141（铬迁移）与 138（门禁）。

## 1. 方法与总数

**一句话方法**：用 TypeScript 编译器 API 遍历 `src` 下全部 `.ts`（含 `.d.ts`），取出**所有含 CJK 的字符串字面量 / 模板字面量**（注释与标识符天然不在 AST 字面量里，故不算），再把人工逐条判定写成 `scan.mjs` 里的规则表（`RULES`），由脚本落进 CSV —— 命中即归类，任何一行没命中就打印并 `exit 1`，因此「检出条数 = CSV 行数 = 已归类条数」三者恒等。

- 复跑：`node research/i18n-audit/scan.mjs`（`--dump` 只打印检出、不归类、不写文件）
- CJK 判定范围：U+3000–303F CJK 标点、U+3400–4DBF 扩展 A、U+4E00–9FFF 基本区、U+F900–FAFF 兼容汉字、U+FF00–FFEF 全角/半角 CJK 形式。`·`(U+00B7)、`…`(U+2026)、`→`(U+2192) 等非 CJK 符号本身不触发，但同串汉字会触发，故不会漏
- CSV 列：`file,line,col,text,class,action,consumer_ticket,container`；第 8 列 `container` 是**附加**定位（如 `STR.presetCount.zh`、`CLOUD_EXCLUDE[1]`、`export function TemplateBrowser :: title`），前 7 列即票面口径。`consumer_ticket = -` 表示无后续票
- 扫描范围只有 `src/**`：`lib/**`（构建产物）与 `scripts/**`（测试夹具）不进球，但 §3/§4 点到的测试连带改点照列

**总数 758 条，四分类分布：**

| class | 条数 | 构成 |
|---|---|---|
| C1 铬 | 188 | `i18n.ts` 字典内 161（zh 160 + en 1）+ 散落铬 27 |
| C2 身份键 | 20 | CLOUD_EXCLUDE 8 + REMOTE_TAG_EXCLUDE_LIST 8 + `LABEL_RESERVED`/`LABEL_FALLBACK`/`（副本）`/remoteView `全部` 各 1 |
| C3 内容资产 | 542 | `templates.ts` 334 + `words.ts` 208 |
| C4 非界面 | 8 | `smart.ts` 诊断行 7 + `match.ts` 内部匹配 1 |
| **合计** | **758** | 全部有 class / action / consumer_ticket，无空 |

**按文件：**

| file | 条数 | class 分布 |
|---|---|---|
| src/client/templates.ts | 334 | C3×334 |
| src/client/words.ts | 208 | C3×208 |
| src/client/i18n.ts | 161 | C1×161 |
| src/client/panel.ts | 23 | C1×15 + C2×8 |
| src/client/remoteView.ts | 9 | C2×9 |
| src/client/smart.ts | 9 | C1×2 + C4×7 |
| src/client/workspace.ts | 6 | C1×6 |
| src/client/settings.ts | 3 | C1×3 |
| src/client/store.ts | 3 | C2×3 |
| src/client/match.ts | 1 | C4×1 |
| src/client/remoteInputSheet.ts | 1 | C1×1 |
| 其余 20 个 .ts | 0 | 文案全走 STR（button/picker/index/about/remote 等） |

## 2. 四分类定义（票面口径，照抄）

- **C1 铬** = 用户可见的界面文本（含 title/aria-label/placeholder/占位文案），必须随 UI 语言切换；
- **C2 身份键** = 作为数据身份/存储值/比较值用的字面量（用户数据里已存在的值、范围钮语义、回落词、保留词、CLOUD_EXCLUDE 等），身份与显示必须分离，用户数据永不改写；
- **C3 内容资产** = 预制模板名称/正文/标签词表等可插入正文内容，永不翻译（本图 Out of scope）；
- **C4 非界面** = 日志/诊断/内部错误文案/测试夹具/注释性字面量等不可见或不随语言变的串。

**action 词汇表**（CSV 第 6 列）：`已在STR`（已在 seam 内）· `迁STR(P1/P2…)`（141 要迁，P1=必迁、P2=标点/符号低优先）· `改写en(去CJK)` · `保持(函数内双语)` / `保持(调用方已本地化)` · `不动(身份值/写入用户数据/身份哨兵/内容资产/诊断/内部匹配字符)`。

## 3. ticket 141 铬清单

C1 全量 188 条的逐条 `file:line` 见 CSV（`class=C1`；其中 161 条字典条目连 `STR.<key>.zh|en` 一并给出）。下面是需要动作的 21 个 CSV 行（13 个 P1 + 8 个 P2），另附 6 行「无需动作」与 3 行「裁决」——裁决里 2 行的 consumer 也是 141，故 CSV 里 `consumer_ticket=141` 共 23 行。

### 3.1 必迁（P1：13 个 CSV 行；表内另含 1 行「关闭键无需改」与 1 行「i18n.ts 删键」，不计入 13）

| file:line | 现状字面量 | 建议 STR key | 建议 en 文案 | 是否要 data 钩子 | 备注 |
|---|---|---|---|---|---|
| panel.ts:83 | `预置` | **新增 `scopePreset`** | `Preset` | `data-dsh-prompt-scope="preset"`（建议加） | zh 值同步统一为「预制」（§4）；身份值 `SCOPE_PRESET='preset'`（panel.ts:81）别动 |
| panel.ts:84 | `自定义` | 复用 `tabCustom` | `Custom` | `data-dsh-prompt-scope="custom"` | 纯显示；**不得**复用 `LABEL_FALLBACK`（store.ts:34，C2 身份值） |
| panel.ts:85 | `全部` | 复用 `tabAll` | `All` | `data-dsh-prompt-scope="all"` | 选中态归一为 `null`（panel.ts:79 注释），该常量纯显示 |
| panel.ts:1481 / 1482 | `上一页`（title / aria-label） | 复用 `pickerPrev` | `Previous` | 已有 `data-dsh-prompt-remote-prev` | 远程大列表翻页 |
| panel.ts:1495 / 1496 | `下一页`（title / aria-label） | 复用 `pickerNext` | `Next` | 已有 `data-dsh-prompt-remote-next` | 同上 |
| panel.ts:1507 | （已是 `t('close')`） | 复用 `close` | `Close` | 已有 `data-dsh-prompt-remote-close` | 「关闭」**无需改**，登记备查 |
| panel.ts:1551 | `'已使用 ' + n + ' 次'` | **新增 `usageTitle`** | `Used {n} times` | 可选 `data-dsh-prompt-usage={n}` | zh `'已使用 {n} 次'`；调用方 `.replace('{n}', …)`（与 `remoteEffectiveNow` 同法） |
| panel.ts:1592 | `' · 点击展开/收起简介'` | **新增 `rowExpandHint`** | `Click to expand or collapse the summary` | 可选 `data-dsh-prompt-row-toggle` | `' · '` 分隔符留在调用方 |
| settings.ts:550 | `n + '档·' + p + '%'` | **新增 `remoteSizeValue`** | `{n} · {p}%` | 已有 `data-dsh-prompt-size-value` | zh `'{n}档·{p}%'`；与既有 `remoteSizeMin/Max`（zh `1档`/`10档`，en `1`/`10`）同口径 |
| smart.ts:368 | `'·常用'` | **新增 `smartCommonSuffix`** | `·Common` | 可选 `data-dsh-prompt-smart-row` | 与既有 `smartCommon`（zh「常用模板」，命中列）语义不同，别混用 |
| smart.ts:368 | `'·分' + score` | **新增 `smartScoreSuffix`** | `·Score {n}` | 同上 | 评分后缀 |
| remoteInputSheet.ts:217 | `String(len) + '字'` | **新增 `remoteInputChars`** | `{n} chars` | 可选 `data-dsh-prompt-sheet-chars` | 遥控输入镜字数 |
| i18n.ts:50 | `labelReserved.en` 含「任意」 | **删键** | — | — | 见 §5（随地图「砍保留词拒绝」） |

### 3.2 P2 标点/符号（8 个 CSV 行，低优先，可整批不动）

| file:line | 现状字面量 | 建议 STR key | 建议 en 文案 | data 钩子 | 备注 |
|---|---|---|---|---|---|
| panel.ts:711 | `'「'` / `'」'` | 新增 `nameQuote` | `“{name}”` | 可选 | 删除确认把模板名括起来；zh 保持「」 |
| panel.ts:1459 / 1634 / 1674 | `'＋ '` / `'＋'` | 新增 `plusGlyph` | `+` | 可选 | 纯符号；不迁则 en 下仍是全角＋ |
| settings.ts:302 | `'（'` / `'）'` | 新增 `bytesParen`（或不迁） | ` ({v})` | 可选 | 导出回执里的字节数括号 |

### 3.3 边界 / 裁决（3 行，141 需拍板，未必改码；其中 remoteView.ts:339 与 store.ts:434 的 consumer 也是 141）

| file:line | 现状字面量 | 建议 | 备注 |
|---|---|---|---|
| panel.ts:1522 | 注释：范围钮「不走 i18n（**禁区**）」 | 明确推翻并同步改注释，或保持现状 | 与 #70 P6a 历史决议冲突；本审计按 C1 归类（用户可见铬），141 若不推翻，请把 §3.1 前三行划掉 |
| remoteView.ts:339 | `'全部'`（`remoteTagOptions` 返回的首项哨兵） | 删死码，或保留并复用 `tabAll` | **生产不可达**：#132 已移除远程标签区（panel.ts:1008 注释），全仓只有 `scripts/test-issue-83.cjs:310,314` 消费它 |
| store.ts:434 | `'（副本）'` | 不动（写进用户数据） | 复制预制时拼进 `name` 落盘；要本地化只能「新建那一刻按当前语言取一次」，已存数据永不改写 |

### 3.4 无需动作（6 行，登记为 C1 但不归 141；另 panel.ts:1507 的关闭键已在 §3.1 登记）

| file:line | 现状字面量 | 现状 | 备注 |
|---|---|---|---|
| workspace.ts:289 | `'未归属'` | 纯函数默认值 | 生产调用方 picker.ts:217 已传 `tr(lang, STR.pickerUngrouped)`；只有 scripts/test-issue-104.cjs:130 走默认值 |
| workspace.ts:365 / 367 / 368 / 370 / 371 | `'刚刚' '分' '时' '天'` | 函数内双语 | `relativeWorkspaceTime`（workspace.ts:358-371）已按 `lang` 分支，英文走 now/m/h/d |

## 4. 「预制 / 预置」术语统一

**清点（全仓，排除 node_modules/lib/本审计目录）：**

| 区域 | 「预制」 | 「预置」 | 备注 |
|---|---|---|---|
| `src/**` | 17 行 | 28 行 | **字面量只有 2 行**：i18n.ts:35（预制，C1 字典值）、panel.ts:83（预置，C1 显示常量）；其余全是注释 |
| `README.md` | 3 行（174/180/194） | 0 | 文档口径已是「预制」 |
| `docs/**` | 0 | 0 | 只有英文 preset（docs/README.en.md:177） |
| `CONTEXT.md` | 2 行 | 3 行（27/31/103） | 术语表；建议随本结论收敛 |
| `scripts/**` | 13 行 | 32 行 | 测试夹具；test-issue-23.cjs 占 22 处「预置」 |
| `research/**` | 16 行 | 10 行 | 历史调研，不改 |
| `prototype/**` | 0 | 6 行 | 原型页，不改 |
| `package.json` | 1 行（description） | 0 | 已是「预制」 |
| 合计 | 52 行 | 79 行 | |

**结论：铬用「预制」**，对齐 i18n.ts:35 `presetCount.zh = '预制'`（悬浮面板与设置页头行「预制 24 · 自定义 n」已经是这个字）。要改的铬字面量只有 panel.ts:83 一处。

**数据 / 身份值不动（列出来）：本仓没有任何「预制/预置」是数据值。** 范围钮的身份值是 ASCII：panel.ts:81 `SCOPE_PRESET = 'preset'`、panel.ts:82 `SCOPE_CUSTOM = 'custom'`；标签身份集合里也没有这两个词（CLOUD_EXCLUDE 只含领域/阶段词与「自定义」）。所以术语统一零数据风险、零迁移成本。prototype/remote-touch-80.prototype.html:250/363/390/418/423 的 `'预置'` 是原型页自己的 filter 值，不在 src、不改。

**141 要改的具体行：**

1. `panel.ts:83` —— 字面量换成 `STR.scopePreset`，zh 值「预置」→「预制」（en `Preset`）。
2. `panel.ts` 注释同步：13、14、64、67、68、71、74、94、984、1005、1240、1268、1269、1275、1294、1520、1522（「预置」→「预制」，同一次改完，别留两个词给下一个读者）。
3. `scripts/test-issue-23.cjs:99、154、155、156、213、224` 与 `scripts/test-issue-74.cjs:180` —— 这些断言按**中文文本**找范围钮（`byButton(tree,'预置')`，helper 定义在 test-issue-23.cjs:64）；zh 值一改就红。**这正是 §3.1 推荐给三钮加 `data-dsh-prompt-scope` 钩子的直接理由**：141 顺手把断言改成按钩子取节点。
4. 可选同批（注释里的「预置」→「预制」）：`store.ts:430`、`match.ts:75`、`templates.ts:4`、`trigger.ts:30`、`remoteView.ts:304/306`；`CONTEXT.md:27/31/103`。（`settings.ts:651`、`smart.ts:242` 等已是「预制」，无需动。）

## 5. en 字典含 CJK 条目清单

全字典 162 键，`en` 值含 CJK 的**只有 1 条**：

| file:line | key | en 现值 | 建议 |
|---|---|---|---|
| i18n.ts:50 | `labelReserved` | `"任意" is reserved and cannot be a label` | 随地图 #134 已定的「砍保留词拒绝」**删除该键**；若地图最终不砍，改成 `The word "任意" is reserved and cannot be a label`（保留词本身是数据值，不翻译） |

若走「删键」，连带要动的点（141/后续票）：`store.ts:290` 的 `w === LABEL_RESERVED` 分支、`store.ts:280` 错误联合里的 `'labelReserved'`、`store.ts:32` `LABEL_RESERVED` 常量、`scripts/test-issue-23.cjs:247` 断言（`r.error === 'labelReserved'`）；`scripts/test-issue-31.cjs:29` 的白名单正则里提到 `LABEL_RESERVED`，同批清。展示链路是 `panel.ts:592 setErr(checked.error)` → `t(err)`，删键后该错误码不再产生，不会留死文案。

反向自查（可给 138 当二级断言）：`zh` 值**不含** CJK 的只有 2 个键 —— `panelTitle`、`entryBtn`，值都是品牌词 `Prompt`，属预期例外。

## 6. 与 ticket 138（门禁）的接口

**铬钩子命名**：`data-dsh-prompt-chrome="<strKey>"`，值 = `i18n.ts` `STR` 的 key 名（如 `data-dsh-prompt-chrome="scopePreset"`）；需要区分取用位置时可加 `data-dsh-prompt-chrome-kind="text|title|aria-label|placeholder"`。已有钩子（`data-dsh-prompt-remote-prev/next/close`、`data-dsh-prompt-size-value`、`data-dsh-prompt-templates-toggle` 等）是**行为**钩子，与铬钩子并存不冲突。

**扫描口径建议**（138 要判的集合）：

1. 文本位置：`h(tag, props, children)` 的 children 里的 CJK 字符串、模板串 head/literal 段里的 CJK 片段；
2. 属性位置：`title` / `aria-label` / `placeholder` / `aria-description` / `alt` 的字面量值；
3. 不判：注释、标识符、import 路径、`data-*` 值；
4. 豁免（白名单，直接取自 `scan.mjs` 的 `RULES`）：
   - 该元素带 `data-dsh-prompt-chrome`，或该行已走 `tr(lang, STR.x)` / `t('x')`；
   - C2 身份值：`CLOUD_EXCLUDE`、`REMOTE_TAG_EXCLUDE_LIST` 全表、`LABEL_FALLBACK`、`LABEL_RESERVED`、remoteView:339 哨兵；
   - C3 内容资产：`templates.ts`、`words.ts` 整文件；
   - C4 非界面：smart.ts 诊断行（382/386）、match.ts:112 `'：'`；
5. 二级断言：`i18n.ts` 的 `en` 值不得含 CJK（当前 1 条违例，见 §5）；`zh` 值须含 CJK，例外只有 panelTitle/entryBtn。

**复用方式**：`scan.mjs` 已导出 `CJK_RE` / `RULES` / `scan` / `classify`（`import { RULES, CJK_RE } from '…/research/i18n-audit/scan.mjs'`），138 可把 `RULES` 当白名单单一来源，或直接跑 `node research/i18n-audit/scan.mjs`（exit 1 = 有未归类行，即 src 里冒出了没人认领的 CJK 字面量）。

## 7. 边界与不确定项

- 本审计基线 b5392e5；`src` 一改，`scan.mjs` 会因未归类行 `exit 1`（这是设计特性：逼规则表跟着走）。
- 本 CSV 冻结于 b5392e5（758 条）；141 改码后现状 739 条，以 `node research/i18n-audit/scan.mjs --check` 为准，CSV 不重跑。
- `lib/**`（构建产物）与 `scripts/**` 未纳入 CSV；141/138 若要覆盖构建物，需另定口径（本票不扩）。
- 本票不做真机 en 渲染验证（不需要）；en 文案建议值只保证语义，最终措辞由 141 定。
- panel.ts:1522 的「禁区」注释是**唯一**与票面要求正面冲突的既有决议，已在 §3.3 单列。
