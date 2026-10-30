# 真机测试 kit

一条命令装配**一次性 DSH web 宿主**、安装被测插件产物、起无头浏览器、跑套件、留证据。
它服务的是「换机器/换宿主版本/换插件也能复现」的真机验收，不是某台开发机的脚本集合。

## 快速开始

前置：Node >= 22、DSH CLI（在 PATH 或显式指定）、Edge / Chrome / Chromium 任一。

    npm run real:smoke -- --artifact D:/path/to/dsh-prompt-x.y.z.tgz

或直接：

    node scripts/real/run.mjs --artifact D:/path/to/dsh-prompt-x.y.z.tgz --suite smoke

跑完看两处：

- 终端摘要（PASS / FAIL / BLOCKED / N-A、FAIL 分型与证据路径）；
- 证据目录 `.tmp-real/<runTag>/`：`report.json`（唯一事实源）、`report.md`（由 JSON 生成的摘要，
  可直接贴 issue）、`shots/*.png`、失败时的 `artifacts/*`。

套件执行前会先跑**宿主契约 preflight**（6 项，见 `docs/real/host-contract.md`）：
任何一项与钉住的宿主版本行为不符，只记一条指名契约项的 BLOCKED、跳过套件、退出码 2，
不会把"宿主没就绪"误报成产品 FAIL。

之后还会断言**起始态 = 声明值**（fixture，见 `docs/real/fixture.md`）：不符只记一条
`BLOCKED fixture 起始态`、跳过套件、退出码 2，不会把状态污染误报成产品 FAIL。

## 方法层分发（#193）

方法（怎么立论、怎么反审、怎么判分型、机器绑定边界）与实现（本目录的 kit）分开管理：

- 仓内 skill（单一事实源）：`skills/real-evidence/SKILL.md`，分发与安装步骤见该文件「安装与分发」一节；
- 30 分钟 onboarding：`docs/real/onboarding.md`；
- 机器绑定边界：`docs/real/boundary-policy.md`；
- 分层与分发决策：`docs/adr/0011-real-test-kit-layering.md`；
- 文档索引：`docs/real/README.md`。

方法层文档由 `node scripts/check-real-method.mjs --selftest && node scripts/check-real-method.mjs` 校验
（零机器绑定值 + skill 契约常量与 `harness/report/model.mjs` 同步）。

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
| `--suite <name>` | — | 套件：`smoke`（宿主回路自检）/ `boundary`（边界观测 × 真实输入）/ `undo-group`（撤销分组迁移）/ `trigger`（触发/插入域），后三者见下文 |
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
| 0 | 全部 PASS（只有预期失败也算 0） |
| 1 | 有非预期 FAIL（产品/规格/测试层面的期望不成立） |
| 2 | BLOCKED（装配/宿主契约/起始态没就绪）或参数错误（含未知套件、fixture 名拼错） |
| 3 | 工具故障（harness/CDP/驱动/运行器自身异常；不得冒充产品失败） |

判定只有四类：`PASS` / `FAIL` / `BLOCKED` / `N-A`。
`FAIL` 必带证据六元组与分型（`product` 产品缺陷 / `spec` 规格缺陷 / `test` 测试假象 / `tool` 工具故障）
及分型依据，并保存失败产物或写明 `artifactsWhy`；`BLOCKED` 必须写原因（`blockerKind` 区分环境/工具）；
`N-A` 必须写原因（无理由直接抛错，不转 FAIL、不留下残缺检查）。
预期失败（差分/负例）用 `expectedFailure: true` 标记，不计入产品 FAIL、退出码按 0 计；
声明「应该红」的用例没红会额外记一条「无区分力」失败。
整体结论：有非预期 FAIL 即 FAIL，否则有 BLOCKED 即 BLOCKED，否则 PASS。
完整语义、分型判据、六元组、产物规则、JSON schema v2 与 Markdown 生成规则见
[`docs/real/report.md`](../../docs/real/report.md)。

## 证据格式

同目录两份文件，**`report.json` 是唯一事实源，`report.md` 由它生成**（同 JSON 两次生成字节相同）：

`report.json`（`schemaVersion=2`）包含：

- `runTag` / `suite` / `verdict` / `startedAt` / `finishedAt` / `exitCode`；
- `meta`：产物 name/version/fileName/sizeBytes/sha256、宿主 CLI 与 runtime 版本、浏览器与 runtime、
  fixture、locale/时区、证据目录（Markdown 环境表由它生成）；
