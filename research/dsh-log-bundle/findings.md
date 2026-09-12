# dsh-log 客户端进 bundle 的可行性验证（issue #47）

```text
issue:      FeatherHunter/dsh-prompt#47
版本:       dsh-log@0.2.1（包本体解在 .tmp-verify/dsh-log/package/）
构建工具:   tsdown v0.22.14 (rolldown v1.2.8)，Node v24.19.0，Windows
实验目录:   .tmp-verify/exp47/（gitignore，不在仓库改动清单里）
```

## 0. 结论（二选一）

**走 import 形态。**一句话理由：`dsh-log/client` 被 tsdown 完整内联进 `lib/client.js`，
产物里 `node:` 前缀出现 **0 次**、内部 `require()` 调用 **0 次**（连 factory 收到的 `require`
都没被碰过），套在现有 `window.__ModuleLoader__.load({ id, factory })` 壳里能在 node 里跑起来，
建日志器、调 `log()`、经电话转发、对账开关全部通过（18/18 断言）。

`INTEGRATION.md` 里那句「直接 import 是推荐形态，但还没有第二个插件真机验过」在本插件上得到验证：
**推荐形态可用，不必退回文本拼接。**

## 1. 验证方法

1. 造最小入口 `.tmp-verify/exp47/entry.ts`：`import { createClientLog } from 'dsh-log/client'`。
2. 用一份**独立** tsdown 配置 `.tmp-verify/exp47/tsdown.exp.config.ts` 打包：除 `entry` / `outDir` 外，
   其余选项（`format: 'cjs'`、`platform: 'browser'`、`dts`、`sourcemap`、`clean`、`define`、
   `deps.neverBundle` = `CLIENT_EXTERNALS`、`deps.alwaysBundle`、`outputOptions` 的 `entryFileNames` /
   `banner` / `footer` / `intro` / `codeSplitting`）与仓库 `tsdown.config.ts` **逐字一致**。
   仓库 `tsdown.config.ts` 全程未被改动（见 §5 的 `git status` 自查）。
3. 裸说明符 `dsh-log/client` 走真实解析：`.tmp-verify/exp47/node_modules/dsh-log` 是指向
   `.tmp-verify/dsh-log/package` 的 junction，因此命中的是包自己的 `exports` 映射（`./client` → `./dist/client.js`）与
   `dist/client.js` 里那两行相对 import（`./config.js`），和真机 `npm i dsh-log` 后的解析路径同形。
4. 断言 `lib/client.js`（本次为实验产物）里不含 `node:` 前缀的 import / require，且不含 node 内置模块裸引用。
5. 在 node 里模拟 `window.__ModuleLoader__.load` 把 factory 跑起来，取 `createClientLog`，建日志器、调 `log()`。

## 2. 实验 1：最小入口（只有 dsh-log/client）

命令与原始输出：

```text
$ npx tsdown --config .tmp-verify/exp47/tsdown.exp.config.ts
ℹ tsdown v0.22.14 powered by rolldown v1.2.8
ℹ config file: D:\dsh-plugin\dsh-prompt\.tmp-verify\exp47\tsdown.exp.config.ts
ℹ entry: ./entry.ts
ℹ tsconfig: ..\..\tsconfig.json
ℹ Build start
ℹ out2\client.js      19.42 kB │ gzip: 5.04 kB
ℹ out2\client.js.map  40.01 kB │ gzip: 9.70 kB
ℹ 2 files, total: 59.42 kB
✔ Build complete in 17ms

[exit code: 0]
```

内联证据：源 `dist/client.js` 是 460 行 / 14 kB 量级的 ESM，产物 19.42 kB 单文件，且它是两个模块合成的
（`//#region` 注释同时出现 `dist/config.js` 与 `dist/client.js`），sourcemap 的 sources 也印证
`config.js` 被一起内联（`dist/client.js` 第 10、11 行的两处 `from "./config.js"` 没有变成外部 require）。

产物外壳（首 4 行 / 末 4 行）：

```text
$ Get-Content .tmp-verify/exp47/out2/client.js -TotalCount 4
window.__ModuleLoader__.load({
	id: "dsh-prompt",
	factory: (require) => {
		var module = { exports: {} };

$ Get-Content .tmp-verify/exp47/out2/client.js -Tail 4
		exports.probe = createClientLog;
		return module.exports;
	}
});
```

