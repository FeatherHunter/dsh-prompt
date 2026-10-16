# 目标目录结构原型（#170）

> PROTOTYPE — throwaway，答“分层/树感觉对不对”。验证通过的决策收进 `docs/adr/0008-*.md`（main），本目录不出 main。
> 运行：`node prototype-target-tree/check.mjs [--expect=current|target]`（默认 current）。

## 0. 问题

33 个 TS（`src/client` 28 + `src/update/host` 5）全平铺 + 67 个 scripts（含 52 个 `.cjs` 测试门）+ 零散残留：加目录是真 seam 还是更长的路径？本原型用第一性原理推出目标树，并用 `check.mjs` 把“每个文件都有家、每个家都有名”变成可运行断言。

## 1. 不可再分事实（F1–F8，皆可按行号复核）

- F1 双运行时：`src/client` 进浏览器 bundle（DOM + React 经宿主 slot，`tsconfig.json` 含 `DOM` 库），`src/update/host` 跑 node（HTTP 桥 + `spawn powershell`，`tsconfig.host.json` 无 `DOM`、无 emit）。两线一旦 cross-import 即环境事故（`src/client/systemOrientation.ts:1-13` consumption 侧 vs `lib/index.js` 宿主半）。
- F2 单产品单面：一个面板 + 一个设置页 + 触控面，无第二业务域（`src/client/index.ts:1-4` 装配五行即全产品）。
- F3 调用呈星形：`panel.ts` 被 button/settings/smart/trigger/about 进口，`store.ts` 被 panel/trigger/match/smart 进口；反向边（被 UI 进口的纯模块）只有 `pager`、`remoteView`、`workspace`。
- F4 数据规模小：预制 24 条（`templates.ts`），`smartCandidates` 全量打分（`match.ts:78-108`），`getTemplate` 线性找（`store.ts:255-257`），workspace 反查 `Map` 已建（`workspace.ts:254`）。
- F5 门禁三桶已判：常驻 3 + check 9 + 归档 41（`docs/inventory-173-baseline.md` §3），`npm test` 仅三门。
- F6 术语已冻：33 术语 + N1–N7 + 豁免白名单（`docs/naming-169-spec.md`），33 文件全映射。
- F7 产物不同构：`lib/index.js` 检入源码不构建，`lib/client.js` tsdown 单入口，`lib/update.js` esbuild；`check-lib-sync.mjs` 快照 + 重建 + 逐字节比对。
- F8 无 CI：门禁全本地（无 `.github`），`engines` 无旧 node 约束，`type: module`。

## 2. 推导（事实 → 选择）

- 由 F1：顶层按运行时切分保留且不可合（`src/client` vs `src/update/host`）。双 tsconfig 是类型层的环境防火墙，不是重复配置（§8）。
- 由 F2 + F3：client 内不按特性切片。星形调用下 `features/panel` 与 `features/remote` 之间仍是全连接，切片只把 `import './x'` 变成 `import '../core/x'`，零解耦、纯加长。文件名即索引（Effect 式数百平铺先例，28 文件远未及阈值）。
- 由 F3：client 内不按技术分层（controllers/services）。纯模块（`pager`、`remote-grid`）的调用方恰是组件（picker 量尺寸 → pager 算页），分层会把一次“量→算”协作劈成两层三跳。
- 由 F4：模板侧保持 Array 主序（展示/tiebreak 依赖顺序，`tieBreakOrder` 需预制定稿序 `presetOrderMap`），id 查找加 lazy `Map` 索引（O(T)→O(1)，T5 顺手改三行，不改行为）。
- 由 F5：scripts 按门禁种类分桶，不按号平铺；不新建顶层 `tests/`（第二真相源）。
- 由 F6：新名全部就位，T5 只做 `git mv` + 同改 import + 头注释补可 import 者（N6）。

## 3. 目标树

