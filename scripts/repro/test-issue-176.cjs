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
 * 覆盖：
 *   A) 静态接线：六处裁切补偿点各带横向配方（paddingInline 1 / marginInline -1），且与纵向补偿写在
 *      同一个「有颜色才加」的条件式里；正负成对（+1 / -1 ⇒ 文字不位移、盒的外框尺寸不变）。
 *   B) 渲染（真组件）：带色名字**最近的裁切祖先**必须带横向补偿（悬浮小列表 ⇒ 裁切宿主；设置页列表 ⇒
 *      名字节点自身）；未上色的行逐字段不变；有颜色但关了描边的行与纵向口径一致（仍带余量）。
 *   C) 描边方案本身没被改：仍是八向 1px text-shadow + 宿主正文令牌，零内联 textShadow、零
 *      -webkit-text-stroke、零 media query。
 *
 * 边界：像素级观感（描边厚薄）不在本脚本覆盖内 —— 那部分由 headless Chrome 实测（见 issue #176 的
 * 核实评论：100% / 175% 缩放下首字左缘保留率 0% / 52% ⇒ 修后 100% / 100%）与
 * research/ink-stroke-rendering.md §2.2 的配方承担；本脚本钉的是**契约**（谁带补偿、带多少）。
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

// ── DOM 桩（与 #158 门禁同口径） ──
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
  const head = mkEl('head');
  const body = mkEl('body');
  globalThis.document = {
    documentElement: docEl, head, body, activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: (sel) => querySel(head, sel)[0] || null,
    querySelectorAll: (sel) => (String(sel) === 'textarea' ? domTextareas : querySel(head, sel)),
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}

const SEED = [
  { id: 'x-ink', name: 'InkFixture', nameEn: '', labels: ['EnLabel'], body: 'in-band body', builtin: false, createdAt: 1, color: '#0284c7' },
  { id: 'x-plain', name: 'PlainFixture', nameEn: '', labels: [], body: 'plain body', builtin: false, createdAt: 3 },
  { id: 'x-nostroke', name: 'NoStrokeFixture', nameEn: '', labels: [], body: 'no stroke body', builtin: false, createdAt: 4, color: '#16a34a', outline: false },
];
function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { customs: SEED, usage: {}, pinned: [], lastUsed: null } }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

