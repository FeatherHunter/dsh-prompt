'use strict';
/**
 * dsh-prompt #182 回归：设置页勾选框的 data-* 钩子必须落到真 DOM（Check 透传 data-* / aria-*），
 * 且 BAR_UI_CSS 里两枚勾选框（屏蔽预制模板 / 远程模式总闸）都有显式悬浮/焦点反馈。
 * 跑法：node scripts/repro/test-issue-182.cjs（exit 0 = 全绿）
 *
 * 背景（#179 真机）：Check 只传硬编码 props，把 call site 的 data-dsh-prompt-hide-toggle 丢掉，
 * BAR_UI_CSS 的 [data-dsh-prompt-hide-toggle]:hover 规则永不命中——真机上勾选框没有 hover 高亮。
 * #179 门禁只断言「源码里有选择器 / 复合组件 props 上有钩子」，没断言宿主 DOM，故漏过。
 *
 * 覆盖：
 *  A) 设置页渲染后 3 枚 Check → 3 枚宿主 <input type=checkbox>；
 *  B) 宿主 DOM 级：屏蔽勾选框带 data-dsh-prompt-hide-toggle="1"，远程总闸带
 *     data-dsh-prompt-remote-toggle="1"；日志勾选框不带任何 data-* / aria-*（只放行这两类，不扩散）；
 *  C) 既有行为不破：宿主 input 仍带 type/checked/disabled/style/onChange，尺寸 1.15em + fontSize:inherit；
 *  D) BAR_UI_CSS 运行时串：两枚勾选框都有 :hover / :checked:hover / :focus-visible / transition 规则，
 *     且两组环值/提亮值一致（同根因一组修，不得只修一枚）。
 *
 * 注意：本测试刻意断言**宿主 input**（n.type === 'input'）而非复合组件的 props——
 * 后者在修复前就是绿的，正是 #179 真机验收漏掉的那一层。
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-182');
const { buildFlat } = require('../lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function need(cond, msg) { if (cond) ok(msg); else fail(msg); }

// ── 假 DOM / fetch：SettingsPage 在渲染期就会读 store 快照 ──
function mkEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, children: [], dataset: {}, attributes: {}, parentNode: null, textContent: '',
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    addEventListener() {}, removeEventListener() {},
  };
}
function installDom() {
  const head = mkEl('head');
  const body = mkEl('body');
  globalThis.document = {
    documentElement: mkEl('html'), head, body, activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}
function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/\/store$/.test(u)) {
      return { ok: true, status: 200, json: async () => ({ ok: true, value: { customs: [], usage: {}, pinned: [], lastUsed: null } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}

installDom();
installFetch();
const built = buildFlat(DIR, [SRC('settings-page.ts')]);
// 转译闭包里带宿主 UI 的重模块换成桩（本票只关心 Check 的透传与 CSS，不测更新/链接入口）。
fs.writeFileSync(path.join(DIR, 'settings-links.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
fs.writeFileSync(path.join(DIR, 'update-client.cjs'), 'module.exports.UpdateEntryButton=()=>null;module.exports.UpdatePanelEmbedded=()=>null;');

const React = require('react');
const TR = require('react-test-renderer');
const settingsMod = require(path.join(DIR, 'settings-page.cjs'));
const tb = require(path.join(DIR, 'template-browser.cjs'));

const dataKeys = (n) => Object.keys(n.props || {}).filter((k) => k.indexOf('data-') === 0 || k.indexOf('aria-') === 0);

let page;
try {
  TR.act(() => { page = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
} catch (e) {
  fail('设置页应可挂载：' + (e && e.message));
  console.log('\n=== Test issue-182 FAIL（' + failures + '） ===');
  process.exit(1);
}

// ═══ A) 复合 Check ↔ 宿主 checkbox 一一对应 ═══
const checks = page.root.findAll((n) => typeof n.type === 'function' && n.type.name === 'Check');
const inputs = page.root.findAll((n) => n.type === 'input');
const boxes = inputs.filter((n) => n.props && n.props.type === 'checkbox');
need(checks.length === 3, 'A) 设置页应有 3 枚 Check 复合组件（远程总闸 / 日志 / 屏蔽预置），实得 ' + checks.length);
need(boxes.length === 3, 'A) 3 枚 Check 应各产出 1 枚宿主 <input type=checkbox>，实得 ' + boxes.length);
need(checks.length === boxes.length, 'A) 复合组件数与宿主 checkbox 数应相等（每枚都真的落到 DOM）');

// ═══ B) 宿主 DOM 级：两枚勾选框带钩子，日志勾选框不带 ═══
const byHook = (k) => boxes.filter((n) => n.props[k] === '1');
const hideHost = byHook('data-dsh-prompt-hide-toggle');
const remoteHost = byHook('data-dsh-prompt-remote-toggle');
need(hideHost.length === 1, 'B) 屏蔽预制模板的**宿主 input** 应带 data-dsh-prompt-hide-toggle="1"，实得 ' + hideHost.length);
need(remoteHost.length === 1, 'B) 远程模式总闸的**宿主 input** 应带 data-dsh-prompt-remote-toggle="1"，实得 ' + remoteHost.length);
if (hideHost.length === 1) {
  need(hideHost[0].props['data-dsh-prompt-remote-toggle'] === undefined, 'B) 屏蔽勾选框不应串到远程钩子');
}
if (remoteHost.length === 1) {
  need(remoteHost[0].props['data-dsh-prompt-hide-toggle'] === undefined, 'B) 远程勾选框不应串到屏蔽钩子');
}
const bare = boxes.filter((n) => dataKeys(n).length === 0);
need(bare.length === 1, 'B) 日志勾选框应不带任何 data-* / aria-*（Check 只放行这两类，不扩散其它 props），实得 ' + bare.length);
const compositeHide = checks.filter((n) => n.props && n.props['data-dsh-prompt-hide-toggle'] === '1');
const compositeRemote = checks.filter((n) => n.props && n.props['data-dsh-prompt-remote-toggle'] === '1');
need(compositeHide.length === 1 && compositeRemote.length === 1, 'B) call site 传给 Check 的钩子仍保留（回归从 call site 一路到宿主 DOM）');

// ═══ C) 既有行为不破：宿主 input 的硬编码 props / em 尺寸 ═══
need(boxes.every((n) => 'checked' in n.props && 'disabled' in n.props && typeof n.props.onChange === 'function'), 'C) 宿主 input 仍带 checked/disabled/onChange');
need(boxes.every((n) => { const st = n.props.style || {}; return st.width === '1.15em' && st.height === '1.15em' && st.fontSize === 'inherit'; }), 'C) 勾选框尺寸仍走 1.15em + fontSize:inherit（吃设置页根缩放）');
need(boxes.every((n) => { const st = n.props.style || {}; return st.flex === 'none' && (st.cursor === 'pointer' || st.cursor === 'not-allowed'); }), 'C) flex:none / cursor 语义保持');

// ═══ D) BAR_UI_CSS：两枚勾选框一组规则，值一致 ═══
const css = String(tb.BAR_UI_CSS || '');
need(css.indexOf('[data-dsh-prompt-hide-toggle]:hover{') >= 0, 'D) BAR_UI_CSS 有屏蔽勾选框 :hover 规则');
need(css.indexOf('[data-dsh-prompt-remote-toggle]:hover{') >= 0, 'D) BAR_UI_CSS 有远程总闸 :hover 规则');
const spec = [
  '{transition:box-shadow .12s ease,filter .12s ease;border-radius:4px;}',
  ':hover{box-shadow:0 0 0 3px rgba(240,164,92,.3);filter:brightness(1.12);}',
  ':checked:hover{box-shadow:0 0 0 3px rgba(240,164,92,.55);}',
  ':focus-visible{outline:2px solid var(--dsw-specific-accent);outline-offset:2px;}',
];
for (const sel of ['[data-dsh-prompt-hide-toggle]', '[data-dsh-prompt-remote-toggle]']) {
  for (const tail of spec) {
    need(css.indexOf(sel + tail) >= 0, 'D) ' + sel + ' 应有规则 ' + tail);
  }
}
// 两枚勾选框同根因一组修：两组的环值/提亮值必须一致，不许只修一枚。
for (const tail of spec) {
  need(css.indexOf('[data-dsh-prompt-hide-toggle]' + tail) >= 0 && css.indexOf('[data-dsh-prompt-remote-toggle]' + tail) >= 0, 'D) 两组规则同值：' + tail);
}

// 静态兜底：透传循环只放行 data-* / aria-*（与 Btn #110 口径一致），防止后续把整个 props 铺开。
const settingsSrc = fs.readFileSync(SRC('settings-page.ts'), 'utf8');
need(/k\.indexOf\('data-'\) === 0 \|\| k\.indexOf\('aria-'\) === 0/.test(settingsSrc), 'C) Check 透传只放行 data-* / aria-*（不铺开其它 props）');

console.log('--- built modules: ' + built.modules + ', BAR_UI_CSS length: ' + css.length + ', react ' + React.version);
if (failures > 0) { console.log('\n=== Test issue-182 FAIL（' + failures + '） ==='); process.exit(1); }
console.log('\n=== Test issue-182 PASS ===');
