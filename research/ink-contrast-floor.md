# 自定义 prompt 模板「文字染色 + 描边」的可读性下限与取色控件研究

- 日期：2026-10-14
- 问题：给**自定义** prompt 模板加可选颜色（模板名文字染成用户选的颜色；深色主题白描边、浅色主题黑描边；不选色不描边）。三个问题：
  1. 可读性下限：WCAG 2.2 哪些条款适用，什么样的判据可量化、可写进测试？
  2. 数值验证：8–12 个候选色对三种宿主背景的对比度，"任意颜色都允许"在数学上站得住吗？若必须限板，推荐哪 6 色？
  3. `<input type="color">` 在 DSH 的 Chromium/Electron 渲染器里可用吗（可用性、CSS 定制、是否弹系统取色器、无头/Electron 坑）？
- 状态：**完成**（三问已有结论；未证实项集中在第 4 节）
- 关联：`research/host-vs-plugin-h2-fontui.md`（体例对齐）；本文所有对比度/亮度阈值/区间端点都由 §2.1 的内联片段复算（未落盘脚本，另有 ΔE2000 实现已用 Sharma 参考对自校）

## 结论（先给答案）

1. **判据**：对每个候选填充色 C，在四面色（`#ffffff`/`#151517`/`#232324`/`#2c2c2e`）与两描边（`#ffffff`/`#000000`）上必须同时满足 —— ①描边对背景 ≥4.5:1（自动满足，作回归护栏）；②填充对描边 ≥3:1；③填充对每种背景 ≥3:1。②③ 合起来等价于一句可测的话：**填充色的相对亮度 L(C) ∈ [0.17602, 0.30000]**（WCAG 裸 3:1 线）；**色板取值用 3.2:1 余量，即 L ∈ [0.19109, 0.27813]**。**不要**用 4.5:1 卡"填充 vs 背景"——那在两主题间是空集（§1.4）。
2. **任意颜色不可行，必须限板**：sRGB 全色域 16,777,216 色里只有 22.105% 能同时踩住③；能同时满足 4.5:1 的是 **0%**（空集）。亮色（黄/青/浅粉）在暗主题会把白描边吞掉、深色（纯蓝/深藏青）在亮主题不可读。推荐 6 色：**`#f43f5e` 玫红、`#ea580c` 橙、`#16a34a` 绿、`#0d9488` 青、`#0284c7` 蓝、`#a855f7` 紫**（最差对比度 3.30:1，两两 ΔE2000 最小 19.4）。
3. **原生 `<input type="color">` 能用，但只能当"高级自定义"入口，不能当主交互**：它存在的、点击后弹的是 **Chromium 渲染器自绘的 page popup（不是 Windows 系统取色器，也不是 Electron 自己的对话框）**，弹窗不可被作者 CSS 定制、不可被 DOM 断言；控件本体只有 `::-webkit-color-swatch{,-wrapper}` 两个专有挂钩（MDN 无文档）。DSH 是真窗口 Electron（`sandbox:true`），不存在无头/离屏阻断。主推仍然是**自绘 6 色色板**。

## 1. 可读性下限（问 1）

### 1.1 判据：三条断言（可直接写进测试）

记号：`cr(a,b)` 为 WCAG 对比度；`S = {#ffffff, #151517, #232324, #2c2c2e}` 为宿主可能给的四种行背景（浅色基面/层都是 `#fff`，暗色基面 `#151517`、层 `#232324`/`#2c2c2e`）；`W = #ffffff`（暗主题描边）、`K = #000000`（浅主题描边）。

| # | 断言 | 阈值 | 现状 | 规范落点 |
|---|---|---|---|---|
| T1 | `min(cr(W, s) for s in S[1:])`，`cr(K, #ffffff)` | ≥ 4.5:1 | 自动通过（13.94 / 21.00） | SC 1.4.3 的 Note 5「窄描边算作字母」 |
| T2 | `cr(C, W) ≥ 3` 且 `cr(C, K) ≥ 3` | ≥ 3:1 | 等价于 `L(C) ∈ [0.10000, 0.30000]` | SC 1.4.11「against **adjacent** color(s)」+ SC 1.4.1 的 3:1 Note |
| T3 | `min(cr(C, s) for s in S) ≥ 3` | ≥ 3:1 | 等价于 `L(C) ∈ [0.17602, 0.30000]` | SC 1.4.11 的 3:1 基准（描边缺失时的兜底） |
| 合成 | `L(C) ∈ [0.17602, 0.30000]`；**选板时取 3.2:1 余量** → `L(C) ∈ [0.19109, 0.27813]` | — | 本文 §2.6 的 6 色均落在此带内 | — |

外加一条**设计不变量（不是颜色判据，但会反过来决定判据是否成立）**：描边必须"窄"，不得填满字腔。Note 5 后半句说粗到填腔的边框按背景处理，届时填充色要对描边达 4.5:1，可行区间只剩 `L ∈ [0.17500, 0.18333]`（宽 0.00833，等于没有）——所以"窄描边"是这个方案能成立的前提。

### 1.2 哪几条 SC 适用（条款 + 原文要点 + URL）