## 3. 断言：产物里没有 node 依赖（issues #47 判据第 2 条）

```text
$ node: 前缀匹配数
0

$ require( 调用数
0

$ ^import/export ... from 残留数
0

$ 裸 process 匹配数
0
```

（原始命令与逐条输出见 §5「断言汇总」。`require(` 计数为 0 的含义：本入口没引用任何
`CLIENT_EXTERNALS`，所以连外部包都不需要；factory 的 `require` 参数一次都没被调用——
这一点由 §4 的加载测试以「传入的 require 桩抛错却从未被触发」独立复核。）

## 4. 加载与调用实测（issue #47 判据第 3 条）

脚本 `.tmp-verify/exp47/load-test.cjs`：`vm.runInThisContext` 执行产物 → 提供
`globalThis.window.__ModuleLoader__.load` 收集 `{ id, factory }` → 调 `factory(requireStub)` 拿 exports →
建日志器（四个依赖用替身：`host` 记调用、`timer` 记定时器、`storage` 用 Map、`broadcastLogSwitch` 计数）→ 调 `log()`。

```text
$ node .tmp-verify/exp47/load-test.cjs out2/client.js
PASS  window.__ModuleLoader__.load 被调用一次
PASS  loader id 为 dsh-prompt :: "dsh-prompt"
PASS  factory 是函数
PASS  factory 返回 exports 对象
PASS  require 未被调用（无任何外部依赖） :: []
PASS  exports.probe 是 createClientLog 函数
PASS  createClientLog(...) 未抛错 :: null
PASS  返回对象带 log()
PASS  返回对象带 flush()/setLogSwitch()
PASS  电话名以插件标识为前缀 :: {"logBatch":"dsh-prompt.logBatch","logExport":"dsh-prompt.logExport","logClear":"dsh-prompt.logClear","logGetSwitch":"dsh-prompt.logGetSwitch","logSetSwitch":"dsh-prompt.logSetSwitch"}
PASS  log("error", ...) 未抛错 :: null
PASS  log() 入队 1 条 :: 1
PASS  error 级直通，安排了立即刷盘定时器 :: pending=1
PASS  经 host.call 转发 logBatch :: "dsh-prompt.logBatch"
PASS  转发内容含该条日志 :: {"entries":[{"ts":1789222314573,"level":"error","event":"dsh-prompt.issue47.probe","fields":{"step":"load-test"}}],"droppedCount":0}
PASS  reconcileLogSwitch 返回 ok :: {"ok":true,"enabled":true,"sampleRate":1}
PASS  对账后写入 storage 的 dsws.debug :: {"enabled":true,"sampleRate":1,"rev":1}
PASS  对账后广播一次 :: broadcasts=1

结果: 18/18 项通过

[exit code: 0]
```

要点：电话名前缀跟着 `pluginId: 'dsh-prompt'` 走（5 个电话名正确派生），
`host.call` 收到的就是 `dsh-prompt.logBatch` —— 说明客户端这一半接上宿主侧 5 个电话就能闭合。

## 5. 实验 2：真实入口形状（dsh-log/client + 全部外部包）

真实插件 client 入口会同时 import react / react-dom / 两个 dsh client 包，所以再验一次混合形态：
`.tmp-verify/exp47/entry2.ts` 同时 import `dsh-log/client` 与 6 个外部包。

```text
$ npx tsdown --config .tmp-verify/exp47/tsdown.exp.config.ts   （同一配置文件的第二个 config 段）
ℹ out3\client.js      21.34 kB │ gzip: 5.64 kB
✔ Build complete in 20ms

[exit code: 0]

$ node: 前缀匹配数
0

$ 产物里的 require( 目标（去重）
require("@deepseek-ai/dsh-client-runtime/client")
require("@deepseek-ai/dsh-client-ui-slots")
require("react")
require("react/jsx-runtime")
require("react-dom")
require("react-dom/client")
```

结论：外部包**仍然外置**（`require` 保持，交给 ModuleLoader），`dsh-log/client` 被内联，两边互不干扰，
且没有因为混入 dsh-log 而漏进 `node:` 前缀。

