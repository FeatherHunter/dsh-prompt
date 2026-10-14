'use strict';
/**
 * dsh-prompt #156 回归：颜色标签的「跨面契约层」+ ADR-0007 两条门禁落点 + 零新造色值栅栏
 * 跑法：node scripts/test-issue-156.cjs（exit 0 = 全绿）
 *
 * 与 #158（scripts/test-issue-158.cjs）的分工：那张票管「控件形状与交互 + 注入缝 + 单面渲染与落盘/清除」，
 * 这张票管「同一份颜色语义在四个面同源 + 读侧不写回 + 存量逐字节不变 + 零新造色值」。
 *
 * 分组：
 *   A) 四面同语义：悬浮列表（compact + 远程关）／设置页列表（compact:false）／远程大列表（远程开，带
 *      data-dsh-prompt-remote-panel 校验，名字节点从 remote-card 里取）／智能卡（SmartCardHost）。
 *      四处名字节点都带 data-dsh-prompt-tint，且都吃同一个读侧权威值。
 *   B) 带外回落：存量里的带外色（#ffffff）在四个面都回落成「未选颜色」——无钩子、样式与真·未选色行逐字段相同。
 *   C) 读不写回：读取 + 渲染全程零写请求（悬浮两窗 / 远程两窗各测一次）；allTemplates() 记录与宿主返回逐字段相同。
 *   D) 色值栅栏：INK_TINT_CSS 零 hex 且只用宿主令牌；四处染色表达式都写 `color: ink`（无字面量）；
 *      本图（151）改过的 6 个源文件里，每个 hex 字面量的**出现次数**必须等于下方冻结基线 —— 新加一处硬编码、
 *      或把用户色板那 6 色当插件铬复用，都会当场红（ADR-0007「两条路不许互相渗透」的落点）。
 *   E) 接线：package.json 有 test:issue-156，且 #158 的脚本与接线仍在（两层并存）。
 *
 * 边界（不在本脚本覆盖内）：不打真实宿主、不做像素级观感；控件的形状/交互与注入缝的归属标记在
 * scripts/test-issue-158.cjs 里钉。「深浅两主题 × 四面」的**渲染证据表**见
 * research/assets/ink-color/faces-{light,dark}.png（生成器 scripts/render-ink-evidence.cjs，
 * 说明 research/ink-render-evidence.md）；真机验收与发版由【真机验收与发版（下一个补丁版本）】承接。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const TMP_DIR = path.join(__dirname, '.rt-tmp-156');
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
/** 四个面（用 CONTEXT.md 词表的叫法）：同一份颜色语义要在这四处同源（下面 A/B 两组共用这一张清单） */
const FACES = ['悬浮列表', '设置页列表', '远程大列表', '智能卡'];
function fixture(id, name, label, color) {
  const t = { id, name, nameEn: '', labels: [label], body: name + ' body', builtin: false, createdAt: SEED_ORDER.length + 1 };
  SEED_ORDER.push(id);
  if (color) t.color = color;
  return t;
}
const SEED_ORDER = [];
const SEED = [
  // 自选标签就是智能卡的候选闸门（match.ts:scoreCustomLabels，一个强命中 = 2 分 = 阈值），
  // 故三个 fixture 各给一个专属标签，好按草稿精确点名要哪个面出哪几条。
  fixture('x-inband', 'InkFixture', 'alpha', '#0284c7'), // 带内色：应当四面都染色 + 带描边钩子
  fixture('x-outband', 'OutFixture', 'beta', '#ffffff'), // 可读带外：读侧回落成「未选颜色」，存储原值不动
  fixture('x-plain', 'PlainFixture', 'gamma'), // 真·未选颜色：对照组
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
buildFlat(TMP_DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('smart.ts'), SRC('remote.ts'), SRC('smartstore.ts')]);
const req = (n) => require(path.join(TMP_DIR, n + '.cjs'));
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
/** 悬浮两窗：远程总闸关（悬浮列表 = 悬浮小列表、设置页列表 = 管理列表） */
async function setupHover() {
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  await store.ensureLoaded();
}
async function mountHoverFaces() {
  return {
    '悬浮列表': await mount(React.createElement(panel.TemplateBrowser, { compact: true })),
    '设置页列表': await mount(React.createElement(panel.TemplateBrowser, { compact: false })),
  };
}
/** 远程两窗：远程总闸开（远程大列表 = 远程面板、智能卡另挂） */
async function setupRemoteOn() {
  remoteMod.setRemoteEnabled(true);
  await store.ensureLoaded();
}
async function mountRemoteFaces(draft) {
  const ta = { tagName: 'TEXTAREA', value: draft, offsetParent: {}, closest: () => null, focus() {}, setSelectionRange() {}, selectionStart: 4 };
  globalThis.document.activeElement = ta;
  domTextareas.length = 0;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft });
  return {
    '远程大列表': await mount(React.createElement(panel.TemplateBrowser, { compact: true })),
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
  eq(hasMarker(hover['悬浮列表'], 'data-dsh-prompt-remote-panel'), false, 'A) 悬浮列表面不是远程面板');
  eq(hasMarker(hover['设置页列表'], 'data-dsh-prompt-remote-panel'), false, 'A) 设置页列表面不是远程面板');
  snap['悬浮列表'] = grabSpan(spanIn(hover['悬浮列表'].root, 'InkFixture'));
  snap['设置页列表'] = grabSpan(spanIn(hover['设置页列表'].root, 'InkFixture'));
  unmountAll(hover);
  await setupRemoteOn();
  const remote = await mountRemoteFaces('alpha work');
  if (!hasMarker(remote['远程大列表'], 'data-dsh-prompt-remote-panel')) fail('A) 远程大列表面没渲染出远程面板（远程总闸没开？）');
  const cards = await remoteCardsOf(remote['远程大列表'], ['x-inband']);
  if (!cards['x-inband']) fail('A) 远程面板翻遍页也没找到目标卡');
  snap['远程大列表'] = grabSpan(cards['x-inband'] ? spanIn(cards['x-inband'], 'InkFixture') : null);
  snap['智能卡'] = grabSpan(spanIn(remote['智能卡'].root, 'InkFixture'));
  unmountAll(remote);

  const seed = store.allTemplates().filter((t) => t.id === 'x-inband')[0];
  const want = store.inkColorOf(seed);
  eq(want, INK_IN, 'A) 读侧权威 inkColorOf 就是种子里的带内色');
  const checkedFaces = [];
  for (const face of FACES) {
    const s = snap[face];
    if (!s) { fail('A) ' + face + ' 面没渲染出带色模板的名字节点'); continue; }
    if (!s.hook) fail('A) ' + face + ' 面名字节点缺钩子属性 ' + panel.INK_TINT_ATTR);
    eq(s.style.color, want, 'A) ' + face + ' 面吃同一个色');
    checkedFaces.push(face);
  }
  eq(checkedFaces.join('/'), FACES.join('/'), 'A) 四个面都验到（一个都不能少）');
  // 源码层面：四处染色表达式都吃同一个变量 ink（没有第二份判据、没有字面量）
  const panelCode = stripComments(fs.readFileSync(SRC('panel.ts'), 'utf8'));
  const smartCode = stripComments(fs.readFileSync(SRC('smart.ts'), 'utf8'));
  eq((panelCode.match(/color: ink \|\| base/g) || []).length, 1, 'A) 悬浮列表行：未上色回退宿主色、上色用用户色（同一个变量）');
  eq((panelCode.match(/color: ink,/g) || []).length, 2, 'A) 远程大列表卡 + 设置页列表行：同一个变量 ink');
  eq((smartCode.match(/color: ink,/g) || []).length, 1, 'A) 智能卡行：同一个变量 ink');
  eq(((panelCode + smartCode).match(/inkColorOf\(/g) || []).length, 4, 'A) 颜色只经 inkColorOf 读（三处渲染查值 + 编辑弹窗初值）');
  eq((panelCode.match(/addCustom\(f\.name, f\.labels, f\.body, f\.color \|\| undefined\)/g) || []).length, 1, 'A) 唯一直接读 .color 的是导入写入口（经 sanitizeInkColor 守卫）');
  eq(((panelCode + smartCode).match(/[A-Za-z_$][\w$]*\.color\b/g) || []).length, 1, 'A) 除导入写入口外，渲染层零裸读 .color（一律过读侧回落）');
  if (failures === 0) ok('A) 四面同语义：四处名字节点都带钩子、都吃同一个读侧权威值');
}

// ═══ B) 带外回落（四个面都当未选颜色） ═══
async function groupB() {
  const got = {};
  await setupHover();
  const hover = await mountHoverFaces();
  for (const face of ['悬浮列表', '设置页列表']) got[face] = { out: grabSpan(spanIn(hover[face].root, 'OutFixture')), plain: grabSpan(spanIn(hover[face].root, 'PlainFixture')) };
  unmountAll(hover);
  await setupRemoteOn();
  const remote = await mountRemoteFaces('beta gamma work');
  const cards = await remoteCardsOf(remote['远程大列表'], ['x-outband', 'x-plain']);
  got['远程大列表'] = {
    out: grabSpan(cards['x-outband'] ? spanIn(cards['x-outband'], 'OutFixture') : null),
    plain: grabSpan(cards['x-plain'] ? spanIn(cards['x-plain'], 'PlainFixture') : null),
  };
  got['智能卡'] = { out: grabSpan(spanIn(remote['智能卡'].root, 'OutFixture')), plain: grabSpan(spanIn(remote['智能卡'].root, 'PlainFixture')) };
  unmountAll(remote);

  const bad = [];
  const compared = [];
  for (const face of FACES) {
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
  eq(compared.length, FACES.length, 'B) 四个面都做了「带外 ≡ 未选色」逐字段对照（实得 ' + compared.join('/') + '）');
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
  eq(wHover, 0, 'C) 悬浮两窗（悬浮列表 + 设置页列表）读取与渲染零写请求：' + JSON.stringify(writes.map((w) => w.method + ' ' + w.url)));
  unmountAll(hover);
  await setupRemoteOn();
  writes.length = 0;
  const remote = await mountRemoteFaces();
  const wRemote = writes.length;
  eq(wRemote, 0, 'C) 远程两窗（远程大列表 + 智能卡）读取与渲染零写请求：' + JSON.stringify(writes.map((w) => w.method + ' ' + w.url)));
  unmountAll(remote);
  const now = store.allTemplates().filter((t) => !t.builtin).map((t) => JSON.stringify(t)).sort().join('\n');
  const seed = SEED.map((t) => JSON.stringify({ ...t })).sort().join('\n');
  eq(now, seed, 'C) 读一遍后自定义记录与宿主返回逐字段相同（不迁移、不补默认值、不删键）');
  const rec = store.allTemplates().filter((t) => t.id === 'x-outband')[0];
  eq(Object.keys(rec).sort().join(','), 'body,builtin,color,createdAt,id,labels,name,nameEn', 'C) 带外记录的键集合原样（color 键在、没被别的键顶掉）');
  if (failures === 0) ok('C) 读不写回：悬浮/远程两窗各自零写请求 + 记录逐字段不变（含带外 color 键）');
}

// ═══ D) 零新造色值栅栏 ═══
// 归属登记表：每个允许出现的 hex 属于哪条路，必须先在这里写清楚（ADR-0007 的鉴别口径）。
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
// 冻结基线：本图（151）改过的 6 个源文件 × 每个 hex 的**出现次数**（去注释后的代码级计数）。
// 用计数而不是集合：注册过的色值被**新增**一处硬编码同样要红 —— 例如把用户色板的 `#0284c7`
// 拿去当插件铬色（ADR-0007「用户数据与插件铬两条路不许互相渗透」），计数一变立刻暴露。
const FROZEN_HEX = {
  'panel.ts': { '#f0a45c': 14, '#1a1a1e': 2, '#e06c75': 5, '#f43f5e': 1, '#ea580c': 1, '#16a34a': 1, '#0d9488': 1, '#0284c7': 1, '#a855f7': 1 },
  'smart.ts': { '#f0a45c': 1 },
  'index.ts': {},
  'i18n.ts': {},
  'store.ts': {},
  'templates.ts': {},
};
const hexCounts = (file) => {
  const counts = {};
  for (const hit of stripComments(fs.readFileSync(SRC(file), 'utf8')).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const key = hit[0].toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
};
const hexDigest = (counts) => Object.keys(counts).sort().map((k) => k + '×' + counts[k]).join(' ');
function groupD() {
  const css = panel.INK_TINT_CSS;
  if (/#[0-9a-fA-F]{3,8}\b/.test(css)) fail('D) 描边样式表里出现写死颜色：' + css);
  eq((css.match(/var\(--dsw-alias-label-primary\)/g) || []).length, 8, 'D) 八向描边全用宿主正文令牌（深白浅黑由令牌翻转）');
  const pcode = stripComments(fs.readFileSync(SRC('panel.ts'), 'utf8'));
  const m = /const INK_PRESETS = \[([^\]]*)\]/.exec(pcode);
  eq((m ? m[1] : '').replace(/['\s]/g, ''), '#f43f5e,#ea580c,#16a34a,#0d9488,#0284c7,#a855f7', 'D) 快选色板与 #155 定的 6 色逐字一致');
  for (const file of Object.keys(FROZEN_HEX)) {
    const counts = hexCounts(file);
    eq(hexDigest(counts), hexDigest(FROZEN_HEX[file]), 'D) ' + file + ' 的 hex 字面量出现次数等于冻结基线（新增或删掉一处硬编码都要在这里登记）');
    const unregistered = Object.keys(counts).filter((h) => !KNOWN_HEX[h]);
    eq(unregistered.join(','), '', 'D) ' + file + ' 里每个色值都已在归属登记表里写明属于哪条路');
  }
  if (/label-primary-inverted|specific-accent|specific-danger/.test(css)) fail('D) 描边样式表里混进了别的颜色令牌：' + css);
  if (failures === 0) ok('D) 零新造色值：描边只用宿主令牌、快选 6 色逐字一致、6 个源文件的 hex 计数等于冻结基线');
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