- **SC 1.4.3 Contrast (Minimum)，AA** — <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>（页面更新 2026-09-06）。
  - 正文：「The visual presentation of text and images of text has a contrast ratio of at least 4.5:1, except for the following: **Large Text** ... 3:1; **Incidental**（inactive UI component、pure decoration、不可见、属于含显著其他视觉内容的图片）no contrast requirement; **Logotypes** ... no contrast requirement.」
  - 大型文本 = ≥18pt，或 ≥14pt 粗体；同页换算「1pt = 1.333px，14pt 与 18pt 约等于 18.5px 与 24px」。我们的 13.3px/600 与 14.3px/700 **都是普通文本**（14.3px 远小于 18.66px），名义要求 4.5:1。
  - 阈值不四舍五入：同页「4.499:1 would not meet the 4.5:1 threshold」。
  - Note 3（背景归属）：「contrast is measured ... with respect to the specified background over which the text is rendered in normal usage」「If no background color is specified, then white is assumed.」——我们的背景由宿主主题给，所以 T3 必须对**四种**背景全过，不能只算一种。
  - **Note 5（决定性，逐字）**：「When there is a border around the letter, the border can add contrast and would be used in calculating the contrast between the letter and its background. **A narrow border around the letter would be used as the letter.** A wide border around the letter that fills in the inner details of the letters acts as a halo and would be considered background.」→ 描边不是装饰，它**参与**字母对背景的对比度计算。
  - 例外与我们的关系：Colored 模板名是功能标签，既非 inactive UI 也非 pure decoration / logotype，**不能**援引 Incidental/Logotypes 例外。
- **SC 1.4.11 Non-text Contrast，AA** — <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>。
  - 正文：「... have a contrast ratio of at least 3:1 **against adjacent color(s)**: *User Interface Components* — Visual information required to identify user interface components and states, except for inactive components or where the appearance of the component is determined by the user agent and not modified by the author; *Graphical Objects* — Parts of graphics required to understand the content ...」。同页：阈值同样不四舍五入（2.999 不达标）；Boundaries 节允许"靠可见内容识别控件时不强制边框"。
  - 对我们：填充色的**相邻色就是描边**（T2 的落点），描边的相邻色是我们无法控制的宿主行背景（T1/T3 的落点）。
- **SC 1.4.1 Use of Color，A** — <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>（更新 2025-09-16）。
  - 正文：「Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element.」
  - 定量 Note：「If content is conveyed through the use of colors that differ not only in their hue, but that also have a significant difference in **lightness**, then this counts as an additional visual distinction, as long as the difference in relative luminance between the colors leads to a contrast ratio of **3:1 or greater**.」
  - 反面：「if content relies on the user's ability to accurately perceive or differentiate a particular color an additional visual indicator will be required **regardless of the contrast ratio**」。
  - 1.4.11 的 "Relationship with Use of Color" 节把这个门槛落到 G183：「a link color that meets the 3:1 contrast ratio relative to the non-linked text color as satisfying the Success Criterion 1.4.1 Use of color since it is relying on contrast ratio as well as color (hue)」。充分技术：G14/G205/G182/G183；失败例 F13/F73/F81。
- **SC 1.4.6 Contrast (Enhanced)，AAA** 只作参照：7:1 要求 `L ≤ 0.10000`（对白）与 `L ≥ 0.35303`（对 `#151517`），同样是空集。

### 1.3 为什么是这组判据（三条候选路线的取舍）

- **路线 A「填充色对每种背景 ≥4.5:1」**：数学上不可能（§1.4：交集为空）。而且按 Note 5 的窄描边读法，4.5:1 要求的是"**字母（含描边）** vs 背景"——描边才是承担 4.5 的那一层；把 4.5 硬压在填充色上既不合规读法也不可行。**否决。**
- **路线 B「填充 vs 背景 ≥3 且 描边 vs 背景 ≥3」= T1+T3**：三条里与规范文本贴得最近的一条。3:1 不是随手挑的：1.4.11 对**非文本**元素的基准就是 3:1；1.4.1 的 Note 把 3:1 的**亮度差**认定为"色相之外的额外视觉区分"；G183 用 3:1 作为"不只靠色相"的充分做法。再补 T2（填充 vs 描边 ≥3），因为 1.4.11 的字面要求是"against adjacent color(s)"，填充色的相邻色就是描边——描边与填充混在一起就等于字糊成一团。
- **路线 C「自由取色 + 运行时校正」**：把 T3 当运行时护栏（§2.7）。这是唯一能让"任意颜色"成立的办法，但它已经不是"任意颜色"而是"任意颜色 → 就近投影到可读带"，产品语义上等于限板。

**诚实声明**：T1–T3 是"规范依据 + 作者自定阈值"的组合判据，不是 WCAG 里现成的一行要求；WCAG 没有为"描边彩色文字 + 主题切换"给出可直接套用的单一算式（Note 5 只说明描边参与计算）。所以工程上必须自己钉一条可测线，本文给的就是这条线及其依据。

### 1.4 严格 AA 不可能：数学证明

对纯色布景，`cr(C,B) ≥ R` 等价于亮度区间（`L_B` 为背景相对亮度）：

```
L(C) ≤ 1.05/R − 0.05                       （对白底，限制上界）
L(C) ≥ R·(L_B + 0.05) − 0.05               （对任意底色，限制下界）
```

代入 R = 4.5 与四种背景亮度 `#ffffff` 1.000000 / `#151517` 0.007576 / `#232324` 0.016868 / `#2c2c2e` 0.025341：

- 上界：`L ≤ 1.05/4.5 − 0.05 = 0.18333`
- 下界（最强的那个，来自 `#2c2c2e`）：`L ≥ 4.5 × (0.025341 + 0.05) − 0.05 = 0.28903`

`0.28903 > 0.18333` → **交集为空**。即使只要求基面两色（浅 `#ffffff`、暗 `#151517`）也已矛盾：需同时 `L ≥ 4.5 × 0.057576 − 0.05 = 0.20909` 与 `L ≤ 0.18333`。故：**一个 hex 同时服务浅/暗两主题且达 AA 4.5:1 是不可能的**；R = 3 时才有解（下界取自 `#2c2c2e`）：`L ≥ 3 × 0.075341 − 0.05 = 0.17602`，`L ≤ 1.05/3 − 0.05 = 0.30000`。

