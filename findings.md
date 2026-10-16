# #172 findings：权威纯 TS 项目架构范式研究

> 分支：`research/authoritative-ts` · 文件：`findings.md`（throwaway，仅供 map #168 原型票消费，不合入 main）
> 方法：一手源 only（仓库目录树 via GitHub API + 官方 CONTRIBUTING/package.json/源文件头注释）。二手博客零引用。
> 本仓对照基线（2026-10-17，main）：`src/client/*.ts` 27 文件全平铺（唯一子目录 `src/client/log/index.ts`）＋ `src/update/host/*.ts` 5 个；`scripts/` 下 `build.mjs`＋ 47 个 `test-issue-*.cjs` 全 JS；构建 `node scripts/build.mjs`＋tsdown（仅 client 包）；双 tsconfig（`tsconfig.json` exclude `src/update/host`，另有 `tsconfig.host.json`）；`package.json: type=module, main=lib/index.js`（`lib/index.js` 为检入源码，只验存在不构建）。

---

## 1. 标杆 A：tRPC（trpc/trpc）—— 按“角色包”切分的六边形

### 目录树（一手：GitHub API，main）

```
packages/
  server/          # 核心＋服务端（含 client/server 共享码）
    src/
      index.ts                        # 32 B：纯转口 shim
      http.ts / rpc.ts                # 37 B 级转口 shim
      shared.ts                       # 653 B
      unstable-core-do-not-import.ts  # 2580 B：深层核心唯一转口，文件名即禁令
      unstable-core-do-not-import/    # 真核：clientish/ error/ http/ stream/ router procedure middleware…
      adapters/                       # 端口：aws-lambda express fastify fetch next next-app-dir node-http standalone ws
      observable/  __tests__/  vendor/  @trpc/
  client/ react-query/ tanstack-react-query/ next/ openapi/ upgrade/
  tests/           # 集成测试集中营（见下）
```

### 分层理由（一手：CONTRIBUTING.md "Project overview" 原文立场）

- "monorepo of packages with well-defined purposes"：包边界按**消费者角色**划（server / client / react-query / next），不是按技术层。
- 共享码上浮原则："If something is shared between the client and server, it should be here（@trpc/server）"——共享归核，不另设 `shared` 包。
- 六边形实锤：HTTP 处理核心 `resolveResponse`（`packages/server/src/http/resolveHTTPResponse.ts`）框架无关，"Adapters 'adapt' their framework's request object into a common format… This keeps tRPC framework-agnostic, an important principle"。
- 测试归位双轨：单元就近 `src/__tests__/`；跨包集成**全部收敛**到 `packages/tests`，"we import the different libs from here, this makes it easier for us to do integration testing"。

### 门禁清单（一手：根 `package.json` scripts）

`turbo build/lint`（按包编排）· `vitest` · `typecheck-packages`（`pnpm --parallel --filter=./packages/* typecheck` 并行收敛）· `manypkg fix`（monorepo 依赖一致性）· **`lint-prune`（ts-prune 查死导出，白名单排除 rpc/observable/http 等转口）** · prettier `format-fix` · eslint。单包构建 `tsdown`（server 包 `build: tsdown`，与本仓同工具链）。

### Barrel 观

- 根 `index.ts` 只有 32 B：barrel 只做**公共 API 窄转口**，不做全量 `export *`。
- `exports` map 显式列 15 个子路径（`./adapters/*` `./http` `./observable` `./rpc` `./shared` `./unstable-core-do-not-import`）：**深路径按需导入是官方 API 的一部分**，barrel 不是唯一入口。

---

## 2. 标杆 B：Effect（Effect-TS/effect）—— 扁平概念模块 ＋ 生成式 barrel

### 目录树（一手：GitHub API，main）

```
packages/
  effect/ platform/ sql/ ai/ atom/ opentelemetry/ vitest/ tools/
  effect/
    src/            # 全平铺：Array.ts Effect.ts(472 KB) Schema.ts(551 KB) Layer.ts …数百个 PascalCase 单概念模块
    src/index.ts    # 13 KB，存在！但头顶注释：
                    #   // @barrel: Auto-generated exports. Do not edit manually.
                    #   export * as Array from "./Array.ts"   ← 命名空间式转口，非打平
    test/ typetest/ benchmark/ runtimeperf/ typeperf/
    SCHEMA.md CONFIG.md HTTPAPI.md …  # 按模块生成的 API 文档与源码同包
```

