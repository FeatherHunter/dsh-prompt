# Locale 来源 research — findings

> ticket：Locale 来源 research（宿主语言面 + html lang 行为 + 切语言是否 reload）
> 宿主版本：`@deepseek-ai/dsh-desktop` **0.2.0-rc.2**（`D:/DeepseekHarness/resources/app.asar`，`dsh/package.json` + 根 `package.json`）。
> 插件现状基线：`src/client/i18n.ts` `getLang()` + `panel.ts` 唯一订阅点。
> 约定：下面 `/app.asar/…` 指 `D:/DeepseekHarness/resources/app.asar/…`；`src/…` 指本仓 `D:/dsh-plugin/dsh-prompt/src/…`。

## 1) DSH 有无宿主语言面可读 — 有，`ctx.locale`（读只需 `ctx.get`，直连需声明 inject）

宿主语言中枢是包 `@deepseek-ai/dsh-client-locale`（client 插件，`inject = ["slots","remote","configForms"]`，
`/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js:1491-1495`），
在 `apply` 里 `ctx.provide("locale", locale)`（同文件 **L1526**）。它是普通 cordis 服务，
外部插件（dynamic plugin）同样可读，守卫规则在 runner 里写死：

- `/app.asar/dsh/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:327-343`
  `dynamicCordisContext`：`ctx.get(name)` 走 `readService(name, false)`——**免声明可选查找**；
  `ctx.xxx` 直连访问才要求 `inject` 声明（未声明即 `denyRead` 报错并指引补声明）。
- 同文件 **L595-601**：插件返回对象形式的自带 `inject` 会原样保留并成为守卫门禁；
  函数形式无声明位、够不到任何服务。

即：`(ctx as any).get('locale')` **零清单改动可用**（与本插件现有的
`ctx.get('sidebarRight')` / `get('sessions')` 等可选探测同构，见 `src/client/index.ts:163-167`）；
 recalled 要 `ctx.locale.bind/register/subscribe` 直连写法，则往插件返回体的 `inject` 加 `"locale"`
 （ chục internal 插件 precedent：`dsh-client-ui-conversation` 等 20+ 包的 cordis `inject` 均含 `"locale"`，
 如 `/app.asar/…/dsh-client-ui-conversation/lib/client.js:17895`）。

`ctx.locale`（= `LocaleRuntime` 实例）的公开面（均在 locale `lib/client.js`）：

| 方法/事件 | 语义 | 行号 |
|---|---|---|
| `getSnapshot() / getLocale()` | 不可变快照 `{active, locales, revision}`，uSES-safe，引用稳定到下次变更 | L1232-1252 |
| `subscribe(fn)` | 快照**任何**变化（切语言**或**字典注册）都通知，返回 unsubscribe | L1253-1265 |
| `bind(ns) / translate / resolveText` | 命名空间字典翻译；`resolveText` 专解包 manifest 类本地化文本 | L1414-1243 |
| `register(ns, dict)` / `addLanguage(def)` | 注册字典/语言包（插件也可注册自己的 ns；不建议碰全局语言目录） | L1297-1412 |
| `setLocale(id)` | **唯一写入口**：持久化 + 条件发布（见 §3；插件侧只读即可，不应调用） | L1266-1284 |
| `ctx.on("locale/change", snap)` | 仅**切语言**才发射；字典注册只 bump revision 不发射（防 boot 期风暴） | L1436-1449 |
| `LocaleFace` 经 `ctx.slots.installLocale(locale)` | slot 渲染的 `t` 座位即它背书；`getSnapshot/subscribe` 对 | L1181-1185, L1533 |

宿主持久化：`locale.preference` 字段经 settings 服务落盘（host 半 `lib/index.js` 注册
`locale` settings namespace；client 侧 `ctx.configForms.get("locale")` 为传输 scope）。
README 原话：loopback 页持久化到 `$DSH_HOME/cordis.patch.yml`，non-loopback 页只进程内有效；
`setLocale` 即使 id 与当前 active 相同也照写（active 可能是 provisional，必须把显式选择落盘，
L1267-1283 注释）。

## 2) English 下 `documentElement.lang` 是否为 en、由谁何时写入

**是，`en`（原样小写）。** 写入者是宿主 locale 包的 `syncDocumentLanguage`，唯一写点：