要真正拿到 AA，只有两条路：(a) 每个主题**各存一套色值**（浅色给深档、暗色给亮档，各自对自己主题 ≥4.5:1），或 (b) 让描边承担 4.5:1 的"字母对背景"责任（即把彩色填充理解为字母内部的装饰）。我们的需求（用户只选一个颜色、两主题自动出描边）走的是 (b)，所以判据落在 3:1 上是对的。

### 1.5 测试落地形状

- 断言用**原始 double 比值**，阈值比较只允许吸收浮点误差的 epsilon（`ratio >= 3.0 - 1e-12`），**不得**用"四舍五入到 1 位再比"的写法（WCAG 明确 4.499 不算 4.5，2.999 不算 3）。
- 阈值分工：**测试卡 3.0**（规范线，卡住回归）；**色板选值按 3.2 留余量**（给主题色值漂移、宿主层色变化留头寸）。这样"设计师加第 7 个颜色"会被一个快照/表驱动测试挡住。
- 形状（伪代码）：

```
SURFACES = ["#ffffff", "#151517", "#232324", "#2c2c2e"]
for C in PALETTE:                       # §2.6 的 6 色 + 未来新增
  for s in SURFACES:   assert cr(C, s) >= 3.0 - 1e-12     # T3
  assert cr(C, "#ffffff") >= 3.0 - 1e-12                  # T2（暗主题描边）
  assert cr(C, "#000000") >= 3.0 - 1e-12                  # T2（浅主题描边）
assert cr("#ffffff", "#151517") >= 4.5 - 1e-12            # T1（描边自身，回归护栏）
```

- 另加两条非颜色断言（把 §1.1 的不变量钉住）：描边宽度 ≤ 1px（13.3–14.3px 字号下不填腔）；"未选色"分支不产生任何描边与色值。

### 1.6 SC 1.4.1 对取色 UI 的额外要求

- 颜色是**冗余线索**：模板名文字本身承载语义，颜色只是附加区分 → 满足 1.4.1 的前提成立（这正是"任意六色 + 不选色都合法"的根据）。
- 但**选中态不能只靠色相**：色板里"当前选中哪一格"必须有非色相线索（对勾/描边/加粗），且色板格子相对面板底色也要 ≥3:1（1.4.11 + 1.4.11 "Relationship with Use of Color" 的提醒：仅靠色相变化表达状态属于 1.4.1 的问题）。
- 聚焦指示器必须对相邻背景达标（1.4.11 正文把 focus indicator 明确算进 UI component 状态）。

## 2. 数值验证与色板（问 2）

### 2.1 计算口径与复算片段（全部自算，未抄二手值）

WCAG 2.2 官方定义（同 1.4.3 页 relative luminance / contrast ratio 两节）：`L = 0.2126R + 0.7152G + 0.0722B`，`R = RsRGB/12.92 (RsRGB ≤ 0.04045)`，否则 `((RsRGB+0.055)/1.055)^2.4`；`cr = (L1+0.05)/(L2+0.05)`。

```js
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const rgb = h => h.replace('#','').match(/../g).map(x => parseInt(x,16));
const lum = h => { const [r,g,b] = rgb(h); return 0.2126*LIN[r] + 0.7152*LIN[g] + 0.0722*LIN[b]; };
const cr  = (a,b) => { const [x,y] = [lum(a), lum(b)].sort((p,q) => q-p); return (x + 0.05) / (y + 0.05); };
// 阈值反解（对白底 / 对任意底色）
const Lmax = R => 1.05 / R - 0.05;
const Lmin = (R, bg) => R * (lum(bg) + 0.05) - 0.05;
```

四种宿主背景亮度：`#ffffff` 1.000000 / `#151517` 0.007576 / `#232324` 0.016868 / `#2c2c2e` 0.025341。

亮度区间端点表（给定比值允许的 `L(C)`）：

| R | 上界（vs `#ffffff`） | 下界（vs `#151517`） | vs `#232324` | vs `#2c2c2e` | vs `#000000` |
|---|---|---|---|---|---|
| 3 | 0.30000 | 0.12273 | 0.15060 | 0.17602 | 0.10000 |
| 4.5 | 0.18333 | 0.20909 | 0.25090 | 0.28903 | 0.17500 |
| 7 | 0.10000 | 0.35303 | 0.41807 | 0.47739 | 0.30000 |

由表即得：C3 带 `[0.17602, 0.30000]`（非空）、AA 带 `[0.28903, 0.18333]`（空）、工程余量 3.2 带 `[0.19109, 0.27813]`、halo 读法 4.5 带 `[0.17500, 0.18333]`（宽 0.00833）。

### 2.2 宿主背景与字号的仓内出处

- 宿主色值出自 `.dsh-extract/theme-css/design_platform_css_default.pretty.css:51` `--dsw-static-neutral-bluish-00:#fff;`、`:66` `--dsw-static-neutral-bluish-850:#2c2c2e;`、`:67` `--dsw-static-neutral-bluish-875:#232324;`、`:69` `--dsw-static-neutral-bluish-950:#151517;`；浅色 `:155` `body{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00);`（`:159-161` layer-1/2/3 同为 bluish-00）；暗色 `:269` `body[data-ds-dark-theme]{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-950);`。另见 `.dsh-extract/theme-css/gradient_shadow_text_css_default.pretty.css:15`（暗色 think 渐变含 `#151517`）。
- 字号 13.3px/600 与 14.3px/700 来自需求描述；在 `D:\dsh-plugin\dsh-prompt\src` 内 grep `13\.3|14\.3|#151517|#232324|#2c2c2e` 只命中 `src/update/host/bridge-log.ts:54` 与 `:119` 的「13.38 MiB/天」（无关），**未在仓内复核**（见 §4）。
- 结论性提醒：四面色都落在 `#ffffff` 与 `#2c2c2e` 之间，所以 §1.4 的"空集"结论对本需求是硬的；若将来浅色层改成 `#f9fafb` 之类（亮度更低），3:1 带的上下界都会往坏处挪，色板余量 3.2 就是为这种漂移准备的。

