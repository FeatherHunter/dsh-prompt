// 回归测试 #142：回落词显示跟随 UI 语言（存储与比较不动）
// 规格：ticket 142 + 地图 134 Out of scope（用户词/预置正文永不翻译）+ research/small-list-pills/findings.md。
// 口径（seam 级，不断实现细节）：
//  A) STR.labelFallback { zh:'自定义', en:'Custom' }（en 与 tabCustom 同字不同键，钩子分开定位；141 presetCount/scopePreset 先例）
//  B) keys.displayLabelString(t, lang)：templateLabels 里全等 LABEL_FALLBACK 的段换成 tr(lang, STR.labelFallback)，其余段原文（大小写不动）
//  C) 只读展示位切换（逻辑位不动）：panel compact 行标签串 / 设置页 tagStyle 胶囊 / title 三处 / smart tagText 标签段 / trigger /prompt 描述
//  D) 回落 chip 钩子 data-dsh-prompt-chrome="labelFallback"（打在 chip/span 上；混合串数据段由门禁 dataWords 剔除覆盖，不拆节点）
//  E) 取值/逻辑位不动：matchLabel / isExcludedLabel / validateLabels / templateLabels 本体 / 评分排序过滤 / 落盘 / 选择器可选词 / 云行动词
//  F) 语言跟随：展示位吃各面已有订阅 lang，不新增裸 getLang；切语言重渲染后 chip 即翻
//  G) 边缘：copySuffix 新建那一刻按当前语言取一次，已存永不改写（无 parse 回）；smart 诊断行是手动点开临时诊断，无钩子 scan-C4，保持原样
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-142');
const { buildFlat } = require('./lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #141 同口径：只读 html[lang]，不写）──
function mkEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, children: [], dataset: {}, attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
  };
}
let docEl = null;
const domTextareas = [];
function installDom(lang) {
  domTextareas.length = 0;
  docEl = Object.assign(mkEl('html'), { lang });
  globalThis.document = {
    documentElement: docEl, head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: (sel) => (sel === 'textarea' ? domTextareas : []), getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}
installDom('zh-CN');

function installFetch(remoteMod) {
  globalThis.fetch = async (url) => ({
    ok: true, status: 200,
    json: async () => (/\/store$/.test(String(url))
      ? { ok: true, value: { remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
      : { ok: true }),
  });
}

buildFlat(DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('smart.ts'), SRC('trigger.ts'), SRC('smartstore.ts'), SRC('remote.ts'), SRC('remoteInputSheet.ts'), SRC('settings.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const keys = req('keys');
const i18n = req('i18n');
const store = req('store');
const panel = req('panel');
const smartMod = req('smart');
const triggerMod = req('trigger');
const remoteMod = req('remote');
const smartstore = req('smartstore');
const settingsMod = req('settings');
const STR = i18n.STR;
const React = require('react');
const TR = require('react-test-renderer');
const CJK = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
installFetch(remoteMod);

// ═══ A) 词表：labelFallback 与 copySuffix ═══
{
  eq(typeof STR.labelFallback, 'object', 'STR.labelFallback 存在');
  eq(STR.labelFallback && STR.labelFallback.zh, '自定义', 'labelFallback.zh=自定义');
  eq(STR.labelFallback && STR.labelFallback.en, 'Custom', 'labelFallback.en=Custom');
  // en 与 tabCustom 同字不同键（141 presetCount/scopePreset 先例：钩子分开定位）
  eq(STR.tabCustom.en, 'Custom', 'tabCustom.en 仍是 Custom（对照）');
  eq(('labelFallback' in STR) && ('tabCustom' in STR) && ('customCount' in STR), true, 'labelFallback/tabCustom/customCount 三键并存（不复用）');
  eq(typeof STR.copySuffix, 'object', 'STR.copySuffix 存在');
  eq(STR.copySuffix && STR.copySuffix.zh, '（副本）', 'copySuffix.zh=（副本）');
  eq(CJK.test((STR.copySuffix || {}).en || ''), false, 'copySuffix.en 零 CJK');
  eq(CJK.test((STR.copySuffix || {}).zh || ''), true, 'copySuffix.zh 含 CJK（非品牌词）');
  if (failures === 0) ok('A) 词表：labelFallback + copySuffix（同字不同键）');
}

// ═══ B) 展示映射：displayLabelString / displayLabels ═══
{
  eq(typeof keys.displayLabelString, 'function', 'keys.displayLabelString 存在');
  eq(typeof keys.displayLabels, 'function', 'keys.displayLabels 存在');
  const emptyT = { id: 'x', name: '空', body: 'b', builtin: false, labels: [], createdAt: 1 };
  eq(JSON.stringify(store.templateLabels(emptyT)), '["自定义"]', 'templateLabels 本体仍回落自定义（逻辑不动）');
  if (typeof keys.displayLabelString === 'function') {
    eq(keys.displayLabelString(emptyT, 'zh'), '自定义', 'zh 回落显示=自定义');
    eq(keys.displayLabelString(emptyT, 'en'), 'Custom', 'en 回落显示=Custom');
    // 其余段原文、大小写不动
    const mixed = { id: 'y', name: '混', body: 'b', builtin: false, labels: ['拆解', '自定义', 'MyWord'], createdAt: 1 };
    eq(keys.displayLabelString(mixed, 'en'), '拆解/Custom/MyWord', 'en 混合串只换回落段、其余原文保大小写');
    eq(keys.displayLabelString(mixed, 'zh'), '拆解/自定义/MyWord', 'zh 混合串原文');
    eq(keys.displayLabelString(mixed, 'en', '|'), '拆解|Custom|MyWord', 'sep 参数透传');
    // 用户自造大小写词不动
    const cw = { id: 'z', name: 'c', body: 'b', builtin: false, labels: ['custom'], createdAt: 1 };
    eq(keys.displayLabelString(cw, 'en'), 'custom', '小写 custom 不是全等回落、不映射（保大小写）');
    if (typeof keys.displayLabels === 'function') {
      eq(JSON.stringify(keys.displayLabels(mixed, 'en')), '["拆解","Custom","MyWord"]', 'displayLabels 数组形态一致');
    }
  } else {
    fail('displayLabelString 缺失，跳过映射断言');
  }
  // keys 运行时 import 只能是 ./store 与 ./i18n（type 用 import type）；store/i18n 不得 import keys（禁循环）
  const keysSrc = fs.readFileSync(SRC('keys.ts'), 'utf8');
  const runtimeImports = [...keysSrc.matchAll(/import\s+(?!type)([^;]+?)from\s*['"]([^'"]+)['"]/g)].map((m) => m[2]);
  const bad = runtimeImports.filter((s) => s !== './store' && s !== './i18n');
  eq(JSON.stringify(bad), '[]', 'keys 运行时 import 只加 ./store 与 ./i18n（实得 ' + JSON.stringify(runtimeImports) + '）');
  const storeSrc = fs.readFileSync(SRC('store.ts'), 'utf8');
  const i18nSrc = fs.readFileSync(SRC('i18n.ts'), 'utf8');
  eq(/from\s*['"]\.\/keys['"]/.test(storeSrc), false, 'store.ts 不 import keys（无环）');
  eq(/from\s*['"]\.\/keys['"]/.test(i18nSrc), false, 'i18n.ts 不 import keys（无环）');
  if (failures === 0) ok('B) 展示映射：全等替换、其余原文、无循环依赖');
}

// ═══ C/D) 展示位 + 钩子：panel compact / 设置页胶囊 / title / smart / trigger ═══
function chromeNodes(inst) {
  const out = [];
  const textOf = (node) => {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (node.children) return node.children.map(textOf).join('');
    return '';
  };
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props && n.props['data-dsh-prompt-chrome'] !== undefined) {
      out.push({ key: n.props['data-dsh-prompt-chrome'], kind: n.props['data-dsh-prompt-chrome-kind'] || '', text: textOf(n.children), title: n.props.title });
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(inst.toJSON());
  return out;
}
function findFallbackHooks(inst) {
  return chromeNodes(inst).filter((n) => n.key === 'labelFallback');
}

(async () => {
  const cEmpty = store.addCustom('空标签夹具', [], 'fallback body');
  const cUserSame = store.addCustom('用户自造同名词', ['自定义'], 'user same body');
  const cMixed = store.addCustom('混合夹具', ['拆解', '自定义'], 'mixed body');

  // —— en 渲染 ——
  installDom('en-US');
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  installFetch(remoteMod);
  let compactTree, settingsTree, smartTree;
  await TR.act(async () => { compactTree = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await TR.act(async () => { settingsTree = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  // 智能卡：草稿命中混合夹具行
  const ta = { tagName: 'TEXTAREA', value: '拆解', offsetParent: {}, closest: () => null, focus: () => {}, setSelectionRange: () => {}, selectionStart: 2 };
  globalThis.document.activeElement = ta;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: '拆解' });
  await TR.act(async () => { smartTree = TR.create(React.createElement(smartMod.SmartCardHost, {})); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  // en：回落 chip 显示 Custom 且有钩子（混合串数据段由门禁 dataWords 剔除口径覆盖，不拆节点）
  const dataWordsEn = (() => { const s = new Set(); for (const t of store.allTemplates()) { s.add(t.name); for (const l of store.templateLabels(t)) s.add(l); } return [...s].sort((a, b) => b.length - a.length); })();
  const chromeOnlyEn = (v) => { let s = String(v == null ? '' : v); for (const w of dataWordsEn) if (w) s = s.split(w).join(''); return s; };
  const enHooks = [...findFallbackHooks(compactTree), ...findFallbackHooks(settingsTree), ...findFallbackHooks(smartTree)];
  eq(enHooks.length > 0, true, 'en 渲染有 labelFallback 钩子（compact/设置/smart 至少一处）');
  for (const h of enHooks) {
    if (CJK.test(chromeOnlyEn(h.text))) fail('en labelFallback 钩子铬段残留 CJK：' + JSON.stringify(h.text));
  }
  eq(enHooks.some((h) => h.text.indexOf('Custom') >= 0), true, 'en labelFallback 钩子文本含 Custom');
  const enJson = JSON.stringify(compactTree.toJSON()) + JSON.stringify(settingsTree.toJSON()) + JSON.stringify(smartTree.toJSON());
  eq(enJson.indexOf('Custom') >= 0, true, 'en 渲染含 Custom');
  // title 三处只换 labelString 段、拼接结构不动（· + 铬后缀仍在）
  const titles = [];
  const collectTitles = (inst) => {
    const walk = (n) => {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.props && typeof n.props.title === 'string') titles.push(n.props.title);
      if (n.children) n.children.forEach(walk);
    };
    walk(inst.toJSON());
  };
  collectTitles(compactTree); collectTitles(settingsTree);
  eq(titles.some((s) => s.indexOf('Custom') >= 0 && s.indexOf('·') >= 0), true, 'en title 含 Custom · 铬后缀（拼接结构不动）');
  // smart 后缀不动（·Common/·Score 其一）
  eq(/·Common|·Score/.test(enJson), true, 'en smart 后缀仍是 ·Common/·Score（不动）');
  // trigger /prompt 展示位：有渲染标签才换
  const candsEn = await triggerMod.buildPromptSource().candidates(null, { query: 'prompt', position: '' });
  const descEn = (candsEn.find((c) => c.templateId === cEmpty.id) || {}).description || '';
  eq(descEn.indexOf('Custom') === 0, true, 'en /prompt 描述以 Custom 开头（实得 ' + JSON.stringify(descEn).slice(0, 60) + '）');

  for (const t of [compactTree, settingsTree, smartTree]) { try { t.unmount(); } catch (e) {} }
  smartstore.setSmartInput({ draft: '' });

  // —— zh 渲染：仍是自定义 ——
  installDom('zh-CN');
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  installFetch(remoteMod);
  let cTree2, sTree2;
  await TR.act(async () => { cTree2 = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await TR.act(async () => { sTree2 = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const zhJson = JSON.stringify(cTree2.toJSON()) + JSON.stringify(sTree2.toJSON());
  eq(zhJson.indexOf('自定义') >= 0, true, 'zh 渲染仍是自定义');
  // zh 下 display 与改前逐字等价（displayLabelString === labelString）
  let zhEqual = true;
  for (const t of store.allTemplates()) {
    if (keys.displayLabelString(t, 'zh') !== store.labelString(t)) { zhEqual = false; break; }
  }
  eq(zhEqual, true, 'zh 下 display 与 labelString 逐字等价（过滤/展示改前一致）');
  const candsZh = await triggerMod.buildPromptSource().candidates(null, { query: 'prompt', position: '' });
  const descZh = (candsZh.find((c) => c.templateId === cEmpty.id) || {}).description || '';
  eq(descZh.indexOf('自定义') === 0, true, 'zh /prompt 描述以自定义开头');
  for (const t of [cTree2, sTree2]) { try { t.unmount(); } catch (e) {} }

  // ═══ E) 落盘与比较不动 ═══
  {
    eq(store.LABEL_FALLBACK, '自定义', 'LABEL_FALLBACK 仍是自定义原值');
    eq(JSON.stringify(store.templateLabels(store.getTemplate(cEmpty.id))), '["自定义"]', '空标签落盘仍是自定义原值');
    eq(JSON.stringify(store.templateLabels(store.getTemplate(cUserSame.id))), '["自定义"]', '用户自造自定义词存储同样是自定义（edge：显示映射但存储比较不动）');
    eq(store.matchLabel(store.getTemplate(cEmpty.id), '自定义'), true, 'matchLabel 用原值命中');
    eq(store.matchLabel(store.getTemplate(cEmpty.id), 'Custom'), false, 'matchLabel 不认英文显示词（比较不动）');
    eq(keys.isExcludedLabel('自定义'), true, 'isExcludedLabel 仍认原值');
    eq(keys.isExcludedLabel('Custom'), false, 'isExcludedLabel 不认显示词');
    const v = store.validateLabels([]);
    eq(JSON.stringify(v.labels), '["自定义"]', 'validateLabels 空回落仍是自定义');
    // 混合模板的存储比较：原值逐字
    eq(store.matchLabel(store.getTemplate(cMixed.id), '拆解'), true, '混合模板 match 原值');
    eq(keys.displayLabelString(store.getTemplate(cMixed.id), 'en'), '拆解/Custom', '混合显示 en=拆解/Custom（edge 注明）');
  }

  // ═══ F) copySuffix：新建那一刻按当前语言取一次，已存永不改写 ═══
  {
    const storeSrc = fs.readFileSync(SRC('store.ts'), 'utf8');
    // 无 parse 回：除了拼进去那一行，没有把 '（副本）' 拆/剥/替换回来的代码
    const lines = storeSrc.split('\n');
    const parseBack = lines.filter((ln, i) => /副本/.test(ln) && /replace|split\('（|slice|substring|strip|parse|remove.*副本|副本.*remove/i.test(ln));
    eq(JSON.stringify(parseBack), '[]', 'store 无把（副本）parse 回的代码（新建即落盘原文）');
    installDom('en-US');
    const enSuffix = i18n.tr('en', STR.copySuffix);
    const cEn = store.copyPresetToCustom('fp', enSuffix);
    eq(cEn && cEn.name.endsWith(enSuffix), true, 'en 新建副本后缀按当前语言（实得 ' + (cEn && cEn.name) + '）');
    installDom('zh-CN');
    const zhSuffix = i18n.tr('zh', STR.copySuffix);
    const cZh = store.copyPresetToCustom('fp', zhSuffix);
    eq(cZh && cZh.name.endsWith(zhSuffix), true, 'zh 新建副本后缀是（副本）');
    // 已存永不改写：切语言后旧名不动
    installDom('en-US');
    eq(store.getTemplate(cZh.id).name.endsWith('（副本）'), true, '已存 zh 副本切 en 后仍是（副本）（永不改写）');
    try { store.removeCustom(cEn.id); } catch (e) {}
    try { store.removeCustom(cZh.id); } catch (e) {}
  }

  // ═══ G) 取值位不动（静态）：选择器/云/评分/过滤仍走原值 ═══
  {
    const panelSrc = fs.readFileSync(SRC('panel.ts'), 'utf8');
    const smartSrc = fs.readFileSync(SRC('smart.ts'), 'utf8');
    // 标签选择器可选词走 allKnownLabels/templateLabels 原值（展示映射只出现在行标签/title/smart tag/trigger 描述）
    eq(/allKnownLabels\(\)/.test(panelSrc), true, '选择器仍走 allKnownLabels（取值不动）');
    eq(/matchLabel\(x,/.test(panelSrc) || /matchLabel\(/.test(panelSrc), true, '过滤仍走 matchLabel（逻辑不动）');
    // 展示位不许新增裸 getLang（吃各面已有订阅 lang；trigger 走 resolveLocale 按次解析）
    const getLangUses = (panelSrc.match(/getLang\(/g) || []).length + (smartSrc.match(/getLang\(/g) || []).length;
    eq(getLangUses, 0, 'panel/smart 展示位无新增裸 getLang（吃订阅 lang）');
    const trigSrc = fs.readFileSync(SRC('trigger.ts'), 'utf8');
    eq(/getLang\(/.test(trigSrc), false, 'trigger 无裸 getLang（走 resolveLocale 按次解析）');
    eq(/displayLabelString/.test(trigSrc), true, 'trigger 描述走 displayLabelString');
  }

  try { store.removeCustom(cEmpty.id); } catch (e) {}
  try { store.removeCustom(cUserSame.id); } catch (e) {}
  try { store.removeCustom(cMixed.id); } catch (e) {}

  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => { console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e)); process.exit(1); });
