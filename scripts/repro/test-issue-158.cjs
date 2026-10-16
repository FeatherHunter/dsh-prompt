'use strict';
/**
 * dsh-prompt #158/#161 回归：取色控件（弹窗内一行按钮 + 浮层全可点色块墙 + 预览）与四处名字染色（钩子属性 + 注入描边 + 落盘/清除/存量不改写）
 * 跑法：node scripts/repro/test-issue-158.cjs（exit 0 = 全绿）
 *
 * 覆盖（对抗式，逐条对应票 158 的验收与「方案」评论里的自查清单）：
 *   A) 静态接线：钩子属性与 CSS 唯一真相、四处名字节点都接线、渲染层零内联 textShadow、
 *      零 media query、零 -webkit-text-stroke、注入只走 styleOwnership 共用缝（不自建裸 <style>）、
 *      裁切补偿一律写成「有颜色才加」的条件式。
 *   B) 注入缝运行时：applyOwnedStyle 打 data-plugin='dsh-prompt' + 私有标记，重复注入幂等（同标记只一段）。
 *   C) 控件形状与交互（#161）：弹窗里只有一行按钮 → 点开浮层：12 档色相 × 带内深浅的色块墙（零灰格子）/
 *   D) 渲染：有色的名字带钩子属性 + 该色；未选色（含**存量里带外的值**）的名字属性为零、样式与未上色行逐字段相同。
 *   E) 落盘：新建带色 → 存储有该键；编辑点「默认」→ 键消失。
 *   F) ADR-0007：存量带外值（#ffffff）经编辑保存后原样保留（不吸附、不改写、不删），出站形状逐字段带着它。
 *
 * 边界（不在本脚本覆盖内，已在票里明示）：不打真实宿主、不做像素级描边观感（那部分在
 * research/ink-stroke-rendering.md 的对照图与像素统计里）；注入段在真实引导路径上的落地由
 * `scripts/check-lib-sync.mjs`（构建产物）+ 手工开面板确认兜。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-158');
const { buildFlat, stripComments } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #134 门禁同口径：够 ModalPortal / styleOwnership 用，属性可读可写） ──
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
  const head = mkEl('head');
  const body = mkEl('body');
  const doc = {
    documentElement: docEl, head, body, activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: (sel) => querySel(head, sel)[0] || null,
    querySelectorAll: (sel) => querySel(head, sel),
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.document = doc;
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
  return doc;
}

// ── 宿主写桥：记下每一次 POST，供 F) 断言出站形状 ──
const putBodies = [];
const SEED = [
  { id: 'x-inband', name: 'InkFixture', nameEn: '', labels: ['EnLabel'], body: 'in-band body', builtin: false, createdAt: 1, color: '#0284c7' },
  { id: 'x-outband', name: 'OutFixture', nameEn: '', labels: [], body: 'out-of-band body', builtin: false, createdAt: 2, color: '#ffffff' },
  { id: 'x-plain', name: 'PlainFixture', nameEn: '', labels: [], body: 'plain body', builtin: false, createdAt: 3 },
  // #162：有色但用户关掉了描边 ⇒ 该染色、零描边钩子
  { id: 'x-nostroke', name: 'NoStrokeFixture', nameEn: '', labels: [], body: 'no stroke body', builtin: false, createdAt: 4, color: '#16a34a', outline: false },
];
function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    try { if (init && init.body) putBodies.push({ url: u, body: JSON.parse(String(init.body)) }); } catch (e) { /* ignore */ }
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { customs: SEED, usage: {}, pinned: [], lastUsed: null } }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

