# 取色浮层「文字描边」开关（ISSUE #162）实现核对

- 调查时间：2026-10-15 05:33–05:50（Asia/Shanghai）
- 仓库：`D:\dsh-plugin\dsh-prompt`，HEAD = `231e54ab66a2fee3bd0dc64b7428197e820be908`「feat(#162): 取色浮层加「文字描边」开关（默认开、只在有色时出现，清颜色时一并清掉）」，`git status --porcelain` 为空（跑完全部门禁后复查仍为空）。
- 需求原话（用户本次表述）：「我们有个ISSUE是关于调色板的。要求是在 调色板页面，允许用户选择是描线还是不描边。」
- 本文件只做核对，不改任何代码；唯一新增的临时探针在 `scripts/.rt-tmp-scratch/`（git 忽略，见 `.gitignore:7: .*/`）。

---

## 1. 一句话结论

**已实现**——源码、构建产物 `lib/client.js`、门禁、已发布的 npm 包与已安装的桌面 profile 四层证据一致，`#162` 的六条「要做的事」与四条「验收标准」全部能在代码里逐条对上；issue 自己留下的唯一未完成项是**用户真机验收**。

需要向用户澄清的差异有两处（都属于「措辞 vs 实现落点」，不是没做）：① 开关**只在已经选了颜色时才出现**，没有颜色就没有描边可言（`src/client/panel.ts:796`、`src/client/store.ts:370`）；② 它不在任何「页面」上，而是藏在**新增/编辑模板弹窗 → 点开取色浮层 → 浮层最下面一行**（`src/client/panel.ts:794-806`）。本仓**不存在任何字面名为「调色板」的页面/标签/路由**（`src/` 内零命中），「调色板」在本项目里唯一出现过的用户语境是指**取色控件本身**（issue #161 正文与进度里的用户原话）。

另发现一处门禁**未覆盖**的窄边界：把一个 `color` 为**带外值**（只能由手改数据造成）的存量记录改名保存，会额外写入 `outline: false`（`scripts/.rt-tmp-scratch/probe-outline-gap.cjs` 实测，见第 6 节第 5 条）。它不影响渲染，但与该票自己写的「只在关闭时才写 `outline: false`」契约有出入，且没有任何门禁断言覆盖。

---

## 2. ISSUE #162 要求逐条 → 代码证据

来源：`gh issue view 162 --repo FeatherHunter/dsh-prompt --json body,comments,title,state,closedAt`（2026-10-14T19:49:08Z 建、2026-10-14T20:08:45Z 关，已关闭，label `wayfinder:task`，父票 wayfinding map #151）。

### 2.1 六条「要做的事」

| # | 要求（原文摘） | 代码证据（file:line + 关键行原文） | 结论 |
|---|---|---|---|
| 1 | 取色浮层里加一行开关「文字描边」（选了颜色时默认开） | `src/client/panel.ts:796-806` 渲染该行：`value ? h('label', { key: 'ol', 'data-dsh-prompt-ink-outline-row': '1', …`；勾选框 `src/client/panel.ts:801`：`key: 'cb', type: 'checkbox', checked: outlineOn, 'data-dsh-prompt-ink-outline': '1',`；文案 `src/client/i18n.ts:86`：`colorOutline: { zh: '文字描边', en: 'Text outline' },`；「默认开」由读侧权威给出——`src/client/store.ts:371`：`return t ? t.outline !== false : true`（缺键＝开）；弹窗初值 `src/client/panel.ts:842`：`const s5 = react.useState(editing ? inkOutlineOf(props.tpl) : true)` | 满足 |
| 2 | 未选颜色时不摆灰控件，开关只在选了颜色之后出现 | `src/client/panel.ts:796` `value ? …` 与 `src/client/panel.ts:806` `]) : null,`（未选色＝整行不渲染）；读侧同样口径 `src/client/store.ts:370`：`if (inkColorOf(t) === undefined) return false` | 满足 |
| 3 | 关掉后名字仍染色但不带描边；四处渲染（悬浮小列表 / 设置页列表 / 远程卡片 / 智能卡）一致 | 四处名字节点都只在「有色 且 `inkOutlineOf` 为真」时挂钩子属性：`src/client/panel.ts:1653`（远程卡片，节点在 `:1690`）、`src/client/panel.ts:1853`（设置页列表与悬浮列表共用行工厂，节点在 `:1902` 紧凑分支／`:1930` 非紧凑分支）、`src/client/smart.ts:375`（智能卡，节点在 `:386`），三处原文均为 `const tint = ink !== undefined && inkOutlineOf(…)`；样式本体（唯一真相）`src/client/panel.ts:589`：`return '[' + INK_TINT_ATTR + ']{text-shadow:' + ring + ';}'`（八向 1px `text-shadow`，颜色取宿主令牌 `--dsw-alias-label-primary`）；注入 `src/client/index.ts:121`：`applyOwnedStyle(doc, INK_STYLE_MARKER, INK_TINT_CSS)`，启动时调用一次 `src/client/index.ts:199` | 满足（单测层）／真机未验收 |
| 4 | 数据：加可选 `outline?: boolean`；**只在关闭时写 `false`**；点「默认」清色时连 `outline` 一起删；宿主 `CustomRecordSchema` 补位 | 类型 `src/client/templates.ts:28`：`outline?: boolean`；新增 `src/client/store.ts:470`：`if (ink !== undefined && outline === false) t.outline = false`；更新 `src/client/store.ts:500-503`：`if (patch.outline === false && next.color !== undefined) next.outline = false` / `else delete next.outline`；清色同时删 `src/client/store.ts:497`：`if (ink === undefined) { delete next.color; delete next.outline }`；宿主 schema `lib/index.js:55`：`outline: z.boolean().optional(),` | 满足（但见 6.5 的窄边界） |
| 5 | 浮层预览跟着开关即时变 | `src/client/panel.ts:753`：`...(value && outlineOn ? { [INK_TINT_ATTR]: '' } : {}),`（预览合名节点，`src/client/panel.ts:745-755`）；`outlineOn` 派生自 prop `src/client/panel.ts:699`：`const outlineOn = props.outline !== false`；状态提升到弹窗 `src/client/panel.ts:843`，经 `src/client/panel.ts:959` 传入、`src/client/panel.ts:803` 回调（`props.onOutline && props.onOutline(!!(e.target && e.target.checked))`） | 满足（浮层打开时即时可见） |
| 6 | 回归脚本与门禁扩到新契约，发版 | 门禁断言：`scripts/test-issue-156.cjs:252-284`（A2 组，含 `scripts/test-issue-156.cjs:282`：`eq((code.match(/inkOutlineOf\(/g) || []).length, 4, 'A2) 四处渲染都过同一个读侧判据 inkOutlineOf')`）与 `scripts/test-issue-158.cjs:333-390`（E 组：新建落键 / 重开回显 / 再开删键 /「默认」双删）；发版证据见第 3 节 | 满足 |

### 2.2 四条「验收标准」

| 验收标准（原文摘） | 证据 | 结论 |
|---|---|---|
| 有色 + 描边开：四处名字带描边（与现状逐字段相同） | `scripts/test-issue-156.cjs` A 组实测 `ok: A) 四面同语义：四处名字节点都带钩子、都吃同一个读侧权威值`（FACES 定义 `scripts/test-issue-156.cjs:87`：`const FACES = ['悬浮列表', '设置页列表', '远程大列表', '智能卡'];`） | 满足（门禁） |
| 有色 + 描边关：四处仍染该色、**零描边钩子**；未上色的模板逐字节不变 | `scripts/test-issue-156.cjs:275-276`：`if (s.hook) fail('A2) ' + face + ' 面关掉了描边却仍带钩子属性 …')` / `eq(s.style.color, INK_NOSTROKE, 'A2) ' + face + ' 面仍然染色（关掉的只是描边）')`；实测输出 `ok: A2) 关掉描边：四面仍染色、零钩子（同一份读侧判据）`；B 组「带外 ≡ 未选色」逐字段对照（`scripts/test-issue-156.cjs:317`） | 满足（门禁） |
| 存量记录（无 `outline` 键）读回＝描边开，逐字节不变 | `src/client/store.ts:371`（缺键＝开）＋`src/client/store.ts:470`／`:500-503`（非关闭态一律不写键）；门禁 `ok: D/E/F) 渲染与落盘：… + 存量带外值不被改写` | 满足（门禁）／真机未验收 |
| `typecheck` / `test:issue-156` / `test:issue-158` / `test:issue-134-gate` / `test:lib-sync` 与全门禁绿；发版 | 见第 4 节实测：六条命令全部 exit 0、全 PASS | 满足 |

### 2.3 无法核实项

- **真机观感与真机落盘**：issue 进度自己写着「待用户真机验收：升级到 0.4.20 后，编辑一个已上色模板 → 关掉「文字描边」→ 四处名字应仍是该色但无描边」。本条在本机**未核实**（需要用户在桌面 DSH 里实际操作）。
- 用户记忆中「有个 ISSUE 关于调色板」与 `#162` 是否同一张：按 Lead 已核的事实，全仓只有 `#162` 命中该需求；本报告未再穷举用户的记忆来源。

---

## 3. 发货链核对

| 环节 | 证据 | 结果 |
|---|---|---|
| 提交 | `git log -1` → `231e54ab66a2fee3bd0dc64b7428197e820be908 feat(#162): 取色浮层加「文字描边」开关（默认开、只在有色时出现，清颜色时一并清掉）`；`git status --porcelain` 为空 | 一致 |
| npm dist-tag | `npm view dsh-prompt dist-tags` → `{ beta: '0.4.10-beta.1', latest: '0.4.20' }` | `latest = 0.4.20` |
| 已装 profile 版本 | `C:\Users\辰辰洋洋\.dsh\profiles\desktop\node_modules\dsh-prompt\package.json` → `version` = `0.4.20` | 与 npm 一致 |
| 已装产物内含证据（只读） | `…\node_modules\dsh-prompt\lib\client.js`：`:829 function inkOutlineOf(t) {`、`:830 if (inkColorOf(t) === void 0) return false;`、`:831 return t ? t.outline !== false : true;`、`:1953 colorOutline: {`、`:3757 "data-dsh-prompt-ink-outline-row": "1",`、`:3771 "data-dsh-prompt-ink-outline": "1",`、`:3779 }) : null`（开关行条件渲染）、`:3809 const s5 = react.useState(editing ? inkOutlineOf(props.tpl) : true);`、`:4728 … f.outline === false ? false : void 0`、四处 `tint` 判定 `:4992`／`:5298`／`:17918` | 已装包确实带该功能 |
| 构建产物与源码同源 | `npm run test:lib-sync` → `ok: lib/client.js 与重新构建结果一致`（见第 4 节） | 一致 |

未核实：桌面 profile 里**正在运行**的 DSH 实例是否已加载磁盘上的 0.4.20（安装后是否重启过），本报告只证明了磁盘产物是 0.4.20 且含该功能。

---

## 4. 门禁实测结果

全部在仓库根、`231e54a` 工作区干净的前提下执行；跑完复查 `git status --porcelain` 仍为空（未改动任何被跟踪文件）。

| 命令（package.json 里的真名） | 退出码 | 实际输出摘要（原文摘） |
|---|---|---|
| `npm run test:lib-sync` | 0 | `ok: lib/client.js 与重新构建结果一致`、`ok: lib/update.js 与重新构建结果一致`、`=== Test lib-sync PASS ===` |
| `npm run typecheck` | 0 | `tsc -p tsconfig.json --noEmit && npm run typecheck:host` 两段均无输出（无错） |
| `npm run test:issue-134-gate` | 0 | `ok: B) 英文铬无 CJK：7 面 171 个钩子位置零 CJK，P1 十三行齐…`、`ok: C) 溢出预算：pill≤10（现状8） badge≤16（现状13） hint≤45 比≤5.0`、`RESULT: PASS` |
| `npm run test:issue-156` | 0 | `ok: A) 四面同语义：四处名字节点都带钩子、都吃同一个读侧权威值`、`ok: A2) 关掉描边：四面仍染色、零钩子（同一份读侧判据）`、`ok: B) 带外回落…`、`ok: C) 读不写回…`、`ok: D) 零新造色值…`、`ok: E) 接线…`、`RESULT: PASS` |
| `npm run test:issue-158` | 0 | `ok: C) 控件：一行按钮 + 浮层 12×带内深浅全可点色块墙（零 disabled）+ 预览 + 十六进制 + 带外提示`、`ok: D/E/F) 渲染与落盘：带色名字染色 + 关描边零钩子 + 带外回落照旧 + 新建落键 + 清除删键 + 存量带外值不被改写`、`RESULT: PASS` |
| `npm test`（= lib-sync + modal + issue-14） | 0 | `A1 modal open ok … A7 hover resumes after modal closed ok`、`=== Test B PASS ===`、`=== Test C PASS ===`、`ALL PASS: #14 regression suite` |

未跑：`npm run build`（会重写 `lib/`，本次约束禁止：不得重建 `lib/`；`test:lib-sync` 已在临时目录重建并逐字节比对，等价覆盖构建一致性）。其余门禁（bottom-up / modal / issue-14 / 23 / 141 / 142 / 20-host / 149 等）在 issue 进度里记为全绿，本次按需只跑了目标门禁与 `npm test`，**其余未核实**。

---

## 5. 「调色板页面」指代分析

**硬结论（已核实）**：

1. **本仓不存在字面名为「调色板」的页面、标签或路由。** `grep 调色板 src/` → `No matches found`；`grep 调色板 lib/` → `No matches found`。
2. 插件实际暴露的界面只有这些，都有各自的名字：
   - 悬浮列表面板：slot `conversation.input.overlay`，注册 id `dsh-prompt-panel`（`src/client/index.ts:237`）；
   - 设置页小节：slot `settings.section`，注册 id `dsh-prompt-toolbox`（`src/client/index.ts:242`），显示名 `src/client/i18n.ts:28`：`sectionName: { zh: '提示词模板', en: 'Prompt Templates' },`；
   - 入口按钮 `dsh-prompt-entry`（`src/client/index.ts:202`）、智能悬浮卡 `dsh-prompt-smart`（`src/client/index.ts:338`）。
3. **仓库文档明确把「调色板」划给另一个产品**：`CONTEXT.md:11`「本插件的产品形态：一个按钮展开的预制 / 自定义 prompt 清单…与「主题调色板」（dsh-opencode-palette，配色切换）无关。」
4. **用户自己上一次用「调色板」这个词，指的就是取色控件**：#161 正文背景节记「用户原话：『调色板看不懂怎么选，经常很多颜色块无法点击』」，#161 进度节复述「原话：『你这个调色板看不懂怎么选，经常很多颜色块无法点击，需要你解释并且优化』」。而 #161 处理的对象是「取色控件」（色相条 / 色块 / 取色浮层）——不是页面。
5. 更早的来源是 map 票 `#1`，标题「dsh-prompt：prompt 调色板插件 — wayfinding map」——那里的「调色板」是「prompt 的调色板」＝模板集合的产品比喻；而且用户在 `#1` 里明确说「我没说要用 palette…我们就叫 dsh-prompt」。

**最可能的指代**：**新增/编辑模板弹窗里点开的那个取色浮层（色块墙 + 预览 + 「文字描边」开关）**。理由：需求本体是「选择描线还是不描边」，而全仓唯一能选描边的地方就是它（`src/client/panel.ts:794-806`）；且用户在 #161 已经用「调色板」称呼过这组控件。

**其它可能读法（供澄清，勿直接采纳）**：

- (a) **设置页里的「文字颜色」字段**（设置页 → 「提示词模板」→ 某模板「编辑」）：用户如果是在设置页里看到这个字段并称之为「调色板页面」，那实现路径仍然只有弹窗内的浮层，结论不变（开关要再过一层弹窗才够得着）。
- (b) **整个插件的颜色/描边功能集合**（口语化的「调色板功能」）：等价于 #162 已交付的范围。
- (c) **主题调色板**（dsh-opencode-palette，配色切换）：被 `CONTEXT.md:11` 明确划为另一产品，与本需求无关；若用户真指它，则属于另一个仓库。
- (d) **一个「页面级的全局描边设置」**：产品里**不存在**这样的设置项——设置页（`SettingsPage`）里没有任何描边相关开关（`grep outline src/` 的命中文件只有 `about.ts` / `i18n.ts` / `panel.ts` / `picker.ts` / `remoteInputSheet.ts` / `store.ts` / `templates.ts` / `smart.ts`，其中 `settings.ts` 零命中；除 `i18n.ts:70` 的默认态文案外，其余命中都与描边开关无关）。若这是用户想要的，它**未实现**，需要新票。

---

## 6. 与用户本次表述的差异与剩余缺口

1. **开关只在「选了颜色之后」才出现**（不是一进调色板就能选）。依据：`src/client/panel.ts:796` `value ? h('label', {…}) : null`（`:806`）；读侧同口径 `src/client/store.ts:370`：`if (inkColorOf(t) === undefined) return false`。含义：用户无法「先决定不描边、再去选颜色」——没颜色时界面里根本不存在这个选项（issue 第 2 条「不选颜色的 prompt 不提供描边」正是这么定的）。若用户要的是「无论有没有颜色都能先勾」，那是**设计变更**，非缺陷。
2. **开关位于编辑弹窗内、取色浮层的展开面板里，不在页面上**。完整路径：设置页/悬浮列表 → 某模板「编辑」→ 弹窗中「文字颜色」一行按钮（`src/client/panel.ts:720-729`）→ 点开浮层（`src/client/panel.ts:730-809`）→ 浮层自上而下第 ③ 块才是描边开关（`src/client/panel.ts:794`）。新增模板时同样要先选颜色。
3. **清空颜色时 outline 一并删除**（与用户可能的预期相反，值得说明）：`src/client/store.ts:497`：`if (ink === undefined) { delete next.color; delete next.outline }`；界面上开关行随颜色一起消失（`src/client/panel.ts:806`）；门禁断言 `scripts/test-issue-158.cjs:379-383`（`E) 点「默认」后描边开关应随颜色一起消失`、`E) 点「默认」保存后 outline 键一并消失（不留孤儿数据）`）。即「关掉描边」不能独立于颜色存在。
4. **四处渲染一致性：一致**，且是**同一份读侧判据**（不是四处各写一遍）——`inkOutlineOf` 在渲染层恰好 4 处调用，门禁逐字点数（`scripts/test-issue-156.cjs:282`），并断言渲染层零裸读 `.outline`（`scripts/test-issue-156.cjs:283`：只允许 `props.outline,f.outline`）；四个面 = 悬浮列表 / 设置页列表 / 远程大列表 / 智能卡（`scripts/test-issue-156.cjs:87`）。注意其中 3 个面在 `src/client/panel.ts`、第 4 个面在 `src/client/smart.ts`。
5. **【新发现·门禁未覆盖】带外 `color` 的存量记录被保存时会多写一个 `outline: false`。** 写路径复现（一次性探针，scratch，未入库）：`node scripts/.rt-tmp-scratch/probe-outline-gap.cjs`（复用 `scripts/.rt-tmp-158/` 已构建产物，未重建 `lib/`），实测输出：

   ```
   inkColorOf  = undefined （⇒ 界面显示「默认」，开关行根本不渲染）
   inkOutlineOf= false （⇒ TemplateModal 的 s5 初值）
   弹窗 doOk 会送出 = {"name":"Renamed","labels":[],"body":"out-of-band body","outline":false}
   落盘 payload.template = {"id":"x-outband",…,"color":"#ffffff","outline":false}
   color 原样保留?  true
   新增了 outline 键?  true 值 = false
   --- 对照：无颜色新建 --- 新增 outline 键?  false
   ```

   成因：`src/client/panel.ts:859` 保存时**永远**送出布尔（`outline: outline ? true : false`），而 `src/client/panel.ts:842` 的初值取自读侧（带外 color ⇒ `inkOutlineOf` 回 `false`）；`src/client/store.ts:501` 的守卫看的是**原始存储值** `next.color !== undefined` 而不是读侧权威 `inkColorOf(next)`，于是给一个「读侧视为未选颜色」的记录落了键。影响：渲染无变化（读侧恒 `false`），但违反该票自己写的契约（`src/client/store.ts:457`「只在『有颜色且用户关掉描边』时写 `false`」、`src/client/templates.ts:27`「未选颜色时这个键不该存在」），且属对存量数据的静默加键。可达性低：`color` 带外只能靠手改数据造成（UI 写入口 `sanitizeInkColor` 不允许）。连带可见后果：这类记录若随后选一个合法颜色，开关会**预置为「关」**（`src/client/panel.ts:842` 初值），用户可能意外得到「不描边」。
6. **术语差异**：用户说「描线」，产品里这个词是「文字描边」（`src/client/i18n.ts:86`，中英 `文字描边 / Text outline`）；「描线」在 `src/`、`lib/` 内零命中。若用户是按字面去找「描线」这个字样，会在界面上找不到同名选项。
7. **未核实**：真机验收（见 2.3）；用户桌面 profile 里是否存在带外 `color` 的存量记录（未读用户数据，未核实）；正在运行的 DSH 是否已载入 0.4.20。

---

## 7. 下一步建议（只建议，未改任何代码）

1. **先闭环「是不是同一件事」**：把本文件第 5 节的四种读法直接摆给用户选（推荐默认 (a)/取色浮层）。这是唯一会改变后续动作的分叉——若是 (d)「页面级全局开关」，则属**未实现**，要开新票；若是 (a)(b)，则 #162 已交付。
2. **真机验收一次就够**：桌面 profile 已是 0.4.20，直接让用户做一遍 issue 里写的那条路径（编辑一个已上色模板 → 关掉「文字描边」→ 看四处名字仍是该色但无描边；再打开恢复）。这是 #162 自己留下的唯一缺口。
3. **不要重开 #162**（已关闭、有 Resolution 评论）：按本仓 wayfinder 习惯，任何新范围（尤其是「开关位置前移」「未选色也能选描边」「全局默认」）都开新票并挂到 map #151 下。
4. **若确认只是措辞差异**：把「调色板页面」→「取色浮层」这条术语对齐写进 `CONTEXT.md` 的词条（避免下一轮再出现同义不同词），并在 #162 补一条真机验收结论即可。
5. **第 6 节第 5 条那处窄边界**：建议单开一张小票（或并入下一次触碰 `updateCustom` 的票）——把 `src/client/store.ts:501` 的守卫从原始 `next.color !== undefined` 改成读侧权威（`inkColorOf(next) !== undefined`），并给 `scripts/test-issue-158.cjs` 的 F 组补一条「带外记录改名保存后不得新增 outline 键」的断言。**本次未改，仅建议。**
6. **术语与文案**：如用户坚持「描线」，需要在 `src/client/i18n.ts:86` 改词——注意本仓有 `test:issue-134-gate` 的字典完备与 CJK 规则会拦文案改动，改词要走门禁。

---

## 8. 收口（2026-10-15，用户拍板后已改代码）

用户选择：**① 就是 #162（只差真机验收）**；**② 第 6 节第 5 条那处窄边界现在就修**。以下改动已在工作区落地（未提交、未发版）：

| 落点 | 改动 |
|---|---|
| `src/client/store.ts:500-507` | 守卫判据从**原始存储值**改为**读侧权威**：`const hasInk = inkColorOf(next) !== undefined`；只有 `hasInk` 时才写 `false` / 删键，否则这个键**既不新增也不删除**（比「无颜色就删」更保守：ADR-0007 存量逐字节不变） |
| `src/client/panel.ts:840-843` | 开关初值改为 `editing && inkColorOf(props.tpl) !== undefined ? inkOutlineOf(props.tpl) : true` —— 没有可读颜色（含带外值）时一律「开」；这类记录随后选一个合法颜色，开关就以「开」长出来（原来会预置为「关」） |
| `scripts/test-issue-158.cjs` F / F2 / F3 | 新增 7 条断言：带外记录改名保存（缓存 + 出站形状）不得新增 `outline` 键；随后选色开关必须默认开（且取消不改盘）；直调 `updateCustom('x-outband', { outline: false })` 不得落键 |
| `scripts/test-issue-156.cjs:246` | `inkColorOf(` 点数 4 → 5（新增的一处是弹窗描边初值，与颜色初值同源＝判据不分裂） |
| `lib/client.js` | 已重建（`npm run build`），`test:lib-sync` 逐字节校验通过（产物 `lib/client.js:960-962` 可见新守卫） |

红→绿证据（每一处都单独验过，不是只跑绿）：
- 只回退 `src/client/store.ts`（保留 panel 改动）→ `test:issue-158` FAIL 2：`F) 直调 updateCustom 送 outline:false：带外 color 记录不得落 outline 键 → 实际 true，期望 false`、`F) 直调守卫的出站形状也不得多出 outline 键 → 实际 false，期望 undefined`。
- 只回退 `src/client/panel.ts` → FAIL 1：`F) 带外值记录选色后开关默认开（不得预置为关） → 实际 false，期望 true`。
- 两处都在 → `RESULT: PASS`。

全仓门禁：51 个 `test:*` 脚本 48 个 exit 0；`test:issue-156 / test:issue-158 / test:issue-134-gate / test:lib-sync / npm run typecheck` 全绿。两个红的是**改前就红**的存量问题（同时回退 src+lib 复验过，与本次无关）：`test:issue-89` require 失败（缺模块）、`test:issue-59` `ENOENT: src/client/updauto.ts`（该文件早已不在）。

未做：提交、`CHANGELOG.md` 条目、版本号与发版（用户只批了「修 + 补门禁 + 重建 lib」）；桌面 profile 仍是已发布的 0.4.20，本次修复要发版才会上机。
