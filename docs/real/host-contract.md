# 宿主契约与运行前 preflight（#185）

真机套件跑在「DSH web 页面边界」这一条唯一主 seam 上：套件只通过页面 DOM/交互与
`data-dsh-prompt-*` 钩子观察插件。**这个 seam 另一侧的宿主行为不归插件所有**，必须被显式
钉住；否则宿主一升级，套件会把"宿主行为变了"误报成"插件坏了"（假 FAIL）。本契约就是这一层
版本钉数据 + 运行前逐项体检。

- 契约数据与纯探测：`scripts/real/harness/contract/host.mjs`（零 IO、零浏览器）
- preflight 执行（采集观测 + 判定）：`scripts/real/harness/contract/preflight.mjs`
- 模块自证（纯 Node）：`scripts/real/harness/contract/selftest.mjs`
- 接入点：`scripts/real/run.mjs` —— 浏览器连接 + `preparePage` + 首次截图之后、执行套件之前

## 分层与职责

```text
用例层 suites/*.mjs        只依赖：契约观测（prepared.facts / 证据）+ 插件钩子，不直接依赖宿主内部状态
        │
harness/contract/host.mjs  版本钉数据（识别条件/期望形状/失败后果/升级路径）+ 纯函数探测
        │  evaluateContract(observations)
harness/contract/preflight.mjs  从 CDP / 宿主进程 / 一次性 DSH_HOME 采集观测，调上面的判定
        │  runPreflight(...) → {ok, contractVersion, fault, checks[]}
run.mjs                    逐项 PASS 记「契约：<id>」；失败项记一条 BLOCKED（reason 带期望形状与观测值），跳过套件，退出码 2
```

契约层住在 `harness/` 下而不是顶层 `contract/`：浏览器产品名、语言标签、启动输出形状这类
宿主事实属于**平台契约层**，和绑定层/探测层同级；真机静态门禁（#186）只对 `harness/` 豁免
R4/R5，用例层仍然禁止写宿主事实。模块边界（契约数据+纯探测 / 检查执行 / 自证）不变。

任何一项断链**只报该一项**，不进入套件；不产生假 FAIL。

## 版本钉

| 项 | 值 |
| --- | --- |
| 契约版本 `CONTRACT_VERSION` | `1` |
| 宿主 known-good 区间 | `>=0.2.0-rc.2 <=0.2.1-rc.3` |
| 本机实测宿主 | `0.2.1-rc.3`（`dsh --version`，2026-10-30） |
| 浏览器 | Chromium 系 `Edg/Chrome/Chromium/HeadlessChrome`，主版本 `>=112`；实测 `Edg/156.0.4314.50`（CDP protocol `1.3`） |
| 平台 | Windows + Windows Edge（launcher 实测） |

宿主版本越出 known-good 区间时，`host.versions` 单项红、整个 run 记 BLOCKED —— 这是**特性**：
未知宿主上跑出的产品判定不可归因，宁可阻塞。

## 六项契约

