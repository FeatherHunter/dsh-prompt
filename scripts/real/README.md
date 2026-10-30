# 真机测试 kit

一条命令装配**一次性 DSH web 宿主**、安装被测插件产物、起无头浏览器、跑套件、留证据。
它服务的是「换机器/换宿主版本/换插件也能复现」的真机验收，不是某台开发机的脚本集合。

## 快速开始

前置：Node >= 22、DSH CLI（在 PATH 或显式指定）、Edge / Chrome / Chromium 任一。

    npm run real:smoke -- --artifact D:/path/to/dsh-prompt-x.y.z.tgz

或直接：

    node scripts/real/run.mjs --artifact D:/path/to/dsh-prompt-x.y.z.tgz --suite smoke

跑完看两处：

- 终端摘要（PASS / FAIL / BLOCKED / N-A 与证据路径）；
- 证据目录 `.tmp-real/<runTag>/`：`report.json`、`shots/*.png`。

套件执行前会先跑**宿主契约 preflight**（6 项，见 `docs/real/host-contract.md`）：
任何一项与钉住的宿主版本行为不符，只记一条指名契约项的 BLOCKED、跳过套件、退出码 2，
不会把"宿主没就绪"误报成产品 FAIL。

之后还会断言**起始态 = 声明值**（fixture，见 `docs/real/fixture.md`）：不符只记一条
`BLOCKED fixture 起始态`、跳过套件、退出码 2，不会把状态污染误报成产品 FAIL。

## 它做了什么

1. 在临时目录建一次性 `DSH_HOME`；
2. `--from-default-profile web --dump-config` 生成 web profile 骨架（只写配置，不启动）；
3. `dsh plugin --profile real add file:<产物>` 把被测包装进这个 profile，并校验版本；
4. 按 `--fixture` 配方**重置 + 种子**插件持久化数据（起宿主前写 store，默认 clean 干净态）；
5. `dsh --profile real --port 0 --no-open` 起服务，解析 stdout 里的访问 URL；
6. 起无头浏览器（临时 user-data-dir，随机调试端口），CDP 连接页面；
7. 收掉宿主启动说明遮罩（优先点「继续」类真实按钮，没有可点按钮才隐藏）、等插件入口 `[data-dsh-prompt-entry]` 出现；
8. **宿主契约 preflight**：启动输出形状、启动遮罩、输入 actions、存储 schema、语言面、宿主/浏览器版本逐项核对；
9. 经公开 HTTP 桥读回 store，**断言起始态 = 声明值**；不符则 BLOCKED、跳过套件；
10. 契约与起始态都成立后跑套件、收集判定、截图；
11. 杀进程树、确认端口释放，按需清理一次性工作目录。

## 参数与环境变量

| 参数 | 环境变量 | 说明 |
| --- | --- | --- |
| `--artifact <path>` | `DSH_REAL_ARTIFACT` | 被测插件 .tgz（必要） |
| `--suite <name>` | — | 套件：`smoke`（宿主回路自检）/ `boundary`（边界观测 × 真实输入，见下文） |
| `--dsh-cli <path>` | `DSH_REAL_DSH_CLI` / `DSH_CLI` | DSH CLI，缺省查 PATH |
| `--browser <path>` | `DSH_REAL_BROWSER` / `CHROME_PATH` / `EDGE_PATH` | 浏览器可执行文件 |
| `--workdir <path>` | `DSH_REAL_WORKDIR` | 一次性工作目录根，缺省系统临时目录 |
| `--evidence-dir <path>` | `DSH_REAL_EVIDENCE_DIR` | 证据根目录，缺省仓库 `.tmp-real/` |
| `--port <n>` | — | 宿主端口，缺省 0 由系统分配 |
| `--timeout-scale <x>` | `DSH_REAL_TIMEOUT_SCALE` | 超时倍率，慢机器用 |
| `--fixture <name\|path>` | `DSH_REAL_FIXTURE` | 初始态配方：内置名或 `.json` 路径，缺省 `clean`（干净态），见 `docs/real/fixture.md` |
| `--fixture-fault <mode>` | `DSH_REAL_FIXTURE_FAULT` | 负例自检：把初始态弄脏再跑（`pollute` / `skip-seed` / `drop-store`），证明基线不符会 BLOCKED |
| `--contract-fault <id>` | `DSH_REAL_CONTRACT_FAULT` | 负例自检：只替换一项宿主契约观测（模拟宿主升级），见 `docs/real/host-contract.md` |
| `--keep` | `DSH_REAL_KEEP=1` | 保留一次性工作目录 |

