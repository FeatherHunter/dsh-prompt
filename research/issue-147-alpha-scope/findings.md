# issue #147：故障是否只和 0.2.1-alpha.1（alpha 线）有关 —— 只读取证

> 范围声明：本报告只做只读取证，不给修复结论，不改业务代码、不改 `package.json`、不关闭票、不动 issue 标签。
> 每个结论后标注 **【已坐实 / 推断 / 未取到】** 并给出源（文件路径+行，或命令+输出，或 URL）。
> 调研对象：`dsh-prompt@0.4.13`（本仓当前版；issue 报的是 `0.4.9`，但依赖声明未变，见 §1）。
> 取证时间：2026-10-11（UTC+8）。registry 取数走 `npm view`（默认源，实测落到 npmmirror 镜像）。

---

## 0. 问题与口径（背景，不做判定）

- issue #147 标题：【BUG】依赖声明把 DSH 运行时包 `@deepseek-ai/dsh-storage-domain` 装进 profile，导致 CLI 0.2.1 线插件 pending。状态 OPEN，标签 `bug + ready-for-agent`。**【已坐实】** 源：`gh issue view 147 --json title,body,labels,state`（本机实跑，输出见取证过程；body 全文与 triage 引用一致）。
- 报告人自述（第三方用户 `wqzhellohhwy`）：全局 CLI `@deepseek-ai/dsh 0.2.1-alpha.1` 下 `web` profile 若干插件 pending / 被安全机制禁用；同一 profile 在桌面版 `dsh-desktop 0.2.0-rc.2` 下正常；`npm ls` 显示 `dsh-prompt@0.4.9 → @deepseek-ai/dsh-storage-domain@0.2.0-rc.2` 为传递依赖。**【已坐实：报告人如此陈述】** 源：issue body §Actual/根因/复现三节（同上命令输出）。注意：这是报告人的陈述，不是本次复现——本次无 CLI 真机（见 §6）。
- 维护者口径（triage 代记，共 3 条 AI-triage 评论）：(1) 本插件尚未兼容 alpha 线；(2) 先不收敛结论，已起后台 `/research` 专核“是否只和 0.2.1-alpha.1 有关”，结论以调研落盘为准，在此之前不断言影响范围；(3) 欢迎适配 `0.2.1-alpha.1` 的 PR。**【已坐实：口径如此记录】** 源：同上 `gh issue view 147` 的 `comments[1..3]`（`2026-10-11T08:09/08:11/08:15Z` 三条）。
- 本报告要回答的唯一问题：**上述 peer 硬冲突是否只在 alpha 线（宿主 `0.2.1-alpha.1`，自带 storage-domain `0.2.1-alpha.1`）下成立**，还是存在除 alpha 外同样会爆的版本组合。

---

## 1. 本仓声明与锁文件（profile 里多装一份的来源）

| # | 事实 | 结论分级 | 源 |
|---|---|---|---|
| 1.1 | `dependencies` 含 `"@deepseek-ai/dsh-storage-domain": "^0.2.0-rc.2"` | 【已坐实】 | `package.json:124`；`package-lock.json:12` 同值 |
| 1.2 | 锁文件落到 `0.2.0-rc.2`（`resolved https://registry.npmmirror.com/.../dsh-storage-domain-0.2.0-rc.2.tgz`），其 `peerDependencies` 为 `cordis ~4.0.4` + `dsh-invariants 0.2.0-rc.2`（精确）+ `dsh-storage 0.2.0-rc.2`（精确） | 【已坐实】 | `package-lock.json:83-96` |
| 1.3 | 同锁文件：`dsh-invariants@0.2.0-rc.2` peer `cordis ~4.0.4`（`:60-71`）；`dsh-storage@0.2.0-rc.2` peer `cordis ~4.0.4`（`:73-81`）；`cordis` 本体 `4.0.4`（`:28-31`） | 【已坐实】 | `package-lock.json:28-81` |
| 1.4 | issue 报 `0.4.9` vs 本仓 `0.4.13` 的声明一致（本报告仍适用）：当前版声明如 1.1，且 triage 已核“依赖声明未变” | 【已坐实】 | `package.json:2-3`（`version 0.4.13`）+ `package.json:124`；issue triage comment（`gh issue view 147` comments[1]“当前 0.4.13 … 依赖声明未变”） |
| 1.5 | `dsh.engines.dsh = >=0.2.0-rc.2`（仅说明、不拦安装），README 基线为 DSH CLI `0.2.0-rc.2` · Desktop `2.0.9` | 【已坐实】 | `package.json:103-105`；`README.md:105-114`；`docs/README.en.md:105-108` |

