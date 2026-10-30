# 真机测试 onboarding：从零到第一条检查

目标：**30 分钟内**，从一份干净仓库跑到第一份可读的真机证据，并知道下一条检查该加在哪里。
方法为什么要这样做，见用户级 skill `real-evidence`（仓内副本：`skills/real-evidence/SKILL.md`）；
机器绑定边界见 `docs/real/boundary-policy.md`。

## 0. 前置与环境准备（约 5 分钟）

需要三样东西，kit 会自己发现或从参数拿：

| 依赖 | 怎么被发现 | 找不到时 |
| --- | --- | --- |
| Node.js（>= 22） | 当前 `node` | 直接换 Node 22+ |
| DSH CLI | PATH；或 `--dsh-cli <path>` / 环境变量 | 报 `BLOCKED`，报告写明找不到 CLI |
| 浏览器（Edge / Chrome / Chromium 任一） | 常见安装位置自动探测；或 `--browser <path>` | 报 `BLOCKED`，按提示显式传路径 |

先做两条自检（不需要浏览器）：

    node -v
    node scripts/real/run.mjs --help

`--help` 能打出参数表，说明入口可用；参数与清洗后的环境变量含义见 `scripts/real/README.md`。

> 说明：以上都是**运行期绑定**——路径与可执行文件从参数/环境进入，不写死在文档与测试逻辑里。

**完成判据**：`node -v` 打出 22+ 的版本；`node scripts/real/run.mjs --help` 打出参数表且退出码 0。

## 1. 打一个被测产物（约 2 分钟）

    mkdir <pack-dir>
    npm pack --pack-destination <pack-dir>

得到一个 `<pack-dir>/dsh-prompt-<version>.tgz`。`--artifact` 指向它即可；不要解包，也不要改包内文件。

**完成判据**：`<pack-dir>` 下出现 `dsh-prompt-<version>.tgz`，文件名里的版本与 `package.json` 的 `version` 一致。

## 2. 跑第一轮检查（约 3 分钟）

用最小的 `smoke` 套件验证整条链路（宿主、插件安装、浏览器、CDP）：

    node scripts/real/run.mjs --artifact <pack-dir>/dsh-prompt-<version>.tgz --suite smoke --evidence-dir <evidence-root>

想一步看到真实交互，用 `boundary` 套件 + 模板配方：

    node scripts/real/run.mjs --artifact <pack-dir>/dsh-prompt-<version>.tgz --suite boundary --fixture templates --evidence-dir <evidence-root>

跑完先看终端：`runTag`、产物 sha256、宿主/浏览器、fixture 起始态、四类统计、证据路径。
退出码速查：`0` 全 PASS / `1` 有非预期 FAIL / `2` BLOCKED 或参数错误 / `3` 工具故障。

证据目录形如 `<evidence-root>/<runTag>/`：

- `report.json` —— **唯一事实源**；
- `report.md` —— 由 JSON 生成，可直接贴 issue；
- `shots/`、失败时的 `artifacts/`。

**完成判据**：终端打出 `runTag`、产物 sha256、宿主/浏览器、四类统计与证据路径；`<evidence-root>/<runTag>/report.json` 存在且 `schemaVersion=2`。

## 3. 读报告（约 5 分钟）

按顺序看 `report.json`：

1. `verdict` / `summary`：整体结论与四类计数；FAIL 再看 `failureTypes`。
2. `checks[]`：逐条看 `verdict`；非 PASS 的看 `reason` / `expected` / `observed`；
   关键检查看六元组 `claim` / `conditions` / `steps` / `observations` / `inference` / `verdict`。
3. `failures[]` / `expectedFailures[]`：非预期失败与预期失败分开读。
4. `artifacts[]`：失败产物；`relative` 是安全相对路径，`file` 是运行期绝对路径（provenance，不入库）。
5. `environment` / `meta`：这次判定的条件（产物哈希、宿主与浏览器运行时、fixture）。

