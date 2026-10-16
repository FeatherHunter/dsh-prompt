# 全仓盘点基线（#173）：JS 清单 / 构建链 / 门禁合理性 / 功能基线

> map #168 子票。第一性原理：只记录“不可再分事实”（文件存在与否、命令退出码、issue 开关状态），推导才落约束。
> 对标 `research/authoritative-ts:findings.md` MUST/SHOULD/NOT（Vite 运行时切分 + tRPC 核/适配 + Effect 生成纪律）。

## 1. JS 清单（2026-10-17，main，`git ls-files` 为准）

### 1.1 TS（33 个，不动，只搬家）
- `src/client/*.ts` 28 个（含 `src/client/log/index.ts`）：about/button/hostfont/i18n/index/keys/locale/match/pager/panel/picker/remote/remoteInput/remoteInputSheet/remoteView/settings/smart/smartstore/state/store/styleOwnership/systemOrientation/templates/trigger/update-http/words/workspace + log/index
- `src/update/host/*.ts` 5 个：bridge-log/hash/index/paths/safe-values
- 双 tsconfig：`tsconfig.json`（include `src`，exclude `src/update/host`）+ `tsconfig.host.json`（include `src/update`，`noEmit:true`）

### 1.2 需按规则 1 重构为 TS 的 JS（tracked scripts 共 67 = 52 test-cjs + 7 顶层 mjs + 3 update mjs + 2 辅助 cjs + 2 ps1 + 1 sh；根 1 个 tsdown.config.ts 已是 TS）
| 桶 | 文件 | 处置（执行票 T5） |
|---|---|---|
| 构建编排（4） | `scripts/build.mjs`、`scripts/update/build-host.mjs`、`scripts/update/ensure-latest.mjs`、`scripts/update/probe-ctx-services.mjs` | 转 `.mjs` 保持 ESM（MUST 3：新增脚本一律 `.mjs`，`.mts` 仅新脚本需类型时可选；存量最小 diff 保持 `.mjs` + JSDoc）；`build.mjs` 头注“单 node 编排”即 tRPC/Effect 范式，予以确认 |
| 门禁脚本（3） | `scripts/check-lib-sync.mjs`、`scripts/check-marketplace-readme.mjs`、`scripts/check-update-pkg.mjs` | 保持 `.mjs`，并收敛为 `npm run check` 子命令 |
| 工具脚本（3） | `scripts/fix-issue-body.mjs`、`scripts/wayfinder-chart.mjs`、`scripts/wire-subissues.mjs` | 保持 `.mjs` |
| 辅助（2 cjs） | `scripts/lib/transpile-client.cjs`（134-gate 等引用的转译 helper）、`scripts/render-ink-evidence.cjs` | 随引用方同迁；transpile helper 搬家必须同改引用路径 |
| 测试/回归（52） | `scripts/test-*.cjs` 52 个（其中 `test-issue-*.cjs` 47 个，见 §3） | 常驻 3 留；准常驻 9 提为 `check-*`；其余 test-issue 41（含孤儿 76）归档 `scripts/repro/`（合：同类合并为一个目录，不再平铺；搬家须同改 `package.json test:*` 路径与相对 require，执行票逐个跑通）；其余 5 个非 issue 测试见 §3 |
| 根配置（1） | `tsdown.config.ts`（已是 TS，不动） | 不动 |
| 遗留删除（1） | `scripts/build.sh` 0.5KB（`build.mjs` 头注已写明替代原因：WSL bash 下 win32 esbuild 恒红 #39） | DELETE（执行票删） |
| 发版（2 ps1，不进 TS 范畴） | `scripts/publish-token.ps1`（现行，AGENTS.md 指定）、`scripts/publish-window.ps1`（交互 2FA  fallback，AGENTS.md 明确只在 token 不可用时用） | 保留，不转 TS |

### 1.3 残留目录（`.gitignore` 已覆盖 `.*/`、`.wayfinder/`、`.tmp-*`、`scripts/.rt-tmp/`，均未 tracked，可删；本节除决策资产外均为附带记录，供执行票清理，非 §交付主表）
- `scripts/.rt-tmp*` 33 个目录 / 401 个 `.cjs`（测试转译缓存，`check-lib-sync` 与各回归脚本运行时生成）
- `.tmp-verify/` 1638 个文件 + `.tmp-verify-144/` 1 个 + `.tmp-verify-theme/` 3 个（历史真机/asar 验证残留，根下 `真机验收清单.md` 等百余 md/log 皆在此）
- `.wayfinder/` 634 个文件（含 `.rt-tmp*`、`cur/`、`update/`、`research-assets/` 等过程残留）
- `.scratch/` 9 个、`.local/` 1 个、`prototype/` 6 个、`research/` 54 个（含未跟踪的 `research/hostfont-double-scale` 等 4 个新目录，盘点时已存在，非本票产生）
- `.asar-tools/` 16 个（asar 逆向工具，保留，属工具链）
- 处置：执行票 T5 `git clean` 级删除以上忽略目录（除 `.asar-tools/`、`prototype/`、`research/` 保留），`lib/client.js.map` 未 tracked（ignore 中）保持忽略。

