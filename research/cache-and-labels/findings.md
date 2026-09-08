# 存储与标签现状调查 findings（issue #18）

- 日期：2026-09-05；方法：只认一手来源（DSH checkout 源码、已安装插件产物、本仓库源码、~/.dsh 实盘文件）。
- 范围：只回答“怎么做”的前置事实，不做产品决定（决议归后续会话 / T2 定稿）。
- 本插件现状一句话：无 host 侧（lib/index.js 为 no-op），全部状态在浏览器 localStorage；要进任何磁盘缓存目录，必须新增 host 侧。

## 0. 结论速览（事实，非决议）

1. “DSH 默认缓存目录”有两个不同东西：官方存储栈根 `storages/`（schema 校验的 domain 数据，§1.1A）与无官方管理的 `cache/<plugin>/` 自建缓存惯例（§1.1B）。customs/usage 这类结构化小数据在官方体系里归前者。
2. Host 写 API 是 `ctx.storageDomain.open(spec)`（§1.2）；client 无文件 API，调 host 靠 Typert Remote（§1.3A）或 HTTP `/_dsh/<plugin>/…`（§1.3B）。
3. localStorage 共 6 个键（§2）；标签是三套拼起来的（预制 domain / 自定义单 tag / 预制 action 数组），没有统一 label 概念（§3.6）。
4. 直接切换可行，schema 草案见 §4；unit 名必须符合 `^[a-z][a-z0-9_]*$`（连字符非法）。

## 1. DSH 默认缓存目录与读写 API

### 1.1 目录位置：先分清两个目录

家目录解析（node_modules/@deepseek-ai/dsh-home-paths/lib/index.js）：resolveDshHome()（L73）优先级为显式配置 > $DSH_HOME > ~/.dsh；dshHomePath(…segments)（L82-83）做拼接。本机实测 $DSH_HOME 即 ~/.dsh。

表 1——两个目录对比：

- A. <home>/storages/：官方存储栈根（storage-json 的 root，见下）。写者：经 storage-domain 的 host 插件。实证：message_feedback.json（1093B）、session_projcache.json（32MB）、session_projcache/sessions/（2985 个文件）。
- B. <home>/cache/<plugin>/：无官方注册与管理，插件自建惯例。写者：dsh-vision-router（host 侧 node:fs 直写）。实证：全目录唯一内容 cache/vision-router/live-models.json。

A 的挂载（node_modules/@deepseek-ai/dsh-base/cordis.patch.yml L145-156；dsh-base 是各 profile 共享底座，web profile bundles 首项即 @deepseek-ai/dsh-base）：

  - id: storage（L145，枢纽 ctx.storage）/ storage-json（L148，root: !!js dshHomePath('storages')，L151）/ storage-domain（L153，backend: json，L156）。

storage-json 的配置面只有 root（必填，无 cwd 回退；按需 0o700 创建；无配额/清理/布局覆盖项）——node_modules/@deepseek-ai/dsh-storage-json/README.zh.md L36、L50。

B 的写法（~/.dsh/profiles/web/node_modules/dsh-vision-router/lib/live-model-discovery.js L65-66）：liveModelCachePath() 返回 path.join(dshHome, 'cache', 'vision-router', 'live-models.json')。注意 vision-router 自己重实现了一份 resolveDshHome（lib/doctor.js L25-27），而官方包统一用 @deepseek-ai/dsh-home-paths——外部插件没有唯一的 blessed import，这是现状。

### 1.2 Host 写 API：ctx.storageDomain（官方正道）

来源：node_modules/@deepseek-ai/dsh-storage-domain/README.zh.md（“本层只面向宿主侧”，“没有数据迁移——已存版本与 spec 不同会在打开时拒绝”）。

