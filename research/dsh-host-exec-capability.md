# host 半自实现“整机横竖真切”可行性盘点（不依赖官方新增 API）

- 日期：2026-09-29
- 仓库根：`D:\dsh-plugin\dsh-prompt`
- 用户禁令：**禁止依赖官方**（不等 DSH 官方新增 API，只动本仓）。
- **结论先行（一句话）：可行。host 半可用本插件自己的 Node 代码 `spawn powershell.exe` 调 Win32 `ChangeDisplaySettingsEx` 改主屏方向，经既有 `/_dsh/dsh-prompt/*` 前缀桥暴露新端点；最小改动面 = 只动本仓 `lib/index.js`（新增 `system/orientation` 路由 + spawn 封装）+ client 薄 wrapper（`src/client/` 新增 `systemOrientation.ts` 或扩展 `remote.ts`），不动官方代码、不改 `package.json` 权限/engines、不动 issue。**
- 方法：全第一手（本仓源码行号 + `D:\tmp-plugcheck\b1` 解包复验 + `lib/update.js` 内本仓已用 spawn 抽象）。不改源码、不动 issue，本文件为 research 记录。

---

## 0. 读了什么（锚点）

| 文件 | 读到的 host 半事实 |
|---|---|
| `lib/index.js` 全文（757 行） | `inject = ["storageDomain","webServer"]`（L35）；`{ kind:"prefix", path:"/_dsh/dsh-prompt" }`（L708）；`ctx.webServer.register(route)`（L751-754）；`setRemote/store` 经 `PromptStore.enqueue` 串行（L269-276）；`snapshot()` 为 GET 唯一装配点（L153-180） |
| `package.json` | `type:module, main:lib/index.js`（L19-20）；`dsh.client.platform:web, inject:[runtime,slots]`（L77-83）；`dsh.engines.dsh:>=0.1.5-rc.1`（L85-87）；**无 `permissions`/提权声明字段**（全文无 `permissions` 命中） |
| `scripts/test-issue-82-host.cjs` | host 远程契约回归：`dsh_prompt v0 + remoteEnabled/Font/Control/Orientation + normalizeRemotePrefs + setRemote + /remote/set + /store`（L13-22），version 保持 0（L24-26），`snapshot → {customs,usage,pinned,lastUsed,remote}`（L52-55） |
| `src/client/remote.ts` | `STORE_URL='/_dsh/dsh-prompt/store'`（L101），`SET_URL='/_dsh/dsh-prompt/remote/set'`（L102）；形状即 `/_dsh/dsh-prompt/*` 同源 fetch（L137-146, L194-232）；方向偏好 `auto|landscape|portrait`（L23, L43-45），去宿主化后为插件内闭环（L17-22, L74-88） |

姊妹篇对照：`research/host-vs-plugin-h1-orientation.md` 结论“插件层（浏览器文档侧）做不到整机真切”（§1 表 + §4 拓扑双错位）。本篇不推翻它——本篇说的是**另一侧**：跑在 Node 的 host 半（与 client 不同进程、不同权力边界）可以自己 spawn 子进程改 OS，不需要等官方 H1。

---

## 1. 本插件 host 半今天的 inject 与桥形态（只认行号）

### 1.1 inject 只有 storageDomain + webServer

`lib/index.js:34-35`：

```js
/** Host 装配依赖：存储域（持久化）+ webServer（HTTP 桥）。 */
export const inject = ["storageDomain", "webServer"];
```

- 头注释 L7-8 自述同样口径：`HTTP 桥 ctx.webServer.register({ kind: 'prefix', path: '/_dsh/dsh-prompt' })`。
- 全文件 `inject` 仅此一处（`grep inject lib/` 命中 L35 声明 + L1206 `lib/update.js` 内 `ctx?.inject` 消费另一服务的 `desktopPnpm`，与本插件装配无关）。
- 含义：host 半今天**没有**声明任何系统/显示能力，但**也不需要新声明**——`webServer` 前缀路由 + Node 内建 `node:child_process` 即够（§2 证明 Node 可用）。

### 1.2 webServer.register 的 kind prefix 形态（拷贝注册代码段）

路由对象构造 `lib/index.js:708`：

```js
return { kind: "prefix", path: "/_dsh/dsh-prompt", handler };
```

装配 `lib/index.js:751-754`：

```js
ctx.effect(() => {
  const route = buildPromptRoute(ctx, store, logReady, updateReady);
  return ctx.webServer.register(route);
}, "dsh-prompt: routes");
```