### 分层理由

- 包按**能力域**切（effect 核 / platform 运行时 / sql / ai…），包内 `src/` 按**概念**平铺、一文件一概念、文件名＝概念名（`Option.ts` `Stream.ts` `Layer.ts`），命名即索引。
- 六边形在语言层实现：`Layer.ts`/`Context.ts` 即依赖注入原语——分层不靠目录，靠类型。这是“单包规模极大时仍不建子目录”的底气：检索靠文件名，解耦靠类型。
- 测试按**测试种类**分目录：`test/`（行为）`typetest/`（类型）`benchmark/ runtimeperf/ typeperf/`（性能/类型性能）——种类即目录，不是“一个 tests 桶”。

### 门禁清单（一手：根 `package.json` scripts＋devDeps）

`check`（`tsc -b` project-references 全仓类型收敛）· `codegen`（**递归每包 `pnpm --recursive --filter ./packages/**/* run codegen`：barrel 与文档是生成物，对不上即红**）· `circular`（`scripts/circular.mjs`＋madge：**循环依赖门禁**）· `lint`（`oxlint && dprint check` 双轨）· `test`（vitest）· `doctest`（`vitest --config vitest.docs.ts`：**JSDoc 示例即测试**）· `coverage` · `test-types`（tstyche 类型快照）· `check-dist-types`（产物类型检查）· `bundle-compare`（包体积回归）· changesets 发版流。脚本本体 `scripts/*.mjs` 经 node/tsx 直跑。

### Barrel 观（本研究最关键的一手反直觉证据）

Effect 证明了两句话可同时成立：(1) 包内**允许数百文件平铺**；(2) barrel（`src/index.ts`）**存在但只能是生成物**（`@barrel: Auto-generated`＋`Do not edit manually`），且用 `export * as X` 命名空间转口**避免打平污染**。手写 barrel＝漂移源，生成 barrel＝契约。

---

## 3. 标杆 C：Vite（vitejs/vite）—— 按运行时环境分层

### 目录树（一手：GitHub API，main）

```
packages/vite/src/
  node/             # 服务端：build.ts config.ts(91 KB) server/ plugins/ ssr/ optimizer/
    __tests__/  __tests_dts__/       # 单元＋类型测试就近 colocate
    index.ts                        # 8 KB 公共 API barrel
    internalIndex.ts                # 99 B：export { viteReactRefreshWrapperPlugin as reactRefreshWrapperPlugin } from 'rolldown/experimental'
  client/  module-runner/  shared/  types/
playground/*/  __tests__/           # 按场景的集成测试（每个 playground 自带 __tests__）
```

### 分层理由（一手：CONTRIBUTING.md）

- `src/` 第一层按**运行时环境**切（node / client / shared / module-runner），不是按功能：环境边界＝打包边界＝外泄风险边界（client 代码混进 node 会发版事故）。
- `src/types/` 内联外部依赖类型（rolldown 等）："we inline some of these dependencies' types… This way, we can still expose the typing but bundle the dependency's source code"——**类型归位是为了打包策略服务**。
- 依赖纪律："most dependencies, even those used in runtime source code, should be added under devDependencies… we use Rolldown to pre-bundle"；"Think Before Adding Yet Another Option"（修问题先想默认/插件，不加开关）；"we discourage… code refactors that are largely stylistic"。
- 测试归位：场景集成 `playground/*/__tests__`（e2e，serve/build 双模式）＋ 包内单元 `__tests__` ＋ `__tests_dts__`（类型测试单列）。

### 门禁清单（一手：根 `package.json`＋CONTRIBUTING）

`oxlint .` · `oxfmt`（提交时 simple-git-hooks＋lint-staged 自动修，且**按路径分级**：`packages/*/{src,types}/**/*.ts` 才跑 lint）· `typecheck`（`tsc -p scripts`＋递归每包）· `test-unit`＋`test-serve`＋`test-build`（三轨）· **`test-docs`（`docs-build`：文档构建本身是门禁）** · commit message convention（`.github/commit-convention.md`，changelog 自动生成）· PR-driven release flow。AI 贡献两原则（LLM 不代言、不代思考）。

