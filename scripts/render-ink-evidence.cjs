'use strict';
/**
 * dsh-prompt #156 的「渲染证据表」生成器（手工工具，不是门禁；不进 npm scripts）。
 *
 * 用途：把「深浅两主题 × 四个面」的名字渲染拍成两张可复现的图，填进
 * research/assets/ink-color/faces-{light,dark}.png。
 *
 * 它凭什么算证据（而不是手抄的示意）：
 *   1. 每个格子里的名字节点与内联样式，取自**真组件**在 react-test-renderer 下的渲染结果
 *      （悬浮列表 / 设置页列表 / 远程大列表 / 智能卡 各挂真组件，远程面沿 data-dsh-prompt-remote-card 翻页定位）；
 *   2. 描边来自**真实** `INK_TINT_CSS`（src/client/panel.ts 的八向 1px text-shadow，色 var(--dsw-alias-label-primary)）；
 *   3. 背景与令牌子用**宿主真值**（浅 #ffffff / 深 #151517；正文令牌子 #0f1115 / #f9fafb）。
 * 边界：它是渲染证据表，**不是真机截图**；真机深浅两主题四面验收由「真机验收与发版（下一个补丁版本）」承接。
 *
 * 跑法（两步，Chrome 路径按机器调整）：
 *   node scripts/render-ink-evidence.cjs
 *   "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
 *     --force-device-scale-factor=2 --window-size=1180,620 \
 *     --screenshot=research/assets/ink-color/faces-light.png "file:///<仓库>/.wayfinder/ink-evidence/light.html"
 *   （深色同法，换 dark.html 与 faces-dark.png）
 * 生成的 html 落在 .wayfinder/ink-evidence/（未跟踪的临时目录）；两张 PNG 才是提交物。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const TMP_DIR = path.join(__dirname, '.rt-tmp-evidence');
const OUT = path.join(ROOT, '.wayfinder', 'ink-evidence');
const { buildFlat } = require('./lib/transpile-client.cjs');

const SAMPLES = [
  { id: 'e-ink', name: '复盘模板', color: '#0284c7', label: 'alpha' },
  { id: 'e-plain', name: '未上色模板', label: 'beta' },
];
const DRAFT = 'alpha beta work';

// ── DOM 桩（与回归脚本同口径，够 styleOwnership / 智能卡的 textarea 探测用） ──
const domTextareas = [];
function querySel() { return []; }
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
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
  };
}
function installDom(lang) {
  globalThis.document = {
    documentElement: Object.assign(mkEl('html'), { lang }), head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: (sel) => (String(sel) === 'textarea' ? domTextareas : []),
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}
installDom('zh-CN');
buildFlat(TMP_DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('smart.ts'), SRC('remote.ts'), SRC('smartstore.ts')]);
const req = (n) => require(path.join(TMP_DIR, n + '.cjs'));
const panel = req('panel');
const store = req('store');
const smartMod = req('smart');
const smartstore = req('smartstore');
const remoteMod = req('remote');
globalThis.fetch = async (url) => ({
  ok: true, status: 200,
  json: async () => (/\/store$/.test(String(url))
    ? { ok: true, value: { customs: SAMPLES.map((s, i) => Object.assign({ id: s.id, name: s.name, nameEn: '', labels: [s.label], body: s.name + ' body', builtin: false, createdAt: i + 1 }, s.color ? { color: s.color } : {})), usage: {}, pinned: [], lastUsed: null, remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
    : { ok: true }),
});
const React = require('react');
const TR = require('react-test-renderer');

async function mount(el) {
  let inst;
  await TR.act(async () => { inst = TR.create(el); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return inst;
}
const spanIn = (scope, name) => scope.findAll((n) => n.type === 'span' && Array.isArray(n.children) && n.children.length === 1 && n.children[0] === name)[0];
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
const grab = (sp) => (sp ? { text: sp.children[0], hook: sp.props[panel.INK_TINT_ATTR] !== undefined, style: Object.assign({}, sp.props.style) } : null);

async function collect() {
  const names = SAMPLES.map((s) => s.name);
  const byFace = {};
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  await store.ensureLoaded();
  const hover = { '悬浮列表': await mount(React.createElement(panel.TemplateBrowser, { compact: true })), '设置页列表': await mount(React.createElement(panel.TemplateBrowser, { compact: false })) };
  for (const [face, inst] of Object.entries(hover)) { byFace[face] = {}; for (const n of names) byFace[face][n] = grab(spanIn(inst.root, n)); }
  for (const inst of Object.values(hover)) { try { TR.act(() => inst.unmount()); } catch (e) { /* 已卸载 */ } }

  remoteMod.setRemoteEnabled(true);
  await store.ensureLoaded();
  const ta = { tagName: 'TEXTAREA', value: DRAFT, offsetParent: {}, closest: () => null, focus() {}, setSelectionRange() {}, selectionStart: 4 };
  globalThis.document.activeElement = ta;
  domTextareas.length = 0;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: DRAFT });
  const remoteInst = await mount(React.createElement(panel.TemplateBrowser, { compact: true }));
  const smartInst = await mount(React.createElement(smartMod.SmartCardHost, {}));
  const cards = await remoteCardsOf(remoteInst, SAMPLES.map((s) => s.id));
  byFace['远程大列表'] = {};
  byFace['智能卡'] = {};
  for (const s of SAMPLES) {
    byFace['远程大列表'][s.name] = grab(cards[s.id] ? spanIn(cards[s.id], s.name) : null);
    byFace['智能卡'][s.name] = grab(spanIn(smartInst.root, s.name));
  }
  return byFace;
}