handler 分发形态 `lib/index.js:635-709`（节选骨架，判据为 `method + path` 精确比对）：

```js
const handler = async (req, res) => {
  const logCap = await logReady;
  if (!isAllowed(req)) { /* 403 + host.bridge.reject */ return; }
  const path = (req.url ?? "").split(/[?#]/, 1)[0];
  const method = req.method ?? "GET";
  try {
    const routed = await updateRoutes(req, res, path, method, logCap, updateReady);
    if (routed !== undefined) return;
    await store.ready;
    if (method === "GET" && path === "/_dsh/dsh-prompt/store") { /* snapshot */ return; }
    if (method === "POST" && path === "/_dsh/dsh-prompt/remote/set") { /* setRemote */ return; }
    // … customs/put|delete, usage/bump, pinned/set, log, update/* …
    writeJson(res, { ok:false, error:{ code:"not_found", message:`unknown endpoint ${path}` } }, 404);
  } catch (err) { writeRouteError(res, err, logCap, { route: path, method }); }
};
```

- 同源围栏 `isAllowed`（L617-633）：Host 必须 loopback 字面量（127/8、`::1`、`localhost`，含 `::ffff:127.x`），`sec-fetch-site:cross-site` 拒，Origin 存在时须与 Host 同值。新端点**自动继承**该围栏，无需另写。
- 回包信封 `writeJson`（L314-318）：`{ ok, value, error }` + `no-store`；错误经 `writeRouteError`（L320-339）统一记 `host.route.fail`（只记机器码 + 8 位散列）。
- 已知路由表 `KNOWN_ROUTES`（L379-385）即路由自述，新端点落地时需同步追加两条（POST + GET 同路径），否则 `host.route.fail` 的 route 位会被指纹化（K2 语义，见 L373-386 注释）——这是清单式改动，不是机制改动。
- `package.json:85-87` engines 仅版本下限，不带来能力；无权限字段可改——新端点不需申请新权限（§4.1）。

### 1.3 setRemote / store 写法（新端点要复用的形态）

- `setRemote(patch)`（L237-267）：`enqueue` 包裹；空 patch/非法 `enabled/font/control/orientation` 各 400（`empty remote patch / invalid remote.*`）；读 `domain.global` → `normalizeRemotePrefs` → `global.set({remoteEnabled,remoteFont,remoteControl,remoteOrientation})` → 返回归一化 `next`。
- `snapshot()`（L153-180）：`return { customs, usage, pinned, lastUsed, remote }`（L179），`remote` 经 `normalizeRemotePrefs`（L173-178，定义 L67-77）。
- `enqueue(op)`（L269-276）：`writeChain.then(op)` 串行链，读写有序、失败不堵链（`then(()=>undefined,()=>undefined)`）。新端点的 OS 调用串行/防并发**直接复用此形态**（§3.3 伪代码），另起一条 `orientChain` 或复用同一 `writeChain` 皆可（推荐另起一条，避免 OS 超时堵住 store 写）。

---

## 2. DSH host 插件能做 OS 级事的先例 → host Node 能 spawn powershell.exe

### 2.1 主证据：dsh-better-sidebar@0.24.1（`D:\tmp-plugcheck\b1` 可复验）