| id | 适用宿主 | 探测方式 | 期望形状 | 失败后果 | 升级路径 |
| --- | --- | --- | --- | --- | --- |
| `host.startup-output` | `>=0.2.0-rc.2 <=0.2.1-rc.3` | 读 `server.readLogs().stdout` 原文，按 `startup.linePattern` 解析；端口须等于实际监听端口；HTTP 探针须 200 | 单行 `dsh web: http://127.0.0.1:<port>/?token=<token>`；token 20+ 字符 | 浏览器地址不可得/不可信，后续所有判定不可归因 | 改 `startup.linePattern`/`allowPreambleLines`/`expectedHttpStatus`，在本文记一条实测 |
| `host.startup-gates` | 同上 | `preparePage` 记录每轮识别观测；preflight 复查关闭后状态（可见全屏遮罩 0、`#root` 无 inert/`aria-hidden=true`、composer 在场） | 预览提示用「继续」类按钮关闭；登录提示仅本次会话隐藏；关闭后可交互 | 入口被遮罩挡住 → 悬停/点击类用例假 FAIL | 改 `gates.overlay`/`phases`/`continueLabels`/`post`；关闭逻辑在 `harness/page.mjs`，用例不动 |
| `host.input-actions` | 同上 | 从 composer 的 React fiber 链上取 `memoizedProps.inputActions`（只读探针，不依赖插件内部） | `captureInsertion`/`insertText`/`setDraft` 均为函数；`captureInsertion()` 返回 `{start:number,end:number,draftRev:number}` 且 `start<=end`；composer 带 `contenteditable=true`/`role=textbox`/`data-composer-input` | 草稿读取与插入语义不可用，输入类用例无法准备/校验 | 改 `inputActions.*` 常量，同步探针字段 |
| `host.storage-schema` | 同上 | 读一次性 `DSH_HOME/storages/`：宿主自建域文件须到、顶层键可解析；记录插件域文件路径与存在性 | `$DSH_HOME/storages/<域>.json`，顶层 `{unit:{name,version},global,tables}`；插件域 `dsh_prompt.json` 在无写入前允许缺失 | 持久化/备份类用例读写错位置，证据不可解释 | 改 `storage.rootRelative`/`topKeys`/`minSingleFiles`；插件域命名变化同步 `pluginDomain` |
| `host.ui-locale` | 同上 | 读 `document.documentElement.lang` + `navigator.language`，按宿主语义归一（`zh→zh-CN`，其余原样） | lang ∈ `{zh,en}` 且等于映射写回形状 | 语言落在未知集合 → 依赖文案/门文案表的用例失效 | 改 `locale.knownLocales`/`tagMapping`（新增语言时补门文案表） |
| `host.versions` | 同上 | 宿主版本取 `dsh --version`（绑定层）；浏览器版本取 CDP `/json/version` 的 Browser 串 | 宿主 semver 在 known-good 区间内；浏览器 Chromium 系且主版本 >=112 | 未知宿主 → 带着未知行为跑套件，FAIL 不可归因 | 改 `host.knownGoodRange`/`tested` 与 `browser.minMajor`/`tested`（附实测记录） |

### 每项的实测细节与假设（"只在某版本成立"的部分）

**① 启动输出。** 实测 stdout 恰好一行：
`dsh web: http://127.0.0.1:64154/?token=...`（token 43 字符，`[A-Za-z0-9_-]`，stderr 空）。
成立假设：无前导/警告行（`allowPreambleLines: false`）。若未来宿主在 URL 前打印日志，升级路径是
把 `allowPreambleLines` 改 `true`（或把 `linePattern` 收紧到新格式）——只动契约常量。

**② 启动遮罩。** 实测识别条件：`body` 直属 `DIV`、`position:fixed`、`z-index:1000`、覆盖视口 100%。
实测阶段序列：`preview`（文本含「预览版说明」，按钮「继续」）→ 点掉后同一容器切成 `login`
（文本含「登录 DeepSeek」「添加 API Key」「登录」），无契约可点按钮 → `hide-gate`（`style="display:none"`，
只在本次一次性会话生效，不改产品、不点登录）。实测动作序列 `["click:继续","hide-gate"]`；
`#root` 初始 `inert=""`，关闭过程移除，关闭后无 inert、无 `aria-hidden`。
成立假设：预览与登录共用同一遮罩容器、z-index 固定区间、文案为中文/英文集合；一次性实例没有
宿主凭证，所以登录门只能隐藏不能真登录。

**③ 输入 actions。** 实测从 `[contenteditable="true"]` 的 `__reactFiber$` 键沿 `.return` 上行，
第 7 层命中 `memoizedProps.inputActions`；公开方法 `captureInsertion/insertText/setDraft/
persistDraft/addAttachments/removeAttachment/pruneAttachments/submit` 全为函数；
空草稿 `captureInsertion()` → `{start:0,end:0,draftRev:0}`。
语义（套件凭证；preflight 只做只读能力探测）：
- `captureInsertion(): {start,end,draftRev}` —— 当前草稿选区，无选区时文末折叠；
- `insertText(text, {draftRev,start,end}): boolean` —— rev 不匹配/不可编辑时 `false`；一次独立可撤销编辑，光标落插入文本之后；
- `setDraft(text)` —— 整框替换，history-merge 并入当前步（不是独立撤销步），光标置尾；
- 没有 `setCaret`/`setSelection` 这类指定光标 API；草稿读取口径 = `[data-composer-input]` 的 `innerText`。
成立假设：fiber 链 80 层内能命中、`inputActions` 挂在 `memoizedProps` 上、方法名稳定；探针只读取不写入。

