# 更新包在构建期内联进 lib/update.js，版本冻结

本插件的「检查更新 / 一键更新」由外部包 `dsh-plugin-update` 提供（同一作者的独立包，非本仓产物）。该包**不留在 `dependencies`**，而是作为**构建期输入**（精确钉在 `devDependencies`）由 esbuild 内联进 `lib/update.js`（`scripts/update/build-host.mjs`）。这样它的代码住在**本插件包内**：`dist/reader.js` / `dist/host.js` 用 `containingPackage(fileURLToPath(import.meta.url), 'dsh-prompt')` 反推「正在运行的包」时，上溯第一个命中的就是本插件的 `package.json`，`loaded == installed` 成立。留 externals 时这段代码住在 `<profile>/node_modules/dsh-plugin-update/dist/`，而真机 profile 是 DSH 自己写死的 **hoisted** 布局（不一致还会被改回来），上溯到盘根都没有一个叫 `dsh-prompt` 的包 ⇒ `loaded = null` ⇒ 三条更新路由只会回 `unknown-profile`（受控复现见 `scripts/test-issue-39.cjs` 的 13) 段）。

**状态**：accepted（#58 拍板；升级清单于 2026-09-30 补写）

## 考虑过的选项

- **留 externals，把它放进 `dependencies`** —— 用户装到的包里会有第二份更新包，但真机 hoisted 布局下它不一定与本插件包同层；`containingPackage` 上溯命不中本插件包时三条路由全降级为 `unknown-profile`。已实测证伪（#55 / #58）。
- **留 externals，运行时动态 `import('dsh-plugin-update')`** —— 同上，且把「能不能更新」交给用户环境的解析结果，失败面更大。
- **构建期内联 + 精确钉版（选定）** —— 插件自包含、行为可复现；代价是版本被冻结在构建那一刻。

## 后果

- **上游发新版，本插件不会自动跟上。** 升它是一条人工路径（`npm run check:update-pkg` 会在上游版本与钉版不同时把下面这份清单打出来，并以退出码 1 提示）：
  1. `npm i -D dsh-plugin-update@<新版>`（**精确版本**，不要 `^` / `~` / `latest`）
  2. 上游改了客户端派生值：`npm run derive:update-values`（重生成 `src/update/gen/updateClient.derived.js`）
  3. 上游改了宿主 API / 类型：同步 `src/update/dsh-plugin-update.d.ts` 垫片与 `src/update/host/index.ts` 调用点
  4. 改冻结点：`scripts/test-issue-39.cjs` 的钉版断言（有意为之 —— 逼一次人工确认，不让版本悄悄漂）
  5. `npm run build`（重建 `lib/update.js`，banner 里的 `INLINED_UPDATE_PKG_VERSION` 跟着变）
  6. 跑 `npm run test:lib-sync` + `npm run test:issue-39` + 全量 → 升本插件版本号 → 提交（**含 `lib/` 产物**）→ 发布
- **三道门禁只在「动了之后」拦得住，所以还需要一条「该动了」的提醒**：
  - `scripts/update/build-host.mjs` 的拒收门：打包后立刻验产物 —— 内联标记在、没有对更新包的裸导入、**产物版本标记 == `devDependencies`**、**`node_modules` 实装版本 == `devDependencies`**；不满足就拒收并把 `lib/update.js` 恢复原样、exit 1。
  - `scripts/test-issue-39.cjs` 第 1 段：`dependencies` 里不许有它、`devDependencies` 必须精确钉版、产物里不许裸导入。
  - `npm run test:lib-sync`：换了包却忘了重建 ⇒ 检入的 `lib/update.js` 与重新构建的字节不一致 ⇒ 红。
  - `npm run check:update-pkg`（本 ADR 补的那条）：查 registry 上它的 latest 与钉版比对。退出码 **0 = 同版 / 1 = 有差异需人工确认 / 2 = 查不到（离线，不算通过）**。
- **用户装到的包里不再有 `dsh-plugin-update`** —— 这正是要的效果（插件自包含，不依赖「插件包外恰好有一份更新包」）；但任何新增的宿主侧调用都必须经 `src/update/host/index.ts` 走构建，不能再出现运行时裸导入。

## 修订（#98，2026-10-01，覆盖“人工钉版”部分）

用户在地图 #96 两次明确拍板：每次打包自动跟上游最新。上述 6 步清单的第 1 步改为由
`scripts/update/ensure-latest.mjs` 在构建起点自动执行（`npm install --save-exact -D`），
`test-issue-39` 第 1 段不再认写死的版本号（只认精确格式 + 三处一致），`check:update-pkg`
转为发版门。不变的是：内联形态、精确记录、banner 版本标记、三处一致门禁、离线不硬建。
回溯凭据：产物 banner 的 `INLINED_UPDATE_PKG_VERSION` + `package.json` 精确值 + lock。
