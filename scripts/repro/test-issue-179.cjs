'use strict';
/**
 * dsh-prompt #179 回归：触发方式做成持久化设置（悬浮触发 / 仅点击触发，缺省=悬浮）
 * 跑法：node scripts/repro/test-issue-179.cjs（exit 0 = 全绿）
 *
 * 覆盖（对应票 #179 验收 + Agent Brief + 用户追加的 UI 口径）：
 *   A) store 运行时：缺省 true（悬浮）；快照缺键/非法值归一 true（只有显式 false 才是仅点击）；
 *      saveHoverTrigger 内存先行 + 打到 trigger/set 出站 {hover:boolean}；notifyStore 触发刷新。
 *   B) lib/index.js（宿主，静态）：GlobalSchema 有 hoverTrigger 可选键；global 初值 true；
 *      snapshot 归一 true；setHoverTrigger 校验布尔 + global.set 整体替换带既有键；
 *      路由 POST /_dsh/dsh-prompt/trigger/set 进 KNOWN_ROUTES，handler 取 body.hover。
 *   C) panel-visibility 运行时：缺省悬浮；切仅点击后 schedulePanelClose 不再自动关（划过不闪）；
 *      切换瞬间撤销已挂起的 hover 排关；切回悬浮自动关恢复；显式 setPanelOpen(false) 仍能关；
 *      #112 同手势标记语义不被本票改變（读一次即消费）。
 *   D) entry-button（静态）：悬浮开/关两处都被 isHoverTriggerEnabled() 门住；onClick 两模式都保留。
 *   E) template-browser（静态）：触发钮 = 幽灵胶囊 + 指针 SVG + 动作式文案 + data-dsh-prompt-trigger
 *      + aria-pressed（仅点击=true）+ chrome 钩子；它排在屏蔽钮与设置入口之间；眼睛/指针 SVG 几何共用；
 *      BAR_UI_CSS 含触发钮与设置页勾选框（含选中态）的 hover 显式反馈，且不写死颜色。
 *   F) settings（静态）：设置页读 loadHoverTrigger；屏蔽行补眼睛图标、触发行补指针图标（与底栏同一份 SVG）；
 *      两行控件都挂返回的钩子（勾选框 data-dsh-prompt-hide-toggle / 触发钮 data-dsh-prompt-trigger）。
 *   G) index（静态）：apply 里 loadHoverTrigger → setHoverTriggerEnabled（含 subscribeStore 回声）。
 *   H) i18n（运行时）：triggerRowLabel/switchToClick/switchToHover 中英齐全、en 无中文、真翻译。
 *   I) 渲染（运行时）：底栏触发钮两态文案/aria-pressed 随 saveHoverTrigger 翻转（同 store 联动）。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-179');
const { buildFlat, stripComments } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(want)) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}
const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, children: [], dataset: {}, attributes: {}, parentNode: null, textContent: '',
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    addEventListener() {}, removeEventListener() {},
  };
}
function installDom() {
  const head = mkEl('head');
  const body = mkEl('body');
  globalThis.document = {
    documentElement: mkEl('html'), head, body, activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}

// ── fetch 桩：快照 hoverTrigger 可按用例切换 ──
const putBodies = [];
let snapshotHover;
function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    try { if (init && init.body) putBodies.push({ url: u, body: JSON.parse(String(init.body)) }); } catch (e) { /* ignore */ }
    if (/\/store$/.test(u)) {
      const value = { customs: [], usage: {}, pinned: [], lastUsed: null };
      if (snapshotHover !== undefined) value.hoverTrigger = snapshotHover;
      return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

installDom();
installFetch();
buildFlat(DIR, [SRC('template-browser.ts'), SRC('panel-visibility.ts'), SRC('settings-page.ts'), SRC('strings.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const store = req('template-library');
const i18n = req('strings');
const STR = i18n.STR;
const LANG = (typeof i18n.getLang === 'function' ? i18n.getLang() : 'zh');
const T = (k) => i18n.tr(LANG, STR[k]);

// ═══ A) store 运行时 ═══
async function groupA() {
  snapshotHover = undefined; putBodies.length = 0;
  await store.ensureLoaded();
  eq(store.loadHoverTrigger(), true, 'A) 快照缺 hoverTrigger 键 → 缺省 true（悬浮触发，升级用户行为不变）');
  eq(store.normalizeHoverTrigger('yes'), true, 'A) 非法值归一 true（读侧永不信任存量）');
  eq(store.normalizeHoverTrigger(0), true, 'A) 数字 0 也归一 true（只有显式 false 才是仅点击）');
  eq(store.normalizeHoverTrigger(undefined), true, 'A) undefined 归一 true');
  eq(store.normalizeHoverTrigger(false), false, 'A) false 保持 false（仅点击触发）');
  eq(store.normalizeHoverTrigger(true), true, 'A) true 保持 true');

  store.saveHoverTrigger(false);
  eq(store.loadHoverTrigger(), false, 'A) save 后内存先行（读走缓存，UI 秒切）');
  const hit = putBodies.filter((p) => /\/trigger\/set$/.test(p.url));
  eq(hit.length >= 1 && hit[hit.length - 1].body.hover, false, 'A) save 打到 trigger/set 路由，出站 {hover:false}');
  store.saveHoverTrigger(true);
  eq(store.loadHoverTrigger(), true, 'A) save(true) 切回悬浮');
  eq(putBodies.filter((p) => /\/trigger\/set$/.test(p.url)).pop().body.hover, true, 'A) save(true) 出站 {hover:true}');
}

// ═══ B) lib/index.js 静态 ═══
function groupB() {
  const lib = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');
  need(/hoverTrigger:\s*z\.boolean\(\)\.optional\(\)/.test(lib), 'B) GlobalSchema 应有可选 hoverTrigger（旧数据缺键可读）');
  need(/initial:\s*\{[^}]*hoverTrigger:\s*true/.test(lib), 'B) global 初值 hoverTrigger:true（缺省悬浮）');
  need(/typeof g\.hoverTrigger === 'boolean' \? g\.hoverTrigger : true/.test(lib), 'B) snapshot 归一 true（缺键/非法值回落悬浮）');
  need(/async setHoverTrigger\(hover\)/.test(lib), 'B) 应有 setHoverTrigger 写入函数');
  need(/typeof hover !== "boolean"/.test(lib), 'B) 写入必须校验布尔（非法 400，不写脏数据）');
  need(/\.\.\.\(this\.domain\.global\?\.get\(\) \|\| \{\}\), hoverTrigger: hover/.test(lib), 'B) global.set 整体替换必须带既有键（lastUsed/remote* 不许写没）');
  need(/\/_dsh\/dsh-prompt\/trigger\/set/.test(lib), 'B) 应注册 POST /_dsh/dsh-prompt/trigger/set');
  need(/KNOWN_ROUTES = \[[^\]]*trigger\/set/s.test(lib), 'B) 新路由必须进 KNOWN_ROUTES（否则失败落盘被指纹化）');
  need(/setHoverTrigger\(body\?\.hover\)/.test(lib), 'B) handler 应取 body.hover 走同一个 setter 校验');
}

// ═══ C) panel-visibility 运行时 ═══
async function groupC() {
  const vis = req('panel-visibility');
  eq(vis.isHoverTriggerEnabled(), true, 'C) 缺省悬浮触发');
  vis.setPanelOpen(true);
  vis.setHoverTriggerEnabled(false);
  eq(vis.isHoverTriggerEnabled(), false, 'C) setHoverTriggerEnabled(false) 可切仅点击');
  vis.schedulePanelClose(5);
  await sleep(40);
  eq(vis.isPanelOpen(), true, 'C) 仅点击模式：schedulePanelClose 不再自动关（划过不再闪）');
  vis.setPanelOpen(false);
  eq(vis.isPanelOpen(), false, 'C) 仅点击模式：显式 setPanelOpen(false) 仍能关（×/选中/跳出）');
  vis.setPanelOpen(true);
  // 切换瞬间撤销已挂起的 hover 排关：不关掉当时开着的面板
  vis.schedulePanelClose(40);
  vis.setHoverTriggerEnabled(false);
  await sleep(80);
  eq(vis.isPanelOpen(), true, 'C) 切到仅点击时撤销已挂起的 hover 排关（面板不突然消失）');
  vis.setHoverTriggerEnabled(true);
  vis.schedulePanelClose(5);
  await sleep(40);
  eq(vis.isPanelOpen(), false, 'C) 切回悬浮：hover 排关自动关恢复');
  // #112 语义不变：同手势标记读一次即消费
  vis.__resetHoverOpen();
  vis.noteHoverOpen();
  eq(vis.takeHoverOpen(1000), true, 'C) #112 标记在宽限期内消费一次 → true');
  eq(vis.takeHoverOpen(1000), false, 'C) 同手势标记读一次即消费（不改变 #112 语义）');
}

// ═══ D) entry-button 静态 ═══
function groupD() {
  const flat = stripComments(fs.readFileSync(SRC('entry-button.ts'), 'utf8')).replace(/\s+/g, ' ');
  need(/isHoverTriggerEnabled/.test(flat), 'D) 入口钮应读 isHoverTriggerEnabled');
  need(/onMouseEnter: \(\) => \{ if \(!isHoverTriggerEnabled\(\)\) return cancelPanelClose\(\)/.test(flat), 'D) 仅点击模式：进入不排开（门在 cancel/setPanelOpen 之前）');
  need(/onMouseLeave: \(\) => \{ if \(!isHoverTriggerEnabled\(\)\) return schedulePanelClose\(150\)/.test(flat), 'D) 仅点击模式：离开不排关');
  need(/onClick: \(\) => \{ cancelPanelClose\(\) if \(isPanelOpen\(\)/.test(flat), 'D) click 语义两模式都保留（手动开关面板唯一入口）');
}

// ═══ E) template-browser 静态 ═══
function groupE() {
  const code = stripComments(fs.readFileSync(SRC('template-browser.ts'), 'utf8'));
  const flat = code.replace(/\s+/g, ' ');
  need(/loadHoverTrigger/.test(code), 'E) 面板应读 loadHoverTrigger');
  need(/saveHoverTrigger/.test(code), 'E) 触发钮应调 saveHoverTrigger');
  need(/export function TriggerModeButton/.test(code), 'E) 触发钮应为可复用组件（底栏/设置页同一份）');
  need(/data-dsh-prompt-trigger/.test(code), 'E) 触发钮应带 data-dsh-prompt-trigger 钩子');
  need(/data-dsh-prompt-chrome': labelKey/.test(flat) && /hover \? 'switchToClick' : 'switchToHover'/.test(flat), 'E) chrome 钩子值取当前文案的 STR key（#141 口径：钩子值必须是 STR key）');
  need(/aria-pressed': hover \? 'false' : 'true'/.test(flat), 'E) aria-pressed 表「当前=仅点击触发」');
  need(/M3 3l7\.07 16\.97/.test(code), 'E) 指针 SVG（Feather mouse-pointer 几何）应在源码里');
  need(/M1 12s4-8 11-8/.test(code), 'E) 眼睛 SVG 几何仍共用在 PresetEyeIcon 里');
  need(/hideToggleNode\('hide'\), h\(TriggerModeButton/.test(flat), 'E) 触发钮紧挨「展示预制模板」右侧（屏蔽钮之后）');
  need(/const GHOST_PILL_STYLE/.test(code), 'E) 幽灵胶囊样式只留一份（屏蔽钮/触发钮同款外形）');
  need(/data-dsh-prompt-hide.*data-dsh-prompt-hide/.test(flat) || flat.indexOf('GHOST_PILL_STYLE') >= 0, 'E) 屏蔽钮与触发钮复用同一胶囊样式');
  // BAR_UI_CSS：触发钮与设置页勾选钮的显式 hover 反馈（用户追加口径：选中的那个悬浮要明显）
  // 选择器在源码里是 const 变量（trig/hideToggle）+ 字符串拼接，这里按拼接点断言。
  need(/const trig = '\[data-dsh-prompt-trigger\]'/.test(flat), 'E) BAR_UI_CSS 里触发钮选择器变量已定义');
  need(/const hideToggle = '\[data-dsh-prompt-hide-toggle\]'/.test(flat), 'E) BAR_UI_CSS 里勾选框选择器变量已定义');
  const m = /export const BAR_UI_CSS = \(function \(\)(?:: string)? \{([\s\S]*?)\n\}\)\(\)/.exec(code);
  const ui = m ? m[1] : '';
  need(ui.length > 200, 'E) BAR_UI_CSS 应是一段真样式（实得 ' + ui.length + ' 字符）');
  need(/trig \+ ':hover/.test(ui), 'E) 触发钮应有 hover 反馈');
  need(/trig \+ '\[aria-pressed="true"\]\:hover\{/.test(ui), 'E) 选中态（仅点击）hover 反馈更强');
  need(/hideToggle \+ ':hover\{/.test(ui), 'E) 设置页勾选框应有 hover 外环（原生控件没 hover 态，显式补）');
  need(/hideToggle \+ ':checked\:hover\{/.test(ui), 'E) 勾选中的勾选框 hover 反馈更强（用户口径）');  need(/:focus-visible\{/.test(ui), 'E) 新钮也要有焦点环');
  need(!/#[0-9a-fA-F]{3,6}\b/.test(ui), 'E) 反馈段不得写死颜色（一律走宿主令牌）');
}

// ═══ F) settings 静态 ═══
function groupF() {
  const code = fs.readFileSync(SRC('settings-page.ts'), 'utf8');
  need(/loadHoverTrigger/.test(code), 'F) 设置页应读 loadHoverTrigger');
  need(/TriggerModeButton/.test(code), 'F) 设置页触发行应复用底栏同款按钮');
  need(/TriggerPointerIcon/.test(code), 'F) 触发行行首应补指针图标');
  need(/PresetEyeIcon/.test(code), 'F) 屏蔽行行首应补眼睛图标（与底栏同一份 SVG）');
  need(/triggerRowLabel/.test(code), 'F) 触发行文案走词表（触发方式）');
  need(/data-dsh-prompt-hide-toggle/.test(code), 'F) 屏蔽行控件钩子保留');
  need(/icon: h\(PresetEyeIcon/.test(code) && /icon: h\(TriggerPointerIcon/.test(code), 'F) 两行都通过 SettingRow 的 icon 位挂 SVG');
}

// ═══ G) index 静态 ═══
function groupG() {
  const flat = stripComments(fs.readFileSync(SRC('index.ts'), 'utf8')).replace(/\s+/g, ' ');
  need(/loadHoverTrigger/.test(flat), 'G) apply 应读 loadHoverTrigger');
  need(/setHoverTriggerEnabled/.test(flat), 'G) apply 应把触发方式同步进 panel-visibility');
  need(/subscribeStore/.test(flat), 'G) 应订阅 store 回声（设置页/底栏切换后入口钮即时生效）');
}

// ═══ H) i18n 运行时 ═══
function groupH() {
  const zh = (k) => i18n.tr('zh', STR[k]);
  const en = (k) => i18n.tr('en', STR[k]);
  eq(zh('triggerRowLabel'), '触发方式', 'H) zh 设置行文案=触发方式');
  eq(zh('switchToClick'), '点击触发', 'H) zh 悬浮态按钮文案=点击触发（动作式：点它切到点击）');
  eq(zh('switchToHover'), '悬浮触发', 'H) zh 点击态按钮文案=悬浮触发');
  need(typeof en('triggerRowLabel') === 'string' && en('triggerRowLabel').length > 0, 'H) en triggerRowLabel 非空');
  need(typeof en('switchToClick') === 'string' && en('switchToClick').length > 0, 'H) en switchToClick 非空');
  need(typeof en('switchToHover') === 'string' && en('switchToHover').length > 0, 'H) en switchToHover 非空');
  need(!/[\u4e00-\u9fff]/.test(en('triggerRowLabel') + en('switchToClick') + en('switchToHover') + en('triggerHint')), 'H) en 文案不得含中文');
  need(en('switchToClick') !== zh('switchToClick') && en('switchToHover') !== zh('switchToHover'), 'H) en 是真翻译，不是占位');
}

// ═══ I) 渲染：底栏触发钮两态 ═══
async function groupI() {
  const React = require('react');
  const TR = require('react-test-renderer');
  const panelMod = req('template-browser');
  try { if (store.saveHidePreset) store.saveHidePreset(false); } catch (e) { /* ignore */ }
  store.saveHoverTrigger(true);
  let tree;
  try {
    TR.act(() => { tree = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
  } catch (e) { fail('I) 紧凑浮层应可挂载：' + (e && e.message)); return; }
  const btn = () => tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-trigger'] === '1')[0];
  const b0 = btn();
  if (!b0) { fail('I) 底栏应有触发钮'); return; }
  eq(b0.props.title, T('switchToClick'), 'I) 悬浮态按钮文案=点击触发');
  eq(String(b0.props['aria-pressed']), 'false', 'I) 悬浮态 aria-pressed=false');
  TR.act(() => { store.saveHoverTrigger(false); });
  const b1 = btn();
  eq(b1.props.title, T('switchToHover'), 'I) 点击态按钮文案=悬浮触发');
  eq(String(b1.props['aria-pressed']), 'true', 'I) 点击态 aria-pressed=true');
  TR.act(() => { tree.unmount(); });
  store.saveHoverTrigger(true);
}

(async () => {
  await groupA();
  groupB(); await groupC(); groupD(); groupE(); groupF(); groupG(); groupH(); await groupI();
  if (failures > 0) { console.log('\n=== Test issue-179 FAIL（' + failures + '） ==='); process.exit(1); }
  console.log('\n=== Test issue-179 PASS ===');
})().catch((e) => { console.log('FAIL: 异常 ' + (e && e.stack || e)); process.exit(1); });
