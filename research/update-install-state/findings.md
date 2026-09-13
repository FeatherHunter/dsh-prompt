# #55 真机 `installation-changed` / `canInstall:false` 的成因与处置

调研对象：`dsh-plugin-update@0.1.1`（真源码 = 本仓 `node_modules/dsh-plugin-update/dist/`）＋ 本机真产物
`dsh-prompt@0.1.7`（dev 检出 `D:\dsh-plugin\dsh-prompt`；真机部署副本
`C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-prompt`）。

**全程只读**：没有跑过任何会真装包的 `dsh plugin add`，没有改 profile 里的任何文件，没有写
`storages/dsh_prompt.json`，没有重启/杀掉真机宿主（`http://127.0.0.1:43120`）。
需要跑代码的地方，要么是**只读调用**（reader 的 `readEnv()` / `status()`），要么现场造在
**临时目录**（`%TEMP%\dsh-55-matrix\`）里改副本。探针脚本：

- `.tmp-verify/probe-55/live-read.mjs` —— 真包 + 真路径的只读实测（第 2 节）
- `.tmp-verify/probe-55/matrix.mjs` → `matrix-out.json` —— 受控实验矩阵（第 3 节）
- `.tmp-verify/probe-55/resolve-live.mjs` —— 真机 profile 的模块解析只读实验（第 4.2 节）
- 三者都在 `.gitignore` 的 `.tmp-*` 内，不入库

---

## 0. 三句话结论

1. **判据**：`installation-changed` 在 `dist/reader.js` 有**两条**分支 —— `:158`「本进程第一读，
   `loaded` 包 ≠ `installed` 包」和 `:157`「已绑定的 reader 第二次读时 identity 漂了」。本机命中的是
   `:158`：**正在跑的包是 dev 检出 `D:\dsh-plugin\dsh-prompt`，装的是 profile 副本
   `…\profiles\web\node_modules\dsh-prompt`；两者版本都是 0.1.7，差的是目录**。
2. **不是「装的版本与绑定信息不符」，也不是本机安装方式必然导致的正常状态**：磁盘上**没有任何绑定
   记录**（`boundIdentity` 是进程内 `let`），这个状态每次开进程按路径重算；它是这套更新的设计信号
   ——「跑的不是装的那份，装它没有意义」。它在本机出现，是因为 #39 那次实测是**用 dev 产物单独起
   node 进程**跑的，不是因为真机宿主处于坏状态。
3. **手工兜底命令在本机走不通这条路**：包给的命令（实测打印值）指向 `dsh-prompt@0.1.7` —— **就是
   profile 里已装的那个版本**；即便真跑，也改不了 `loaded` 侧，`installation-changed` 不会消失。
   更关键的是：真机宿主今天**根本没加载带更新能力的构建**（`update/status` 回 404），而按本机
   profile 的 `nodeLinker: hoisted` 布局，新构建部署进 profile 后宿主半会回 **`unknown-profile`**，
   不是 `installation-changed`（第 4、5 节）。**#43 的验收口径必须写「部署进 profile 副本 + 重启宿主
   + 用宿主自己的端点读 status」，不能接受「dev 产物跑出的 installation-changed」当作验收现场。**

---

## 1. 判据追源（上游真源码，逐行）

### 1.1 `identity` 的四个值怎么来的

```js
// dist/reader.js
117:    const profileName = options.profileName ?? basename(profileDirInput);
126:      homeDir = await realpath(options.homeDir ?? homeDirDefault);
127:      profileDir = await realpath(profileDirInput);
148:    const identity = `${homeDir}\0${profileDir}\0${profileName}\0${pluginId}`;
```

- `pluginId`：`:87` `assertPluginId(options.pluginId)`；本插件传 `'dsh-prompt'`（`src/update/host/index.ts:45`）。
- `homeDirDefault`：`:72-77`，取 `env.DSH_HOME`，没有才 `~/.dsh`。本机 `DSH_HOME=C:\Users\辰辰洋洋\.dsh`。
- `profileDirInput`（宿主半）：`host.js:86` `overrides.profileDir ?? await inferProfileDir(loaded, …)`；
  `inferProfileDir`（`host.js:61-77`）先从 `loaded.directory` 里切 `\node_modules\<targetPackageName>`
  前缀，切不出来就退回 `<home>/profiles/web`。
- **要点**：identity 里没有版本、没有文件内容，只有「家目录 + 使用范围目录 + 使用范围名 + 插件标识」。

### 1.2 `loaded` / `installed` 各是什么（这是本机命中的关键）

```js
// dist/reader.js —— loaded：正在跑的那份包
102:  const loadedPackage = containingPackage(fileURLToPath(import.meta.url), targetPackageName).catch(() => null);
//   containingPackage（:26-39）从 reader.js 自己的目录一路向上找 package.json，
//   第一个 name === targetPackageName 的就是 loaded；找不到返回 null。

