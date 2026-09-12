# dsh-plugin-update 集成调研（dsh-prompt 能否采用）

调研对象：npm 包 `dsh-plugin-update@0.1.1`（`C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-plugin-update`），
参考集成方 `dsh-mattpocock-skills-deck@1.7.21`（下称 wf，`C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-mattpocock-skills-deck`），
消费方候选 `dsh-prompt@0.1.7`（本仓，`D:\dsh-plugin\dsh-prompt`）。
只读调查，未改动任何既有文件（本报告为新建文件）。

---

## 1. 「电话表」到底是什么：DSH 没有这个 API，它是本插件族的用词

**结论：DSH 侧不存在名为「电话表 / phone registry」的公开 API。**「电话」是该插件族对「宿主对外提供的方法」的称呼
（`dsh-plugin-update/README.md:6`：「电话指宿主对外提供的方法」）。包 README 第 2 步里那句
`registry.set(name, handler)` 里的 `registry` 是**调用方自己的 Map**，不是 DSH 服务。

wf 的实际落地是「自建 Map + 注册到 DSH 的精确 Fetch 路由」，共三层：

**(a) 自建 Map（wf 的「电话表」本体）** — `lib/index.js:38-44`

```js
const __DSW_HANDLERS__ = new Map()
const harness = {
  handle: (method, fn) => {
    const endpoint = method.replace(/^wf\./, '')
    __DSW_HANDLERS__.set(endpoint, fn)
  }
}
```

**(b) 注册进 DSH** — `lib/index.js:344-345` → `lib/rpcChannel.js:103-108`

```js
const disposed = fetchRegistry.register({
  path: DSW_RPC_ROUTE,          // '/api/dsws'
  methods: ['POST'],
  requestBody: 'buffered',
  fetch: routeFetch,
})
```

**(c) DSH 侧真实 API**：`ctx.get('connection').fetch.register(route)`，实现见
`@deepseek-ai/dsh-client-connection/lib/index.js` 的 `HostConnectionService`：

```js
get fetch() {
  return { register: (route) => this.registerFetchRoute(owner, route) };
}
```

同文件还有 `get rpc() { return { handle: (channel, handler) => this.register(owner, channel, handler) } }`，
其内部是 `owner.effect(() => owner.webServer.register(route), ...)` —— wf 明确放弃了这条，原因写在
`lib/rpcChannel.js:90-95`：那个 `owner` 没有 `webServer` 注入，装配期直接抛
`cannot get property "webServer" without inject`。

第三条通道是 dsh-prompt 现在用的这条：`ctx.webServer.register({kind:'prefix', path, handler})`
（`@deepseek-ai/dsh-host-webserver/lib/index.js` 的 `register(route)`，`kind` 取 `exact` / `prefix`）。

**更新包对通道完全无感**：`createHostUpdate` 返回的就是「电话名 → 普通异步函数」的对象，
注册到哪里由调用方定 — `dist/host.js:246-251`

```js
const handlers = {
  [phoneNames.updateStatus]:  loggedPhone(phoneNames.updateStatus,  "update-status",  pluginId, readStatus),
  [phoneNames.updateCheck]:   loggedPhone(phoneNames.updateCheck,   "update-check",   pluginId, readCheck),
  [phoneNames.updateInstall]: loggedPhone(phoneNames.updateInstall, "update-install", pluginId, runInstall)
};
return { phoneNames, handlers };
```

---

## 2. 客户端调什么、怎么接线

wf 的客户端**没有**用 DSH 的 RPC 服务（`ctx.remote`），而是自造了一个 `host.call` shim，
再落到同一条 `/api/dsws` 通道上：

`lib/client.js:65-77`

```js
const CARRIER_CHANNEL = '/api'
const CARRIER_ENDPOINT = 'dsws'
const __rpcCall = async function (endpoint, args) {
  const conn = __DSW_CTX__ && __DSW_CTX__.get ? __DSW_CTX__.get('connection') : undefined
  if (conn === undefined || conn.rpc === undefined) throw new Error('connection 服务不可用')
  const res = await conn.rpc.call(CARRIER_CHANNEL, CARRIER_ENDPOINT, { method: endpoint, payload: args })
  if (res && res.ok) return res.value
  throw new Error((res && res.error && res.error.message) || ('RPC 失败：' + endpoint))
}
const host = { call: (method, args) => __rpcCall(method.replace(/^wf\./, ''), args) }
```

