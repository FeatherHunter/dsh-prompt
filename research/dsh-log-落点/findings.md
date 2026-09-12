# 日志落点与宿主沙箱 findings（issue #46）

- 环境：DSH Desktop 2.0.9；Desktop 内置平台包全为 `0.1.5-rc.1`；DSH 家目录 `C:\Users\辰辰洋洋\.dsh`（实测 `$DSH_HOME` = 该路径）。
- 日期：2026-09-12。
- 方法：一手读 **app.asar 内平台源码**（不是文档）+ 已安装插件产物 + 本机实盘文件 + 我自己跑的写入实测。
- 工具：本仓新增 `.tmp-verify/asar-read.mjs`（解析 asar 索引，`list` / `get` / `search` 单文件，绝不整份读 169MB）。下文 `asar:/…` 均指归档内路径。
- 口径说明：平台产物在 `D:\0Tools\DSH Desktop\resources\app.asar`（归档，非目录），故所有平台源码引用都来自 asar 内提取。

## 0. 结论速览（可直接执行）

**落盘方案（一句）**：host 侧 `getCacheDir()` 返回 `resolveDshHome()` 拼接的 `<home>/logs`（即 `C:\Users\辰辰洋洋\.dsh\logs`），`logDirName` 取 `'dsh-prompt'` → 日志落 `<home>/logs/dsh-prompt/YYYY-MM-DD.log`，开关文件落 `<home>/logs/log-switch-dsh-prompt.json`；**写盘走 `node:fs/promises`（`mkdir(recursive)` + `appendFile`），不要走 `ctx.fs.writeText`**。

**降级方案（一句）**：`<home>/logs/dsh-prompt/` 写失败时退到 `path.join(os.tmpdir(), 'dsh-prompt', 'logs')`（`os.tmpdir()` 是 workspace-write 沙箱白名单内的可写根，见 §1.3），再失败则彻底不落盘、只向 stderr 打印一次告警。

理由一句话：**`ctx.fs` 的沙箱围栏只拦 `writeText` / `editText` 两个变更原语，且 workspace-write 的可写集只有 `workspaceRoot + /tmp + os.tmpdir()`；`~/.dsh` 不在其中，所以经 `ctx.fs` 写 `~/.dsh/logs` 必被拒。**而 `node:fs` 在宿主进程内不受这层策略约束（dsh-vision-router 已实盘证明，§3）。

## 1. 问题 1：`ctx.fs` 在 0.1.5-rc.1 的沙箱策略

### 1.1 围栏挂在哪两个方法上

`asar:/node_modules/@deepseek-ai/dsh-fs-sandbox/lib/index.js`：类 `SandboxedFileSystem extends LocalFileSystem`，`static inject = ["sandboxPolicy"]`（L104），**只覆写两个方法**：

- `writeText(target, content, expected, signal, sandboxPolicy)`（L125-127）
- `editText(target, edit, expected, signal, sandboxPolicy)`（L139-141）

两者都先过 `checkedTarget()` 再委托父类。其余全部原样继承 `LocalFileSystem`。源码注释（L74-75）原文：*“Reads pass through untouched: every mode permits reading.”* —— **读、stat、listDir 完全不受围栏限制，任何模式都放行。**

### 1.2 判定逻辑（`checkedTarget`，L153-166）

```
const policy = sandboxPolicy ?? this.ctx.sandboxPolicy.resolve();
if (mode === "danger-full-access") return target;          // 不拦
if (mode === "read-only") throw FsError(FS_SANDBOX_DENIED); // 全拒
// workspace-write：重新规范化后必须落在某个 writableRoots 之下
for (const root of writableRoots(policy)) if (await isPathUnder(fresh.targetKey, root)) { contained = true; break }
if (!contained) throw FsError("… file access denied under workspace-write mode", "FS_SANDBOX_DENIED");
```

被拒时抛结构化 `FsError`，码 `FS_SANDBOX_DENIED`；经工具层渲染为 `[sandbox: file access denied under <mode> mode]`。

### 1.3 可写集到底有多大（关键）

`asar:/node_modules/@deepseek-ai/dsh-sandbox/lib/index.js` L155-162：

