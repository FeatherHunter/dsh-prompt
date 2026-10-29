'use strict';
/**
 * dsh-prompt hover-tip 回归：整面 title 原生提示 → 按钮上方单行 popover。
 * 跑法：node scripts/repro/test-hover-tip.cjs（exit 0 = 全绿）
 *
 * 覆盖：
 *   A) CSS 静态：fixed 定位 + pointer-events:none + 宿主令牌（无写死色值）+ 上/下两种朝向 + 单行不断行；
 *   B) 运行时（mock 文档）：悬停延迟出现、文案=原 title、定位在按钮上方、悬停期 title 摘除、离开写回；
 *   C) 回归（真 bug）：title 摘除后在按钮子节点（图标/文字）间移动，仍保持接管（timer 不被清、tip 照常出现）；
 *   D) 作用域外 title 不碰（宿主其它提示原样）；
 *   E) 顶部空间不足翻到下方；
 *   F) Esc / 点击收起并写回；键盘 focusin/out 同理。
 */
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-hovertip');
const { buildFlat } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
const need = (cond, msg) => { if (cond) ok(msg); else fail(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── mock 文档（够 hover-tip 用的最小 DOM） ──
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(), nodeType: 1, className: '', children: [], parentElement: null,
    attributes: {}, style: {}, textContent: '', isConnected: true,
    _rect: { left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0 },
    _w: 120, _h: 28, // mock 版式：气泡量得 120×28（被测代码只量气泡自身，不量按钮）
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
    contains(t) { let n = t; while (n) { if (n === this) return true; n = n.parentElement; } return false; },
    closest(sel) {
      const parts = String(sel).split(',').map((s) => s.trim()).filter(Boolean);
      let n = this;
      while (n) {
        for (const p of parts) {
          const m = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(p);
          if (!m) continue;
          const has = Object.prototype.hasOwnProperty.call(n.attributes || {}, m[1]);
          if (has && (m[2] === undefined || n.attributes[m[1]] === m[2])) return n;
        }
        n = n.parentElement;
      }
      return null;
    },
    getBoundingClientRect() { return this._rect; },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(el, 'offsetWidth', { get() { return this._w; } });
  Object.defineProperty(el, 'offsetHeight', { get() { return this._h; } });
  el.classList = {
    add: (c) => { const s = new Set(el.className.split(/\s+/).filter(Boolean)); s.add(c); el.className = [...s].join(' '); },
    remove: (c) => { el.className = el.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
    contains: (c) => el.className.split(/\s+/).includes(c),
  };
  const st = {};
  el.style = {
    setProperty: (k, v) => { st[k] = String(v); },
    getProperty: (k) => st[k] || '',
  };
  return el;
}
function makeDoc() {
  const listeners = {};
  const doc = {
    documentElement: makeEl('html'), head: makeEl('head'), body: null,
    createElement: (t) => makeEl(t),
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: () => {},
    defaultView: { addEventListener() {}, removeEventListener() {} },
    _fire: (type, evt) => { (listeners[type] || []).slice().forEach((fn) => fn(evt)); },
  };
  doc.body = makeEl('body');
  doc.body.parentElement = doc.documentElement;
  return doc;
}
function setRect(el, r) {
  el._rect = { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.top + r.height, right: r.left + r.width };
}

buildFlat(DIR, [SRC('hover-tip.ts')]);
const tip = require(path.join(DIR, 'hover-tip.cjs'));

(async () => {
  // ═══ A) CSS 静态 ═══
  const css = tip.HOVER_TIP_CSS;
  need(css.indexOf('position:fixed') >= 0, 'A) 气泡 position:fixed（portal，不跟鼠标、不被滚动裁切）');
  need(css.indexOf('pointer-events:none') >= 0, 'A) pointer-events:none（不挡点击，划过不闪）');
  need(css.indexOf('white-space:nowrap') >= 0 && css.indexOf('text-overflow:ellipsis') >= 0, 'A) 单行不断行 + 超长省略（用户定稿：单行短提示）');
  need(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'A) 无写死色值（全走 var(--dsw-*) 宿主令牌，深浅主题自动跟随）');
  need(css.indexOf('[data-pos="above"]') >= 0 && css.indexOf('[data-pos="below"]') >= 0, 'A) 上/下两种朝向（顶部空间不够自动翻下）');
  need(typeof tip.HOVER_TIP_SHOW_DELAY === 'number' && typeof tip.HOVER_TIP_FOCUS_DELAY === 'number', 'A) 延迟常量可引（悬停/聚焦两档）');

  // ═══ B/C) 运行时：接管 + 子节点移动回归 ═══
  {
    const doc = makeDoc();
    tip.installHoverTip(doc);
    const bar = makeEl('div'); bar.setAttribute('data-dsh-prompt-bar', '1'); doc.body.appendChild(bar);
    const btn = makeEl('button'); btn.setAttribute('title', '新增自定义模板'); btn.setAttribute('aria-label', '新增自定义模板');
    const icon = makeEl('svg'); btn.appendChild(icon); bar.appendChild(btn);
    setRect(btn, { left: 100, top: 200, width: 60, height: 26 });
    doc._fire('mouseover', { target: btn });
    need(btn.getAttribute('title') === null, 'B) 悬停进入即摘 title（原生约1s延迟，先摘即压住）');
    doc._fire('mouseover', { target: icon }); // C) 移到图标子节点（title 已摘，closest('[title]') 为空）
    await sleep(tip.HOVER_TIP_SHOW_DELAY + 120);
    const b = doc.body.children.filter((c) => c.className.indexOf('dsh-prompt-hover-tip') >= 0)[0];
    need(!!b && b.classList.contains('show'), 'C) 子节点间移动不掐 timer：tip 照常出现（此前 bug：直接 restore 永不出现）');
    need(b && b.children[0] && b.children[0].textContent === '新增自定义模板', 'B) 文案=原 title（零新键，多语言自动跟随）');
    need(b && b.getAttribute('data-pos') === 'above', 'B) 默认在按钮上方（不跟随鼠标）');
    need(b && b.style.top === '164px', 'B) 上方位 top=rect.top-h-8（200-28-8=164，h=28 mock 高）');
    doc._fire('mouseout', { target: icon, relatedTarget: doc.body });
    need(btn.getAttribute('title') === '新增自定义模板', 'B) 离开写回 title（门禁/chrome 钩子读的仍是原值）');
    need(!b.classList.contains('show'), 'B) 离开收起气泡');
  }

  // ═══ D) 作用域外不碰 ═══
  {
    const doc = makeDoc();
    tip.installHoverTip(doc);
    const host = makeEl('button'); host.setAttribute('title', '宿主提示'); doc.body.appendChild(host);
    doc._fire('mouseover', { target: host });
    await sleep(tip.HOVER_TIP_SHOW_DELAY + 120);
    need(host.getAttribute('title') === '宿主提示', 'D) 作用域外 title 原样保留（宿主其它提示不劫持）');
    need(doc.body.children.filter((c) => c.className.indexOf('dsh-prompt-hover-tip') >= 0).length === 0, 'D) 作用域外不起泡');
  }

  // ═══ E) 顶部翻下 ═══
  {
    const doc = makeDoc();
    tip.installHoverTip(doc);
    const list = makeEl('div'); list.setAttribute('data-dsh-prompt-list', '1'); doc.body.appendChild(list);
    const row = makeEl('div'); row.setAttribute('data-dsh-prompt-id', 'x'); row.setAttribute('title', '标签 · 点击即插入');
    list.appendChild(row);
    setRect(row, { left: 100, top: 4, width: 200, height: 24 });
    doc._fire('mouseover', { target: row });
    await sleep(tip.HOVER_TIP_SHOW_DELAY + 120);
    const b = doc.body.children.filter((c) => c.className.indexOf('dsh-prompt-hover-tip') >= 0)[0];
    need(b && b.getAttribute('data-pos') === 'below', 'E) 顶部空间不足翻到下方（首行不被裁）');
    doc._fire('mouseout', { target: row, relatedTarget: doc.body });
  }

  // ═══ F) Esc / 点击 / 聚焦 ═══
  {
    const doc = makeDoc();
    tip.installHoverTip(doc);
    const bar = makeEl('div'); bar.setAttribute('data-dsh-prompt-bar', '1'); doc.body.appendChild(bar);
    const btn = makeEl('button'); btn.setAttribute('title', '关闭'); bar.appendChild(btn);
    setRect(btn, { left: 300, top: 300, width: 26, height: 26 });
    doc._fire('focusin', { target: btn });
    await sleep(tip.HOVER_TIP_FOCUS_DELAY + 120);
    let b = doc.body.children.filter((c) => c.className.indexOf('dsh-prompt-hover-tip') >= 0)[0];
    need(!!b && b.classList.contains('show'), 'F) 键盘聚焦也出 tip（focusin 短延迟）');
    doc._fire('keydown', { key: 'Escape' });
    need(!b.classList.contains('show') && btn.getAttribute('title') === '关闭', 'F) Esc 收起并写回');
    doc._fire('focusin', { target: btn });
    await sleep(tip.HOVER_TIP_FOCUS_DELAY + 120);
    need(b.classList.contains('show'), 'F) 再次聚焦重出');
    doc._fire('click', { target: btn });
    need(!b.classList.contains('show') && btn.getAttribute('title') === '关闭', 'F) 点击收起并写回（面板关窗不残留）');
  }

  console.log(failures === 0 ? '\nRESULT: PASS' : '\nRESULT: FAIL (' + failures + ')');
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((e) => { console.log('FAIL: uncaught ' + (e && e.stack || e)); process.exitCode = 1; });