---

## 2. 版本矩阵实测：`^0.2.0-rc.2` 能落到谁身上

### 2.1 规范依据（primary source）

- `^0.2.0-rc.2` 按 caret 规则脱糖为 `>=0.2.0-rc.2 <0.3.0-0`（0.x 线以 minor 为 breaking 位）。**【已坐实】** 源：`https://raw.githubusercontent.com/npm/node-semver/main/README.md` §Caret Ranges（`^0.2.3 := >=0.2.3 <0.3.0-0`；含 prerelease 的例子 `^1.2.3-beta.2 := >=1.2.3-beta.2 <2.0.0-0` 并注明“只有同 `[major,minor,patch]` tuple 的 prerelease 才放行”）。
- prerelease 同 tuple 规则原文：“If a version has a prerelease tag … it will only be allowed to satisfy comparator sets if at least one comparator with the same `[major, minor, patch]` tuple also has a prerelease tag.”`^0.2.0-rc.2` 的 comparator 集里只有 `[0,2,0]` 带 prerelease，因此 `[0,2,1]` 的 prerelease（`0.2.1-alpha.x`）默认被排除；`includePrerelease` 可关闭该行为，但那是调用方显式 opt-in，不是 npm 安装的默认语义。**【已坐实】** 源：同上 README §Prerelease Tags（含 `includePrerelease` 说明）+ §Functions（`includePrerelease` 默认为 false）。
- Tilde 规则：`~4.0.4 := >=4.0.4 <4.1.0-0`；`~4.0.5-alpha.1 := >=4.0.5-alpha.1 <4.1.0-0`，且“`1.2.4-beta.2`（不同 tuple）不被 `~1.2.3-beta.2` 放行”。**【已坐实】** 源：同上 README §Tilde Ranges。

### 2.2 实测（本机 `npx -y semver <ver> -r <range>`，即 node-semver 可执行形态；无 `-p` = npm 默认语义）

命令与输出（逐条实跑，`Select-Object` 截断外原文保留）：

```
# A 组：^0.2.0-rc.2（默认语义）
0.2.0-rc.2 MATCH(default)        # npx -y semver 0.2.0-rc.2 -r '^0.2.0-rc.2' 回显自身
0.2.0      MATCH(default)
0.2.1      MATCH(default)        # 未来正式版若存在，可落入
0.2.1-alpha.1 NO-MATCH(default)  # 回显空
0.2.1-alpha.2 NO-MATCH(default)  # 回显空
# B 组：边界
0.2.0-rc.1 NO-MATCH              # 低于下界
0.1.5-rc.2 NO-MATCH              # 不同 minor 线
0.2.0-rc.3 MATCH                 # 同 tuple、更大的 prerelease，放行（符合“>=beta.2 则 beta.4 放行”例）
0.3.0      NO-MATCH              # 到上界（含 0.3.0-0 下界比较），被上界拦下
0.2.0-rc.2 MATCH
```

| 候选版本 | `^0.2.0-rc.2`（npm 默认语义） | 分级 |
|---|---|---|
| `0.2.0-rc.2` | ✅ 落入 | 【已坐实】命令输出 + §2.1 规则 |
| `0.2.0`（正式版，registry 尚无，见 §2.3） | ✅ 落入 | 【已坐实】命令输出（版本存在即落入；存在性见 §2.3） |
| `0.2.1`（未来正式版，registry 尚无） | ✅ 落入 | 【已坐实】命令输出（同上） |
| `0.2.1-alpha.1` | ❌ 排除（不同 tuple 的 prerelease） | 【已坐实】命令输出 + §2.1 同 tuple 规则 |
| `0.2.1-alpha.2` | ❌ 排除 | 【已坐实】命令输出 |
| `0.2.0-rc.1` / `0.1.5-rc.2` | ❌（低于下界 / 不同线） | 【已坐实】命令输出 |
| `0.2.0-rc.3`（假想同 tuple 后续 rc） | ✅ | 【已坐实】命令输出 |
| `0.3.0` | ❌（上界） | 【已坐实】命令输出 |