const UNITLESS = new Set(['fontweight', 'opacity', 'lineheight', 'zindex', 'flexgrow', 'flexshrink', 'order']);
function cssOf(style) {
  return Object.entries(style).map(([k, v]) => {
    const prop = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    const val = typeof v === 'number' && !UNITLESS.has(k.toLowerCase()) ? v + 'px' : String(v);
    return prop + ':' + val;
  }).join(';');
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(theme, byFace) {
  const light = theme === 'light';
  const bg = light ? '#ffffff' : '#151517';
  const label = light ? '#0f1115' : '#f9fafb';
  const meta = light ? '#6b7280' : '#9ca3af';
  const faces = ['悬浮列表', '设置页列表', '远程大列表', '智能卡'];
  const rows = faces.map((face) => {
    const cells = SAMPLES.map((s) => {
      const g = byFace[face] && byFace[face][s.name];
      if (!g) return '<td class="miss">该面本页没有这一项</td>';
      const attrs = g.hook ? ' ' + panel.INK_TINT_ATTR : '';
      return '<td><span class="nm" style="' + esc(cssOf(g.style)) + '"' + attrs + '>' + esc(g.text) + '</span></td>';
    }).join('');
    return '<tr><th>' + esc(face) + '</th>' + cells + '</tr>';
  }).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>#156 渲染证据 · ${light ? '浅色主题' : '深色主题'}</title>
<style>
  :root { --dsw-alias-label-primary: ${label}; }
  html,body { margin:0; background:${bg}; color:var(--dsw-alias-label-primary); }
  body { font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif; padding:28px 32px 32px; }
  h1 { font-size:19px; margin:0 0 4px; }
  p.meta { color:${meta}; font-size:12.5px; margin:0 0 18px; line-height:1.7; }
  table { border-collapse:collapse; }
  th,td { text-align:left; padding:14px 22px 14px 0; font-weight:400; font-size:20px; vertical-align:middle; }
  th { font-size:13.5px; color:${meta}; padding-right:26px; white-space:nowrap; }
  td.miss { font-size:12.5px; color:${meta}; }
  .hdr th { border-bottom:1px solid ${light ? '#e5e7eb' : '#2c2c2e'}; font-size:12.5px; padding-bottom:8px; }
  ${panel.INK_TINT_CSS}
</style></head><body>
<h1>#156 渲染证据表 · ${light ? '浅色主题' : '深色主题'}</h1>
<p class="meta">
每格的名字节点与内联样式<b>取自真组件渲染结果</b>（不是手抄）；描边来自真实 <code>INK_TINT_CSS</code>（八向 1px <code>text-shadow</code>，色 <code>var(--dsw-alias-label-primary)</code>）；
背景与令牌子用宿主真值（浅 <code>#ffffff</code> / 深 <code>#151517</code>；正文令牌子 <code>#0f1115</code> / <code>#f9fafb</code>）。<br>
口径：这是<b>渲染证据表</b>，不是真机截图 —— 真机深浅两主题四面验收由「真机验收与发版（下一个补丁版本）」承接。
</p>
<table>
<tr class="hdr"><th></th><th>已选颜色（${SAMPLES[0].color}）</th><th>未选颜色（对照：跟随主题、无描边）</th></tr>
${rows}
</table>
</body></html>`;
}

(async () => {
  const byFace = await collect();
  fs.mkdirSync(OUT, { recursive: true });
  for (const theme of ['light', 'dark']) {
    const f = path.join(OUT, theme + '.html');
    fs.writeFileSync(f, page(theme, byFace), 'utf8');
    console.log('WROTE ' + path.relative(ROOT, f));
  }
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  for (const theme of ['light', 'dark']) {
    console.log('RUN "' + chrome + '" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1180,620 --screenshot=research/assets/ink-color/faces-' + theme + '.png "file:///' + path.join(OUT, theme + '.html').replace(/\\/g, '/') + '"');
  }
  console.log(JSON.stringify({ faces: Object.fromEntries(Object.entries(byFace).map(([face, cells]) => [face, Object.fromEntries(Object.entries(cells).map(([n, g]) => [n, g ? { hook: g.hook, color: g.style.color } : null]))])) }));
  process.exit(0); // react-test-renderer 的宿主句柄会把事件循环挂住，出图脚本写完就退
})().catch((e) => { console.log('ERR ' + ((e && e.stack) || e)); process.exit(1); });