```js
function writableRoots(policy) {
  if (policy.mode !== "workspace-write") return [];
  return [...new Set([policy.workspaceRoot, "/tmp", tmpdir()].map(canonicalPath))];
}
```

**workspace-write = {会话/部署 workspace root, `/tmp`, `os.tmpdir()`} 三者。** 注意：本机 `os.tmpdir()` = `C:\Users\辰辰洋洋\AppData\Local\Temp`，所以 `%TEMP%` 其实**是**可写的；被拒的是 `~/.dsh`、`%APPDATA%`（漫游）这类根。

### 1.4 插件裸调 `writeText` 时用哪套策略（决定本票答案）

会话由 `sandbox-policy` 决定：`asar:/node_modules/@deepseek-ai/dsh-sandbox-policy/lib/index.js` L141-148：

```js
resolve(request = {}) {
  return {
    mode: request.mode ?? (session === void 0 ? void 0 : this.overrideOf(session)) ?? this.defaultMode,
    workspaceRoot: resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot)
  }
}
```

插件调用 `ctx.fs.writeText(target, content)`（不传第 5 个参数、不带 session）→ 走 `resolve()` 无参分支 → **mode = 部署默认值，workspaceRoot = 部署回退根**，与当前会话的 danger-full-access 无关。

部署默认值来自 `asar:/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` L208-212：

```yaml
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: !!js process.env.DSH_PERMISSION_MODE ?? 'workspace-write'
    workspaceRoot: !!js process.cwd()
```

`DSH_PERMISSION_MODE` 只在这一个文件里出现（全档搜索命中 2 处，均在该文件：L211 sandbox 模式、L227 approval 策略），**Desktop 没有任何地方设置它**；实测我的 pwsh（继承宿主进程环境）里 `DSH_PERMISSION_MODE=[]` 为空 → **部署默认 mode = `workspace-write`，回退根 = DSH 进程的 `process.cwd()`**。

### 1.5 结论

| 目标 | 经 `ctx.fs`（插件裸调） | 经 `node:fs` |
|---|---|---|
| `~/.dsh/logs/` 写 | **拒**（`FS_SANDBOX_DENIED`，`~/.dsh` 不在可写集） | **可写**（实测 + vision-router 实盘） |
| `~/.dsh/logs/` 读 | 可（读不设围栏） | 可 |
| `process.cwd()` 写 | 可（= 回退 workspaceRoot） | 可 |
| `os.tmpdir()` 写 | 可（在可写集内） | 可 |

补：**`ctx.fs` 没有 `mkdir` / `unlink` / `rename` / `copy` / `watch`。** `asar:/node_modules/@deepseek-ai/dsh-fs-local/lib/index.js` 的公开方法只有 `resolve` / `processPathFromHostPath` / `stat` / `readText` / `streamText` / `readBytes` / `readByteRange` / `listDir` / `writeText` / `editText`；`dsh-fs/README.zh.md` L113 原文：“只有十三个原语：没有删除、重命名、复制或监视”。父目录由 `writeText` 内部递归创建。→ **日志轮转/清理（删旧文件）经 ctx.fs 做不到，只能走 node fs；这也是选 node fs 的第二个理由。**

## 2. 问题 2：官方「家目录 / 缓存目录」能力

**有，但它是库不是服务。** `asar:/node_modules/@deepseek-ai/dsh-home-paths/`：

- 导出（`lib/index.js` L97）：`resolveDshHome` / `dshHomePath` / `dshHomeDisplay` / `expandHomePath` / `canonicalizeWatchPath` / `defaultDshHome` / 常量 `DSH_HOME_ENV` / `DSH_HOME_DIR_NAME`。
- 解析优先级（L73-76）：**显式配置 > `$DSH_HOME`（空白视为未设置）> `~/.dsh`**，结果 `resolve()` 成绝对路径。
- `dshHomePath(...segments)`（L82-83）= `join(resolveDshHome(), ...segments)`。
- README.zh.md L12 原文：“**请把它作为库依赖直接使用，不要通过 `cordis.yml` 加载。**”