最小可运行证据链（消费范例 dsh-message-feedback，node_modules/@deepseek-ai/dsh-message-feedback/lib/index.js）：

  - L9：import { defineDomain, domainTable } from @deepseek-ai/dsh-storage-domain；
  - L71-75：defineDomain({ name: `message_feedback`, version: 0, tables: { sessions: domainTable(zodSchema) } })；
  - L240-244：static inject = [`storageDomain`, ...]；L246：schemastery Config；
  - L260-268：[Service.init] 里 await this.ctx.storageDomain.open(spec)，ctx.effect 释放函数里 await domain.close()，句柄 this.table = domain.table(`sessions`)；
  - 读（同步，内存为准）：requireTable().get(sessionId)（L278）；写经本 domain 一条写入链串行，resolve 前已持久。

同构第二证据：node_modules/@deepseek-ai/dsh-session-projection-cache/lib/index.js L141。同包 README.zh.md L38：base 先挂 storage、storage-json（根 dshHomePath('storages')）与 storage-domain（backend: json）。

语义要点：读同步取内存权威状态；写在后端确认持久后才 resolve，并按序发进程内 domain/changed（跨进程不可见，属已知限制）。失败码稳定：already-open / facet-unsupported / invalid-record / missing-key / closed，后端 version-mismatch / malformed-medium / backend-not-found 透传。single 布局落盘 <root>/<unit>.json（整单元文档，实盘 message_feedback.json 形状 {unit:{name,version},global,tables}）；per-record 布局落盘 <root>/<unit>/<table>/<key>.json（形如 {version,record}，实盘 session_projcache/sessions/*.json）。空 per-record 树可从同名单文件播种（storage-json README L58）——这解释了 session_projcache.json 与 session_projcache/ 并存：是预期行为，不是损坏。落盘是原子替换（同目录 tmp + fsync + rename；实盘旁证：storages/ 下曾出现 .<uuid>.tmp 临时文件）。

### 1.3 Client 如何读写 host 侧

client（浏览器）没有文件 API。两条现成桥（均为一手源码）：

A. Typert Remote（结构化调用，customs/usage 应走此桥）：host 侧 class X extends TypertRemoteService ＋ @Remote(`put`) 装饰器（msg-feedback L7 引入、L188-199 三个方法装饰、L256 super(ctx, `messageFeedback`)）→ client 侧 await this.ctx.remote.messageFeedback.put({...})（node_modules/@deepseek-ai/dsh-client-ui-message-feedback/lib/client.js L188 put / L206 delete / L227 list；其 README.zh.md L42：变更经 ctx.remote.messageFeedback 提交，put/delete 携带 version 做比较并交换）。

B. Host HTTP 路由（大流量/诊断类）：client fetch('/_dsh/vision-router/model-capabilities')（vision-router lib/client.js L2551；同文件 L1144/L2995/L3007/L3026/L3056/L4089 皆为 /_dsh/vision-router/…）。

C. 只读投影（列出以完备，与本需求无关）：useProjection(`sessionStats`)（dsh-usage-statistics-panel lib/client.js L31411；L31314 注明官方主数据源）。

本插件 client 上下文现状：src/client/index.ts L19 inject = ['slots', 'inputTriggers']，package.json dsh.client.inject 仅声明 client-runtime 与 ui-slots。@deepseek-ai/dsh-client-store 只是 zustand/immer 内存状态（其 package.json 描述原话），不持久。

### 1.4 卸载重装是否保留

- 官方装配语义只管代码：本仓库 cordis.patch.yml 头注“dsh plugin add 自动装配…dsh plugin remove 时自动移除”——移除的是 bundle 条目。
- 卸载残留形态实证：~/.dsh/profiles/web/cordis.patch.yml L2-4 对已卸载的 dsh-im-companion 留 disabled: true 条目阻断自装配——只动装配，不动数据。
- 未找到任何“卸载清理 storages/cache/localStorage 数据”的代码或文档（负向发现）。事实：磁盘数据在卸载后保留；重装后同名 domain 可重新打开（同版本）。localStorage 系浏览器 origin 级（现 GUI origin http://127.0.0.1:30000）：DSH 卸载重装不碰浏览器数据（推理，已标注）。

### 1.5 多 profile 是否隔离

- 不隔离（storages 侧）：root: dshHomePath('storages') 无 profile 分段；desktop 与 web 的 cordis.patch.yml 均无 storage 覆盖（grep 无命中）；default/desktop/web 三 profile 共享同一 <home>/storages。profile 差异只在 bundles 组合（web package.json dsh.profile.bundles 含 dsh-prompt）。
- cache/ 同理无 profile 分段。localStorage 按浏览器 origin 隔离，不按 DSH profile 隔离：同一 GUI origin 下切 profile，键空间相同（推理，已标注，待一行实测确认，见 §5）。

### 1.6 容量与清理策略

- storage-json：无配额、无驱逐、无过期（配置面仅 root，§1.1）。
- session_projcache：只有写入节流（writeEveryEvents＋writeIntervalMs 均必填，dsh-base patch L162-166），无删除策略；实盘 session_projcache.json 32MB（2026-09-05 仍在写入）＋2985 个 per-record 文件——可作“无上限会长大”的实证引用。
- vision-router 缓存自理 TTL：DEFAULT_LIVE_MODEL_FRESH_MS = 15min（L11）、STALE_MS = 24h（L12），超 stale 视为不存在（L377-388）；这是插件自理，不是平台策略。
- 坏记录策略：通不过校验的存量记录按 invalidRecords: 'backup-and-skip' 移为 <id>.json.bak.<时间戳>并记日志，下次写入重建（projcache README L67）。
- localStorage 约 5MB 系浏览器通用约束（Web 平台常识，非 DSH 源码；本插件单键 JSON 一次性写入，无分片）。

### 1.7 读写失败如何降级

- storage 栈：写失败抛 StorageError(code)（dsh-storage lib/index.js L20-38 的 StorageError 类）；projcache 选择 fail-soft（“失败会记录警告并让缓存保持陈旧，后续写入会自行修复”，其 README L57）；vision-router 写缓存失败仅 logger.warn（live-model-discovery.js L370-375，串行 saveTail 链不断）。
- 本插件 localStorage：全链路静默 try/catch——store.ts loadJSON（L17-25，异常回 fallback）、saveJSON（L26-28，异常吞掉）、loadLastUsed（L55-63）；smartstore.ts 同理（L32-64）。降级结果：读失败给默认值（空数组/{}/true/null），写失败丢写入无提示。直接切换必须补齐这一环（§4.4）。
## 2. 现有 localStorage 键空间清单

src/client/store.ts L9-14（头注 L3 只列前三键、漏了 lastUsed，以 L9-12 const 为准）：

1. dsh.prompt.customs —— CustomTemplate[]（{id('c'+base36), name, nameEn:'', domain:'执行', stage:'执行前', action:[], body, builtin:false, tag, createdAt}）。读 loadCustoms（L37），写 saveCustoms（L40-41）；增 addCustom（L160-171）、改 updateCustom（L173-183）、删 removeCustom（L185-193，删同步清 pinned）、复制预制 copyPresetToCustom（L195-200，tag 取源 domain）。缺省 []。
2. dsh.prompt.usage —— Record<templateId, number>。读 loadUsage（L44）；唯一写点 bumpUsage（L47-51，+1 并顺手写键 4）。+1 触点三处：面板 onPick（panel.ts L69-74，插入+计数+关面板）、/prompt onPick（trigger.ts L50-55）、智能插入 smartInsert（smart.ts L68-89）。用量只排序不显示。缺省 {}。
3. dsh.prompt.pinned —— string[] 有序数组，上限 MAX_PIN=5（L13）。loadPinned/savePinned（L64-69）、togglePin（L141-155，超限回 {ok:false}，面板弹 pinFull）、isPinned/canPinMore。缺省 []。
4. dsh.prompt.lastUsed —— 单个模板 id 字符串（非数组）。写在 bumpUsage 内（L49-50，三触点经此间接写）；读 loadLastUsed（L55-63）；唯一消费是 smartCandidates 最近槽（match.ts L63-68）。缺省 null。
5. dsh.prompt.smart —— '1'/'0' 字符串（smartstore.ts L27）。isSmartEnabled（L32-38，缺键=开）、setSmartEnabled（L40-44，写后广播 enabledListeners，设置页与悬浮卡实时同步）、onSmartEnabled 订阅。
6. dsh.prompt.smartPos —— {x:number,y:number}（smartstore.ts L28）。loadSmartPos（L51-60，类型校验）、saveSmartPos（L61-64）；拖拽落点＋视口 clamp（smart.ts）；读不到用右下角默认。缺省 null。

内存态（非持久，不进迁移清单）：smartstore.ts L12-24 输入桥 current: SmartInput＋订阅集合；L67-70 suppressDraft 插入抑制。MAX_BODY=1000（store.ts L14）是新增/编辑正文上限（panel 弹窗校验）。同门旁证：dsh-opencode-palette 同样 client-only localStorage（STORAGE_KEY='dsh.opencode-palette.v2'＋LEGACY_STORAGE_KEY 迁移复制，其 lib/client.js L7995-8027）——本插件尚无 legacy 键，无历史包袱。

## 3. 现有标签机制清单

### 3.1 三套分类共存（没有统一 label）

- domain（领域）：templates.ts L7 Domain 联合类型，4 值（思考框架/学习/工程/执行）。仅预制；24 条分布 10/3/4/7（§3.5）。
- stage（阶段）：templates.ts L8 Stage，4 值（执行前/执行中/执行后/任意）。预制用；自定义新建硬编码 stage:'执行前'（store.ts L160-171）；面板 tabs（panel.ts L24）没有“任意”项。
- action（动作）：templates.ts L10-18 action: string[] 自由字符串。仅预制；16 个 distinct 值：拆解/检验/归因/决策/理解/路线/概念/考验/审查/测试/重构/解读/启动/固化/记录/复盘。自定义新建 action:[]。
- tag（自定义单标签）：store.ts L31-34 CustomTemplate.tag: string，自由文本单值，缺省 '自定义'。仅自定义。

“label 与场景标签好像一个意思”：代码里没有 label 字段（label 只出现在 slot 注册的 UI 文案，index.ts）。CONTEXT.md 术语表把 domain/stage/action 统称“场景标签”；自定义的 tag 与其同名不同物——这就是记不清的根因，属实。

### 3.2 展示：displayTag（store.ts L81-85）

预制取 domain，自定义取 tag || '自定义'。这是唯一的展示收敛点。设置页（compact=false）行内有勋章式 tag badge；悬浮浮层（compact=true）单行只显名称＋正文首行，无 badge（panel.ts 行组装 compact 分支）。

### 3.3 检索底座：templateHaystack（store.ts L87-91）

(name + nameEn + body + domain + stage + action.join + tag).toLowerCase()——面板搜索与 /prompt 共用同一函数，改一处两处生效。

### 3.4 筛选与排序触点

- 面板 TemplateBrowser（panel.ts L135）：stage tabs（L24：all/执行前/中/后＋CUSTOM_TAG='自定义'纯自定义 tab，L26）→ domain 行筛选（L25：all＋4 domain，用 displayTag 比对——自定义按其 tag 文本命中 domain 名时才会出现）→ 搜索（haystack）→ 排序（compact ? sortedTemplatesBottomUp : sortedTemplates）。
- /prompt 触发源（trigger.ts L26-56）：剥离 /prompt 前缀后同一 haystack 过滤；order: 5（L39-48）；单项描述 displayTag + ' · ' + stage + ' — ' + body前42字；MAX_ITEMS=30（L12）；选中经 bumpUsage（含 lastUsed）。
- 排序（用量只排序不显示）：sortedTemplates（L93-113：置顶序→用量降序）用于设置页；sortedTemplatesBottomUp（L122-139：用量升序为主，置顶只做同分 tie-break）用于悬浮浮层；tie-break 预制按 final.md 原始顺序、自定义按 createdAt。
- 智能卡（smart.ts L143-146）：不走标签筛选，走评分；手动展开无命中时兜底 allTemplates().slice(0,3)（L145，恒为前 3 条预制）。

### 3.5 智能匹配与标签的关系（match.ts / words.ts）

- 词表 SMART_WORDS: Record<templateId, {strong, weak}>（words.ts L12-37）只覆盖 24 预制；文件头 L5 明示“自定义模板无词表（不做评分），仅经最近使用槽位进入候选”。
- 评分 strong×2+weak×1，阈值 SMART_THRESHOLD=2（match.ts L12，L28-36）；smartCandidates（L51-72）：跳过非 builtin（L55）、trim<2 与代码块内（L53-54，insideCodeBlock L38-44）直接空；取 top-2＋最近使用去重补 1（L63-68），不足不凑；排序=评分→用量（L59）。
- 插入 smartInsert（smart.ts L68-89）：光标处插入不覆盖，光标定位首个“：”后（firstFieldCaret，match.ts L74-78），bumpUsage＋抑制卡片重现（L87）。
- 事实结论：自定义模板在智能卡基本不可见（无评分、无兜底、无标签匹配），除非刚用过（lastUsed 槽）。

预制 domain 分布（templates.ts L20 起逐条计数）：思考框架 10（fp/socratic/deep/adversarial/decision/premortem/feynman/fivewhys/mece/bias）、学习 3（learnpath/concept/quiz）、工程 4（codereview/testdesign/refactor/explain）、执行 7（blindspot/snapshot/kickoff/prototype/plan/deviation/retro），合计 24。
## 4. 直接切换（不迁移）schema 草案（供 T3 照单实施）

前提事实：本插件无 host 侧，切换 = 新增 host 侧 ＋ client 改调 remote ＋ localStorage 降级为回退。用户已裁定不迁移旧数据：旧键原地保留、只读不写或直接弃用（T2 选其一，本票不选）。

### 4.1 Domain 声明

约束：unit 名须匹配 /^[a-z][a-z0-9_]*$/（dsh-storage lib/index.js L80），`dsh-prompt` 含连字符非法，用下划线：

  - name: `dsh_prompt`，version: 0（message_feedback 用 0；无迁移规则下 bump 版本即拒读旧数据，改 schema 必须手工处理）。
  - tables: customs（行 = §2-#1 形状原样，含 tag/createdAt；zod 转写时 domain/stage/action 沿用 templates.ts L7-8 联合类型，tag 非空字符串，body.length ≤ 1000 沿用 MAX_BODY）/ usage（行 = {id, count}，id 即模板 id）/ pinned（行 = {id, pos}，pos 为置顶序，替代有序数组）。
  - lastUsed 单值放 global 槽（single 布局有 global；per-record 用 global.json）。
  - 智能开关与悬浮卡位置（§2-#5/#6）：仍放 localStorage（纯本机 UI 偏好，无跨端意义），不进 domain。
  - 布局选 single：数据量小（customs 为手写量级），落盘 <home>/storages/dsh_prompt.json，形状与现 message_feedback.json 同构（{unit:{name,version},global,tables}）。

### 4.2 Host 侧（新增，照抄 §1.2 形态）

  - static inject = [`storageDomain`] → [Service.init] 里 open → ctx.effect 释放函数里 close（抄 msg-feedback L240-268）。
  - 暴露 TypertRemoteService（super(ctx, `promptStore`)）方法：listCustoms / putCustom / deleteCustom / bumpUsage / getUsage / getPinned / setPinned / getLastUsed（@Remote 装饰抄 L197-199）。写经 domain 写入链天然串行，顺带消除现 bumpUsage 的 read-modify-write 竞态。
  - patch 接线：host entry 进 cordis.patch.yml（bundle insert 形态抄本仓库现有文件）；client inject 追加对端（remote 命名空间由 host 名确定，抄 ui-message-feedback 依赖 dsh-typert-protocol 形态，其 package.json L56）。

### 4.3 Client 侧改动面

  - store.ts 的 load*/save* 改为 remote 优先：ctx.remote.promptStore.* 成功走 host，异常/缺失回退 localStorage（保留 §1.7 现有 try/catch 缺省语义）。
  - 排序/展示函数（sortedTemplates/BottomUp/displayTag/templateHaystack）不动——纯函数，只消费数据。
  - bumpUsage 的 lastUsed 副作用（L49-50）搬进 host bumpUsage 原子做（三触点行为保持一致）。
  - smart 开关与卡位置不动（仍 localStorage）。

