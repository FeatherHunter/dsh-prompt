// 回归测试 #144：设置页折叠小列表长标题溢出覆盖右侧操作区
// 根因 R1：标题 span flex:none 不可收缩，省略因无约束宽度永不触发，溢出涂抹右区。
// 修法：标题取可收缩（flex 0 1 auto + minWidth 0 + 既有省略保留），中间列与标题内行加 overflow:hidden 兜底裁剪，右区保持 flex:none 全可视。
// 验收映射（#144 Agent Brief）：
//  A) 长标题单行省略，右区全可见无重叠（样式契约：标题可收缩 + 省略三件套；容器链 overflow:hidden）
//  B) 短名行无回归；悬浮/大面板分支行为不变由既有 116/77 覆盖，此处只确认设置页默认收起与展开渲染不崩
//  C) 中英文按钮宽度：en Edit/Delete 比 zh 更宽（助因 R2 文档化，不断布局 px）
const fs = require('node:fs');
const path = require('node:path');
// 整合（2026-10-10）：手抄模块表改为共享件 buildFlat —— 依赖闭包由源码 import 边推导。
// 起因：双语 P0 合并后 i18n.ts 新增 ./locale、panel.ts 新增 ./keys，手抄表没跟上，
// 本套件当场崩在 MODULE_NOT_FOUND；闭包推导从构造上消灭这类“表没跟上”的崩溃。
const { buildFlat } = require('./lib/transpile-client.cjs');
const DIR = path.join(__dirname, '.rt-tmp-144');
const ROOT = path.join(__dirname, '..');
const SRC = (n) => path.join(ROOT, 'src', 'client', n);

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }

// 只需 panel（TemplateBrowser）；i18n/locale/keys/store/templates/remote* 等由闭包自动带入。
buildFlat(DIR, [SRC('panel.ts')]);
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n + '.cjs'));
const store = req('store');
const panelMod = req('panel');
const i18nMod = req('i18n');

// 准备一条超长名（40 CJK，复现截图首行量级）
try {
  if (store.__resetStoreForTests) store.__resetStoreForTests();
} catch (e) { /* 无复位钩子则继续，addCustom 幂等污染可接受 */ }
const LONG_NAME = '推荐答案：基于我们代码现状以架构师视角从代码未来发展角度以最高水准输出超长标题';
let longTpl = null;
try {
  longTpl = store.addCustom(LONG_NAME, ['溢出'], '正文首行简介');
} catch (e) { fail('addCustom 超长名应成功，实际抛错 ' + (e && e.message)); }

// 渲染设置页非 compact 折叠列表并展开
let page;
try {
  TR.act(() => { page = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: false, collapsible: true })); });
} catch (e) { fail('TemplateBrowser compact:false 挂载应成功，实际抛错 ' + (e && e.message)); }
if (page) {
  const toggle = page.root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined)[0];
  if (!toggle) fail('应找到折叠开关头行（data-dsh-prompt-templates-toggle）');
  else TR.act(() => { toggle.props.onClick(); });
}

// ── A) 标题样式契约：可收缩 + 省略三件套（修前 flex:none 必红） ──
if (page) {
  const titles = page.root.findAll((n) => n.type === 'span' && n.props && n.props.style && n.props.style.fontSize === '0.98em');
  if (titles.length === 0) fail('展开后应找到行标题 span（fontSize 0.98em）');
  else {
    const st = titles[0].props.style;
    const flex = st.flex;
    if (flex !== '0 1 auto') fail('标题 flex 应精确为 0 1 auto（可收缩不放大），实际 flex=' + JSON.stringify(flex));
    if (st.minWidth !== 0) fail('标题 minWidth 应为 0，实际 ' + JSON.stringify(st.minWidth));
    if (st.whiteSpace !== 'nowrap') fail('标题应单行 nowrap，实际 ' + JSON.stringify(st.whiteSpace));
    if (st.overflow !== 'hidden') fail('标题应 overflow:hidden，实际 ' + JSON.stringify(st.overflow));
    if (st.textOverflow !== 'ellipsis') fail('标题应 textOverflow:ellipsis，实际 ' + JSON.stringify(st.textOverflow));
    if (failures === 0) ok('标题：可收缩 + 单行省略三件套');
  }
}

// ── B) 容器链兜底：中间列与标题内行 overflow:hidden（修前缺失必红） ──
if (page) {
  const midCols = page.root.findAll((n) => n.type === 'div' && n.props && n.props.style && n.props.style.flex === 1 && n.props.style.minWidth === 0 && n.props.style.flexDirection === 'column');
  if (midCols.length === 0) fail('应找到中间列（flex:1 + minWidth:0 + column）');
  else if (midCols[0].props.style.overflow !== 'hidden') fail('中间列应 overflow:hidden 兜底裁剪，实际 ' + JSON.stringify(midCols[0].props.style.overflow));
  const headRows = page.root.findAll((n) => n.type === 'div' && n.props && n.props.style && n.props.style.display === 'flex' && n.props.style.alignItems === 'center' && n.props.style.gap === 6 && n.props.style.minWidth === 0);
  if (headRows.length === 0) fail('应找到标题内行（flex + center + gap6 + minWidth:0）');
  else if (headRows[0].props.style.overflow !== 'hidden') fail('标题内行应 overflow:hidden 兜底，实际 ' + JSON.stringify(headRows[0].props.style.overflow));
  if (failures === 0) ok('容器链：中间列 + 标题内行 overflow:hidden');
}

// ── C) 右区保持全可视：操作组与用量仍 flex:none（防修过头把右区挤掉） ──
if (page) {
  const acts = page.root.findAll((n) => n.type === 'div' && n.props && n.props.style && n.props.style.display === 'flex' && n.props.style.gap === 4 && n.props.style.flex === 'none');
  if (acts.length === 0) fail('右区操作组应保持 flex:none（display:flex + gap:4 + flex:none）');
  const usages = page.root.findAll((n) => n.type === 'span' && n.props && n.props.style && n.props.style.minWidth === '4ch');
  if (usages.length === 0) fail('用量徽标应保留（minWidth 4ch）');
  else if (usages[0].props.style.flex !== 'none') fail('用量徽标应保持 flex:none，实际 ' + JSON.stringify(usages[0].props.style.flex));
  if (failures === 0) ok('右区：操作组 + 用量保持 flex:none 全可视');
}

// ── D) 标签徽章不被挤：保持 flex:none + nowrap（标题收，标签不收） ──
if (page) {
  const tags = page.root.findAll((n) => n.type === 'span' && n.props && n.props.style && n.props.style.fontSize === '0.7em' && n.props.style.borderRadius === 999);
  if (tags.length === 0) fail('应找到标签徽章（0.7em 胶囊）');
  else if (tags[0].props.style.flex !== 'none') fail('标签徽章应保持 flex:none 不被标题挤掉，实际 ' + JSON.stringify(tags[0].props.style.flex));
  if (failures === 0) ok('标签徽章：flex:none 不被挤');
}

// ── E) 中英文助因档化：en 按钮串比 zh 宽（解释 English 先爆，不断 px） ──
{
  const STR = i18nMod.STR;
  const enActs = (STR.edit.en + STR.del.en).length;
  const zhActs = (STR.edit.zh + STR.del.zh).length;
  if (!(enActs > zhActs)) fail('en Edit+Delete 应比 zh 编辑+删除长（助因 R2），实际 en=' + enActs + ' zh=' + zhActs);
  if (failures === 0) ok('双语：en 操作串比 zh 长（English 先爆助因成立）');
}

if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
console.log('\nRESULT: PASS');