- `environment`：平台、Node 版本、宿主 CLI 路径与版本、浏览器路径与运行版本、profile、服务 URL（token 打码）、
  页面事实、超时配置、当前阶段、`fixture`（配方名/参数/重置与种子结果/声明 vs 实测基线/差异）；
- `checks[]`：每条带证据六元组 `claim` / `conditions` / `steps` / `observations` / `inference` / `verdict`；
  沿用 v1 的 `expected` / `observed` / `detail` / `reason`；FAIL 追加
  `failureType` + `failureTypeBasis` + `expectedFailure` + `artifacts[]`/`artifactsWhy`；
  BLOCKED 追加 `reason` + `blockerKind`；N-A 追加 `reason`；
- `summary`：四类计数 + 预期失败 / FAIL 分型 / 工具故障 / flakySuspect 细分；
- `failures[]` / `expectedFailures[]`：非预期失败与预期失败分区；
- `artifacts[]` 引用：`{kind,name,file,relative,bytes}`，`file` 是本机绝对路径，`relative`
  是以 `artifacts/` 开头的安全相对路径（Markdown 只写相对路径）。

## 模块地图

    scripts/real/
      run.mjs              入口：编排与退出码
      diff.mjs             差分入口：同一套件/协议分别跑旧基线/当前产物（或 干净/注入）→ diff.json + diff.md
      harness/
        bindings.mjs       运行期绑定：产物/CLI/浏览器/目录/超时/参数
        profile.mjs        一次性 profile 装配与安装校验
        server.mjs         宿主 Web 服务生命周期
        browser.mjs        无头浏览器生命周期
        cdp.mjs            最小 CDP 客户端（Page/Runtime/Input/Log）
        page.mjs           页面准备、按契约收启动遮罩、观测助手
        evidence.mjs       判定、证据、报告 schema、唯一 run tag
        report/
          model.mjs        判定模型：四类判定 / FAIL 四分型 / 退出码 / 六元组校验 / schema 校验
          markdown.mjs     report.json → report.md 的纯函数渲染（确定性、不读时钟）
          artifacts.mjs    失败产物仓库与自动采集（截图/页面状态/store/输入日志）
          index.mjs        报告层统一入口
          selftest.mjs     判定分类与证据报告自证（纯 Node，零浏览器/零宿主）
        diff/
          classify.mjs     检查对照与区分力分类（有区分力/回归/两侧都绿/阻塞/缺失）
          expect.mjs       期望清单加载/匹配/评估；fault 模式评估（注入侧红即检出）
          baseline.mjs     旧产物基线登记表与缓存解析（登记不写机器绝对路径）
          model.mjs        diff.json 文档模型与整体判定（纯函数）
          render.mjs       diff.json → diff.md 确定性渲染
          index.mjs        编排：子进程跑两侧 + 汇总 + 落盘
          selftest.mjs     差分判定自证（纯 Node，零浏览器/零宿主）
        fault/
          injectors.mjs    三个故障注入器（可逆、默认关闭、带期望变红清单）
          index.mjs        注入器安装/卸载编排（半装回滚）
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
        undo-group.json    撤销分组夹具：含标记单行/多行 + 无标记，模板名/id 带 ${runTag}
        trigger-hover.json 触发模式：悬浮触发（显式钉住）
        trigger-click.json 触发模式：点按触发（留给 trigger 套件的 click 态场景）
        remote-prefs.json  远程开关类偏好（总闸关 + 尺寸/方向/密度非默认）
      suites/
        smoke.mjs          回路自检套件
        boundary.mjs       边界观测 × 真实输入套件（物理指针 vs 合成点击、双通道）
        undo-group.mjs     #192 迁移：撤销分组 / redo 真机验收（只布置 + 断言）
        trigger.mjs        #192 第二条套件：触发/插入域（真实指针路径 + 真实键盘路径 + 双通道）

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

## 撤销分组套件：旧 pilot 迁移（#192）

`--suite undo-group` 是把 `scripts/repro/real/issue-181-real.mjs`（#181 的撤销分组真机 pilot）迁到
kit 上的产物；pilot 已删除，仓内不再保留它自带的 CDP 客户端、`PAGE_API` 探针与 `window.__IA` 包裹。
迁移边界：**只做布置 + 断言**，装配/观测/输入/判定/证据全部走 harness：

    node scripts/real/run.mjs --artifact <tgz> --suite undo-group --fixture undo-group --evidence-dir D:/Temp/evidence-192

