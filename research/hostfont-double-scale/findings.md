# issue #160 复核：远程档位下插件自家面字号「乘两遍」

**调查性质**：只读复核（未修改 `src/`、`lib/`、`package.json`，无 commit / publish）。
**证据等级**：链条三步「源码逐行核实」= 读文件；`126px` 数值 = **真实 Chromium 实测**（`--dump-dom` 取 `getComputedStyle` 结果 + 海报截图 OCR 双通道互证）。

---

## 一句话裁定

**属实（数值与链条三步全部复现，5 档 = 126px）**；仅两处用词不准确：①「入口按钮」不在双倍名单里（入口条吃绝对 px，实测只放大一遍 = 36px；真正双倍的是同文件的齿轮弹窗卡根）；② 5 个双倍落点中只有 2 个真正走 `scaledBaseFontSize()`（`settings.ts:649`、`panel.ts:1364`），另外 3 个是手写的同式表达式。「非 #148 引入、#148 使其常驻」= **属实**（实测对照见第三节）。

---

## 一、数值表（真实 Chromium，`getComputedStyle` 原值）

宿主用户设定 = 宿主设置里的「字号大小」（默认 14px，宿主允许 10–22px）。

| 场景 | 宿主内容字 | **插件自家面根（实测）** | 入口条（对照，实测） | 算式 |
|---|---|---|---|---|
| 关闭远程（宿主用户设定 14px） | 14px | 14px | 12px | 1 × 14 |
| 远程 1 档（覆盖 14px !important） | 14px | 14px | 12px | 1 × 14 |
| **远程 5 档（覆盖 42px !important）** | **42px** | **126px** | **36px** | 3 × 14 = 42，再 × 3 = **126px** |
| 远程 10 档（覆盖 77px !important） | 77px | **423.5px** | 66px | 5.5 × 14 = 77，再 × 5.5 = 423.5px |
| 远程 5 档 + 宿主用户设定 22px | 42px | 126px | 36px | 自家面**完全无视宿主用户设定**（应 66px） |
| 关闭远程 + 宿主用户设定 22px | 22px | 22px | 12px | 1 × 22 |

- 「自家面根」= `calc(var(--dsw-font-markdown-base-font-size) * 档位倍数)`。探针逐字复刻了 4 个落点的表达式并全部实测同值：设置页根（`settings.ts:649`）、面板 compact 根（`panel.ts:1359`）、智能卡根（`smart.ts:350`）、齿轮弹窗卡根（`button.ts:403`）。（第 5 个落点 `panel.ts:1364` 与设置页根同走 `scaledBaseFontSize()`，表达式相同。）
- **「入口条」对照证明不是所有自家面都中招**：`button.ts:440` 走 `12 * entryFontScale`（绝对 px），5 档实测 **36px = 12 × 3，只放大一遍** —— issue 把「入口按钮」列进双倍名单不准确。
- **#92 不退化**：宿主内容字 14 → 42（5 档，×3）、21（2 档，×1.5）、77（10 档，×5.5），严格等比，一遍。
- 5 档时自家面 126px **正好是宿主内容字 42px 的 3 倍** —— 这是「乘两遍」的直接指纹。

## 二、链条三步 · 逐环节 file:line 证据

### ① 插件覆盖 `--dsh-content-font-size` = `hostContentFontPx(5)` = 42px

- `src/client/remoteView.ts:132`
  `export const REMOTE_SIZE_SCALES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]` → 5 档倍数 = **3**
- `src/client/remoteView.ts:167-171` `hostContentFontPx()`：`return Math.round(remoteSizeScale(size) * 14)` → `round(3 × 14)` = **42**
- `src/client/hostfont.ts:43` `const HOST_CONTENT_FONT_VAR = '--dsh-content-font-size'`
- `src/client/hostfont.ts:91-92`
  `const px = hostContentFontPx(size) + 'px'` /
  `applyOwnedStyle(doc, HOST_FONT_STYLE_ID, 'body{' + HOST_CONTENT_FONT_VAR + ':' + px + ' !important;}')`
  → 落盘 CSS 逐字为 `body{--dsh-content-font-size:42px !important;}`（`scripts/test-issue-148.cjs` R4/R6 独立断言过同一字串）