### 2.3 反事实对照：`-p`（`--include-prerelease`）下全员 MATCH，但与 npm 安装无关

```
# 同 A 组加 -p：
0.2.0-rc.2 / 0.2.0 / 0.2.1 / 0.2.1-alpha.1 / 0.2.1-alpha.2 全 MATCH(includePrerelease)
```

- 该对照仅证明“排除来自 prerelease 默认规则而非比较大小”。npm 安装 resolver 不设全局 `includePrerelease`（见 §2.1），因此 **不得用 `-p` 结果论证“区间本可装上 alpha”**。**【已坐实】** 源：上条命令输出 + README §Functions（`includePrerelease` 默认 false）。
- 报告人表格（`0.2.0-rc.2 ✅ / 0.2.0 ✅ / 0.2.1 ✅ / 0.2.1-alpha.1 ❌`）与本节实测逐项一致。**【已坐实】** 源：issue body 根因节表格 vs 本节 A 组输出。

### 2.4 registry 现状（`npm view` 实跑，2026-10-11）

- `@deepseek-ai/dsh-storage-domain` 版本全集（`npm view ... versions --json`）：`0.0.1-rc.1 … 0.2.0-rc.1, 0.2.0-rc.2, 0.2.1-alpha.1, 0.2.1-alpha.2`，共 31 个；**无 `0.2.0` 正式版、无 `0.2.1` 正式版、无 `0.3.x`**。dist-tags：`latest 0.0.1-rc.1 / next 0.2.0-rc.2 / alpha 0.2.1-alpha.2`。**【已坐实】** 源：上述命令输出 + `npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.1 --json` 的 `versions/time/dist-tags` 节。
- `@deepseek-ai/dsh`（宿主）版本全集与上一条**完全同构**（同 31 个，无正式版）。**【已坐实】** 源：`npm view @deepseek-ai/dsh versions --json`。
- `@deepseek-ai/cordis` 版本全集：`4.0.1-rc.1, 4.0.1-rc.4, 4.0.1, 4.0.2, 4.0.3, 4.0.4, 4.0.5-alpha.1`；**无 `4.0.5` 正式版**。**【已坐实】** 源：`npm view @deepseek-ai/cordis versions --json`。
- `@deepseek-ai/dsh-storage` 与 storage-domain 同构（含 `0.2.1-alpha.1/alpha.2`）；**`@deepseek-ai/dsh-invariants` 停在 `0.2.0-rc.2`，无任何 `0.2.1-alpha.x`**（输出 29 个，末位 `0.2.0-rc.2`）。**【已坐实】** 源：`npm view @deepseek-ai/dsh-storage versions` / `npm view @deepseek-ai/dsh-invariants versions`。

---

## 3. peer 冲突链（alpha 线为何爆）

### 3.1 两端的声明（registry primary source）