包：`dsh-better-sidebar@0.24.1`，解包于 `D:\tmp-plugcheck\b1\package\`。以下行号均为 `b1/package/lib/index.js` 第一手：

| 行号 | 内容 | 证明什么 |
|---|---|---|
| L10 | `import { spawn } from "node:child_process";` | host 半直接 import Node 内建子进程模块，无需宿主授权、无需新 inject |
| L3683-3688 | `const inject = ["webServer","sessions","webRuntime","tools"];` | 有 OS 接触的插件，其 inject 也无系统/显示能力——能力来自 Node 本身，不是宿主发的 |
| L1055-1070 `revealCommand` | `win32 → { command:"explorer.exe", args:["/select,"+path] }`；`darwin → open -R`；`default → xdg-open [parent]` | 按平台构造“打开 OS 文件管理器”命令，argv 数组、无 shell 插值（L1049 注释） |
| L1072-1087 `urlCommand` | `win32 → rundll32.exe ["url.dll,FileProtocolHandler", url]`；`darwin → open [url]`；`default → xdg-open [url]` | 自定义 scheme 交 OS 协议处理器，同样 argv 形态 |
| L1107-1117 `launchExternal` | `const child = spawn(spec.command, spec.args, { detached:true, stdio:"ignore" }); child.on("error",()=>{}); child.unref();` | 真 spawn 落点：detached + ignore + unref，路由立即返回 |
| L1683-1728 `runGit` | `spawn("git", full, { stdio:["ignore","pipe","pipe"], windowsHide:true, env:{...process.env, GIT_OPTIONAL_LOCKS:"0"} })` + stdout/stderr 累积 + `setTimeout → child.kill("SIGKILL")` 超时 + `close code===0 resolve` | 带输出、带超时、带 `windowsHide` 的全形态 spawn；超时/错误映射为 `GitCommandError`（L1606-1610）——新端点超时/错误映射抄此结构即可 |

复验命令（Windows pwsh）：

```powershell
Select-String -Path D:\tmp-plugcheck\b1\package\lib\index.js -Pattern 'from "node:child_process"|explorer\.exe|xdg-open|spawn\(' | Select-Object LineNumber,Line
```

预期命中即上表行号。结论：**host 半 Node 能 spawn 任意用户态可执行文件**（`explorer.exe / rundll32.exe / xdg-open / git` 已证），`powershell.exe` 与它们在 spawn 机制上无区别（同为 `CreateProcess` 级 argv spawn）。

### 2.2 旁证：本仓自己已在用 spawn 抽象（`lib/update.js:809-816`）

```js
const subprocess = part(parts.subprocess);
if (!subprocess || typeof subprocess.spawn !== "function") throw fail("install-failed");
const handle = subprocess.spawn({ argv, cwd: ..., stdio: INSTALL_STDIO, graceMs: TERMINATION_GRACE_MS });
```

- 这是更新能力经宿主注入的 `subprocess` 抽象 spawn CLI（`runCliProcess`，L803-821），字段含 `argv/cwd/stdio/graceMs`。
- 意义有二：① 本仓 host 侧**已有“spawn 子进程并等退出码”的生产代码路径**（`update.install.exec` 事件即其轨迹，`src/update/host/*`）；② 若未来宿主收紧裸 `node:child_process`，仍有注入式 spawn 可走。本方案首选裸 `node:child_process`（与 better-sidebar 同形、零宿主配合），回退路是此注入抽象——两条都不碰官方代码。

### 2.3 其他 spawn/powershell/exec 实例（区分“host 运行时”与“构建时”）

- 本仓构建脚本 `spawnSync/execFileSync`（`scripts/build.mjs:20,31`、`scripts/wayfinder-chart.mjs:19` 等）是**构建时** Node（开发者机器），不是 host 运行时证据——本报告不将其计为先例，仅备注以防误引。
- `dsh-better-sidebar` 的 `settingsShellDesc` 多处提 `powershell.exe`（如 `lib/client.js:settingsShellDesc` “Windows 的 powershell.exe”）是终端 shell 配置文案，不是 spawn 调用点——同样不计为“spawn powershell”先例。本报告的“能 spawn powershell.exe”是**从“能 spawn explorer/git”经同机制推出**（同一 `spawn(cmd,argv,opts)` 签名，cmd 换成 powershell 路径即可），不是声称已找到某插件 spawn powershell 的行号。这一点如实写，不夸大。

### 2.4 小结：host Node 能否 spawn powershell.exe

**能。** 源码证据链：`node:child_process.spawn` import（b1 L10）+ 三平台 opener 分支（b1 L1055-1087）+ 真 spawn 落点（b1 L1110）+ 带超时/输出的 git spawn 全形态（b1 L1694-1726）。`powershell.exe` 只是换一个 `command` 字符串 + argv 数组（`["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command", script]`），机制同一。Windows 上 `powershell.exe`（或 `pwsh.exe`）为系统自带/可探测可执行文件，无需管理员、无需新 inject、无需改 `package.json`（§4.1）。

---

## 3. 本插件自实现的端点设计（不碰官方代码）

### 3.1 合约（沿用 #86 拟议码，本仓自实现）

- 前缀沿用自家桥：`/_dsh/dsh-prompt/*`（与 `remote.ts:101-102` `STORE_URL/SET_URL` 同形，`lib/index.js:708` 前缀注册自动覆盖）。
- 切换：`POST /_dsh/dsh-prompt/system/orientation`
  - 请求：`{ "orientation": "landscape" | "portrait" }`（与 `remote.ts:23` `RemoteOrientationPref` 对齐，但**去掉 `auto`**——`auto` 是插件内视口推导，不进 OS；client 侧 `setRemoteOrientation("auto")` 只写偏好不调此端点）。
  - 成功：`{ "ok": true, "orientation": "landscape" | "portrait" }`（回声 OS 真值，不是请求回声——读后写、写后复读，见 §4.4）。
  - 失败：`{ "ok": false, "error": { "code": <code>, "message": <string> } }`，`code` 复用 `unsupported | busy | denied | unknown`（与 #86 提案一致）：
    - `unsupported`：非 win32 平台 / 探测不到 `powershell.exe` / 无主屏 / 驱动报 `DISP_CHANGE_BADMODE` 且重试无果（本机不支持该方向）。
    - `busy`：上一笔 OS 切换未完成（串行链未释放，见 §3.3）。HTTP 状态仍 200（与既有 `updateRoutes` “fail 也 200 + ok:false”一致，`lib/index.js:570`），client 按 `ok` 判。
    - `denied`：spawn `error ENOENT/EACCES`、PowerShell 执行策略拦截、`ChangeDisplaySettings` 返回 `DISP_CHANGE_NOTUPDATED` 且伴随访问类 stderr。
    - `unknown`：超时、非零退出无明确分类、输出不可解析、复读与目标不一致且已回滚。
- 查询：复用 vs 新增（二选一，推荐双轨）：
  - 复用：`GET /_dsh/dsh-prompt/store` 快照的 `remote.orientation`（`lib/index.js:179`）——但那是**插件偏好**，不是 OS 真值，仅作 UI 初值/离线回落。
  - 新增：`GET /_dsh/dsh-prompt/system/orientation` → `{ "ok": true, "orientation": "landscape"|"portrait", "source": "live"|"cached" }`。`live` = 当场 `EnumDisplaySettings` 读主屏；`cached` = live 失败时回上次成功值 + `ok:true` 但标注（client 据此置“读数可能过期”而不置灰总闸）。失败才回 `{ok:false,error}`。`KNOWN_ROUTES` 需同步追加该 GET 路径（与 POST 同路径字符串，表里占一项即可，因表按路径判）。

### 3.2 PowerShell 脚本要点（P/Invoke， argv 传递、ждению shell 插值）

- Win32 落点：`user32!EnumDisplaySettingsW`（读）+ `user32!ChangeDisplaySettingsExW`（写），`DEVMODE.dmSize/dmFields=DM_DISPLAYORIENTATION(0x80)`，`dmDisplayOrientation ∈ {0:DMDO_DEFAULT(横),1:DMDO_90(竖),2:DMDO_180,3:DMDO_270}`，`CDS_UPDATEREGISTRY(0x01)|CDS_NO_RESET` 后 `ChangeDisplaySettingsEx(NULL,NULL,NULL,0,NULL)` 生效。只动主屏：`deviceName = NULL`（= 主屏，参考 better-sidebar `revealCommand` 的平台分支写法，按 `process.platform==="win32"` 选此路，非 win32 直接 `unsupported`）。
- `landscape ↔ 0`、`portrait ↔ 1`（逆时针 90°；若用户要顺时针可在 client 加 `portrait-270` 扩展，但首版只做两态，与 `remote.ts` 三档中的两档对齐）。
- 宽高互换：转 90/270 时需同步交换 `dmPelsWidth/dmPelsHeight`（否则 `DISP_CHANGE_BADPARAM`）。脚本内先 `EnumDisplaySettings(NULL, ENUM_CURRENT_SETTINGS, dm)` 读当前宽高，再按目标方向决定是否交换。
- 返回值契约：脚本只向 stdout 打一行 JSON：`{"orientation":"landscape"|"portrait","raw":0-3,"width":N,"height":M}`（读）或 `{"changed":true,"orientation":...}`（写）；`ChangeDisplaySettings` 返回码原文打 stderr（`DISP_CHANGE_SUCCESSFUL=0 / RESTART=1 / FAILED=-1 / BADMODE=-2 / ...`），Node 侧映射（§3.3）。
- 执行形态：`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command <script>`，`windowsHide:true`，`timeout 8000-10000ms`，argv 数组传递（抄 b1 L1110 `spawn(cmd,args,{...})`，**不用 `shell:true`**，防注入）。

### 3.3 host 半伪代码（直接贴进 `lib/index.js` 的形态，复用既有件）

> 约束：`lib/index.js` 被回归脚本单复制到临时目录跑（L713-714 注释），所以 `node:child_process` 必须**动态 import**（与 `log/update` 同法 L715-722/L736-738），顶层静态 import 会炸回归。以下伪代码按此写。

```js
// ── 追加在 lib/index.js：KNOWN_ROUTES 补一项（与 L379-385 同表） ──
// "/_dsh/dsh-prompt/system/orientation",

// ── orientation 执行器（进程单例，串行链复用 PromptStore.enqueue 形态 L269-276） ──
let orientChain = Promise.resolve();
let orientBusy = false; // 同步位：spawn 存活期间为 true，POST 命中即回 busy
let lastKnownOrientation = null; // "landscape"|"portrait"|null（成功写后更新，GET cached 用）

function enqueueOrient(op) {
  const run = orientChain.then(op);
  orientChain = run.then(() => undefined, () => undefined);
  return run;
}

async function spawnPowershellJson(script, timeoutMs = 9000) {
  const { spawn } = await import("node:child_process"); // 动态：保回归单文件复制
  const exe = await resolvePowershellExe(); // System32\WindowsPowerShell\v1.0\powershell.exe → PATH powershell → pwsh，找不到抛 {code:"unsupported"}
  return await new Promise((resolve, reject) => {
    const child = spawn(exe, ["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command", script],
      { stdio: ["ignore","pipe","pipe"], windowsHide: true, timeout: timeoutMs });
    // 形态抄 b1 runGit L1694-1726：pipe 输出 + kill 超时 + close 判码
    let out = "", err = "";
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} reject(orientErr("unknown","orientation-timeout")); }, timeoutMs + 500);
    child.stdout.on("data", c => { out += c.toString("utf8"); });
    child.stderr.on("data", c => { err += c.toString("utf8"); });
    child.on("error", e => { clearTimeout(timer); reject(mapSpawnError(e)); }); // ENOENT→unsupported, EACCES/EPERM→denied
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(mapExitError(code, err)); // BADMODE→unsupported, 访问类→denied, 余→unknown
      try { resolve(JSON.parse(out.trim().split("\n").pop())); }
      catch { reject(orientErr("unknown","orientation-unparseable")); }
    });
  });
}

function orientErr(code, message) { const e = new Error(message); e.orientCode = code; return e; }

// ── 路由分支（贴进 buildPromptRoute handler，与 remote/set 分支 L689-694 并列） ──
if (method === "GET" && path === "/_dsh/dsh-prompt/system/orientation") {
  try {
    const live = await queryOsOrientation(); // EnumDisplaySettings，主屏；失败抛 orientErr
    lastKnownOrientation = live.orientation;
    writeJson(res, { ok: true, orientation: live.orientation, source: "live" });
  } catch (e) {
    if (lastKnownOrientation) writeJson(res, { ok: true, orientation: lastKnownOrientation, source: "cached" });
    else writeJson(res, { ok: false, error: { code: e.orientCode ?? "unknown", message: e.message } }, 200);
  }
  return;
}
if (method === "POST" && path === "/_dsh/dsh-prompt/system/orientation") {
  if (process.platform !== "win32") { writeJson(res, { ok:false, error:{ code:"unsupported", message:"non-windows" } }, 200); return; }
  if (orientBusy) { writeJson(res, { ok:false, error:{ code:"busy", message:"orientation-change-in-progress" } }, 200); return; }
  const body = await readJsonBody(req);
  if (body?.orientation !== "landscape" && body?.orientation !== "portrait") {
    writeJson(res, { ok:false, error:{ code:"unknown", message:"invalid orientation (want landscape|portrait)" } }, 200); return;
    // 注：400 vs 200 二选一。既有 store 路由非法走 StoreError 400（setRemote L245-251），
    // 但 orientation 沿 #86 码表只有 unsupported|busy|denied|unknown 四码，无 invalid 码，
    // 故非法输入归 unknown（200 + ok:false），保持码表封闭。若以后加 invalid 码再切 400。
  }
  orientBusy = true;
  try {
    const done = await enqueueOrient(() => changeOsOrientation(body.orientation)); // 读→换宽高→ChangeDisplaySettingsEx→复读
    lastKnownOrientation = done.orientation;
    // 成功同时写偏好（复用 setRemote 语义，失败不影响主回包）：await store.setRemote({ orientation: done.orientation }).catch(()=>{});
    writeJson(res, { ok: true, orientation: done.orientation });
  } catch (e) {
    // 回滚策略见 §4.4：changeOsOrientation 内部已尽力恢复原方向；此处回声当前值
    const cur = await queryOsOrientation().catch(() => null);
    writeJson(res, { ok:false, error:{ code: e.orientCode ?? "unknown", message: e.message + (cur ? ` (current:${cur.orientation})` : "") } }, 200);
  } finally { orientBusy = false; }
  return;
}
```

- `changeOsOrientation(target)` 内部步骤：① `queryOsOrientation()` 记 `before`；② 若 `before===target` 直接返回（幂等，不调 OS，避免闪屏）；③ `spawnPowershellJson(setScript)`；④ 复读 `queryOsOrientation()`，不一致 → 尝试写回 `before`（回滚一次）→ 抛 `unknown`（或按返回码映射）；⑤ 返回复读值。
- 日志：成功记 `system.orientation.ok{from,to,durationMs}`（需先在 `event-list.dsh-prompt.json` 声明，否则闸门丢弃——抄 `update.install.exec` 的清单流程）；失败走既有 `host.route.fail`（route 已入 `KNOWN_ROUTES`，method 走 `KNOWN_METHODS`，`writeRouteError` L320-339 自动处理）。
- Client 薄 wrapper（`src/client/systemOrientation.ts` 新文件，或扩 `remote.ts`）：`setSystemOrientation(o): Promise<{ok,orientation?,error?}>` → `fetch("/_dsh/dsh-prompt/system/orientation",{method:"POST",...})`；`getSystemOrientation()` → GET 同路由；设置页该行就绪时调用，缺席（`unsupported`）保持 disabled（`settings.ts:385-397` 已有缺席分支，直接复用）。

### 3.4 为什么不动官方

- 端点挂在**自家前缀**（`kind:prefix /_dsh/dsh-prompt`），`ctx.webServer.register` 是已注入的既有服务（L35+L753），不新增 inject、不新增宿主服务、不改 `package.json:73-87` 任何声明。
- spawn 用 Node 内建（b1 L10 同形），不调任何 `ctx.*` 新能力；`process.platform` 即判平台。
- 查询可复用既有 store 快照作回落，但 OS 真值走新 GET——store 的 `remote.orientation` 仍是偏好位，不混用（§4.4 回滚回声依赖 live 读）。

---

## 4. 约束清单（四个必答）

### 4.1 需要管理员吗？——不需要（用户态显示设置）

- `ChangeDisplaySettingsEx` + `CDS_UPDATEREGISTRY` 改的是**当前会话的显示模式**（写 `HKCC` + 通知显卡驱动重设模式），Win32 文档将其归为 per-session 调用，不触发 UAC。日常“设置 → 显示 → 显示方向”下拉即用户态可点，同权操作经 API 同样用户态可调——这是“显示方向”与“驱动安装/分辨率超频”的区别。
- PowerShell 侧：`powershell.exe -ExecutionPolicy Bypass -NoProfile` 作用于**当次进程**，不改系统执行策略、不写注册表策略键，无需提权。`windowsHide:true` + 无控制台闪现（抄 b1 L1700）。
- 例外→`denied` 映射：若企业组策略锁显示设置 / 进程完整性级别被降权（如宿主以低完整性跑），`ChangeDisplaySettings` 会回 `DISP_CHANGE_NOTUPDATED(0?) / FAILED` 或 PowerShell 报访问类 stderr——此时按 §3.1 回 `denied`，client 置灰并写明，不重试提权、不弹 UAC（**绝不尝试 `runas`/计划任务提权**，那是红线）。
- 证据缺口声明：本仓无真机改方向实测（禁令：只 research、不改源码）；“无需管理员”为 Win32 公开语义 + 设置 App 同权可点的推出，不是本机实测。若落地需补一条真机验收（标准用户 + 企业 laptop 各一）。

### 4.2 多显示器：只动主屏（`deviceName=NULL` 策略）

- 策略：**只动主屏，其他屏不动**。理由：① UU 全桌面适配下手机看到的是整块桌面合成帧，主屏方向决定帧的宽高比（§4.3）；② 多屏逐屏编排（相对位置、主副关系）是用户资产，插件无权重新编排；③ Win32 多屏旋转需逐 `displayDevice` 调 `ChangeDisplaySettingsEx(deviceName,…)` 并处理 `DM_POSITION` 漂移，复杂度与误伤远超收益。
- 实现：`EnumDisplaySettings(NULL,…)` / `ChangeDisplaySettingsEx(NULL,…)` 的 NULL 即主屏（与 `EnumDisplayDevices` 的 `PRIMARY_DEVICE` 一致）。脚本内**硬编码 NULL，不接受 device 参数**（防 client 传屏号绕过多屏策略）。GET 回包可附 `display:"primary"` 明示。
- 边界：副屏竖屏而主屏横屏时，整机帧仍横——这是策略声明的已知限制，client 文案写明“仅切换主屏方向”，不假装全机。

### 4.3 UU 串流全桌面适配下“转整机 = 转串流画面”的因果链

事实基点（ADR-0002，本仓 `docs/adr/0002-remote-panel-sizing.md:3-5`）：UU 远程为**全桌面适配**——整块 Windows 桌面按屏等比缩放播放；插件拿不到手机屏物理尺寸与串流缩放比。

因果链（四步，串行）：

1. **OS 真转**：host `ChangeDisplaySettingsEx` 成功 → 主屏 `dmDisplayOrientation` 翻转 + `dmPelsWidth/Height` 互换 → DWM 重排整块桌面（任务栏、窗口位置、壁纸随之重算）。
2. **采集跟转**：UU 采集端（镜像驱动/Desktop Duplication）下一帧拿到的即新宽高比帧（如 1920×1080 → 1080×1920）。
3. **编码重协商**：串流编码器检测到帧尺寸变化 → 重协商分辨率/码率（此处有 1-3 秒黑屏/卡顿，为正常现象，client 需 loading 态覆盖，不归为失败）。
4. **手机看到转**：手机端按新帧等比缩放播放——用户感知的“画面转了”正是 OS 真转的**后果**，不是插件 CSS 转的仿真（姊妹篇 §3.5 已判仿真为自欺：`transform:rotate` 只转自家盒子，不进串流帧，还打乱指针映射）。

推论：验收必须按“**外部系统显示方向真的变了**（复读 `EnumDisplaySettings` + UU 帧宽高比翻转）”判定，`screen.orientation.lock()` 转文档、`requestFullscreen` 铺元素、CSS 旋转三者皆不可作为验收（姊妹篇 §3.1-§3.5 引 MDN/W3C 原文已证伪）。

### 4.4 回滚策略：失败保持原方向并回声当前值

- 写前必读：`changeOsOrientation` 先 `queryOsOrientation()` 记 `before`（含 `raw/dmWidth/dmHeight`）。
- 幂等短路：`before===target` 直接返回，不调 OS（避闪屏）。
- 写后复读：`ChangeDisplaySettings` 返回 `DISP_CHANGE_SUCCESSFUL(0)` **且**复读 `==target` 才算成功。返回 `DISP_CHANGE_RESTART(1)` 视为半成功→回 `unknown + current`（需重启生效的方向在现代驱动极少，遇则如实报，不静默成功）。
- 回滚一次：复读不一致或返回 `FAILED/BADPARAM` → 用 `before` 的完整 `DEVMODE` 再调一次 `ChangeDisplaySettingsEx` 写回 → 再复读确认回到 `before` → 抛原错误（`orientCode` 保持首错码，message 追加 `(current:<复读>)`）。
- 回滚也失败：不循环重试（防振荡闪屏），直接回 `{ok:false,error:{code:"unknown",message:"set-failed+rollback-failed (current:X)"}}`，`lastKnownOrientation` 不更新，GET `cached` 仍指上次成功值。
- Client 侧：失败不改偏好内存（`remote.ts:234-241 applyPatch` 的 fail-soft 是偏好落盘语义，OS 失败不走它）；设置页提示“未改变，当前仍为 X”，总闸/自适应布局不受影响（姊妹篇 §7 拆分验收：H1 缺席只验置灰 + 自适应照常）。

---

## 5. 最小改动面（只动本仓，不动官方）

| 文件 | 改什么 | 不改什么 |
|---|---|---|
| `lib/index.js` | `KNOWN_ROUTES` 加 1 项；`buildPromptRoute` 加 GET+POST 两分支（§3.3）；文件尾加 `orientChain/orientBusy/lastKnownOrientation + spawnPowershellJson + query/change + resolvePowershellExe + map*Error`（约 120-160 行，动态 import 形态）；`apply` 不动（路由经同一 `register` 生效） | `inject` 不动（仍 `["storageDomain","webServer"]`）；`promptDomainSpec version` 不动（仍 0）；既有路由顺序不动（新分支插 `remote/set` 后、`debug` 前） |
| `src/client/` 新 `systemOrientation.ts`（或扩 `remote.ts`）+ `settings.ts` 该行接线 | `setSystemOrientation/getSystemOrientation` 薄 fetch wrapper；`remote-sys-orientation` 行就绪时调用、`unsupported` 置灰（复用 `settings.ts:385-397` 缺席分支） | `RemoteOrientationPref` 三档不动（`auto` 不进 OS）；`deriveRemoteOrientation` 自适应不动（零宿主依赖，恒开） |
| `event-list.dsh-prompt.json` | 若记成功事件则加 `system.orientation.ok` 声明（含 `from/to/durationMs` 值域） | 失败走既有 `host.route.fail`，不新增失败事件 |
| 不动 | 官方任何包；`package.json` engines/权限；`cordis.patch.yml`；issue（本报告仅 research） | — |

回归：扩展 `scripts/test-issue-82-host.cjs`（或新 `test-issue-86-host.cjs`）断言：① `/_dsh/dsh-prompt/system/orientation` 源码齐；② `spawn` 为动态 import（防单文件复制炸）；③ 非法 orientation 归 `unknown`；④ `busy` 分支存在；⑤ `KNOWN_ROUTES` 含新路径。全部源码级契约（同 #82-host “不断言可加载”口径，L3）。

---

## 6. 风险与未证事项（诚实清单）

1. **无真机改屏实测**：b1 证明“能 spawn”，不证明“转屏在目标驱动上成功”。落地前需真机矩阵（Intel/AMD/NVIDIA 核显×独显、笔记本内屏×外接显示器主屏、标准用户×管理员各一），记录 `DISP_CHANGE_*` 返回分布。
2. **`web_search` 本轮不可用**（`DeepSeek search has no API key`），§4.1 的 Win32 语义未附在线引文——补引时优先 MSDN `ChangeDisplaySettingsExW` + `DEVMODEA` 页，不是博客。
3. **串流重协商黑屏**：转屏瞬间 UU 帧中断 1-3 秒，误判为失败会诱发二次点击——client 必须 `busy` 期间禁用按钮 + loading 文案（`busy` 码即为此存在）。
4. **副屏用户期望差**：只动主屏是策略，不是技术不能——文案必须前置写明，否则副屏竖屏用户会报“没转”。
5. **执行策略收紧环境**：`Bypass` 被组策略禁时回 `denied`，不降级 `-EncodedCommand` 绕行（那是绕策略，红线）。

---

## 7. 来源清单（每主张落点）

- 本仓 host 装配：`D:\dsh-plugin\dsh-prompt\lib\index.js:7-8`（桥自述）、`:34-35`（inject）、`:67-77`（`normalizeRemotePrefs`）、`:153-180`（snapshot）、`:237-267`（setRemote）、`:269-276`（enqueue）、`:314-339`（writeJson/writeRouteError）、`:379-385`（KNOWN_ROUTES）、`:708`（prefix 对象）、`:711-755`（apply/logReady/updateReady/register）。
- 本仓 client 桥形：`D:\dsh-plugin\dsh-prompt\src\client\remote.ts:23`（方向三档）、`:43-45`（校验）、`:101-102`（STORE_URL/SET_URL `/_dsh/dsh-prompt/*`）、`:137-232`（fetch 桥）。
- 本仓契约回归：`D:\dsh-plugin\dsh-prompt\scripts\test-issue-82-host.cjs:13-26,52-55`。
- 本仓 spawn 抽象旁证：`D:\dsh-plugin\dsh-prompt\lib\update.js:809-816`（`subprocess.spawn({argv,cwd,stdio,graceMs})`）。
- 第三方 spawn 先例：`D:\tmp-plugcheck\b1\package\lib\index.js:10`（import spawn）、`:1049-1070`（revealCommand explorer/open/xdg-open）、`:1072-1087`（urlCommand rundll32/open/xdg-open）、`:1107-1117`（launchExternal 真 spawn）、`:1683-1728`（runGit 带超时/输出 spawn）、`:3683-3688`（inject 无系统能力）。
- 串流事实：`D:\dsh-plugin\dsh-prompt\docs\adr\0002-remote-panel-sizing.md:3-5`；插件边界：`research/host-vs-plugin-h1-orientation.md:§1,§4-§5`；包声明：`D:\dsh-plugin\dsh-prompt\package.json:19-20,77-87`。