### 4.4 失败与版本语义（抄官方，不发明）

  - version-mismatch → open 拒绝 → 回退 localStorage ＋ console.warn（抄 projcache“日志领先、缓存跟随”与 vision-router warn-only，不静默丢）。
  - invalid-record（用户手改坏文件）→ 预期走 backup-and-skip（projcache README L67），以 T3 实测为准。
  - 卸载重装文件保留（§1.4），同版本直接复用；多 profile 共享同一份数据（§1.5）；无平台容量上限（§1.6）。以上三条是否可接受，T2 定，本票只列事实。

## 5. 未验证事项（T3 前闭环，不影响本票验收）

1. 同一 <home>/storages 被 Desktop 与 Web 双进程同时打开时的写语义（domain/changed 跨进程不可见已确认；双写是否 last-write-wins 未测）。
2. ctx.remote.* 对第三方同包 host+client 声明的最小可运行例子待 T3 写出（本票只验证到官方 client 包在用）。
3. localStorage 同 origin 多 profile 共享为推理（一行实测可确认）。
4. /_dsh/… 路由的 host 注册点只验证了 client 调用形态，host 侧注册代码未定位（如选 HTTP 桥需补）。

## 附：证据源清单

- DSH checkout：D:/0Tools/DSH Desktop/resources/app.asar.unpacked/node_modules/@deepseek-ai/{dsh-home-paths（lib/index.js L73/L82-83）, dsh-base（cordis.patch.yml L141-166）, dsh-storage（lib/index.js L20-38/L80）, dsh-storage-json（README.zh.md L36/L50/L58/L88）, dsh-storage-domain（README.zh.md 使用本包/失败/限制三节）, dsh-session-projection-cache（lib/index.js L141，README.zh.md L38/L57/L67）, dsh-message-feedback（lib/index.js L7/L9/L71-75/L188-199/L240-268/L275-279）, dsh-client-ui-message-feedback（lib/client.js L188/L206/L227，README.zh.md L42）, dsh-client-store（package.json 描述）}。
- 已装插件：~/.dsh/profiles/web/node_modules/{dsh-vision-router（live-model-discovery.js L11-12/L65-66/L341-388，client.js /_dsh/ 调用群；doctor.js L25-27）, dsh-opencode-palette（client.js L7995-8027）, dsh-usage-statistics-panel（client.js L29702-29784、L31314-31411）}。
- 实盘：~/.dsh/storages/{message_feedback.json, session_projcache.json（32MB，2026-09-05 仍在写入）, session_projcache/sessions/（2985 文件，已抽样）}、~/.dsh/cache/vision-router/live-models.json、~/.dsh/profiles/{web（cordis.patch.yml L2-4）, desktop}/cordis.patch.yml。
- 本仓库：src/client/{store.ts, smartstore.ts, templates.ts, panel.ts, trigger.ts, smart.ts, match.ts, words.ts, settings.ts, index.ts}、lib/index.js（no-op host）、cordis.patch.yml、CONTEXT.md。