## 退出码与判定

| 退出码 | 含义 |
| --- | --- |
| 0 | 全部 PASS |
| 1 | 有 FAIL（产品行为不符合期望） |
| 2 | BLOCKED（装配/宿主契约/起始态没就绪）或参数错误 |

判定只有四类：`PASS` / `FAIL` / `BLOCKED` / `N-A`。
FAIL 必须带 expected/observed，且可复现；BLOCKED 表示证据不足以下结论；N-A 必须写原因。
整体结论：有 FAIL 即 FAIL，否则有 BLOCKED 即 BLOCKED，否则 PASS。

## 证据格式

`report.json`（schemaVersion=1）包含：

- `runTag` / `suite` / `verdict` / `startedAt` / `finishedAt`；
- `environment`：平台、Node 版本、产物 name/version/sha256、宿主 CLI 路径与版本、浏览器路径与运行版本、profile、服务 URL（token 打码）、页面事实、超时配置、当前阶段、`fixture`（配方名/参数/重置与种子结果/声明 vs 实测基线/差异）；
- `checks[]`：每项的 verdict、名称、时间、期望/观测/原因；
- `summary`：四类计数。

## 模块地图

    scripts/real/
      run.mjs              入口：编排与退出码
      harness/
        bindings.mjs       运行期绑定：产物/CLI/浏览器/目录/超时/参数
        profile.mjs        一次性 profile 装配与安装校验
        server.mjs         宿主 Web 服务生命周期
        browser.mjs        无头浏览器生命周期
        cdp.mjs            最小 CDP 客户端（Page/Runtime/Input/Log）
        page.mjs           页面准备、按契约收启动遮罩、观测助手
        evidence.mjs       判定、证据、报告 schema、唯一 run tag
        proc.mjs           进程/端口底座（跨平台）
        errors.mjs         HarnessError / CheckFailure
        input-plan.mjs     输入序列构造纯函数（指针路径/点击/按键/快捷键/文本）
        input.mjs          真实输入驱动 + 页面输入事件日志 + 显式合成点击
        observe/
          source.mjs       来源等级模型（自述<内部状态<公开接口<用户可见<持久化）
          text.mjs         语义文本归一化/匹配/行定位
          compare.mjs      原始观测扁平差分、双通道对账、事件序列差分
          interpret.mjs    六面解释器（raw → 分级字段，不判期望）
          probes.mjs       页面内采集函数 + HOOKS + snapshotExpression + 轮询等待
          index.mjs        统一入口：createObserver / createPersistence
          selftest.mjs     观测层自证（纯 Node，零浏览器/零宿主）
        fixture/
          index.mjs        声明式 fixture：配方解析/校验、重置+种子、路径守卫、基线投影与 diff、HTTP 读回
          selftest.mjs     fixture 自证（纯 Node，零浏览器/零宿主）
        contract/
          host.mjs         宿主契约数据（版本钉/识别条件/期望形状/失败后果/升级路径）+ 纯探测
          preflight.mjs    运行前 preflight：采集观测 → 逐项判定
          selftest.mjs     契约模块自证（纯 Node，零浏览器）
      fixtures/
        clean.json         干净态（插件定义默认）
        templates.json     模板集合（自定义模板 + 置顶 + 用量，带 ${runTag}）
        trigger-hover.json 触发模式：悬浮触发（显式钉住）
        trigger-click.json 触发模式：点按触发（留给 #188/#192 的 click 态场景）
        remote-prefs.json  远程开关类偏好（总闸关 + 尺寸/方向/密度非默认）
      suites/
        smoke.mjs          回路自检套件
        boundary.mjs       边界观测 × 真实输入套件（物理指针 vs 合成点击、双通道）

分层约定：方法层（协议与判据）与平台契约层（宿主行为事实）不写死在绑定层；
绑定层只回答「这台机器上这些东西在哪里、超时多少」。宿主契约住在 `harness/` 下，
因为浏览器产品名 / 语言标签 / 启动输出形状这类宿主事实只允许出现在平台契约层
（真机静态门禁 #186 对 harness 豁免 R4/R5，用例层仍禁止写宿主事实）。

