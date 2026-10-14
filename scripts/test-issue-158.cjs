'use strict';
/**
 * dsh-prompt #158/#161 回归：取色控件（弹窗内一行按钮 + 浮层全可点色块墙 + 预览）与四处名字染色（钩子属性 + 注入描边 + 落盘/清除/存量不改写）
 * 跑法：node scripts/test-issue-158.cjs（exit 0 = 全绿）
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
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-158');
const { buildFlat, stripComments } = require('./lib/transpile-client.cjs');

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
buildFlat(DIR, [SRC('panel.ts'), SRC('smart.ts'), SRC('styleOwnership.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panel = req('panel');
const store = req('store');
const i18n = req('i18n');
const owner = req('styleOwnership');
const React = require('react');
const TR = require('react-test-renderer');
const STR = i18n.STR;
const zh = (k) => i18n.tr('zh', STR[k]);

// ═══ A) 静态接线 ═══
function groupA() {
  const panelCode = stripComments(fs.readFileSync(SRC('panel.ts'), 'utf8'));
  const smartCode = stripComments(fs.readFileSync(SRC('smart.ts'), 'utf8'));
  const idxCode = stripComments(fs.readFileSync(SRC('index.ts'), 'utf8'));
  const all = panelCode + '\n' + smartCode;
  let bad = 0;
  const need = (cond, msg) => { if (!cond) { fail(msg); bad++; } };

  need(/export const INK_TINT_ATTR = 'data-dsh-prompt-tint'/.test(panelCode), 'A) 缺 INK_TINT_ATTR 唯一真相');
  eq((panelCode.match(/\[INK_TINT_ATTR\]: ''/g) || []).length, 4, 'A) panel.ts 四处接钩子（紧凑行 / 设置行 / 远程卡 + 弹窗预览）');
  eq((smartCode.match(/\[INK_TINT_ATTR\]: ''/g) || []).length, 1, 'A) smart.ts 一处名字节点接钩子');
  need(!/\btextShadow\b/.test(all), 'A) 渲染层不得写内联 textShadow（内联优先级会焊死描边方案）');
  need(!/prefers-color-scheme/.test(all + idxCode), 'A) 不得用 media query 判主题（浏览器端与手动主题相反）');
  need(!/-webkit-text-stroke/.test(all), 'A) 渲染层不得用 -webkit-text-stroke（DPR 1.25 实心环掉 77%）');
  need(/from '\.\/styleOwnership'/.test(idxCode), 'A) index.ts 的注入必须走 styleOwnership 归属缝');
  need(/applyOwnedStyle\(doc, INK_STYLE_MARKER, INK_TINT_CSS\)/.test(idxCode), 'A) index.ts 应把 INK_TINT_CSS 交给 applyOwnedStyle');
  need(/INK_TINT_CSS\b/.test(idxCode), 'A) index.ts 应复用 panel.ts 的 CSS 唯一真相');
  need(/applyInkTintStyle\(\)/.test(idxCode), 'A) index.ts 的 apply 里应调用一次注入');
  need(!/createElement\('style'\)/.test(idxCode), 'A) index.ts 不得自建裸 <style>（归属账本会认不出）');
  // 裁切补偿：六处，每处都必须是「有颜色才加」的条件式（未上色的行与今天逐字节一致）
  const padSites = [...all.matchAll(/paddingBlock: 2/g)];
  eq(padSites.length, 6, 'A) 裁切补偿共六处（紧凑行宿主 / 设置行宿主 / nmStyle / 远程标题 / 智能卡行名 / 弹窗预览）');
  const conditional = padSites.filter((m) => /(ink|value) \?/.test(all.slice(Math.max(0, m.index - 60), m.index))).length;
  eq(conditional, padSites.length, 'A) 六处补偿一律条件式（有颜色时才加，未上色的行零改动）');
  if (failures === 0) ok('A) 静态接线：钩子唯一真相 + 4 处接线 + 零内联/零 media/零 stroke + 注入走共用缝 + 条件补偿');
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
  }
  // E) 新建带色 → 落盘；编辑点「默认」→ 键消失
  if (openAddModal(inst)) {
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
    const pickHex = byAttr(root, 'data-dsh-prompt-ink-cell')[0].props['data-dsh-prompt-ink-cell'];
    TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props.onClick(); });
    eq(byAttr(root, 'data-dsh-prompt-ink-hex')[0].props.value, pickHex, 'D) 点色块后十六进制回填');
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
        const newName = nameSpanOf(rec.id, 'NewInkFixture');
        if (!newName) fail('D) 新行没渲染出来');
        else if (newName.props[panel.INK_TINT_ATTR] === undefined) fail('D) 新行名字缺钩子属性');
        if (editRow(inst, rec.id)) {
          TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-field-btn')[0].props.onClick(); });
          eq(byAttr(root, 'data-dsh-prompt-ink-default')[0].props['aria-pressed'], 'false', 'D) 编辑已有颜色时「默认」格不是选中态');
          eq(byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props['aria-pressed'], 'true', 'D) 编辑时该色在墙上为选中态');
          TR.act(() => { byAttr(root, 'data-dsh-prompt-ink-default')[0].props.onClick(); });
          eq(byAttr(root, 'data-dsh-prompt-ink-cell', pickHex)[0].props['aria-pressed'], 'false', 'D) 点「默认」后墙上不再有选中态');
          clickSave(inst, 'save');
          const rec2 = store.allTemplates().filter((t) => t.id === rec.id)[0];
          eq(Object.prototype.hasOwnProperty.call(rec2, 'color'), false, 'E) 点「默认」保存后 color 键消失（不是写成 #ffffff）');
        }
      }
    }
  }
  TR.act(() => { inst.unmount(); });
  if (failures === 0) ok('D/E/F) 渲染与落盘：带色名字染色 + 带外回落照旧 + 新建落键 + 清除删键 + 存量带外值不被改写');
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
