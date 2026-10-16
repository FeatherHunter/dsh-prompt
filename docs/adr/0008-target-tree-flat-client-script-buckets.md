# 目标目录结构：client 平铺 + 概念命名，scripts 按门禁三桶

**状态**：proposed（2026-10-17，原型票 [#170](https://github.com/FeatherHunter/dsh-prompt/issues/170) 推导 + `prototype/target-tree-170` 分支验证通过（`check.mjs --expect=current` PASS：33 行映射 / 25 待搬，同日实测）；待 T5 执行与用户终审后转 accepted。）

## 背景

- 全仓 TS 33 个文件（`src/client` 28 + `src/update/host` 5）全平铺，`scripts/` 67 个受控文件全平铺（52 test-cjs + 7 顶层 mjs + 3 update mjs + 2 helper cjs + 2 ps1 + 1 build.sh，据 #173 盘点；忽略的缓存不计），另有 git 忽略的残留。需求是推出自解释的目标树（地图 [#168](https://github.com/FeatherHunter/dsh-prompt/issues/168)，9 条规则）。
- 不可再分事实（F1–F8，完整推导见原型分支 `prototype-target-tree/TARGET-TREE.md` §1–§2）：① 双运行时（浏览器 bundle vs node host，`tsconfig.json` 含 DOM 且 exclude host，`tsconfig.host.json` 无 DOM 无 emit）；② 单产品单面（一个面板 + 设置页 + 触控面）；③ 调用呈星形（`panel`/`store` 被多方进口，反向纯模块只有 `pager`/`remote-grid`/`workspace-contract`）；④ 数据规模小（预制 24 条，`getTemplate` 线性找，workspace 反查 `Map` 已建）；⑤ 门禁三桶已判（常驻 3 + check 9 + 归档 41）；⑥ 术语与重命名映射已冻（`GLOSSARY.md` 33 术语，`docs/naming-169-spec.md` N1–N7 + 33 文件映射）；⑦ 产物不同构（`lib/index.js` 检入源码不构建，`lib/client.js` tsdown 单入口，`lib/update.js` esbuild，`check-lib-sync` 逐字节验收）；⑧ 无 CI（门禁全本地，`engines` 无旧 node 约束）。
- 权威范式输入（票 #172）：Vite 运行时切分、tRPC core/adapter、Effect 生成式命名；NOT 项含禁 feature-slice、禁 `shared/`、禁手写 barrel。

## 决定

### 1. `src/` 保持平铺，只换概念名（25 改 + 8 留）

- 不按技术分层、不按特性切片（理由见 §考虑过的选项）。文件名即索引（Effect 式），33 文件远未及拆分阈值（client 28 + host 5，各守运行时边界）。
- 25 个文件 `git mv` 到新名（全表见 `docs/naming-169-spec.md` §3，如 `store.ts → template-library.ts`、`match.ts → smart-score.ts`）；8 个保持（`index.ts`×2 装配器、`locale.ts`、`pager.ts`、`templates.ts` 共享类型家、`log/index.ts`、`bridge-log.ts`、`safe-values.ts`）。
- `getTemplate` 加 lazy `Map` id 索引（O(T)→O(1)，三行，不改行为）；标签不建倒排（T<200 时是投机抽象）。

### 2. `scripts/` 按门禁种类分三桶，不新建顶层 `tests/`

- `scripts/check-*.mjs`（常驻 3 + 提升 9，`.cjs`→`.mjs`，种类门合）、`scripts/update/`、`scripts/lib/` 工具链保持、`scripts/repro/`（归档 41 + 孤儿 76，搬家同改 `test:*` 路径）、`build.sh` 删。
- 纯模块单测只进 `src/**/__tests__/`（opt-in，先 `pager`/`remote-grid`/`smart-score` 三深 Module）。

### 3. 双 tsconfig 保留，barrel 政策不变

- 双配置是 F1 在类型层的防火墙（host 侧误用 `document`/`fetch` 当场红），合一即拆墙；`project references` 远期可选。
- 无 barrel：公共转口只 `package.json exports` 四项，模块间一律深路径相对 import；两 `index.ts` 装配器只挂载不转口。

### 4. 推翻条件（可证伪，随 T5 监控）

- P1：若出现 ≥2 组无法经既有核单向收敛的 import 循环，平铺被推翻，按循环边界拆子目录。
- P2：若自建模板 >200 条或 `smartCandidates` p95 >16ms，线性打分被推翻，上标签倒排索引。

## 考虑过的选项

- **技术分层**（controllers/services/repositories）——星形调用下切不出单向依赖，等于把深 Module 锯成 pass-through（Middle Man + Shotgun Surgery）。否决，解耦靠类型与 seam。
- **特性切片**（features/panel、features/remote…）——单产品无第二域，remote-sheet 复用 picker 数学（ADR-0005）、smart-card 与面板共用排序底座，切片边界全是合法横切。否决。
- **顶层 `tests/`**——与 `scripts/check-*` + `repro/` 形成第二真相源。否决，种类即位置。
- **合一 tsconfig / 手写 barrel**——拆防火墙 / 制造转口维护债。否决。

## 后果

- T5（票 #171）按本 ADR + `TARGET-TREE.md` §3/§12 + 命名映射 §3 执行：`git mv` + 同改 import + N6 文件头 + `check.mjs --expect=target` 全绿 + `npm run check` 全绿；顺序先重放上游 0.18.6 再搬目录（`lib/update.js` 漂移在 #173 已盘点回滚，未收口：当前基线不可直接作无差参照，待 T5 重放后再比对）。
- `prototype/target-tree-170` 分支永不合 main（throwaway）；本 ADR 是原型结论唯一的 main 落点。
- P1/P2 由 T5 与后续回归守住，触发时开新 ADR 修订本决定，不直接改树。