- 宿主侧被压住的对手是**普通优先级的行内声明**：`dsh-client-ui-layout/lib/client.js:539`
  `body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, \`${snapshot.fontSize}px\`)`（`CONTENT_FONT_SIZE_VARIABLE` 定义在 `:511`）。
  作者 `!important` > 行内普通声明 ⇒ 覆盖成立。宿主这份主题 bundle（11719 字节原文）内 **`@layer` 0 命中、`@import` 0 命中**，不存在「分层 important 反压」。

### ② 宿主派生 `--dsw-font-markdown-base-font-size` 变成 42px

- `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:1160`（单行 11763 字符的 `var gradient_shadow_text_css_default = "..."`，解码后 11719 字节，与 `.dsh-extract/theme-css/gradient_shadow_text_css_default.css` **逐字节一致**，由 `build-probe.mjs` 每次生成时校验）内含该变量唯一声明：
  `--dsw-font-markdown-base-font-size:var(--dsh-content-font-size,14px);`
- 该表挂 head 的方式：同文件 `:1181-1193 installThemeStyles`
- **实测**：`getComputedStyle(document.body).getPropertyValue('--dsw-font-markdown-base-font-size')` = `42px`（5 档）/ `14px`（关、1 档）/ `77px`（10 档）。

### ③ 自家面 `scaledBaseFontSize()` 再乘一次档位

- `src/client/remoteView.ts:141` `const BASE_FONT_VAR = 'var(--dsw-font-markdown-base-font-size)'`
  （`:140` 注释：「宿主基准字号变量（缩放根的唯一锚点；各调用方不得另起第二套基准）」）
- `src/client/remoteView.ts:149-151`
  `if (enabled !== true) return BASE_FONT_VAR` / `return 'calc(' + BASE_FONT_VAR + ' * ' + remoteSizeScale(size) + ')'`
- **`src/client/remoteView.ts:143-147` 的注释是本次调查最讽刺的一处**（原文）：
  > `缩放根收敛点（#116，不计成本的一致性收敛；纯函数，可转译断言）：开吃全额 calc(宿主基准变量 * 档位倍数)、关回基准变量。各调用方只传开关与档位，不手写表达式，防多处拷贝漂移。注意：设置页子树内必须用宿主变量基重算，禁用 1em 基——1em 在缩放祖先里会复乘（double-scale）。`
  → #116 明确**为了躲开 `1em` 引发的一种 double-scale**，改用了「宿主变量基重算」；但它把「宿主变量」理解成了静态基准，而 `--dsw-font-markdown-base-font-size` 在 #92 开启后是**动态派生值**。躲开了一种复乘，制造了另一种 —— 这是归属主张「#116 的基准锚决策有问题」的直接文本证据。

**关键分辨（「乘两遍」的本体）**：`BASE_FONT_VAR` 指的**不是**宿主用户的设定值，而是**被插件自己覆盖之后**的派生值。
`--dsh-content-font-size`（插件写 42px） → `--dsw-font-markdown-base-font-size`（宿主派生 = 42px） → ×3 = 126px。
两遍乘的是**两个不同的量**：第一遍在 `hostContentFontPx()`（`round(3×14)`），第二遍在 `scaledBaseFontSize()`（`× 3`）；但**它们都是同一个「档位倍数 3」，且第二遍的基数已经完全包含第一遍**。所以用户的档位被计入两次。

5 个消费落点（全部实测同值）：

| 落点 | file:line | 表达式 |
|---|---|---|
| 设置页根 | `src/client/settings.ts:649` | `scaledBaseFontSize(remote.enabled, remote.size)` |
| 设置页折叠小列表 | `src/client/panel.ts:1364` | `scaledBaseFontSize(remotePrefs.enabled, remotePrefs.size)` |
| 面板 compact 浮层根 | `src/client/panel.ts:1333,1359` | `'calc(var(--dsw-font-markdown-base-font-size) * ' + uiFontScale + ')'`（**手写同式，未走 helper**） |
| 智能卡根 | `src/client/smart.ts:205,350` | `'calc(var(--dsw-font-markdown-base-font-size) * ' + smartFontScale + ')'`（**手写同式**） |
| 齿轮弹窗卡片根 | `src/client/button.ts:403` | `'calc(var(--dsw-font-markdown-base-font-size) * ' + remoteSizeScale(remote.size) + ')'`（**手写同式**） |