installDom('zh-CN');
installFetch();
buildFlat(DIR, [SRC('template-browser.ts'), SRC('smart-card.ts'), SRC('style-ownership.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panel = req('template-browser');
const store = req('template-library');
const i18n = req('strings');
const owner = req('style-ownership');
const React = require('react');
const TR = require('react-test-renderer');
const STR = i18n.STR;
const zh = (k) => i18n.tr('zh', STR[k]);

// ═══ A) 静态接线 ═══
function groupA() {
  const panelCode = stripComments(fs.readFileSync(SRC('template-browser.ts'), 'utf8'));
  const smartCode = stripComments(fs.readFileSync(SRC('smart-card.ts'), 'utf8'));
  const idxCode = stripComments(fs.readFileSync(SRC('index.ts'), 'utf8'));
  const all = panelCode + '\n' + smartCode;
  let bad = 0;
  const need = (cond, msg) => { if (!cond) { fail(msg); bad++; } };

  need(/export const INK_TINT_ATTR = 'data-dsh-prompt-tint'/.test(panelCode), 'A) 缺 INK_TINT_ATTR 唯一真相');
  eq((panelCode.match(/\[INK_TINT_ATTR\]: ''/g) || []).length, 4, 'A) template-browser.ts 四处接钩子（紧凑行 / 设置行 / 远程卡 + 弹窗预览）');
  eq((smartCode.match(/\[INK_TINT_ATTR\]: ''/g) || []).length, 1, 'A) smart-card.ts 一处名字节点接钩子');
  need(!/\btextShadow\b/.test(all), 'A) 渲染层不得写内联 textShadow（内联优先级会焊死描边方案）');
  need(!/prefers-color-scheme/.test(all + idxCode), 'A) 不得用 media query 判主题（浏览器端与手动主题相反）');
  need(!/-webkit-text-stroke/.test(all), 'A) 渲染层不得用 -webkit-text-stroke（DPR 1.25 实心环掉 77%）');
  need(/from '\.\/style-ownership'/.test(idxCode), 'A) index.ts 的注入必须走 styleOwnership 归属缝');
  need(/applyOwnedStyle\(doc, INK_STYLE_MARKER, INK_TINT_CSS\)/.test(idxCode), 'A) index.ts 应把 INK_TINT_CSS 交给 applyOwnedStyle');
  need(/INK_TINT_CSS\b/.test(idxCode), 'A) index.ts 应复用 template-browser.ts 的 CSS 唯一真相');
  need(/applyInkTintStyle\(\)/.test(idxCode), 'A) index.ts 的 apply 里应调用一次注入');
  need(!/createElement\('style'\)/.test(idxCode), 'A) index.ts 不得自建裸 <style>（归属账本会认不出）');
  // 裁切补偿：六处，每处都必须是「有颜色才加」的条件式（未上色的行与今天逐字节一致）
  const padSites = [...all.matchAll(/paddingBlock: 2/g)];
  eq(padSites.length, 6, 'A) 裁切补偿共六处（紧凑行宿主 / 设置行宿主 / nmStyle / 远程标题 / 智能卡行名 / 弹窗预览）');
  const conditional = padSites.filter((m) => /(ink|value) \?/.test(all.slice(Math.max(0, m.index - 60), m.index))).length;
  eq(conditional, padSites.length, 'A) 六处补偿一律条件式（有颜色时才加，未上色的行零改动）');
  // R3（真机三项）：① 描边开关搬进「一行收口」 ② 该行三控件同皮等高 ③ 可点控件有 hover/active/focus 反馈
  need(/export const INK_UI_CSS/.test(panelCode), 'R3) template-browser.ts 应导出取色浮层的交互反馈样式段 INK_UI_CSS');
  need(/'data-dsh-prompt-ink-row': '1'/.test(panelCode), 'R3) 「一行收口」容器应带 data-dsh-prompt-ink-row');
  {
    const rowAt = panelCode.indexOf("'data-dsh-prompt-ink-row': '1'");
    const olAt = panelCode.indexOf('data-dsh-prompt-ink-outline-row', rowAt);
    const rowClose = panelCode.indexOf(']),', rowAt);
    need(rowAt > 0 && olAt > rowAt, 'R3) 描边开关必须排在一行收口容器之后（同一行内，不再自己占一行）');
    need(rowClose < 0 || olAt < rowClose, 'R3) 描边开关应落在该行容器的子节点里（不能挂在容器外）');
  }
  need(/applyOwnedStyle\(doc, INK_UI_STYLE_MARKER, INK_UI_CSS\)/.test(idxCode), 'R3) index.ts 应经归属缝注入交互反馈段（另一条私有标记）');
  need(/INK_UI_CSS\b/.test(idxCode) && /applyInkUiStyle\(\)/.test(idxCode), 'R3) index.ts 应复用 template-browser.ts 的 INK_UI_CSS 并在 apply 里调一次');
  {
    const ui = panel.INK_UI_CSS;
    need(typeof ui === 'string' && ui.length > 200, 'R3) INK_UI_CSS 应是一段真样式（实得 ' + String(ui).length + ' 字符）');
    need(/:hover\{/.test(ui) && /:active\{/.test(ui) && /:focus-visible\{/.test(ui) && /:focus\{/.test(ui), 'R3) 反馈段应含 hover / active / focus / focus-visible 四类');
    need(/\[data-dsh-prompt-ink-cell\]:hover/.test(ui), 'R3) 色块要有 hover 反馈');
    need(/\[data-dsh-prompt-ink-default\]/.test(ui), 'R3) 「默认」键要有反馈');
    need(/\[data-dsh-prompt-ink-outline-row\]:hover/.test(ui), 'R3) 描边开关整行要有 hover 反馈');
    need(/\[data-dsh-prompt-ink-hex\]:focus/.test(ui), 'R3) 十六进制框聚焦要有环（它内联 outline:none）');
    need(/\[data-dsh-prompt-ink-outline\]:focus-visible\{/.test(ui), 'R3) 焦点环要挂在能聚焦的 checkbox 上（挂在描边行的 <label> 上永远不会亮）');
    need(!/#[0-9a-fA-F]{3,6}\b/.test(ui), 'R3) 反馈段不得写死颜色（一律走宿主令牌）');
    need(!/text-shadow/.test(ui) && !/-webkit-text-stroke/.test(ui), 'R3) 反馈段不得碰描边通道（textShadow / -webkit-text-stroke）');
    // 悬停 vs 选中：色块选中态是 2px label-primary 边框（template-browser.ts 色块 style），悬停若也用 label-primary
    // 画环，两者同形 ⇒ 悬停一个没选中的格子看起来就是已选中。中性令牌画悬停、label-primary 留给选中/聚焦。
    need(/\[data-dsh-prompt-ink-cell\]:hover\{[^}]*var\(--dsw-alias-border-l2\)/.test(ui), 'R3) 色块悬停环应用中性令牌（border-l2）');
    need(!/\[data-dsh-prompt-ink-cell\]:hover\{[^}]*var\(--dsw-alias-label-primary\)/.test(ui), 'R3) 色块悬停不得用选中态令牌 label-primary');
    need(/\[data-dsh-prompt-ink-outline-row\]:hover\{[^}]*var\(--dsw-alias-border-l2\)/.test(ui), 'R3) 描边开关整行悬停环也用中性令牌（背景令牌画环几乎看不见）');
    // 常亮杀（真机报障：默认/完成/× 的环常亮，根因是鼠标点按留下的焦点不走）：
    // 鼠标焦点永不着色（键盘 :focus-visible 不受影响）；三键 + 入口键 mousedown 拦默认聚焦。
    need(/:focus:not\(:focus-visible\)\{[^}]*outline:none/.test(ui), 'R3) 鼠标焦点永不着色（:focus 非 visible 即清环）');
    need((panelCode.match(/onMouseDown: noStickyFocus/g) || []).length >= 4, 'R3) 完成/×/默认/入口四键都应拦 mousedown 默认聚焦（实得 ' + ((panelCode.match(/onMouseDown: noStickyFocus/g) || []).length) + ' 处）');
    need(/const noStickyFocus[\s\S]{0,300}preventDefault/.test(panelCode), 'R3) noStickyFocus 应拦默认行为（click 照常、键盘不受影响）');
    need(!/'ink-ui'/.test(panelCode), 'R3) 私有样式标记只在 index.ts 一处定义（template-browser.ts 不得再导出同值常量：同一标记两处真相会各自漂移）');
  }
  // 三控件同皮的实现：公共皮 inkRowCtlStyle（固定 height/1px 边框），选中态 inkRowCtlOnStyle 只改颜色 + inset 环。
  need(/const inkRowCtlStyle[\s\S]{0,240}height: '2\.6em'/.test(panelCode), 'R3) 该行控件共用公共皮，且高度用 em（写死 px 在大字档下会溢出：3 档实测）');
  need(/const inkRowCtlOnStyle[\s\S]{0,200}boxShadow: 'inset 0 0 0 1px/.test(panelCode), 'R3) 选中态应是 inset 环而不是加粗边框');
  need(!/const inkRowCtlOnStyle[\s\S]{0,160}border: '/.test(panelCode), 'R3) 选中态不得覆写 border（宽度一变，整行高度就跟着变）');
  need(/'aria-pressed': value === '' \? 'true' : 'false'[\s\S]{0,160}inkRowCtlOnStyle/.test(panelCode), 'R3) 「默认」键选中态应走 inkRowCtlOnStyle');
  if (failures === 0) ok('A) 静态接线：钩子唯一真相 + 4 处接线 + 零内联/零 media/零 stroke + 注入走共用缝 + 条件补偿 + R3 三项');
}

// ═══ B) 注入缝运行时 + CSS 本体 ═══
function groupB() {
  const css = panel.INK_TINT_CSS;
  if (typeof css !== 'string' || css.indexOf('[' + panel.INK_TINT_ATTR + ']{text-shadow:') !== 0) fail('B) INK_TINT_CSS 形状不对：' + String(css).slice(0, 60));
  const inkRefs = (css.match(/var\(--dsw-alias-label-primary\)/g) || []).length;
  eq(inkRefs, 8, 'B) 八向描边全用宿主正文令牌');
  const value = (/text-shadow:([^}]*)\}/.exec(css) || [])[1] || '';
  const dirs = value.split(',').map((s) => s.trim().split(/\s+/).slice(0, 2).join(' ').replace(/0px/g, '0'));
  const want = ['-1px -1px', '-1px 0', '-1px 1px', '0 -1px', '0 1px', '1px -1px', '1px 0', '1px 1px'];
  eq(dirs.slice().sort().join(' | '), want.join(' | '), 'B) 八个方向齐全（四正交 + 四对角）');
  if (/#[0-9a-fA-F]{3,6}\b/.test(css)) fail('B) CSS 里不得出现写死的颜色：' + css);
  const doc = installDom('zh-CN');
  owner.applyOwnedStyle(doc, 'ink-tint', css);
  const tags = () => doc.head.children.filter((c) => String(c.tagName).toLowerCase() === 'style');
  eq(tags().length, 1, 'B) 注入后 head 里恰有一段自家样式');
  eq(tags()[0].getAttribute('data-plugin'), 'dsh-prompt', 'B) 归属键 data-plugin=dsh-prompt（宿主账本据此回收）');
  eq(tags()[0].getAttribute('data-dsh-prompt-style'), 'ink-tint', 'B) 私有标记可查（幂等键）');
  eq(tags()[0].textContent, css, 'B) 段内容全等于 INK_TINT_CSS');
  const first = tags()[0];
  owner.applyOwnedStyle(doc, 'ink-tint', css);
  eq(tags().length, 1, 'B) 重复注入幂等（同标记只留一段）');
  eq(tags()[0], first, 'B) 同值不重建（复用同一节点）');
  if (failures === 0) ok('B) 注入缝：归属打标 + 幂等 + CSS 八向宿主令牌零写死颜色');
}

// ═══ 渲染小工具 ═══
const textOf = (n) => (Array.isArray(n.children) ? n.children.filter((c) => typeof c === 'string').join('') : '');
const byText = (root, txt) => root.findAll((x) => x.type === 'button' && Array.isArray(x.children) && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
const byAttr = (root, attr, val) => root.findAll((x) => x.props && (val === undefined ? x.props[attr] !== undefined : x.props[attr] === val));
const byPlaceholder = (root, ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === ph)[0];
function render(compact) {
  let inst;
  TR.act(() => { inst = TR.create(React.createElement(panel.TemplateBrowser, { compact })); });
  return inst;
}
function openAddModal(inst) {
  const add = byText(inst.root, '＋');
  if (!add) { fail('找不到 ＋ 新增键'); return false; }
  TR.act(() => { add.props.onClick(); });
  return true;
}
function editRow(inst, id) {
  const row = byAttr(inst.root, 'data-dsh-prompt-id', id)[0];
  if (!row) { fail('找不到行 ' + id); return false; }
  const btn = row.findAll((x) => x.type === 'button' && textOf(x) === zh('edit'))[0];
  if (!btn) { fail('行 ' + id + ' 找不到编辑键'); return false; }
  TR.act(() => { btn.props.onClick({ stopPropagation() {} }); });
  return true;
}
function clickSave(inst, key) {
  const btn = byText(inst.root, zh(key));
  if (!btn) { fail('弹窗里找不到 ' + key + ' 键'); return false; }
  TR.act(() => { btn.props.onClick(); });
  return true;
}

// ═══ C) 控件形状与交互（#161：弹窗里一行按钮 + 点开的浮层色块墙）═══
async function groupC() {
  await store.ensureLoaded();
  const inst = render(false);
  if (!openAddModal(inst)) return;
  const root = inst.root;
  // 入口：弹窗里只有一行按钮；浮层默认不展开；旧控件（快选/色相条/灰格子）一律不再存在
  const btn = byAttr(root, 'data-dsh-prompt-ink-field-btn')[0];
  if (!btn) { fail('C) 缺取色入口按钮'); inst.unmount(); return; }
  eq(btn.props['aria-expanded'], 'false', 'C) 未点开时入口按钮 aria-expanded=false');
  if (byAttr(root, 'data-dsh-prompt-ink-pop').length !== 0) fail('C) 浮层不该默认展开（弹窗里只占一行）');
  if (byAttr(root, 'data-dsh-prompt-ink-preset').length !== 0) fail('C) #161 起不再有 6 色快选（色块墙取代）');
  if (byAttr(root, 'data-dsh-prompt-ink-hue').length !== 0) fail('C) #161 起不再有色相条（色块墙取代）');
  if (byAttr(root, 'data-dsh-prompt-ink-shade').length !== 0) fail('C) #161 起不再有会灰掉的深浅格');
  // 点开浮层
  TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
  eq(byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props['aria-expanded'], 'true', 'C) 点开后入口按钮 aria-expanded=true');
  if (!byAttr(root, 'data-dsh-prompt-ink-pop')[0]) fail('C) 点开入口按钮后应出现浮层');
  const dflt = byAttr(root, 'data-dsh-prompt-ink-default')[0];
  if (!dflt) fail('C) 缺「默认」格');
  else {
    eq(dflt.props['aria-pressed'], 'true', 'C) 新建时「默认」格选中（aria-pressed）');
    eq(textOf(dflt), zh('colorDefaultShort'), 'C) 「默认」格走词表 colorDefaultShort');
  }
  // 色块墙：12 档色相 × 各色相下带内深浅；**每个格子都可点**（零灰格子 = #161 的要害）
  if (!byAttr(root, 'data-dsh-prompt-ink-wall')[0]) fail('C) 浮层缺色块墙容器');
  eq(byAttr(root, 'data-dsh-prompt-ink-hue-col').length, 12, 'C) 色块墙横轴 12 档色相');
  const cells = byAttr(root, 'data-dsh-prompt-ink-cell');
  if (cells.length < 24) fail('C) 色块墙太小（实得 ' + cells.length + '）');
  eq(cells.filter((c) => c.props.disabled === true).length, 0, 'C) 墙上没有任何 disabled 格子（每个都点得动）');
  const outOfBand = cells.filter((c) => {
    const L = store.relativeLuminance(c.props['data-dsh-prompt-ink-cell']);
    return !(L >= store.INK_PICK_L_MIN && L <= store.INK_PICK_L_MAX);
  });
  eq(outOfBand.length, 0, 'C) 墙上 ' + cells.length + ' 格逐格验算：全部落在可读带内');
  // 预览条：未选色时不带描边钩子
  const pv0 = byAttr(root, 'data-dsh-prompt-ink-preview')[0];
  if (!pv0) fail('C) 浮层缺预览条');
  else {
    eq(pv0.props['data-dsh-prompt-ink-preview'], 'default', 'C) 未选色时预览态为 default');
    if (pv0.findAll((n) => n.props && n.props[panel.INK_TINT_ATTR] !== undefined).length !== 0) fail('C) 未选色时预览不该带描边钩子');
    // #162：没选颜色 ⇒ 连「文字描边」开关都不出现（无颜色＝无描边，不摆点不动的灰控件）
    if (byAttr(root, 'data-dsh-prompt-ink-outline-row').length !== 0) fail('C) 未选色时不该出现描边开关');
  }
  // 交互：点一个格子 → 选中态 + 预览 + 十六进制三处同步
  const picked = cells[cells.length - 1].props['data-dsh-prompt-ink-cell'];
  TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-cell', picked)[0].props.onClick(); });
  eq(byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.value, picked, 'C) 点色块后十六进制回填该值');
  eq(byAttr(root, 'data-dsh-prompt-ink-cell', picked)[0].props['aria-pressed'], 'true', 'C) 点中的色块 aria-pressed=true');
  const pv1 = byAttr(root, 'data-dsh-prompt-ink-preview')[0];
  eq(pv1.props['data-dsh-prompt-ink-preview'], picked, 'C) 预览态跟着选中色走');
  const pvName = pv1.findAll((n) => n.props && n.props.style && n.props.style.color === picked)[0];
  if (!pvName) fail('C) 预览里的名字没拿到该色');
  else if (pvName.props[panel.INK_TINT_ATTR] === undefined) fail('C) 预览里的名字缺描边钩子（选了色就该描边）');
  eq(byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.placeholder, zh('colorHexPh'), 'C) 十六进制输入占位走词表');
  // 带外 hex：提示可见且状态不变（不吸附、不静默吞掉）
  TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.onChange({ target: { value: '#ffffff' } }); });
  if (!byAttr(root, 'data-dsh-prompt-ink-warn')[0]) fail('C) 带外十六进制应显示「看不清」提示');
  eq(byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.value, '#ffffff', 'C) 输入框保留用户输入（不悄悄改写）');
  eq(byAttr(root, 'data-dsh-prompt-ink-preview')[0].props['data-dsh-prompt-ink-preview'], picked, 'C) 带外输入不改已选颜色（不吸附）');
  // #162 文字描边开关：选了色才长出来，默认开；关掉预览立刻不描边，再打开立刻恢复
  const olRow = byAttr(root, 'data-dsh-prompt-ink-outline-row')[0];
  if (!olRow) fail('C) 选了颜色后应出现「文字描边」开关');
  else {
    const cb = byAttr(root, 'data-dsh-prompt-ink-outline')[0];
    if (!cb) fail('C) 缺描边开关本体（checkbox）');
    else {
      eq(cb.props.type, 'checkbox', 'C) 描边开关是开关控件（checkbox）');
      eq(cb.props.checked, true, 'C) 描边开关默认开（＝今天的行为）');
      const olLabel = olRow.findAll((n) => n.type === 'span' && Array.isArray(n.children) && typeof n.children[0] === 'string')[0];
      eq(olLabel ? olLabel.children[0] : '', zh('colorOutline'), 'C) 开关文案走词表 colorOutline');
      TR.act(() => { cb.props.onChange({ target: { checked: false } }); });
      eq(byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.checked, false, 'C) 点一下变成关');
      const pvOff = byAttr(root, 'data-dsh-prompt-ink-preview')[0];
      if (pvOff.findAll((n) => n.props && n.props[panel.INK_TINT_ATTR] !== undefined).length !== 0) fail('C) 关掉描边后预览不该再带钩子');
      const pvOffName = pvOff.findAll((n) => n.props && n.props.style && n.props.style.color === picked)[0];
      if (!pvOffName) fail('C) 关掉描边后预览里的名字应仍是该色（只是不描边）');
      TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.onChange({ target: { checked: true } }); });
      const pvOn = byAttr(root, 'data-dsh-prompt-ink-preview')[0];
      if (pvOn.findAll((n) => n.props && n.props[panel.INK_TINT_ATTR] !== undefined).length === 0) fail('C) 重新打开描边后预览应恢复钩子');
    }
  }
  // R3（真机三项）：描边开关与「默认 / 十六进制」同行且三控件等高 —— 真机反馈「高度不一致」的根因是
  // 默认键选中态把边框 1px→2px、十六进制框整段套 modalFieldStyle（0.96em + 8/10 内边距），各按各的盒子算高。
  {
    const rowBox = byAttr(root, 'data-dsh-prompt-ink-row')[0];
    if (!rowBox) fail('R3) 浮层缺「一行收口」容器（data-dsh-prompt-ink-row）');
    else {
      eq(rowBox.findAll((n) => n.props && n.props['data-dsh-prompt-ink-outline-row'] !== undefined).length, 1,
        'R3) 描边开关应挂在一行收口容器内（不是容器外的独立行）');
      const dCtl = byAttr(root, 'data-dsh-prompt-ink-default')[0];
      const hCtl = byAttr(root, 'data-dsh-prompt-ink-hex')[0];
      const oCtl = byAttr(root, 'data-dsh-prompt-ink-outline-row')[0];
      const heights = [dCtl, hCtl, oCtl].map((n) => (n && n.props.style ? n.props.style.height : null));
      // 断言口径：这里钉的是**内联样式对象**（jsdom 桩没有布局引擎，量不出真实盒高）。真正的不变量是
      //「三控件共用同一高度口径，且高度用相对单位」—— headless Chrome 实测（research/palette-ui-163/
      // _probe-variants.html 的 A/B/C 三方案）：写死 32px 时 2 档起 0.9em 文字就溢出盒子（3 档 50.4px
      // 文字塞进 32px 盒）；min-height:32 三控件高不相等（输入框 35 vs 32）；2.6em 在 1/2/3/5 档全部
      // 「三控件等高 + 零溢出」。所以断言 = 三个值彼此相等且以 em 结尾，不钉魔数。
      eq(new Set(heights.map(String)).size, 1, 'R3) 该行三个控件共用同一高度口径（实得 ' + heights.join(',') + '）');
      if (!heights.every((h) => /em$/.test(String(h)))) fail('R3) 高度必须用相对单位（写死 px 在大字档下会溢出：3 档实测）');
      eq([dCtl, hCtl, oCtl].filter((n) => n && n.props.style && n.props.style.boxSizing === 'border-box').length, 3,
        'R3) 三控件都应 box-sizing:border-box（边框宽度不许参与盒子尺寸）');
      eq(String(dCtl.props.style.border || ''), '1px solid var(--dsw-alias-border-l1)',
        'R3) 未选中态是 1px 边框（选中态只换色 + inset 环，永远不用 2px，见静态断言）');
    }
  }
  // 「完成」收起浮层
  const done = byText(byAttr(root, 'data-dsh-prompt-ink-pop')[0], zh('colorDone'));
  if (!done) fail('C) 浮层缺「完成」键');
  else TR.act(() => { done.props.onClick(); });
  if (byAttr(root, 'data-dsh-prompt-ink-pop').length !== 0) fail('C) 点「完成」应收起浮层');
  TR.act(() => { inst.unmount(); });
  if (failures === 0) ok('C) 控件：一行按钮 + 浮层 12×带内深浅全可点色块墙（零 disabled）+ 预览 + 十六进制 + 带外提示');
}

// ═══ D/E/F) 渲染 + 落盘/清除 + 存量不改写 ═══
async function groupD() {
  const inst = render(false);
  const root = inst.root;
  const nameSpanOf = (id, name) => {
    const row = byAttr(root, 'data-dsh-prompt-id', id)[0];
    return row ? row.findAll((n) => n.type === 'span' && Array.isArray(n.children) && n.children[0] === name)[0] : null;
  };
  // D) 有色的存量行 → 名字带钩子 + 该色 + 裁切补偿
  const inName = nameSpanOf('x-inband', 'InkFixture');
  if (!inName) fail('D) 设置页找不到带色存量行的名字节点');
  else {
    if (inName.props[panel.INK_TINT_ATTR] === undefined) fail('D) 有色的名字节点缺钩子属性 ' + panel.INK_TINT_ATTR);
    eq(inName.props.style.color, '#0284c7', 'D) 有色的名字用该色（不是主题色）');
    eq(inName.props.style.paddingBlock, 2, 'D) 有色的名字给 2px 纵向余量（描边不被裁）');
    eq(inName.props.style.marginBlock, -2, 'D) 同量负 margin（行高预算不动）');
  }
  // D) #162 存量「关了描边」的行 → 仍然染色、但零描边钩子
  const noName = nameSpanOf('x-nostroke', 'NoStrokeFixture');
  if (!noName) fail('D) 设置页找不到「关了描边」的存量行');
  else {
    if (noName.props[panel.INK_TINT_ATTR] !== undefined) fail('D) 关掉描边的名字节点不该带描边钩子');
    eq(noName.props.style.color, '#16a34a', 'D) 关掉描边仍然染色（只是不描边）');
    eq(noName.props.style.paddingBlock, 2, 'D) 关掉描边仍保留裁切余量（渲染路径不变，只少一个钩子）');
  }
  // D) 存量带外值 → 读侧回落：无属性、样式与未上色行逐字段相同
  const outName = nameSpanOf('x-outband', 'OutFixture');
  const plainName = nameSpanOf('x-plain', 'PlainFixture');
  if (!outName || !plainName) fail('D) 设置页缺少带外/未上色对照行');
  else {
    if (outName.props[panel.INK_TINT_ATTR] !== undefined) fail('D) 存量带外值不得上屏染色（读侧应回落成未选颜色）');
    eq(JSON.stringify(outName.props.style), JSON.stringify(plainName.props.style), 'D) 带外值的名字样式与未上色行逐字段相同');
  }
  // F) 编辑带外值那一行：只改名字 → 存储里的带外值原样保留（ADR-0007）
  putBodies.length = 0;
  if (editRow(inst, 'x-outband')) {
    const nm = byPlaceholder(root, zh('namePh'));
    TR.act(() => { nm.props.onChange({ target: { value: 'OutFixture2' } }); });
    clickSave(inst, 'save');
    const rec = store.allTemplates().filter((t) => t.id === 'x-outband')[0];
    eq(rec.name, 'OutFixture2', 'D) 编辑改名生效');
    eq(rec.color, '#ffffff', 'F) 存量带外值改名后原样保留（不吸附、不改写、不删）');
    const outs = putBodies.filter((p) => /customs\/put/.test(p.url)).map((p) => p.body.template).filter((t) => t && t.id === 'x-outband');
    const last = outs[outs.length - 1];
    eq(last && last.color, '#ffffff', 'F) 出站形状逐字段带着带外值（toHostShape 不加工颜色）');
    // #162 窄边界：color 带外 ⇒ 读侧就是「未选颜色」⇒ 这次只改名字的保存不得顺手写下 outline 键（ADR-0007）
    eq(Object.prototype.hasOwnProperty.call(rec, 'outline'), false, 'F) 带外 color 的存量记录改名保存不得新增 outline 键（判据＝读侧 inkColorOf）');
    eq(last && last.outline, undefined, 'F) 出站形状也不得凭空多出 outline 键');
  }
  // F2) 同一行随后选一个合法颜色：开关必须以「开」长出来（#162：选了颜色时默认开），取消不改盘
  if (editRow(inst, 'x-outband')) {
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
    eq(byAttr(root, 'data-dsh-prompt-ink-outline-row').length, 0, 'F) 带外值（读侧＝未选颜色）在浮层里不该有描边开关');
    const legal = byAttr(root, 'data-dsh-prompt-ink-cell')[0].props['data-dsh-prompt-ink-cell'];
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-cell', legal)[0].props.onClick(); });
    eq(byAttr(root, 'data-dsh-prompt-ink-outline-row').length, 1, 'F) 选一个合法颜色后描边开关长出来');
    eq(byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.checked, true, 'F) 带外值记录选色后开关默认开（不得预置为关）');
    clickSave(inst, 'cancel');
    const recKept = store.allTemplates().filter((t) => t.id === 'x-outband')[0];
    eq(recKept.color, '#ffffff', 'F) 取消后存量带外值仍原样（弹窗只是本地态）');
    eq(Object.prototype.hasOwnProperty.call(recKept, 'outline'), false, 'F) 取消也不得留下 outline 键');
  }
  // F3) 数据层守卫本身（不经弹窗）：带外 color 的记录，任何调用方送 outline:false 都不得落键
  putBodies.length = 0;
  store.updateCustom('x-outband', { outline: false });
  const recGuard = store.allTemplates().filter((t) => t.id === 'x-outband')[0];
  eq(recGuard.color, '#ffffff', 'F) 直调 updateCustom 后带外值仍原样');
  eq(Object.prototype.hasOwnProperty.call(recGuard, 'outline'), false, 'F) 直调 updateCustom 送 outline:false：带外 color 记录不得落 outline 键（判据＝读侧 inkColorOf）');
  const guardOut = putBodies.filter((p) => /customs\/put/.test(p.url)).map((p) => p.body.template).filter((t) => t && t.id === 'x-outband').pop();
  eq(guardOut && guardOut.outline, undefined, 'F) 直调守卫的出站形状也不得多出 outline 键');
  // E) 新建带色 → 落盘；#162 描边开关：关 ⇒ 落 outline:false / 再开 ⇒ 删键 / 点「默认」⇒ color+outline 一起消失
  if (openAddModal(inst)) {
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
    const pickHex = byAttr(root, 'data-dsh-prompt-ink-cell')[0].props['data-dsh-prompt-ink-cell'];
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props.onClick(); });
    eq(byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.value, pickHex, 'D) 点色块后十六进制回填');
    // #162：新建时把描边关掉
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.onChange({ target: { checked: false } }); });
    TR.act(() => { byText(byAttr(root, 'data-dsh-prompt-ink-pop')[0], zh('colorDone')).props.onClick(); });
    if (byAttr(root, 'data-dsh-prompt-ink-pop').length !== 0) fail('D) 点「完成」后浮层应收起');
    const nm = byPlaceholder(root, zh('namePh'));
    const bd = byPlaceholder(root, zh('bodyPh'));
    if (!nm || !bd) fail('D) 弹窗里找不到名称/正文输入框');
    else {
      TR.act(() => { nm.props.onChange({ target: { value: 'NewInkFixture' } }); });
      TR.act(() => { bd.props.onChange({ target: { value: 'new ink body' } }); });
      clickSave(inst, 'addOk');
      const rec = store.allTemplates().filter((t) => t.name === 'NewInkFixture')[0];
      if (!rec) fail('D) 新建带色模板没落进存储');
      else {
        eq(rec.color, pickHex, 'E) 新建带色落盘（addCustom 第 4 参）');
        eq(rec.outline, false, 'E) 新建时关掉描边 ⇒ 落 outline:false（addCustom 第 5 参）');
        const newName = nameSpanOf(rec.id, 'NewInkFixture');
        if (!newName) fail('D) 新行没渲染出来');
        else {
          eq(newName.props.style.color, pickHex, 'E) 关了描边的新行仍然染色');
          if (newName.props[panel.INK_TINT_ATTR] !== undefined) fail('E) 关了描边的新行不该带钩子');
        }
        if (editRow(inst, rec.id)) {
          TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
          eq(byAttr(root, 'data-dsh-prompt-ink-default')[0].props['aria-pressed'], 'false', 'D) 编辑已有颜色时「默认」格不是选中态');
          eq(byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props['aria-pressed'], 'true', 'D) 编辑时该色在墙上为选中态');
          eq(byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.checked, false, 'E) 重开弹窗时描边开关如实反映存量（关）');
          // 把描边打开 ⇒ 默认态不写键（键应被删掉，颜色保留）
          TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-outline')[0].props.onChange({ target: { checked: true } }); });
          clickSave(inst, 'save');
          const recOn = store.allTemplates().filter((t) => t.id === rec.id)[0];
          eq(recOn.color, pickHex, 'E) 重新打开描边后颜色仍在');
          eq(Object.prototype.hasOwnProperty.call(recOn, 'outline'), false, 'E) 打开描边 ⇒ outline 键删除（默认态不写键）');
          const onName = nameSpanOf(rec.id, 'NewInkFixture');
          if (onName && onName.props[panel.INK_TINT_ATTR] === undefined) fail('E) 重新打开描边后该行应恢复钩子');
          // 再编辑：点「默认」清空颜色 ⇒ color 与 outline 一起消失
          if (editRow(inst, rec.id)) {
            TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
            TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-default')[0].props.onClick(); });
            eq(byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props['aria-pressed'], 'false', 'D) 点「默认」后墙上不再有选中态');
            if (byAttr(root, 'data-dsh-prompt-ink-outline-row').length !== 0) fail('E) 点「默认」后描边开关应随颜色一起消失');
            clickSave(inst, 'save');
            const rec2 = store.allTemplates().filter((t) => t.id === rec.id)[0];
            eq(Object.prototype.hasOwnProperty.call(rec2, 'color'), false, 'E) 点「默认」保存后 color 键消失（不是写成 #ffffff）');
            eq(Object.prototype.hasOwnProperty.call(rec2, 'outline'), false, 'E) 点「默认」保存后 outline 键一并消失（不留孤儿数据）');
          }
        }
      }
    }
  }
  TR.act(() => { inst.unmount(); });
  if (failures === 0) ok('D/E/F) 渲染与落盘：带色名字染色 + 关描边零钩子 + 带外回落照旧 + 新建落键 + 清除删键 + 存量带外值零改写（含不新增 outline 键）');
}

(async () => {
  groupA();
  groupB();
  await groupC();
  await groupD();
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e));
  process.exit(1);
});
