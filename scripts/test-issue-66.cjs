// 回归测试 #66: 对话框底部 Prompt 入口「变窄只剩图标」
// 为什么这么做（第一性原理）：窄容器下这一行放不下时，本插件唯一能让出的宽度就是按钮里的文字
// 宽度（46.7px）；宿主那一行自带 container-type: inline-size，所以纯 CSS 容器查询就够，
// 不必引入 ResizeObserver。图标化后可见文字为空 ⇒ 必须补 aria-label，否则读屏念不出按钮。
// 验收（与票面要求对齐）：
//   T1 文案 span 带窄屏钩子，文字与语言表一致（宽屏就是它显示）
//   T2 按钮 aria-label = 可见文字 = title（可访问名不丢）
//   T3 注入一段样式：带标记、含 @container 560px 规则，且整段 CSS 被逐字钉住（改动即红）
//   T4 幂等：多次渲染只注入一次
//   T5 隐藏规则只在 @container 块内（宽屏不会被误伤）
//   T6 宽屏零变化：flex/nowrap/内边距 与面板锚点原样保留
//   T7 容错：没有可用的 document.head 时不抛错、按钮照常渲染
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-66');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const MODULES = [
  ['templates.ts', SRC('templates.ts'), []],
  ['store.ts', SRC('store.ts'), ['./templates']],
  ['state.ts', SRC('state.ts'), []],
  ['i18n.ts', SRC('i18n.ts'), []],
  ['smartstore.ts', SRC('smartstore.ts'), []],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['button.ts', SRC('button.ts'), ['./panel', './state', './i18n']],
];
for (const [outName, srcPath, deps] of MODULES) {
  if (!fs.existsSync(srcPath)) continue;
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}

// —— 最小 document mock：只够按钮的样式注入用 ——
function makeDoc(opts) {
  const head = { children: [], appendChild(n) { this.children.push(n) } };
  const doc = {
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
  if (opts && opts.noHead) delete doc.head;
  return doc;
}

global.document = makeDoc();
if (typeof global.MutationObserver === 'undefined') {
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}
const button = require(path.join(DIR, 'button.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
const React = require('react');
const TR = require('react-test-renderer');

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}
function render() {
  let t = null;
  TR.act(() => { t = TR.create(React.createElement(button.EntryButton, { open: false })); });
  return t;
}

const EXPECTED_CSS = '@container (max-width: 560px) {\n  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }\n}';

console.log('=== T1: 窄屏钩子 + 文案 ===');
{
  const t = render();
  const node = t.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
  const spans = node.findAll((x) => x.props && x.props['data-dsh-prompt-label']);
  ok(spans.length === 1, '文案 span 恰好一个，实际=' + spans.length);
  const kids = node.props.children;
  const textNode = kids[kids.length - 1];
  ok(textNode.props['data-dsh-prompt-label'] === '1', 'span 带 data-dsh-prompt-label=1');
  ok(textNode.props.children === tr('zh', STR.entryBtn), '文案 = ' + JSON.stringify(tr('zh', STR.entryBtn)));
}

console.log('=== T2: 可访问名不丢（图标化后靠它） ===');
{
  const t = render();
  const node = t.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
  ok(node.props['aria-label'] === tr('zh', STR.entryBtn), 'aria-label = 可见文字，实际=' + JSON.stringify(node.props['aria-label']));
  ok(node.props.title === tr('zh', STR.entryBtn), 'title 仍在（悬停原生提示）');
  ok(node.props['aria-label'] === node.props.title, 'aria-label 与 title 一致，不与可见标签打架');
}

console.log('=== T3: 样式注入内容被逐字钉住 ===');
{
  const tags = global.document.head.children;
  ok(tags.length === 1, '只注入一段样式，实际=' + tags.length);
  const tag = tags[0];
  ok(tag.tagName === 'STYLE', '注入的是 <style>');
  ok(tag.attrs['data-dsh-prompt-style'] === 'dsh-prompt-entry-narrow', '带标记属性，便于幂等与排查');
  ok(tag.textContent === EXPECTED_CSS, 'CSS 逐字一致（断点/选择器/属性改动即红）');
}

console.log('=== T4: 幂等 ===');
{
  render(); render();
  ok(global.document.head.children.length === 1, '重复渲染不重复注入，实际=' + global.document.head.children.length);
}

console.log('=== T5: 隐藏规则只在 @container 块内（宽屏不被误伤） ===');
{
  const css = global.document.head.children[0].textContent;
  const at = css.indexOf('@container');
  ok(at === 0, '@container 在整段开头');
  const inner = css.slice(css.indexOf('{') + 1, css.lastIndexOf('}'));
  const outer = css.slice(0, css.indexOf('{')) + css.slice(css.lastIndexOf('}') + 1);
  ok(inner.indexOf('display: none') >= 0, 'display:none 在块内');
  ok(outer.indexOf('display') < 0, '块外没有任何 display 声明 ⇒ 宽档按钮文字照旧可见');
}

console.log('=== T6: 宽屏零变化 ===');
{
  const t = render();
  const node = t.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
  const s = node.props.style;
  ok(s.flex === 'none', 'flex:none 保留（不参与收缩，行为不外溢）');
  ok(s.whiteSpace === 'nowrap', 'whiteSpace:nowrap 保留');
  ok(s.gap === 6 && s.padding === '5px 10px', 'gap/padding 未动');
  ok(s.fontSize === 12 && s.fontWeight === 500, '字号字重未动');
  ok(typeof node.props.onMouseDown === 'function' && typeof node.props.onClick === 'function',
    '保焦 mousedown 与 click 开关仍在（#61 不被回退）');
}

console.log('=== T7: 无 document.head 时不抛错 ===');
{
  const prev = global.document;
  global.document = makeDoc({ noHead: true });
  button.__resetNarrowStyle();
  let threw = null;
  let t = null;
  try { TR.act(() => { t = TR.create(React.createElement(button.EntryButton, { open: true })); }) } catch (e) { threw = e; }
  ok(!threw, '没有 head 也不抛错' + (threw ? '：' + threw.message : ''));
  ok(t && t.root.find((x) => x.props && x.props['data-dsh-prompt-entry']), '按钮照常渲染');
  global.document = prev;
  button.__resetNarrowStyle();
}

delete global.document;
if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
console.log('ALL PASS: #66');
