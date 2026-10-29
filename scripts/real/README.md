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

## 它做了什么

1. 在临时目录建一次性 `DSH_HOME`；
2. `--from-default-profile web --dump-config` 生成 web profile 骨架（只写配置，不启动）；
3. `dsh plugin --profile real add file:<产物>` 把被测包装进这个 profile，并校验版本；
4. `dsh --profile real --port 0 --no-open` 起服务，解析 stdout 里的访问 URL；
5. 起无头浏览器（临时 user-data-dir，随机调试端口），CDP 连接页面；
6. 收掉宿主启动说明遮罩（优先点「继续」类真实按钮，没有可点按钮才隐藏）、等插件入口 `[data-dsh-prompt-entry]` 出现；
7. 跑套件、收集判定、截图；
8. 杀进程树、确认端口释放，按需清理一次性工作目录。

## 参数与环境变量

| 参数 | 环境变量 | 说明 |
| --- | --- | --- |
| `--artifact <path>` | `DSH_REAL_ARTIFACT` | 被测插件 .tgz（必要） |
| `--suite <name>` | — | 套件，目前只有 `smoke` |
| `--dsh-cli <path>` | `DSH_REAL_DSH_CLI` / `DSH_CLI` | DSH CLI，缺省查 PATH |
| `--browser <path>` | `DSH_REAL_BROWSER` / `CHROME_PATH` / `EDGE_PATH` | 浏览器可执行文件 |
| `--workdir <path>` | `DSH_REAL_WORKDIR` | 一次性工作目录根，缺省系统临时目录 |
| `--evidence-dir <path>` | `DSH_REAL_EVIDENCE_DIR` | 证据根目录，缺省仓库 `.tmp-real/` |
| `--port <n>` | — | 宿主端口，缺省 0 由系统分配 |
| `--timeout-scale <x>` | `DSH_REAL_TIMEOUT_SCALE` | 超时倍率，慢机器用 |
| `--keep` | `DSH_REAL_KEEP=1` | 保留一次性工作目录 |

## 退出码与判定

| 退出码 | 含义 |
| --- | --- |
| 0 | 全部 PASS |
| 1 | 有 FAIL（产品行为不符合期望） |
| 2 | BLOCKED（装配/工具没就绪）或参数错误 |

判定只有四类：`PASS` / `FAIL` / `BLOCKED` / `N-A`。
FAIL 必须带 expected/observed，且可复现；BLOCKED 表示证据不足以下结论；N-A 必须写原因。
整体结论：有 FAIL 即 FAIL，否则有 BLOCKED 即 BLOCKED，否则 PASS。

## 证据格式

`report.json`（schemaVersion=1）包含：

- `runTag` / `suite` / `verdict` / `startedAt` / `finishedAt`；
- `environment`：平台、Node 版本、产物 name/version/sha256、宿主 CLI 路径与版本、浏览器路径与运行版本、profile、服务 URL（token 打码）、页面事实、超时配置、当前阶段；
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
        page.mjs           页面准备、登录遮罩处理、观测助手
        evidence.mjs       判定、证据、报告 schema
        proc.mjs           进程/端口底座（跨平台）
        errors.mjs         HarnessError / CheckFailure
      suites/
        smoke.mjs          回路自检套件

分层约定：方法层（协议与判据）与平台契约层（宿主行为事实）不写死在绑定层；
绑定层只回答「这台机器上这些东西在哪里、超时多少」。

## 宿主契约现状

- **登录遮罩**目前用启发式识别并隐藏（body 直属、fixed、z-index>=100、覆盖视口 90% 以上），
  只是为了让未登录的一次性实例能操作页面；这是宿主契约的占位实现，正式契约见 #185。
- 插件入口/面板/关闭按钮的选择器（`data-dsh-prompt-*`）是插件提供的观测钩子契约，
  正式化见 #190。
- 预检（缺 CLI、缺浏览器、版本不对、端口占用）尽量在装配前失败并给可操作错误，完整 preflight 见 #185。

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

## 与 spec #183 的关系

本 kit 是 #183 的 T1（#184）：只交付「一条命令起可丢弃宿主并跑通一个套件」的骨架。
后续票在此基础上补：宿主契约与 preflight（#185）、静态门禁与 CI（#186）、fixture 与干净态（#187）、
边界观测与真实输入（#188）、判定分类与证据报告（#189）、插件测试钩子（#190）、
差分运行器（#191）、pilot 迁移与复用证明（#192）、方法层分发（#193）。
