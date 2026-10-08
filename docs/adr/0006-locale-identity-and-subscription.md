# 语言身份-显示分离、订阅不写回、UI 语言与内容语言正交（#137 基建，承 #134 v3 定稿）

**状态**：accepted（2026-10-08，map「dsh-prompt 双语完整度」v3 定稿 + 第二轮对抗结论；#137 落地）。

## 背景

- 宿主有语言中枢 `ctx.locale`（`getSnapshot`/`subscribe`，唯一写入口 `setLocale`），并把 `document.documentElement.lang` 当唯一显示真值同步（`syncDocumentLanguage` 条件写）；切语言**不 reload**，`lang` 同步 live 变（见 `research/locale-sources/findings.md` §1-§3）。
- 本插件此前只有一处订阅（`panel.ts` 单点 MutationObserver），其余 5 面每帧裸 `getLang()`：切语言后 stale 到下次重渲染（§4）。
- 存量数据（自定义模板名/标签/置顶）是中文词表。若把身份键与显示串混同，翻一次英文就等于改写用户数据 —— 这是本 ADR 要提前封死的那条路。

## 决定

### 1. 身份-显示分离：具名 CanonicalKey + LegacyChineseStorageAdapter

- 模板/标签的**身份**是具名 CanonicalKey（稳定、语言无关），**显示串**由词表按当前语言解析；同一份数据在中文与英文下显示不同、身份不变。
- 存量中文值读时经 **LegacyChineseStorageAdapter** 归一（仅 trim + 大小写 + 预置/预制别名），**写回永远是原文**：用户数据里的中文值永不被改写，adapter 只在读侧工作、不做迁移写。
- 给 #141（铬切换）的契约：① 身份键与显示串分离，任何翻译不得回写存储；② 用户自造词（folksonomy）永不翻；③ 预置正文是内容资产、翻与否都不堵死架构（`nameEn` 钩子保留）。本票只落 seam，映射表由 #141 消费。
- **推翻 #70 的「禁区」注释**：面板顶部那排范围钮（`全部` 等）是**铬**（UI chrome），必须可翻 —— 被排除在翻译之外的只有用户词与预置正文。

### 2. 订阅不写回：宿主是 `html[lang]` 唯一主人

- 插件只读 `documentElement.lang` 与 `ctx.get('locale').getSnapshot().active`，**绝不写** `html[lang]`（宿主 `syncDocumentLanguage` 条件写，插件写即打架）；也不调 `setLocale` —— 本图不做插件级语言覆盖开关，写回时机根本不存在。
- 解析优先级：显式 override ＞ 已装宿主服务快照 ＞ `html[lang]` ＞ `navigator.languages/language` ＞ 默认 `zh`；无信号与任何异常一律 fail-soft 落默认、不抛。
- 订阅是**模块级单例**：全插件共用一个 `html[lang]` MutationObserver（＋至多一个宿主服务订阅），回调前与上次解析值比对去重（字典注册只 bump revision，不该引发重渲染），最后一个订阅退订即断开观察者与服务订阅。
- 宿主面经 `ctx.get('locale')` **免声明**读取后包成 `{ getActive, subscribe }` 适配器装进来（不往插件 `inject` 加 `'locale'`）；宿主面缺席（旧宿主/无 DOM 单测）时 `html[lang]` 兜底照样 live。

### 3. UI 语言与内容语言正交

- **UI 语言（铬）**只认宿主面与 `html[lang]`，跟随整机；**内容语言**（模板正文等）是另一条轴，将来独立开关、独立回落链，互不牵连。
- `bodyEn` 只留这一句：若将来做内容语言，回落链为 `bodyEn ?? body`；本图**不建字段**、不落任何存储键、不开任何开关。

## 后果

- 6 面（panel / settings / button / smart / picker / remoteInputSheet）统一「初值 `resolveLocale()` + `useEffect` 订阅 `subscribeLocale`」的同构写法；`settings.section` 的 label 闭包保持 per-call 取值。
- `i18n.getLang` 退化为兼容薄壳（内部走 `resolveLocale`，签名与默认值 `zh` 不变）；新面接入语言只需 `subscribeLocale`，不必再自挂观察者。源码级回归断言：`src` 全树零 `documentElement.lang` 写操作、零 `setLocale`。
- #141 的映射表与 #138 的永久门禁都建在这条 seam 上；P1 去 Adapter 化（身份直存）时，LegacyChineseStorageAdapter 是唯一要拆的读侧外壳。