```
src/
  client/                          # 浏览器 bundle 线（DOM+React，经宿主 slot）
    index.ts                       # 装配器（非 barrel，不扩转口）
    template-library.ts            # ← store.ts（Module：模板库集合+持久+标签收敛）
    templates.ts                   # 共享类型家 + 24 预制（shared-up-to-core，保持）
    smart-score.ts                 # ← match.ts（深 Module：smartCandidates 单缝）
    smart-words.ts                 # ← words.ts（强/弱词表数据）
    smart-card.ts                  # ← smart.ts（悬浮卡宿主，Adapter）
    smart-draft.ts                 # ← smartstore.ts（会话草稿悬浮）
    label-identity.ts              # ← keys.ts（CanonicalKey + 存量适配）
    locale.ts                      # 语言解析+订阅单例（保持）
    strings.ts                     # ← i18n.ts（STR/tr 词表）
    template-browser.ts            # ← panel.ts（浏览组件，装配面）
    entry-button.ts                # ← button.ts（input.left 入口）
    settings-page.ts               # ← settings.ts
    settings-links.ts              # ← about.ts（对外入口区）
    prompt-trigger.ts              # ← trigger.ts（/prompt 源）
    panel-visibility.ts            # ← state.ts（UI 瞬态，豁免）
    remote-mode.ts                 # ← remote.ts（总闸+持久）
    remote-grid.ts                 # ← remoteView.ts（十二槽纯数学，REMOTE_PAGE_SIZE=12）
    remote-draft.ts                # ← remoteInput.ts（纯镜+休眠门）
    remote-sheet.ts                # ← remoteInputSheet.ts（底贴宿主）
    workspace-picker.ts            # ← picker.ts（全屏本体）
    workspace-contract.ts          # ← workspace.ts（纯契约+反查索引）
    pager.ts                       # 纯页数学（保持）
    host-content-font.ts           # ← hostfont.ts（声明式字桥）
    style-ownership.ts             # ← styleOwnership.ts（仅大小写）
    system-orientation.ts          # ← systemOrientation.ts（仅大小写）
    update-client.ts               # ← update-http.ts（更新接线客户端半）
    log/index.ts                   # 日志客户端半（保持，唯一子目录即边界）
    __tests__/                     # 新增：只收纯模块单测（SHOULD 1，opt-in，先 pager/grid/score）
  update/host/                     # node 线（无 DOM）
    index.ts / bridge-log.ts / safe-values.ts  # 保持
    error-fingerprint.ts           # ← hash.ts（8 位指纹，两链共用）
    routes.ts                      # ← paths.ts（四条路由常量）
scripts/
  build.mjs / check-*.mjs          # 编排 + 门禁（常驻3 + 提升9，`.cjs`→`.mjs`，合：种类门）
  update/*.mjs wayfinder-*.mjs fix-issue-body.mjs  # 工具链（保持）
  lib/*.mjs                        # 转译 helper（随引用方同迁，保持目录）
  repro/                           # 归档 41 + 孤儿 76（合：三桶最后一桶，搬家同改 test:* 路径）
  build.sh                         # DELETE（#39 已裁定）
```

残留清理（T5，`git clean` 级，只动已忽略生成物）：`scripts/.rt-tmp*`、`.tmp-verify*`、`.wayfinder/` 可删；`research/`、`prototype/`、`asar-tools/` 保留（决策资产/工具链）；`lib/client.js.map` 保持忽略。

## 4. 数据结构

