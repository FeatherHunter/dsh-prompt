'use strict';
/**
 * dsh-prompt #165 回归：屏蔽预制（hidePreset 全局开关，缺省=屏蔽）
 * 跑法：node scripts/repro/test-issue-165.cjs（exit 0 = 全绿）
 *
 * 覆盖（对应票 #165 验收 + 原型 v3 定稿 + 用户铁律）：
 *   A) store 运行时：缺省 true；快照非法值归一 true；save 内存先行 + 打到 hide/set；
 *      applyHidePreset 只去内置、不改原数组。
 *   B) lib/index.js（宿主，静态）：snapshot 含 hidePreset 缺省 true；setHidePreset 校验布尔 +
 *      global.set 整体替换必须带既有键（lastUsed/remote* 不许写没，抄 bumpUsage 注释的教训）；
 *      路由 POST /_dsh/dsh-prompt/hide/set + 进 KNOWN_ROUTES。
 *   C) panel（静态）：列表过滤含 hide 分支；hide 时不渲染预制钮；底栏有屏蔽钮
 *      （data-dsh-prompt-hide + 动作式文案键 + 眼睛 SVG）；BAR_UI_CSS 导出 + 四类反馈 +
 *      焦点橙环 + 关闭危险 hover + 不得写死颜色；closeBtn 有边框；条数按可见池算。
 *   D) index（静态）：BAR_UI_CSS 走 styleOwnership 归属缝注入，apply 里调一次，不自建裸 style。
 *   E) settings（静态）：设置页有 Check 行绑定 loadHidePreset/saveHidePreset。
 *   F) i18n（运行时）：showPreset/hidePreset 中英齐全。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-165');
const { buildFlat, stripComments } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(want)) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

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

// ── fetch 桩：快照 hidePreset 可按用例切换 ──
const putBodies = [];
let snapshotHide;
function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    try { if (init && init.body) putBodies.push({ url: u, body: JSON.parse(String(init.body)) }); } catch (e) { /* ignore */ }
    if (/\/store$/.test(u)) {
      const value = { customs: [], usage: {}, pinned: [], lastUsed: null };
      if (snapshotHide !== undefined) value.hidePreset = snapshotHide;
      return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

installDom();
installFetch();
buildFlat(DIR, [SRC('template-library.ts'), SRC('strings.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const store = req('template-library');
const i18n = req('strings');
const STR = i18n.STR;

// ═══ A) store 运行时 ═══
async function groupA() {
  snapshotHide = undefined; putBodies.length = 0;
  await store.ensureLoaded();
  eq(store.loadHidePreset(), true, 'A) 快照缺 hidePreset 键 → 缺省 true（铁律：新用户默认屏蔽）');
  eq(store.normalizeHidePreset('yes'), true, 'A) 非法值归一 true（读侧永不信任存量）');
  eq(store.normalizeHidePreset(0), true, 'A) 数字 0 也归一 true（只有 true/false 是合法输入）');
  eq(store.normalizeHidePreset(false), false, 'A) false 保持 false');
  eq(store.normalizeHidePreset(true), true, 'A) true 保持 true');

  const mixed = [{ id: 'a', builtin: true }, { id: 'b' }, { id: 'c', builtin: false }];
  const out = store.applyHidePreset(mixed, true);
  eq(out.map((x) => x.id), ['b', 'c'], 'A) hide=true 去掉 builtin（无 builtin 键视为自定义）');
  eq(mixed.length, 3, 'A) 过滤不改原数组');
  eq(store.applyHidePreset(mixed, false).length, 3, 'A) hide=false 全留');

  store.saveHidePreset(false);
  eq(store.loadHidePreset(), false, 'A) save 后内存先行（读走缓存，UI 秒切）');
  const hit = putBodies.filter((p) => /\/hide\/set$/.test(p.url));
  eq(hit.length >= 1 && hit[hit.length - 1].body.hide, false, 'A) save 打到 hide/set 路由，出站 {hide:false}');
  store.saveHidePreset(true);
  eq(store.loadHidePreset(), true, 'A) save(true) 切回屏蔽');
}

// ═══ B) lib/index.js 静态 ═══
function groupB() {
  const lib = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');
  const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
  need(/hidePreset/.test(lib), 'B) snapshot 应含 hidePreset');
  need(/hidePreset.{0,80}\?\? true/.test(lib) || /typeof g\.hidePreset === 'boolean'/.test(lib), 'B) 缺键/非法值归一 true（缺省屏蔽，与客户端同判据）');
  need(/setHidePreset/.test(lib), 'B) 应有 setHidePreset 写入函数');
  need(/typeof .+hide.+!== 'boolean'/.test(lib) || /!== "boolean"/.test(lib), 'B) 写入必须校验布尔（非法 400，不写脏数据）');
  need(/\.\.\.(cur|this\.domain\.global\?\.get\(\))/s.test(lib), 'B) global.set 整体替换必须带既有键（lastUsed/remote* 不许写没）');
  need(/\/_dsh\/dsh-prompt\/hide\/set/.test(lib), 'B) 应注册 POST /_dsh/dsh-prompt/hide/set');
  need(/KNOWN_ROUTES = \[[^\]]*\/_dsh\/dsh-prompt\/hide\/set/s.test(lib), 'B) 新路由必须进 KNOWN_ROUTES（否则失败落盘被指纹化）');
}

// ═══ C) panel 静态（注释先剥掉：#165 这类 issue 号会被 hex 判据误伤，抄 158 同法） ═══
function groupC() {
  const code = stripComments(fs.readFileSync(SRC('template-browser.ts'), 'utf8'));
  const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
  need(/loadHidePreset/.test(code), 'C) 面板应读 loadHidePreset');
  need(/saveHidePreset/.test(code), 'C) 屏蔽钮应调 saveHidePreset');
  need(/hide\w* && .*builtin|builtin.*hide\w*/s.test(code), 'C) 列表过滤应有 hide 分支（去内置）');
  need(/scope-preset/.test(code) && /hide/.test(code), 'C) 预制钮渲染应受 hide 条件控制');
  need(/data-dsh-prompt-hide/.test(code), 'C) 屏蔽钮应带 data-dsh-prompt-hide 钩子');
  need(/showPreset/.test(code) && /hidePreset/.test(code), 'C) 屏蔽钮文案应走动作式词表键（showPreset/hidePreset）');
  need(/M1 12s4-8 11-8/.test(code), 'C) 睁眼 SVG（Feather eye 几何）应在源码里');
  need(/M17\.94 17\.94/.test(code), 'C) 闭眼 SVG（Feather eye-off 几何）应在源码里');
  need(/export const BAR_UI_CSS/.test(code), 'C) template-browser.ts 应导出小列表交互反馈段 BAR_UI_CSS');
  const m = /export const BAR_UI_CSS = \(function \(\)(?:: string)? \{([\s\S]*?)\n\}\)\(\)/.exec(code);
  const ui = m ? m[1] : '';
  need(ui.length > 200, 'C) BAR_UI_CSS 应是一段真样式（实得 ' + ui.length + ' 字符）');
  need(/:hover\{/.test(ui) && /:active\{/.test(ui) && /:focus-visible\{/.test(ui), 'C) 反馈段应含 hover / active / focus-visible');
  need(/--dsw-specific-accent/.test(ui), 'C) 焦点环用 accent 橙（用户拍板：悬浮灰、焦点橙）');
  need(/--dsw-specific-danger/.test(ui), 'C) 关闭 hover 走危险色（显眼化拍板）');
  need(!/#[0-9a-fA-F]{3,6}\b/.test(ui), 'C) 反馈段不得写死颜色（一律走宿主令牌）');
  need(/\[data-dsh-prompt-close\]:hover/.test(ui), 'C) 关闭应有 hover 反馈（需求 1）');
  need(/rgba\(224,108,117/.test(ui), 'C) 关闭 hover 用浅红 tint（原型 v3 DELTA-1，禁止整颗实心红）');
  need(!/\[data-dsh-prompt-close\]:hover[^}]*background:\s*var\(--dsw-specific-danger\)/.test(ui), 'C) 关闭 hover 禁止实心危险底');
  need(/selected\.kind === 'word'/.test(code) && /customWordSet\.has\(selected\.word\)/.test(code), 'C) 预置独占词上的旧选中也应回落（与 scope-preset 同判据，否则剩看不见的过滤器）');
  need(/\[data-dsh-prompt-hide\]/.test(ui), 'C) 屏蔽钮应有 hover/active 反馈（需求 3）');
  need(/const closeBtn[^}]*border: line\b/.test(code), 'C) closeBtn 应有边框（显眼化拍板：26×26 几何不动，只加框）');
  need(/presetCount.{0,60}hide|hide.{0,60}presetCount/s.test(code), 'C) 条数分解应按可见池算（hide 时预制计 0）');
}

// ═══ D) index 静态 ═══
function groupD() {
  const idx = fs.readFileSync(SRC('index.ts'), 'utf8');
  const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
  need(/BAR_UI_CSS/.test(idx), 'D) index.ts 应复用 template-browser.ts 的 BAR_UI_CSS');
  need(/applyOwnedStyle\(doc, \w+, BAR_UI_CSS\)/.test(idx), 'D) 应经 styleOwnership 归属缝注入（私有标记，不自建裸 style）');
}

// ═══ E) settings 静态 ═══
function groupE() {
  const code = fs.readFileSync(SRC('settings-page.ts'), 'utf8');
  const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
  need(/loadHidePreset/.test(code) && /saveHidePreset/.test(code), 'E) 设置页开关应绑定 load/saveHidePreset');
  need(/data-dsh-prompt-hide-toggle/.test(code), 'E) 设置页开关应带定位钩子');
}

// ═══ F) i18n 运行时 ═══
function groupF() {
  const zh = (k) => i18n.tr('zh', STR[k]);
  const en = (k) => i18n.tr('en', STR[k]);
  eq(zh('showPreset'), '展示预制模板', 'F) zh 屏蔽中按钮文案=展示预制模板（动作式）');
  eq(zh('hidePreset'), '屏蔽预制模板', 'F) zh 展示中按钮文案=屏蔽预制模板');
  const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
  need(typeof en('showPreset') === 'string' && en('showPreset').length > 0, 'F) en showPreset 非空');
  need(typeof en('hidePreset') === 'string' && en('hidePreset').length > 0, 'F) en hidePreset 非空');
  need(en('showPreset') !== zh('showPreset'), 'F) en 与 zh 不应相同（真翻译，不是占位）');
}

(async () => {
  await groupA();
  groupB(); groupC(); groupD(); groupE(); groupF();
  if (failures > 0) { console.log('\n=== Test issue-165 FAIL（' + failures + '） ==='); process.exit(1); }
  console.log('\n=== Test issue-165 PASS ===');
})().catch((e) => { console.log('FAIL: 异常 ' + (e && e.stack || e)); process.exit(1); });