- `/app.asar/…/dsh-client-locale/lib/client.js:1167-1176`：
  ```js
  function syncDocumentLanguage(snapshot) {
    if (typeof document === "undefined") return;
    const language = snapshot.active === "zh" ? "zh-CN" : snapshot.active;
    if (document.documentElement.lang !== language) document.documentElement.lang = language;
  }
  ```
  只有 `zh` 被映射为 `"zh-CN"`，其余 active（含 `"en"`）**原样写** → English 下 `lang === "en"`。
  条件写（不等才写），字典-only 的 revision 不碰该属性（README Implementation/字典查找节亦明示）。
- 桌面壳侧印证：`/app.asar/lib/main.js:6819-6828` `resolveDesktopLocale` 同样
  `zh* → id "zh-CN"`、其余 → `"en"`；`resolveDesktopStartupLocale`（L6835-6843）偏好→OS 语言→`"en"`。

**何时写入（三次）：**

1. locale 包 `apply` 内 `sync()` 立即执行一次（L1536-1545：
   `const sync = () => { syncDocumentLanguage(snapshot); bound?.sync(...); }` + `sync();`），
   即 client 树挂载时 html lang 当场对齐 snapshot.active；
2. 订阅常驻：`ctx.effect(() => locale.subscribe(sync), "locale: language row and document synchronization")`
   （L1544）——之后每次 `publish` 都同步重写；
3. Host 偏好到达后纠偏：构造器先以浏览器 provisional 值建快照
   （L1213-1220 `resolveInitialLocale` ← `detectBrowserLocale` 全 tag 优先、再 primary subtag、fallback `"en"`，
   L1461-1489），再 `host.subscribe(adopt)` + 立即 `adopt(host)`（L1221-1226）。
   README 原话："The Host read runs after plugin activation … the result replaces the provisional value live."
   另有 native 壳的开机 bootstrap：preload 暴露 `__DSH_LOCALE__.read()/onChange`
   （`/app.asar/lib/preload-app.cjs:877-882`），main 侧 `localeBootstrap` 回 `{languages: systemLanguages,
   preference: readLocalePreference()}`（`/app.asar/lib/main.js:11634-11641`）。

 served 文档初始 `lang` 在 `main.js` 无字面量（搜 `lang=` 零命中），属"未知但无关"：
 locale `apply` 的首次 `sync()` 必覆盖。sandbox 内无法驱动真机 Electron 做 live DOM 实测，
 主会话可用一行在 DSH DevTools 复核：`document.documentElement.lang`（中文预期 `"zh-CN"`，英文预期 `"en"`）。

## 3) 切语言是否 reload、lang 是否 live 变

**不 reload；`lang` 同步 live 变；slot 渲染文案同步 live 换。** 三方证据：

- 切语言调用链：设置页 Language 行 `onSelect → setLocale(id)`
  （locale `lib/client.js:1079-1082`，行组件 L1056-1097，经 slot store 注入的 `setLocale`，
  行 store 定义 L1109-1123）→ `LocaleRuntime.setLocale`（L1278-1284）只做三件事：
  记 `preference`、条件 `publish`、写 settings scope——**无 reload、无 loadURL**。
  全文件搜 `reload` 仅命中注释里的 "preload IPC bridge"（L14），`location.reload` 零命中。
- 主进程侧 `localeChanged` 处理（`/app.asar/lib/main.js:11642-11651`）：
  解析新桌面字典 → `platformView.notifyLocaleChanged()`（仅 `send` 一下
  `dsh-platform:locale-changed`，L6126-6128）→ 刷新原生应用菜单。**无 `webContents.reload`、
  无 `loadURL/loadFile`**（该文件全部 8 处 load 系登录页/更新窗/platform 子视图，与语言切换无关，
  L6097/L7890/L9143-9587/L11309）。
- README 公开承诺（`dsh-client-locale/README.md`）：
  "User selections take effect immediately" / "The active locale is applied immediately …
  and the choice is written to the durable settings section" /
  "slot-rendered copy updates without a reload"（Known Limitations 对偶句：
  注册表持有文本才保持注册时语言，需重注册；slot 路径 live 跟随）。

 live 机制即 `publish`（L1443-1455）：快照引用替换 + `revision+1` + 同步调 `listeners`。
 `syncDocumentLanguage` 正挂在其中一个 listener（`sync`）里，故 **`lang` 属性在
 `setLocale` 同一同步任务里变更**，`MutationObserver(html[lang])` 可靠触发。
 内部插件消费 precedent：`dsh-client-ui-conversation:18014`
 `const disposeLocale = ctx.locale.subscribe(refreshViews)`；
 settings-general 行表按 `ctx.locale.getSnapshot().revision` 缓存失效（L1017-1039）。

