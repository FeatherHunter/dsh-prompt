// 回归测试 #146: 5 处运行时 <style> 补 data-plugin 归属（DSH 样式账本误认领连带删除）
// 体例沿用 test-issue-66/112（buildFlat + 假 document + 源码级断言），验收以对抗审查补丁为准：
//   R1 新建边：5 角均带私有标记 + data-plugin=dsh-prompt，CSS 内容逐字不变
//   R2 收养边：预置无主旧 tag 再跑新代码 → 就地补归属、不叠加
//   R3 更新边：hostfont 换档更新 textContent 时归属仍对
//   R4 闩边：latch 为 true 时先校验 DOM，外部删除后可恢复
//   R5 HMR：他插件 claim/remove 不动自家；自家摘除只动自家标记，不碰他家
//   R6 作用域查询：style[data-dsh-prompt-style]:not([data-plugin]) 为 0 且值全对；查询键不变
//   R7 纪律：单常量归属键、不散写字面量；仅改 src + 无新日志/持久化；样式选择器/开关语义不变
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-146');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const { buildFlat } = require('./lib/transpile-client.cjs');
buildFlat(DIR, [
  SRC('templates.ts'),
  SRC('store.ts'),
  SRC('state.ts'),
  SRC('i18n.ts'),
  SRC('smartstore.ts'),
  SRC('panel.ts'),
  SRC('button.ts'),
  SRC('picker.ts'),
  SRC('hostfont.ts'),
]);

let failures = 0;
function fail(msg) { console.log('  FAIL ' + msg); failures++; }
function ok(cond, msg) { if (cond) { console.log('  PASS ' + msg); } else fail(msg); }