**不在名单里的（对 issue 措辞的修正）**：
- **入口条 / Dock**：`src/client/button.ts:440` `fontSize: 12 * entryFontScale`、`:716` `fontSize: 12 * entryFontScale`、`:436` padding、`:484` `gearBox = 26 * entryControlScale` —— 全是**绝对 px × 倍数**，与 markdown 基准 var 无关 ⇒ 5 档**实测 36px（= 12 × 3），只放大一遍**。issue 把「入口按钮」列入双倍名单不准确（真正双倍的是同一个文件里的**齿轮弹窗卡根** `button.ts:403`）。
- 另 4 处 `calc(1em * uiScale)`（`panel.ts:822-823`、`panel.ts:977-978`、`picker.ts:570,575`、`remoteInputSheet.ts:39,42`）以继承的 body 字号为基，同样只放大一遍。

**为什么自家面会被宿主变量影响**：插件全程无 shadow DOM / iframe（`attachShadow|shadowRoot|createElement('iframe')|contentWindow` 在 `src/` 零命中），自家 UI 就在 `document.body` 子树里，自定义属性按继承链传到自家根。

## 三、第三分句「非 #148 引入，但 #148 使它从自限变成常驻」—— 实测对照

`probe-148-persistence.html`（真实 Chromium，逐字复刻两种机制 + 宿主重放）：

```
===== A. 旧实现（#148 之前：documentElement + body 行内双写） =====
  A1 插件双写 42px            own=126px  mdBase=42px  bodyVar=42px
  A2 宿主重放 14px 之后        own=42px   mdBase=14px  bodyVar=14px   ← 被打回
  A3 宿主再重放 22px           own=66px   mdBase=22px  bodyVar=22px
  A4 旧实现关闭(removeProperty) own=42px   mdBase=14px  bodyVar=（空）

===== B. 新实现（#148：body{var:42px !important}） =====
  B1 插件覆盖 42px !important  own=126px  mdBase=42px  bodyVar=42px
  B2 宿主重放 14px             own=126px  mdBase=42px  bodyVar=42px   ← 压住了
  B3 宿主再重放 22px           own=126px  mdBase=42px  bodyVar=42px
  B4 摘掉自家段               own=66px   mdBase=22px  bodyVar=22px
  宿主行内（B4） = 22px  ← 全程未被插件改过
```

- **非 #148 引入**：属实。旧实现（`git 47d58d3:src/client/hostfont.ts:36-46` 取 `documentElement` + `body` 两个 style 对象、`:80-84` 逐个 `st.setProperty(HOST_CONTENT_FONT_VAR, px)`）同样让派生链取到 42px，A1 实测 126px。#116 的引入提交 `4a3a2e1` / `5128b8b`（均 2026-10-05，release 0.2.11）远早于 #148 的 `9ecd0c3`（2026-10-14）。
- **#148 使其常驻**：属实，但需精确表述：**旧实现也不是「从不 126」**，而是「写完之后到宿主下一次 `theme/change` 重放之间同样 126px」（A1），宿主一重放就被打回 42px（A2）。新实现位于级联上位，宿主重放压不住（B2/B3），所以整段会话停在 126px。
- 附：A4 的 `bodyVar=` 空值正是 #148 修掉的那个缺陷（旧实现关闭态 `removeProperty` 删掉宿主权威通道）；B4 显示新实现全程零宿主写入 —— 即 **#148 本身是对的，它只是让 #160 从「事件可清」变成「永不自动清」**。

## 四、旧探针保真度复核（`research/probe-hostfont-cascade.html`）

先读懂再复跑。结论：**P9 的模拟是忠实的（在该场景内）**，可采信。

- 它把宿主派生链**缩减为 3 个变量**（`--dsh-content-font-delta` / `-delta-secondary` / `--dsw-font-markdown-base-font-size`）写在一条 `body{}` 规则里，与宿主 bundle 原文同形（只少了无关声明）。
- 宿主写入走 `body.style.setProperty(...)`（普通优先级行内），与 `dsh-client-ui-layout/lib/client.js:539` 同形。
- P9 用 `hostApply('14px')`（宿主用户默认 14）+ `pluginApply('42px')` + `.ownsurface{font-size:calc(var(--dsw-font-markdown-base-font-size) * 3)}`，与 5 档真实算式**逐字同构**。
- **两点保真度局限**（不影响 P9 结论，但限制了它的覆盖面）：① 乘数 `* 3` 是**硬编码**的，没有从 `REMOTE_SIZE_SCALES` 派生；② 只测 5 档，没有 1 档/关档/10 档。
- 复跑结果（真实 Chromium，`evidence/probe-hostfont-cascade.out.txt`）：`#148 probe: ALL PASS`，`P0`–`P8` 全 PASS，`NOTE P9 自家面复乘（5 档：42px × 3）got="126px"` —— **与 issue 的引用逐字一致**。

