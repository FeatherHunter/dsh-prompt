# 小列表中文胶囊：按设计还是 bug（/research findings）

基线：集成分支 beta 0.4.10-beta.0 代码（int，commit 12d5810 起）；English DSH + TemplateBrowser compact=true。主仓未读未写。每个断言后跟 source，不贴大段代码。

## 1. 小列表胶囊全清单（compact=true 下）

说明：胶囊形状以 borderRadius 999 为准。compact 行内标签是素文本（非胶囊），设置页同源才是胶囊。

| # | 位置 | file:line | 文本来源 | en 显示 | 类别 | 结论 | 证据 |
|---|---|---|---|---|---|---|---:|
| 1 | 云行范围钮全部 | panel.ts:1537-1542 | STR tabAll（i18n.ts:33） | All | 铬C1 | 必须英文 | gate B三钮断言 + panel-en.html tabAll大于All |
| 2 | 云行范围钮预制 | panel.ts:1543-1547 | STR scopePreset（i18n.ts:43） | Preset | 铬C1 | 必须英文 | 同上 + 快照 scopePreset大于Preset；术语见classification.md第4节 |
| 3 | 云行范围钮自定义 | panel.ts:1548-1552 | STR tabCustom（i18n.ts:37）身份SCOPE_CUSTOM | Custom | 铬C1 | 必须英文 | 同上 + 快照 tabCustom大于Custom；不得复用LABEL_FALLBACK见i18n.ts:40-42 |
| 4 | 云行行动词云一串pill | panel.ts:1553-1555经actionCloudLabels | 用户词原文c（panel.ts:87-88过isExcludedLabel） | 中文原文如拆解检验归因 | 数据 | 保持中文永不翻译 | gate B dataWords剔除test-issue-134-gate.cjs:200-217 + chromeOnly判零CJK :228-230 + snap 264段 |
| 5 | 行内标签串compact | panel.ts:1605-1608 | 数据函数labelString（store.ts:247-248调templateLabels store.ts:233-243） | 中文原文如思考框架斜杠执行前斜杠拆解 | 数据 | 保持中文 | snap ellipsis span含CJK而钩子零CJK；B组计入dataWords剔除 |
| 6 | 行内标签回落空标签 | store.ts:36 LABEL_FALLBACK + :243 + :291 | 存量中文拼写自定义 | 自定义原文 | 数据C2 | 保持中文不改写不翻译 | store.ts:33-35注释 + keys.ts:140-142写侧不动 + cjk-literals.csv:210 |
| 7 | 行内操作钮复制编辑删除 | panel.ts:1560-1567样式actBtn panel.ts:1121 | STR edit/del/copy（i18n.ts:46-48） | Edit Delete Copy | 铬C1 | 必须英文 | snap实测全英文 + B组170钩子零CJK |
| 8 | 头行计数 | panel.ts:1655-1658 | STR presetCount/customCount（i18n.ts:39/44）+数字 | Preset 24 Custom n | 铬C1 | 必须英文 | B组字典完备171键en零CJK |
| 9 | 行尾用量数字title气泡 | panel.ts:1578 + :1612 | STR usageTitle（i18n.ts:76） | 数字英文title Used N times | 铬C1 | 必须英文 | B组usageTitle属性位断言gate:257 |

形状备注：云钮panel.ts:1101透明未选中细描边pill；行操作钮panel.ts:1121同pill手感；compact行内标签span无borderRadius系素文本，同源设置页才套tagStyle胶囊panel.ts:1119/1634。

## 2. 用户截图那个自定义pill的归属判定：选(b)

三选一：(a)云行范围钮铬en应为Custom；(b)模板行标签chip回落词LABEL_FALLBACK等于自定义数据保持中文；(c)其他。结论选(b)。

- 排除(a)云范围钮：文本走词表panel.ts:1548-1552 + i18n.ts:37，en必为Custom；门禁B组钉住三钮All/Preset/Custom与钩子tabAll/scopePreset/tabCustom（gate:274-276），本次snap复现三钮全英文。en下云里不可能出现中文自定义，否则B组即红（实测PASS）。
- 排除云行动词含自定义：去留表含它keys.ts:154，判定原文命中即出局keys.ts:162-164，云装配过滤panel.ts:87-88；CSV归为C2身份值cjk-literals.csv:171。云pill再多也不含自定义。
- 落到(b)：空标签模板走store.ts:243回落 + store.ts:247-248原文展示 + panel.ts:1607行内展示compact素文本/:1634设置页胶囊；用户词身份即原文筛选逐字比对store.ts:252-254 + keys.ts:19-24。用户看到的自定义只能是该数据回落。
- 视觉胶囊加左邻同风格药丸不推翻结论：云钮off态正是细描边透明填充panel.ts:1101，行标签compact下本无pill形；若截图确为pill形则是把设置页tagStyle（panel.ts:1119）或云pill手感误认到小列表，来源仍是同一LABEL_FALLBACK，与云铬无关。

## 3. 最终结论一句话

无bug：小列表en下残留中文全是数据词（行标签/行动词云/简介/正文首行），按地图Out of scope用户自选标签永不翻译预置正文永不翻译（gh issue 134）与分类C2/C3口径（classification.md第2节）保持中文，铬侧已由门禁B组170钩子零CJK锁死。

## 4. 边界（compact之外同类中文胶囊，不展开）

设置页行内tagStyle胶囊panel.ts:1634同源labelString数据中文按设计保留；智能卡行tagText为labelString加铬后缀分节点smart.ts:380-382（后缀走STR smartCommonSuffix/smartScoreSuffix即i18n.ts:92-93，en为Common/Score n），数据段中文保留；远程档位pill remoteSizeValue（i18n.ts:120）与字数镜等为铬必须英文；挑选器按设计零钩子全走STR（gate snap断言picker-en.html钩子为0）。

验证记录（只读）：node scripts/test-issue-134-gate.cjs全绿（A171键 + B7面170钩子零CJK + C预算 + scan --check 739条全归类）；--snap落D盘temp下dsh-snap-134-research（panel-en.html钩子104，CJK264段全在数据位，三钮All/Preset/Custom）；gh issue view 134/139已核Out of scope与合成快照结论英文铬加中文数据共存。未改src、未commit。