// 回归测试：智能卡「草稿来源」（DOM 真实值优先 → 找不到输入框时回退输入桥草稿）
//
// 背景：出卡链路 = 读草稿 → 评分 → 出卡。评分链有 test-issue-23/32 覆盖，
// 但"读草稿"只有一条 DOM 路径（焦点/可见 textarea），一旦宿主找不到 textarea
// （焦点不在 textarea、宿主换成富文本输入等），草稿恒为空 → 卡片永不自动弹出，
// 而手动点圆点（兜底三行）仍然正常——症状与"功能全坏"高度相似，极易误判。
//
// 验收映射：
//  A) DOM 焦点 textarea 有内容 → 按该草稿出卡（原行为不变）
//  B) DOM 一个 textarea 都找不到，输入桥有草稿 → 按桥草稿出卡（本次新增兜底）
//  C) 焦点落在面板新增/编辑弹窗内 → 不出卡（桥草稿不得越权；弹窗内打字不是会话草稿）
//  D) DOM 找到 textarea 但为空 + 桥草稿是匹配词 → 不出卡（DOM 优先：清空输入框后卡片不残留）
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(OUT, { recursive: true });
const SRC = (f) => path.join(ROOT, 'src', 'client', f);

const MODULES = [
  ['templates.ts', []],
  ['store.ts', ['./templates']],
  ['state.ts', []],
  ['i18n.ts', []],
  ['smartstore.ts', []],
  ['words.ts', []],
  ['match.ts', ['./templates', './store', './words']],
  ['panel.ts', ['./templates', './store', './state', './i18n', './smartstore']],
  ['smart.ts', ['./templates', './store', './words', './match', './panel', './smartstore', './i18n']],
];
for (const [f, deps] of MODULES) {
  let js = ts.transpileModule(fs.readFileSync(SRC(f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(OUT, f.replace(/\.ts$/, '.cjs')), js);
}

let failed = 0;
function fail(msg) { console.log('FAIL: ' + msg); failed++; process.exitCode = 1; }
function ok(msg) { console.log(' ok: ' + msg); }

// ── 浏览器桩：只提供智能卡用到的接口 ──
const saved = { doc: globalThis.document, win: globalThis.window, ls: globalThis.localStorage };
function restore() {
  if (saved.doc === undefined) delete globalThis.document; else globalThis.document = saved.doc;
  if (saved.win === undefined) delete globalThis.window; else globalThis.window = saved.win;
  if (saved.ls === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved.ls;
}
/** textarea: 真值对象|null；modal: 该 textarea 是否属于面板弹窗 */
/** textarea: 真值对象|null；modal: 该 textarea 是否属于面板弹窗；smart: 开关（默认 true=用户已显式打开） */
function stubBrowser({ textarea, modal = false, smart = true }) {
  const ta = textarea
    ? {
        tagName: 'TEXTAREA', value: textarea, offsetParent: {},
        closest: (sel) => (modal && sel === '[data-dsh-prompt-modal]' ? {} : null),
        focus: () => undefined, setSelectionRange: () => undefined, selectionStart: textarea.length,
      }
    : { tagName: 'DIV', closest: () => null }
  globalThis.document = {
    activeElement: ta,
    querySelectorAll: (sel) => (sel === 'textarea' && textarea !== undefined && textarea !== null ? [ta] : []),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    documentElement: {},
  }
  globalThis.window = { innerWidth: 1280, innerHeight: 800 }
  // 开关键按前缀匹配（smartstore 用 'dsh.prompt.smart.v2'；升级键名不该让本回归失效）
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? (smart ? '1' : null) : null), setItem: () => undefined }
}

const React = require('react');
const TR = require('react-test-renderer');
const smartstore = require(path.join(OUT, 'smartstore.cjs'));
const smart = require(path.join(OUT, 'smart.cjs'));

function texts(node, acc) {
  if (node == null) return acc || [];
  acc = acc || [];
  if (typeof node === 'string') { acc.push(node); return acc }
  if (Array.isArray(node)) { node.forEach((n) => texts(n, acc)); return acc }
  if (node.children) texts(node.children, acc);
  return acc;
}

/** 渲染悬浮卡，返回卡片里所有可见文本 */
function renderCard() {
  let tree;
  TR.act(() => { tree = TR.create(React.createElement(smart.SmartCardHost, {})) });
  const out = texts(tree.toJSON(), []);
  try { tree.unmount() } catch (e) { /* ignore */ }
  return out;
}

const CARD_TITLE = '智能推荐';      // 卡片标题（出卡才有）
const ROW = '过程复盘';              // 草稿「复盘」命中的预置模板（强词 +2，达门槛）
const DRAFT = '复盘';

console.log('=== A: DOM 焦点 textarea 有内容 → 出卡 ===');
stubBrowser({ textarea: DRAFT });
smartstore.setSmartInput({ draft: '' }); // 桥为空，必须靠 DOM 出卡
let t = renderCard();
if (!t.includes(CARD_TITLE) || !t.includes(ROW)) fail('DOM 有草稿却未出卡：' + JSON.stringify(t));
else ok('DOM 草稿 → 卡片出现且命中「' + ROW + '」');

console.log('=== B: DOM 找不到 textarea + 桥有草稿 → 出卡（新增兜底） ===');
stubBrowser({ textarea: null });        // 只会找到 DIV，一个 textarea 都没有
smartstore.setSmartInput({ draft: DRAFT });
t = renderCard();
if (!t.includes(CARD_TITLE) || !t.includes(ROW)) fail('桥有草稿却未出卡（兜底失效）：' + JSON.stringify(t));
else ok('DOM 读不到 → 回退桥草稿，卡片出现且命中「' + ROW + '」');

console.log('=== C: 焦点在面板弹窗内 → 不出卡（桥草稿不得越权） ===');
stubBrowser({ textarea: '正在编辑模板正文', modal: true });
smartstore.setSmartInput({ draft: DRAFT });
t = renderCard();
if (t.includes(CARD_TITLE)) fail('弹窗内打字仍出卡：' + JSON.stringify(t));
else ok('弹窗内打字不出卡（仅剩圆点）');

console.log('=== D: DOM 找到空 textarea + 桥草稿是匹配词 → 不出卡（DOM 优先） ===');
stubBrowser({ textarea: '' });
smartstore.setSmartInput({ draft: DRAFT });
t = renderCard();
if (t.includes(CARD_TITLE)) fail('输入框已清空却仍按桥草稿出卡：' + JSON.stringify(t));
else ok('空输入框不出卡（桥草稿不覆盖 DOM 判定）');

console.log('=== E: 智能插入不覆盖已输入内容（草稿源与出卡同源） ===');
stubBrowser({ textarea: 'prefix-' });
let setTo = null;
smartstore.setSmartInput({ draft: '', actions: { setDraft: (v) => { setTo = v } } });
// 光标默认在末尾（桩 selectionStart=0 时 caretInDraft 会回退 draft.length）
smart.smartInsert('BODY', 'process'); // 用不了真 id 也无妨：bumpUsage 仅写缓存
if (setTo !== 'prefix-BODY') fail('插入未按当前草稿拼接，实得：' + JSON.stringify(setTo));
else ok('插入拼接于现有草稿之后（prefix- + BODY）');

console.log('=== F: DOM 读不到时，插入同样以桥草稿为底（不覆盖） ===');
stubBrowser({ textarea: null });
setTo = null;
smartstore.setSmartInput({ draft: 'bridge-', actions: { setDraft: (v) => { setTo = v } } });
smart.smartInsert('BODY', 'process');
if (setTo !== 'bridge-BODY') fail('兜底路径插入未以桥草稿为底，实得：' + JSON.stringify(setTo));
else ok('兜底路径同样不覆盖（bridge- + BODY）');

console.log('=== G: 开关关闭（无存储键）→ 整个组件不渲染（无小点、无卡片） ===');
stubBrowser({ textarea: 'prefix-', smart: false });
smartstore.setSmartInput({ draft: DRAFT });
let raw = null;
TR.act(() => { const tr = TR.create(React.createElement(smart.SmartCardHost, {})); raw = tr.toJSON(); try { tr.unmount() } catch (e) { /* ignore */ } });
if (raw !== null) fail('开关关闭却仍有渲染输出（应连小点都没有）：' + JSON.stringify(raw));
else ok('默认关 → 渲染输出为 null（功能关闭且无悬浮小点）');

smartstore.setSmartInput({ draft: '' });
restore();

if (failed) { console.log('=== Test smart-draft FAIL ==='); process.exit(1) }
console.log('=== Test smart-draft PASS ===');
process.exit(0);