// dist/reader.js —— installed：profile 里装着的那份
138:      installed = await packageAt(join(profileDir, "node_modules", targetPackageName));

// dist/host.js —— runningVersion 也从 loaded 来
83:  const loaded = await containingPackage(fileURLToPath(import.meta.url), targetPackageName).catch(() => null);
84:  const runningVersion = overrides.runningVersion ?? (loaded && validVersion(loaded.manifest.version) ? String(loaded.manifest.version) : null);
85:  if (!runningVersion) throw Object.assign(new Error("unknown-profile"), { code: "unknown-profile" });
```

### 1.3 绑定与比较

```js
149:    const sameLoadedPackage = loaded?.directory === installed.directory && loaded?.manifest.version === installed.manifest.version;
150:    if (boundIdentity === void 0 && sameLoadedPackage && result.packageValid) boundIdentity = identity;
...
157:    if (boundIdentity !== void 0 && boundIdentity !== identity) result.blockedReason = "installation-changed";
158:    else if (!sameLoadedPackage && boundIdentity === void 0) result.blockedReason = "installation-changed";
159:    else if (!result.packageValid) result.blockedReason = "invalid-installation";
160:    else if (result.sourceInstall) result.blockedReason = "source-install";
161:    else if (result.installedVersion !== runningVersion) result.blockedReason = "pending-restart";
162:    result.eligible = !result.blockedReason;
```

**两条分支的确切判据**（这是本票第 1 问要的答案）：

| 分支 | 条件（哪几个值不一致） | 什么场景 |
|---|---|---|
| `:157` | `boundIdentity` **已绑定**（同一条 reader 之前成功绑过），而这次算出的 `identity` 与绑定的**不相等** —— 即 `realpath(homeDir)` / `realpath(profileDir)` / `profileName` / `pluginId` 里有一个变了 | 同一进程活着的期间，`home` 或使用范围目录的 realpath 变了（junction/软链被改指、目录被搬） |
| `:158` | `boundIdentity` **从未绑定**（本进程第一读），且 `!sameLoadedPackage` —— 即 `loaded.directory !== installed.directory` **或** `loaded.manifest.version !== installed.manifest.version` | 正在跑的包不是 profile 里装的那份：dev 目录被加载（版本可同可不同）、构建产物被复制到别处跑 |

绑定本身就要求 `sameLoadedPackage && packageValid`（`:150`），所以「跑的就是装的那份」的进程第一次读是
`blockedReason: null`（第 3 节 R1 实测），之后装了新版才会走 `:161 pending-restart`（R2 实测）。

**优先级**（`else if` 链，先到先得）：`:157` → `:158` → `:159 invalid-installation` → `:160 source-install`
→ `:161 pending-restart`。所以 `installation-changed` 会**压过** `source-install` 与 `pending-restart`。

### 1.4 它怎么进快照、怎么让 `canInstall` 变 false

```js
// dist/service.js
208:  function buildSnapshot(env, job) {
209:    let blockedReason = env.blockedReason ?? checked?.blockedReason ?? null;
218:    const canInstall = Boolean(
219:      env.eligible && !blockedReason && !busy && fresh && checked?.installationKey === env.installationKey && validVersion(runningVersion) && checked?.release && compareVersions(checked.release.version, runningVersion) === 1
220:    );
```

`installation-changed` ⇒ `env.eligible === false` ⇒ `canInstall` 恒 false（**哪怕 check 到了更新的版本**，
R10 实测：`latestVersion:"0.1.8"`、`canInstall:false`、`receipt:null`）。

### 1.5 同一个字符串的**五个**出口（别把 `job.message` 当成 `blockedReason`）

| 出口 | file:line | 形态 |
|---|---|---|
| 读侧分支 A | `dist/reader.js:157` | `readEnv().blockedReason` |
| 读侧分支 B | `dist/reader.js:158` | `readEnv().blockedReason`（**本机命中的**） |
| 装的时候 installationKey 变了 | `dist/service.js:309` | 抛错码 `installation-changed`（回包 `{ok:false,error:"installation-changed"}`） |
| 取锁后复查又变了 | `dist/service.js:325` | 同上 |
| 上一份任务的 target 已经对不上装着的版本 | `dist/service.js:201` | `job.message = "installation-changed"`（快照的 `job.message` 位；随后 `:210-211` 还可能把 `blockedReason` 覆写成 `recovery-required`） |

### 1.6 它**不是**什么（本轮顺手坐实）

- **没有落盘的绑定记录**。`boundIdentity` 是 `reader.js:103` 的模块内 `let`，进程重启即清零；
  `store.js` 那个 `state.json`（`config.js:8-10`）是**安装任务**记录，与绑定无关。
  ⇒ 不存在「删掉某个 state 文件就能清掉」的修法；`<home>/updates/dsh-prompt/` 不存在（本机实测）与
  这个状态也**无关** —— #39 审查 B 把它当线索是误判，本轮排除了。
- `installationKey`（`:153` = sha256(identity + profile.package.json 内容 + installed 目录 + installed
  package.json 内容 + 三个 lock 文件)）不是「绑定信息」，它只在 check→install 之间做对账（`:309/:325`）。

---

## 2. 本机实测：判据要求的值 vs 本机实际值

命令（只读，真包、真路径）：

```powershell
cd D:\dsh-plugin\dsh-prompt
node .tmp-verify\probe-55\live-read.mjs
```

原始输出（未删改）：

```json
{
  "identity 组件": {
    "homeDir_realpath": "C:\\Users\\辰辰洋洋\\.dsh",
    "profileDir_realpath": "C:\\Users\\辰辰洋洋\\.dsh\\profiles\\web",
    "profileName": "web (=basename(profileDir))",
    "pluginId": "dsh-prompt",
    "targetPackageName": "dsh-prompt"
  },
  "loaded（正在跑的包，来自 dev 检出）": {
    "directory": "D:\\dsh-plugin\\dsh-prompt",
    "name": "dsh-prompt",
    "version": "0.1.7"
  },
  "readEnv() 原始回值": {
    "profileName": "web",
    "environmentKind": "cli",
    "homeDir": "C:\\Users\\辰辰洋洋\\.dsh",
    "profileDir": "C:\\Users\\辰辰洋洋\\.dsh\\profiles\\web",
    "installedVersion": "0.1.7",
    "packageValid": true,
    "sourceInstall": false,
    "blockedReason": "installation-changed",
    "installationKey": "b85a3ce221e939679a2b08bdbf916d80035278cbfa6e78924f93907de0cf3033",
    "eligible": false
  },
  "status() 六字段快照": {
    "runningVersion": "0.1.7",
    "installedVersion": "0.1.7",
    "latestVersion": null,
    "canInstall": false,
    "blockedReason": "installation-changed",
    "job": null
  },
  "manual（manualCommand 真函数算出来的那条命令）": "dsh plugin --profile web add --save-exact dsh-prompt@0.1.7 --registry=https://registry.npmjs.org/"
}
```

与 #39 审查记录逐字对得上（`.wayfinder/update/39-verify-A.md:82` 的六字段与 manual 命令）。

**对账表**：

| 判据里的值 | 本机实测 | 一致？ |
|---|---|---|
| `loaded.directory`（`reader.js:102`/`host.js:83`） | `D:\dsh-plugin\dsh-prompt` | — |
| `loaded.manifest.version` | `0.1.7`（`package.json:3`） | — |
| `installed.directory`（`reader.js:138`） | `C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-prompt` | — |
| `installed.manifest.version` | `0.1.7`（部署副本的 package.json） | — |
| `sameLoadedPackage`（`:149`） | **false**（目录不同、版本相同） | ✗ ← 就是这里 |
| `boundIdentity`（`:150`） | **undefined**（新进程第一读，从未绑定） | — |
| ⇒ 命中分支 | `reader.js:158` | ✔ |
| `packageValid`（`:146`） | true（main / exports["./client"] / dsh.bundle.patch 三个入口都在包里） | — |
| `sourceInstall`（`:144`） | false（`dependencies["dsh-prompt"] = "^0.1.7"` 过 `registrySpec`，且 installed 在 `<profileDir>/node_modules` 内） | — |
| `eligible` | false ⇒ `canInstall` false（`service.js:219`） | ✔ |

本机另外两个实测点（只读命令 + 原始输出）：

```powershell
# 真机宿主（未重启、未改状态，只 POST status 这一个只读端点）
> Invoke-WebRequest -Uri "http://127.0.0.1:43120/_dsh/dsh-prompt/update/status" -Method POST -ContentType "application/json" -Body '{}'
HTTP 404
{"ok":false,"error":{"code":"not_found","message":"unknown endpoint /_dsh/dsh-prompt/update/status"}}

# 部署副本里有没有更新路由
> (Select-String -Path "C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-prompt\lib\index.js" -Pattern "update/status" -SimpleMatch | Measure-Object).Count
0
> Test-Path "C:\Users\辰辰洋洋\.dsh\updates\dsh-prompt"
False
```

⇒ **真机宿主今天加载的是 profile 副本（旧构建，还没有 #39 的更新能力）**；这个 404 的措辞
（`unknown endpoint <path>`）正是插件自己路由表兜底的响应（本仓 `lib/index.js:592`），不是 DSH 核心的
404。Desktop 应用本体里也没有第二份 dsh-prompt（在 `resources\app.asar` 里搜
`update-capability-unavailable` / `host.bridge.reject` / `dsh-prompt: routes` 全是 **0 处**）。

---

## 3. 受控实验矩阵（真包，现场造在 `%TEMP%\dsh-55-matrix\`）

脚本：`.tmp-verify/probe-55/matrix.mjs`。每个用例都复制真包到不同位置，只改**副本**；
真 profile 一个字节都没动。完整输出见 `matrix-out.json`，下面贴关键行。

| 用例 | 现场 | 实测结果 | 坐实了什么 |
|---|---|---|---|
| R1 | 更新包放在**插件包内**（`dsh-prompt/node_modules/dsh-plugin-update`） | `blockedReason:null`、`eligible:true`、六字段 `0.1.7/0.1.7/null/false/null/null` | 「跑的就是装的那份」⇒ 读侧不拦（`:150` 绑定成立） |
| R2 | 同一条 reader：先读（绑定），再把装了的那份版本提到 0.1.8，再读 | 第 1 次 `null` / 第 2 次 **`pending-restart`** | 「装完待重启」的正路：绑定后**认版本差**（`:161`），不认成 `installation-changed` |
| R3 | 更新包放在 dev 目录（`<T>/dev/node_modules/dsh-plugin-update`，dev 根 package.json 名字 = dsh-prompt，版本与装着的一样） | `blockedReason:"installation-changed"`、`packageValid:true`、`sourceInstall:false` | **本机真机形态**在受控环境里复现：目录不同、版本相同就命中 `:158` |
| R4 | 同上但 dev 版本 0.1.8 | 也是 `installation-changed` | `:158` 的另一半（版本不同）走同一条 |
| R5 | hoisted 布局（更新包在 profile 根 `<T>/profiles/web/node_modules/dsh-plugin-update`） | `containingPackage(hoisted reader.js,'dsh-prompt') = null`；对照 `containingPackage(嵌套 reader.js) = …\node_modules\dsh-prompt` | hoisted 布局下 `loaded` 解析成 **null**（因为上溯没有任何叫 dsh-prompt 的 package.json）；reader 层仍显式给了版本，所以状态是 `installation-changed` |
| R6 | 同上，但走**宿主半真实入口** `createHostUpdate().handlers['prompt.updateStatus']/['prompt.updateCheck']`（不给 `runningVersion`） | `{"ok":false,"error":"unknown-profile","errorKind":"unknown-profile"}`（status / check 都是） | **真机宿主将来会回什么**：`host.js:84-85` 因为 `loaded=null` 直接抛 `unknown-profile`，三条电话都不是 `blockedReason` 形态 |
| R7 | 嵌套布局 + 宿主半入口，check 到一个假源上的 0.1.8 | status：`ok:true`、`blockedReason:null`；check：`canInstall:true`、`receipt:{checkId,checkedAt,expiresAt}`、manual 里是 `@0.1.8` | 健康路径长什么样（#43 通过时的形状） |
| R8 | profile 依赖写成 `"dsh-prompt": "link:D:/dsh-plugin/dsh-prompt"`（本机 `dsh-bill-ilife` 等就是这种） | `blockedReason:"source-install"`、`manual:null` | link/源码安装走的是另一条状态，而且包**故意不给**手工命令（`commands.js:57`） |
| R9 | profileDir 是 junction：绑定（第 1 次读 `null`）→ 把 junction 改指到另一份 → 同一条 reader 再读 | 第 2 次 `installation-changed`；两次里只有 identity 侧的值变了（`profileDir` A→B、`installationKey` 变了），`installedVersion`/`packageValid`/`sourceInstall` 都没变 | **`:157` 分支也实测触发过**（`:158` 在这次读里不可能成立：`boundIdentity` 已定义） |
| R10 | dev 形态 + check 到 0.1.8 | `latestVersion:"0.1.8"`、`canInstall:false`、`receipt:null`、`blockedReason` 仍 `installation-changed` | 这个状态下**查新版也没用**：面板会看到「有新版但装不了」 |
| R10b | 上面那条 check 之后立刻 `install`（假 checkId） | 抛 `check-expired` | 装入口的守卫（`service.js:299/306`） |

R6 原始输出（将来真机最可能的那个形状）：

```json
"R6 hoisted + 宿主半电话（不给 runningVersion）": {
  "status": { "ok": false, "error": "unknown-profile", "errorKind": "unknown-profile" },
  "check":  { "ok": false, "error": "unknown-profile", "errorKind": "unknown-profile" }
}
```

R7 原始输出（健康路径 / #43 应该追求的形状）：

```json
"status": { "ok": true, "snapshot": { "runningVersion":"0.1.7","installedVersion":"0.1.7","latestVersion":null,"canInstall":false,"blockedReason":null,"job":null },
            "manual": "dsh plugin --profile web add --save-exact dsh-prompt@0.1.7 --registry=https://registry.npmjs.org/", "receipt": null },
"check":  { "ok": true, "snapshot": { "runningVersion":"0.1.7","installedVersion":"0.1.7","latestVersion":"0.1.8","canInstall":true,"blockedReason":null,"job":null },
            "manual": "dsh plugin --profile web add --save-exact dsh-prompt@0.1.8 --registry=https://registry.npmjs.org/",
            "receipt": { "checkId":"348e530d-…","checkedAt":1789270323929,"expiresAt":1789270923929 } }
```

---

## 4. 真机 profile 的布局：为什么「部署进 profile」是必须的前置，而且有个坑

### 4.1 本机 profile 强制 hoisted（不是我能选的）

`C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\.modules.yaml` 原始片段：

```json
{ "hoistPattern": ["*"], "nodeLinker": "hoisted", "packageManager": "pnpm@11.8.0",
  "virtualStoreDir": "C:\\Users\\辰辰洋洋\\.dsh\\profiles\\web\\node_modules\\.pnpm",
  "registries": { "default": "https://registry.npmjs.org/", "@jsr": "https://npm.jsr.io/" } }
```

同一目录下**没有任何**插件带嵌套的 `node_modules/dsh-plugin-update`（逐个查过 dsh-prompt /
dsh-mattpocock-skills-deck / dsh-vision-router / dshmarket / dsh-life-pack / dsh-im-companion，
另加一次深度 ≤4 的全扫：**无**）。

这不是偶然：DSH 自己把 hoisted 写死并会「修回来」（`resources\app.asar` 内，原始行）：

```js
// app.asar（DSH Desktop 打包产物，同一段出现两份）
writeFileSync(path, `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n`);
...
if (document.get("nodeLinker") !== "hoisted") { document.set("nodeLinker", "hoisted")
```

### 4.2 于是「裸 import 更新包」这套接法在真机 profile 上必然降级

本仓现在是运行时裸 import：

```js
// lib/update.js:248（src/update/host/index.ts:111 的产物）
let mod = options.hostUpdate ?? await import("dsh-plugin-update").catch((e) => e);
```

真机只读解析实测（`.tmp-verify/probe-55/resolve-live.mjs`，只 `require.resolve` + 目录上溯，不 import 执行、不写盘）：

```json
{
  "resolve from 部署副本 lib/": "C:\\Users\\辰辰洋洋\\.dsh\\profiles\\web\\node_modules\\dsh-plugin-update\\dist\\host.js",
  "containingPackage 上溯链（找 name === \"dsh-prompt\"）": [
    { "dir": "…\\node_modules\\dsh-plugin-update\\dist", "packageJsonName": null },
    { "dir": "…\\node_modules\\dsh-plugin-update", "packageJsonName": "dsh-plugin-update" },
    { "dir": "…\\profiles\\web\\node_modules", "packageJsonName": null },
    { "dir": "…\\profiles\\web", "packageJsonName": "dsh-profile-web" },
    { "dir": "…\\.dsh", "packageJsonName": null },
    { "dir": "C:\\", "packageJsonName": null }
  ],
  "上溯结论 loaded": null,
  "插件包内是否有自己的更新包": false
}
```

⇒ 从部署副本 `lib/` 解析出去的是 **profile 根的 hoisted 副本**，而 `containingPackage` 从那里上溯到盘根
都没有一个叫 `dsh-prompt` 的 package.json ⇒ `loaded = null` ⇒ `runningVersion = null` ⇒
`host.js:85` 抛 `unknown-profile`。R6 就是这个布局的行为复现。

### 4.3 上游作者自己的消费方（deck）是怎么绕开的

`C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-mattpocock-skills-deck`：

- `lib/updatePkg/{config,gate,host,ports,reader,service,store,commands}.js` —— 更新包的**派生副本**
  住进它自己的包里（`lib/updateFromPackage.js` 首行注释：「更新包派生副本在 ./updatePkg/（由 node
  scripts/derive-update-from-package.mjs 生成，人手不改）」）；
- 它 import 的是**相对路径**：`import { createHostUpdate } from './updatePkg/host.js'` ⇒
  `import.meta.url` 落在 deck 包内 ⇒ `containingPackage` 找到 deck 自己 ⇒ `loaded == installed`。

旁证（只读计算）：`<home>\updates\dsh-mattpocock-skills-deck\673e0ed90d45ec65705231c3\state.json` 里
`"state":"restart-required","targetVersion":"1.7.18"`，而 `673e0ed90d45ec65705231c3` 经 node 计算
等于 `sha256(realpath(<home>\profiles\web)).slice(0,24)`（`store.js:24` 的 `pathsForUpdate` 就是这么拼的）
⇒ deck 确实在**这台机器的这个 web profile 上真装成功过**（`installedVersion` 现在是 1.7.21）。它能在
hoisted 布局下成功，靠的就是「包在自己包里」这一点。

---

## 5. 三问逐条回答

### 问 1：`installation-changed` 的确切判据？
见第 1 节表：两条分支 `reader.js:157` / `reader.js:158`，值分别是
`boundIdentity`（进程内绑定）与 `identity`（realpath 家目录 + realpath 使用范围目录 + 使用范围名 +
插件标识）、以及 `loaded.directory/version` 与 `installed.directory/version`（`reader.js:149`）。
本机命中 `:158`（第 2 节对账表）。**结论不是从 README 推的**：以上每一句都能指到
`node_modules/dsh-plugin-update/dist/` 的行号，并且第 3 节的矩阵把每条分支都用真包跑了出来。

### 问 2：本机为什么命中？正常状态还是可修问题？
- **本机命中原因（实测坐实）**：跑 `update/status` 的那次，进程里加载的是 **dev 检出**
  `D:\dsh-plugin\dsh-prompt`（`loaded`），而 profile 里装的是另一份 0.1.7（`installed`）。目录不同
  ⇒ `sameLoadedPackage=false` ⇒ 新进程第一读 ⇒ `:158`。**不是**「装的版本与绑定信息不符」：
  版本相同、`packageValid:true`，而且磁盘上不存在绑定记录（1.6 节）。
- **它跟本机安装方式的关系**：本机 web profile 里 `dsh-prompt` 是 registry 依赖
  （`"dsh-prompt": "^0.1.7"`，`dsh.profile.bundles` 里也有），不是 `link:`；所以它**不是** link/源码安装
  该有的 `source-install`（R8 实测那是另一条状态）。这个 `installation-changed` 纯粹来自「**跑的不是装的
  那份**」——**只由「用 dev 产物单独起进程」造成**，不是宿主当下的坏状态。
- **能不能修**：不需要「修」，需要**对齐**：让宿主加载的就是 profile 副本（部署 + 重启），此时
  `:158` 不可能成立（R1 实测 `blockedReason:null`）。反过来，在 dev 形态下无论怎么装都修不掉它
  （R3/R10 实测），因为它不是磁盘上的坏数据，而是**每次进程内重算**的判定。
  本机真机宿主今天连更新能力都还没加载（404 实测），所以「真机处于 installation-changed 坏状态」
  这个说法本身不成立。

### 问 3：手工兜底命令在本机能否走通？走通后变成什么？够不够支撑 #43 验收？
- **命令字面值（真函数实测）**：`dsh plugin --profile web add --save-exact dsh-prompt@0.1.7 --registry=https://registry.npmjs.org/`
  （`commands.js:74` 拼出来的；版本取 `picks = [latestVersion, jobTargetVersion, installedVersion]`
  里第一个合法版本，`commands.js:64-65` —— 没先 check 过时 `latestVersion=null`，于是**退化成已装版本 0.1.7**）。
- **没执行**（红线：不许真装包；`dsh` 一旦启动还可能触发 profile 自修）。能给的坐实结论：
  1. 这条命令的**目标版本就是已装版本**（profile 副本 0.1.7，实测；npm 上 `dsh-prompt` 最新也是
     0.1.7，`npm view dsh-prompt versions` 实测），跑它最乐观也只是原地重装同一份代码；
  2. 它改的是 **profile 侧**（`installed`），而 `installation-changed`（`:158`）看的是 **`loaded` 侧**，
     所以**它清不掉这个状态**；
  3. 它也不会把新构建带进 profile：本轮要验的新构建（#39 的更新能力）**还没发布**（最新 0.1.7）。
- **「走通后」会变成什么**（R2/R7 实测形状）：
  - 装在宿主**跑的就是 profile 副本**的前提下：装完 → `installedVersion` 变新、`runningVersion` 还是旧的
    → `pending-restart`（R2）；重启宿主后 `loaded == installed` → `blockedReason:null`，再 check 到更新
    版本才会 `canInstall:true`（R7）。
  - 在**dev 形态**（#39 那次实测的形态）下：装完仍然是 `installation-changed`（R3/R10），`canInstall`
    永远 false。
- **够不够支撑 #43 验收**：**不够，且口径要改**。理由：(a) 手工命令在本机是空转（目标版本 = 已装版本）；
  (b) 更硬的阻塞是第 4 节 —— 真机宿主加载的是 profile 副本，而 profile 的 hoisted 布局会让宿主半回
  `unknown-profile`（R6 实测）。所以「自动安装不可用、手工命令可用」这个结论**在本机不成立**；
  应该按「**必须先让更新包住进插件包内**（或改成宿主可注入 runningVersion/readInstalled），再把新构建
  部署进 profile 副本、重启宿主，然后用宿主端点读到 `blockedReason:null`」来写验收。

---

## 6. 处置建议（两句话给结论）

**① #40 的弹窗要不要为这个状态做专门文案与交互？——要，但文案要按「三种形态」写，不能只写 `blockedReason`：**
(a) `blockedReason:"installation-changed"`（dev 形态跑出来的那种）要写「**当前运行的不是已安装的那份代码，
装更新不会生效；请用已安装的那份跑宿主**」，并**不要**同时把那条 `manual` 命令当救命稻草展示
（它会指向已装版本、看着像能修、实际空转）；
(b) 更该准备的是**电话级失败**形态 `{ok:false, error:"unknown-profile"}` —— 真机部署后最可能先撞上
这一个（R6），此时 `snapshot` 是 `null`，面板必须走「能力/环境认不出」分支（现成的
`update-capability-unavailable` 文案位可复用），而不是去读 `blockedReason`；
(c) `blockedReason` 的八条中文映射照旧做（`src/update/host/safe-values.ts:55` 的白名单就是那八条）。

**② #43 的验收口径怎么写？——写「宿主自证」三条硬口径 + 一条前置：**
前置：把更新包**搬进插件包内**（照 deck 的 `lib/updatePkg/` 派生副本模式，或把包 esbuild 进
`lib/update.js`），否则验收第一步就会卡在 `unknown-profile`。
三条硬口径（都在**真机宿主自己**的端点上读，不用 dev 产物、不用脚本自造进程）：
(1) 新构建部署进 `<home>\profiles\web\node_modules\dsh-prompt` 且 `dsh-plugin-update` 在**该包内**可解析；
(2) 重启宿主后 POST `/_dsh/dsh-prompt/update/status` 回 `ok:true`，且 `snapshot.blockedReason === null`、
`installedVersion === runningVersion`；
(3) 再 POST `check` 到一个确实更高的版本 → `canInstall:true` + `receipt` 非空；
「自动安装不打真包」的验收可以在 `install` 一步止步（或只验 `check-expired`/`update-busy` 这类守卫），
**不许**把手工兜底命令当作通过条件。

---

## 7. 明确区分：实测坐实 vs 推断未坐实

**实测坐实（可复现，命令都在本文件里）**

1. `installation-changed` 的两条分支与优先级 —— 上游源码直读（第 1 节表）+ R3/R4（`:158`）、R9（`:157`）实测。
2. 本机 `readEnv()`/`status()` 的完整原始值（第 2 节），与 #39 记录逐字一致 ⇒ **本机命中的是 `:158`**。
3. 真机宿主今天**没有**更新能力：`POST /_dsh/dsh-prompt/update/status` → 404
   `{"code":"not_found","message":"unknown endpoint /_dsh/dsh-prompt/update/status"}`；部署副本
   `lib/index.js` 无 `update/status`；`<home>/updates/dsh-prompt` 不存在。
4. 本机 profile 是 `nodeLinker: hoisted`（`.modules.yaml` 原始值），且 DSH 自己写死/修回该设置
   （app.asar 原始行）；抽查 + 深度 ≤4 全扫：没有任何插件带嵌套的 `dsh-plugin-update`。
5. **真机解析实测**：从部署副本 `lib/` 解析 `dsh-plugin-update` → profile 根那份，且
   `containingPackage` 上溯到盘根 `loaded = null`（第 4.2 节原始输出）；
   行为复现：hoisted 布局 + 宿主半入口 ⇒ `unknown-profile`（R6）；嵌套布局 + 宿主半入口 ⇒
   `blockedReason:null`，check 后 `canInstall:true`（R7）。
6. 手工命令的字面值与其版本挑选逻辑（`commands.js:64-74` 直读 + 真函数实测打印）。
7. 上游作者自己的 deck 用**包内派生副本 + 相对路径 import**（文件与注释实测），且它在
   `<home>\profiles\web` 上真装成功过（`state.json` + hash 与 `realpath(profileDir)` 一致，node 计算）。
8. npm 上 `dsh-prompt` 最新版本 = 0.1.7（`npm view`）。

**推断未坐实（写着但没验，别当结论用）**

1. **真机部署新构建 + 重启宿主后的实际回包**：只有受控复现（R6/R7），没有真部署 —— 红线禁止改 profile。
   所以「会回 `unknown-profile`」是「按今天这套布局 + 上游源码」的**强推断**，未在真机观测。
2. **`dsh plugin --profile web add …` 在本机能否真的跑通**：**没执行**（红线）。只坐实了命令字面值与
   目标版本；CLI 侧 `--registry=` / `--save-exact` 的定义没在 app.asar 里定位到（只找到 DSH Market
   自己打印的同形命令 `dsh plugin add --save-exact <pkg>@<ver>`，见 app.asar 内 1155205 / 1158431 /
   1165115 行，以及它自己用 `--registry=<官方源>` 调 pnpm 的 `installOptions`）。
3. **部署副本 0.1.7 的确切来历**：它的 `dependencies` 与 npm 上 0.1.7 一致（无 `dsh-plugin-update`），
   但其 `node_modules` 里装着 devDeps、`lib/` 里有多份 `*.bak-*`、`event-list.dsh-prompt.json` 不在
   `files` 白名单却存在 ⇒ **有手工改动痕迹**，但没有证据链能断定「npm 装 + 手工覆盖」还是「整目录复制」。
   不影响本票结论（两种来历都会得到同一个 `:158`）。
4. **Desktop 宿主实际从哪里加载 dsh-prompt**：由「404 + 副本内容」反推，未直接观测加载路径
   （`host-commands\…\bin\dsh.cmd` 里能看到 `DSH_DESKTOP_DEFAULT_PROFILE=web`，说明默认使用范围是 web）。
5. R9 的对照组不纯（`loaded` 由 import 的副本固定在 A 侧），`:157` 的归属靠「`:158` 在该次读不可能成立 +
   `:159-:161` 在该次读不可能产生非空原因」的排除法坐实。

---

## 8. 新暴露、值得单开票的问题

1. **【会挡 #43】hoisted profile 下「裸 import 更新包」的接法必然降级成 `unknown-profile`。**
   本仓 `lib/update.js:248` 是运行时裸 `import("dsh-plugin-update")`；DSH 强制 profile
   `nodeLinker: hoisted`（app.asar 写死），于是 `containingPackage` 拿不到 `loaded`，
   宿主半连 `runningVersion` 都没有（`host.js:84-85`）。上游作者自己的 deck 是靠
   **包内派生副本 + 相对 import** 绕开的（`lib/updatePkg/`）。建议：给本仓做同样的
   vendoring（或把包 esbuild 进 `lib/update.js`），并加一条回归：**从「插件包外的 node_modules」
   解析时也要能用**。这条不修，真机上三条更新路由只会回 `unknown-profile`。
2. **【#40 用得上】电话级失败形态要进面板状态机**：`{ok:false,error:"unknown-profile"}` 经本仓桥
   （`lib/index.js:482/508`）会变成信封 `{ok:false,value:{…},error:{code:"unknown-profile"}}`，
   `snapshot` 为 `null`；面板若只按 `snapshot.blockedReason` 渲染，会把「环境认不出」显示成空白。
3. **【体验/文案】手工兜底命令在「没先 check」时会把**已装版本**当目标版本**（`commands.js:64-65`）：
   本机实测打印出 `… dsh-prompt@0.1.7 …`（= 已装版本）⇒ 用户照抄等于原地重装。建议 #40 在展示
   这条命令前先要求/触发一次 `check`（这样 `latestVersion` 有值），或在文案里显式标注「这条命令装的是
   已装版本」。
4. **【判定优先级，写 map 时别写漏】`installation-changed` 压过 `source-install`/`pending-restart`**：
   若将来把 dev 目录 `link:` 进 profile（本机有多个插件是 `link:`），`source-install` 是它自己那条
   （R8），但一旦「跑的不是装的那份」同时成立，先出的会是 `installation-changed`。上游六种状态的
   优先级表（`reader.js:157-161`）值得写进 map，供 #40 文案与 #43 验收共用。

---

## 9. 复现方式

```powershell
cd D:\dsh-plugin\dsh-prompt

# 1) 真机只读实测（真包 + 真路径；只读，不落盘、不联网）
node .tmp-verify\probe-55\live-read.mjs

# 2) 受控实验矩阵（现场造在 %TEMP%\dsh-55-matrix，动的是副本）
node .tmp-verify\probe-55\matrix.mjs

# 2b) 真机 profile 的模块解析只读实验（只 require.resolve + 目录上溯）
node .tmp-verify\probe-55\resolve-live.mjs

# 3) 只看真机宿主有没有更新能力（只读 POST，不改宿主状态）
#    HTTP 404 {"ok":false,"error":{"code":"not_found","message":"unknown endpoint /_dsh/dsh-prompt/update/status"}}
Invoke-WebRequest -Uri "http://127.0.0.1:43120/_dsh/dsh-prompt/update/status" -Method POST `
  -ContentType "application/json" -Body '{"profileDir":"C:\\Users\\辰辰洋洋\\.dsh\\profiles\\web"}'
```

两个脚本都在 `.gitignore` 的 `.tmp-*` 里，不入库（本文件是唯一入库产物）。