## 五、复现方式与命令

```powershell
# 0) 前置：仓库根目录，Node 可用
# 1) 生成三个探针（宿主规则从 asar 原文注入，生成时逐字节校验；不一致直接报错退出）
node research\hostfont-double-scale\build-probe.mjs
# 2) 真实浏览器实跑并落盘证据
pwsh -NoProfile -File research\hostfont-double-scale\run-probes.ps1
#    -> research\hostfont-double-scale\evidence\*.out.txt
# 3) 给人看的可视化（同样现算，非手抄）
#    research\hostfont-double-scale\poster-double-scale.html  ← 截图即 evidence/poster.png
```

- 「真实浏览器」= 本机 `C:\Program Files\Google\Chrome\Application\chrome.exe --headless=new --dump-dom`。**注意**：chrome.exe 是 GUI 子系统程序，PowerShell 直接 `& chrome` 抓不到 stdout，必须 `Start-Process -RedirectStandardOutput` 重定向到文件（`run-probes.ps1` 已封装）。
- 数值**不靠 OCR 读**：`--dump-dom` 直接给出探针页里 `getComputedStyle` 的文本结果（真实 JS 求值）。另有第二通道：`poster-double-scale.html` 经 `vision_html_screenshot`（另一次真实 Chrome 渲染）+ `vision_ocr` 读出同一组 `14/14/42/126/77/423.5/22`。
- 回归脚本实跑（均 exit 0，与本次调查的零改动一致）：`test:issue-116`、`test:issue-82`、`test:issue-83`、`test:issue-123`、`test:issue-148`、`test:issue-146`。

**产物清单**：`build-probe.mjs`（生成器，从 asar + src 抽真值）、`run-probes.ps1`（跑 + 落盘）、`probe-double-scale.html`（主探针，7 场景）、`probe-148-persistence.html`（#148 前后对照）、`poster-double-scale.html`（可视化）、`evidence/`（实跑原文）。

## 六、修法方向（只给方向与落点，未改任何代码）

**根因一句话**：自家面的缩放**基数**选错了量。`BASE_FONT_VAR` 指向的是「**插件覆盖之后**宿主派生出来的值」，这个值**已经含了一整遍档位**；再乘一次档位就是平方。

### 候选 A（推荐）：自家面直接消费宿主那个变量本身，不再乘

- 落点：`src/client/remoteView.ts:141` `BASE_FONT_VAR` 由 `'var(--dsw-font-markdown-base-font-size)'` 改为 `'var(--dsh-content-font-size, 14px)'`，并让 `scaledBaseFontSize()`（`:149-152`）**不再乘倍数**（开/关都返回该 var）。
- 为什么成立：该变量在**两种状态下都已经是对的目标值** —— 远程开 = 插件覆盖的 `hostContentFontPx(size)`（42px，已含档位）；远程关 = 宿主用户设定值（14/22px）。改完自动满足验收标准的四条：5 档 = 宿主内容字（同级）、1 档 = 宿主用户设定、关档 = 宿主用户设定、宿主内容字照旧等比（不碰 #92）。
- 附带好处：`remoteView.ts` 保持纯函数（`:144` 注释自述「纯函数，可转译断言」），不需要破例去读 DOM。
- 风险 / 需要一并改的：5 个落点里 `panel.ts:1359`、`smart.ts:350`、`button.ts:403` 是**手写同式**（不走 helper），必须同改，否则会留下第三种写法（`scripts/test-issue-123.cjs:97` 正是防这个的正则，改 var 名时别漏）。
- **一处口径张力必须在实现前拍板**：issue 验收标准同时写了「5 档自家面 = 5 档倍数 × **宿主用户设定值**」和「5 档自家面与宿主内容字同级」。当宿主用户设定 ≠ 14px 时这两条**互相冲突**（例：设定 22px、5 档 → 「倍数×设定值」= 66px，而宿主内容字 = `round(3×14)` = 42px）。方案 A 取「同级」（42px）。若用户真要「倍数×设定值」，那要改的是 `hostContentFontPx()` 的 14px 硬基线（属 #92 机制，本票 out of scope），否则自家面会**比宿主正文还大**。