| 端 | 版本 | peerDependencies | 源 |
|---|---|---|---|
| profile 侧副本 | `dsh-storage-domain@0.2.0-rc.2` | `cordis ~4.0.4`、`dsh-storage 0.2.0-rc.2`（精确）、`dsh-invariants 0.2.0-rc.2`（精确） | 【已坐实】`npm view @deepseek-ai/dsh-storage-domain@0.2.0-rc.2 peerDependencies --json` + `package-lock.json:92-96`（逐字一致） |
| 宿主侧（alpha.1） | `dsh-storage-domain@0.2.1-alpha.1` | `cordis ~4.0.5-alpha.1`、`dsh-storage 0.2.1-alpha.1`（精确）；**无 `dsh-invariants` 项** | 【已坐实】`npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.1 peerDependencies --json` |
| 宿主侧（alpha.2） | `dsh-storage-domain@0.2.1-alpha.2` | `cordis ~4.0.5-alpha.1`、`dsh-storage 0.2.1-alpha.2`（精确）；同样无 invariants | 【已坐实】`npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.2 peerDependencies --json` |
| 底层（alpha.1） | `dsh-storage@0.2.1-alpha.1` | `cordis ~4.0.5-alpha.1` | 【已坐实】`npm view @deepseek-ai/dsh-storage@0.2.1-alpha.1 peerDependencies --json` |
| 底层（rc.2） | `dsh-storage@0.2.0-rc.2` | `cordis ~4.0.4` | 【已坐实】`npm view @deepseek-ai/dsh-storage@0.2.0-rc.2 peerDependencies --json` |
| 对照（rc.1） | `dsh-storage-domain@0.2.0-rc.1` | `cordis ~4.0.4`、`dsh-storage 0.2.0-rc.1`、`dsh-invariants 0.2.0-rc.1` | 【已坐实】`npm view @deepseek-ai/dsh-storage-domain@0.2.0-rc.1 peerDependencies --json` |
| 宿主依赖边（alpha.1） | `@deepseek-ai/dsh@0.2.1-alpha.1` | `dependencies` 含 `cordis ~4.0.5-alpha.1`；经 `dsh-base@0.2.1-alpha.1` 精确依赖 `dsh-storage-domain 0.2.1-alpha.1` 等全套 `0.2.1-alpha.1` | 【已坐实】`npm view @deepseek-ai/dsh@0.2.1-alpha.1 dependencies` + `npm view @deepseek-ai/dsh-base@0.2.1-alpha.1 dependencies`（含 `"@deepseek-ai/dsh-storage-domain": "0.2.1-alpha.1"` 行） |
| 宿主依赖边（rc.2） | `@deepseek-ai/dsh@0.2.0-rc.2` | `dependencies` 含 `cordis ~4.0.4`；经 `dsh-base@0.2.0-rc.2` 精确依赖 `dsh-storage-domain 0.2.0-rc.2` 等全套 `0.2.0-rc.2` | 【已坐实】`npm view @deepseek-ai/dsh@0.2.0-rc.2 dependencies` + `npm view @deepseek-ai/dsh-base@0.2.0-rc.2 dependencies` |

- `dsh-invariants` 在 alpha 线消失：registry 上该包根本没有 `0.2.1-alpha.x` 可发（§2.4），与 alpha.1/alpha.2 的 peer 表无 invariants 项互相印证。**【已坐实：现象】**；“为何取消（合并/改名/尚未发布）”**【未取到】**（未找到 changelog/ADR 说明；本次只读未拆 tarball 考据）。
- 报告人“CLI 自带 storage-domain `0.2.1-alpha.1`、peer 含 `cordis ~4.0.5-alpha.1`”的说法与本节 registry 证据一致。**【已坐实：声明层一致】**；报告人机内路径（`C:\dsh-runtime\0.2.1-alpha.1\...`）本次**【未取到】**（本机 `Test-Path C:\dsh-runtime\0.2.1-alpha.1` = False；见 §6）。

### 3.2 cordis `~4.0.4` vs `~4.0.5-alpha.1`：冲突成立（npm 默认语义）

实测（`npx -y semver <ver> -r <range>`，无 `-p`）：

```
4.0.4         ~4.0.4=True   ~4.0.5-alpha.1=False
4.0.5-alpha.1 ~4.0.4=False  ~4.0.5-alpha.1=True
4.0.3         ~4.0.4=False  ~4.0.5-alpha.1=False
4.0.5（假想正式版） ~4.0.4=True  ~4.0.5-alpha.1=True
```

- 结论：npm 默认语义下，宿主实际的 cordis（alpha 线 `4.0.5-alpha.1`）**不满足** profile 副本要求的 `~4.0.4`；反之 profile 实际的 `4.0.4` 也不满足宿主要求的 `~4.0.5-alpha.1`。双向皆硬冲突。**【已坐实】** 源：上条命令输出 + §2.1 tilde/ prerelease 规则。
- 易混点：加 `-p` 后 `4.0.5-alpha.1` 会“满足”`~4.0.4`（本机实测 `4.0.5-alpha.1(-p) ~4.0.4 → M`）。但 §2.1 已证 npm 安装不走 `-p`，该结果为反事实，不改变冲突判定。特记于此以防误读。**【已坐实】** 源：`~` 交叉矩阵 `-p` 组输出。
- 精确 peer 更无悬念：`dsh-storage 0.2.0-rc.2 ≠ 0.2.1-alpha.1`、`dsh-invariants 0.2.0-rc.2` 在 alpha 侧根本无对应版本（§2.4），字符串相等即失败，无需 semver 计算。**【已坐实】** 源：§3.1 两表 + §2.4 invariants 版本全集。