## 6. 仓库自查（没把仓库改乱）

```text
$ git status --short
 M CONTEXT.md
 M package.json
 M src/client/i18n.ts
 M src/client/panel.ts
 M src/client/settings.ts
?? scripts/test-issue-37.cjs
?? scripts/wayfinder-chart.mjs
?? src/client/about.ts

$ git diff --stat tsdown.config.ts
（空 —— tsdown.config.ts 与 HEAD 一致）
```

以上 `M` / `??` 条目在本次验证开始**之前**就已存在（属于并行会话的在途工作），不是本次实验的产物；
本次实验的全部新增文件都落在 gitignore 的 `.tmp-verify/exp47/` 下。

过程如实记录：第一次实验曾临时把仓库 `tsdown.config.ts` 的 `entry` / `outDir` 指到实验入口、跑过一次
`npm run build:client`（产物 `.tmp-verify/exp47/out/client.js`，SHA256
`3322050759F72BCC97E435F5930305881580782D747533990C07A38522F658FF`，19434 字节）。
随后已 `git checkout -- tsdown.config.ts` 还原，并改用 §1 步 2 的独立配置复跑，
产物 `.tmp-verify/exp47/out2/client.js`（SHA256 `FAD16F707CC0E06C27469FC840D07145F3250ACED7A1F030D5BEB7449F20BFED`，19416 字节）。
两份产物逐行对比**只差 2 处注释**（`//#region` 里的模块路径，因两次 cwd 不同而不同），行为一致：

```text
$ Compare-Object (Get-Content out\client.js) (Get-Content out2\client.js)
		//#region ../dsh-log/package/dist/config.js          =>
		//#region ../dsh-log/package/dist/client.js          =>
		//#region .tmp-verify/dsh-log/package/dist/config.js <=
		//#region .tmp-verify/dsh-log/package/dist/client.js <=
```

## 7. 退路「文本拼接」的可行性与代价（issue #47 判据第 4 条）

**可行性：技术上能做，但在本仓它解决不了任何现存问题，反而更贵。**

先把两个仓的骨架差异说清（这是退路存在的前提）：

- `dsh-mattpocock-skills-deck` 的客户端产物是**手工拼块**的：`build.mjs` 用 esbuild 打出多块，
  再按 `kernel:log` 之类的标记把块文本拼进插件主文件闭包；所以它需要一个「裸声明体文本」而不是一个模块，
  于是有了 `scripts/derive-log-from-package.mjs`（把包源码 `src/client.ts` 用 esbuild 打成单文件、
  校验「无外部引用」、剥 `export`、追加实例化尾巴，落到 `scripts/generated/logKernel.derived.js`）。
  该仓**没有 `tsconfig.json`**（实测 `Test-Path tsconfig.json` = False），不受 TS 类型门禁约束。
- `dsh-prompt` 的客户端产物是 **tsdown 单文件 bundle**（本仓 `lib/client.js`）：模块边界由打包器管，
  没有「主文件闭包 + 手工拼块」这一层。所以本仓的「拼接点」只能落到**源码级**：构建前把包的声明体
  派生成本仓的一个本地模块，再由 `src/client/**` 正常 import。

若真要接退路，改动清单是：

1. 新增 `scripts/derive-log-from-package.mjs`（照兄弟仓同形）：从 `node_modules/dsh-log/dist/` 取
   `client.js` + `config.js` 文本 → 去掉 `client.js` 顶部那两行 `import ... from "./config.js"`（不去就是语法错误）
   → 去掉每行行首 `export` → 追加实例化尾巴（`createClientLog({ host, timer, storage, broadcastLogSwitch }, { pluginId: 'dsh-prompt' })`
   并按名 re-export）→ 落到 `scripts/generated/logKernel.derived.js`（放 `scripts/` 是因为 `src/client` 下有中文基线门禁）。
2. 改 `scripts/build.sh`：在 `npm run build:client` **之前**插一步 `node scripts/derive-log-from-package.mjs`。
3. 客户端代码从生成文件 import，而不是从 `dsh-log/client` import。
4. 生成物要么入库（每次升级包需重跑并对齐 diff），要么构建时生成（CI/本地都必须先跑派生，漏跑就是陈旧产物）。