- 覆盖旧 pilot A1–A5：非空草稿末尾/中间 + 含标记单行、空草稿 + 含标记多行、无标记插入非空/空草稿；
  每个场景用**真实物理点击**模板行插入，真实键盘 `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` 验证 undo
  分组与 redo；落点断言 = composer 草稿字节 + DOM 选区/captureInsertion，不拿截图当主证据。
  草稿布置用宿主单笔文本插入（对齐 pilot 的 `c.insertText`，避免逐键输入被拆成多条 undo 记录）；
  A2–A5 进入前**重新加载页面**（对齐旧 pilot 每场景 boot 一次），不把上一场景的 undo 历史带进来。
- 旧 pilot 的 A6（降级路径）、A6-8（chip 草稿）、A7（提交/重载）、B1/B2（失焦落点 == 旧包 0.4.39
  基线）逐条 `N-A` 记账，不静默丢：降级由 #191 的 `--fault input-actions-missing` 覆盖，B 组旧包
  基线对照由 #191 差分运行器覆盖（同一套件/配方，旧产物 vs 当前产物）。
- `#187` fixture 新增 `undo-group.json`（3 条模板、名字/id 带 `${runTag}`），套件按可见名称定位行。

## 第二条套件：触发/插入域（#192）

`--suite trigger` 证明观测层/输入驱动/判定协议能承载**另一个域**的验收，而不是只为 boundary 写死：

    node scripts/real/run.mjs --artifact <tgz> --suite trigger --fixture trigger-hover --evidence-dir D:/Temp/evidence-192

- **真实指针路径**：物理悬停入口开面板 → 移开关面板 → 物理点底栏触发方式胶囊切到「仅点击」→
  移开后再悬停入口不再开窗（#179 契约）→ 物理点入口开面板 → 物理点关闭按钮收起；
- **真实键盘路径**：DOM focus + `Enter` 打开/关闭入口面板、`Enter` 切回悬浮触发、逐键
  `keyDown/keyUp` 在 composer 输入文本；
- **双通道**：每个模式切换点同时断言界面语义（`aria-pressed` / panel 可见性）与持久化 store
  （`hoverTrigger` 读回落盘值），避免只看界面自述；
- 不复制 harness/CDP/HTTP：套件里没有 CDP 客户端、没有页面探针、没有自拼请求。

## 差分运行器：旧产物基线 + 故障注入（#191）

差分回答的不是「谁绿谁对」，而是「这条断言到底能不能区分旧/坏与修好」：

- **artifact 模式**（默认）：同套件、同 fixture、同判定/证据协议，分别安装旧产物与当前产物各跑一轮，
  逐检查对照 → `diff.json`（唯一事实源）+ `diff.md`（由 JSON 确定性渲染，可直接贴 issue）。
- **fault 模式**（显式 `--fault`）：当前产物干净跑一轮作对照，当前产物 + 故障注入再跑一轮；
  注入器声明「期望变红的检查」，证明这些断言对注入敏感。注入**默认关闭**，只在显式 `--fault` 时生效、可逆。

    node scripts/real/diff.mjs --artifact <当前产物.tgz> --baseline-artifact <旧产物.tgz> --suite boundary --fixture templates --evidence-dir <证据目录>
    node scripts/real/diff.mjs --artifact <当前产物.tgz> --fault insert-coordinate-offset --suite boundary --fixture templates

判定：

- 分类 `discriminating`（旧红 → 当前绿 = 有区分力）/ `regression`（旧绿 → 当前红，变差，必须醒目）/
  `bothGreen`（两侧都绿 = 无区分力/无证据力，**不得判通过**）/ `bothRed` / 阻塞与缺失变体；
- 期望清单是纯数据 `scripts/real/diffs/<suite>.expect.json`：`mustFlipRedOnBaseline` 任一项没在旧产物下红
  → 整体 FAIL（退出码 1）；`mustStayGreen` 在旧产物下红 = 基线/环境问题（按原因 FAIL / BLOCKED）；
- fault 模式的期望由注入器元数据派生：注入侧必须红；对照侧若记录到该检查必须绿（条件性检查只在失败时
  记录，对照侧无记录属正常）；注入侧出现未声明的红 → FAIL（影响面大于声明）；
- 退出码与报告层同语义：0 通过 / 1 有区分力问题或回归 / 2 阻塞 / 3 工具故障。

旧产物基线可复现地生成与复用（`baselines.json` 只登记文件名/sha256/来源，不写机器绝对路径）：
`--baseline-artifact` 直传，或缓存目录 + 登记表按 name/sha256/fileName 解析。生成方法、清单写法、
注入器清单与真机证据见 [`docs/real/diff.md`](../../docs/real/diff.md)。

