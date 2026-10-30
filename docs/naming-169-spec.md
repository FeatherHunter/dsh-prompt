# 命名规范与重命名映射（#169）

> map #168 子票 T3。前置：#172 权威范式（Vite 运行时切分 + tRPC 核/适配 + Effect 生成纪律）与 #173 全仓盘点（33 个 TS 文件清单）已关。本票只冻结术语与文件名，不定目标目录树（树归原型票 T4 #170）。

## 1. 命名规范（冻结，执行票 T5 照此搬家，对抗审查逐条核）

- N1 全英文 kebab-case：目录与文件名一律小写短横连词，不留 camelCase（`remoteInputSheet`、`styleOwnership`、`systemOrientation` 必改）。新增脚本沿 MUST 3 一律 `.mjs`。
- N2 文件名即概念：一文件一概念，名不达意即改名（`store`、`state`、`match`、`words`、`trigger`、`button`、`panel`、`picker` 属此类）。
- N3 transport 不进名：`update-http` 的 `http` 是传输实现，不是领域，改按运行时侧命名（`update-client` vs 宿主半）。
- N4 通用词不独占：`store`、`state`、`keys`、`words`、`match`、`panel`、`picker`、`button`、`settings`、`trigger`、`paths`、`hash` 不得单独作文件名，必须加领域前缀。
- N5 barrel 仅对外边界：`src/client/index.ts` 与 `src/update/host/index.ts` 是装配器不是 barrel，保持现状不扩转口；禁手写 `export *`（MUST 2）。
- N6 依赖方向写进文件头：跨模块 import 目标须在头注释声明可 import 者（MUST 5，`panel.ts:47-52` 手抄表即雏形，T5 推广）。
- N7 目录名 glossary 可溯：领域目录名必须能在根 `GLOSSARY.md` 找到定义；运行时/架构前缀（`client`、`host`、`core`、`adapters`、`ui`、`infra`、`__tests__`、`log`）走 §2 豁免白名单，不进 GLOSSARY，否则打回。

## 2. 豁免白名单（非领域名，不进 GLOSSARY，对抗审查见名即放行）

`client`、`host`（运行时侧，MUST 1）、`core`、`adapters`（核/适配，tRPC 式）、`__tests__`、`repro`（测试种类）、`log`（现存唯一子目录，T4 定去留）、`index`（装配器）、`pager`（无 DOM 纯页数学）、`panel-visibility`（UI 瞬态）、`style-ownership`、`system-orientation`、`error-fingerprint`、`safe-values`、`bridge-log`、`routes`（ infra/接线）。

## 3. 重命名映射表（旧名 → 新名 → 理由；33 个全覆盖）

### 3.1 票面四组易混名（必改 11 个）

| 旧名 | 新名 | 理由 |
|---|---|---|
| `store.ts` | `template-library.ts` | `store` 通用词独占；实为模板库集合 + 持久 + 标签收敛（GLOSSARY Template Library） |
| `smartstore.ts` | `smart-draft.ts` | `smartstore` 误导为持久 store；实为会话级 Smart Draft 悬浮（GLOSSARY Smart Draft） |
| `state.ts` | `panel-visibility.ts` | `state` 零信息；实为面板显隐布尔 + hover 同手势标记（UI 瞬态，豁免） |
| `remote.ts` | `remote-mode.ts` | `remote` 裸词歧义；实为 Remote Mode 总闸 + 持久（GLOSSARY Remote Mode） |
| `remoteView.ts` | `remote-grid.ts` | `View` 是 MVC 行话；实为十二槽纯布局数学（GLOSSARY Remote Grid）；兼 N1 kebab |
| `remoteInput.ts` | `remote-draft.ts` | `Input` 分不清逻辑/UI；实为 Remote Draft 纯镜 + 模型休眠门（GLOSSARY Remote Draft）；兼 N1 |
| `remoteInputSheet.ts` | `remote-sheet.ts` | 同上 + `Sheet` 即底贴宿主；实为 Remote Sheet 组件（GLOSSARY Remote Sheet）；兼 N1 |
| `update-http.ts` | `update-client.ts` | `http` 传输泄漏（N3）；实为 Update Capability 客户端接线，与宿主半侧对称 |
| `i18n.ts` | `strings.ts` | `i18n` 通用行话零信息；实为双语词表 STR/tr（GLOSSARY Strings）；解析已收口 locale |
| `locale.ts` | 保持 | 已是规范 domain Locale（resolveLocale/subscribeLocale），不改 |
| `keys.ts` | `label-identity.ts` | `keys` 撞键盘键/对象键；实为 CanonicalKey + normalizeKey + 存量适配（GLOSSARY Label Identity） |

### 3.2 其余 client（17 个：改 11，保 6）