### Barrel 观

双 barrel 制：`node/index.ts`（公共 API）vs `internalIndex.ts`（99 B，内部转口）。**内外有别**：内部复用走内部口，不蹭公共 barrel——公共 API 面窄化，内部重构不触发 semver 讨论。

---

## 4. 范式选择结论（给 map 驱动会话的输入）

| 问题 | 三家共识 | 对 dsh-prompt 的含义 |
|---|---|---|
| 分层 vs 特性切片 vs 六边形 | 无一家用“技术分层目录”（controllers/services）；tRPC 按消费者角色分包＋内核/适配器六边形，Vite 按运行时环境分层，Effect 靠类型系统做六边形 | 本仓是**单插件双运行时**（client bundle 进宿主 panel/slot，host 脚本跑 node）：选 **Vite 式“按运行时切顶层”**（`src/client/` vs `src/update/host/` 已是雏形，予以确认），包内分“核＋适配”（tRPC 式：装配/能力核 vs 宿主 slot/DOM 适配），不引入特性切片（无多业务域） |
| barrel 何时用 | 只允许两种：窄公共转口（tRPC 32B / Vite index）或生成物（Effect @barrel）；深路径导入永远保留 | 本仓 `src/client/index.ts` 是装配器不是 barrel——**保持现状不建 barrel**；若日后模块超 40，学 Effect：手写命名索引注释，不手写 `export *` |
| scripts/tests 归位 | 脚本：根 `scripts/*.mjs` 经 node/tsx 直跑（Effect/tRPC），拒绝 bash/ps1 双份（本仓 build.mjs 头注释已是同一结论）；测试：单元就近 `__tests__`＋集成集中营（tRPC `packages/tests` / Vite `playground`）＋种类单列（`__tests_dts__`/typetest/doctest） | 本仓 47 个 `test-issue-*.cjs` 是“集成集中营”的贫民版：保留集中，但**按种类分两个桶**（`scripts/check-*.mjs` 常驻门禁 vs `scripts/repro-issue-*.mjs` 一次性复现），并全转 `.mjs` TS 化（与 #168 TS 纯度目标对齐） |
| 门禁收敛 | 收敛到 ≤6 条顶层命令：build / typecheck(-b) / lint(+fmt) / test(-unit/-e2e) / prune-or-circular / docs-or-dist-check；pre-commit 只做 fmt＋作用域 lint（Vite lint-staged） | 本仓现状是“40 个 test: 脚本平铺＋无 lint/format 门”：收敛为 `check` 一键（typecheck 双 tsconfig＋lib-sync＋命名巡检），pre-commit 只跑 fmt 级 |
| 命名自解释 | 文件名＝概念（Effect PascalCase / Vite camelCase 动词名词），禁令写进文件名（`unstable-core-do-not-import`），生成标记写进文件头（`@barrel`） | 本仓已有好种子（`styleOwnership.ts` `hostfont.ts` 自解释强；`panel.ts:47-52` 手抄表注释是“约束写进源码”的范例）：推广为制度——跨模块依赖必须在目标文件头注释写明“谁可 import”（学 tRPC DO-NOT-IMPORT 头） |

---

## 5. 可执行约束清单（原型票直接用）

### MUST（违反即红）

1. **MUST 顶层按运行时切分，不按技术角色切分**：`src/client/`（浏览器 bundle）与 `src/update/host/`（node）是两条运行时线，禁止 cross-import（client 引 host 代码＝发版体积/环境事故）。
   - ❌ 在 dsh-prompt 不适用的反例：若把 `hostfont.ts`（DOM 操作）搬进 `src/update/host/` 只因“它带 host 字样”——运行时错配，host 目录是 node 侧，DOM 代码必须留在 client。
2. **MUST 禁止手写 `export *` 全量 barrel**：公共转口只允许窄名单 `export { A, B }`；模块数超 40 时用“命名索引注释”代替 barrel（Effect 范式）。
   - ❌ 反例：给 `src/client/` 加 `index.ts` 转口 27 个模块——本仓 client 经 tsdown 单入口打包，转口只增循环依赖风险（Effect 设 `circular` 门禁正是防这个），零收益。