installDom('zh-CN');
installFetch();
buildFlat(DIR, [SRC('template-browser.ts'), SRC('smart-card.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panel = req('template-browser');
const store = req('template-library');
const React = require('react');
const TR = require('react-test-renderer');

// ═══ A) 静态接线 ═══
function groupA() {
  const panelCode = stripComments(fs.readFileSync(SRC('template-browser.ts'), 'utf8'));
  const smartCode = stripComments(fs.readFileSync(SRC('smart-card.ts'), 'utf8'));
  const idxCode = stripComments(fs.readFileSync(SRC('index.ts'), 'utf8'));
  const all = panelCode + '\n' + smartCode;
  let bad = 0;
  const need = (cond, msg) => { if (!cond) { fail(msg); bad++; } };

  // 六处裁切补偿点：紧凑行宿主 / 设置行宿主 / nmStyle / 远程标题 / 智能卡行名 / 弹窗预览
  const padSites = [...all.matchAll(/paddingBlock: 2/g)];
  eq(padSites.length, 6, 'A) 裁切补偿共六处（紧凑行宿主 / 设置行宿主 / nmStyle / 远程标题 / 智能卡行名 / 弹窗预览）');
  // #176：横向补偿同样六处，与纵向写在同一个条件式里
  const inlineSites = [...all.matchAll(/paddingInline: 1/g)];
  eq(inlineSites.length, 6, 'A) #176 横向补偿共六处（每个带色名字的裁切盒都得有）');
  eq((all.match(/marginInline: -1/g) || []).length, 6, 'A) #176 横向补偿的负 margin 同样六处（成对出现）');
  const inlineConditional = inlineSites.filter((m) => /(ink|value) \?/.test(all.slice(Math.max(0, m.index - 80), m.index))).length;
  eq(inlineConditional, inlineSites.length, 'A) 六处横向补偿一律条件式（有颜色时才加，未上色的行零改动）');
  // 成对：+1 与 -1 必须同处一个对象（否则文字会位移 1px / 外框会变宽）
  const paired = inlineSites.filter((m) => /paddingInline: 1, marginInline: -1/.test(all.slice(m.index, m.index + 60))).length;
  eq(paired, inlineSites.length, 'A) 横向补偿必须写成 paddingInline:1 + marginInline:-1 一对（正负等量 ⇒ 文字不位移、外框不变）');
  const blockPaired = padSites.filter((m) => /paddingBlock: 2, marginBlock: -2/.test(all.slice(m.index, m.index + 60))).length;
  eq(blockPaired, padSites.length, 'A) 纵向补偿仍是 paddingBlock:2 + marginBlock:-2 一对');
  // #176 要点：悬浮小列表那一处必须落在**裁切宿主**上（名字是它的第一个子节点，名字自己不是裁切盒）
  need(/overflow: 'hidden'[^}]*paddingBlock: 2, marginBlock: -2, paddingInline: 1, marginInline: -1/.test(panelCode),
    'A) 悬浮小列表的裁切宿主应带横向补偿（外层还裁时，只给名字 span 加 padding 无效）');
  // C) 描边方案本身没被改
  need(!/\btextShadow\b/.test(all), 'A) 渲染层不得写内联 textShadow');
  need(!/-webkit-text-stroke/.test(all), 'A) 渲染层不得用 -webkit-text-stroke');
  need(!/prefers-color-scheme/.test(all + idxCode), 'A) 不得用 media query 判主题');
  need(/text-shadow/.test(panelCode), 'A) 描边仍走 INK_TINT_CSS 的 text-shadow');
  need(/var\(--dsw-alias-label-primary\)/.test(panelCode), 'A) 描边色仍取宿主正文令牌（不写死颜色）');
  if (failures === 0) ok('A) 静态接线：六处裁切盒各带横向补偿（条件式 + 正负成对），描边方案未动');
}

// ═══ 渲染小工具 ═══
const byAttr = (root, attr, val) => root.findAll((x) => x.props && (val === undefined ? x.props[attr] !== undefined : x.props[attr] === val));
const nameNodeOf = (root, id, name) => {
  const row = byAttr(root, 'data-dsh-prompt-id', id)[0];
  return row ? row.findAll((n) => n.type === 'span' && Array.isArray(n.children) && n.children[0] === name)[0] : null;
};
/** 最近的裁切祖先：真正会切到环的那一圈（padding box） */
function nearestClipBox(node) {
  let p = node.parent;
  while (p) {
    const s = p.props && p.props.style;
    if (s && s.overflow === 'hidden') return p;
    p = p.parent;
  }
  return null;
}
const styleOf = (n) => (n && n.props && n.props.style) || {};
function assertRingRoom(node, label) {
  const st = styleOf(node);
  if (st.paddingInline !== 1) fail('B) ' + label + ' 缺 1px 横向内边距（环的左缘会被裁）');
  if (st.marginInline !== -1) fail('B) ' + label + ' 缺同量负 margin（否则文字位移 1px / 外框变宽）');
}
function assertNoRingRoom(node, label) {
  const st = styleOf(node);
  if (st.paddingInline !== undefined || st.marginInline !== undefined) fail('B) ' + label + ' 不该有横向补偿（未上色的行必须逐字段不变）');
}

// ═══ B) 渲染（真组件）═══
function groupB() {
  const inst = (compact) => {
    let r;
    TR.act(() => { r = TR.create(React.createElement(panel.TemplateBrowser, { compact })); });
    return r;
  };
  // 悬浮小列表（compact）：名字是裁切宿主的第一个子节点 ⇒ 补偿必须落在宿主上
  const hover = inst(true);
  const hInk = nameNodeOf(hover.root, 'x-ink', 'InkFixture');
  if (!hInk) fail('B) 悬浮小列表找不到带色行的名字节点');
  else {
    const clip = nearestClipBox(hInk);
    if (!clip) fail('B) 悬浮小列表的名字找不到裁切祖先');
    else {
      assertRingRoom(clip, '悬浮小列表的裁切宿主');
      if (styleOf(clip).paddingBlock !== 2) fail('B) 悬浮小列表的裁切宿主缺纵向余量（回归）');
      if (styleOf(clip).marginBlock !== -2) fail('B) 悬浮小列表的裁切宿主缺同量负 margin（回归）');
    }
    // 名字节点自己不是裁切盒 ⇒ 不该自带补偿（补在这里既无效（外层还裁）又会把文字推 1px）
    assertNoRingRoom(hInk, '悬浮小列表的名字节点');
  }
  // 设置页列表：名字节点自身（nmStyle）就是裁切盒 ⇒ 补偿落在名字上
  const set = inst(false);
  const sInk = nameNodeOf(set.root, 'x-ink', 'InkFixture');
  if (!sInk) fail('B) 设置页列表找不到带色行的名字节点');
  else {
    assertRingRoom(sInk, '设置页列表的名字节点');
    const clip = nearestClipBox(sInk);
    if (clip) assertRingRoom(clip, '设置页列表的裁切盒');
  }
  // 未上色的行：逐字段不变（既没有纵向也没有横向补偿）
  const sPlain = nameNodeOf(set.root, 'x-plain', 'PlainFixture');
  if (!sPlain) fail('B) 设置页列表找不到未上色对照行');
  else assertNoRingRoom(sPlain, '未上色的名字');
  // 有颜色但关了描边：口径与纵向一致（仍留余量，只少一个钩子）
  const sNo = nameNodeOf(set.root, 'x-nostroke', 'NoStrokeFixture');
  if (!sNo) fail('B) 设置页列表找不到「关了描边」的行');
  else assertRingRoom(sNo, '关了描边但有颜色的名字');
  try { TR.act(() => { hover.unmount(); set.unmount(); }); } catch (e) { /* 已卸载 */ }
  if (failures === 0) ok('B) 渲染：带色名字的裁切盒都带横向补偿，未上色的行逐字段不变');
}

(async () => {
  await store.ensureLoaded();
  groupA();
  groupB();
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e));
  process.exit(1);
});
