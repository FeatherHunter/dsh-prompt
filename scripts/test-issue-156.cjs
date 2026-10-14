'use strict';
/**
 * dsh-prompt #156 回归：颜色标签的「跨面契约层」+ ADR-0007 两条门禁落点 + 零新造色值栅栏
 * 跑法：node scripts/test-issue-156.cjs（exit 0 = 全绿）
 *
 * 与 #158（scripts/test-issue-158.cjs）的分工：那张票管「控件形状与交互 + 注入缝 + 单面渲染与落盘/清除」，
 * 这张票管「同一份颜色语义在四个面同源 + 读侧不写回 + 存量逐字节不变 + 零新造色值」。
 *
 * 分组：
 *   A) 四面同语义：悬浮小列表（compact + 远程关）／设置页（compact:false）／远程大列表（远程开，带
 *      data-dsh-prompt-remote-panel 校验，名字节点从 remote-card 里取）／智能卡（SmartCardHost）。
 *      四处名字节点都带 data-dsh-prompt-tint，且都吃同一个读侧权威值。
 *   B) 带外回落：存量里的带外色（#ffffff）在四个面都回落成「未选颜色」——无钩子、样式与真·未选色行逐字段相同。
 *   C) 读不写回：读取 + 渲染全程零写请求（悬浮两窗 / 远程两窗各测一次）；allTemplates() 记录与宿主返回逐字段相同。
 *   D) 色值栅栏：INK_TINT_CSS 零 hex 且只用宿主令牌；四处染色表达式都写 `color: ink`（无字面量）；
 *      本图改过的源文件里出现的**不同** hex 字面量集合必须等于下方登记表（多一个新颜色就红）。
 *   E) 接线：package.json 有 test:issue-156，且 #158 的脚本与接线仍在（两层并存）。
 *
 * 边界（不在本脚本覆盖内）：不打真实宿主、不做像素级观感。观感与「深浅两主题 × 四面」的渲染证据表见
 * research/assets/ink-color/；真机验收与发版由【真机验收与发版（下一个补丁版本）】承接。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-156');
const { buildFlat, stripComments } = require('./lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #134 门禁同口径：够 styleOwnership / 智能卡的 textarea 探测用） ──
const domTextareas = [];
function querySel(root, sel) {
  const m = /^style\[data-dsh-prompt-style="([^"]+)"\]$/.exec(String(sel));
  if (!m) return [];
  const out = [];
  const walk = (n) => {
    for (const c of n.children || []) {
      if (String(c.tagName).toLowerCase() === 'style' && c.getAttribute('data-dsh-prompt-style') === m[1]) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}
function mkEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, children: [], dataset: {}, attributes: {}, parentNode: null, textContent: '',
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener() {}, removeEventListener() {}, focus() {}, setSelectionRange() {},
    querySelector(sel) { return querySel(this, sel)[0] || null; },
    querySelectorAll(sel) { return querySel(this, sel); },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
  };
}
function installDom(lang) {
  const docEl = Object.assign(mkEl('html'), { lang });
  globalThis.document = {
    documentElement: docEl, head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null,
    querySelectorAll: (sel) => (String(sel) === 'textarea' ? domTextareas : []),
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
  return docEl;
}

// ── 宿主写桥：非 GET 一律记下来（C 组断言「读取 + 渲染零写请求」） ──
const writes = [];
const SEED = [
  { id: 'x-inband', name: 'InkFixture', nameEn: '', labels: ['plan'], body: 'in-band body', builtin: false, createdAt: 1, color: '#0284c7' },
  { id: 'x-outband', name: 'OutFixture', nameEn: '', labels: ['plan'], body: 'out-of-band body', builtin: false, createdAt: 2, color: '#ffffff' },
  { id: 'x-plain', name: 'PlainFixture', nameEn: '', labels: ['plan'], body: 'plain body', builtin: false, createdAt: 3 },
];
function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const m = String((init && init.method) || 'GET').toUpperCase();
    if (m !== 'GET' || (init && init.body)) {
      let body = null;
      try { body = JSON.parse(String(init.body)); } catch (e) { /* 非 JSON 也计数 */ }
      writes.push({ url: u, method: m, body });
    }
    return {
      ok: true, status: 200,
      json: async () => (/\/store$/.test(u)
        ? { ok: true, value: { customs: SEED, usage: {}, pinned: [], lastUsed: null, remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
        : { ok: true }),
    };
  };
}