派生常量（**已确认不是 minified，是 bundle 里可读的源码**）— `lib/client.js:13017-13026`：

```js
const UPD_PHONE_NAMES = updBuildClientPhoneNames("wf")
const UPD_POLL_MS = CLIENT_POLL.defaultMs
const UPD_POLL_MIN_MS = CLIENT_POLL.minMs
// 零变化断言（默认前缀 wf 下与旧字面一字不差…）
void (UPD_PHONE_NAMES.updateStatus === 'wf.updateStatus' && ... && UPD_POLL_MS === 1000)
const UPD_STATUS = UPD_PHONE_NAMES.updateStatus
const UPD_CHECK = UPD_PHONE_NAMES.updateCheck
const UPD_INSTALL = UPD_PHONE_NAMES.updateInstall
const UPD_POLL = UPD_POLL_MS
const UPD_POLL_MIN = UPD_POLL_MIN_MS
```

三处调用 + 轮询：`lib/client.js:13329`（`host.call(UPD_STATUS, {})`）、
`lib/client.js:13351`（`host.call(UPD_CHECK, {})`）、
`lib/client.js:13377`（`host.call(UPD_INSTALL, { checkId: updCheckId, requestId })`）、
`lib/client.js:13399`（`setInterval(function () { updReadStatus() }, UPD_POLL)`）。

**派生工具**：`dsh-plugin-update/derive-client-values.mjs`（包内随包发布，用法见其 1-31、84-171 行）。
wf 的生成脚本叫 `scripts/derive-update-from-package.mjs`，但在**已发布的包里找不到**
（wf 包内 `scripts/` 只有 `fix-issue-body.mjs`、`wire-subissues.mjs`）。
没有找到 wf 仓库里生成出来的独立文件（`updateClient.derived.js` 之类）——派生内容是被**内联拼进
`lib/client.js` 闭包**的（见 `lib/client.js:12912-12914` 的注释与 `12915`/`12941`/`12998` 的
`// packages/dsh-plugin-update/src/*.ts` 分段标记）。

---

## 3. 采用这个包需要满足什么条件；「宿主只有 checked-in lib/index.js」够不够

**够。** 更新包的宿主入口是普通 ESM，不需要消费方有宿主构建步骤。

逐条核对：

| 条件 | 依据 | dsh-prompt 现状 |
|---|---|---|
| `dependencies` 里加 `dsh-plugin-update` | 包 `"type":"module"`，`exports["."] = "./dist/host.js"`（`package.json:10-14`）；wf 写的是 `"dsh-plugin-update": "0.1.1"`（wf `package.json:21-23`） | ❌ 未加（现在只有 `@deepseek-ai/dsh-storage-domain` + `zod`） |
| 宿主入口能静态 `import` 该包 | 包是 ESM、零运行时依赖 | ✅ `lib/index.js` 已是 ESM（`"type":"module"`，`"main":"lib/index.js"`），加一行 import 即可 |
| 目标包 manifest 过 `validPackage()` | `dist/reader.js:46-71`：`name` 匹配、`version` 形如 `x.y.z`、`main`、`exports["./client"]`、`dsh.bundle.patch` 四者都必须是包内**真实存在**的文件 | ✅ `main=lib/index.js`、`exports['./client']=./lib/client.js`、`dsh.bundle.patch=./cordis.patch.yml`，且 `files: ["lib","cordis.patch.yml"]` |
| profile manifest 里目标包必须是「按版本号」的 spec，不能是 `link:`/`file:` | `dist/reader.js:144` `result.sourceInstall = !registrySpec(deps[targetPackageName]) || ...`，`sourceInstall` 会直接挡住安装 | ✅ 真实 profile 写的是 `"dsh-prompt": "^0.1.7"` |
| 客户端要有一处「按名字调宿主」的通道 | 包本身不管通道；但 README 第 3 步的面板示例假设存在 `host.call(name, args)` | ❌ **dsh-prompt 没有 `host.call`**，只有 `fetch('/_dsh/dsh-prompt/*')` |
| 构建期能跑 `derive-client-values.mjs`（需 esbuild） | 该脚本 `loadEsbuild()`（`derive-client-values.mjs:68-82`）：优先从包自己 `node_modules` 找，找不到再从消费方仓库找 | ❌ 实测两处都没有 esbuild（见下） |
| Node ≥ 22 | 包 `engines.node: ">=22"`（`package.json:7-9`）；Desktop 的是 `^22.19.0 \|\| >=24.0.0` | ✅ 本机 node v24.19.0 |