| 状态 | 结构 | 为何是它 |
|---|---|---|
| 模板集合 | `Array` 主序（预制定稿序 + 自定义 createdAt）+ `presetOrderMap: Map<id,idx>`（存量）+ 新增 lazy `Map<id,tpl>` id 索引 | 展示与 tiebreak 依赖顺序，Array 不可替；查找 O(T)→O(1) 只加索引不换主序 |
| 用量/置顶/末用 | `Record<id,number>` + `string[]` pinned（≤5）+ `string\|null` lastUsed | 写少读多，内存缓存 + host 落盘 fire-and-forget；pinned 有序数组即顺序本身 |
| 标签 | `string[]`（预制恒 3，自定义 ≤3，`MAX_LABELS`）+ 派生公式只读镜像 | 小集合，线性 `includes` 足够；倒排索引在 T<200 时是投机抽象（见 §11） |
| 智能词表 | `Record<id,{strong:string[],weak:string[]}>`（`SMART_WORDS`） | 模板 id 直查 O(1)，打分时线性扫词（词表 <20/模板） |
| 工作区归属 | `Map<sessionId,WorkspaceIndexEntry>`（`buildWorkspaceIndex` O(W+S) 一次建成） | 归属在工作区一侧，会话对象无 wsId 字段，反查索引是唯一正确形状（CONTEXT 已裁定） |
| 远端槽位 | 定长 `Array<12>`（空位占位补齐） | 恒十二槽，不满补空位，长度即不变量 |
| 分页 | 纯整数（total/perPage/page），无状态 | O(1) 页数学，测量留调用方 |

## 5. 关键算法与复杂度（T=模板数≈24+自建，D=草稿长，S=会话数，Q=查询长）

| 算法 | 位置 | 复杂度 | 结论 |
|---|---|---|---|
| `smartCandidates` 全量打分 + 双排序 | smart-score | O(T·D·W̄) + O(T log T) | T≈ dozens，每击键一次可忽略； 阈值：T>200 或卡顿实测再上倒排，今不做 |
| `sortedTemplatesBottomUp` 四键比较排序 | template-library | O(T log T)，比较器 O(1) | 规模内恒快；键顺序（置顶簇→用量→pin→末键）即 #68 终式，不动 |
| `getTemplate` | template-library | 现 O(T)→ lazy 索引后 O(1) | T5 顺手改（建索引 O(T) 一次），行为零差 |
| `buildWorkspaceIndex` / `filterWorkspaceSessions` | workspace-contract | O(W+S) / O(S·Q) | 已是最优形状；`sessionHaystack` 预拼串避免重复 join |
| `pageCount/clampPage/pageRange` | pager | O(1) | 无 DOM 纯数学，就近单测已覆盖 |
| `computeRemoteView` | remote-grid | O(12)=O(1) | 槽位常量即复杂度上界 |
| `insideCodeBlock` fence 计数 | smart-score | O(D) | 单次线性扫描，无正则回溯风险 |
| `resolveLocale` 五级回落 | locale | O(1) | 显式覆盖→宿主面→html→navigator→默认，无 IO |

## 6. 模式清单（codebase-design 词汇优先，GoF 注用处）

- **Module/Interface/Seam**：`smart-score` 是深 Module（`smartCandidates(draft)` 单缝进、三出 ≤3 候选；内部 `scoreDraft/scoreCustomLabels` 是 internal seam，不对外）。`remote-grid` 深 Module（`computeRemoteView(input)` 单缝，O(12) 实现全藏）。`pager` 深 Module（5 个 O(1) 函数，调用方只给数字）。
- **Adapter**（角色非实质）：`label-identity` 内 `LegacyChineseStorageAdapter`（读侧归一、写侧原样）；`log/index` 客户端桥（复用 HTTP 桥转交电话表）；`update/host/index`（更新包电话表挂载既有桥）；`style-ownership`（宿主 `<style>` 归属账本适配）；`LocaleService` 适配器（宿主 locale 面注入）。
- **Observer**：`subscribeStore` / `subscribeLocale`（单例 MutationObserver）/ `subscribeRemote` / `onSmartInput` / 面板开关 listeners —— seam 在 listener 集合，调用方与测试走同一缝。
- **Strategy**：`scoreDraft` vs `scoreCustomLabels` 按 `tpl.builtin` 选用（smart-score 内缝）；`sortedTemplates`（降序，管理面）vs `sortedTemplatesBottomUp`（升序，悬浮面）按展示面选用。
- **Factory**：`createHostUpdate()` / `createClientLog()`（外部包建器，seam 在创建参数）；`buildPromptSource`（/prompt 源装配）。
- **Assembler（非 barrel）**：`src/client/index.ts` 与 `src/update/host/index.ts` 只做挂载不转口（N5，保持不扩）。
- **Singleton**：locale 单订阅、`SmartInput` 单 current —— 有意为之（多例即多真相源）。
- **State 机**：workspace-picker（关闭→探测→加载→就绪/空/失败→切换中）；remote 会话单键（只翻 `enabled`，退出不还原方向 #110）。
- 浅 Module 豁免记录：`panel-visibility`（布尔 + 手势标记，删除测试：逻辑会散进 button+panel，故留但保持 tiny）；`template-library` 当前 ~40 导出偏宽，T5 以 internal seam（标签/ink/排序分段注释 + N6 头声明）收敛，不拆文件（拆即把星形调用剪成跨目录网）。