判读要点：

- `BLOCKED` 表示**前置条件没就绪**，不是产品缺陷：先看 `blockerKind`（environment / tool），按原因补环境再跑；
- `FAIL` 必须带分型：`product`（产品坏）/ `spec`（规格可疑）/ `test`（假象、flaky）/ `tool`（工具坏）；
- `N-A` 必须写理由；没有理由的 N-A 属于报告不合法；
- 两侧都绿（bothGreen）的对照**没有证据力**，不要把它当通过。

完整协议（分型判据、六元组、schema v2、退出码）见 `docs/real/report.md`。

**完成判据**：能用自己的话说清本轮 `verdict`、每条非 PASS 检查的理由与分型、以及覆盖缺口（`N-A` / `BLOCKED`）落在哪。

## 4. 写第一条新检查（约 10 分钟）

不要新造运行器。选一个已有套件，在**场景里加一条断言**：

1. **找位置**：打开 `scripts/real/suites/<suite>.mjs`，找到目标场景的布置段落（打开面板/点行/切触发方式之后）。
2. **写布置**：只通过注入给套件的句柄（`observe` / `input` / `persistence` / `recorder`）操作与读取；不要直连 CDP、不要拼页面内部选择器。
3. **写断言**：优先双通道——界面可见状态 + 持久化读回；等待用 `observe.waitFor(predicate, { timeoutMs, label })`，label 写「等什么」。
4. **留六元组**：至少给 `claim` / `conditions` / `steps` / `observations` / `inference`；判定走 `recorder.pass/fail/blocked/na`。
5. **跑一条**：`node scripts/real/run.mjs --artifact <pack-dir>/dsh-prompt-<version>.tgz --suite <suite> --fixture <fixture> --evidence-dir <evidence-root>`，确认新检查出现在 `checks[]` 里。

断言模板（伪代码，字段语义见 `docs/real/report.md`）：

    const raw = await observe.waitFor(
      (snapshot) => snapshot.panel.visible === true,
      { timeoutMs, label: '等面板真正可见' },
    );
    recorder.fail('可读的检查名：期望 vs 实测', {
      claim: '物理悬停入口后，面板对用户可见',
      conditions: { suite, fixture: fixture.name },
      steps: ['把指针移到入口按钮', '等面板可见'],
      observations: { expected: true, observed: raw.panel.visible },
      inference: '面板未可见，且超时前末次快照仍是收起态。',
      // 产品期望不成立时默认 product；规格可疑写 spec；工具坏写 tool
    });

自检清单（提交前）：

- [ ] 检查名能读出「哪个区域/哪条事实」；
- [ ] 观测来源不是被测代码自述，且尽量双通道；
- [ ] 失败时能看出期望与实测，超时带末次观测；
- [ ] 没有把本机路径/端口/浏览器/locale 写进代码与断言（`node scripts/check-real-method.mjs` 与 gate 会拦文档，测试代码由 `scripts/check-real-gate.mjs` 拦）；
- [ ] 新检查能在坏的情况下红（做过一次反例：旧产物/注入/故意改错）。

**完成判据**：新检查出现在 `report.json` 的 `checks[]` 里、六元组齐全，并且做过一次反例让它红。

## 5. 30 分钟预算（#193 演练实测）

实测环境是一台热态开发机，数字只作量级参考；慢机器按比例放慢。

| 阶段 | 计划 | 实测（#193 演练） | 备注 |
| --- | --- | --- | --- |
| 前置自检 | 5 分钟 | 0.4 秒 | `node -v` + `--help` |
| 打包 | 2 分钟 | 62 秒 | `npm pack` 会先跑 `npm run build`，首次/冷构建更久 |
| 跑 smoke | 3 分钟 | 12.7 秒 | PASS 12 / exit 0 |
| 跑 boundary + templates | 3 分钟 | 10.1 秒 | PASS 44 / exit 0 |
| 读报告 | 5 分钟 | 约 2 分钟 | 读 `summary` + 一条六元组即可上手 |
| 写第一条检查 | 10 分钟 | 约 6 分钟（提案） | 见下方演练记录第 2 段 |