### 1.4 lib（tracked 6 个，检入物，门禁只查 `src`）
`lib/index.js`（检入源码，只验存在不构建）、`lib/client.js`、`lib/update.js`、`lib/log/index.js`、`lib/log/gate.js`、`lib/log/gate.d.ts`。`lib/client.js.map` 未入库。

## 2. 构建链依赖图

```
src/client/index.ts ──tsdown(tsdown.config.ts, browser/cjs/单入口lib/client.js)──▶ lib/client.js
src/update/host/index.ts ──esbuild(scripts/update/build-host.mjs)──▶ lib/update.js
        ▲ ensure:update-pkg 先跟上游 latest（#98 覆盖 ADR-0003；离线警告继续）
lib/index.js ──检入源码，不构建，build.mjs 仅 existsSync──▶ 发版打工作目录 lib/
check-lib-sync.mjs：快照 lib/{client,update}.js → npm run build → 逐字节比对（行尾归一），不一致红
声明式约束（入图虚线边）：cordis.patch.yml（7 行，bundle 插入条目）──约束──▶ 发版装配；event-list.dsh-prompt.json（valueDomain 32 形状基线）──约束──▶ lib/log/gate.js 执行 + test-log 门禁
```

- 第一性事实：`package.json: type=module, main=lib/index.js, exports{.=lib/index.js, ./client=lib/client.js}`；`dsh.engines.dsh>=0.2.0-rc.2`；`dsh-plugin-update` 在 `devDependencies`（内联进产物，#58），版本构建期冻结。
- 与权威范式对齐：单 node 编排（Effect/tRPC 同式）确认；Vite 式运行时切分确认（client bundle vs node host 两线，禁 cross-import，执行票在 `src/client/hostfont.ts` 等 DOM 文件头加 DO-NOT-IMPORT 声明）。

## 3. 门禁合理性：留删合表（47 个 test-issue 逐个 verdict；issue 开关状态见远端列表，open 仅 #167/#147）

- 常驻 KEEP（3，`npm test` 唯一门）：`test:lib-sync`（check-lib-sync.mjs）、`test:modal`（test-modal-remount.cjs）、`test:issue-14`（test-issue-14.cjs，#14 已关但属弹窗意外关闭永久回归）
- 提升为 `check-*` KEEP（9，执行票改名 + TS 化，收进 `npm run check`；合：分散的种类门合并为一条 check）：`134-gate`（#138 永久双语门禁，map #134 已关但铬断言永久）、`137`（Resolver 基建，locale 订阅永久）、`39`（更新包内联 #58，产物裸 import + profile 独立性）、`log`（test-log.cjs，地图 #45，ENUM 形状 + 桥语义）、`marketplace`（check-marketplace-readme.mjs，已是 check）、`host-deps`（test-host-deps.cjs，#147 open 的依赖声明面）、`bottom-up`（test-bottom-up.cjs，全列表 bottom-up 不变量）、`156`（#151 色标门禁：双语 + 溢出 + lib-sync + typecheck）、`167`（#167 open，关闭后降级归档）
- 存档 ARCHIVE（41，issue 均 closed，转 `scripts/repro/`；合：47 个平铺收为“常驻 3 + check 9 + 归档 41”三桶，不再按号平铺；搬家须同改 `package.json test:*` 路径与 `require('./lib/transpile-client.cjs')` 等相对引用，执行票逐个跑通才算合拢）：20（存储切换 closed）/ 20-host（同）/ 21（浮层顶层化 closed）/ 23（label 落地 closed）/ 31（清洗移除 closed）/ 32（wontfix follow-up）/ 34（拼音组词 closed）/ 35（定位左下角 closed）/ 37（引流区 closed）/ 40（更新弹窗 closed）/ 41（启动检查 closed）/ 42（版本声明 closed）/ 56（loopback closed）/ 59（localStorage closed）/ 61（光标注入 closed）/ 66（窄屏 closed）/ 71（用量数字 closed）/ 74（行折叠 closed）/ 77（可折叠区域 closed）/ 82（远程直达 closed）/ 82-host（同）/ 83（大列表 closed）/ 86（方向偏好 closed）/ 86-host（同）/ 89（后台检测 closed）/ 103（远程放大 closed）/ 104（触控双键 closed）/ 110（远程记忆 closed）/ 112（闪烁关闭 closed）/ 116（远程字号 closed）/ 123（三键验收 closed）/ 141（铬切换 closed）/ 142（回落词 closed）/ 144（溢出覆盖 closed）/ 145（预制缺英译 closed）/ 146（style 归属 closed）/ 148（字号恢复 closed）/ 149（小列表重排 closed）/ 158（取色控件 closed）/ 165（预制删除 closed） + 76（孤儿，见下）
- 孤儿 FIX（1）：`scripts/test-issue-76.cjs` 有文件无 `test:issue-76` 脚本（全仓唯一，`#76` closed 换行丢失回归，内容 14 场景 A–R 仍有效）→ 执行票直归档（不补脚本，不增常驻）。
- 非 issue 测试（5）：`test-bottom-up`（见上准常驻）、`test-host-deps`（见上）、`test-log`（见上）、`test-modal-remount`（常驻）、`test-smart-draft`（智能草稿一次性，随归档）。
- 全量 `npm run test:*` 52 个脚本中仅 3 个进 `npm test`，其余 49 个现状即集中式集成回归集（对标 tRPC `packages/tests` / Vite `playground`），收敛方向为“种类门”（unit/e2e/type）而非“个数门”。Q4 授权依据：closed-issue 一次性复现全部归档，只留仍生效的不变量门（上两类共 12 个）。