## 7. barrel 与深路径政策

保持无 barrel（MUST 2）：公共转口只 `package.json exports` 四项（`.`、`./client`、`cordis.patch.yml`、`package.json`）；模块间一律深路径相对 import。`index.ts` 两装配器不新增 `export *`。文件超 40 才用命名索引注释（Effect 式），今 33 不触发。

## 8. 双 tsconfig 去留

**保留双配置，不动。** `tsconfig.json`（`src` 含 `DOM`，exclude host）+ `tsconfig.host.json`（`src/update` 无 `DOM`、`noEmit`）是 F1 在类型层的防火墙：host 侧误用 `document/fetch` 当场红。合一即拆墙；`project references` 是远期可选（今无增量构建痛点，不引入）。T5 重命名不改 include（按目录收敛，与文件名无关）。

## 9. lib 同步影响

T5 只动 `src/` 与 `scripts/`，`lib/` 由 `build.mjs` 重建并经 `check-lib-sync` 逐字节验收；`lib/index.js` 检入源码只验存在。顺序：先重放上游 0.18.6（`ensure:update-pkg` + 提交钉版，收 §5 红字），再搬目录。无 lib 结构变更。

## 10. tests 归位

不新建顶层 `tests/`。种类即位置：常驻门禁 `scripts/check-*.mjs`（`npm run check` 收敛）＋ 一次性复现 `scripts/repro/` ＋ 纯模块单测 `src/**/__tests__/`（opt-in，先 pager/grid/score 三深 Module）。

## 11. 红队：为何不选另外两种范式 + 可证伪条件

- 不选**技术分层**（controllers/services/repositories）：F3 星形调用下分层切不出单向依赖——`template-library` 同时被 4 个“层”进口，硬分层等于把一个深 Module 锯成三层 pass-through（Middle Man + Shotgun Surgery 双臭）。本仓解耦靠类型与 seam（locale 单例、id 索引），不靠目录。
- 不选**特性切片**（features/panel、features/remote…）：F2 单产品无第二域；remote-sheet 复用 picker 数学（ADR-0005）、smart-card 与面板共用排序底座（#22），切片边界处全是合法横切，硬切只会制造跨 feature import 网。
- 可证伪条件 P1（推翻“client 平铺”）：若 T5 执行中出现 ≥2 组模块间**双向 import 循环**且无法经既有核（template-library/workspace-contract）单向收敛，则平铺被推翻，转按循环边界拆分子目录（以循环报告为准，不是感觉）。
- 可证伪条件 P2（推翻“无倒排索引”）：若自建模板 >200 条或实测击键卡顿（`smartCandidates` p95 >16ms），则线性打分被推翻，上标签倒排索引（保持阈值与排序语义不变）。

## 12. 给 T5 的输入

按 §3 树 `git mv`（old→new 全表见 naming-169-spec §3）+ 同改 import + 文件头 N6 声明 + `getTemplate` 加 lazy 索引；`scripts/` 按三桶搬（归档须逐个跑通）；`build.sh` 删；残留按 §3 末清理；全程 `npm run check`（typecheck 双配置 + lib-sync + 命名巡检 `check.mjs --expect=target`）。