| 旧名 | 新名 | 理由 |
|---|---|---|
| `button.ts` | `entry-button.ts` | `button` 通用；实为 input.left 提示词入口按钮 |
| `settings.ts` | `settings-page.ts` | `settings` 分不清数据/页；实为设置页组件 |
| `about.ts` | `settings-links.ts` | `about` 零信息；实为设置页对外入口区（仓库/ISSUE/作者引流） |
| `panel.ts` | `template-browser.ts` | `panel` 通用容器词；实为模板浏览组件（面板 + 设置页共用） |
| `picker.ts` | `workspace-picker.ts` | `picker` 通用；实为 Workspace Picker 全屏本体（GLOSSARY） |
| `workspace.ts` | `workspace-contract.ts` | 与 picker 对打：实为挑选器纯契约 + 机会链 + 反查索引，非组件本体 |
| `smart.ts` | `smart-card.ts` | `smart` 裸词歧义（模式/开关/评分？）；实为 Smart Mode 悬浮卡宿主 |
| `match.ts` | `smart-score.ts` | `match` 通用（字符串？模板？）；实为 Smart Score 评分引擎（GLOSSARY） |
| `words.ts` | `smart-words.ts` | `words` 通用；实为 Smart Words 强/弱词表（GLOSSARY） |
| `templates.ts` | 保持 | 共享类型家（PromptTemplate + Domain/Stage）+ 24 预制数据；tRPC 共享上浮式，T4 再定拆分 |
| `trigger.ts` | `prompt-trigger.ts` | `trigger` 通用；实为 /prompt 触发源 |
| `hostfont.ts` | `host-content-font.ts` | `hostfont` 缩写黑话；实为宿主内容字声明式桥 |
| `styleOwnership.ts` | `style-ownership.ts` | 仅 N1 大小写；运行时样式归属账本（infra 豁免） |
| `systemOrientation.ts` | `system-orientation.ts` | 仅 N1；整机方向 consumption thin wrapper（infra 豁免） |
| `pager.ts` | 保持 | 无 DOM 纯页数学已自解释（豁免），调用方量、此收数 |
| `index.ts` | 保持 | 装配器非 barrel（N5），T4 前不动 |
| `log/index.ts` | 保持 | 现存唯一子目录即边界；T4 定升为 diagnostics 还是保留 |
| `hover-tip.ts` | 保持 | 已自解释：整面悬停提示 portal（#181 修复引入的新文件，T5 之后落地，补登记以清目标树 gate 的 straggler） |

### 3.3 宿主半（5 个：改 2，保 3）

| 旧名 | 新名 | 理由 |
|---|---|---|
| `paths.ts` | `routes.ts` | `paths` 像文件系统路径；实为更新四条路由常量（infra 豁免） |
| `hash.ts` | `error-fingerprint.ts` | `hash` 通用算法词；实为 8 位错误指纹（两条链共用，与 gate 同形） |
| `bridge-log.ts` | 保持 | 已自解释：更新包事件转日志桥 |
| `safe-values.ts` | 保持 | 已自解释：值域安全网（字段名权威在真闸门） |
| `index.ts` | 保持 | 宿主半装配器（N5） |

## 4. 挑战记录（domain-modeling sharpen 项）

- Q1 `store/smartstore/state` 三者无一是同类：持久模板库 vs 会话草稿悬浮 vs 面板布尔。若统名 `*store` 会把“持久 domain 数据”与“会话 overlay”焊成一词，重蹈 #85 横竖屏旧词覆辙。故拆三名。
- Q2 `smart-draft` vs `remote-draft` 双 draft 并存是故意的：前者是本地会话输入（供 Smart Score 打分），后者是别处输入的只读镜（供触控 Sheet 发起）。前缀即来源，足以区分；若合一反而把读写语义搞混。
- Q3 `workspace.ts` vs `workspace-picker.ts`：前者是纯契约 + 探测（无 React/DOM/fetch/log），后者是全屏组件本体。名不拆，后人必把组件逻辑塞进契约。
- Q4 `templates.ts` 暂保是深思熟虑的例外：PromptTemplate 类型是 custom/preset 共用，preset 数据 24 条暂寄此。T4 原型再定“类型上浮 vs 数据下沉”，T3 不预拆。
- Q5 `panel-visibility` 豁免 GLOSSARY：UI 瞬态是通用编程概念，按 skill 规则本不该进 glossary；N7 豁免条款即为此而设，否则“目录名必有定义”不可满足。

## 5. 红队自查

- 误判 1 “`templates.ts` 也该改 preset-templates”——否决：类型家与数据同处是 tRPC 共享上浮式，拆名即逼 T4 预拆；保持并书面留待 T4。
- 误判 2 “`log/` 该改 diagnostics/”——否决：目录级改名是 T4 原型职权，T3 只冻文件名；本票书面保持。
- 误判 3 “双 draft 命名冲突”——否决：见 §4 Q2，前缀即来源，冲突是假阳性；真风险是合名。
- 误判 4 “GLOSSARY 漏了 button/panel/settings 等 10 个 UI 名”——否决：通用 UI 词按 skill 规则不进 glossary，走 §2 豁免；硬塞即污染（#173 Standards 已爆过 CONTEXT 词汇污染）。
- 可证伪：若 T4 原型发现任一新名在目标树下仍需加后缀（如 `smart-card` 与宿主 slot 名撞），本表该行即被推翻，以 T4 树为准。

## 6. 给下游的输入

- T4 原型（#170）：顶层按运行时切分已确认；本表 §3 即文件级供应清单，可直接摆树；§2 白名单即允许的非领域目录；GLOSSARY 即领域目录唯一词源。
- T5 执行（#171）：按本表逐文件 `git mv` + 同改 import + 头注释补可 import 者（N6）+ `npm run check` 命名巡检；`templates.ts` 与 `log/` 的去留以 T4 树为准。
- 未建 ADR：命名规则可随 T4 树微调（易逆），且无惊讶 trade-off（权威范式已在 #172 定），故按 skill 三条件不建；若 T4 选树出现真 trade-off 由 T4 建。
