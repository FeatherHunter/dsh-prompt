'use strict';
/**
 * dsh-prompt #176 回归：带色模板名的描边环**左缘**不再被裁切盒削掉。
 * 跑法：node scripts/repro/test-issue-176.cjs（exit 0 = 全绿）
 *
 * 现象（#176 报告人截图 + 真组件复现）：每一行**带描边**的模板名，其第一个字的左缘描边缺一小段
 * —— 看着像「第一个字左边少了几个像素点」。根因：描边是八向 1px text-shadow，环画在字形**外侧**，
 * 而裁切盒（overflow:hidden）按 padding box 裁；纵向早前已补（paddingBlock 2 / marginBlock -2），
 * **横向没补** ⇒ 第一个字左缘那 1px 环落在裁切矩形之外被削掉。
 *
 * 分组：
 *   A) 静态接线（按面名锚定，不靠字面量计数）：**凡是带纵向补偿的裁切盒都必须带横向补偿**
 *      （内联量相等、负 margin 等量 ⇒ 文字不位移、盒的外框尺寸不变），且一律写在「有颜色才加」的
 *      条件式里；五个面（悬浮小列表 / 设置页行 / 设置页名字 / 远程卡标题 / 智能卡行名 / 取色浮层预览）
 *      逐个点名核对。
 *   B) 渲染（真组件）：悬浮小列表、设置页列表、远程大列表、智能卡、取色浮层预览五面都验；未上色的行
 *      逐字段不变；有颜色但关了描边的行与纵向口径一致（仍留余量）。
 *   C) 描边方案本身没被改：仍是八向 1px text-shadow + 宿主正文令牌，零内联 textShadow、零
 *      -webkit-text-stroke、零 media query。
 *   D) 接线：package.json 有 test:issue-176 与 check:issue-176，且 check 链里挂着 check:issue-176。
 *
 * 边界：像素级观感（描边厚薄）不在本脚本覆盖内 —— 那部分由 headless Chrome 实测承担
 * （见 research/ink-ring-horizontal-clip/findings.md：修前 100% 缩放保留 0%、175% 保留 52%，
 * 拉丁首名 @150% 保留 0% ⇒ 修后 16 组矩阵全 100%）；本脚本钉的是**契约**（谁带补偿、带多少、
 * 是不是等量成对、是不是条件式）。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-176');
const { buildFlat, stripComments } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #156 / #158 门禁同口径） ──
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
    addEventListener() {}, removeEventListener() {}, focus() {},
    setSelectionRange() {}, select() {},
    querySelector(sel) { return querySel(this, sel)[0] || null; },
    querySelectorAll(sel) { return querySel(this, sel); },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
  };
}
const domTextareas = [];
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
  // 智能卡开关（dsh.prompt.smart*）⇒ 1
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}

// ── 夹具：每个模板一个专属标签，好按草稿点名要哪个面出哪几条 ──
const SEED = [
  { id: 'x-ink', name: 'InkFixture', nameEn: '', labels: ['alpha'], body: 'InkFixture body', builtin: false, createdAt: 1, color: '#0284c7' },
  { id: 'x-plain', name: 'PlainFixture', nameEn: '', labels: ['gamma'], body: 'PlainFixture body', builtin: false, createdAt: 3 },
  { id: 'x-nostroke', name: 'NoStrokeFixture', nameEn: '', labels: ['delta'], body: 'NoStrokeFixture body', builtin: false, createdAt: 4, color: '#16a34a', outline: false },
];
function installFetch(remoteMod) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    return {
      ok: true, status: 200,
      json: async () => (/\/store$/.test(u)
        ? { ok: true, value: { customs: SEED, usage: {}, pinned: [], lastUsed: null, remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
        : { ok: true }),
    };
  };
}

installDom('zh-CN');
buildFlat(DIR, [
  SRC('label-identity.ts'), SRC('strings.ts'), SRC('template-library.ts'),
  SRC('template-browser.ts'), SRC('smart-card.ts'), SRC('remote-mode.ts'), SRC('smart-draft.ts'),
]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panel = req('template-browser');
const store = req('template-library');
const smartMod = req('smart-card');
const smartstore = req('smart-draft');
const remoteMod = req('remote-mode');
installFetch(remoteMod);
const React = require('react');
const TR = require('react-test-renderer');

/** 裁切补偿的契约量（与 #158 纵向口径同形：内联量相等、负 margin 等量） */
const ROOM = { paddingInline: 2, marginInline: -2, paddingBlock: 2, marginBlock: -2 };