3. **MUST 新增脚本一律 `.mjs`（TS 纯度目标下可 `.mts`），禁 `.cjs`/`.sh`/双份 ps1**：`scripts/build.mjs` 头注释已确立“单 node 编排”原则，47 个 `.cjs` 是历史包袱，新增不再续。
   - ❌ 反例：为“兼容旧 node”新加 `.cjs`——本仓 `engines` 无此约束，且 `type: module` 下 `.cjs` 是双心智负担。
4. **MUST 门禁收敛到一条 `npm run check`**：内含双 tsconfig typecheck＋lib-sync＋命名巡检；`test:*` 保留但只设 ≤3 个常驻（lib-sync/modal/issue-14 现状），其余降级为 repro 存档。
   - ❌ 反例：把 47 个 issue 脚本全接进 CI——tRPC/Vite 皆只收敛“种类”（unit/e2e/type），不收敛“个数”；全接等于无门禁（红了没人看）。
5. **MUST 跨模块依赖在目标文件头注释声明可 import 者**（tRPC `DO NOT IMPORT` 头范式；本仓 `panel.ts:47-52` 手抄表注释即雏形）。
   - ❌ 反例：`styleOwnership.ts` 若被 update-host 侧 import——文件头必须写“仅 client 侧”，否则后人照抄即 environmental bug。

### SHOULD（偏离需在 PR/issue 写理由）

1. **SHOULD 单元测试就近 `__tests__/`，跨面板集成测试集中 `scripts/repro-*`**：学 tRPC 双轨＋Vite playground 制；本仓暂无 `__tests__/`，新模块（>200 行）应配就近测试。
   - ❌ 反例：给纯类型/常量模块（如 `keys.ts`）硬配 `__tests__/`——Vite 也只给有行为模块配，过度测试是维护税。
2. **SHOULD 公共 vs 内部转口分离**（Vite `index.ts` vs `internalIndex.ts`）：宿主 slot 注册等“对宿主 API”与模块间复用走不同口。
   - ❌ 反例：现阶段 27 文件共享 `panel.ts` 已够用时硬拆双口——Vite 双口服务的是发版 semver，本仓未发包级 API，拆了没人守。
3. **SHOULD JSDoc 示例可运行化（doctest 方向）**：新导出的核心函数 JSDoc 带 `@example`，远期接 Effect 式 doctest。
   - ❌ 反例：给 47 个 repro 脚本补 JSDoc 示例——一次性脚本不值得，doctest 只配“公共核”。
4. **SHOULD 引入 ts-prune 或 madge 二选一**：死导出巡检（tRPC `lint-prune`）或循环依赖巡检（Effect `circular`）；本仓 `index.ts` 直 import 20 模块，循环风险真实存在。
   - ❌ 反例：两条全上——门禁维护成本翻倍，单仓阶段一条即够（建议先 madge，循环比死导出致命）。
5. **SHOULD 类型测试单列**（Vite `__tests_dts__` / Effect `typetest/`）：`tsconfig.host.json` 与主包的缝合处（`src/update/host` exclude 机制）配 `expectTypeOf` 级断言。
   - ❌ 反例：给每个 UI 文案 `tr()` 加类型测试——行为测试覆盖即可，类型测试只配“缝合处”。

### NOT（明确不做）

1. **NOT 不按特性切片建目录**（`features/panel/` `features/settings/`）：三家之中无一为“单产品小仓”用特性切片；本仓 27 文件是单面板单设置页，切片即过度设计。
   - ❌ 反例诱惑：“panel 相关 10 个文件收进 `features/panel/` 看着整齐”——整齐的代价是 import 路径翻倍＋与宿主 slot 结构错位（slot 按入口分，不按 feature 分）。
2. **NOT 不设 `src/shared/` 万能桶**：tRPC 明言共享上浮到核（@trpc/server），Vite 叫 `shared` 的前提是有 client/node 双运行时且内容全是环境无关纯函数；本仓若设 `shared/` 必成杂物间。
   - ❌ 反例诱惑：把 `words.ts` `match.ts` 判“两处用”就丢进 shared——先问“运行时归属”，归属明确就地归属，不明确才考虑上浮到核。
