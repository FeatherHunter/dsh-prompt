// 回归测试 #21: 选择浮层与新增/编辑/删除确认弹窗顶层化
// 验收映射：
//  1) z 标尺：MODAL_Z(11000) > PANEL_Z(9999) > 智能卡/点(400)
//  2) compact 浮层根 z=PANEL_Z；新增/编辑/删除弹窗遮罩 z=MODAL_Z（portaled 后全局生效）
//  3) #14 不复发：弹窗输入在父重渲染 + hover 离开下稳定（内联回退路径）
//  4) ModalPortal 在无 DOM 单测环境回退内联（有 DOM 真机走 createPortal 到 body）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const PANEL_TS = path.resolve(path.join(__dirname, '..', 'src', 'client', 'panel.ts'));
const MODULES = [
  ['templates.ts', path.join(__dirname, '..', 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(__dirname, '..', 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(__dirname, '..', 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(__dirname, '..', 'src', 'client', 'i18n.ts'), []],
  ['smartstore.ts', path.join(__dirname, '..', 'src', 'client', 'smartstore.ts'), []],
  ['panel.cjs', PANEL_TS, ['./templates', './store', './state', './i18n', './smartstore']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const panel = require(path.join(DIR, 'panel.cjs'));
const { TemplateBrowser, PANEL_Z, MODAL_Z, PanelPortal } = panel;
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
const state = require(path.join(DIR, 'state.cjs'));
const zh = (k) => tr('zh', STR[k]);

function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exit(1); }
  console.log(' ok: ' + msg);
}

async function main() {
  try {
    console.log('=== Test #21: top-layer z scale ===');
    assert(PANEL_Z === 9999, 'PANEL_Z=9999（沿用 #16 已验证值）');
    assert(MODAL_Z === 11000, 'MODAL_Z=11000（高于浮层/抽屉/智能卡）');
    assert(MODAL_Z > PANEL_Z, 'MODAL_Z > PANEL_Z（弹窗高于选择浮层）');
    assert(PANEL_Z > 400, 'PANEL_Z > 400（选择浮层高于智能卡普通层）');
    // smart.ts 保持普通层 400
    const smartSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'smart.ts'), 'utf8');
    assert(/zIndex:\s*400/.test(smartSrc), 'smart 点/卡保持 z=400（普通层，低于选择类）');
    assert(typeof panel.getReactDom === 'function', 'getReactDom 存在（真机 resolve react-dom/createPortal）');
    assert(typeof PanelPortal === 'function', 'PanelPortal 存在（overlay 浮层真机挂 body）');
    // R2: 无 DOM 单测环境 PanelPortal 回退内联（真机才走 portal）
    let c0;
    TR.act(() => { c0 = TR.create(React.createElement(PanelPortal, null,
      React.createElement('div', { 'data-panel-portal-probe': '1' }, 'probe'))); });
    assert(c0.root.findAll((x) => x.props && x.props['data-panel-portal-probe'] === '1').length === 1,
      'PanelPortal 无 DOM 回退内联渲染');
    try { c0.unmount(); } catch (e) {}
    // index.ts overlay 宿主经 PanelPortal 包裹（结构回归：仅 PanelHost 走 portal，设置页不走）
    const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'index.ts'), 'utf8');
    assert(/h\(PanelPortal/.test(indexSrc), 'PanelHost 经 PanelPortal 包裹浮层');
    const indexCode = indexSrc.replace(/\/\/.*$/gm, '');
    assert((indexCode.match(/PanelPortal/g) || []).length === 2, 'PanelPortal 仅 import + PanelHost 一处使用（设置页保持内联）');

    console.log('=== Test #21: compact 面板 + 弹窗层级 ===');
    state.setPanelOpen(true);
    if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
    function Host() {
      const [open, setOpen] = React.useState(state.isPanelOpen());
      React.useEffect(() => state.onPanelOpen((v) => setOpen(v)), []);
      if (!open) return React.createElement('div', { 'data-host': 'closed' }, 'closed');
      return React.createElement('div', { 'data-host': 'open' },
        React.createElement(TemplateBrowser, { compact: true }));
    }
    let created;
    TR.act(() => { created = TR.create(React.createElement(Host)); });
    const root = created.root;
    // 浮层根：带 hover 接管的 fixed 节点
    const panelRoot = root.findAll((x) => x.type === 'div' && x.props && x.props.style
      && x.props.style.position === 'fixed' && typeof x.props.onMouseLeave === 'function')[0];
    assert(!!panelRoot, 'compact 浮层根存在');
    assert(panelRoot.props.style.zIndex === 9999, 'compact 浮层根 z=9999，实际=' + panelRoot.props.style.zIndex);
    // 打开新增弹窗
    const PLUS = '＋';
    const byText = (txt) => root.findAll((x) => x.type === 'button' && Array.isArray(x.children)
      && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
    const byPlaceholder = (ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea')
      && x.props && x.props.placeholder === ph)[0];
    const addBtn = byText(PLUS);
    assert(!!addBtn, '新增按钮存在');
    TR.act(() => { addBtn.props.onClick(); });
    const mask = root.findAll((x) => x.props && x.props['data-dsh-prompt-modal'] !== undefined
      && x.props.style && typeof x.props.style.zIndex === 'number')[0];
    assert(!!mask, '弹窗遮罩存在（data-dsh-prompt-modal）');
    assert(mask.props.style.zIndex === 11000, '弹窗遮罩 z=11000，实际=' + mask.props.style.zIndex);
    assert(mask.props.style.position === 'fixed', '弹窗遮罩 position=fixed（视口覆盖）');
    // #14 不复发：输入 + 父 hover 离开不关窗
    const name = byPlaceholder(zh('namePh'));
    const body = byPlaceholder(zh('bodyPh'));
    assert(!!name && !!body, '弹窗输入框存在');
    TR.act(() => { name.props.onChange({ target: { value: '顶层验证模板名称' } }); });
    TR.act(() => { body.props.onChange({ target: { value: '顶层验证正文内容0123456789' } }); });
    TR.act(() => { panelRoot.props.onMouseLeave(); });
    await new Promise((r) => setTimeout(r, 220));
    TR.act(() => {});
    const still = byPlaceholder(zh('namePh'));
    assert(!!still && still.props.value === '顶层验证模板名称', 'hover 离开不关窗且输入保留（#14 不复发）');
    try { created.unmount(); } catch (e) {}
    state.setPanelOpen(false);
    if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);

    console.log('=== Test #21: settings 页（compact=false）弹窗同标尺 ===');
    function Wrap2() {
      const [n, setN] = React.useState(0);
      return React.createElement('div', null,
        React.createElement(TemplateBrowser, { compact: false }),
        React.createElement('button', { id: 'bump', onClick: () => setN(n + 1) }, 'bump'));
    }
    let c2;
    TR.act(() => { c2 = TR.create(React.createElement(Wrap2)); });
    const r2 = c2.root;
    const byText2 = (txt) => r2.findAll((x) => x.type === 'button' && Array.isArray(x.children)
      && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
    const byPh2 = (ph) => r2.findAll((x) => (x.type === 'input' || x.type === 'textarea')
      && x.props && x.props.placeholder === ph)[0];
    TR.act(() => { byText2(PLUS).props.onClick(); });
    const mask2 = r2.findAll((x) => x.props && x.props['data-dsh-prompt-modal'] !== undefined
      && x.props.style && typeof x.props.style.zIndex === 'number')[0];
    assert(!!mask2 && mask2.props.style.zIndex === 11000, '设置页弹窗遮罩同 z=11000');
    TR.act(() => { byPh2(zh('namePh')).props.onChange({ target: { value: '设置页输入' } }); });
    const bump = r2.findAll((x) => x.type === 'button' && x.props && x.props.id === 'bump')[0];
    TR.act(() => { bump.props.onClick(); });
    assert(byPh2(zh('namePh')).props.value === '设置页输入', '设置页父重渲染输入不丢');
    try { c2.unmount(); } catch (e) {}

    console.log('ALL PASS: #21 顶层化回归套件');
    process.exit(0);
  } catch (e) {
    console.log('FAIL: ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  }
}
main();