// ═══ A) 静态接线 ═══
/** 包住 index 的最内层对象字面量（往前找最近的 '{'，再按括号配平取到收尾） */
function enclosingObject(code, index) {
  const start = code.lastIndexOf('{', index);
  if (start < 0) return { text: '', start: -1 };
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { text: code.slice(start, i + 1), start }; }
  }
  return { text: '', start: -1 };
}
/** 横向补偿是否合规：等量成对 + 写在条件式里（有颜色才加） */
function horizontalRoomOk(code, objStart) {
  const obj = enclosingObject(code, objStart).text;
  if (!/paddingInline:\s*2/.test(obj)) return '缺 2px 横向内边距';
  if (!/marginInline:\s*-2/.test(obj)) return '缺同量负 margin（-2）';
  const before = code.slice(Math.max(0, objStart - 40), objStart);
  if (!/\?\s*$/.test(before)) return '没写在条件式里（有颜色才加）';
  return '';
}
function groupA() {
  const panelCode = stripComments(fs.readFileSync(SRC('template-browser.ts'), 'utf8'));
  const smartCode = stripComments(fs.readFileSync(SRC('smart-card.ts'), 'utf8'));
  const idxCode = stripComments(fs.readFileSync(SRC('index.ts'), 'utf8'));

  // A1) 全局不变量：凡是带纵向补偿的裁切盒，都必须带等量成对的横向补偿
  const all = panelCode + '\n' + smartCode;
  const padIdx = [...all.matchAll(/paddingBlock: 2/g)];
  let bad = 0;
  for (const m of padIdx) {
    const objStart = enclosingObject(all, m.index).start;
    const why = horizontalRoomOk(all, objStart);
    if (why) { fail('A) 带纵向补偿的一处裁切盒' + why + '（横向补偿必须与纵向同形：内联 2px + 负 margin 2px）'); bad++; }
    if (!/paddingBlock: 2, marginBlock: -2/.test(enclosingObject(all, m.index).text)) { fail('A) 纵向补偿必须写成 paddingBlock:2 + marginBlock:-2 一对'); bad++; }
  }
  if (padIdx.length === 0) fail('A) 没找到任何纵向补偿点（实现被删了？）');
  else if (bad === 0) ok('A) 全局不变量：' + padIdx.length + ' 处纵向补偿点都带等量成对的横向补偿');

  // A2) 逐面点名（按锚点定位，不靠字面量出现次数）
  const FACES = [
    { name: '悬浮小列表的裁切宿主', code: panelCode, anchor: "alignItems: 'baseline', gap: 6, overflow: 'hidden'" },
    { name: '设置页行的裁切宿主', code: panelCode, anchor: "alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden'" },
    { name: '设置页名字（nmStyle）', code: panelCode, anchor: '...nmStyle, color: ink' },
    { name: '远程卡标题（remoteCardTitle）', code: panelCode, anchor: "...remoteCardTitle, flex: 'none'" },
    { name: '智能卡行名（rowName）', code: smartCode, anchor: '...rowName, color: ink' },
    { name: '取色浮层预览', code: panelCode, anchor: '...(value ? { color: value' },
  ];
  for (const face of FACES) {
    const at = face.code.indexOf(face.anchor);
    if (at < 0) { fail('A) 找不到「' + face.name + '」的锚点（源码结构变了？）'); continue; }
    const m = /paddingBlock: 2/g;
    m.lastIndex = at;
    const hit = m.exec(face.code);
    if (!hit || hit.index > at + 600) { fail('A) 「' + face.name + '」的锚点后面没有找到裁切补偿'); continue; }
    const objStart = enclosingObject(face.code, hit.index).start;
    const why = horizontalRoomOk(face.code, objStart);
    if (why) fail('A) 「' + face.name + '」' + why);
  }
  if (failures === 0) ok('A) 六个补偿点（五个面 + 取色浮层预览）逐个点名核对通过');

  // A3) 描边方案本身没被改
  if (/\btextShadow\b/.test(all)) fail('A) 渲染层不得写内联 textShadow');
  if (/-webkit-text-stroke/.test(all)) fail('A) 渲染层不得用 -webkit-text-stroke');
  if (/prefers-color-scheme/.test(all + idxCode)) fail('A) 不得用 media query 判主题');
  if (!/text-shadow/.test(panelCode)) fail('A) 描边仍走 INK_TINT_CSS 的 text-shadow');
  if (!/var\(--dsw-alias-label-primary\)/.test(panelCode)) fail('A) 描边色仍取宿主正文令牌（不写死颜色）');
  if (failures === 0) ok('A) 描边方案未动（八向 1px text-shadow + 宿主令牌）');
}