## 4) 本插件现状缺口（决定订阅器必要性的直接依据）

- 唯一订阅点：`src/client/panel.ts:917-924` —— `TemplateBrowser` 内
  `new MutationObserver(onLang).observe(document.documentElement, {attributes:true, attributeFilter:['lang']})`。
  仅悬浮/全量面板跟随。
- 其余 5 处全是裸 `const lang = getLang()` per-render、无订阅，切换语言后** stale 到下次重渲染**：
  `src/client/settings.ts:205`（设置页）、`src/client/button.ts:185`（入口/dock）、
  `src/client/smart.ts:231`（智能卡）、`src/client/picker.ts:215`（挑选器）、
  `src/client/remoteInputSheet.ts:34`；另 `src/client/index.ts:187`
  `settings.section` 的 `label: () => tr(getLang(), …)` 是惰性闭包，能否 live 取决于宿主何时重解 label
  （宿主自家行表是 revision 感知的，插件 label 大概率被重解，但未实测，不可依赖）。
- `getLang` 本体（`src/client/i18n.ts:6-11`）：`documentElement.lang → navigator.language → 'en'`，
  `^zh` 判 zh 否则 en，异常落 `"zh"`。注意与两处上游默认值的分歧：
  宿主 `FALLBACK_LOCALE = "en"`（L1135）与 `detectBrowserLocale ?? "en"`；
  `dsh-plugin-update` 的 `normalizeLangTag` 未知/空 → `"zh"`
  （`node_modules/dsh-plugin-update/dist/lang.js:1-11`，本仓 `lib/client.js:5184-5191` 同文）。
  本插件历史行为偏中文（异常→zh），保持零回归应默认 zh（见 §6）。

## 5) 结论：LocaleResolver 要不要订阅器、写回时机

1. **必须要订阅器。** 切语言无 reload 且 `lang` live 变（§3），裸 `getLang()` 在除面板外的
   5 个面全部 stale。凡常驻面（settings/button/smart/picker/sheet）都需订阅后重渲染。
2. **绝不写回 `documentElement.lang`。** 该属性的唯一主人是宿主 `syncDocumentLanguage`
   （条件写）；插件写即与宿主打架。LocaleResolver 只读 + 订阅。
3. **优先读宿主面，html[lang] 作回落。** 有 `ctx.get('locale')` 时读
   `getSnapshot().active`（快照先于 DOM 同步完成？实为同一 publish 内先换快照引用再调 listener，
   故快照是更新鲜的一方）；无 ctx（单测/非 DSH 页）回落 html[lang] → navigator。
4. **写回时机只有一种：用户在插件自家 UI 里显式选语言**（若双语 map 决定提供插件级覆盖开关），
   此时调 `ctx.locale.setLocale(id)`（它自己管持久化+发布），**不要**自己写 DOM、不要自己 persist。
   无覆盖需求则根本没有写操作。

## 6) 给出设计：`resolveLocale` 纯函数 + 异步/订阅/重刷

```ts
// 建议落点：src/client/locale.ts（新建；i18n.ts 的 getLang 保留作兼容薄壳）
export type Lang = 'zh' | 'en';
export type LocaleOverride = 'zh' | 'en' | string | { getActive(): string; subscribe?(cb: () => void): () => void } | null | undefined;

/** 纯函数：显式覆盖 > html[lang] > navigator.languages/language > 默认（默认 'zh' 保历史行为）. */
export function normalizeLangTag(tag: unknown, def: Lang = 'zh'): Lang {
  if (typeof tag !== 'string') return def;
  const s = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!s) return def;
  if (s === 'zh' || s.startsWith('zh-')) return 'zh';
  if (s === 'en' || s.startsWith('en-')) return 'en';
  if (/^[a-z]{2,3}(-[a-z0-9]+)*$/.test(s)) return 'en'; // 已知 BCP47 非中文一律 en（同 update 包）
  return def;
}
export function resolveLocale(override?: LocaleOverride, def: Lang = 'zh'): Lang {
  if (override != null) {
    if (typeof override === 'object') {
      try {
        const v = override.getActive?.();
        if (typeof v === 'string' && v.trim()) return normalizeLangTag(v, def);
      } catch { /* fall through */ }
    } else if (typeof override === 'string' && override.trim()) {
      return normalizeLangTag(override, def);
    }
  }
  try {
    const d = (globalThis as any).document?.documentElement?.lang;
    if (typeof d === 'string' && d.trim()) return normalizeLangTag(d, def);
  } catch { /* ignore */ }
  try {
    const n = (globalThis as any).navigator;
    const list: string[] = [...(n?.languages ?? []), n?.language].filter((x: unknown) => typeof x === 'string' && (x as string).trim());
    if (list.length) return normalizeLangTag(list[0], def);
  } catch { /* ignore */ }
  return def;
}
```
- 与 `dsh-plugin-update/dist/lang.js:resolveLang` 同构（ precedence 同，唯默认 `zh` 取本插件历史；
  上游 `LocaleOption` 类型见 `dist/lang.d.ts:14`，含 `{getActive, subscribe?}` 服务形态——直接复用该接口形状，
  未来可直传 `ctx.locale` 适配器）。