## 宿主契约与 preflight

宿主行为事实收敛在 `scripts/real/harness/contract/host.mjs`（版本钉数据 + 纯探测），
`preflight.mjs` 在每次真机套件前逐项核对，失败项只报该一项、跳过套件、退出码 2。
完整契约（版本范围、探测方式、期望形状、失败后果、升级路径、回填规则）见
[`docs/real/host-contract.md`](../../docs/real/host-contract.md)。

负例自检（只红注入的那一项）：

    $env:DSH_REAL_CONTRACT_FAULT='host.input-actions'
    node scripts/real/run.mjs --artifact <tgz> --suite smoke
    # 或：node scripts/real/run.mjs --artifact <tgz> --suite smoke --contract-fault host.startup-output

纯 Node 自证（不需要浏览器/宿主）：

    node scripts/real/harness/contract/selftest.mjs

- 登录遮罩现在按契约识别与关闭（预览提示点「继续」→ 登录提示仅本次会话隐藏），
  每轮识别观测进 `environment.startupGateRounds`。
- 插件入口/面板/关闭按钮等选择器（`data-dsh-prompt-*`）是插件提供的观测钩子契约，
  完整清单、值域与稳定性承诺见 [`docs/real/hooks.md`](../../docs/real/hooks.md)（#190 正式化）。

## 初始态 fixture 与干净态基线

每轮运行的初始态由**纯数据配方**声明（`scripts/real/fixtures/*.json`），运行参数选配方，
套件代码零改动。配方做两件事：**重置**（删除插件持久化数据 `storages/dsh_prompt.json`，让插件
定义生效）与**种子**（起宿主前按 storage-schema 契约写入模板集合 / 触发模式 / 远程偏好）。
起宿主后经产品公开路径 `GET /_dsh/dsh-prompt/store` 读回当前态，与配方里的 `expect` 逐路径比对。

内置配方：

| 配方 | 初始态 |
| --- | --- |
| `clean`（缺省） | 干净态：无自定义模板/用量/置顶，远程关，悬浮触发，屏蔽预制 |
| `templates` | 2 条自定义模板 + 1 条置顶 + 1 条用量；id/文案带 `${runTag}`，本轮种子可追溯 |
| `trigger-hover` | 触发模式显式钉在悬浮触发 |
| `trigger-click` | 触发模式 = 点按触发（当前 smoke 假设 hover，该态留给 #188 的 click 态场景） |
| `remote-prefs` | 远程总闸关 + 尺寸/方向/密度非默认档位 |

    node scripts/real/run.mjs --artifact <tgz> --suite smoke --fixture templates
    node scripts/real/run.mjs --artifact <tgz> --suite smoke --fixture trigger-hover
    node scripts/real/run.mjs --artifact <tgz> --suite smoke --fixture remote-prefs

起始态与声明不符 → 只记一条 `BLOCKED fixture 起始态`（reason 里列 current vs expected）、
**不执行套件**、退出码 2，不产生假 FAIL。负例自检（把种子之后的 store 弄脏）：

    node scripts/real/run.mjs --artifact <tgz> --suite smoke --fixture templates --fixture-fault pollute
    # [real] fixture templates  故障注入=pollute  起始态=与声明不符（BLOCKED）
    # [real] PASS 6 / FAIL 0 / BLOCKED 1 -> BLOCKED（6 = 契约项；套件未执行），退出码 2

纯 Node 自证（不需要浏览器/宿主）：

    node scripts/real/harness/fixture/selftest.mjs
    # RESULT: 108 PASS / 0 FAIL（fixture 自证全绿）

每轮 run tag 唯一（同秒连跑也不撞）并写进 `report.json`；store 路径必须落在本轮一次性 `DSH_HOME`
内（越界拒绝），失败/中断后直接重跑即可恢复。配方格式、字段口径、与契约的关系、给 #188 的 API
见 [`docs/real/fixture.md`](../../docs/real/fixture.md)。

## 钩子契约与诊断（#190）

