// 永久门禁 #138（父图 #134）：字典完备 + 英文铬无 CJK + 溢出预算 + --snap 对点底稿
// 跑法：node scripts/test-issue-134-gate.cjs（门禁三组 A/B/C，exit 0 = 全绿）
//       node scripts/test-issue-134-gate.cjs --snap <outdir>（先跑门禁，绿了才落 4 份 en 静态 HTML，给 #139 真机验收做对点底稿）
// 口径（seam 级，不断实现细节）：
//  A) 字典完备：STR 逐键 zh/en 非空；en 零 CJK（零例外）；zh 须含 CJK（例外仅品牌词 panelTitle/entryBtn）；
//     另同步调 node research/i18n-audit/scan.mjs --check（exit 0 = 每条 CJK 字面量都有归类，源码级完备）。
//  B) 英文铬无 CJK：7 面（悬浮 compact / 设置列表 / 设置页 / 挑选器 / 智能卡 / 遥控镜 / 远程大列表）在 lang=en 下渲染，
//     所有 data-dsh-prompt-chrome 节点（含子树文本）+ title/aria-label/placeholder/alt 四属性逐条无 CJK
//     （模板名/标签/正文是数据词，先剔除）；P1 铬 13 行逐个找得到（12 chrome 键 + close 行为钩子 + scope 三钮身份）。
//  C) 溢出预算（静态，见下方预算依据）：P1 十二键 en 文案按 pill / badge / hint 三档封顶 + 全局 en/zh 比上限。
//
// ── C 组预算依据（人审过；改数字必须同步改这段话，否则后人不知道松紧从哪来） ──
//  PILL_MAX = 10：范围三钮 / 翻页 / 关闭是固定 pill 宽度（中文 2–3 字约 4–6em；英文按 0.55em/字符折，
//    10 字符约等于中文 3 字宽）。超限 → pill 换行挤占云行。现状最大 Previous=8，余量 2。
//  BADGE_MAX = 16（占位按 {n}=88、{p}=100 展开后量）：行内用量徽标 / 智能后缀 / 档位 pill / 字数镜是行尾小字
//    nowrap，中文原形 ≤9 字，英文膨胀按 1.8× 封顶 16。超限 → 行被撑出横向滚动。现状最大 Used 88 times=13，余量 3。
//  HINT_MAX = 45：title 气泡无布局压力，但 DSH 侧栏窄窗下超长英文出横向滚动条；按中文 9 字 ×5 封顶。
//    现状 rowExpandHint=39，余量 6。
//  RATIO_MAX = 5.0：P1 任一条展开后 en/zh 字符数比 ≤5，防英文写成句子。现状最大 4.33（rowExpandHint）。
//  WHITELIST：当前无例外；将来某条真超预算时在此登记 {cap, reason}（登记即按登记值判，判空分支是活代码）。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-134gate');
const { buildFlat } = require('./lib/transpile-client.cjs');

