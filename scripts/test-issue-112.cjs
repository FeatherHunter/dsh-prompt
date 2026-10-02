// 回归测试 #112: 对话框 prompt 入口首次点击闪关，第二次才正常
// 根因：hover 开 + click 取反竞态——onMouseEnter 先把面板打开，
// 紧接的 onClick 又按“当前开→关”取反，于是闪现一下即关；原位第二次
// 单击（无新的 enter 事件）取反为开，表现正常。
// 修复：hover 开窗打点（state.noteHoverOpen），同手势跟进单击保持开
// （state.takeHoverOpen 消费标记），稳态下的明确单击仍取反（可手动关）。
// 验收（与票面 Agent Brief 对齐）：
//   R1 hover 后跟进单击保持开，再单击可关（核心，不闪关也不粘住）
//   R2 无 hover 的单击语义不变（键盘 Enter / 触屏 tap：开→关取反）
//   R3 稳态已开时移入不重新武装，单击可关（逛过面板回来点按钮能关）
//   R4 同手势宽限过期视为稳态（state 单元级）
//   R5 hover 离开短延迟自动关仍有效（不粘住）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-112');
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
]);

// —— 最小 document mock（同 #66，只够按钮样式注入用）——
function makeDoc() {
  const head = { children: [], appendChild(n) { this.children.push(n) } };
  return {
    head,
    createElement(tag) {
      return { tagName: String(tag).toUpperCase(), attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v } };
    },
    querySelector(sel) {
      const m = /^style\[data-dsh-prompt-style="(.+)"\]$/.exec(sel);
      if (!m) return null;
      return head.children.find((n) => n.tagName === 'STYLE' && n.attrs['data-dsh-prompt-style'] === m[1]) || null;
    },
  };
}
global.document = makeDoc();
if (typeof global.MutationObserver === 'undefined') {
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}
const button = require(path.join(DIR, 'button.cjs'));
const state = require(path.join(DIR, 'state.cjs'));
const React = require('react');
const TR = require('react-test-renderer');

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}
function reset() {
  state.setPanelOpen(false);
  try { state.cancelPanelClose(); } catch (e) { /* ignore */ }
  try { if (state.__resetHoverOpen) state.__resetHoverOpen(); } catch (e) { /* ignore */ }
}
function entryNode(t) {
  return t.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
}
function render() {
  let t = null;
  TR.act(() => { t = TR.create(React.createElement(button.EntryButton, { open: false })); });
  return t;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('=== R1: hover 后跟进单击保持开，再单击可关 ===');
  {
    reset();
    const t = render();
    const node = entryNode(t);
    TR.act(() => { node.props.onMouseEnter(); });
    ok(state.isPanelOpen() === true, 'hover 移入即开，实际=' + state.isPanelOpen());
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === true, '同手势跟进单击保持开（不闪关），实际=' + state.isPanelOpen());
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === false, '原位再单击可关（不粘住），实际=' + state.isPanelOpen());
    try { t.unmount(); } catch (e) {}
  }

  console.log('=== R2: 无 hover 单击语义不变 ===');
  // 说明：原生 <button> 的键盘 Enter 激活与触屏 tap 最终都走 click 事件，
  // 且都不经过 hover 开窗打点——裸 onClick 即两者的忠实代理。
  {
    reset();
    const t = render();
    const node = entryNode(t);
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === true, '闭态单击即开（键盘/触屏 fallback），实际=' + state.isPanelOpen());
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === false, '开态单击即关（取反保留），实际=' + state.isPanelOpen());
    try { t.unmount(); } catch (e) {}
  }

  console.log('=== R3: 稳态已开时移入不武装，单击可关 ===');
  {
    reset();
    const t = render();
    const node = entryNode(t);
    TR.act(() => { node.props.onClick(); }); // 无 hover 直接开（稳态开）
    ok(state.isPanelOpen() === true, '前置：稳态已开');
    TR.act(() => { node.props.onMouseEnter(); }); // 从面板逛回按钮
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === false, '稳态开 + 移入 + 单击 = 关（能手动关），实际=' + state.isPanelOpen());
    try { t.unmount(); } catch (e) {}
  }

  console.log('=== R4: 宽限过期视为稳态（state 单元级） ===');
  {
    reset();
    if (typeof state.noteHoverOpen !== 'function' || typeof state.takeHoverOpen !== 'function') {
      ok(false, 'state 缺 noteHoverOpen/takeHoverOpen（修复未落地）');
    } else {
      state.noteHoverOpen();
      ok(state.takeHoverOpen(50) === true, '同手势内消费返回 true');
      ok(state.takeHoverOpen(50) === false, '消费一次后即空（第二次走取反）');
      state.noteHoverOpen();
      await sleep(80);
      ok(state.takeHoverOpen(50) === false, '超窗返回 false（过期视为稳态）');
    }
  }

  console.log('=== R5: hover 离开短延迟自动关仍有效 ===');
  {
    reset();
    const t = render();
    const node = entryNode(t);
    TR.act(() => { node.props.onMouseEnter(); });
    ok(state.isPanelOpen() === true, '前置：hover 已开');
    TR.act(() => { node.props.onMouseLeave(); });
    await sleep(230);
    TR.act(() => {});
    ok(state.isPanelOpen() === false, '移出未进列表 150ms 后自动关，实际=' + state.isPanelOpen());
    try { t.unmount(); } catch (e) {}
  }

  console.log('=== R6: 关窗清同手势点，不污染下一次开窗 ===');
  {
    reset();
    const t = render();
    const node = entryNode(t);
    TR.act(() => { node.props.onMouseEnter(); }); // hover 开（打点）
    TR.act(() => { node.props.onMouseLeave(); }); // 离开，未进列表
    await sleep(230);
    TR.act(() => {});
    ok(state.isPanelOpen() === false, '前置：已自动关窗');
    // 无 hover 直接开（键盘/程序语义），再点一次必须能关——
    // 若关窗不清点，第二次 click 会误命中过期标记而粘住。
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === true, '重开一次即开');
    TR.act(() => { node.props.onClick(); });
    ok(state.isPanelOpen() === false, '再单击可关（旧点未污染），实际=' + state.isPanelOpen());
    try { t.unmount(); } catch (e) {}
  }

  reset();
  delete global.document;
  if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
  console.log('ALL PASS: #112');
}
main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