代价与收益对比：

| 项 | import 形态（本票结论） | 文本拼接退路 |
|---|---|---|
| 需要 dsh-log 存在吗 | 需要（`dependencies` 声明，构建时安装） | **仍然需要**（要读它的 `dist` 文本才能派生），只是可降级到 `devDependencies` |
| 新增构建步骤 | 无 | 有（派生脚本 + `build.sh` 插一步） |
| 新增文件 | 无 | 一个生成物 + 一个派生脚本 |
| 包升级时的风险 | 打包器内联失败会**构建报错**（响亮） | 声明体形态变化 → 文本剥离静默变形（兄弟仓靠「产物里不得残留 `import` / `from './`」的断言兜底） |
| 类型 | 需一份 `dsh-log/client` 手写声明（见 §8） | **同样需要**一份声明（生成物是 `.js`），省不掉 |
| 唯一卖点「闭包里现成的四个名字原样传参」 | 不适用 | 本仓也没有这个场景：`host`/`timer`/`storage`/`broadcastLogSwitch` 本来就在自己的模块里现成可见 |
| 兄弟仓的 `INTEGRATION.md` 定位 | 「推荐形态」（此前无人真机验过） | 「留给第二个插件验证」 |

**判断**：本仓接拼接退路的唯一正当理由是「import 形态不通」。§2–§5 已实测 import 形态通（构建成功、
零 node 依赖、ModuleLoader 壳里可加载可调用），所以退路不启用。若未来出现 import 不通的具体形态
（例如包内出现 node 内置依赖、或 CJS/ESM 形态冲突），再按上面的四步走。

## 8. 落地到 #49 的两个具体代价（实测，不是猜测）

1. **`dsh-log` 不带类型声明**，import 形态下 `npm run typecheck` 会红。原始输出：

```text
$ npx tsc --noEmit --strict --target ES2023 --module ESNext --moduleResolution Bundler --lib ES2023,DOM --skipLibCheck --esModuleInterop .tmp-verify/exp47/entry.ts
.tmp-verify/exp47/entry.ts(3,33): error TS7016: Could not find a declaration file for module 'dsh-log/client'. 'D:/dsh-plugin/dsh-prompt/.tmp-verify/dsh-log/package/dist/client.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/dsh-log` if it exists or add a new declaration (.d.ts) file containing `declare module 'dsh-log/client';`

[exit code: 2]
```

  已实测：补一份本仓手写的窄声明（`.tmp-verify/exp47/shim/dsh-log-client.d.ts`，约 30 行，只声明
  `createClientLog` 与用到的几个方法）后同一条命令**通过**：

```text
$ npx tsc --noEmit ... .tmp-verify/exp47/shim/dsh-log-client.d.ts .tmp-verify/exp47/entry.ts
[exit code: 0]  （0 = 通过）
```

  所以 #49 需要连带产出：`dsh-log` 进 `dependencies` + 一份 `dsh-log/client` 的本地声明
  （放 `src/client/` 下随 `tsconfig.json` 的 `include: ["src"]` 自动生效）。这是 import 形态的**唯一**额外代价。

2. **包可得性已确认**（不用猜发布状态）：

```text
$ npm view dsh-log version dist.tarball
version = '0.2.1'
dist.tarball = 'https://registry.npmmirror.com/dsh-log/-/dsh-log-0.2.1.tgz'

[exit code: 0]
```

## 9. 未决项

1. 本实验用 junction 模拟 `npm i dsh-log`，真机安装路径未跑；但裸说明符解析（`exports` 映射 → `dist/client.js`
   → 相对 `./config.js`）与真机同形，且 §8.2 已确认 0.2.1 可装。
2. 未在浏览器 / 真机 DSH 宿主里跑（本票只到「node 模拟 ModuleLoader + 电话名派生正确」这一段）；
   真正的落盘链路（宿主 `createHostLog` + 五个电话 + HTTP 桥）是 #49 的活。
3. `dist/client.js` 里对 `globalThis.dswsLogHash` / `dswsLogTrunc` 的引用是可选增强（无则走包内 `hash8`），
   与本票结论无关，接 #49 时按需传。