### 3.3 “pending / 安全机制拦截”全链

- 报告人给出的可复现链（`dsh --version` → `npm ls` → 两端 `package.json` peer 对比）是确定性的版本区间推论，非偶发。**【推断：机制可信但本次未端到端复现】** 源：issue body 复现节；未复现理由见下一条。
- 本次**无 CLI `0.2.1-alpha.1` 真机**，未跑通 `npm ls + 安全机制拦截` 全链；报告人机内路径（`C:\dsh-runtime\0.2.1-alpha.1`、`profiles/web` 的 `npm ls`）在本机不存在或状态不同。**【未取到】** 源：`Test-Path C:\dsh-runtime\0.2.1-alpha.1` = False；本地 `C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\@deepseek-ai\` 当前仅含 `cosmokit + schemastery`，无 `dsh-storage-domain` 副本（`Get-ChildItem` 实测，2026-10-10 时间戳；注意本地 profile 用 `pnpm-lock.yaml`/`pnpm-workspace.yaml`，与报告人的 npm 布局不同，不可直接等同）。
- DSH Loader / 宿主解析 `@deepseek-ai/*` 的源码或官方文档证据：**找不到，按任务要求如实写**。**【未取到】** 已做的只读查找：(a) 本仓 `docs/` 全文 grep `Loader|loader|pending|peer|storage-domain|@deepseek-ai` 仅命中 README 安装行与 ADR-0001 的 home-paths 说明，无 loader 解析语义；(b) 本仓根 `grep storageDomain` 仅命中插件自身声明与既有 research 回顾，无宿主源码；(c) 本地 profile 无 loader 源码可读（`web` 下仅 `cordis.yml/patch/package.json/lock`）；(d) registry 只能证明依赖边（§3.1），不能证明“pending/禁用”的宿主语义。宿主（app.asar / CLI runtime）源码不在本仓取证范围内。
- 既有 research 中的旁证（非本报告新取证，仅列供串联）：`research/dsh-log-落点/findings.md §6` 记录过 `0.1.5` 线同类前科（profile 侧 `0.1.5-rc.2` vs 宿主 `0.1.5-rc.1` 的 peer 范围差）；`research/update-integration/findings.md:345` 记录 profile 内 `@deepseek-ai/*` 仅 3 包的 hoisted 旧状。**【推断：旁证，非本次 primary source】**。

---

## 4. 桌面线对照（为何 0.2.0-rc.2 下正常）

| # | 事实 | 分级与源 |
|---|---|---|
| 4.1 | 桌面/CLI `0.2.0-rc.2` 宿主依赖边自洽：`dsh → cordis ~4.0.4` 且 `dsh-base → storage-domain 0.2.0-rc.2`（精确），storage-domain 的 peer 恰为 `~4.0.4 + exact rc.2`，三方同 tuple、同线 | 【已坐实】`npm view @deepseek-ai/dsh@0.2.0-rc.2 dependencies` + `npm view @deepseek-ai/dsh-base@0.2.0-rc.2 dependencies` + §3.1 rc.2 peer 表 |
| 4.2 | profile 副本（`0.2.0-rc.2`）的 peer 要求与桌面宿主实际版本**逐字相等**，无冲突可言；这是“桌面正常”的直接解释 | 【已坐实】`package-lock.json:83-96` vs 4.1（两边同为 `~4.0.4 / exact rc.2`） |
| 4.3 | 本仓版本声明与桌面基线一致（`engines >=0.2.0-rc.2`，README 基线 CLI `0.2.0-rc.2`/Desktop `2.0.9`），即当前声明恰好只覆盖“与锁文件同线”的宿主 | 【已坐实】`package.json:103-105`；`README.md:105-114` |
| 4.4 | 本地 `web` profile 当前无 storage-domain 副本且用 pnpm 布局——与报告人 npm 布局下的 `npm ls` 证据状态不同，不可拿本地状态反证“桌面无副本” | 【推断】`Get-ChildItem ...\profiles\web\node_modules\@deepseek-ai`（仅 cosmokit/schemastery）+ `profiles\web\package.json/pnpm-lock.yaml` 存在（`Get-ChildItem profiles\web`）；装配器差异的解释为推断，未拆 pnpm-lock 逐项核对（超出只读核“alpha 范围”所需，已止步） |

---

## 5. 除 alpha 外的组合排查（“只和 alpha 有关”是否成立）

### 5.1 排查方法

以三类 primary source 为准：(a) §2.2 `^` 区间实测；(b) §2.4 registry 已发布版本全集；(c) §3.1 各版本 peer 表。凡“宿主实际版本 ≠ profile 副本精确 peer”的组合即爆（精确 peer 无浮动余地），`~` 另按 §3.2 判定。

### 5.2 同样会爆的非 alpha 组合（registry 上真实存在或区间语义必然）

| # | 宿主线（实际 storage-domain） | profile 副本（本仓锁 `0.2.0-rc.2`） | 是否爆 | 分级与依据 |
|---|---|---|---|---|
| 5.2.1 | `0.2.0-rc.1`（registry 真实存在，2026-09-28 发布） | peer 要 `dsh-storage/invariants 0.2.0-rc.2` 精确，宿主实际为 `rc.1` | ❌ 爆（精确 peer 不等；且 `^0.2.0-rc.2` 下界直接拦下 `rc.1`，§2.2） | 【已坐实：语义层】§2.2（`0.2.0-rc.1 NO-MATCH`）+ §3.1 rc.1/rc.2 peer 表；宿主发 `rc.1` 即带 storage-domain `rc.1`（`dsh-base@0.2.0-rc.1` 未逐项取，但 rc.1 全套精确惯例见 §3.1，会爆的判定不依赖该假设——仅区间下界已足够） |
| 5.2.2 | 任何 `0.1.x` 宿主（如 `0.1.5-rc.2`，registry 存在） | 区间 `^0.2.0-rc.2` 根本不含 `0.1.x`（§2.2）；peer 亦全线不等 | ❌ 爆 | 【已坐实：语义层】§2.2（`0.1.5-rc.2 NO-MATCH`）；但 `engines >=0.2.0-rc.2` 已声明不支持该线，故属“声明外”，非“基线内新爆点” |
| 5.2.3 | 假想未来 `0.2.0` / `0.2.1` **正式版**宿主（registry 尚无） | 区间 ✅ 落入（§2.2），但精确 peer（`storage/invariants exact rc.2`） vs 宿主正式版号**必然不等** | ❌ 仍爆（若宿主按既往惯例把全套版本提到正式版号） | 【推断】前半（区间落入）已坐实（§2.2）；后半依赖“正式版宿主会同步提 storage-domain/invariants 到正式版号”的惯例外推（rc.2 与 alpha.1/alpha.2 两代均如此，§3.1），正式版未发布故无法坐实 |
| 5.2.4 | 假想未来 `0.2.0-rc.3`（同 tuple 后续 rc，不存在） | 区间 ✅；精确 peer 取决于宿主是否同步提号 | ❓ 条件爆 | 【推断】§2.2（`rc.3 MATCH`）；peer 侧无版本可查 |
| 5.2.5 | 假想 `0.3.0` | 区间上界直接拦下（§2.2） | ❌ 爆 | 【已坐实：语义层】§2.2（`0.3.0 NO-MATCH`） |

### 5.3 对“只和 alpha 有关”的判定

- **严格语义下不成立**：精确 peer（`dsh-storage/dsh-invariants exact 0.2.0-rc.2`）意味着**任何实际版本 ≠ `0.2.0-rc.2` 的宿主都会爆**，不限于 alpha。§5.2.1（`rc.1`）与 §5.2.5（`0.3.0`）是纯语义层、无需假设即可成立的非 alpha 反例；§5.2.3（未来正式版）是高可信外推。**【已坐实：机制不限于 alpha】** 源：§2.2 + §3.1 + §2.4。
- **在役版本范围内成立**：registry 上当前唯一在役且与锁文件同大版本（`0.2.x`）但异号的宿主线，恰是 `0.2.1-alpha.1/alpha.2`；`0.2.0-rc.1` 已是旧发布、`0.1.x` 在 engines 声明外、`0.2.0/0.2.1` 正式版尚不存在。因此“报告人当下撞上的那条线是 alpha”成立，“除 alpha 外当前还有第二条在役爆线”不成立。**【已坐实：在役枚举】** 源：§2.4 三份版本全集 + `package.json:103-105` engines。
- 一句话：**机制不限于 alpha（精确 peer 决定），但当下在役的爆线只有 alpha**。是否把结论表述为“只和 alpha 有关”，取决于维护者要的是机制口径还是在役口径——本报告只给证据，不选口径（按任务要求不写修复/定性结论）。

---

## 6. 双实例（库 import + storageDomain 服务）风险的源码依据

| # | 事实 | 分级与源 |
|---|---|---|
| 6.1 | host 半直接 import 库符号：`import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain"`，全仓仅此一处（`lib/` 与 `src/` 各查一遍，`lib/index.js:20` 唯一命中） | 【已坐实】`lib/index.js:20`；`grep invariant\|from "@deepseek-ai`（lib 仅 1 命中）；issue body“全仓仅此一处”与本次 grep 一致 |
| 6.2 | 该符号用于定义本插件存储域：`promptDomainSpec = defineDomain({ name: 'dsh_prompt', version: 0, layout: 'single', tables: customs/usage/pinned, global })` | 【已坐实】`lib/index.js:108-121` |
| 6.3 | 同文件声明消费宿主服务：`export const inject = ["storageDomain", "webServer"]`；`apply(ctx)` 内 `sharedStore(ctx.storageDomain)`；`PromptStore.initialize()` 内 `await this.storageDomain.open(promptDomainSpec)`；进程单例 `globalThis["__dshPromptStore"]` | 【已坐实】`lib/index.js:35`、`lib/index.js:1034-1035`、`lib/index.js:146-152`、`lib/index.js:319-325` |
| 6.4 | “既 import 库符号（profile 副本解析），又消费宿主同名单例（宿主服务注入）”的双实例并存结构成立——有源码依据 | 【已坐实】6.1 + 6.3（两者同文件并存） |
| 6.5 | 双实例的后果（cordis Service 身份/`instanceof`/单例语义错位、跨版本 `defineDomain` 产物被异版 `storageDomain.open` 消费） | 【推断】有结构依据（6.4）但无真机符号/行为对比；报告人的导出符号表（两端 9 符号一致、`exports` 差 `./invariant`）本次未复验（未下载 tarball 拆包），且代码未用 `./invariant` 子路径（6.1 grep 无 `invariant` 命中） |
| 6.6 | `./invariant` 子路径差不是本次触发点（代码未用） | 【已坐实】lib grep `invariant` 仅 issue body 回忆性文字命中，代码 0 命中；`lib/index.js:20` 仅从根导入 `defineDomain/domainTable` |
| 6.7 | 自包含回归断言与上述结构锁死：`scripts/test-host-deps.cjs:1-9/32-36` 要求“裸导入必须在 `dependencies`”（peer 不算），即当前形态是被测试钉住的——任何改声明位置的动作都会先红该测试 | 【已坐实】`scripts/test-host-deps.cjs:1-9`（背景注释：`0.1.5-rc.2` 启动失败复盘）+ `:32-43`（断言逻辑）。列此仅为证据完整性（解释 triage H3“不是改一行区间的事”），不构成修复建议 |

---

## 7. 未决项（本次未取到，需要真机或宿主侧材料才能闭环）

1. **CLI `0.2.1-alpha.1` 真机全链**：`npm ls` 落点、`peer` 冲突的安装器原文报错、“pending / 安全机制禁用”的宿主侧原文与触发规则。**【未取到】**（无真机；本地 profile 状态与报告人不同，见 §3.3）。
2. **DSH Loader 解析 `@deepseek-ai/*` 的源码/官方文档**：宿主从 app.asar / CLI runtime 提供同名包、插件侧副本何时被视为冲突的判定逻辑。**【未取到：已做 §3.3 四项只读查找，无命中】**。
3. **两端 tarball 逐字节/导出符号复验**：报告人的“9 符号一致、`./invariant` 差一子路径”表。**【未取到】**（未下载 tarball；且与“是否只和 alpha 有关”无直接关系）。
4. **`dsh-invariants` 在 alpha 线消失的原因**（合并、改名、或尚未发布 alpha 版）。**【未取到】**（现象已坐实 §3.1/§2.4，原因无 changelog/ADR 可引）。
5. **未来 `0.2.0/0.2.1` 正式版宿主的实际 peer 形态**（§5.2.3 后半）。**【未取到】**（版本尚不存在；`latest/next/alpha` dist-tags 见 §2.4）。
6. **本地 pnpm 布局 vs 报告人 npm 布局的装配差异**（本地 profile 有 `pnpm-lock.yaml` 且当前无副本）。**【未取到】**（未拆 pnpm-lock；超出“alpha 范围”核验所需，已止步）。

---

## 8. 取证命令清单（复跑用，均为只读）

```powershell
# 声明与锁（§1）
#   读 package.json:124 / package-lock.json:12,28-96（直接读文件，无命令）

# 版本全集（§2.4）
npm view @deepseek-ai/dsh-storage-domain versions --json
npm view @deepseek-ai/dsh versions --json
npm view @deepseek-ai/cordis versions --json
npm view @deepseek-ai/dsh-storage versions --json
npm view @deepseek-ai/dsh-invariants versions --json

# peer 表（§3.1）
npm view @deepseek-ai/dsh-storage-domain@0.2.0-rc.2 peerDependencies --json
npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.1 peerDependencies --json
npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.2 peerDependencies --json
npm view @deepseek-ai/dsh-storage-domain@0.2.0-rc.1 peerDependencies --json
npm view @deepseek-ai/dsh-storage@0.2.1-alpha.1 peerDependencies --json
npm view @deepseek-ai/dsh-storage@0.2.0-rc.2 peerDependencies --json
npm view @deepseek-ai/dsh@0.2.1-alpha.1 dependencies --json
npm view @deepseek-ai/dsh@0.2.0-rc.2 dependencies --json
npm view @deepseek-ai/dsh-base@0.2.1-alpha.1 dependencies --json
npm view @deepseek-ai/dsh-base@0.2.0-rc.2 dependencies --json
npm view @deepseek-ai/dsh-storage-domain@0.2.1-alpha.1 --json   # 含 versions/time/dist-tags 全集

# semver 实测（§2.2/§3.2；npx -y semver 即 node-semver 可执行形态）
npx -y semver 0.2.0-rc.2 -r '^0.2.0-rc.2'
npx -y semver 0.2.0 -r '^0.2.0-rc.2'
npx -y semver 0.2.1 -r '^0.2.0-rc.2'
npx -y semver 0.2.1-alpha.1 -r '^0.2.0-rc.2'      # 空 = 不满足
npx -y semver 0.2.1-alpha.2 -r '^0.2.0-rc.2'      # 空 = 不满足
npx -y semver 0.2.1-alpha.1 -r '^0.2.0-rc.2' -p   # 反事实对照（有回显）
npx -y semver 4.0.4 -r '~4.0.4'
npx -y semver 4.0.5-alpha.1 -r '~4.0.4'           # 空 = 冲突成立
npx -y semver 4.0.4 -r '~4.0.5-alpha.1'           # 空 = 反向亦冲突
npx -y semver 4.0.5-alpha.1 -r '~4.0.5-alpha.1'

# issue 读取（§0）
gh issue view 147 --json title,body,labels,state,comments

# 本地负探（§3.3/§4.4）
Get-ChildItem C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\@deepseek-ai\
Get-ChildItem C:\Users\辰辰洋洋\.dsh\profiles\web\
Test-Path C:\dsh-runtime\0.2.1-alpha.1
```

规范与文档 URL（§2.1）：

- `https://raw.githubusercontent.com/npm/node-semver/main/README.md`（Prerelease Tags / Tilde / Caret / Functions 章节）
- `https://semver.org/`（被 node-semver README 引用的版本语义源头）