纯 Node 自证（不需要浏览器/宿主）：

    node scripts/real/harness/diff/selftest.mjs
    # [diff-selftest] PASS 38 项（差分判定/期望清单/基线登记/注入器/退出码/CLI）

## 验收对照（#191）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 一条命令跑旧/当前产物并产出 diff.json + diff.md | `diff.mjs` 子进程调 `run.mjs`，两侧各自 evidence 子目录，读两份 report.json 汇总 | `<evidence-dir>/diff.json`、`diff.md`；`reference/`、`candidate/` 子报告 |
| 区分力分类，bothGreen 明确不判通过 | `classify.mjs` 分类 + `expect.mjs` 规则；bothGreen 进 mustFlip 即 FAIL | `harness/diff/selftest.mjs` 分类与负例用例 |
| mustFlip 未翻转 → FAIL | 0.4.39（pack-183）基线跑 boundary：两侧全绿 → `no-discrimination`，exit 1 | `D:/Temp/evidence-191/diff-negative-pack183/diff.json` |
| 真机旧红/当前绿 | 0.4.32 基线：⑥触发按钮检查旧红当前绿，其余两侧都绿（=无证据力） | `D:/Temp/evidence-191/diff-positive-0432/diff.json` |
| 三种故障注入可逆、默认关闭、报告标出注入点与命中检查 | `--fault` 注入器；`environment.faults` 记元数据与安装/卸载证据；fault 模式 diff 证明注入侧按预期红 | `D:/Temp/evidence-191/diff-fault-*/diff.json`；run.mjs 注入轮 `report.json` |
| 清单/基线登记纯数据、不写机器路径 | `scripts/real/diffs/boundary.expect.json`、`baselines.json`（sha 锚） | selftest 校验结构 + 引用检查名存在于套件源码 |
| 默认路径对既有 check 零影响 | 新增命令独立；`run.mjs` 无 `--fault` 时零包装 | `node scripts/real/diff.mjs --help` exit 0；`npm run check` 链不变 |

纯 Node 自证（不需要浏览器/宿主）：

    node scripts/real/harness/observe/selftest.mjs
    # RESULT: 202 PASS / 0 FAIL（观测层自证全绿）

覆盖：来源等级模型、语义文本定位、扁平差分与双通道、输入序列构造、六面解释器（合成 RAW 快照）、
句柄装配（`snapshotExpression()` 可解析、接口封闭、参数校验）。

## 验收对照（#184）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 一条命令完成装配→起服→接浏览器→检查→报告→清理，成功退出 0 | `node scripts/real/run.mjs --artifact <tgz>` | 终端摘要 + `report.json` 的 `verdict=PASS` |
| 报告落盘且机器可读，覆盖 provenance | `report.json`（`schemaVersion=2`）：`meta` 里的产物 name/version/sha256、宿主 CLI 与版本、浏览器与 Edg/ 运行版本、runTag、startedAt/finishedAt；`checks[]` 带六元组 | `.tmp-real/<runTag>/report.json` |
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

## 判定分类与证据报告（#189）

报告层把「怎么判、凭什么判、证据在哪、下次怎么复现」固定成协议（完整说明见
[`docs/real/report.md`](../../docs/real/report.md)）：

- 判定四类 `PASS` / `FAIL` / `BLOCKED` / `N-A`；FAIL 四分型 `product`/`spec`/`test`/`tool` 并带分型依据
  （`failureTypeBasis`），工具故障不冒充产品失败；
- 每条检查带证据六元组 `claim` / `conditions` / `steps` / `observations` / `inference` / `verdict`，
  原始观测与推断分字段；`conditions` 由轮次环境（产物/宿主/浏览器/fixture/runTag）自动补全；
- 失败产物写 `<evidence-dir>/<runTag>/artifacts/`（截图 / 页面状态 / store / 输入日志），
  检查上记 `artifacts[]` 或 `artifactsWhy`；`run.mjs` 在套件之后、清理之前自动采集；
- `report.md` 由 `report.json` 生成（同 JSON 两次生成字节相同），含环境与版本、判定统计、失败明细
  （分型 + 六元组）、预期失败、阻塞、N/A、证据路径，可直接贴 issue；
- 退出码收紧为 0 全绿 / 1 真实 FAIL / 2 BLOCKED（含参数错误）/ 3 工具故障（见上文「退出码与判定」）。