**esbuild 实测**（这是最容易被忽略的一步）：

```
Test-Path D:\dsh-plugin\dsh-prompt\node_modules\esbuild                                  -> False
Test-Path C:\...\node_modules\dsh-prompt\node_modules\esbuild                             -> False
Test-Path C:\...\node_modules\dsh-plugin-update\node_modules                              -> 不存在（包无 dependencies，devDependencies 只有 typescript）
```

dsh-prompt 的 client 打包走 tsdown，依赖链是 `@rolldown` / `@oxc-project` / `yuku-*`，**不含 esbuild**。
要跑官方派生工具必须额外 `npm i -D esbuild`；否则只能手写那 5 个常量
（它们只是 `prefix + '.updateStatus'` 之类，手写风险很低）。

**ctx 依赖**：`createHostUpdate({ctx, logCtx}, {...})` 会经 `ctxService()`（`dist/host.js:24-31`）
在运行时 `ctx.get('desktopProfiles' | 'desktopPnpm' | 'subprocess')` 判断走哪条安装路由。
wf 的 `inject` 只有 `['connection']`，却照样 `ctx.get('subprocess')` / `ctx.get('timer')` / `ctx.get('fs')` 成功
（wf `lib/index.js:27-32`，取不到就 `return`），说明 **`ctx.get` 不要求先声明 inject**。
所以 dsh-prompt 现有的 `inject = ["storageDomain", "webServer"]`（`lib/index.js:23`）**大概率可以不动**——
但这一点我没有在 dsh-prompt 的宿主进程里实跑验证（见「结论」未知项）。

---

## 4. wf 是直连包，还是复制/改编的副本

**两者都做了，但运行时走的是副本，不是 npm 包。**

**(a) 宿主侧：复制（派生）** — `lib/updateFromPackage.js:15`

```js
import { createHostUpdate, __resetSharedUpdateReaderForTests as resetPackageReader } from './updatePkg/host.js'
```

`lib/updatePkg/{commands,config,gate,host,ports,reader,service,store}.js`（8 个）与
`dsh-plugin-update/dist/*.js` **逐行相同**（`Compare-Object` 实测：每个文件只有 3 行差异，
就是文件头那三行中文注释「派生文件（#586）：由 packages/dsh-plugin-update/dist/xxx.js 原样复制，
内容与更新包 0.1.1 一致，人手不改。」）。文件体里连 `// AUTO-GENERATED by node
packages/dsh-plugin-update/build.mjs` 那行都原样保留。

**(b) 旧一代副本（不是 0.1.1）** — `shared/update/{commands,ports,service}.js`
头注释写的是 `// AUTO-GENERATED by node update-core/build.mjs … Source: update-core/src/xxx.ts`，
且 `service.js` 与 0.1.1 有 **351 行差异**（例如 `fetchNpmRelease(fetchImpl, timeoutMs = CHECK_TIMEOUT_MS)`
没有 `opts.targetPackageName` / `opts.registryUrl`，URL 里写死 `PACKAGE_NAME`）。
即：这是包发布前的 `update-core` 版本残留在 `shared/`，属历史遗留，不是 0.1.1 的副本。

**(c) `dependencies` 里确实声明了，但运行时不 import**

wf `package.json:21-23`：`"dependencies": { "dsh-plugin-update": "0.1.1" }`。
全仓 grep `from 'dsh-plugin-update'` / `require('dsh-plugin-update')`：**零命中**；
所有引用都是相对的 `./updatePkg/...`。
（这个依赖声明仍有用：它使 pnpm 把 `dsh-plugin-update` 真实装进 profile，
从而 `dist/host.js` 里的 `containingPackage(fileURLToPath(import.meta.url), ...)`
有实体可指——但 wf 运行时用的是副本，而副本的 `import.meta.url` 落在 wf 自己的目录里。）

**(d) 还有一层旧实现回退** — `lib/index.js:325-330`