### 2.3 候选色表（15 色，覆盖红橙黄绿青蓝紫灰 + 极端亮/暗）

`L` = 填充色相对亮度；四列 = 对 `#ffffff` / `#151517` / `#232324` / `#2c2c2e` 的对比度；C3 = 对四表面全 ≥3:1；C2 = 对两描边全 ≥3:1；AA = 对四表面全 ≥4.5:1。

| 候选色 | L | vs `#fff` | `#151517` | `#232324` | `#2c2c2e` | C3 | C2 | AA |
|---|---|---|---|---|---|---|---|---|
| `#ff0000` 纯红 | 0.2126 | 4.00 | 4.56 | 3.93 | 3.49 | 过 | 过 | 不过 |
| `#ff7a00` 亮橙 | 0.3518 | 2.61 | 6.98 | 6.01 | 5.33 | **不过** | 不过 | 不过 |
| `#ffd400` 亮黄 | 0.6835 | 1.43 | 12.74 | 10.97 | 9.74 | **不过** | 不过 | 不过 |
| `#00ff00` 纯绿 | 0.7152 | 1.37 | 13.29 | 11.44 | 10.16 | **不过** | 不过 | 不过 |
| `#00e5ff` 亮青 | 0.6326 | 1.54 | 11.86 | 10.21 | 9.06 | **不过** | 不过 | 不过 |
| `#0000ff` 纯蓝 | 0.0722 | 8.59 | 2.12 | 1.83 | 1.62 | **不过** | 不过 | 不过 |
| `#7c3aed` 深紫 | 0.1343 | 5.70 | 3.20 | 2.76 | 2.45 | **不过** | 过 | 不过 |
| `#0b1f3a` 深藏青 | 0.0136 | 16.52 | 1.10 | 1.05 | 1.19 | **不过** | 不过 | 不过 |
| `#ffb3d9` 浅粉 | 0.5851 | 1.65 | 11.03 | 9.50 | 8.43 | **不过** | 不过 | 不过 |
| `#d0d0d0` 浅灰 | 0.6308 | 1.54 | 11.82 | 10.18 | 9.04 | **不过** | 不过 | 不过 |
| `#808080` 中灰 | 0.2159 | 3.95 | 4.62 | 3.98 | 3.53 | 过 | 过 | 不过 |
| `#e5484d` 玫红 | 0.2183 | 3.91 | 4.66 | 4.01 | 3.56 | 过 | 过 | 不过 |
| `#f5a524` 琥珀 | 0.4645 | 2.04 | 8.94 | 7.69 | 6.83 | **不过** | 不过 | 不过 |
| `#16a34a` 绿 | 0.2686 | 3.30 | 5.53 | 4.76 | 4.23 | 过 | 过 | 不过 |
| `#3b82f6` 蓝 | 0.2355 | 3.68 | 4.96 | 4.27 | 3.79 | 过 | 过 | 不过 |

三类失败机理（`#ffd400`/`#00e5ff` 为代表）：亮色在暗主题上与白描边只差 1.4–1.5:1，描边与填充糊成一团、字看起来像白块（C2 挂）；`#0000ff`/`#0b1f3a` 在浅主题上对白底只有 8.59/16.52 但**对暗表面** 1.62/1.19，暗主题下整块融进背景（C3 挂）。**没有任何候选满足 AA**，与 §1.4 的证明一致。

### 2.4 全色域普查（把"任意颜色"量化）

逐色遍历 sRGB 全部 16,777,216 色：

- 满足 C3（对四表面全 ≥3:1）：3,708,668 色 = **22.105%**；即 **77.895% 的颜色直接出局**。
- 其中通道极差 ≥40（勉强算"有彩度"，否则偏灰）：3,556,285 色 = 21.197%。
- 满足严格 AA（对四表面全 ≥4.5:1）：**0 色 = 0.000%**（区间为空，与 §1.4 一致）。

### 2.5 结论：「任意颜色都允许」在数学上不站得住

三条独立理由，任一条都足以否掉"自由取色"：

1. **77.895% 的颜色连 3:1 底线都过不了**（§2.4），用户在取色器里随手一拖大概率拖进不可读区。
2. **AA 4.5:1 是空集**（§1.4），不存在"选什么都达 AA"的实现。
3. **两主题互相拉扯**：同一个 hex 要同时满足"对白底别太亮、对 `#151517` 别太暗"，可行亮度带只有 0.124 宽（3:1 时），占 0–1 亮度轴的 12.4%；加上"要有颜色"（不能靠灰）与"六色可分"，实际可用空间更窄。

产品结论：**必须限板**（6 色 + 不选色），或接受 §2.7 的运行时校正（校正后等价于限板）。

### 2.6 推荐 6 色

**主推（观感与安全余量兼顾，四表面 + 两描边最差 3.30:1，两两 ΔE2000 最小 19.4）**：