预期失败（差分/负例，供 #191）：`recorder.expectFail(name, …)` 或 `fail({expectedFailure:true})`
（票面简写 `fail({expected:true})` 亦可）不计产品失败；`expectFailures([...])` 声明「本轮应该红」的用例，
没红会追加一条「预期失败未成立：<name>」的真实 FAIL（分型 `test`，注明无区分力）。

六元组示范：`suites/smoke.mjs` 的「悬停打开模板面板」「显式关闭面板」两条 PASS 检查显式写了
`claim` / `steps` / `observations` / `inference`，其余字段由记录器从轮次环境补全。

纯 Node 自证（不需要浏览器/宿主，覆盖四类判定、四分型、六元组、预期失败、产物、Markdown 一致性、退出码）：

    node scripts/real/harness/report/selftest.mjs
    # RESULT: 202 PASS / 0 FAIL（判定分类与证据报告自证全绿）

落盘样例（每个目录 `report.json` + `report.md`，可直接打开对照）：

    node scripts/real/harness/report/selftest.mjs --out <目录>

## 验收对照（#189）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 四类判定，N-A 必须理由 | `harness/report/model.mjs`；`Recorder.na()` 缺 reason 抛 `ReportError` 且不记录 | `report/selftest.mjs` A/B/E 节（N-A 无理由被拒） |
| FAIL 四分型 + 分型依据 | `classifyFailure` 按显式 > 不可复现 > HarnessError > 驱动异常 > 超时/元素缺失 > 断言 的优先级推断，套件可显式覆盖 | `report/selftest.mjs` C 节（product/spec/test/tool 全覆盖与优先级） |
| 预期失败不计产品失败且可对账 | `expectedFailure` 标记进 `expectedFailures[]`、`summary.FAIL` 不计数、退出码 0；`expectFailures` 声明没红 → 追加「无区分力」真实 FAIL | `report/selftest.mjs` F 节（F7/F12/F13/F18/F19/F20） |
| 退出码 0/1/2/3，参数错误保持 2 | `exitCodeFor` 映射与 `run.mjs return report.exitCode`；参数/套件/fixture 错误仍 2 | `report/selftest.mjs` J 节矩阵；`run.mjs` 快速开始负例 |
| 每条检查带证据六元组 | `Recorder._enrich` 自动补全，显式字段优先；缺字段报告校验拒绝 | `report/selftest.mjs` D 节（D2–D20） |
| FAIL 产物或 artifactsWhy | `captureFailureArtifacts` 采截图/页面状态/store/输入日志；`writeReport` 兜底补说明 | `report/selftest.mjs` G 节（真实落盘、自动采集、部分/全部缺失） |
| Markdown 由 JSON 生成且一致 | `writeReport` 先序列化 JSON、再解析同一份渲染；`renderMarkdown` 纯函数 | `report/selftest.mjs` H 节（H1/H2/H3/H4 字节相同） |
| JSON schema v2 且向后兼容 v1 | `schemaVersion=2`；v1 顶层字段与 checks 既有字段保留；旧套件调用不受影响 | `report/selftest.mjs` I 节（I1–I21）；contract/fixture/observe 三个既有自证全绿 |
| 真机可用 | `--suite boundary --fixture templates` 一轮 PASS 并产出 `report.json` + `report.md` | `.tmp-real/<runTag>/report.json`、`report.md` |

## 验收对照（#190）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| 契约文档列稳定钩子与语义、标注调试用 | `docs/real/hooks.md` 按 9 个区域登记 96 个「可依赖」+ 41 个「仅调试用」，逐项写属性名/所在元素与区域/语义/稳定性/首次引入版本 | 门禁 `PASS: 契约文档可解析 — 137 行登记，可依赖 96 / 仅调试用 41` |
| 构建产物断言必需钩子，移除一个即红 | `scripts/check-real-hooks.mjs` 扫 `lib/client.js`；`--selftest` 把真实产物复制到系统临时目录删一个必需钩子，断言恰好报这一条 | `PASS: 真实产物删一个必红` + `PASS: 必需钩子齐全 — 96 个` |
| 诊断开关默认关、可显式开、可重复开闭、不污染 UI/常规日志 | `src/client/index.ts` 的 `installDiag`：URL `?dsh-prompt-diag=1` / localStorage / 控制台 `__dshPromptDiag.enable/disable`；默认零 window 对象、零监听、零 console；快照只读聚合 | 门禁 `PASS: 诊断开关标记齐全`；设计与格式见 `docs/real/hooks.md` §5 |
| 真机用例只依赖契约钩子/语义文本 | `docs/real/hooks.md` §1/§3；调试用钩子明确不承诺稳定 | smoke 套件 3 个配方各 `PASS 12 / FAIL 0` |
| 契约变更需同步门禁与文档（有检查提示） | 文档 ↔ 门禁双向交叉校验（缺一行、多标一个都红）；README 与 hooks.md 都写明「产品/文档/门禁」三处同步流程 | selftest 的「文档缺一行必红」「文档多标可依赖必红」 |

