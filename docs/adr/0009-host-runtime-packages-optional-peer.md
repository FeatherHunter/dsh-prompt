# 宿主运行时包只声明为可选 peerDependencies，绝不进 dependencies

**状态**：accepted（#147 拍板，2026-10-17）

## 背景

`@deepseek-ai/dsh-storage-domain` 是 DSH 宿主自带的运行时包（宿主的 `storageDomain` 服务由它提供），插件在 `lib/index.js` 里裸导入它来 `defineDomain` / `domainTable`。

此前为了让「未装依赖的仓库目录直接跑」能自包含解析，一份副本被放进 `devDependencies`（`scripts/check-host-deps.mjs` 的注释里记作背景 A）。#147 报告的是另一头：它被写进了 `dependencies`。

profile 是 loader 根：profile 的 `node_modules` 里那份副本会遮住宿主那一行（row id `storage-domain` 解析到副本）。DSH 0.2.1 线的 `@deepseek-ai/dsh-app-boot` 兼容门 `evaluatePluginCompatibility` 在插件没有自己的 `engines.dsh` 时，拿副本声明的每条 `@deepseek-ai/dsh*` peer 版本与运行时版本逐个比对；副本声明 `0.2.0-rc.2`、运行时是 `0.2.1-rc.2`，而 `^0.2.0-rc.2` 按 semver 预发布规则不覆盖 `0.2.1-rc.2`（预发布元组只有 `major.minor.patch` 相同时才互配）⇒ 门禁用掉 `storage-domain` 行 ⇒ `storageDomain` 服务永远缺席 ⇒ 插件 `pending (waiting for service: storageDomain)`。

桌面端没遇到，只是因为那个 profile 里恰好有一条 pnpm `overrides` 把副本钉到与宿主同版（宿主不会自动替用户写这条）。受控复现：DSH 0.2.1-rc.2 运行时 + 空白 web profile + 已发布的 dsh-prompt@0.4.29，启动即打出 `disabling profile plugin row "storage-domain": … incompatible with dsh 0.2.1-rc.2: requirements {"@deepseek-ai/dsh-invariants":"0.2.0-rc.2","@deepseek-ai/dsh-storage":"0.2.0-rc.2"}` 与 `pending (waiting for service: storageDomain)`。

## 决定

- 宿主运行时包（`@deepseek-ai/dsh-*` 与 `@deepseek-ai/cordis`）**只允许**出现在 `peerDependencies`，且必须 `peerDependenciesMeta.<pkg>.optional = true`；版本值用 `>=<下界>` 形式。不写精确 pin、不带上限——`autoInstallPeers` 场景下精确 pin 会把副本钉回旧线，重演 #147。
- 本地开发 / 测试仍要一份真包：副本放 `devDependencies`，不随 npm 包进用户的 profile。
- 门禁 `scripts/check-host-deps.mjs`（`npm run check:host-deps` 与别名 `npm run test:issue-147`）静态证明这件事：dependencies 里没有宿主运行时包（不管有没有被裸导入）、peer 形状正确、产物里每个裸导入都可解析、`package-lock.json` 与 `package.json` 一致、生产依赖闭包里不出现宿主运行时包；再真 `import()` 一次产物验证形状。
- 用户可见的说明写在 README「支持的 DSH 版本」段（中英同步；同段专门说明这是依赖声明、不是版本支持面）。

## 考虑过的选项

- **只放宽 peer 区间，或给宿主版本加豁免** —— 副本仍在 profile 里遮住宿主那一行，插件依赖的是副本而不是宿主；诊断丢了、升级面更乱，只治标。
- **保留 `dependencies`，让用户自己写 overrides** —— 把宿主该做的事推给用户；桌面端眼下正是这么侥幸躲开的，不能当契约。
- **运行时动态 `import('@deepseek-ai/dsh-storage-domain')` 并降级** —— 插件必须提供 domain（`promptDomainSpec`），缺了它插件半残；且把「能不能用」交给用户环境的解析结果。
- **可选 `peerDependencies` + `devDependencies` 本地副本（选定）** —— profile 不再多出副本，宿主那一行自己解析；生态先例：dsh-usage-statistics-panel、dsh-vision-router 都用可选 peer 声明宿主包。

## 后果

- profile 里不再出现 `@deepseek-ai/dsh-storage-domain` 副本；0.2.1-rc.2 运行时下的新鲜安装与从 0.4.29 升级都实测干净启动、插件激活。
- `dsh.engines.dsh` 门槛不变（仍是 `>=0.2.0-rc.2`）。这次改的是依赖声明，不是版本支持面——0.2.1-alpha 线未验证，README 照实写明。
- 以后新增的宿主运行时依赖必须照此形状声明；门禁会拦下任何写回 `dependencies` 的改动，包括「加了依赖但没被导入」这种不会在运行时暴露的情况。
- 本地开发 / 测试解析 `devDependencies` 里那份副本；干净环境 `npm ci` 会装上它，不影响发布产物。