```js
function _update() { if (!_updateP) _updateP = (async function(){ const args = { logCtx: logCtx, ctx: ctx };
  try { const migrated = await import('./updateFromPackage.js'); return migrated.createUpdatePhoneHandlers(args) }
  catch (ePkg) { const mod = await import('./update.js'); return mod.createUpdatePhoneHandlers(args) } })(); return _updateP }
harness.handle('wf.updateStatus', async function (args) { const h = await _update(); return h.handleUpdateStatus(args) })
```

`lib/update.js:212-214` 是旧实现，电话名是手写字面量 `'wf.updateStatus'` / `'wf.updateCheck'` / `'wf.updateInstall'`。

**对 dsh-prompt 的建议**：不要照抄「复制 dist」的做法。直接
`import { createHostUpdate } from 'dsh-plugin-update'` 更干净，升级只改一处版本号。

---

## 5. 网络调用、比对口径、安装执行

**registry / 目标包**（`dist/config.js:2-6`）：

```js
const DEFAULT_PREFIX = "wf";
const PHONE_ACTIONS = ["updateStatus", "updateCheck", "updateInstall"];
const DEFAULT_TARGET_PACKAGE = "dsh-mattpocock-skills-deck";
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
```

**请求**（`dist/service.js:105-117`）：`GET ${registry}${encodeURIComponent(targetName)}/latest`，
`headers: { accept: 'application/json' }`，`redirect: 'error'`，`signal: AbortSignal.timeout(checkTimeoutMs)`（默认 10000）。

**响应校验**（`dist/service.js:118-140`）：≤ 256 KiB；`value.name === targetName`；
`version` 必须匹配 `^\d+\.\d+\.\d+$`；`engines.node` 若存在必须是字符串；
`dist.tarball` 的 origin 必须等于 registry 的 origin、路径必须恰好 `/${name}/-/${name}-${version}.tgz`；
`dist.integrity` 必须匹配 `^sha512-[A-Za-z0-9+/]{86}==$`。

**「当前版本」（runningVersion）怎么来** — `dist/host.js:83-86`

```js
const loaded = await containingPackage(fileURLToPath(import.meta.url), targetPackageName).catch(() => null);
const runningVersion = overrides.runningVersion ?? (loaded && validVersion(loaded.manifest.version) ? String(loaded.manifest.version) : null);
if (!runningVersion) throw Object.assign(new Error("unknown-profile"), { code: "unknown-profile" });
```

`containingPackage`（`dist/reader.js:26-39`）从**包自己 `dist/host.js` 的位置向上走**，
找最近的 `package.json` 且 `name === targetPackageName`。
由此推出的 profile 目录见 `dist/host.js:61-77`：切 `.../node_modules/<target>` 之前的部分；
**切不出来时硬编码回落 `join(homeDirDefault, "profiles", "web")`**。

**「磁盘已装版本」（installedVersion）**：读 `profileDir/package.json` 与
`profileDir/node_modules/<target>/package.json`（`dist/reader.js:137-146`）。
home 目录 = `DSH_HOME` 环境变量优先，否则 `~/.dsh`（`dist/reader.js:72-77`；本机实测 `DSH_HOME=C:\Users\辰辰洋洋\.dsh`）。

**比对口径**（`dist/service.js:208-229`）：

```js
const canInstall = Boolean(
  env.eligible && !blockedReason && !busy && fresh &&
  checked?.installationKey === env.installationKey &&
  validVersion(runningVersion) && checked?.release &&
  compareVersions(checked.release.version, runningVersion) === 1
);
```

`compareVersions` 是自写的三段十进制比较（`dist/service.js:18-40`，不认 prerelease）。
`pending-restart` 的判据是 **`installedVersion !== runningVersion`**（`dist/reader.js:161`），与 latest 无关。

**安装执行两条路由**（`dist/store.js:316-337`）：

```js
exitCode = recipe.route === "desktop-service" ? await runDesktopService(recipe, parts) : await runCliProcess(recipe, parts);
```

- desktop（`dist/store.js:283-296`）：`desktopPnpm.runPlugin(recipe.pluginArgs, profileDir, undefined)`，
  且先要求 `desktopProfiles.current.dir` 与 `profileDir` `sameDir`，否则诚实失败。