const CJK = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/; // 与审计 scan.mjs / #141 同口径
const P1_PILL = ['tabAll', 'scopePreset', 'tabCustom', 'pickerPrev', 'pickerNext', 'close'];
const P1_BADGE = ['usageTitle', 'smartCommonSuffix', 'smartScoreSuffix', 'remoteSizeValue', 'remoteInputChars'];
const P1_HINT = ['rowExpandHint'];
const P1_KEYS = [...P1_PILL, ...P1_BADGE, ...P1_HINT];
const PILL_MAX = 10, BADGE_MAX = 16, HINT_MAX = 45, RATIO_MAX = 5.0;
const WHITELIST = {};
const SAMPLE = { n: '88', p: '100' };
const expand = (s) => String(s).replace('{n}', SAMPLE.n).replace('{p}', SAMPLE.p);
const DICT_FLOOR = 150; // #141 落定约 160 键；只增不减，防误删整段（真删键先改这里并说明）
const HOOK_FLOOR = 30; // 7 面 en 钩子总数下限（实测约 110；防面没渲染出来还全绿的恒真）

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #137/#141 同口径：只读 html[lang]，不写；MutationObserver 单例可观测） ──
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
const domTextareas = [];
function installDom(lang) {
  domTextareas.length = 0;
  const docEl = Object.assign(mkEl('html'), { lang });
  globalThis.document = {
    documentElement: docEl, head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: (sel) => (sel === 'textarea' ? domTextareas : []), getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
  return docEl;
}
installDom('zh-CN');

// 宿主写桥一律成功（同 #141 口径）：store 快照跟随当前远程偏好，否则面分支漂移
buildFlat(DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('settings.ts'), SRC('smart.ts'), SRC('remote.ts'), SRC('smartstore.ts'), SRC('remoteInputSheet.ts'), SRC('picker.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const i18n = req('i18n');
const store = req('store');
const panel = req('panel');
const settingsMod = req('settings');
const smartMod = req('smart');
const remoteMod = req('remote');
const smartstore = req('smartstore');
const sheetMod = req('remoteInputSheet');
const pickerMod = req('picker');
const STR = i18n.STR;
function installFetch() {
  globalThis.fetch = async (url) => ({
    ok: true, status: 200,
    json: async () => (/\/store$/.test(String(url))
      ? { ok: true, value: { remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
      : { ok: true }),
  });
}
installFetch();
const React = require('react');
const TR = require('react-test-renderer');

// ═══ A) 字典完备（静态：不渲染，只看词表 + 扫描器） ═══
function groupA() {
  const keys = Object.keys(STR);
  if (keys.length < DICT_FLOOR) fail('A) STR 键数 ' + keys.length + ' 跌破下限 ' + DICT_FLOOR + '（误删整段？真删键先改 DICT_FLOOR 并说明）');
  const missing = P1_KEYS.filter((k) => !Object.prototype.hasOwnProperty.call(STR, k));
  if (missing.length) fail('A) P1 键缺失：' + missing.join('/'));
  const emptyZh = keys.filter((k) => typeof STR[k].zh !== 'string' || STR[k].zh.trim().length === 0);
  const emptyEn = keys.filter((k) => typeof STR[k].en !== 'string' || STR[k].en.trim().length === 0);
  if (emptyZh.length) fail('A) zh 为空：' + emptyZh.join('/'));
  if (emptyEn.length) fail('A) en 为空：' + emptyEn.join('/'));
  const enCJK = keys.filter((k) => CJK.test(STR[k].en));
  eq(JSON.stringify(enCJK), '[]', 'A) en 值零 CJK（零例外，141 后 labelReserved 已删）');
  const zhPlain = keys.filter((k) => !CJK.test(STR[k].zh)).sort();
  eq(zhPlain.join('/'), 'entryBtn/panelTitle', 'A) zh 无 CJK 的只有品牌词 panelTitle/entryBtn（值 Prompt）');
  try {
    const out = execFileSync('node', [path.join(ROOT, 'research', 'i18n-audit', 'scan.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const tail = String(out).trim().split('\n').slice(-2).join(' / ');
    if (!/check OK/.test(String(out))) fail('A) scan --check 没报 check OK：' + tail);
    else console.log('      scan --check：' + tail);
  } catch (e) {
    fail('A) scan.mjs --check exit 非 0（有未归类 CJK 字面量）：' + ((e && e.stdout) || (e && e.message) || e));
  }
  if (failures === 0) ok('A) 字典完备：' + keys.length + ' 键 zh/en 非空、en 零 CJK、scan --check 绿');
}

// ── B/C 共用：en 七面渲染 + 钩子收集 ──
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
      out.push({ key: n.props['data-dsh-prompt-chrome'], kind: n.props['data-dsh-prompt-chrome-kind'] || '', text: textOf(n.children), title: n.props.title, aria: n.props['aria-label'], ph: n.props.placeholder, alt: n.props.alt });
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(inst.toJSON());
  return out;
}
const twoGroups = () => {
  const now = Date.now();
  return {
    sessions: {
      list: { getSnapshot: () => ({ items: [{ id: 'a1', title: 'A', cwd: '/a', updatedAt: now }] }) },
      open: () => Promise.resolve(),
    },
    workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'w1', path: '/a', title: '工程A', sessionIds: ['a1'] }] }) } },
    uiWorkspace: { openSession: () => Promise.resolve() },
  };
};
async function renderFaces() {
  const faces = [];
  const add = async (name, el) => {
    let inst;
    await TR.act(async () => { inst = TR.create(el); });
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const frozen = { name, inst, hooks: chromeNodes(inst), json: JSON.stringify(inst.toJSON()) };
    faces.push(frozen);
    return frozen;
  };
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  installFetch();
  await add('panel-compact', React.createElement(panel.TemplateBrowser, { compact: true }));
  await add('panel-settings', React.createElement(panel.TemplateBrowser, { compact: false }));
  await add('settings-page', React.createElement(settingsMod.SettingsPage, {}));
  await add('picker', React.createElement(pickerMod.WorkspacePicker, { faces: twoGroups(), currentId: '', remoteSize: 5, wide: false, onClose: () => {} }));
  remoteMod.setRemoteEnabled(true);
  await add('panel-remote', React.createElement(panel.TemplateBrowser, { compact: true }));
  const ta = { tagName: 'TEXTAREA', value: '复盘', offsetParent: {}, closest: () => null, focus: () => {}, setSelectionRange: () => {}, selectionStart: 2 };
  globalThis.document.activeElement = ta;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: '复盘' });
  await add('smart-card', React.createElement(smartMod.SmartCardHost, {}));
  await add('remote-sheet', React.createElement(sheetMod.RemoteInputSheet, { capturedSessionId: 's1', remoteSize: 5, onClose: () => {} }));
  return faces;
}
async function openDelModal(docEl) {
  let tree;
  TR.act(() => { tree = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const want = STR.del[docEl.lang.indexOf('en') === 0 ? 'en' : 'zh'];
  const rowDel = tree.root.findAll((n) => n.type === 'button' && (n.children || []).filter((c) => typeof c === 'string').join('') === want)[0];
  if (!rowDel) { fail('找不到行内删除键（lang=' + docEl.lang + '）'); return tree; }
  TR.act(() => { rowDel.props.onClick({ stopPropagation() {} }); });
  TR.act(() => {});
  return tree;
}

// ═══ B) 英文铬无 CJK（含属性）+ P1 钩子完备 ═══
async function groupB() {
  const cust = store.addCustom('EnFixture', ['EnLabel'], 'en fixture body');
  // 数据词表（C3 内容资产 + 本次夹具）：钩子子树里的数据词先剔除再判，判的是铬不是数据
  const dataWords = (() => {
    const s = new Set(['EnFixture', 'EnLabel']);
    for (const t of store.allTemplates()) {
      s.add(t.name);
      for (const l of store.templateLabels(t)) s.add(l);
      if (t.body) s.add(t.body);
      const intro = (t.body || '').split('\n')[0].trim(); // 行简介是首行（子串≠全文，整文 split 命中不了它）
      if (intro) s.add(intro);
    }
    return [...s].filter(Boolean).sort((a, b) => b.length - a.length);
  })();
  const chromeOnly = (s) => {
    let v = String(s == null ? '' : s);
    for (const w of dataWords) if (w && v.indexOf(w) >= 0) v = v.split(w).join('');
    return v;
  };
  const docEl = installDom('en-US');
  const faces = await renderFaces();
  for (const f of faces) {
    if (!(f.json.length > 500)) fail('B) ' + f.name + ' 渲染疑似空面（JSON 长 ' + f.json.length + '）');
  }
  const found = new Map();
  let total = 0;
  const checkNode = (face, n) => {
    total++;
    const cands = [n.text, n.title, n.aria, n.ph, n.alt].filter((v) => typeof v === 'string' && v.length > 0);
    for (const v of cands) {
      if (CJK.test(chromeOnly(v))) fail('B) ' + face + ' 钩子 ' + n.key + ' 残留 CJK：' + JSON.stringify(v).slice(0, 80));
    }
    const arr = found.get(n.key) || [];
    arr.push(face + (n.kind ? '(' + n.kind + ')' : '(text)'));
    found.set(n.key, arr);
  };
  for (const f of faces) for (const n of f.hooks) checkNode(f.name, n);
  // 删除确认弹窗（nameQuote 只在弹窗里）
  {
    const modalTree = await openDelModal(docEl);
    for (const n of chromeNodes(modalTree)) checkNode('del-modal', n);
    const quote = chromeNodes(modalTree).filter((n) => n.key === 'nameQuote')[0];
    if (!quote) fail('B) en 删除确认里应有 nameQuote 钩子');
    else if (quote.text.indexOf('“EnFixture”') < 0) fail('B) en 删除确认应用弯引号包名（实得 ' + JSON.stringify(quote.text).slice(0, 80) + '）');
    try { modalTree.unmount(); } catch (e) {}
  }
  if (total < HOOK_FLOOR) fail('B) en 钩子总数 ' + total + ' 跌破下限 ' + HOOK_FLOOR + '（面没渲染出来？）');
  // P1 完备：12 chrome 键 + close 行为钩子 + scope 三钮身份
  for (const k of P1_KEYS) {
    if (k === 'smartCommonSuffix') continue; // 与 smartScoreSuffix 互斥（同一行两种形态，下 jointly 判）
    if (k === 'smartScoreSuffix' && found.has('smartCommonSuffix')) continue;
    if (k === 'close') continue; // close 走行为钩子（下单列），无 chrome 钩子是设计
    if (!found.has(k)) fail('B) en 渲染里缺 P1 钩子 ' + k + '（实际：' + [...found.keys()].join('/') + '）');
  }
  if (!found.has('smartCommonSuffix') && !found.has('smartScoreSuffix')) fail('B) 智能卡两种后缀一个都没渲染到');
  const hasHook = (k, entry) => (found.get(k) || []).indexOf(entry) >= 0;
  if (!hasHook('pickerPrev', 'panel-remote(title aria-label)')) fail('B) pickerPrev 应在远程大列表报属性位（title aria-label）');
  if (!hasHook('pickerNext', 'panel-remote(title aria-label)')) fail('B) pickerNext 应在远程大列表报属性位（title aria-label）');
  if (!hasHook('usageTitle', 'panel-settings(title)')) fail('B) usageTitle 应在设置列表报属性位（title）');
  if (!hasHook('rowExpandHint', 'panel-settings(title)')) fail('B) rowExpandHint 应在设置列表报属性位（title）');
  if (!hasHook('remoteSizeValue', 'settings-page(text)')) fail('B) remoteSizeValue 应在设置页文本位');
  // close：行为钩子 + title 走词表（无 chrome 钩子是设计：关闭键是纯图标键）
  {
    const remoteTree = faces.find((f) => f.name === 'panel-remote').inst;
    const btn = remoteTree.root.findAll((n) => n.props && n.props['data-dsh-prompt-remote-close'] !== undefined)[0];
    if (!btn) fail('B) 远程大列表缺 close 行为钩子 data-dsh-prompt-remote-close');
    else {
      eq(btn.props.title, 'Close', 'B) en 关闭键 title 走词表');
      if (CJK.test(chromeOnly(btn.props.title))) fail('B) 关闭键 title 残留 CJK');
    }
  }
  // scope 三钮：身份冻结 + 文本/钩子对齐
  {
    const settingsTree = faces.find((f) => f.name === 'panel-settings').inst;
    const scopes = settingsTree.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope']);
    eq(scopes.map((n) => n.props['data-dsh-prompt-scope']).join('/'), 'all/preset/custom', 'B) 三钮 scope 身份序');
    eq(scopes.map((n) => (n.children || []).filter((c) => typeof c === 'string').join('')).join('/'), 'All/Preset/Custom', 'B) en 三钮文本走词表');
    eq(scopes.map((n) => n.props['data-dsh-prompt-chrome']).join('/'), 'tabAll/scopePreset/tabCustom', 'B) 三钮 chrome 钩子键');
  }
  // 挑选器（无 chrome 钩子是设计：picker.ts 零散落字面量，全走 STR）：断言 en 文案确实切过去了
  {
    const pk = faces.find((f) => f.name === 'picker').json;
    if (pk.indexOf('Pick session') < 0) fail('B) 挑选器 en 文案缺 Pick session（面没切到 en？）');
    if (pk.indexOf('Search: title + workspace') < 0) fail('B) 挑选器 en 搜索占位缺（面没切到 en？）');
  }
  for (const f of faces) { try { f.inst.unmount(); } catch (e) {} }
  smartstore.setSmartInput({ draft: '' });
  store.removeCustom(cust.id);
  if (failures === 0) ok('B) 英文铬无 CJK：7 面 ' + total + ' 个钩子位置零 CJK，P1 十三行齐（12 键 + close 行为钩子 + scope 三钮）');
}

// ═══ C) 溢出预算（静态：只看词表，不渲染） ═══
function groupC() {
  const len = (s) => [...expand(s)].length;
  for (const k of P1_KEYS) {
    if (!STR[k]) { fail('C) P1 键缺失：' + k); continue; }
    const e = STR[k].en, z = expand(STR[k].zh);
    const wl = WHITELIST[k];
    if (wl) { console.log('      白名单：' + k + '（' + wl.reason + '，cap=' + wl.cap + '）'); continue; }
    if (P1_PILL.includes(k) && len(e) > PILL_MAX) fail('C) pill 超预算：' + k + ' en=' + JSON.stringify(e) + ' 长 ' + len(e) + ' > ' + PILL_MAX);
    if (P1_BADGE.includes(k) && len(e) > BADGE_MAX) fail('C) badge 超预算：' + k + ' en=' + JSON.stringify(expand(e)) + ' 长 ' + len(e) + ' > ' + BADGE_MAX);
    if (P1_HINT.includes(k) && len(e) > HINT_MAX) fail('C) hint 超预算：' + k + ' en 长 ' + len(e) + ' > ' + HINT_MAX);
    const ratio = len(e) / Math.max(1, [...z].length);
    if (ratio > RATIO_MAX) fail('C) en/zh 比超限：' + k + ' 比 ' + ratio.toFixed(2) + ' > ' + RATIO_MAX);
  }
  // 预算本身有效性（防恒真式断言：上限必须真卡得住东西 —— 现状最大值离上限不足 40% 即告警压缩余量）
  const pillMax = Math.max(...P1_PILL.map((k) => STR[k] ? len(STR[k].en) : 0));
  const badgeMax = Math.max(...P1_BADGE.map((k) => STR[k] ? len(STR[k].en) : 0));
  if (!(pillMax > PILL_MAX - 4)) fail('C) pill 预算松了：现状最大 ' + pillMax + '，上限 ' + PILL_MAX + '（余量超 3，请收紧）');
  if (!(badgeMax > BADGE_MAX - 5)) fail('C) badge 预算松了：现状最大 ' + badgeMax + '，上限 ' + BADGE_MAX + '（余量超 4，请收紧）');
  if (failures === 0) ok('C) 溢出预算：pill≤' + PILL_MAX + '（现状' + pillMax + '） badge≤' + BADGE_MAX + '（现状' + badgeMax + '） hint≤' + HINT_MAX + ' 比≤' + RATIO_MAX.toFixed(1));
}

// ── 序列化（snap 用：约 40 行的简易 HTML 化；host 名 + 文本转义 + style 转 CSS + 保留 title/aria-*/placeholder/alt/data-*/lang/role） ──
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function css(o) { return Object.keys(o || {}).map((k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + o[k]).join(';'); }
function ser(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return esc(n);
  if (Array.isArray(n)) return n.map(ser).join('');
  if (typeof n.type !== 'string') return ser(n.children || []);
  const p = n.props || {};
  let a = '';
  for (const k of Object.keys(p)) {
    if (k === 'children' || k === 'style' || k === 'key' || k === 'ref') continue;
    const v = p[k];
    if (typeof v === 'function' || (typeof v === 'object' && v !== null)) continue;
    if (!(k === 'title' || k === 'placeholder' || k === 'alt' || k === 'lang' || k === 'role' || k === 'aria-label' || k.indexOf('aria-') === 0 || k.indexOf('data-') === 0)) continue;
    a += ' ' + k + '="' + esc(v) + '"';
  }
  if (p.style && typeof p.style === 'object') {
    // 快照只为肉眼对点：组件自带的 position:fixed / visibility:hidden 是挂载态样式，
    // 原样拷进静态 HTML 会整面不可见，这里归一掉（门禁断言跑在渲染树上，不受影响）。
    const st = { ...p.style };
    if (st.visibility === 'hidden') st.visibility = 'visible';
    if (st.position === 'fixed') st.position = 'static';
    a += ' style="' + esc(css(st)) + '"';
  }
  return '<' + n.type + a + '>' + ser(n.children) + '</' + n.type + '>';
}
async function snap(outdir) {
  const cust = store.addCustom('EnFixture', ['EnLabel'], 'en fixture body');
  installDom('en-US');
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  installFetch();
  const faces = [];
  const add = async (name, el) => {
    let inst;
    await TR.act(async () => { inst = TR.create(el); });
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    faces.push({ name, json: inst.toJSON() });
    try { inst.unmount(); } catch (e) {}
    smartstore.setSmartInput({ draft: '' });
  };
  await add('panel', React.createElement(panel.TemplateBrowser, { compact: true }));
  await add('settings', React.createElement(settingsMod.SettingsPage, {}));
  await add('picker', React.createElement(pickerMod.WorkspacePicker, { faces: twoGroups(), currentId: '', remoteSize: 5, wide: false, onClose: () => {} }));
  remoteMod.setRemoteEnabled(true);
  await add('remote', React.createElement(panel.TemplateBrowser, { compact: true }));
  store.removeCustom(cust.id);
  fs.mkdirSync(outdir, { recursive: true });
  const files = [];
  for (const f of faces) {
    const inner = ser({ type: 'div', props: { lang: 'en', 'data-dsh-prompt-snap': f.name }, children: f.json });
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>dsh-prompt ' + f.name + ' (en baseline #139)</title></head><body>' + inner + '</body></html>';
    const fp = path.join(outdir, f.name + '-en.html');
    fs.writeFileSync(fp, html, 'utf8');
    const hooks = html.split('data-dsh-prompt-chrome').length - 1;
    files.push({ file: f.name + '-en.html', size: Buffer.byteLength(html), hooks });
    console.log('      snap：' + f.name + '-en.html ' + Buffer.byteLength(html) + 'B，钩子 ' + hooks);
  }
  for (const f of files) {
    const html = fs.readFileSync(path.join(outdir, f.file), 'utf8');
    if (!html.length) fail('snap 空文件：' + f.file);
    if (html.indexOf('lang="en"') < 0) fail('snap 缺 lang="en"：' + f.file);
  }
  for (const n of ['panel', 'settings', 'remote']) {
    const f = files.find((x) => x.file === n + '-en.html');
    if (!f || !(f.hooks >= 1)) fail('snap 缺钩子：' + n + '-en.html（对点底稿必须带 data-dsh-prompt-chrome）');
  }
  const pk = files.find((x) => x.file === 'picker-en.html');
  if (pk && pk.hooks >= 1) fail('snap 异动：picker-en.html 出现 chrome 钩子（picker.ts 本无钩子，有人加了？请同步 B 组口径）');
  if (files.length !== 4) fail('snap 应产出 4 个文件，实际 ' + files.length);
  if (failures === 0) ok('snap：4 文件齐（panel/settings/picker/remote-en.html），钩子 panel/settings/remote 有、picker 按设计为 0（STR 直驱无钩子）');
}

(async () => {
  groupA();
  await groupB();
  groupC();
  const ai = process.argv.indexOf('--snap');
  if (ai >= 0) {
    const out = process.argv[ai + 1];
    if (!out || out.startsWith('--')) { fail('用法：node scripts/test-issue-134-gate.cjs --snap <outdir>'); }
    else if (failures === 0) await snap(path.resolve(out));
    else console.log('门禁红灯，不落快照（先修门禁）');
  }
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => { console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e)); process.exit(1); });