### #193 演练记录

1. **按本文件从零跑通**：前置自检 → 打包（62 秒，含 build）→ `smoke`（12.7 秒，PASS 12）→
   `boundary --fixture templates`（10.1 秒，PASS 44）→ 读 `report.json`（`schemaVersion=2`，
   44 条检查全 PASS，六元组与 conditions 齐全）。总耗时约 2 分钟（不含阅读与写检查），远低于 30 分钟预算。
2. **第 1 条新检查提案**（完整六元组与落点见 #193 报告；加进套件的位置：
   `scripts/real/suites/trigger.mjs` 的 `runTrigger` 场景 T1 末尾）：
   连续两次物理点击底栏触发方式胶囊后，界面 `aria-pressed` 与持久化 `hoverTrigger` 双双回到初始悬浮语义
   （连续切换幂等、双通道一致）。
3. **skill 安装可见性**：把仓内 `skills/real-evidence/` 复制到用户级 skill 根后，本会话的技能目录在同一轮内
   出现 `real-evidence`（宿主 watcher 刷新，无需重启）；安装动作只作为运行期操作，不写进仓库文件。

### 演练中发现并回填的卡点

- `npm pack` 在干净仓库会先执行构建（`prepare` 钩子），2 分钟预算偏紧 → 本页已注明"含构建、冷构建更久"。
- 若只看终端统计就贴结论，容易漏掉 `BLOCKED` 与 `FAIL` 分型的区别 → 「读报告」一节把两者处置分开写。
- 证据根不存在时运行器会自动创建；但证据根路径本身是运行期绑定，文档只写占位符 `<evidence-root>`。

## 6. 可移植四问

| 问题 | 答案 | 依赖什么 |
| --- | --- | --- |
| 换一台机器？ | 只改运行期参数：`--artifact`、`--dsh-cli`、`--browser`、`--evidence-dir` | 文档零机器值（本文件由门禁保证） |
| 换宿主版本？ | 先跑契约 preflight；不符会 BLOCKED 并指名契约项，不会误判产品 FAIL | `docs/real/host-contract.md` |
| 换插件？ | 方法层与报告协议复用，只重写套件的布置与断言 | `docs/real/report.md` |
| 换人复现？ | 按本文件顺序 + 报告六元组即可重放 | 本文与 `docs/real/observability.md` |

## 7. 常见卡点

- **fixture 起始态不符（BLOCKED，exit 2）**：store 被上次运行污染或配方与产品默认值不同；换配方或重置 store 再跑，详见 `docs/real/fixture.md`。
- **契约 preflight 不符（BLOCKED）**：宿主 runtime 行为变了；看报告指名的契约项，升级契约层（`docs/real/host-contract.md`），不要改断言绕开。
- **元素/状态等待超时（FAIL）**：先看 `observations` 里期望与末次观测；确认是产品没做到还是布置没做到（例如合成事件绕过了真实输入）。
- **浏览器/CLI 找不到（BLOCKED）**：显式传 `--browser` / `--dsh-cli`；这是运行期绑定，不写进文档。
- **证据在哪**：`<evidence-root>/<runTag>/report.json`；没传 `--evidence-dir` 时默认仓内 `.tmp-real/`（运行时目录，不入库）。

## 8. 本页与其它文档的关系

- 方法层（跨栈可移植）：`skills/real-evidence/SKILL.md`、本文件、`docs/real/boundary-policy.md`、`docs/adr/0011-real-test-kit-layering.md`
- 平台契约层：`docs/real/host-contract.md`、`docs/real/hooks.md`、`docs/real/observability.md`
- 实现层：`scripts/real/README.md`、`docs/real/{fixture,report,static-gate,diff}.md`
- 索引：`docs/real/README.md`