- **异步**：无异步。宿主偏好到达是宿主侧异步（bootstrap read + settings scope adopt），
  完成后经同步 `publish` 推给订阅者；插件侧只需同步读快照 + 订阅，无需 `await`、无需轮询。
  首次 mount 读到的 provisional 值会被宿主纠偏推送覆盖——订阅能收到，无需特殊处理。
- **订阅（单例，仿 update 包 `subscribeLang` L5229-5290，保证多面共用一个 observer）：**
  ```ts
  export function subscribeLocale(cb: (l: Lang) => void, override?: LocaleOverride): () => void {
    // 1) override 带 subscribe → 转订它（并以 resolveLocale(override) 为初值去重）；
    // 2) 否则若 (ctx as any).get?.('locale') 存在 → ctx.locale.subscribe(() => cb(resolveLocale(serviceAdapter)))；
    // 3) 永远同时挂一个 html[lang] MutationObserver 作兜底（无 ctx 的单测/旧宿主照样 live）；
    // 4) 回调前与 last 比对，去重后才触发；返回的 unsubscribe 断开全部。
  }
  ```
  有 ctx 时的 serviceAdapter：`{ getActive: () => ctx.get('locale').getSnapshot().active,
  subscribe: (fn) => ctx.get('locale').subscribe(fn) }` —— `ctx.get` 免声明（runner L343），
  想用 `ctx.locale.xxx` 直连才需在插件 `inject`（现 `src/client/index.ts:34` /
  构建物 `lib/client.js: inject = ["slots", "inputTriggers"]`）追加 `"locale"`。
- **重刷策略**：各 React 面 `useState(resolveLocale()) + useEffect(() => subscribeLocale(setLang))`，
  替换现有单点 observer（panel.ts:917-924 可迁到共享订阅器）；`settings.section` label 闭包保持
  per-call 取值即可（宿主重解 label 即 live）。`app.boot` 日志的 `lang: getLang()`（index.ts:108）
  维持现状（一次性快照语义正确）。
- **禁区**：任何情况下不写 `documentElement.lang`；不调 `setLocale` 除非双语 map 明确要插件级语言覆盖开关；
  `navigator.*` 只读；异常一律落默认不抛（fail-soft 惯例）。

## 实测引用一览（主会话写票用）

- 宿主语言面可读：runner 守卫 `lib/client.js:327-343`（`ctx.get` 免声明）；
  服务提供点 locale `lib/client.js:1526`；快照/订阅 L1250-1265；事件 L1443-1449。
- `en → lang="en"`：`syncDocumentLanguage` L1172-1176；桌面壳 L6819-6828。
- 写入时机：首次 sync + 常驻订阅 L1536-1545；构造 provisional+adopt L1213-1226；
  preload 桥 preload-app.cjs L877-882；main IPC L11634-11651。
- 无 reload：locale 文件零 `location.reload`；main 切换处理 L11642-11651 无 reload/load；
  README "without a reload"（dsh-client-locale/README.md）。
- 插件侧证据：`src/client/i18n.ts:6-11`；`src/client/index.ts:34,108,163-167,186-188`；
  `src/client/panel.ts:785-786,917-924`；settings.ts:205；button.ts:185；smart.ts:231；
  picker.ts:215；remoteInputSheet.ts:34；上游订阅器 precedent `dsh-plugin-update/dist/lang.js`
  全文件 151 行（构建物 `lib/client.js:5184-5290` 同文，挂载消费示例 L9323-9325）。
- 未实测项（sandbox 到不了真机 Electron，已标替代验证法）：
  DevTools 执行 `document.documentElement.lang` 看中/英是否为 `"zh-CN"`/`"en"`；
  切语言时 Performance 录制确认无导航 + `lang` 属性同步翻转。