| 色位 | hex | L | vs `#fff` | `#151517` | `#232324` | `#2c2c2e` | vs 白描边 | vs 黑描边 | 最差 |
|---|---|---|---|---|---|---|---|---|---|
| 玫红 | `#f43f5e` | 0.2360 | 3.67 | 4.97 | 4.28 | 3.80 | 3.67 | 5.72 | 3.67 |
| 橙 | `#ea580c` | 0.2450 | 3.56 | 5.12 | 4.41 | 3.92 | 3.56 | 5.90 | 3.56 |
| 绿 | `#16a34a` | 0.2686 | 3.30 | 5.53 | 4.76 | 4.23 | 3.30 | 6.37 | 3.30 |
| 青 | `#0d9488` | 0.2304 | 3.74 | 4.87 | 4.19 | 3.72 | 3.74 | 5.61 | 3.72 |
| 蓝 | `#0284c7` | 0.2064 | 4.10 | 4.45 | 3.83 | 3.40 | 4.10 | 5.13 | 3.40 |
| 紫 | `#a855f7` | 0.2154 | 3.96 | 4.61 | 3.97 | 3.52 | 3.96 | 5.31 | 3.52 |

两两 CIEDE2000（自身实现，已用 Sharma 参考对校验：`Lab(50,2.6772,−79.7751)` vs `Lab(50,0,−82.7485)` → ΔE00 = 2.0425，与文献值一致）：

| | `#0284c7` | `#a855f7` | `#0d9488` | `#f43f5e` | `#ea580c` | `#16a34a` |
|---|---|---|---|---|---|---|
| `#0284c7` | – | 31.2 | 26.6 | 50.8 | 51.0 | 48.4 |
| `#a855f7` | 31.2 | – | 41.3 | 33.0 | 48.7 | 54.7 |
| `#0d9488` | 26.6 | 41.3 | – | 63.5 | 53.8 | **19.4** |
| `#f43f5e` | 50.8 | 33.0 | 63.5 | – | **21.6** | 76.9 |
| `#ea580c` | 51.0 | 48.7 | 53.8 | 21.6 | – | 62.2 |
| `#16a34a` | 48.4 | 54.7 | 19.4 | 76.9 | 62.2 | – |

最弱两对是青↔绿（19.4）与玫红↔橙（21.6）：并排看能分辨，但 13.3px 小字下不是"一眼可辨"。这正是"亮度带只有 0.124 宽"的代价——**可读性下限与色相可分性在这个色域里互相挤**。

**备选（把可分性放到第一位）**：在同样的 3.2 余量带内做"最大化最小 ΔE2000"贪心最远点采样（彩度 ≥0.09），可做到 min pairwise ΔE00 = **27.33**：`#f0064e` / `#de6c00` / `#a29000` / `#009c48` / `#0096e4` / `#fc00fc`（最差对比度 3.21–3.59）。代价是出现了橄榄黄 `#a29000` 与洋红 `#fc00fc`，观感偏"信号色"。**建议**：默认用主推 6 色；若产品把"六色一眼可分"列为硬指标，改用这一组。

**为什么没有黄色**：黄色在 sRGB 里亮度天然高（`#ffd400` L=0.6835、`#ffff00` L=0.9278），要进带必须压暗成橄榄/金褐（带内最大彩度的"黄"就是 `#a29000`）。所以"红橙黄绿青蓝紫"的直觉色板在双主题 + 3:1 约束下**不可能**，色板只能是 玫红/橙/绿/青/蓝/紫。（若产品坚持要"金/黄"，只能走 §2.7 的每主题双色值方案。）

### 2.7 若产品坚持自由取色：把护栏做进运行时

- **snap-to-band**：取色器返回值 → 算 `L(C)`；若 `L > 0.30000` 则在**线性 RGB**上朝黑缩放、若 `L < 0.17602` 朝白缩放（对缩放系数二分 30 次即可收敛），命中带后作为实际填充色；再校验 T2（取 3.0 或 3.2，与选板口径一致）。
- 备选：直接拒绝并给文案提示（"该颜色在浅色/深色行背景上不可读，已自动调整"），保留用户原值但渲染用校正值。
- **可测性**：对 10k 个随机 hex 做属性测试，断言校正后的结果 `L ∈ [0.19109, 0.27813]`；这条测试同时覆盖了"产品以后偷偷放宽限板"的情况。

## 3. 原生取色控件（问 3）

### 3.1 可用性（存在、但有一串约束）

- **特性在**：`<input type="color">` 是标准轨道特性，Chromium 桌面自 20 起支持（BCD 原始数据 `type_color`：chrome `version_added: "20"`）。Blink 实现见 `third_party/blink/renderer/core/html/forms/color_input_type.cc`：`CreateShadowSubtree()` 建 UA shadow 子树并 `SetShadowPseudoId("-webkit-color-swatch-wrapper")` / `SetShadowPseudoId("-webkit-color-swatch")`。
- **值域只有 `#rrggbb`**：同文件 `IsValidColorString` 要求 `starts_with('#') && length == 7` 且颜色不透明（注释「We don't accept #rgb and #aarrggbb formats」）；非法值回落到 `kFallbackColorValue = "#000000"`。**接受任意 CSS 颜色**（`red` / `rgb()` / `oklch()`）在 BCD 里是 `chrome: version_added false` + `impl_url https://crbug.com/416245392`，即**尚未发布**（Blink 里由 runtime flag `ColorInputAcceptsCSSColorsEnabled` 控制，`alpha`/`colorspace` 由 `InputTypeColorEnhancementsEnabled` 控制）。插件拿到的必然是 6 位 hex，这一点反而省事。
- **必须用户手势**：同文件 `HandleDOMActivateEvent` 先查 `LocalFrame::HasTransientUserActivation`，不满足就 console warning **"User activation is required to show the color picker."** 并直接 return。→ 不能程序化打开（这对我们的 overlay/浮层交互是个真实约束：任何"点一下自动弹色板"的实现都要保证是真实点击链路）。
- **MDN 的定性**：<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color> —「The element's presentation may vary substantially from one browser and/or platform to another—it might be a basic textual input that automatically validates ..., or a platform-standard color picker, or some kind of custom color picker window.」；使用取色器 UI 时 `select()` 什么也不做。