→ 所以 **home-paths 没有 `inject` 字符串、没有 `ctx.xxx` 服务名**，正确用法是 `import { resolveDshHome, dshHomePath } from '@deepseek-ai/dsh-home-paths'`。全档没有把它挂成服务（yml 搜索无挂载点）。

它**本身不受沙箱约束**（纯路径计算，不碰 IO）；约束只在真正写盘的 seam 上生效——即 §1：走 node fs 不受约束，走 `ctx.fs.writeText` 受 §1.3 可写集约束。

旁证：`@deepseek-ai/dsh-storage-json` 的 root 就是 `!!js dshHomePath('storages')`（base patch L149-151），即官方自己也用这个库函数定位家目录子路径。

## 3. 问题 3：dsh-vision-router 怎么写进 `~/.dsh/logs/`

**走 node 的 `fs`，完全没碰 `ctx.fs`。** 已安装包 `C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\dsh-vision-router\`：

- `lib/file-logger.js` L1：`import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises'`
- `lib/file-logger.js` L22-29：`resolveVisionRouterLogPaths()` → `path.join(dshHome, 'logs', 'vision-router')`，文件 `vision-router.log`、备份 `vision-router.1.log`
- `lib/doctor.js` L25-28：自己重实现了一份 `resolveDshHome`（`$DSH_HOME` || `~/.dsh`），**没有用 `@deepseek-ai/dsh-home-paths`**
- 它的 `package.json` 里**没有**声称任何平台 fs/服务 peer，`dsh` 块只有 client inject（skipped：与日志无关）

实盘证据：

```
Length : 146572
Path   : C:\Users\辰辰洋洋\.dsh\logs\vision-router\vision-router.log
首行   : [2026-09-07T07:31:46.082Z] [INFO] vision-router: diagnostics log enabled at
        C:\Users\辰辰洋洋\.dsh\logs\vision-router\vision-router.log (plugin=2.1.3 node=v24.18.1 platform=win32/x64)
```

→ **宿主进程内的 `node:fs` 写 `~/.dsh/logs/` 是可行且已在跑的既定事实**（不是推断）。它和 §1 不矛盾：fs 沙箱是 `ctx.fs` seam 上的**策略围栏**，源码注释明说 *“This is containment, not a security boundary; kernel-grade isolation of untrusted CODE stays `ctx.shell`'s job”*（fs-sandbox lib L80-82）。插件自己的宿主代码不是被隔离的对象。

## 4. 问题 4：mattskillsdeck 的 `getCacheDir` 为何降级到 `process.cwd()`

判据出自它自己的复盘文档 `D:\dsh-plugin\dsh-mattpocock-skills-deck\docs\cache-and-diagnostics.md`（T9 · 2026-08-16）：

- L23（排查表第 5 行，**★ 真根因**）原文：“**file access denied under workspace-write mode —— fs 沙箱只允许 process.cwd() 下写入**”，验证方法写的是“staging 工具实测写入”（即真机运行时探测，非读文档）。
- L29：`~/.dsh/mattskillsdeck-cache/` 在沙箱外 → `fs.writeText` 抛 file access denied → 被 try-catch 静默吞掉 → 缓存永不写入。
- L35：修复 = 缓存目录改到 `<DSH 进程 cwd>/.dsh-mattskillsdeck-cache/`（实测该路径写入成功）。
- L91：自认局限——“缓存目录依赖 DSH 进程 cwd，换启动方式会变 cwd → 缓存静默失效。正解是用 DSH storage 服务（不受沙箱限制），但探测时 `ctx.get('storage')` 方法为 undefined（RPC 壳），需进一步调研。”
- 代码位置 `src/host/repoKeys.js` L177-187（`getCacheDir`）与注释“T9 修复：fs 沙箱 workspace-write 只允许 cwd 下，~/.dsh 在沙箱外被拒”；L211-215 另记 `writeText` 必须传 `resolve()` 返回的 target 对象。

**当时策略还是至今成立？——至今成立，且描述基本准确，只有一处需要修正：**