// —— 源码级纪律（R7）——
console.log('=== R7: 源码纪律（单常量/查询键/无 creep） ===');
{
  const root = path.join(__dirname, '..');
  const ownerSrc = fs.readFileSync(path.join(root, 'src', 'client', 'styleOwnership.ts'), 'utf8');
  const pickerSrc = fs.readFileSync(path.join(root, 'src', 'client', 'picker.ts'), 'utf8');
  const buttonSrc = fs.readFileSync(path.join(root, 'src', 'client', 'button.ts'), 'utf8');
  const hostSrc = fs.readFileSync(path.join(root, 'src', 'client', 'hostfont.ts'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8');

  ok(/STYLE_OWNER_ID\s*=\s*['"]dsh-prompt['"]/.test(ownerSrc), '归属键单常量 STYLE_OWNER_ID=dsh-prompt');
  ok(pkg.name === 'dsh-prompt', 'package.json:name 与归属键一致，实际=' + pkg.name);
  ok(/id:\s*dsh-prompt/.test(patch) && /name:\s*['"]?dsh-prompt['"]?/.test(patch), 'cordis.patch.yml id/name 与归属键一致');
  // 不散写字面量：data-plugin 字面量只许出现在 styleOwnership.ts
  const hitPicker = /['"]data-plugin['"]/.test(pickerSrc);
  const hitButton = /['"]data-plugin['"]/.test(buttonSrc);
  const hitHost = /['"]data-plugin['"]/.test(hostSrc);
  ok(!hitPicker && !hitButton && !hitHost, 'picker/button/hostfont 不散写 data-plugin 字面量（走单常量 helper）');
  ok(/data-plugin/.test(ownerSrc), 'styleOwnership.ts 拥有 data-plugin 唯一真相');
  // 查询键不变：仍用 style[data-dsh-prompt-style="..."]（经 helper 或字面量，语义逐字一致）
  // #148 起 hostfont 不再自己持有查询键（注入缝在 styleOwnership），故这里列缝的持有者。
  for (const [nm, src] of [['picker', pickerSrc], ['button', buttonSrc], ['styleOwnership', ownerSrc]]) {
    ok(/data-dsh-prompt-style/.test(src), nm + ' 仍用私有标记查询键');
  }
  // #148：hostfont 三条桥（宿主字/工作区行/AI 响应）收敛到 styleOwnership 的共用注入点
  // （applyOwnedStyle / dropOwnedStyle），hostfont 由 2 处 createElement(style) 降为 0 处、
  // 缝所在文件 1 处 ⇒ 计数集合换成 picker+button+styleOwnership 后仍是 4。不变式（运行时
  // <style> 注入全走归属 helper）不变，且实现副本更少——#146 的漏打归属正是“多份拷贝漂移”的产物。
  const allSrc = pickerSrc + buttonSrc + ownerSrc;
  const creates = (allSrc.match(/createElement\(['"]style['"]\)/g) || []).length;
  ok(creates === 4, '全 src 恰好 4 处 createElement(style)（hostfont 三桥共用缝里那 1 处），实际=' + creates);
  ok(!/createElement\(['"]style['"]\)/.test(hostSrc), 'hostfont.ts 不自建 <style>（注入全走归属缝）');
  const marks = (allSrc.match(/markOwnedStyleTag|ensureOwnedStyleTag/g) || []).length;
  ok(marks >= 6, '各处新建/收养/更新/闩全走 helper（mark/ensure 引用≥6，实际=' + marks + '）');
  // 无新日志/持久化
  for (const [nm, src] of [['styleOwnership', ownerSrc], ['picker', pickerSrc], ['button', buttonSrc], ['hostfont', hostSrc]]) {
    ok(!/__dshPromptLog|logEvent|localStorage|sessionStorage/.test(src) || nm === 'picker' || nm === 'button',
      nm + ' 无新增日志/持久化（picker/button 既有逻辑除外，helper 侧零新增）');
  }
  ok(!/__dshPromptLog|logEvent/.test(ownerSrc), 'styleOwnership.ts 无日志事件');
  ok(!/localStorage|sessionStorage/.test(ownerSrc), 'styleOwnership.ts 无持久化');
  // 样式内容/选择器/开关语义不变（源码级钉住关键串）
  ok(buttonSrc.includes('@container (max-width: 560px)'), '窄屏 CSS 断点未动');
  ok(pickerSrc.includes('dsh-prompt-picker-slide'), 'picker 动画 keyframes 未动');
  ok(buttonSrc.includes('brightness(1.1)'), '反馈样式内容未动');
  ok(hostSrc.includes('[data-row-key^="session:"]'), 'rows 选择器未动');
  ok(hostSrc.includes('[data-chat-group-part="response"]'), 'assistant 选择器未动');
  ok(/if\s*\(\s*enabled\s*!==\s*true\s*\)/.test(hostSrc), 'hostfont 开关摘除语义未动（关即摘）');
}

// —— 假 document（支持 getAttribute/setAttribute + querySelector 精确匹配 + querySelectorAll 作用域查询）——
function mkStyleTag() {
  return {
    tagName: 'STYLE',
    attrs: {},
    textContent: '',
    parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    remove() { try { if (this.parentNode && typeof this.parentNode.removeChild === 'function') this.parentNode.removeChild(this); } catch (e) {} },
  };
}
function makeDoc() {
  const head = {
    children: [],
    appendChild(n) { n.parentNode = head; this.children.push(n); return n; },
    removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); return n; },
  };
  const doc = {
    head,
    createElement(tag) {
      if (tag === 'style') return mkStyleTag();
      return { tagName: String(tag).toUpperCase(), attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; } };
    },
    querySelector(sel) {
      const m = /^style\[data-dsh-prompt-style="(.+)"\]$/.exec(sel);
      if (!m) return null;
      return head.children.find((n) => n.tagName === 'STYLE' && n.attrs['data-dsh-prompt-style'] === m[1]) || null;
    },
    querySelectorAll(sel) {
      if (sel === 'style[data-dsh-prompt-style]:not([data-plugin])') {
        return head.children.filter((n) => n.tagName === 'STYLE' && n.attrs['data-dsh-prompt-style'] && !n.attrs['data-plugin']);
      }
      if (sel === 'style[data-dsh-prompt-style]') {
        return head.children.filter((n) => n.tagName === 'STYLE' && n.attrs['data-dsh-prompt-style']);
      }
      if (sel === 'style:not([data-plugin])') {
        return head.children.filter((n) => n.tagName === 'STYLE' && !n.attrs['data-plugin']);
      }
      if (sel === 'style[data-plugin]') {
        return head.children.filter((n) => n.tagName === 'STYLE' && n.attrs['data-plugin']);
      }
      return [];
    },
  };
  return doc;
}

// DSH 账本模拟（按票面伪代码逐字行为）
function claimStyles(doc, id) {
  for (const el of doc.querySelectorAll('style:not([data-plugin])')) el.setAttribute('data-plugin', id);
}
function removeOwnedStyles(doc, id) {
  for (const el of doc.querySelectorAll('style[data-plugin]').slice()) {
    if (el.getAttribute('data-plugin') === id) {
      try {
        if (el.parentNode && typeof el.parentNode.removeChild === 'function') el.parentNode.removeChild(el);
        else if (typeof el.remove === 'function') el.remove();
      } catch (e) {}
    }
  }
}

global.document = makeDoc();
globalThis.document = global.document;
if (typeof global.MutationObserver === 'undefined') {
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}
const button = require(path.join(DIR, 'button.cjs'));
const pickerMod = require(path.join(DIR, 'picker.cjs'));
const hostfont = require(path.join(DIR, 'hostfont.cjs'));
const React = require('react');
const TR = require('react-test-renderer');

function renderEntry() {
  let t = null;
  TR.act(() => { t = TR.create(React.createElement(button.EntryButton, { open: false })); });
  return t;
}
function mine(marker) {
  return global.document.head.children.filter((x) => x.tagName === 'STYLE' && x.attrs['data-dsh-prompt-style'] === marker);
}
const MARKERS = [
  'dsh-prompt-picker-anim',
  'dsh-prompt-entry-narrow',
  'dsh-prompt-remote-feedback',
  'dsh-prompt-remote-hostfont',
  'dsh-prompt-remote-rows',
  'dsh-prompt-remote-assistant',
];

console.log('=== R1: 新建边（6 角归属 + CSS 逐字） ===');
{
  // 重置闩，保证新建路径
  try { button.__resetNarrowStyle(); } catch (e) {}
  try { button.__resetRemoteFeedbackStyle(); } catch (e) {}
  try { pickerMod.__resetPickerAnimStyle(); } catch (e) {}
  global.document = makeDoc();
  globalThis.document = global.document;

  renderEntry();
  // picker 动画：直接渲染 WorkspacePicker（同步注入，不等异步探测）
  try {
    TR.act(() => { TR.create(React.createElement(pickerMod.WorkspacePicker, { faces: {}, onClose: () => {} })); });
  } catch (e) { fail('WorkspacePicker 渲染不应抛：' + ((e && e.message) || e)); }
  hostfont.syncRemoteRows(true, 5);
  hostfont.syncAssistantZoom(true, 5);
  hostfont.syncHostFont(true, 5);

  for (const m of MARKERS) {
    const hits = mine(m);
    ok(hits.length === 1, m + ' 恰好注入一次，实际=' + hits.length);
    if (hits.length === 1) {
      ok(hits[0].attrs['data-plugin'] === 'dsh-prompt', m + ' 归属=dsh-prompt，实际=' + hits[0].attrs['data-plugin']);
      ok(hits[0].attrs['data-dsh-prompt-style'] === m, m + ' 私有标记保留');
    }
  }
  // CSS 逐字（与修复前一致，归属只加属性不动内容）
  const narrow = mine('dsh-prompt-entry-narrow')[0];
  if (narrow) ok(narrow.textContent === '@container (max-width: 560px) {\n  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }\n}', '窄屏 CSS 逐字不变');
  const rows = mine('dsh-prompt-remote-rows')[0];
  if (rows) ok(rows.textContent === '[data-row-key^="session:"],[data-row-key^="workspace:"]{zoom:3;}', 'rows 5档 CSS 逐字，实际=' + (rows && rows.textContent));
  const hf = mine('dsh-prompt-remote-hostfont')[0];
  if (hf) ok(hf.textContent === 'body{--dsh-content-font-size:42px !important;}', 'hostfont 5档覆盖 CSS 逐字，实际=' + (hf && hf.textContent));
  const asst = mine('dsh-prompt-remote-assistant')[0];
  if (asst) ok(asst.textContent === '[data-chat-group-part="response"]{zoom:3;}', 'assistant 5档 CSS 逐字，实际=' + (asst && asst.textContent));
  const fb = mine('dsh-prompt-remote-feedback')[0];
  if (fb) ok(fb.textContent.indexOf('brightness(1.1)') >= 0 && fb.textContent.indexOf('scale(.97)') >= 0, '反馈 CSS 内容未动');
  const anim = mine('dsh-prompt-picker-anim')[0];
  if (anim) ok(anim.textContent.indexOf('dsh-prompt-picker-slide') >= 0 && anim.textContent.indexOf('dsh-prompt-pager-pulse') >= 0, 'picker 动画 CSS 内容未动');
}

console.log('=== R6: 作用域查询（自家零无主、值全对） ===');
{
  const orphans = global.document.querySelectorAll('style[data-dsh-prompt-style]:not([data-plugin])');
  ok(orphans.length === 0, '自家零无主，实际=' + orphans.length);
  const allMine = global.document.querySelectorAll('style[data-dsh-prompt-style]');
  ok(allMine.length === 6, '自家共 6 段（#148 起含宿主内容字覆盖段），实际=' + allMine.length);
  ok(allMine.every((el) => el.getAttribute('data-plugin') === 'dsh-prompt'), '自家归属值全等于 dsh-prompt');
}

console.log('=== R2: 收养边（预置无主旧 tag 就地转正） ===');
{
  // 每个 marker 预置一个无主旧 tag，再跑新代码，应不叠加且补归属
  for (const m of ['dsh-prompt-entry-narrow', 'dsh-prompt-remote-rows', 'dsh-prompt-remote-assistant']) {
    //  fresh doc + 手工旧 tag
    const fresh = makeDoc();
    const old = mkStyleTag();
    old.setAttribute('data-dsh-prompt-style', m);
    old.textContent = m === 'dsh-prompt-entry-narrow'
      ? '@container (max-width: 560px) {\n  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }\n}'
      : (m === 'dsh-prompt-remote-rows' ? '[data-row-key^="session:"],[data-row-key^="workspace:"]{zoom:3;}' : '[data-chat-group-part="response"]{zoom:3;}');
    // 注意：故意不写 data-plugin（模拟升级页长寿旧 tag）
    fresh.head.appendChild(old);
    global.document = fresh;
    globalThis.document = fresh;
    try { button.__resetNarrowStyle(); } catch (e) {}
    try { button.__resetRemoteFeedbackStyle(); } catch (e) {}
    if (m === 'dsh-prompt-entry-narrow') {
      renderEntry();
      const hits = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === m);
      ok(hits.length >= 1 && hits.length <= 2, m + ' 收养后不叠加（1~2段，含反馈段干扰，实际=' + hits.length + '）');
      const target = hits.find((x) => x === old) || hits[0];
      ok(target.attrs['data-plugin'] === 'dsh-prompt', m + ' 旧 tag 被收养补归属，实际=' + target.attrs['data-plugin']);
    } else if (m === 'dsh-prompt-remote-rows') {
      hostfont.syncRemoteRows(true, 5);
      ok(fresh.head.children.length === 1, m + ' 收养不叠加，实际=' + fresh.head.children.length);
      ok(fresh.head.children[0].attrs['data-plugin'] === 'dsh-prompt', m + ' 旧 tag 被收养，实际=' + fresh.head.children[0].attrs['data-plugin']);
    } else {
      hostfont.syncAssistantZoom(true, 5);
      ok(fresh.head.children.length === 1, m + ' 收养不叠加，实际=' + fresh.head.children.length);
      ok(fresh.head.children[0].attrs['data-plugin'] === 'dsh-prompt', m + ' 旧 tag 被收养，实际=' + fresh.head.children[0].attrs['data-plugin']);
    }
  }
  // picker 收养（单独 fresh，避免 button 段干扰计数）
  {
    const fresh = makeDoc();
    const old = mkStyleTag();
    old.setAttribute('data-dsh-prompt-style', 'dsh-prompt-picker-anim');
    old.textContent = 'old-css';
    fresh.head.appendChild(old);
    global.document = fresh;
    globalThis.document = fresh;
    try { pickerMod.__resetPickerAnimStyle(); } catch (e) {}
    try {
      TR.act(() => { TR.create(React.createElement(pickerMod.WorkspacePicker, { faces: {}, onClose: () => {} })); });
    } catch (e) { fail('picker 收养渲染不应抛'); }
    const hits = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-picker-anim');
    ok(hits.length === 1, 'picker 收养不叠加，实际=' + hits.length);
    if (hits.length === 1) ok(hits[0].attrs['data-plugin'] === 'dsh-prompt', 'picker 旧 tag 被收养，实际=' + hits[0].attrs['data-plugin']);
  }
}

console.log('=== R3: 更新边（换档更新后归属仍对） ===');
{
  const fresh = makeDoc();
  global.document = fresh;
  globalThis.document = fresh;
  hostfont.syncRemoteRows(true, 5);
  hostfont.syncRemoteRows(true, 10);
  ok(fresh.head.children.length === 1, 'rows 换档不叠加，实际=' + fresh.head.children.length);
  if (fresh.head.children.length === 1) {
    ok(fresh.head.children[0].textContent.indexOf('zoom:5.5') >= 0, 'rows 10档更新 zoom=5.5，实际=' + fresh.head.children[0].textContent);
    ok(fresh.head.children[0].attrs['data-plugin'] === 'dsh-prompt', 'rows 更新后归属仍对');
  }
  const fresh2 = makeDoc();
  global.document = fresh2;
  globalThis.document = fresh2;
  hostfont.syncAssistantZoom(true, 5);
  hostfont.syncAssistantZoom(true, 10);
  ok(fresh2.head.children.length === 1, 'assistant 换档不叠加，实际=' + fresh2.head.children.length);
  if (fresh2.head.children.length === 1) {
    ok(fresh2.head.children[0].textContent.indexOf('zoom:5.5') >= 0, 'assistant 10档更新 zoom=5.5');
    ok(fresh2.head.children[0].attrs['data-plugin'] === 'dsh-prompt', 'assistant 更新后归属仍对');
  }
  // 更新边收养：预置无主旧 tag 后换档（走 prev 分支），应同时补归属+更新 css
  const fresh3 = makeDoc();
  const old = mkStyleTag();
  old.setAttribute('data-dsh-prompt-style', 'dsh-prompt-remote-rows');
  old.textContent = '[data-row-key^="session:"],[data-row-key^="workspace:"]{zoom:3;}';
  fresh3.head.appendChild(old);
  global.document = fresh3;
  globalThis.document = fresh3;
  hostfont.syncRemoteRows(true, 10);
  ok(fresh3.head.children.length === 1 && fresh3.head.children[0] === old, '更新边复用旧 tag（同一对象）');
  ok(old.attrs['data-plugin'] === 'dsh-prompt' && old.textContent.indexOf('zoom:5.5') >= 0, '更新边同时补归属+更新 css');
}

console.log('=== R4: 闩边（latch 命中先验 DOM，删后可恢复） ===');
{
  // button 双闩：先渲染（闩=true），再外部删除 narrow 段，再渲染应重建且带归属
  const fresh = makeDoc();
  global.document = fresh;
  globalThis.document = fresh;
  try { button.__resetNarrowStyle(); } catch (e) {}
  try { button.__resetRemoteFeedbackStyle(); } catch (e) {}
  renderEntry();
  const before = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow').length;
  ok(before === 1, '闩前置：narrow 已注入，实际=' + before);
  // 外部删除（模拟 HMR 误删/他插件误删）
  const victim = fresh.head.children.find((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow');
  try { fresh.head.removeChild(victim); } catch (e) {}
  ok(fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow').length === 0, '闩前置：外部删除成功');
  renderEntry();
  const after = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow');
  ok(after.length === 1, '闩命中删后重建，实际=' + after.length);
  if (after.length === 1) ok(after[0].attrs['data-plugin'] === 'dsh-prompt', '重建仍带归属');
  // picker 闩同理
  const freshP = makeDoc();
  global.document = freshP;
  globalThis.document = freshP;
  try { pickerMod.__resetPickerAnimStyle(); } catch (e) {}
  TR.act(() => { TR.create(React.createElement(pickerMod.WorkspacePicker, { faces: {}, onClose: () => {} })); });
  const pb = freshP.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-picker-anim').length;
  ok(pb === 1, 'picker 闩前置已注入，实际=' + pb);
  const pv = freshP.head.children.find((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-picker-anim');
  try { freshP.head.removeChild(pv); } catch (e) {}
  TR.act(() => { TR.create(React.createElement(pickerMod.WorkspacePicker, { faces: {}, onClose: () => {} })); });
  const pa = freshP.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-picker-anim');
  ok(pa.length === 1, 'picker 闩删后重建，实际=' + pa.length);
  if (pa.length === 1) ok(pa[0].attrs['data-plugin'] === 'dsh-prompt', 'picker 重建仍带归属');
}

console.log('=== R5: HMR（他插件认领/删除不动自家；自家摘除不碰他家） ===');
{
  const fresh = makeDoc();
  global.document = fresh;
  globalThis.document = fresh;
  try { button.__resetNarrowStyle(); } catch (e) {}
  try { button.__resetRemoteFeedbackStyle(); } catch (e) {}
  try { pickerMod.__resetPickerAnimStyle(); } catch (e) {}
  renderEntry();
  try {
    TR.act(() => { TR.create(React.createElement(pickerMod.WorkspacePicker, { faces: {}, onClose: () => {} })); });
  } catch (e) {}
  hostfont.syncRemoteRows(true, 5);
  hostfont.syncAssistantZoom(true, 5);
  // 他家孤儿样式（无标记、无归属）+ 他家有主样式
  const otherOrphan = mkStyleTag();
  otherOrphan.textContent = '.other{}';
  fresh.head.appendChild(otherOrphan);
  const otherOwned = mkStyleTag();
  otherOwned.setAttribute('data-plugin', 'other-plugin');
  otherOwned.textContent = '.other-owned{}';
  fresh.head.appendChild(otherOwned);
  const mineBefore = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style']).length;
  ok(mineBefore === 5, 'HMR 前置自家 5 段，实际=' + mineBefore);
  // 他插件物化认领：自家已归属，0 被误认领；孤儿被他认领（DSH 侧行为，不在本票改动内，仅断自家不动）
  claimStyles(fresh, 'other-plugin');
  const mineClaimedByOther = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] && x.attrs['data-plugin'] === 'other-plugin').length;
  ok(mineClaimedByOther === 0, '他插件物化后自家 0 被误认领，实际=' + mineClaimedByOther);
  ok(otherOrphan.attrs['data-plugin'] === 'other-plugin', '他插件认领孤儿（DSH 现状，仅记录不改）');
  // 他插件重载删除：自家全留存
  removeOwnedStyles(fresh, 'other-plugin');
  const mineAfterOtherReload = fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style']).length;
  ok(mineAfterOtherReload === 5, '他插件重载后自家 5 段 intact，实际=' + mineAfterOtherReload);
  // 自家摘除（关远程）只动自家标记，不碰他家有主样式
  // 先恢复一个可删的他家孤儿（上一步已被删，随手补一个有主的验证不误删）
  const keep = mkStyleTag();
  keep.setAttribute('data-plugin', 'other-plugin');
  keep.textContent = '.keep{}';
  fresh.head.appendChild(keep);
  hostfont.syncRemoteRows(false, 5);
  hostfont.syncAssistantZoom(false, 5);
  ok(fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-remote-rows').length === 0, '关 rows 摘掉自家 rows');
  ok(fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-remote-assistant').length === 0, '关 assistant 摘掉自家 assistant');
  ok(fresh.head.children.includes(keep), '自家摘除不碰他家有主样式');
  ok(fresh.head.children.filter((x) => x.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow').length === 1, '常驻段（narrow）不受开关影响');
}

console.log('=== R7b: 无 DOM fail-soft ===');
{
  const saved = global.document;
  const saved2 = globalThis.document;
  try { delete global.document; } catch (e) { global.document = undefined; }
  try { delete globalThis.document; } catch (e) { globalThis.document = undefined; }
  let threw = null;
  try {
    hostfont.syncRemoteRows(true, 5);
    hostfont.syncAssistantZoom(true, 5);
    hostfont.syncRemoteRows(false, 5);
  } catch (e) { threw = e; }
  ok(!threw, '无 DOM 时 hostfont 不抛');
  threw = null;
  try {
    try { button.__resetNarrowStyle(); } catch (e) {}
    renderEntry();
  } catch (e) { threw = e; }
  // renderEntry 在无 document.head 时应 fail-soft（按钮照常渲染，不断言抛/不抛到 React 层，只断不崩到进程）
  ok(!threw, '无 DOM 时 EntryButton 渲染不抛' + (threw ? '：' + threw.message : ''));
  global.document = saved;
  globalThis.document = saved2;
  try { button.__resetNarrowStyle(); } catch (e) {}
  try { button.__resetRemoteFeedbackStyle(); } catch (e) {}
  try { pickerMod.__resetPickerAnimStyle(); } catch (e) {}
}

delete global.document;
try { delete globalThis.document; } catch (e) {}
if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
console.log('ALL PASS: #146');