3. **NOT 不引入 changesets/turbo/pnpm-workspace 单仓编排**：三家门禁的单仓子集（tsc-b/lint/test）已够用；monorepo 工具链服务的是多包版本协同，本仓单包。
   - ❌ 反例诱惑：“学 Effect 上 changesets 管 CHANGELOG”——本仓 CHANGELOG 手工维护且随发版走 publish-token 脚本，changesets 是第二套真相源。
4. **NOT 不给 docs 建 `docs/` 新门禁（`test-docs`）**：Vite `test-docs` 服务的是 twoslash 类型示例，本仓 `docs/adr/` 是 ADR 薄文档，无构建可测。
   - ❌ 反例诱惑：“文档即代码，adr 也加 CI 拼写检查”——拼写检查拦不住 ADR 质量，评审制��已够。
5. **NOT 不把 `lib/` 检入物再纳入源码门禁**：`lib/index.js` 是检入源码（build.mjs 只验存在），门禁只查 `src/`；学 Effect `check-dist-types` 的前提是“产物由源码生成”，本仓此文件不是。
   - ❌ 反例诱惑：“lib/index.js 也跑 eslint”——检入生成的 bundle 跑 lint 等于为构建器报错，噪音门。

---

## 6. 引用链接（一手 only）

**仓库结构（GitHub API，main 分支实时树）：**

- tRPC 包一览：<https://github.com/trpc/trpc/tree/main/packages>（server/client/react-query/next/openapi/tests）
- tRPC server src：<https://github.com/trpc/trpc/tree/main/packages/server/src>（shim＋unstable-core＋adapters＋observable＋__tests__＋vendor）
- tRPC server exports（15 子路径）：<https://github.com/trpc/trpc/blob/main/packages/server/package.json>
- Effect 包一览：<https://github.com/Effect-TS/effect/tree/main/packages>
- Effect effect/src（扁平 PascalCase）：<https://github.com/Effect-TS/effect/tree/main/packages/effect/src>
- Effect 生成式 barrel：<https://github.com/Effect-TS/effect/blob/main/packages/effect/src/index.ts>（`// @barrel: Auto-generated exports. Do not edit manually.`）
- Effect 包内 test/typetest/benchmark/typeperf：<https://github.com/Effect-TS/effect/tree/main/packages/effect>
- Vite src 按运行时切分：<https://github.com/vitejs/vite/tree/main/packages/vite/src>（client/module-runner/node/shared/types）
- Vite node 层＋就近 `__tests__`/`__tests_dts__`：<https://github.com/vitejs/vite/tree/main/packages/vite/src/node>
- Vite 内外双 barrel：<https://github.com/vitejs/vite/blob/main/packages/vite/src/node/index.ts> ＋ <https://github.com/vitejs/vite/blob/main/packages/vite/src/node/internalIndex.ts>

**官方文档/CONTRIBUTING（一手）：**

- tRPC CONTRIBUTING Project overview（角色包＋共享上浮＋六边形 adapters＋packages/tests 集成）：<https://github.com/trpc/trpc/blob/main/CONTRIBUTING.md>
- tRPC DO-NOT-IMPORT 头（命名即门禁）：<https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import.ts>
- tRPC 根门禁（turbo/ts-prune/manypkg）：<https://github.com/trpc/trpc/blob/main/package.json>
- Effect 根门禁（tsc-b/codegen/circular/doctest/tstyche/changeset）：<https://github.com/Effect-TS/effect/blob/main/package.json>
- Vite CONTRIBUTING（devDeps 预打包/类型内联/双轨测试/playground/commit-convention）：<https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md>
- Vite 根门禁（oxlint/oxfmt/lint-staged/test-docs）：<https://github.com/vitejs/vite/blob/main/package.json>

---

## 7. 红队自查（防生搬硬套总表）

每条推荐的“不适用反例”已内嵌于 §5（每条 MUST/SHOULD/NOT 末尾 ❌ 行，共 15 条）。总原则：三家标杆皆为**多包 monorepo＋发包语义**，本仓是**单包单插件＋宿主内运行**——凡服务于“包版本协同”（changesets/turbo/manypkg/双口 semver）与“多业务域”（特性切片）的手段，默认 NOT；凡服务于“运行时边界”（Vite node/client）、“依赖方向”（Effect circular/tRPC DO-NOT-IMPORT）、“门禁收敛”（一条 check）的手段，默认 MUST/SHOULD。