- 它的“只允许 process.cwd() 下”是 §1.3 可写集的可观察近似（真实集 = `workspaceRoot + /tmp + os.tmpdir()`，回退 workspaceRoot 恰好 = `process.cwd()`）。结论方向完全正确：`~/.dsh` 被拒。
- 需要修正的一处：它文档 L65/§7.1 说 `%APPDATA%` 等被拒——`%APPDATA%`（漫游）确实被拒，但 **`os.tmpdir()`（本机 = `%LOCALAPPDATA%\Temp`）在白名单内**，是可用的降级落点。它的复盘没利用这一点。
- 它的注释**只对“走 `ctx.fs`”成立**。它当时没有考虑 node fs（vision-router 那条路），所以把结论写成了“只能 cwd”。
- 它的隐藏前提也成立：它探到 `ctx.get('storage')` 是 undefined —— 注意 storage-domain 服务的真实名是 `storageDomain`（§5），`storage` 是**底层 KV**、由 `dsh-storage` 提供且 `storage-domain` 声明 `inject = ["storage"]`。探错名字也可能是当时失败的原因之一。

**“没有可用的官方服务”这个判断今天要修正**：官方有 `@deepseek-ai/dsh-home-paths`（§2，库）与 `ctx.storageDomain`（§5，服务）；但它把缓存定死为常量，是因为它需要的是「一个确定的磁盘目录写 JSON 文件」，而官方 storage 栈是 schema 校验的 domain KV（不适合任意 JSON 缓存），home-paths 又只是路径库——**这两者都不解决 §1 的写权限问题**。写权限问题只靠“换 seam”（改走 node fs）或“换落点”（cwd / tmpdir）解决。

## 5. 问题 5：本插件要用的平台能力在 0.1.5-rc.1 是否都存在

服务名取自源码里的注册点（不是文档）：

| 能力 | 存在 | `inject` 里写的字符串 | 注册点（asar 内源码） |
|---|---|---|---|
| fs | ✅ | `"fs"` | `/node_modules/@deepseek-ai/dsh-fs/lib/index.js` L58-61 `class FileSystem extends Service` → `super(ctx, "fs")` |
| storageDomain | ✅ | `"storageDomain"` | `/node_modules/@deepseek-ai/dsh-storage-domain/lib/index.js` L450 `domainCtx.provide("storageDomain", facility)`；该插件自身 `inject = ["storage"]`（L311），即消费方写 `storageDomain`、它自己去要 `storage` |
| webServer | ✅ | `"webServer"` | `/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js` L157 `super(ctx, "webServer")`；挂载点 `/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:136`（web profile 才有） |
| timer | ✅ | `"timer"` | `/node_modules/@deepseek-ai/cordis-plugin-timer/lib/index.js` L4-7 `class TimerService extends Service` → `super(ctx, "timer")` + `ctx.mixin("timer", [...])`；挂载 `/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml:16-17` |
| home-paths | ✅（**是库，不是服务**） | **无 inject**，用 `import { resolveDshHome, dshHomePath } from '@deepseek-ai/dsh-home-paths'` | `/node_modules/@deepseek-ai/dsh-home-paths/lib/index.js` L97 导出表 |
| **platform** | ❌ **不存在** | —— | 见下 |

**`platform` 不存在（0.1.5-rc.1 无此服务）。** 论据三条，全档（22094 个文件）验证：

1. 归档内**没有** `@deepseek-ai/dsh-platform` 包（243 个 `@deepseek-ai/*/package.json` 里无一个名字含 `platform`）。
2. 全档搜索 `ctx.platform` → **0 命中**；搜索 `provide("platform"` / `provide('platform'` → **0 命中**。（搜索工具已用 `writableRoots` 做阳性对照验证可用，另见 §7 排错记录。）
3. 唯一使用它的是第三方插件自己：`dsh-mattpocock-skills-deck/src/host/platformChannel.js` L78 注释“经 `ctx.get('platform')` 或内联 fallback”，L87-93 —— `ctx.get('platform')` 拿到才用，拿不到就 `import('./platform/index.js')` 自建，再兜底 `node:path` / `node:os`。**这是它自己的平台抽象层，不是 DSH 服务。**