真机用例定位插件元素只靠两样东西：`data-dsh-prompt-*` 契约钩子、语义文本（可见文案 /
`title` / `aria-label`）。契约分两档：**可依赖**（96 个，由构建产物门禁钉死）与**仅调试用**
（41 个，真机套件不得依赖）。完整清单、所在元素、值域、首次引入版本见
[`docs/real/hooks.md`](../../docs/real/hooks.md)。

门禁（断言必需钩子与诊断标记确实进了 `lib/client.js`，并与契约文档双向交叉校验）：

    node scripts/check-real-hooks.mjs --selftest   # 自证：完整副本绿 / 删一个必需钩子必红 / 文档漂移必红
    node scripts/check-real-hooks.mjs              # 正式检查

> 门禁读的是入库构建产物 `lib/client.js`：改了 `src/` 要先 `npm run build` 再跑它（lib 由主工作目录
> 串行构建提交，见 `docs/real/static-gate.md` 与协作约定）。

诊断开关（现场排障用，**默认关闭**，不新增任何 UI）：

- 开：页面地址加 `?dsh-prompt-diag=1`（只本页），或 `localStorage.setItem('dsh-prompt-diag', '1')`
  （跨刷新），或已开启后在控制台用 `__dshPromptDiag.disable()` / `.enable()` 反复开关。
- 看：`__dshPromptDiag.snapshot()` 返回结构化只读快照（契约版本 + 面板开合/触发方式/行数/
  设置项/远程/弹层/日志状态）；`.dump()` 以固定前缀 `[dsh-prompt:diag]` 打到 `console.debug`。
- 设计约束：默认关时零 window 对象、零监听、零 console 输出；不读模板正文/草稿；不写常规日志
  （日志事件清单是冻结契约）。快照格式与设计理由见 `docs/real/hooks.md` 第 5 节。

## 边界观测与真实输入（#188）

`--suite boundary` 用**真实输入**跑代表性场景，并把观测按来源等级解释、关键结论双通道对账：

    node scripts/real/run.mjs --artifact <tgz> --suite boundary --fixture templates --evidence-dir D:/Temp/evidence-188

三个场景：

1. **打开面板**：物理多段鼠标悬停入口（move→…→enter）↔ `element.click()` 合成点击，两路都执行；
   断言面板可见、入口事件 `isTrusted=true`、底栏触发方式与 fixture 声明一致、行 id 与 store 自定义
   模板 id 双通道一致；两路行为差分 0 条，事件差异（物理独有真实指针序列、合成独有非 trusted click）
   落进报告的差异清单。
2. **行插入落位**：按用户可见名称定位模板行（不靠内部类名），物理点行后逐字断言宿主 composer 草稿
   = fixture 正文、光标在正文末尾（`captureInsertion` 公开接口 + DOM 选区两路），store `usage+1`
   与 `lastUsed` 双通道；再用合成点击重复一遍，断言结果一致。
3. **设置页控件切换**：物理点底栏「模板管理」进设置页，断言宿主弹窗/插件分区/控件挂载；物理点
   「屏蔽预制模板」→ 勾选状态翻转 + store `hidePreset` 落盘；物理点触发方式 → `aria-pressed`
   语义翻转 + store `hoverTrigger` 落盘；两条都双通道对账。设置页打开后产品自己会把远程段滚进
   视野（#82 直达，异步），所以先等布局落定、每次点击前用 `elementFromPoint` 验证命中再点；
   三次真实物理点击后状态仍不翻转才 FAIL，判定不放宽。设置页导航失败按 BLOCKED 记，不冤枉产品。

观测/输入契约：来源等级（自述 < 内部状态 < 公开接口 < 用户可见 < 持久化）、语义文本定位规则、
双通道策略、输入序列与两路径差异记录方式见 [`docs/real/observability.md`](../../docs/real/observability.md)。
页面里缺稳定钩子的地方逐条记在 [`docs/real/hook-gaps.md`](../../docs/real/hook-gaps.md)（交 #190）。

报告里 `environment.boundary` 的结构：

- `observations.*`：每个场景每条路径的原始观测（未解释的页面 JSON）；
- `diffs.*`：两路径的行为差分（`diffObservations`，必须 0 条）与事件序列差异（`diffEventSequences`，
  预期差异写明：物理独有 pointer 序列、合成 click 非 trusted）；