// ═══ 渲染小工具 ═══
const styleOf = (n) => (n && n.props && n.props.style) || {};
function assertRoom(node, label) {
  const st = styleOf(node);
  if (!node) { fail('B) ' + label + ' 找不到节点'); return; }
  for (const k of Object.keys(ROOM)) {
    if (st[k] !== ROOM[k]) fail('B) ' + label + ' 的 ' + k + ' 应为 ' + ROOM[k] + '（实际 ' + JSON.stringify(st[k]) + '）');
  }
}
function assertNoRoom(node, label) {
  const st = styleOf(node);
  if (!node) { fail('B) ' + label + ' 找不到节点'); return; }
  for (const k of Object.keys(ROOM)) {
    if (st[k] !== undefined) fail('B) ' + label + ' 不该有 ' + k + '（未上色的行必须逐字段不变，实际 ' + JSON.stringify(st[k]) + '）');
  }
}
const spanWithText = (scope, text) => scope.findAll((n) => n.type === 'span' && Array.isArray(n.children) && n.children.length === 1 && n.children[0] === text)[0];
const nameNodeOf = (root, id, name) => {
  const row = root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] === id)[0];
  return row ? spanWithText(row, name) : null;
};
/** 最近的裁切祖先：真正会切到环的那一圈（padding box） */
function nearestClipBox(node) {
  let p = node && node.parent;
  while (p) {
    const s = p.props && p.props.style;
    if (s && s.overflow === 'hidden') return p;
    p = p.parent;
  }
  return null;
}
async function mount(el) {
  let inst;
  await TR.act(async () => { inst = TR.create(el); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return inst;
}
function unmountAll(faces) {
  for (const inst of Object.values(faces)) { try { TR.act(() => inst.unmount()); } catch (e) { /* 已卸载 */ } }
  globalThis.document.activeElement = null;
  domTextareas.length = 0;
  smartstore.setSmartInput({ draft: '' });
}
/** 远程面板一次翻页把目标卡收齐（远程页槽位有限，自定义不一定落在第一页） */
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

// ═══ B) 渲染（真组件）═══
async function groupB() {
  // ── 面一：悬浮小列表（compact）——名字是裁切宿主的第一个子节点 ⇒ 补偿必须落在宿主上 ──
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  await store.ensureLoaded();
  const hover = await mount(React.createElement(panel.TemplateBrowser, { compact: true }));
  const hInk = nameNodeOf(hover.root, 'x-ink', 'InkFixture');
  if (!hInk) fail('B) 悬浮小列表找不到带色行的名字节点');
  else {
    const clip = nearestClipBox(hInk);
    if (!clip) fail('B) 悬浮小列表的名字找不到裁切祖先');
    else assertRoom(clip, '悬浮小列表的裁切宿主');
    // 名字节点自己不是裁切盒 ⇒ 不该自带补偿（补在这里既无效又会把文字推 2px）
    assertNoRoom(hInk, '悬浮小列表的名字节点');
  }
  const hPlain = nameNodeOf(hover.root, 'x-plain', 'PlainFixture');
  if (hPlain) {
    const clip = nearestClipBox(hPlain);
    if (clip) assertNoRoom(clip, '悬浮小列表里未上色行的裁切宿主');
  }

  // ── 面二：设置页列表（compact:false）——设置行宿主 + 名字（nmStyle）两处都是裁切盒 ──
  const set = await mount(React.createElement(panel.TemplateBrowser, { compact: false }));
  const sInk = nameNodeOf(set.root, 'x-ink', 'InkFixture');
  if (!sInk) fail('B) 设置页列表找不到带色行的名字节点');
  else {
    assertRoom(sInk, '设置页列表的名字节点');
    const clip = nearestClipBox(sInk);
    if (clip) assertRoom(clip, '设置页列表的裁切盒');
  }
  const sPlain = nameNodeOf(set.root, 'x-plain', 'PlainFixture');
  if (sPlain) assertNoRoom(sPlain, '设置页列表里未上色的名字');
  // 有颜色但关了描边：口径与纵向一致（仍留余量，只少一个钩子）
  const sNo = nameNodeOf(set.root, 'x-nostroke', 'NoStrokeFixture');
  if (sNo) assertRoom(sNo, '设置页列表里关了描边但有颜色的名字');

  // ── 面三：取色浮层预览（编辑弹窗里的取色器预览行）──
  const editBtn = set.root.findAll((n) => n.props && n.props['data-dsh-prompt-act'] !== undefined)[0];
  const editBtn2 = editBtn ? editBtn.findAll((n) => n.type === 'button')[0] : null;
  if (!editBtn2) fail('B) 设置页找不到行内操作按钮（编辑入口）');
  else {
    await TR.act(async () => { editBtn2.props.onClick({ stopPropagation() {}, preventDefault() {}, target: null, currentTarget: null }); });
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const fieldBtn = set.root.findAll((n) => n.props && n.props['data-dsh-prompt-ink-field-btn'] !== undefined)[0];
    if (!fieldBtn) fail('B) 编辑弹窗里找不到取色入口（data-dsh-prompt-ink-field-btn）');
    else {
      await TR.act(async () => { fieldBtn.props.onClick({ stopPropagation() {}, preventDefault() {} }); });
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      const pv = set.root.findAll((n) => n.props && n.props['data-dsh-prompt-ink-preview'] !== undefined)[0];
      if (!pv) fail('B) 取色浮层没渲染出预览行（data-dsh-prompt-ink-preview）');
      else {
        const pvName = spanWithText(pv, 'InkFixture');
        if (!pvName) fail('B) 取色浮层预览里找不到名字节点');
        else assertRoom(pvName, '取色浮层预览的名字节点');
      }
    }
  }
  unmountAll({ hover, set });

  // ── 面四：远程大列表（远程总闸开）+ 面五：智能卡 ──
  remoteMod.setRemoteEnabled(true);
  await store.ensureLoaded();
  const ta = { tagName: 'TEXTAREA', value: 'alpha work', offsetParent: {}, closest: () => null, focus() {}, setSelectionRange() {}, selectionStart: 4 };
  globalThis.document.activeElement = ta;
  domTextareas.length = 0;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: 'alpha work' });
  const remote = await mount(React.createElement(panel.TemplateBrowser, { compact: true }));
  const smart = await mount(React.createElement(smartMod.SmartCardHost, {}));
  const cards = await remoteCardsOf(remote, ['x-ink', 'x-plain']);
  if (!cards['x-ink']) fail('B) 远程大列表找不到带色卡（data-dsh-prompt-remote-card）');
  else {
    const title = spanWithText(cards['x-ink'], 'InkFixture');
    if (!title) fail('B) 远程卡里找不到标题节点');
    else assertRoom(title, '远程卡标题');
  }
  if (cards['x-plain']) {
    const title = spanWithText(cards['x-plain'], 'PlainFixture');
    if (title) assertNoRoom(title, '远程卡里未上色的标题');
  }
  const sName = spanWithText(smart.root, 'InkFixture');
  if (!sName) fail('B) 智能卡找不到带色行的名字节点');
  else assertRoom(sName, '智能卡行名');
  const sPlainName = spanWithText(smart.root, 'PlainFixture');
  if (sPlainName) assertNoRoom(sPlainName, '智能卡里未上色的行名');
  unmountAll({ remote, smart });

  if (failures === 0) ok('B) 渲染：五面都带等量横向补偿，未上色的行逐字段不变');
}

// ═══ D) 接线 ═══
function groupD() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const s = pkg.scripts || {};
  eq(s['test:issue-176'], 'node scripts/repro/test-issue-176.cjs', 'D) package.json 缺 test:issue-176 接线');
  eq(s['check:issue-176'], 'node scripts/repro/test-issue-176.cjs', 'D) package.json 缺 check:issue-176 接线');
  if (!String(s.check || '').includes('check:issue-176')) fail('D) npm run check 链里没有 check:issue-176（这张票的门禁不能游离在链外）');
  else ok('D) 接线：test:issue-176 / check:issue-176 都在，check 链挂着 check:issue-176');
}

(async () => {
  await store.ensureLoaded();
  groupA();
  await groupB();
  groupD();
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e));
  process.exit(1);
});