### 候选 B（最小改动）：把「宿主用户设定值」镜像成插件自有变量

- 落点：`src/client/hostfont.ts`（覆盖段旁边）**只读**地取 `doc.body.style.getPropertyValue('--dsh-content-font-size')`，再发布 `body{--dsh-prompt-host-user-font:<n>px !important}`；`remoteView.ts:141` 的 `BASE_FONT_VAR` 改指该插件自有变量，乘倍数逻辑保留。
- 好处：`scaledBaseFontSize()` 的现有形状与 `scripts/test-issue-116.cjs` 的断言结构几乎不动（只换 var 名），自家面语义 = 「档位 × 宿主用户设定值」，字面贴合 issue 验收标准第一条。
- 风险：① 需要读宿主行内样式，与 #148 立下的「插件永不读写宿主行内样式」纪律相悖（**读**不是 #148 要禁的**写**，但 `scripts/test-issue-148.cjs` R1 的源码契约与注释口径要重新表述）；② 宿主行内不存在时（首屏早于宿主 apply）要 fail-soft 回 14px；③ 一帧竞态。

### 无论走哪条，必须同步修的回归脚本（这些脚本目前**把缺陷锁成了期望值**）

| 脚本:行 | 现状断言 | 影响 |
|---|---|---|
| `scripts/test-issue-116.cjs:19` | `const BASE_VAR = 'var(--dsw-font-markdown-base-font-size)'` | 锚点常量，直接要改 |
| `scripts/test-issue-116.cjs:68,72,96,122,136-142` | 断言 `'calc(' + BASE_VAR + ' * 5.5)'` 等形状 | 候选 A 下全部要改写 |
| `scripts/test-issue-82.cjs:379` | `settingsRootOn.fontSize !== 'calc(var(--dsw-font-markdown-base-font-size) * 5.5)'` | 同上 |
| `scripts/test-issue-82.cjs:383` | 关时落 `'var(--dsw-font-markdown-base-font-size)'` | 同上 |
| `scripts/test-issue-123.cjs:97` | `/scaledBaseFontSize/.test(sheetSrc) && /calc\(var\(--dsw-font-markdown-base-font-size\)/` 判「第二套缩放根」 | 正则要跟着换 var 名，否则**修完反而判红** |
| `src/client/hostfont.ts:32-36` 头注 | 自认 126px 的已知交互说明 | 修完须改写，否则注释撒谎 |

另外建议新增断言（回答放宽的验收标准）：把「自家面根 fontSize === 宿主内容字 fontSize」写成一条**行为断言**（起一个 DOM 桩，开 5 档后比较两者 computed 值），比现在锁定字符串形状的写法更能防回归 —— 因为本缺陷正是「形状对、语义错」。

## 七、未核实项 / 证据边界

1. **未在真实 DSH 应用里跑**：所有数值来自真实 Chromium + 从 asar 原文注入的宿主规则与插件源码逐字复刻的探针，**不是**在运行的 DSH GUI 里测的。未复刻的部分只有宿主 React 树形（对自定义属性继承无影响）。
2. **宿主 React 树形/挂载顺序未复刻**：宿主 `installThemeStyles` 与 `ThemePresenter.apply` 的真实时序未逐步验证；由于自定义属性继承与声明顺序无关（重要声明压普通声明），判断为不影响结论。
3. **未验证宿主是否会主动覆盖插件段**：宿主若将来改用 `!important` 写行内（旧探针 P8 的「优雅降级」场景），覆盖会失效、自家面会回落到「倍数 × 宿主用户设定值」的**单遍**值 —— 那是另一个方向的风险，本次未追。
4. **版式类副作用未测**：126px 下的卡片换行、命中区、溢出等后果（`button.ts:397-399` 注释提到的 `fit-content` 自适应）本次只测了字号，未测版式。
5. **`lib/` 产物未核对**：仓库 `lib/` 是构建产物，本次只对着 `src/` 读源码并跑脚本；未验证 `lib/` 里 bundle 与 `src/` 一致（`npm run test:lib-sync` 未跑）。
6. **未跑 `npm run typecheck`**：本次零代码改动，跑它对本裁定无增量；`test:*` 已跑 6 个与本链路直接相关的（全绿）。