- `sourceOrder` / `inputMethods` / `completedScenarios` / `fixture`：来源等级图例、两条路径方法说明、
  场景进度与 fixture 声明。

套件共用的句柄（`observe` / `input` / `persistence`）由 `run.mjs` 在 preflight 与起始态断言通过后
统一创建并传给套件；套件不自己连 CDP、不自己拼 HTTP。命令行的 `--suite boundary` 在 preflight
或起始态 BLOCKED 时同样**不会执行**。

纯 Node 自证（不需要浏览器/宿主）：

    node scripts/real/harness/observe/selftest.mjs
    # RESULT: 202 PASS / 0 FAIL（观测层自证全绿）

覆盖：来源等级模型、语义文本定位、扁平差分与双通道、输入序列构造、六面解释器（合成 RAW 快照）、
句柄装配（`snapshotExpression()` 可解析、接口封闭、参数校验）。

## 验收对照（#184）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 一条命令完成装配→起服→接浏览器→检查→报告→清理，成功退出 0 | `node scripts/real/run.mjs --artifact <tgz>` | 终端摘要 + `report.json` 的 `verdict=PASS` |
| 报告落盘且机器可读，覆盖 provenance | `report.json`（schemaVersion=1）：产物 name/version/sha256、宿主 CLI 与版本、浏览器路径与 Edg/版本、runTag、startedAt/finishedAt、checks[] | `.tmp-real/<runTag>/report.json` |
| 不碰真实 profile/数据；端口、进程、临时目录回收 | 临时 `DSH_HOME` + 临时浏览器 user-data-dir；收尾杀进程树、等端口释放、删本次运行目录（空了再删 workRoot） | `environment.cleanup`：`serverPortFree`、`browser.exited`、`browserCdpPortFree`、`workDirRemoved`、`workRootRemoved` |
| 换 DSH_HOME / 空闲端口 / 浏览器 profile 仍通过 | 全部来自绑定层，不写死默认路径；一次性 home、随机调试端口、临时 user-data-dir | `--workdir <alt> --evidence-dir <alt> --port <n>` 再跑一遍同样 PASS |
| 缺浏览器 / 宿主 CLI / 产物时给可操作错误 | 解析绑定阶段就失败，退出码 2，错误指名依赖与修法，无堆栈 | `[real][BLOCKED] 指定的无头浏览器不存在：…` |
| 冒烟不用内部类名、不做像素级判定 | 只用 `data-dsh-prompt-*` 观测钩子与可见文案；矩形只用于「有尺寸/可见」判断，不比像素 | `suites/smoke.mjs`、`harness/page.mjs` |

负例自检（都应退出码 2、且不打印堆栈）：

    node scripts/real/run.mjs
    node scripts/real/run.mjs --artifact <tgz> --browser C:\nope\msedge.exe
    node scripts/real/run.mjs --artifact <tgz> --dsh-cli C:\nope\dsh.cmd
    node scripts/real/run.mjs --artifact D:/nope.tgz

换绑定自检（不同 home / 端口 / 证据目录）：

    node scripts/real/run.mjs --artifact <tgz> --workdir D:/Temp/alt-real --evidence-dir D:/Temp/alt-evidence --port 59661

## 验收对照（#187）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 同一套件同一声明初始态连跑两次结果一致 | 每轮一次性 home、独立 runTag 目录；`clean` 连跑两次 | 两份 `report.json` 的 `verdict` / `summary` / `checks[]` 完全一致（忽略时间与 runTag） |
| 至少三类初始态可声明 | 模板集合（`templates`）、触发模式（`trigger-hover`）、远程开关类偏好（`remote-prefs`）各跑一次 | 各报告 `environment.fixture.declared` 与 `.observed` |
| 起始态与声明不符 → BLOCKED、列 current vs expected、无假 FAIL | `--fixture-fault pollute` 注入脏状态 | `checks[]` 只有一条 `BLOCKED fixture 起始态`（FAIL 0，套件检查 0 条），退出码 2 |
| 每轮 run tag 唯一并写入报告；不污染真实用户数据 | `makeRunTag` 时间戳+pid/序号+随机段；store 路径守卫 | `report.json.runTag`；`environment.fixture.storePath` 在一次性 home 内、`storeGuard.ok=true` |
| 失败后重跑无需人工清理 | 同一命令去掉 `--fixture-fault` 直接重跑 | 失败后下一份 `report.json` 的 `verdict=PASS`，无手工清理步骤 |