### 3.2 点下去弹的是什么：Chromium 自绘 page popup（不是系统取色器）

证据链（全部 Chromium 一手源码）：

1. Blink 弹窗前调 `chrome_client->OpenColorChooser(...)`（`color_input_type.cc:OpenPopupView`）。
2. `third_party/blink/renderer/core/page/chrome_client_impl.cc:802-822` `ChromeClientImpl::OpenColorChooser` 在 `RuntimeEnabledFeatures::PagePopupEnabled()` 为真时创建 `ColorChooserPopupUIController`；桌面分支里那个 `NOTREACHED() << "Page popups should be enabled on all but Android or iOS"` 说明**桌面所有平台都走 page popup**（同文件 includes :87-88 有 `color_chooser_popup_ui_controller.h`）。
3. popup 本体在渲染器内：`third_party/blink/renderer/core/page/color_page_popup_controller.{cc,h,idl}`。
4. content 层没有桌面实现：`content/public/browser/web_contents_delegate.h:482-490` 的 `OpenColorChooser` 只在 `#if BUILDFLAG(IS_ANDROID) || BUILDFLAG(IS_IOS)` 下声明（注释「The color chooser is supported/required for Android or iOS.」）；`content/browser/web_contents/web_contents_impl.cc:968-1019` 的 `ColorChooserHolder` 与 `:9294-9308` 的 `OpenColorChooser` 同样包在 ANDROID||IOS 里（`:9287-9292` 的 mojo 绑定则全平台）；`content/browser/browser_interface_binders.cc:499-504` + `:1443` 把 `blink::mojom::ColorChooserFactory` 绑到 `WebContents`。
5. //chrome 里已经没有 Views 版取色器：`api.github.com/repos/chromium/chromium/contents/chrome/browser/ui/views/color_chooser` → **404**；`chrome/browser/ui/BUILD.gn` grep `color_chooser` = 0 命中；`chrome/browser/ui/views` 目录里名字含 `color` 的只有 `color_provider_browser_helper.{cc,h}`；`ui/views`、`components` 里都没有 color chooser 目录。

**结论**：Windows/macOS/Linux 桌面上点 `<input type="color">` 弹的是 **Chromium 渲染器自己画的页内弹窗**（机制上与 `<select>`、日期选择器同族的 page popup），**不是 Windows 系统取色器，也不是 Electron 自己的对话框**。对我们的取舍有两层含义：(a) 弹窗外观不归我们管，也不随宿主的 `--dsw-*` token 走；(b) page popup 是独立的 popup widget，因此**不会被我们 overlay 面板的 `overflow`/`z-index` 裁剪**（这一点比 DOM 自绘弹层省心），但反过来它不在文档 DOM 里，**作者 CSS 管不到、测试也断言不到**。

### 3.3 控件本体的 CSS 定制能力（有挂钩，但属专有）

- 挂钩确实存在：Blink 的选择器解析表里有 `third_party/blink/renderer/core/css/parser/css_selector_parser.cc:2512-2514`：`{"-webkit-color-swatch", WebFeature::kCSSSelectorWebkitColorSwatch}`、`{"-webkit-color-swatch-wrapper", WebFeature::kCSSSelectorWebkitColorSwatchWrapper}`（带 UseCounter，典型专有特性待遇）。
- UA 样式表 `third_party/blink/renderer/core/html/resources/html.css`：`:1083-1085` `input[type="color" i] { appearance: auto; box-sizing: border-box; cursor: default; ... }`；`:1122-1124` hover 规则；`:1137` `input[type="color" i]::-webkit-color-swatch-wrapper`（`:1139` `display: -internal-auto-base(flex, contents)`）；`:1152-1154` `input[type="color" i]::-webkit-color-swatch { /* The swatch should not be affected by color scheme. */ color-scheme: only light; ... }`。→ 默认外观是 `appearance: auto`（跟平台主题走），想让它跟宿主主题一致就必须 `appearance: none` + 自绘外壳 + 给 swatch 上样式，等于**控件本体也得自己画一遍**。
- **文档化程度为零**：MDN 没有这个伪元素的页面（<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-color-swatch> 返回 404）。→ 可用，但**不可承诺**：无规范、无跨浏览器、可随 Chromium 版本变化（例如 `@supports blink-feature(AppearanceBase)` 分支已经改过一次内部布局方式，见 `html.css:987-989`、`1138-1139`）。
- 本项目另有风险：DSH 插件面板在宿主 token 体系（`--dsw-*`）内工作，而 UA 样式里 swatch 被强制 `color-scheme: only light`（`html.css:1154`），"跟主题走"这件事本身就要靠自绘绕过。

### 3.4 Electron / DSH 实况与坑