## 4. 功能等价基线（“前后无差”的可执行定义；定义已定，实测待执行票 T5 补全量抽查后冻结）

1. `npm run typecheck`（`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.host.json`）必须 0 退出。本次：PASS（2026-10-17，main干净）。
2. 常驻 3 门全绿：`test:lib-sync` + `test:modal` + `test:issue-14`。本次：modal PASS、issue-14 ALL PASS（B/C/D）；lib-sync RED（见下红字，非代码 fault）。
3. 准常驻抽查绿（执行前后各跑一次）：`134-gate`、`137`、`39`、`log`、`host-deps`。本次未跑（盘点只跑常驻；上游漂移下跑准常驻会混入非源码变量，故留待 T5 重建提交后补跑，以重建后结果为冻结基线）。
4. 关键面冒烟（无头断言代替真机）：面板开合、设置页、挑选器、智能卡、远程大列表在 `lang=en/zh` 下无抛错（`134-gate` B 组已覆盖 7 面，执行票复用）。
5. 🔴 基线红字（ Artifacts，不拦盘点，拦执行；当前基线不可直接作“无差”参照）：`npm test` 本次 RED，唯一红在 `test:lib-sync`：`ensure:update-pkg` 自动跟到 `dsh-plugin-update@0.18.6`（钉版 0.18.5→0.18.6），`lib/update.js` 10159→10529 行首差第 4 行。已 `git checkout -- package.json package-lock.json lib/update.js` 回滚到干净（`git status` 仅剩 4 个未跟踪 research/ 目录，非本票产生）。“typecheck PASS 即源码健康”仅指 TS 类型层，不含产物同步层；执行票 T5 必须先重放此升级（build + 提交 lib + 钉版）并重跑 §4.1–4.4 全绿，以重跑后为冻结基线，否则一切等价比较地基是漂的。

## 5. 红队自查（本票的对抗段落；map Notes 要求每个决策票自带红队段落，非范围蔓延）
- 可能的误判1：“47 个回归全删”——否决：134-gate/137/39/log/host-deps 护的是仍生效的不变量（双语铬、locale 订阅、更新内联、日志值域、依赖声明），删即裸奔；只归档 closed-issue 一次性复现。
- 可能的误判2：“残留目录全删含 research/prototype”——否决：`.gitignore` 未覆盖的 `research/`（54）与 `prototype/`（6）是决策资产留档，只删已忽略的生成物。
- 可能的误判3：“lib-sync 红即代码坏”——否决：红因是上游跟最新机制（#98）与检入 lib 的时间差，`typecheck` 与单门全绿证明源码健康；执行票以“重建提交”收敛而非“修源码”。
- 可证伪条件（执行票 T5 前置验收，非假设）：若任一 ARCHIVE 复现在新目录树下因路径写死而红，则本表归档策略被推翻，转为“先修路径再归档”；T5 以逐个跑通为合拢标准。

## 6. 给下游的输入（wayfinder 交接要求：资产由票链接、map 只收 gist，非范围蔓延）
- 术语票 T3：`store/smartstore/state`、`remote/remoteView/remoteInput(Sheet)`、`update-http/update`、`i18n/locale/keys` 映射以本清单 33 个 TS 文件名为候选全集（非 GLOSSARY 正文；GLOSSARY 只收领域语言，实现文件名由 T3 筛选后写入，见 CONTEXT 约束）。
- 原型票 T4：顶层按运行时切（`src/client` vs `src/update/host` 确认）+ 核/适配 + 禁手写 barrel + `npm run check` 收敛 + 文件头 DO-NOT-IMPORT，可直接消费 §2–§4。
- 执行票 T5：先重放 0.18.6 升级提交，再搬目录 + 门禁收敛（常驻 3 + check 9）+ 删 `build.sh` + 清忽略残留 + 补 76 孤儿。