- cli（`dist/store.js:297-315`）：`subprocess.spawn({ argv: [execPath, ...execArgv, cliEntry, 'plugin', '--profile', profileName, ...pluginArgs], cwd: profileDir, stdio: {stdin:'ignore', stdout:{maxBytes:64k}, stderr:{maxBytes:64k}}, graceMs: 3000 })`。
  `cliEntry` 由 `resolveCliEntry(process.argv[1])` 向上找 `name === '@deepseek-ai/dsh'` 的 manifest 并核对 `bin.dsh`（`dist/store.js:207-240`）。

**pluginArgs 形状**（`dist/commands.js` 的 `installRecipe`）：`["add","--save-exact",`${target}@${version}`,`--registry=${registry}`]`。
手工兜底命令形状同理（包 README 第 9 节 / wf `lib/client.js:12995`）：
`dsh plugin --profile <me> add --save-exact dsh-prompt@1.2.3 --registry=https://registry.npmjs.org/`。

**在 DSH 侧核实**：`dsh plugin --profile <name> <args...>` 就是把 args 原样转发给 pnpm
（`@deepseek-ai/dsh/lib/plugin-Ddi42qoW.js` 的 `runPlugin()`：`spawnSync("pnpm", args.map(...), { cwd: dir, stdio: "inherit", shell: process.platform === "win32" })`），
所以 `--save-exact` 与 `--registry=` 都是 pnpm 参数，合法。

**日志事件**：`host.call` / `host.call.fail`（`dist/host.js:203,207`）、`update.install.exec`（`dist/store.js:273-279`，字段 `route/ok/exitCode/durationMs/pluginId`）。

---

## 6. 落盘位置 —— 已在真实文件系统核实

路径规则（`dist/store.js:21-31`）：`<home>/updates/<pluginId>/<sha256(profileDir) 前 24 位>/`，
三文件名固定 `state.json` / `install.lock` / `before.json`。
`pluginId === 'dsh-mattpocock-skills-deck'` 时读旧路径、写新路径，本机两者相同。

`C:\Users\辰辰洋洋\.dsh\updates\` 现状（实测，2026-09 时间戳）：

```
dsh-im\673e0ed90d45ec65705231c3\before.json                       106249
dsh-im\673e0ed90d45ec65705231c3\state.json                           276
dsh-mattpocock-skills-deck\673e0ed90d45ec65705231c3\before.json   107900
dsh-mattpocock-skills-deck\673e0ed90d45ec65705231c3\state.json       172
```

- 没有任何 `install.lock` → 当前无进行中的安装。
- 两个插件共用同一 profileDir（`...\.dsh\profiles\web`），所以指纹都是 `673e0ed90d45ec65705231c3`。
- wf 的 `state.json`：`{"id":"1d249dc1-...","state":"restart-required","targetVersion":"1.7.18","message":null,"requestId":"req-1789028022387-14881"}`
  —— 而磁盘上 wf 实际是 **1.7.21**。按 `healJob`（`dist/service.js:199-205`），
  `restart-required` 且 `installedVersion !== targetVersion` 时会被改写成
  `{ state: 'interrupted', message: 'installation-changed' }`，即这条记录已经过期。
- dsh-im 的 `state.json`：`{"state":"restart-required","targetVersion":"4.17.1","previousVersion":"4.13.0",...}`。
- `before.json` = profile 的 `package.json` + `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`package-lock.json` 快照（`dist/store.js:155-173`）。

---

## 7. 参考面板 UI：有，但**不在 npm 包里**

包 README 第 2 节点明「面板界面不进包」。wf 的面板在 `lib/client.js` 里，
且 **`lib/client.js` 并没有被压缩**（1.06 MB，带完整中文注释，可以直接读源码）——
下引全部是源码行，不是 minified 片段。

- 落点：`settings.plugins.tab`（`lib/client.js:13784-13786`）+ 兼容 `settings.section`（`:13790`）：
  ```js
  return slots.register({ name: 'settings.plugins.tab', id: 'dsws-settings', order: 40,
    label: function () { return tr('panel.title') } }, withCx(SettingsPage))
  ```