**④ 持久化。** 实测一次性 home：`storages/workspace.json`（宿主自建域，`unit {name:"workspace",version:2}`、
`global {initialized,workspaceIds,archivedSessionIds,pinnedSessionIds,defaultWorkspaceId}`、`tables {workspaces}`）、
`storages/session_projcache/` 目录；插件域 `storages/dsh_prompt.json` 在 smoke 无模板写入时**不存在**，
因此只记存在性、不作必要条件（插件域落盘位置另见 `research/prompt-store-location.md`）。
成立假设：存储根相对 `DSH_HOME` 为 `storages`、域文件为单布局 `<域>.json`、顶层三键。

**⑤ 语言。** 实测 `documentElement.lang="zh-CN"`、`navigator.language="zh-CN"`（`navigator.languages=[zh-CN,en,en-GB,en-US]`），
唯一写入者是宿主 locale 服务（`active==='zh' ? 'zh-CN' : active`，条件写；切语言不 reload）。
成立假设：已知集合 `{zh,en}` 与写回映射；kit 只读 `lang`、不写 `lang`、不做语言切换用例。

**⑥ 版本。** `dsh --version` 输出即为版本串；浏览器版本来自 CDP。成立假设：宿主 semver、浏览器
Chromium 系（Firefox/WebKit 不支持 CDP input 语义）。

## 运行期新事实回填规则

宿主升级或本机环境变化后的标准动作（**用例层零改动**）：

1. 用真实观测跑 `npm run real:smoke`（或本票的 run 命令）；BLOCKED 项指名了断链契约项与期望/观测。
2. 判断是"行为真的变了"还是"采集/环境问题"：前者进契约，后者别改契约。
3. 只改 `scripts/real/harness/contract/host.mjs` 的对应常量（版本区间/形状/识别条件/文案表）。
4. `node scripts/real/harness/contract/selftest.mjs` 必须全绿（A 已知观测、C 升级模拟会跟着用新常量）。
5. 跑真机：preflight 全绿 + 套件 PASS；再用负例确认"只红该项"仍成立。
6. 在本文件对应小节补一条实测记录（日期、宿主/浏览器版本、观测形状），必要时更新表格的适用宿主列。
7. 提交只动 `scripts/real/harness/contract/*` 与 `docs/real/host-contract.md`，不碰 `suites/`。

禁止：把宿主行为事实直接写进用例；在用例里兜底识别遮罩/解析启动行；把机器特定值（路径、端口、locale）写死。

## 负例自检（证明它能红）

注入项只替换**一项**观测、模拟该类宿主升级，其余契约项与套件不受影响：

```powershell
# 方式一：环境变量
$env:DSH_REAL_CONTRACT_FAULT='host.input-actions'
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --evidence-dir <证据目录>
# 方式二：命令行参数
node scripts/real/run.mjs --artifact <插件.tgz> --suite smoke --contract-fault host.startup-output
```

期望：`PASS 5 / FAIL 0 / BLOCKED 1 -> BLOCKED`，退出码 `2`（PASS=0 / FAIL=1 / 阻塞=2），
证据 `report.json` 的 `checks` 里只有 `BLOCKED 契约：<注入项>`，套件检查一条都没有（未执行）。
可选注入项：`host.startup-output`、`host.startup-gates`、`host.input-actions`、
`host.storage-schema`、`host.ui-locale`、`host.versions`；未知 id 直接报错退出 2。

纯 Node 自证（不需要浏览器/宿主）：

```powershell
node scripts/real/harness/contract/selftest.mjs
# [selftest] PASS ... / FAIL 0 —— 宿主契约模块自证全绿（契约版本 1）
```

## 证据字段

`report.json`（schemaVersion 1）里与本契约相关：

- `environment.preflight` = `{contractVersion, fault, ok, checks:[{id, ok}]}`
- `checks[]` = `PASS/ BLOCKED 契约：<id>`（失败时该条 `reason` 带期望形状与观测值，token 已脱敏）
- `environment.startupGate` / `environment.startupGateRounds` = 门关闭动作序列与每轮识别观测

## 与 #183 其他票的边界

本票只做"宿主行为事实 → 版本钉契约 + preflight"，不改产品行为（`src/` 一行不动）、不新增加第三方依赖、
不做 #186 的静态门禁、#187 fixture、#188 观测层、#189 判定分类。BLOCKED 记录沿用现有 Recorder 语义。
