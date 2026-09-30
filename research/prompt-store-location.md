# dsh-prompt 自定义模板落盘位置

- 日期：2026-09-30
- 问题：dsh-prompt 的自定义模板到底存在哪（用户要确切目录/文件）。
- **结论（一句话）：只有一份，`$DSH_HOME/storages/dsh_prompt.json`（本机即 `C:\Users\辰辰洋洋\.dsh\storages\dsh_prompt.json`），所有装了本插件的 profile（desktop、web）共用；`cordis.patch.yml` 里没有任何模板数据。**
- 范围：只读调查，不改业务代码；不碰 deck、不 commit。本文件为 research 记录，存 `research/` 惯例位。

## 1. 落盘根目录解析规则

- `dsh-base` 统一装配存储栈（`dsh-0.1.7-rc.2/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml:166-177`）：
  - `storage-json` 的 `root: !!js dshHomePath('storages')`；
  - `storage-domain` 的 `backend: json`（无 `routes` 覆盖，`dsh_prompt` 走默认 json 后端）。
- `dshHomePath` 即 `$DSH_HOME` 下拼接（`dsh-home-paths/lib/index.js`：`resolveDshHome` 优先级 `显式配置 > $DSH_HOME > ~/.dsh`，`dshHomePath(...segs) = join(resolveDshHome(), ...segs)`）。
- json 后端 `Config` 只有 `root` 必填（`dsh-storage-json/README.md` Configuration 节；`lib/index.js:551`），`single` 布局单元文件为 `<root>/<name>.json`（同文件 `:159-179`，`openSingleUnit` 内 `join(root, descriptor.name + '.json')`）。
- 本插件声明（`lib/index.js:108-111`）：`defineDomain({ name: 'dsh_prompt', version: 0, layout: 'single', tables: customs/usage/pinned, global })`，经 `this.storageDomain.open(promptDomainSpec)` 打开（同文件 `:147`）。
- **规则一句话：`dsh_prompt`（single 布局）经默认 json 后端落盘到 `dshHomePath('storages')`，即 `$DSH_HOME/storages/dsh_prompt.json`，与 profile/entry 无关，各 profile 共用同一份。**

## 2. 确切位置与逐 profile 验证

- 实测全盘唯一（2026-09-30，`Get-ChildItem ~/.dsh -Filter dsh_prompt.json -Recurse`）：只有
  `C:\Users\辰辰洋洋\.dsh\storages\dsh_prompt.json`（16170 bytes，mtime 2026-09-30 11:03:25）。
- 文件内容形状（单布局整单元文档）：顶键 `unit/global/tables`；`unit={name:dsh_prompt, version:0}`；
  `tables={customs:25条, usage:30条, pinned:0条}`；`global={remoteEnabled, remoteSize, remoteOrientation, remoteDensity}`（远程偏好也在此文件，不在 settings）。
- 各 profile `cordis.yml` 均为 223 字节空入口（树由 bundle + `cordis.patch.yml` 合成），五个 profile 的 `cordis.yml`/`cordis.patch.yml` 经 `Select-String storage|dsh-prompt` **零命中**——没有任何 profile 覆盖 `storage-json.root`。
- 安装面（各 profile `package.json`）：`dsh-prompt@0.1.14` 只在 `desktop`、`web` 的 bundles/dependencies 里；`dsh-tui`、`headless`、`empty` 均未安装 → 这三个 profile 下本插件不运行、无各自份，也不会另建文件。

| profile | 装 dsh-prompt？ | 有独立 dsh_prompt.json？ |
|---|---|---|
| desktop | 是（0.1.14） | 否，共用 `$DSH_HOME/storages/dsh_prompt.json` |
| web | 是（0.1.14） | 否，同上同一份 |
| dsh-tui / headless / empty | 否 | 否（插件不运行） |

## 3. loopback 与远程浏览器（UU 远端）写到哪、跨不跨重启

- loopback/non-loopback 是 **Host settings API（settings namespace）** 的概念：loopback 浏览器经该 API 的写持久到 `$DSH_HOME/cordis.patch.yml`，非 loopback 页仅进程内（`dsh-client-ui-theme/README.md` Summary + Preference persistence 节；注意是家目录级 `cordis.patch.yml`，不是 profile 级）。
- **该区分不适用于自定义模板**：customs 走 `storage-domain → json 后端 → 宿主进程内文件写`（每次写原子发布：同目录 tmp + fsync + rename，`dsh-storage-json/lib/index.js:10-36`），不经 settings API。
- 读写入口是宿主侧 HTTP 桥 `ctx.webServer.register({ kind: 'prefix', path: '/_dsh/dsh-prompt' })`（`lib/index.js:1025,1070`，路由表 `:403-411`，`customs/put/delete` 等 `:936-954`），client 经同源 fetch 调用（`lib/index.js:7-9` 注释）。因此**只要请求能到达宿主进程（本机 loopback 或 UU 远端页面同源回连），写的是宿主磁盘上同一份 `dsh_prompt.json`**，与浏览器在哪无关。
- 跨重启：是，文件即真相；重启后 `open` 重新 `loadAll` + schema 校验（`dsh-storage-domain/lib/index.js:355-398`）。
- 已知限制（`lib/index.js:12-14` 注释 + 上游 README）：无跨进程写锁，desktop 与 web 双进程同开同写同一文件时 last-write-wins；`domain/changed` 只进程内可见，对端需重读。

## 4. 备份/恢复要拷哪几个文件

- 只需 **1 个**：`$DSH_HOME/storages/dsh_prompt.json`（本机 `C:\Users\辰辰洋洋\.dsh\storages\dsh_prompt.json`）——customs + usage + pinned + global（远程偏好）全在里面。
- 不需要：各 profile 的 `cordis.patch.yml`（本插件的 loader 条目只是 `- insert: {id: dsh-prompt, ...}`，见本仓 `cordis.patch.yml` 全文 7 行，无模板数据，重装自动补回）；`settings.yaml`（模板数据不在里面）。
- 恢复操作：先停掉所有宿主进程（desktop/web，防 last-write-wins 回写覆盖），拷回文件；`unit.version` 须与插件 spec `version: 0` 一致，否则 `open` 报 `version-mismatch` 拒读。

## 来源清单（每个结论的一手落点）

- 根规则：`dsh-0.1.7-rc.2/…/dsh-base/cordis.patch.yml:166-177`（root/backend 装配）；`dsh-home-paths/lib/index.js`（`resolveDshHome`/`dshHomePath`）；`dsh-storage-json/lib/index.js:159-179,551`（single 文件名/Config）；`lib/index.js:108-111,147`（本插件 domain 声明/open）。
- 原子持久：`dsh-storage-json/lib/index.js:10-36`（tmp+fsync+rename）。
- HTTP 桥：`lib/index.js:403-411,936-954,1025,1070`。
- 实测：`C:\Users\辰辰洋洋\.dsh\storages\dsh_prompt.json`（16170 B，mtime 2026-09-30 11:03:25；25 customs/30 usage/0 pinned）；全盘唯一；五 profile patch 零命中 storage 配置；`desktop`/`web` 的 `package.json` 含 `dsh-prompt@0.1.14`，其余三 profile 无。
- loopback 定义：`dsh-client-ui-theme/README.md` Summary + Preference persistence（loopback→`$DSH_HOME/cordis.patch.yml`；non-loopback→process-local）。