## 验收对照（#192）

| 验收项 | 怎么满足 | 证据 |
| --- | --- | --- |
| pilot 经 kit 运行判定与迁移前一致，偏差有记录 | 迁移前用 kit harness 起环境、spawn 旧 pilot 得到 `ALL PASS 58/58`（acceptance 9/9）作基线；迁移后 `undo-group` 套件 `PASS 44/0/0`，A1–A5 逐条对齐旧断言 id；A6/A7/B1/B2 显式 `N-A` 并写明由 #191 覆盖 | `D:/Temp/evidence-192-legacy/bridge-summary.json`、`D:/Temp/evidence-192/<runTag>/report.json` 的 `checks[]` 与 `environment.undoGroup` |
| 第二条套件只含场景与断言，无 harness/CDP 重复 | `suites/trigger.mjs` 只 import `errors` / `sleep` / `compareDualChannels`，装配/观测/输入/持久化/判定全部用 run.mjs 传入的句柄；静态门禁 R4/R5 对套件 0 违规 | `node scripts/check-real-gate.mjs` 0 FAIL；`trigger.mjs` 头注与 import 段 |
| 仓内不再保留被迁移套件私有客户端/探针重复 | 删除 `scripts/repro/real/issue-181-real.mjs`（含私有 CDP 客户端、`PAGE_API`、`window.__IA` 包裹）；`exemptions.json` 清空；门禁自证 + 正式扫描全绿、`PILOT_REL` 只留 INFO | `git status`（删除文件）、`scripts/real/gate/exemptions.json`、`check-real-gate --selftest` 与正式扫描输出 |
| 两套件同入口、同 fixture 语义、同证据协议，报告可并列比较 | `run.mjs` 的 `SUITES` 注册 `undo-group` / `trigger`；两者都走 preflight → fixture 起始态 → recorder 六元组 → `report.json`/`report.md`；差异只在 `environment.<suite>` 与 `checks[]` | `D:/Temp/evidence-192/` 下两份报告（`schemaVersion=2`、相同环境字段结构） |
| 第二条套件覆盖 ≥1 真实指针路径 + ≥1 键盘路径 | T1：物理悬停/点击/移开（事件 `isTrusted=true` 断言）；T2：`focus` + `Enter` 开关面板、切触发方式，逐键 `keyDown/keyUp` 输入 `kbd` | `report.json` 的 T1/T2 检查与 `environment.trigger.observations` |
| 迁移前后判定对照与真机连跑一致 | 每套件连跑两次（两轮 runTag），判定均为 PASS；对照表见交付报告（旧 pilot id → kit check 名 → 判定） | `D:/Temp/evidence-192/` 两轮 runTag 子目录各含 `report.json` |

## 与 spec #183 的关系

本 kit 是 #183 的 T1（#184）：只交付「一条命令起可丢弃宿主并跑通一个套件」的骨架。
#185 已在此骨架上补宿主契约与运行前 preflight（见 `docs/real/host-contract.md`）。
#186 补真机脚本静态门禁与 CI（见 `docs/real/static-gate.md`）。
#187 补声明式 fixture 与干净态基线（见 `docs/real/fixture.md`）。
#188 补边界观测层与真实输入驱动（见 `docs/real/observability.md`、`docs/real/hook-gaps.md`）。
#189 补判定分类、证据六元组、失败产物、JSON/Markdown 报告与退出码（见 `docs/real/report.md`）。
#190 补插件测试钩子契约与诊断输出（见 `docs/real/hooks.md`）。
#191 补差分证伪层：旧产物基线对照 + 三种故障注入，证明关键断言确实会红（见 `docs/real/diff.md`）。
#192 把 #181 撤销分组 pilot 迁进 `suites/undo-group.mjs` 并删除旧文件与门禁例外，同时新增第二条真实
套件 `suites/trigger.mjs`（触发/插入域，真实指针 + 真实键盘 + 双通道），证明观测层跨场景复用。
后续票在此基础上补：方法层分发（#193）。