→ 本插件若需要「家目录 / 路径拼接 / 找可执行文件 / 环境变量」，替代是：家目录用 `@deepseek-ai/dsh-home-paths`；路径拼接用 `node:path`；找可执行文件用 `ctx.subprocess`（`dsh-subprocess-local`，base 已挂载）；环境变量直接 `process.env`。**不要写 `inject: ['platform']`**——注册期会因无法解析该服务而失败。

## 6. 问题 6：`@deepseek-ai/dsh-storage-domain: ^0.1.5-rc.2` vs 宿主 0.1.5-rc.1

### 6.1 实盘版本分布（实测）

| 位置 | storage-domain 版本 | 备注 |
|---|---|---|
| Desktop asar（真·宿主平台） | **0.1.5-rc.1** | `asar:/node_modules/@deepseek-ai/dsh-storage-domain/package.json` |
| profile `C:\Users\辰辰洋洋\.dsh\profiles\web\node_modules\@deepseek-ai\` | **0.1.5-rc.2** | 该目录下只有 3 个 `@deepseek-ai` 包：`cosmokit@1.8.3`、`dsh-storage-domain@0.1.5-rc.2`、`schemastery@3.18.2`（`nodeLinker: hoisted`，`autoInstallPeers: false`） |
| 全局 npm 安装 `D:\2Study\nodejs\node_modules\@deepseek-ai\dsh` | 版本 0.1.5-rc.1，但**内嵌** `dsh-storage@0.1.5-rc.2`、`dsh-storage-domain@0.1.5-rc.2`、`dsh-home-paths@0.1.5-rc.2` | 本机另有一套全局 CLI 安装 |

### 6.2 关键实测：两份 `lib/index.js` **逐字节相同**

```
SHA256(asar rc.1 lib/index.js)          = E536BA09B7CCC0F10BB54818DFE44454374E5CBF7AEBA140B216BA1CA2E87517
SHA256(profile rc.2 lib/index.js)       = E536BA09B7CCC0F10BB54818DFE44454374E5CBF7AEBA140B216BA1CA2E87517
```

两者 17311 字节，哈希一致；`descriptorOf` 等实现完全一样。**rc.1 → rc.2 的差别只体现在 `package.json` 的 peer 范围**：rc.1 声明 `dsh-invariants@^0.1.5-rc.1` / `dsh-storage@^0.1.5-rc.1`，rc.2 声明两者为 `^0.1.5-rc.2`。

### 6.3 实测：插件这份依赖今天能不能加载 → **能**

```
LOAD OK, exports: Config,DomainError,DomainFacility,apply,defineDomain,descriptorOf,domainTable,inject,name
```

`@deepseek-ai/dsh-storage`（rc.2 的 peer）在 profile 里**没装**（`@deepseek-ai/dsh-storage` 在 profile node_modules 下不存在），`profiles/web/.dsh-module-fallback/node_modules/@deepseek-ai/` 也**是空目录（0 项）**，但它仍解析成功：

```
resolved -> D:\2Study\nodejs\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-storage\lib\index.js
```

即落到全局 CLI 安装里那份 `dsh-storage@0.1.5-rc.2`。**结论：今天不报错，靠的是“从 profile 目录逐级上溯恰好命中全局 node_modules”这一脆弱的巧合，不是设计。**

### 6.4 「该不该改」→ 建议改成 `^0.1.5-rc.1`（但本票不动手）

- 语义上 `^0.1.5-rc.2` = `>=0.1.5-rc.2 <0.2.0`，**排除**了宿主平台实际内置的 `0.1.5-rc.1`；`^0.1.5-rc.1` = `>=0.1.5-rc.1 <0.2.0`，**同时接受 rc.1 与 rc.2**（以及 rc.3…）。所以 rc.1 是**更宽、更安全**的声明区间，不会更松地放进不兼容版本。
- 代价为零：两份实现逐字节相同（§6.2），声明 rc.1 不会让插件少拿到任何能力。
- 风险方向明确：只要将来平台把 `@deepseek-ai/*` 的解析收到自己怀里（或 loader 统一映射到 asar 内那份），`^0.1.5-rc.2` 就会因解析不到 rc.2 而**装配期失败**；`^0.1.5-rc.1` 则不会。
- 结论：**该改**，但它是「版本声明一致性」问题，不是日志落点问题。

### 6.5 与 #42 的关系 → 交给 #42

`#42`（「DSH 版本声明：package.json `dsh.engines.dsh` + README + 一致性断言」）正是拥有「插件声明 vs 宿主平台版本」这一面的票。本票只提供证据，不设计机制、不改 `package.json`：

- §6.1-6.3 的版本分布与哈希实测，交给 #42 作为输入；
- 建议 #42 一并处理：把 storage-domain 的依赖区间从 `^0.1.5-rc.2` 收到 `^0.1.5-rc.1`，并让一致性断言同时覆盖「依赖区间必须容纳宿主内置版本」；
- 同时值得 #42 知道：#42 若引入 `dsh.engines.dsh` 断言，`0.1.5-rc.2` 这种「比宿主新」的写法本身就应被断言拦下——本票的哈希证据说明它没有任何收益。

## 7. 我跑过的实测（原始输出）

宿主进程内 `node:fs`（与 .tmp-verify 脚本同一运行时）：

```
=== 实测1：宿主进程 node fs 能否写 ~/.dsh/logs/ ===
WRITE OK -> C:/Users/辰辰洋洋/.dsh/logs/dsh-prompt-probe.txt
read back: probe ok
cleanup: removed

=== 实测2：process.cwd() 能否写 ===
WRITE OK -> D:\dsh-plugin\dsh-prompt/.probe-cwd.txt
cleanup: removed

=== 实测3：os.tmpdir() ===
WRITE OK -> C:\Users\辰辰洋洋\AppData\Local\Temp\dsh-probe.txt
cleanup: removed
```

（三处探测文件均已删除，未留残留。）

环境与部署默认值：

```
DSH_PERMISSION_MODE=[]   DSH_HOME=[C:\Users\辰辰洋洋\.dsh]
```

`C:\Users\辰辰洋洋\.dsh\profiles\web\cordis.yml` 内容为 `[]`（无覆盖）。

**排错记录（供后续复用，避免踩同一个坑）**：`.tmp-verify/asar-read.mjs search` 的 `pathRe` 参数若在 PowerShell 里传空串 `''`，**空参会被 PowerShell 丢掉**，导致正则串位到 `ctxChars`→ 过滤条件变成垃圾 → 全部 0 命中。我最初据此得到“`ctx.platform` 0 命中”，后用 `writableRoots` 做阳性对照才发现工具坏了，修正（`pathRe` 传 `'^/'`）后重跑才可信。§5 的 0 命中结论是**修正后**的结果。

## 8. 未决项 / 查不到的

1. **`ctx.fs` 写入被拒这一步，我没有在本机 DSH 宿主进程里亲自复现**（那需要在宿主里挂一个临时插件跑 staging 探测，超出本票范围）。我的证据是：平台源码（§1）+ mattskillsdeck 的真机探测记录（§4，其原文明确写“staging 工具实测写入”）。**node fs 可写 `~/.dsh/logs/` 是我亲自实测的**（§7）——而落盘方案选的正是 node fs，所以主路径不依赖那条未复现的证据。
2. **`logDirName` 的具体命名与 dsh-log 的 `getCacheDir` 形参签名未在本票核对**：落点按用户裁定（`~/.dsh/logs` + `dsh-prompt`）；`dsh-log@0.2.1` 的接口契约由下游落盘实现对齐（本票只定「cacheDir 取什么、logDirName 取什么、写不进走什么」）。
3. **Desktop 宿主进程的 `process.cwd()` 具体值未取到**（我只拿到自己 pwsh 的 cwd）。若下游要依赖 §1.4 的回退根，需在宿主里实测确认；落盘方案不依赖它。
4. **`@deepseek-ai/dsh-storage` 在 profile 里缺失这件事**（§6.3）没被上游当问题处理；建议 #42 的断言顺带覆盖“peer 必须可解析或显式声明为宿主提供”。