- 三个自包含件：
  - **`UpdateDialog`**（`lib/client.js:13168-13208`）：走仓库自带的 `.dsws-modal` **居中浮层**（不是内联分组），
    点遮罩空白关闭；内容依次是标题「发现新版本 {v}」→ 说明 → 版本对照 → **重启说明写在安装按钮之前** →
    失败行 → `blockedReason` → 手工命令 + 一键复制 → `安装更新` / `稍后`。
  - **`UpdateRestartBanner`**（`:13221-13232`）：`className: 'dsws-restart-row'`，`'data-role': 'update-restart-banner'`，
    图标 + 「待手动重启」+「已装 {to}（当前跑的仍是 {from}），重启一次就生效」。
  - **`useUpdatePanel`**（`:13285-13438`）：全部状态与三次电话调用；`React.useEffect(() => updReadStatus(), [])` 开面板即读；
    只有 `updJobState === 'installing' || 'verifying'` 时才按 `UPD_POLL` 轮询（`:13396-13401`）。
- 页面里三处引用：按钮 `h('button', { className:'dsws-cfg-btn', disabled: upd.disabled, onClick: upd.onClick, ... }, upd.label)`（`:13600`）、
  `upd.banner`（`:13609`）、`upd.dialog`（`:13611`）。
- 判据全部落在快照字段上：`pending: !!(snap && snap.blockedReason === 'pending-restart')`（`:13267`）。

**⚠️ 八条 `blockedReason` 中文文案：wf 没做。** 它只把英文码原样塞进模板：
`'cfg.updateBlocked': '装不了：{reason}'`（`:1507` 行区，en 在 `:1043` 区）。
`cfg.updateFailChanged` / `cfg.updateFailRecovery` / `cfg.updateFailInstall` 三条对应的是 **`job.message`**
（`installation-changed` / `recovery-required` / 其它），不是那 8 个 `blockedReason`（`:13408`）。
包 README 第 8 节要求的「直接展示『用户该做什么』那一列的一句话」**在 wf 里未落实**。

---

## 8. DSH 版本事实