## 验收对照（#188）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 至少 3 个代表性场景只写布置与断言即可运行 | `suites/boundary.mjs`：打开面板 / 行插入落位 / 设置页控件切换 | `report.json.checks[]` 与 `environment.boundary.observations` |
| 同场景物理指针与合成事件两条路径都执行并记录差异 | 场景 1、2 各跑物理路径 + `element.click()` 路径；两路原始观测进报告，行为差分 0 条断言、事件差异清单进 `boundary.diffs` | `environment.boundary.observations.scenario1Physical/.scenario1Synthetic`、`diffs.scenario1Behavior/.scenario1Events`、`diffs.scenario2Behavior` |
| 每条检查标来源、关键检查双通道 | `assertField(..., {source})` 每个断言带来源等级；行身份/勾选状态/触发方式/usage/lastUsed 各用 `compareDualChannels`（界面或公开接口 ↔ store） | `checks[]` 的 detail 含 `source=`；双通道断言名以「双通道」开头 |
| 光标/字节级断言不依赖截图 | 草稿文本逐字比较 + `captureInsertion` start/end + DOM 选区偏移；截图只作辅助证据 | 场景 2 的「逐字/光标」检查（FAIL 时带 expected/observed） |
| 观测层不依赖内部类名，缺失钩子记成契约项 | `probes.mjs` 只用 `data-dsh-prompt-*`、`role`/`aria-*`/`contenteditable`；缺口逐条在 `docs/real/hook-gaps.md` | `hook-gaps.md` 的 G1–G9 / H1–H2 |

## 验收对照（#190）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 契约文档列稳定钩子与语义、标注调试用 | `docs/real/hooks.md` 按 9 个区域登记 96 个「可依赖」+ 41 个「仅调试用」，逐项写属性名/所在元素与区域/语义/稳定性/首次引入版本 | 门禁 `PASS: 契约文档可解析 — 137 行登记，可依赖 96 / 仅调试用 41` |
| 构建产物断言必需钩子，移除一个即红 | `scripts/check-real-hooks.mjs` 扫 `lib/client.js`；`--selftest` 把真实产物复制到系统临时目录删一个必需钩子，断言恰好报这一条 | `PASS: 真实产物删一个必红` + `PASS: 必需钩子齐全 — 96 个` |
| 诊断开关默认关、可显式开、可重复开闭、不污染 UI/常规日志 | `src/client/index.ts` 的 `installDiag`：URL `?dsh-prompt-diag=1` / localStorage / 控制台 `__dshPromptDiag.enable/disable`；默认零 window 对象、零监听、零 console；快照只读聚合 | 门禁 `PASS: 诊断开关标记齐全`；设计与格式见 `docs/real/hooks.md` §5 |
| 真机用例只依赖契约钩子/语义文本 | `docs/real/hooks.md` §1/§3；调试用钩子明确不承诺稳定 | smoke 套件 3 个配方各 `PASS 12 / FAIL 0` |
| 契约变更需同步门禁与文档（有检查提示） | 文档 ↔ 门禁双向交叉校验（缺一行、多标一个都红）；README 与 hooks.md 都写明「产品/文档/门禁」三处同步流程 | selftest 的「文档缺一行必红」「文档多标可依赖必红」 |

## 与 spec #183 的关系

本 kit 是 #183 的 T1（#184）：只交付「一条命令起可丢弃宿主并跑通一个套件」的骨架。
#185 已在此骨架上补宿主契约与运行前 preflight（见 `docs/real/host-contract.md`）。
#186 补真机脚本静态门禁与 CI（见 `docs/real/static-gate.md`）。
#187 补声明式 fixture 与干净态基线（见 `docs/real/fixture.md`）。
#188 补边界观测层与真实输入驱动（见 `docs/real/observability.md`、`docs/real/hook-gaps.md`）。
#190 补插件测试钩子契约与诊断输出（见 `docs/real/hooks.md`）。
后续票在此基础上补：判定分类与证据报告（#189）、差分运行器（#191）、
pilot 迁移与复用证明（#192）、方法层分发（#193）。