installDom('zh-CN');
buildFlat(DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('smart.ts'), SRC('remote.ts'), SRC('smartstore.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panel = req('panel');
const store = req('store');
const smartMod = req('smart');
const smartstore = req('smartstore');
const remoteMod = req('remote');
installFetch();
const React = require('react');
const TR = require('react-test-renderer');
const INK_IN = '#0284c7';
const INK_OUT = '#ffffff';

// ── 挂载工具 ──
async function mount(el) {
  let inst;
  await TR.act(async () => { inst = TR.create(el); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return inst;
}
function spanIn(scope, name) {
  return scope.findAll((n) => n.type === 'span' && Array.isArray(n.children) && n.children.length === 1 && n.children[0] === name)[0];
}
function hasMarker(inst, attr) {
  return inst.root.findAll((n) => n.props && n.props[attr] !== undefined).length > 0;
}
/** 悬浮两窗：远程总闸关（小列表 = 悬浮列表、设置页 = 管理列表） */
async function setupHover() {
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  await store.ensureLoaded();
}
async function mountHoverFaces() {
  return {
    '小列表': await mount(React.createElement(panel.TemplateBrowser, { compact: true })),
    '设置页': await mount(React.createElement(panel.TemplateBrowser, { compact: false })),
  };
}
/** 远程两窗：远程总闸开（大列表 = 远程面板、智能卡另挂） */
async function setupRemoteOn() {
  remoteMod.setRemoteEnabled(true);
  await store.ensureLoaded();
}
async function mountRemoteFaces() {
  const ta = { tagName: 'TEXTAREA', value: 'plan the work', offsetParent: {}, closest: () => null, focus() {}, setSelectionRange() {}, selectionStart: 4 };
  globalThis.document.activeElement = ta;
  domTextareas.length = 0;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: 'plan the work' });
  return {
    '大列表': await mount(React.createElement(panel.TemplateBrowser, { compact: true })),
    '智能卡': await mount(React.createElement(smartMod.SmartCardHost, {})),
  };
}
function unmountAll(faces) {
  for (const inst of Object.values(faces)) { try { TR.act(() => inst.unmount()); } catch (e) { /* 已卸载 */ } }
  globalThis.document.activeElement = null;
  domTextareas.length = 0;
  smartstore.setSmartInput({ draft: '' });
}
/** 远程面板一次翻页把目标卡都收齐（远程页槽位有限，自定义不一定落在第一页） */
async function remoteCardsOf(inst, ids, maxPages = 12) {
  const out = {};
  for (let i = 0; i < maxPages; i++) {
    for (const id of ids) {
      if (out[id]) continue;
      const card = inst.root.findAll((n) => n.props && n.props['data-dsh-prompt-remote-card'] !== undefined && n.props['data-dsh-prompt-id'] === id)[0];
      if (card) out[id] = card;
    }
    if (ids.every((id) => out[id])) return out;
    const next = inst.root.findAll((n) => n.props && n.props['data-dsh-prompt-remote-next'] !== undefined && n.props.disabled !== true)[0];
    if (!next) return out;
    await TR.act(async () => { next.props.onClick(); });
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  return out;
}

/** 卸载前把名字节点的可见事实抓成快照（TestInstance 卸载后不能再读 props） */
function grabSpan(sp) {
  if (!sp) return null;
  return { hook: sp.props[panel.INK_TINT_ATTR] !== undefined, style: Object.assign({}, sp.props.style) };
}

// ═══ A) 四面同语义（同一个带内色） ═══
async function groupA() {
  const snap = {};
  await setupHover();
  const hover = await mountHoverFaces();
  eq(hasMarker(hover['小列表'], 'data-dsh-prompt-remote-panel'), false, 'A) 小列表面是悬浮列表（不是远程面板）');
  eq(hasMarker(hover['设置页'], 'data-dsh-prompt-remote-panel'), false, 'A) 设置页面是管理列表（不是远程面板）');
  snap['小列表'] = grabSpan(spanIn(hover['小列表'].root, 'InkFixture'));
  snap['设置页'] = grabSpan(spanIn(hover['设置页'].root, 'InkFixture'));
  unmountAll(hover);
  await setupRemoteOn();
  const remote = await mountRemoteFaces();
  if (!hasMarker(remote['大列表'], 'data-dsh-prompt-remote-panel')) fail('A) 大列表面没渲染出远程面板（远程总闸没开？）');
  const cards = await remoteCardsOf(remote['大列表'], ['x-inband']);
  if (!cards['x-inband']) fail('A) 远程面板翻遍页也没找到目标卡');
  snap['大列表'] = grabSpan(cards['x-inband'] ? spanIn(cards['x-inband'], 'InkFixture') : null);
  snap['智能卡'] = grabSpan(spanIn(remote['智能卡'].root, 'InkFixture'));
  unmountAll(remote);

  const seed = store.allTemplates().filter((t) => t.id === 'x-inband')[0];
  const want = store.inkColorOf(seed);
  eq(want, INK_IN, 'A) 读侧权威 inkColorOf 就是种子里的带内色');
  const seen = [];
  for (const face of ['小列表', '设置页', '大列表', '智能卡']) {
    const s = snap[face];
    if (!s) { fail('A) ' + face + ' 面没渲染出带色模板的名字节点'); continue; }
    if (!s.hook) fail('A) ' + face + ' 面名字节点缺钩子属性 ' + panel.INK_TINT_ATTR);
    eq(s.style.color, want, 'A) ' + face + ' 面吃同一个色');
    seen.push(face);
  }
  eq(seen.join('/'), '小列表/设置页/大列表/智能卡', 'A) 四个面都验到（一个都不能少）');
  // 源码层面：四处染色表达式都吃同一个变量 ink（没有第二份判据、没有字面量）
  const pc = stripComments(fs.readFileSync(SRC('panel.ts'), 'utf8'));
  const sc = stripComments(fs.readFileSync(SRC('smart.ts'), 'utf8'));
  eq((pc.match(/color: ink \|\| base/g) || []).length, 1, 'A) 小列表行：未上色回退宿主色、上色用用户色（同一个变量）');
  eq((pc.match(/color: ink,/g) || []).length, 2, 'A) 大列表卡 + 设置页行：同一个变量 ink');
  eq((sc.match(/color: ink,/g) || []).length, 1, 'A) 智能卡行：同一个变量 ink');
  eq(((pc + sc).match(/inkColorOf\(/g) || []).length, 4, 'A) 颜色只经 inkColorOf 读（三处渲染查值 + 编辑弹窗初值）');
  eq((pc.match(/addCustom\(f\.name, f\.labels, f\.body, f\.color \|\| undefined\)/g) || []).length, 1, 'A) 唯一直接读 .color 的是导入写入口（经 sanitizeInkColor 守卫）');
  eq(((pc + sc).match(/[A-Za-z_$][\w$]*\.color\b/g) || []).length, 1, 'A) 除导入写入口外，渲染层零裸读 .color（一律过读侧回落）');
  if (failures === 0) ok('A) 四面同语义：四处名字节点都带钩子、都吃同一个读侧权威值');
}

// ═══ B) 带外回落（四个面都当未选颜色） ═══
async function groupB() {
  const got = {};
  await setupHover();
  const hover = await mountHoverFaces();
  for (const face of ['小列表', '设置页']) got[face] = { out: grabSpan(spanIn(hover[face].root, 'OutFixture')), plain: grabSpan(spanIn(hover[face].root, 'PlainFixture')) };
  unmountAll(hover);
  await setupRemoteOn();
  const remote = await mountRemoteFaces();
  const cards = await remoteCardsOf(remote['大列表'], ['x-outband', 'x-plain']);
  got['大列表'] = {
    out: grabSpan(cards['x-outband'] ? spanIn(cards['x-outband'], 'OutFixture') : null),
    plain: grabSpan(cards['x-plain'] ? spanIn(cards['x-plain'], 'PlainFixture') : null),
  };
  got['智能卡'] = { out: grabSpan(spanIn(remote['智能卡'].root, 'OutFixture')), plain: grabSpan(spanIn(remote['智能卡'].root, 'PlainFixture')) };
  unmountAll(remote);

  const bad = [];
  const compared = [];
  for (const face of ['小列表', '设置页', '大列表', '智能卡']) {
    const { out, plain } = got[face];
    if (!out) { fail('B) ' + face + ' 面没渲染出带外色的名字节点'); continue; }
    if (out.hook) bad.push(face + ':带外值上了钩子');
    if (String(out.style.color) === INK_OUT) bad.push(face + ':带外值被直接画上屏');
    if (plain) {
      compared.push(face);
      if (JSON.stringify(out.style) !== JSON.stringify(plain.style)) bad.push(face + ':带外行样式与真·未选色行不同');
    }
  }
  eq(bad.join(' | '), '', 'B) 四个面：带外值无钩子、不上屏、样式与未选色行逐字段相同');
  eq(compared.length >= 3, true, 'B) 至少三个面做了「带外 ≡ 未选色」逐字段对照（实得 ' + compared.join('/') + '）');
  eq(store.allTemplates().filter((t) => t.id === 'x-outband')[0].color, INK_OUT, 'B) 存储里带外原值原样还在（只回落、不改写）');
  eq(store.inkColorOf(store.allTemplates().filter((t) => t.id === 'x-outband')[0]), undefined, 'B) 读侧权威回「未选颜色」');
  if (failures === 0) ok('B) 带外回落：四个面都无钩子、样式与未选色行逐字段相同，存储原值不动');
}

// ═══ C) 读不写回 + 存量逐字段不变 ═══
async function groupC() {
  await setupHover();
  writes.length = 0;
  const hover = await mountHoverFaces();
  const wHover = writes.length;
  eq(wHover, 0, 'C) 悬浮两窗（小列表 + 设置页）读取与渲染零写请求：' + JSON.stringify(writes.map((w) => w.method + ' ' + w.url)));
  unmountAll(hover);
  await setupRemoteOn();
  writes.length = 0;
  const remote = await mountRemoteFaces();
  const wRemote = writes.length;
  eq(wRemote, 0, 'C) 远程两窗（大列表 + 智能卡）读取与渲染零写请求：' + JSON.stringify(writes.map((w) => w.method + ' ' + w.url)));
  unmountAll(remote);
  const now = store.allTemplates().filter((t) => !t.builtin).map((t) => JSON.stringify(t)).sort().join('\n');
  const seed = SEED.map((t) => JSON.stringify({ ...t })).sort().join('\n');
  eq(now, seed, 'C) 读一遍后自定义记录与宿主返回逐字段相同（不迁移、不补默认值、不删键）');
  const rec = store.allTemplates().filter((t) => t.id === 'x-outband')[0];
  eq(Object.keys(rec).sort().join(','), 'body,builtin,color,createdAt,id,labels,name,nameEn', 'C) 带外记录的键集合原样（color 键在、没被别的键顶掉）');
  if (failures === 0) ok('C) 读不写回：悬浮/远程两窗各自零写请求 + 记录逐字段不变（含带外 color 键）');
}

// ═══ D) 零新造色值栅栏 ═══
// 登记表：本图改过的源文件里允许出现的**不同** hex 字面量。新增一个颜色 → 这条红，
// 迫使作者先在这里登记它属于「用户数据色板」还是「插件铬色」（ADR-0007 的鉴别口径）。
const KNOWN_HEX = {
  '#f0a45c': '既有插件铬：accent 令牌兜底（ADR-0007 明确不在本图范围、不许改动）',
  '#1a1a1e': '既有插件铬：accent 按钮前景（同上）',
  '#e06c75': '既有插件铬：danger 令牌兜底（同上）',
  '#f43f5e': '用户数据色板：#155 定的 6 色常用快选（INK_PRESETS）之一',
  '#ea580c': '用户数据色板：同上',
  '#16a34a': '用户数据色板：同上',
  '#0d9488': '用户数据色板：同上',
  '#0284c7': '用户数据色板：同上',
  '#a855f7': '用户数据色板：同上',
};
function groupD() {
  const css = panel.INK_TINT_CSS;
  if (/#[0-9a-fA-F]{3,8}\b/.test(css)) fail('D) 描边样式表里出现写死颜色：' + css);
  eq((css.match(/var\(--dsw-alias-label-primary\)/g) || []).length, 8, 'D) 八向描边全用宿主正文令牌（深白浅黑由令牌翻转）');
  const pcode = stripComments(fs.readFileSync(SRC('panel.ts'), 'utf8'));
  const m = /const INK_PRESETS = \[([^\]]*)\]/.exec(pcode);
  eq((m ? m[1] : '').replace(/['\s]/g, ''), '#f43f5e,#ea580c,#16a34a,#0d9488,#0284c7,#a855f7', 'D) 快选色板与 #155 定的 6 色逐字一致');
  const files = ['panel.ts', 'smart.ts', 'index.ts', 'store.ts', 'templates.ts'];
  const seen = new Set();
  for (const f of files) {
    const code = stripComments(fs.readFileSync(SRC(f), 'utf8'));
    for (const hit of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) seen.add(hit[0].toLowerCase());
  }
  eq([...seen].filter((h) => !KNOWN_HEX[h]).join(','), '', 'D) 没有登记表之外的新造色值（新颜色必须先在脚本里登记归属）');
  if (/label-primary-inverted|specific-accent|specific-danger/.test(css)) fail('D) 描边样式表里混进了别的颜色令牌：' + css);
  if (failures === 0) ok('D) 零新造色值：描边只用宿主令牌、快选 6 色逐字一致、全文件 hex 集合等于登记表');
}

// ═══ E) 接线 ═══
function groupE() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  eq(pkg.scripts['test:issue-156'], 'node scripts/test-issue-156.cjs', 'E) package.json 里的 test:issue-156');
  eq(pkg.scripts['test:issue-158'], 'node scripts/test-issue-158.cjs', 'E) #158 的接线仍在（两层分工并存）');
  eq(fs.existsSync(path.join(ROOT, 'scripts', 'test-issue-158.cjs')), true, 'E) #158 的脚本仍在');
  if (failures === 0) ok('E) 接线：两份脚本各管一层、都在 package.json 里');
}

(async () => {
  await groupA();
  await groupB();
  await groupC();
  groupD();
  groupE();
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e));
  process.exit(1);
});