| 项 | 值 | 来源 |
|---|---|---|
| 全局 npm CLI `@deepseek-ai/dsh` | **0.1.5-rc.1** | `D:\2Study\nodejs\node_modules\@deepseek-ai\dsh\package.json`（`name=@deepseek-ai/dsh`，`bin.dsh=lib/bin.js`，**无 `engines`**、无 `peerDependencies`） |
| 该目录下 `@deepseek-ai/` 其它包 | 只有 `dsh` 一个 | `D:\2Study\nodejs\node_modules\@deepseek-ai\` |
| DSH Desktop 应用 | **2.0.9**（`ProductName=DSH Desktop`, `ProductVersion=2.0.9.0`, `FileVersion=2.0.9`） | `D:\0Tools\DSH Desktop\DSH Desktop.exe` 的 VersionInfo |
| Desktop 内层包 | `dsh-plugin-desktop` **2.0.9**，`engines.node: "^22.19.0 \|\| >=24.0.0"`，`dependencies: { "@deepseek-ai/dsh": "0.1.5-rc.1", ... }` | `resources\app.asar` 根 `package.json` |
| Desktop 内 243 个 `@deepseek-ai/*` 包 | 全部 **0.1.5-rc.1**（cordis 4.0.2、cordis-plugin-* 1.x 例外） | 逐个读 `node_modules/@deepseek-ai/*/package.json` |
| 更新源 | `owner: anywhere-labs`, `repo: deepseek-harness-desktop`, `provider: github` | `resources\app-update.yml` |
| profile 内 `@deepseek-ai/*` | **只有 3 个**：`cosmokit 1.8.3`、`dsh-storage-domain 0.1.5-rc.2`、`schemastery 3.18.2` | `C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\@deepseek-ai\` |
| profile 实际装的本人插件 | `dsh-prompt 0.1.7`（spec `^0.1.7`）、`dsh-mattpocock-skills-deck 1.7.21` | `...\profiles\web\package.json` |
| `DSH_HOME` | `C:\Users\辰辰洋洋\.dsh` | 环境变量实测 |

**关于 `app.asar`**：它是可解析的归档（8 字节 pickle 头 + headerSize + JSON 目录 + 数据区）。
我用只读的偏移读取方式取出文件正文（复用了仓库里已有的
`.tmp-verify/research-dsh-log/probe-asar.mjs`），**没有解开、没有改动**任何东西。
`resources\app.asar.unpacked\` 里只有 `node-pty` / `pnpm` / `node-addon-require-builtin-*`，
DSH 本体与全部 `dsh-*` 包都在 `app.asar` 内部。

---

## 9. DSH 有没有「支持的 DSH 版本」/ 插件兼容约定

**没有版本兼容约定。** 实测四路证据：

1. **243 个 `@deepseek-ai/*` 包中，`peerDependencies` 指向 `@deepseek-ai/dsh`（精确名）的：0 个。**
   它们 peer 的是 `@deepseek-ai/cordis`（如 `^4.0.2`）与各自的兄弟包
   （例：`dsh-agent` peer on `@deepseek-ai/dsh-llm@^0.1.5-rc.1`、`@deepseek-ai/dsh-session@^0.1.5-rc.1` …）。
2. **`dshVersion` / `dsh.engines` / `supportedVersion` 这类字段：全库 0 命中。**
   `@deepseek-ai/dsh` 自己的 manifest 也没有 `engines`；只有 Desktop 的 manifest 有 `engines.node`。
3. **唯一的正式约定是 `dsh` 字段的「形状」，不是版本**：
   - `dsh.bundle.patch` —— profile 层 bundle 声明（`@deepseek-ai/dsh-base`、
     `dsh-web-app`、wf、dsh-prompt 都有）。
   - `dsh.client.{platform, inject, immediately, external}` —— 客户端模块装配声明。
   - DSH 侧校验逻辑**不看版本**：`@deepseek-ai/dsh/lib/plugin-Ddi42qoW.js` 的
     ```js
     function exportsPatch(packageName, profileDir) {
       let dir; try { dir = resolveBundleDir(NAME, packageName, INSTALL_ANCHOR, profileDir) } catch { return false }
       return readProfileManifest(NAME, dir).dsh?.bundle?.patch !== void 0;
     }
     ```
4. **三个包的 README 里都没有「支持的 DSH 版本」段落**：对 `dsh-plugin-update/README.md`、
   wf `README.md`、`D:\dsh-plugin\dsh-prompt\README.md`、`docs/README.en.md`、`CONTEXT.md`
   grep `DSH 版本|dsh 版本|engines|peerDep|支持的 DSH` → 0 命中。

真正存在的兼容是**隐式的**：profile 装配机制 + `dsh.bundle.patch` 形状 + 运行时服务
（`connection` / `webServer` / `storageDomain` / `subprocess` / `desktopProfiles` / `desktopPnpm`）。
换言之，要立「支持的 DSH 版本」只能自己在插件里做（例如读 `ctx.get('desktopProfiles')`
或宿主暴露的版本号自行判断）。

---

## 结论

1. **可以采用，且宿主侧改动很小。** `createHostUpdate` 返回的是「电话名 → 普通异步函数」的普通对象，
   不依赖任何 DSH 专有 API；dsh-prompt 的 `lib/index.js` 已是 checked-in 的 ESM，加一行
   `import { createHostUpdate } from 'dsh-plugin-update'` 就能用，**不需要为宿主新增构建步骤**。
   需要改的只有：`package.json` 的 `dependencies` 加上 `dsh-plugin-update`，`prefix` 传 `prompt`，
   `targetPackageName` 传 `dsh-prompt`。

2. **唯一的真适配点是通道。** dsh-prompt 没有 `host.call` 电话表，客户端只有
   `fetch('/_dsh/dsh-prompt/*')`（`src/client/store.ts:46-50`）。包 README 第 3 步的
   `host.call(UPD_STATUS, {})` 必须换成「按派生出的电话名去 fetch」。三条路：
   (a) 给 client 加两行 shim `host = { call: (name, args) => fetchJson(urlFor(name), args) }`，
   把三个 handler 挂成现有 HTTP 桥上的三个端点（**改动最小，保持 dsh-prompt 现有架构**）；
   (b) 学 wf 加 `connection.fetch.register('/api/<channel>')` + `conn.rpc.call` 通道；
   (c) 迁到官方 `ctx.remote`（Typert remotes）——wf 与 dsh-prompt 的注释都表明这条路没有 profile 内先例，风险最高。

3. **不要照抄 wf 的「复制 dist」做法。** wf 把 `dist/*` 原样抄成 `lib/updatePkg/*`（只多 3 行头注释），
   同时又声明 `"dsh-plugin-update": "0.1.1"` —— 装好的包运行时**根本没被 import**，两处版本会各自漂移。
   dsh-prompt 直接 import 更干净（升级只改一处）。另外 wf 的 `shared/update/*` 是发布前
   `update-core` 那一代（`service.js` 与 0.1.1 有 351 行差异），是历史遗留，不要参考。

4. **构建期有个小坑：`derive-client-values.mjs` 需要 esbuild。** 实测
   dsh-plugin-update 包内没有 `node_modules/esbuild`，dsh-prompt 仓库里也没有
   （tsdown 走 rolldown/@oxc/yuku）。要么 `npm i -D esbuild`，要么手写那 5 个常量
   （`prompt.updateStatus` / `prompt.updateCheck` / `prompt.updateInstall` / `1000` / `250`），
   手写风险很低——wf 自己就带了一条「零变化断言」把生成值与旧字面锁在一起，可以照抄这个思路。

5. **面板 UI 必须自己写（包不含面板），但可以直接照 wf 的三个件搬家**：
   `UpdateDialog`（`.dsws-modal` 居中浮层）、`UpdateRestartBanner`（`data-role="update-restart-banner"`）、
   `useUpdatePanel`（状态 + 三次调用 + 只在 installing/verifying 时轮询）。
   它们的判据全在快照字段上（`blockedReason === 'pending-restart'`），与通道无关。
   **但要补 wf 没做的部分**：wf 只把 8 个 `blockedReason` 英文码原样显示（`'cfg.updateBlocked': '装不了：{reason}'`），
   包 README 第 8 节要求的「展示用户该做什么那一句话」在 wf 里不存在。

6. **落盘目录会从 `updates/dsh-mattpocock-skills-deck/<hash>` 换成 `updates/dsh-prompt/<hash>`**
   （`updates/<pluginId>/<sha256(profileDir) 前 24 位>/`，三文件名 `state.json`/`install.lock`/`before.json`）。
   本机该目录已被 dsh-im 与 wf 占用，互不串。注意 `inferProfileDir` 的**硬编码回落是
   `join(homeDir, 'profiles', 'web')`** —— 本机 profile 就叫 `web`，能正确解析；
   换成别的 profile 名（或 DSH 的保留名 `desktop`）时会静默指向 `profiles/web`。

7. **版本兼容上没有护栏可依。** DSH 没有 `dsh.engines` / `dshVersion` / `peerDependencies: @deepseek-ai/dsh`
   任何约定（243 个包 0 命中），唯一正式约定是 `dsh.bundle.patch` 与 `dsh.client.*` 的**形状**，
   且 `dsh plugin` 的 reconcile 逻辑（`exportsPatch()`）不看版本号。本机 DSH 全线是 **0.1.5-rc.1**
   （Desktop 2.0.9 内层），profile 里只有 3 个 `@deepseek-ai/*` 包。

8. **未解/未验证的项**（不影响「可以集成」的结论，但落地前值得确认）：
   - 安装到底走 desktop 路由还是 cli 路由，取决于运行时 `ctx.get('desktopProfiles')` 是否存在。
     dsh-prompt 现在 inject 只有 `["storageDomain","webServer"]`；我**没有实跑**验证
     `ctx.get('desktopProfiles'/'subprocess'/'desktopPnpm')` 在 dsh-prompt 的宿主里能拿到值
     （wf 的实例证明 `ctx.get` 不受 inject 限制，但没有 dsh-prompt 侧的直接证据）。
   - 桌面端当前激活的 profile 是 `web` 还是保留名 `desktop`：我只从磁盘布局
     （`profiles\web\node_modules`）与 DSH README「desktop 名字保留给 Electron」推断为 `web`，
     没有读 Desktop 的运行时配置。若实际是 `desktop`，desktop 路由的 `sameDir` 检查会失败并自动转手工命令。
   - `dsh-plugin-update` 是否已真正发布到 registry：README 说发布前要 `npm view` 查重名，
     我**没有联网核实**（包本身是本地已装形态，`npm install dsh-plugin-update` 能否成功未验证）。
   - wf 的 `scripts/derive-update-from-package.mjs` 未随包发布，其真实内容无法核对；
     只能确认派生结果被内联进了 `lib/client.js`。