- **Electron 没有自己的取色器实现**：`shell/browser/api/electron_api_web_contents.cc` grep `OpenColorChooser` = **0 命中**；`patches/chromium/` 里也没有 color chooser 补丁。Electron 里能弹取色器，靠的就是 §3.2 的 Blink page popup 路径（也解释了为什么 `input[type=color]` 在 Electron 里"能弹但会坏"）。
- **Electron 已确认的坑**（GitHub issue 检索 `repo:electron/electron "color picker"`，共 30 条）：
  - [#38110](https://github.com/electron/electron/issues/38110)（Electron 21.6.0 / Windows，open，`platform/windows` + `bug` + `status/confirmed`）：取色器本应正常显示，但「after resizing the electron window several times it stops showing」。
  - [#49262](https://github.com/electron/electron/issues/49262)（Electron 39.2.7 / Win11，closed as not_planned）：「It works on dev/preview mode. but after dist (with electron-builder)，`<input type="color" />` will break.」→ 打包后整窗异常。
  - [#27980](https://github.com/electron/electron/issues/27980)（open，confirmed）：取色器里的吸管不能取窗口外的颜色。
  - [#33588](https://github.com/electron/electron/issues/33588)：DevTools 取色器在高对比模式下渲染错误（上游 bug，Edge 同样）；[#25352](https://github.com/electron/electron/issues/25352)：macOS DevTools 取色器不弹（已关）。
- **无头/离屏**：DSH 不是无头，也不是离屏 —— `.dsh-extract/lib/main.js:6053-6059` 用 `new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })`；`:7786-7810` welcome 窗口 `backgroundColor: "#00000000"/"#FFFFFF"` + 同套 `nodeIntegration:false / contextIsolation:true / sandbox:true`；`:9342-9352`、`:10680-10701` 另有同配置 BrowserWindow；全文件 grep 无 `offscreen`。`.dsh-extract/dsh/package.json:2-3` = `@deepseek-ai/dsh-desktop-runtime` `0.2.0-rc.2`。→ 原生控件在 DSH 里**不会**因为无头/离屏而打不开。
- **EyeDropper（吸管）在 Electron 里可用性未证实**：Electron 的 delegate 有 `OpenEyeDropper` override（`shell/browser/api/electron_api_web_contents.h:756-758`；`.cc:1179-1185` 转发），但仓库里实际存在的实现叫 `DevToolsEyeDropper`（`.cc:1646`、`:6288`），服务 DevTools 自己的取色器；Chromium 的 EyeDropper 浏览器端实现位于 //chrome 层 `chrome/browser/ui/views/eye_dropper/*`（Electron 只编 //content + //shell），而 `content/public/browser/web_contents.h` grep `EyeDropper` = 0 命中。→ 页面 JS 的 `new EyeDropper()` 在 Electron 能否用**没有实证**（BCD：chrome 95+，96 起要求 secure context，Linux Wayland 与 Android WebView 不可用）。
- **Electron 没有可从渲染器调用的原生取色 API**：`docs/api/app.md` grep `ColorPicker|showColorPicker` = 0 命中，仓库里唯一相关文档是 `docs/api/touch-bar-color-picker.md`（macOS TouchBar）；PR [#17359](https://github.com/electron/electron/pull/17359)（2019）标题 `feat: add native emoji picker`、正文 "Adds native color picker for MacOS and emoji picker for MacOS and Windows"——那个原生取色器只在**主进程 + macOS**，沙箱渲染器里的插件够不着。

### 3.5 取舍：自绘色板 vs 原生取色器

**推荐：自绘 6 色色板（+ "无颜色"）作主交互；原生 `<input type="color">` 只作可选的"自定义颜色"入口（若产品确实要）。** 理由按重要性排：

1. **限板是硬需求**（§2.5）：色板本身就是护栏 —— 用户选不出不可读的颜色。原生取色器把 77.895% 不可读的颜色摆在用户面前，必须额外做 §2.7 的校正，等于自找一层逻辑。
2. **可测 vs 不可测**：自绘色板是普通 DOM，颜色、选中态、hover/focus 都能被 DOM 断言和截图回归覆盖；原生控件的**弹窗**既不在 DOM 里（§3.2）也不是我们画的，弹窗行为（开/关/取值）基本只能靠手测。
3. **可控 vs 漂移**：原生控件默认 `appearance: auto`（`html.css:1084`）跟平台主题走，swatch 被强制 `color-scheme: only light`（`:1154`），要它跟宿主 `--dsw-*` 主题一致就得整壳自绘；而且它唯一的样式挂钩 `::-webkit-color-swatch*` 是专有且 MDN 无文档的（§3.3），Chromium 已经在 `@supports blink-feature(AppearanceBase)` 里改过一次（`html.css:987-989`、`1138-1139`）。
4. **Electron 侧有确认 bug**（#38110 窗口缩放后不再弹出；#49262 打包后整窗异常），把主交互压在一个已知会坏的控件上不划算。
5. 原生控件唯一的真实优势：弹窗是独立 widget，**不受我们 overlay 面板 `overflow`/`z-index` 裁剪**（§3.2）；以及"用户能得到完整色轮"。若产品要保留它，建议做法：视觉上 `appearance: none` + 自绘外壳（只留一个"更多颜色…"按钮触发原生 input），限定只收 `#rrggbb`（§3.1），取回后强制走 §2.7 校正，并接受弹窗不可定制、不做自动化断言。

## 4. 未证实 / gap 清单

1. `::-webkit-color-swatch{,-wrapper}` 在 **DSH 的 Electron 渲染器里实际生效性未实测**：本机没有可用的探针（`D:\dsh-plugin\dsh-prompt\node_modules` 与 `.dsh-vision-router\node_modules` 均无 playwright/puppeteer/electron；`D:\DeepseekHarness` 深度 4 内无 `electron.exe`），按 2 分钟规则放弃实测。源码层证据（§3.3）充分，运行时表现未验证。
2. **page popup 是否会被 CDP `Page.captureScreenshot` / `webContents.capturePage()` 捕获未证实**（推断：不捕获，因为它是独立 popup widget 而非页面图层）。这条只影响"截图回归怎么覆盖取色器"，不影响 §3.5 的取舍。
3. **Electron 里页面 JS 的 `new EyeDropper()` 是否可用未证实**（§3.4），`#27980` 表明 Electron 里**控件弹出的取色器内部**那个吸管是有的、且不能取窗口外颜色。
4. **`paint-order: stroke fill` 对 HTML 文本的支持未查**（影响"描边画在填充之下、不啃字形"的实现方式；与颜色判据无关）。
5. **13.3px/600、14.3px/700 未在仓内复核**（§2.2）；判据对字号不敏感（两者都是"普通文本"，见 §1.2），但若将来字号升到 ≥18.66px/700，AA 门槛会降到 3:1，届时 T3 恰好就是 AA。
6. **未做色觉缺陷（CVD）模拟**：六色在 protan/deutan/tritan 下的两两可分性未验证。这是有意的取舍——SC 1.4.1 的正解是"颜色不能是唯一通道"，我们的模板名文字本身就承载语义（§1.6），所以不把 CVD 可分辨性当门槛；但若产品想让"颜色"独立承担区分，必须补做。
7. 本会话的 `web_search` 工具不可用（"DeepSeek search has no API key"），所有外部事实均为按 URL 直接取回的一手页面/源码；未使用二手汇总站。

## 5. 来源清单（每个主张的落点）

WCAG 2.2（W3C 一手）：

1. SC 1.4.3 Understanding（4.5:1 / 大字 3:1 / 例外 / Note 3 背景归属 / Note 5 描边 / 不四舍五入 / relative luminance 与 contrast ratio 公式）— <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
2. SC 1.4.11 Understanding（3:1 against adjacent color(s)、UI component 与 graphical object 的范围、Boundaries、与 1.4.1 的关系及 G183）— <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
3. SC 1.4.1 Understanding（"color is not the only visual means"、亮度差 ≥3:1 的定量 Note、G14/G182/G183/G205、F13/F73/F81）— <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>

Chromium 源码（`main` 分支 raw）：

4. `<input type=color>` 实现、值校验、shadow pseudo id、用户激活要求 — `third_party/blink/renderer/core/html/forms/color_input_type.cc`
5. 桌面走 page popup（`NOTREACHED() << "Page popups should be enabled on all but Android or iOS"`）— `third_party/blink/renderer/core/page/chrome_client_impl.cc:802-822`（includes :87-88）
6. page popup 本体 — `third_party/blink/renderer/core/page/color_page_popup_controller.{cc,h,idl}`
7. 专有伪元素选择器 — `third_party/blink/renderer/core/css/parser/css_selector_parser.cc:2512-2514`
8. UA 样式（`appearance: auto` / swatch 与 wrapper 规则 / `color-scheme: only light`）— `third_party/blink/renderer/core/html/resources/html.css:987-989,1083-1085,1122-1124,1137-1139,1152-1154`
9. content 层只有 Android/iOS 实现 — `content/public/browser/web_contents_delegate.h:482-490`；`content/browser/web_contents/web_contents_impl.cc:968-1019,9287-9308`；`content/browser/browser_interface_binders.cc:499-504,1443`
10. //chrome 无 Views 版取色器（目录 404、BUILD.gn 0 命中）— `https://api.github.com/repos/chromium/chromium/contents/chrome/browser/ui/views/color_chooser`、`chrome/browser/ui/BUILD.gn`、`chrome/browser/ui/views/` 目录列举
11. EyeDropper 实现位于 //chrome — `chrome/browser/ui/views/eye_dropper/*`（GitHub contents 列举）

MDN / BCD（一手数据）：

12. BCD `input/color`：`type_color` chrome 20+、`accepts_css_colors` chrome `version_added: false` + crbug 416245392 — <https://raw.githubusercontent.com/mdn/browser-compat-data/main/html/elements/input/color.json>
13. BCD `EyeDropper`：chrome 95+、96 起要求 secure context、Linux Wayland / Android WebView 不可用 — <https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/EyeDropper.json>
14. MDN `input[type=color]`（外观随平台大幅变化、`select()` 在取色器 UI 下无效、值须为 7 位小写 hex）— <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color>
15. MDN 无 `::-webkit-color-swatch` 页面（HTTP 404）— <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-color-swatch>

Electron：

16. 无取色器实现（`OpenColorChooser` 0 命中）— `shell/browser/api/electron_api_web_contents.cc`；`patches/chromium/` 目录列举
17. EyeDropper delegate override 与 `DevToolsEyeDropper` — `shell/browser/api/electron_api_web_contents.h:756-758`；`shell/browser/api/electron_api_web_contents.cc:1179-1185,1646,6288`
18. 无渲染器可调的原生取色 API — `docs/api/app.md`（0 命中）、`docs/api/touch-bar-color-picker.md`、<https://github.com/electron/electron/pull/17359>
19. 已确认坑 — <https://github.com/electron/electron/issues/38110>、<https://github.com/electron/electron/issues/49262>、<https://github.com/electron/electron/issues/27980>、<https://github.com/electron/electron/issues/33588>、<https://github.com/electron/electron/issues/25352>

本仓：

20. 宿主色值 — `.dsh-extract/theme-css/design_platform_css_default.pretty.css:51,66,67,69,155,159-161,269`；`.dsh-extract/theme-css/gradient_shadow_text_css_default.pretty.css:15`
21. DSH Electron 实况 — `.dsh-extract/lib/main.js:6053-6059,7786-7810,9342-9352,10680-10701`；`.dsh-extract/dsh/package.json:2-3`
22. 体例参照 — `research/host-vs-plugin-h2-fontui.md`
