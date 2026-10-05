// 回归测试 #83：大列表十二槽本体+统一大小滑块（TS）
// 覆盖 #83 验收自查（规格以 #85 为准）：
//  1) 十二槽大触控面：横屏 4×3、竖屏 3×4；不满页虚线空位同尺寸占位不拉伸不可点高度稳定；满页拉伸填满零空白
//  2) 尺寸：面板取锚点上方全部可用高度、内部相对缩放、无长度封顶、12 槽恒定不减行；原型演示常量一律不得沿用
//  3) 搜索底栏收起行内顶起、输入法组词保留；#132 标签区已移除、底栏首位为新增键；置顶聚底用量升序卡显用量；标题加简介各一行
//  4) 底栏大翻页与搜索同栏，两步到达；统一大小滑块 1–10（单滑块字号控件联动）持久化在配置面板远程段；方向偏好三档纯插件（去宿主化，无整机）
//  5) 唯一新缝纯视图模型，复用既有排序与匹配；只断外部行为，不刺探样式与 DOM 细节
// 口径：纯函数走转译断言，装配走渲染器，六格走同一组用例换参（#85 Testing Decisions）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-83');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const VIEW_TS = path.join(ROOT, 'src', 'client', 'remoteView.ts');

// ── 1) 纯函数（转译后断言） ──
let viewJs = ts.transpileModule(fs.readFileSync(VIEW_TS, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'remoteView.cjs'), viewJs);
const view = require(path.join(DIR, 'remoteView.cjs'));

if (view.REMOTE_PAGE_SIZE !== 12) fail('REMOTE_PAGE_SIZE 应为 12，实际 ' + view.REMOTE_PAGE_SIZE);
ok('每页固定十二槽');

if (view.remoteColsFor('landscape') !== 4 || view.remoteRowsFor('landscape') !== 3) fail('横屏应为 4×3');
if (view.remoteColsFor('portrait') !== 3 || view.remoteRowsFor('portrait') !== 4) fail('竖屏应为 3×4');
ok('横屏 4×3、竖屏 3×4');

// #90 B 档（8 宫大卡）：横屏 4×2、竖屏 2×4；缺省仍为 A 现状值；非法/缺键回 A
if (view.remoteColsFor('landscape', 'b') !== 4 || view.remoteRowsFor('landscape', 'b') !== 2) fail('B 横屏应为 4×2');
if (view.remoteColsFor('portrait', 'b') !== 2 || view.remoteRowsFor('portrait', 'b') !== 4) fail('B 竖屏应为 2×4');
if (view.remotePageSizeFor('a') !== 12 || view.remotePageSizeFor('b') !== 8) fail('A=12/B=8，实际 ' + view.remotePageSizeFor('a') + '/' + view.remotePageSizeFor('b'));
if (view.remotePageSizeFor('x') !== 12 || view.remotePageSizeFor(undefined) !== 12) fail('非法/缺键密度应回 A=12');
if (view.normalizeRemoteDensity('b') !== 'b' || view.normalizeRemoteDensity('a') !== 'a' || view.normalizeRemoteDensity('z') !== 'a') fail('密度归一化错误');
if (!view.isRemoteDensity('a') || !view.isRemoteDensity('b') || view.isRemoteDensity('c')) fail('密度校验错误');
if (view.REMOTE_PAGE_SIZE !== 12) fail('REMOTE_PAGE_SIZE 遗留值应保持 12');
ok('B 档 4×2/2×4、A 缺省、B 无额外样式（行列即全部）');

if (view.deriveRemoteOrientation(3840, 2160) !== 'landscape') fail('宽屏应判横屏');
if (view.deriveRemoteOrientation(1080, 1920) !== 'portrait') fail('窄屏应判竖屏');
if (view.deriveRemoteOrientation(NaN, 100) !== 'landscape') fail('非法输入应回横屏兜底');
ok('自适应布局按视口比例切（恒开、零宿主依赖）');

// 方向偏好解析（去宿主化）：锁定覆盖视口，非法回自动/横屏兜底
if (view.resolveRemoteOrientation(1080, 1920, 'landscape') !== 'landscape') fail('横屏锁定应覆盖竖视口');
if (view.resolveRemoteOrientation(3840, 2160, 'portrait') !== 'portrait') fail('竖屏锁定应覆盖横视口');
if (view.resolveRemoteOrientation(3840, 2160, 'auto') !== 'landscape') fail('自动档横视口应横屏');
if (view.resolveRemoteOrientation(1080, 1920, 'auto') !== 'portrait') fail('自动档竖视口应竖屏');
if (view.resolveRemoteOrientation(1080, 1920, 'up') !== 'portrait') fail('非法偏好应回自动（竖视口竖屏）');
ok('方向偏好解析（锁定覆盖、自动跟视口、非法兜底）');

const mkIds = (n) => Array.from({ length: n }, (_, i) => 't' + i);
const ABSENT = { hasSystemOrientation: false, hasSystemFont: false, hasStableOpen: false };

// 27 条 → 3 页：12/12/3，末页补 9 空位，槽位恒 12 高度稳定
// bottom-up 首屏语义（2026-09-29 用户拍板：最常用在第一页底部）：page=0 取末尾 12 条，
// 不满页空位补顶部（内容贴底）；页内保持升序。
let v1 = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (v1.totalPages !== 3 || v1.slots.length !== 12 || v1.cards !== 12 || v1.empties !== 0) fail('第一页应 12 卡 0 空位：' + JSON.stringify({ totalPages: v1.totalPages, cards: v1.cards, empties: v1.empties }));
if (v1.slots[0].id !== 't15' || v1.slots[11].id !== 't26') fail('第一页应为末尾 12 条（最常用在首屏底部），实际 ' + v1.slots[0].id + '..' + v1.slots[11].id);
let v3 = view.computeRemoteView({ ids: mkIds(27), page: 2, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (v3.cards !== 3 || v3.empties !== 9 || v3.slots.length !== 12) fail('末页应 3 卡 9 空位：' + JSON.stringify({ cards: v3.cards, empties: v3.empties }));
if (v3.slots[9].id !== 't0' || v3.slots[11].id !== 't2') fail('末页内容应贴底（空位在顶），实际卡槽 ' + JSON.stringify(v3.slots.filter((s) => s.kind === 'template').map((s) => s.id)));
const emptyKinds = v3.slots.filter((s) => s.kind === 'empty');
if (emptyKinds.length !== 9) fail('空位应为 kind=empty 不可点占位');
// 空位与卡槽同序同尺寸占位：order 连续 0..11，模板槽按序填充
for (let i = 0; i < 12; i++) if (v3.slots[i].order !== i) fail('槽位 order 应连续，实际 ' + v3.slots[i].order);
ok('不满页虚线空位占位、高度稳定（槽位恒十二）');

// 空输入仍一页全空位（高度不跳）
let v0 = view.computeRemoteView({ ids: [], page: 0, orientation: 'portrait', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (v0.totalPages !== 1 || v0.slots.length !== 12 || v0.empties !== 12) fail('空集应一页全空位');
ok('空集高度稳定（一页十二空位）');

// #90 B 档 bottom-up（与 A 同语义，逐字保持）：27 条 → 4 页（8/8/8/3），page0 取末尾 8 条零空位，末页空位顶贴底
let b1 = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false, density: 'b' });
if (b1.totalPages !== 4 || b1.slots.length !== 8 || b1.cards !== 8 || b1.empties !== 0) fail('B 第一页应 8 卡 0 空位：' + JSON.stringify({ totalPages: b1.totalPages, cards: b1.cards, empties: b1.empties }));
if (b1.slots[0].id !== 't19' || b1.slots[7].id !== 't26') fail('B 第一页应为末尾 8 条，实际 ' + b1.slots[0].id + '..' + b1.slots[7].id);
if (b1.cols !== 4 || b1.rows !== 2 || b1.per !== 8) fail('B 横屏应为 4×2=8，实际 ' + b1.cols + '×' + b1.rows + '=' + b1.per);
let bLast = view.computeRemoteView({ ids: mkIds(27), page: 3, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false, density: 'b' });
if (bLast.cards !== 3 || bLast.empties !== 5 || bLast.slots.length !== 8) fail('B 末页应 3 卡 5 空位：' + JSON.stringify({ cards: bLast.cards, empties: bLast.empties }));
if (bLast.slots[5].id !== 't0' || bLast.slots[7].id !== 't2') fail('B 末页内容应贴底（空位在顶），实际卡槽 ' + JSON.stringify(bLast.slots.filter((s) => s.kind === 'template').map((s) => s.id)));
for (let i = 0; i < 8; i++) if (bLast.slots[i].order !== i) fail('B 槽位 order 应连续，实际 ' + bLast.slots[i].order);
let bP = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'portrait', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false, density: 'b' });
if (bP.cols !== 2 || bP.rows !== 4 || bP.per !== 8) fail('B 竖屏应为 2×4=8，实际 ' + bP.cols + '×' + bP.rows + '=' + bP.per);
let b0 = view.computeRemoteView({ ids: [], page: 0, orientation: 'portrait', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false, density: 'b' });
if (b0.totalPages !== 1 || b0.slots.length !== 8 || b0.empties !== 8) fail('B 空集应一页八空位');
let bBad = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false, density: 'z' });
if (bBad.per !== 12 || bBad.slots.length !== 12) fail('非法密度应回 A=12');
ok('B 档 bottom-up（4 页、首屏八卡零空、末页空位顶、空集八空、非法回 A）');

// 页码钳制（不抛、零失败）
let vc = view.computeRemoteView({ ids: mkIds(5), page: 99, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (vc.page !== 0) fail('越界页应钳制到末页，实际 ' + vc.page);
let vn = view.computeRemoteView({ ids: mkIds(5), page: -3, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (vn.page !== 0) fail('负页应钳制到 0');
ok('页码越界钳制');

// 不减行：行列只由方向决定，与内容多少无关（27 条与 5 条同为 4×3）
let vs = view.computeRemoteView({ ids: mkIds(5), page: 0, orientation: 'landscape', enabled: true, size: 1, hostCaps: ABSENT, searchOpen: false });
if (vs.cols !== 4 || vs.rows !== 3 || vs.per !== 12) fail('小内容不应减行，应仍为 4×3=12');
ok('十二槽恒定、卡片收缩、不减行');

// 单滑块倍数表：1档100%，之后150/200/250/300/350/400/450/500/550；非法回默认5档；控制面去封顶（档档自由变大）
if (view.remoteSizeScale(1) !== 1 || view.remoteSizeScale(10) !== 5.5) fail('1/10 档倍数应为 1/5.5');
if (view.remoteSizeScale(2) !== 1.5 || view.remoteSizeScale(4) !== 2.5 || view.remoteSizeScale(7) !== 4) fail('2/4/7 档应为 1.5/2.5/4');
if (view.remoteSizeScale(99) !== 5.5 || view.remoteSizeScale(0) !== 1) fail('越界应钳制到边缘');
if (view.remoteSizeScale('x') !== 3) fail('非数值应回默认 5 档（3x）');
if (view.remoteChromeScale(10) !== 5.5 || view.remoteChromeScale(1) !== 1) fail('控制面去封顶：应跟全额（1/5.5）');
let va = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 1, hostCaps: ABSENT, searchOpen: false });
let vb = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 10, hostCaps: ABSENT, searchOpen: false });
if (va.slots.length !== 12 || vb.slots.length !== 12 || va.totalPages !== vb.totalPages) fail('换档不应减槽');
if (va.fontScale !== 1 || vb.fontScale !== 5.5 || vb.controlScale !== 5.5) fail('视图应回单滑块倍数');
ok('单滑块倍数（线性档位、越界钳制、非法回默认、控制面去封顶）');
// #90 B 档换大小档不减槽（8 槽恒定，页数不变）
let ba = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 1, hostCaps: ABSENT, searchOpen: false, density: 'b' });
let bb = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: true, size: 10, hostCaps: ABSENT, searchOpen: false, density: 'b' });
if (ba.slots.length !== 8 || bb.slots.length !== 8 || ba.totalPages !== bb.totalPages) fail('B 换档不应减槽');
ok('B 档换大小档不减槽');
// #92：宿主内容字纯函数 hostContentFontPx（round(scale*14)，非法回 14；本文件禁 DOM 保持纯）
if (typeof view.hostContentFontPx !== 'function') fail('remoteView.ts 缺 hostContentFontPx 纯函数（#92）');
if (view.hostContentFontPx(1) !== 14) fail('1 档宿主字应为 14px，实际 ' + view.hostContentFontPx(1));
if (view.hostContentFontPx(10) !== 77) fail('10 档宿主字应为 77px（round(5.5*14)），实际 ' + view.hostContentFontPx(10));
if (view.hostContentFontPx(2) !== 21) fail('2 档宿主字应为 21px（round(1.5*14)），实际 ' + view.hostContentFontPx(2));
for (const bad of ['x', NaN, undefined, null, {}, Infinity]) {
  if (view.hostContentFontPx(bad) !== 14) fail('非法宿主字应回 14，输入 ' + String(bad) + ' 实际 ' + view.hostContentFontPx(bad));
}
ok('宿主内容字纯函数（1档14/10档77/非法14）');
// #92：无 DOM 时 syncHostFont 静默 no-op、不抛（typeof document/element 守卫 + fail-soft）
{
  let hostSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'hostfont.ts'), 'utf8');
  let hostJs = ts.transpileModule(hostSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  hostJs = hostJs.split('require("./remoteView")').join('require("./remoteView.cjs")');
  fs.writeFileSync(path.join(DIR, 'hostfont.cjs'), hostJs);
  const hostfont = require(path.join(DIR, 'hostfont.cjs'));
  if (typeof hostfont.syncHostFont !== 'function') fail('hostfont.ts 缺 syncHostFont（#92）');
  try {
    hostfont.syncHostFont(true, 10);
    hostfont.syncHostFont(true, 'x');
    hostfont.syncHostFont(false, 10);
    hostfont.syncHostFont(undefined, undefined);
  } catch (e) { fail('无 DOM 时 syncHostFont 不应抛：' + ((e && e.message) || e)); }
  if (typeof document !== 'undefined') fail('回归环境应无 DOM（本断言仅在无 DOM 下有效）');
  ok('无 DOM 时 syncHostFont 静默 no-op 不抛');
  // 源码级：落点双写（documentElement+body），关即两边 removeProperty；remoteView 保持纯（无 DOM 触点）
  if (!/documentElement/.test(hostSrc) || !/\.body/.test(hostSrc)) fail('hostfont.ts 应双写 documentElement+body（#92 落点）');
  if (!/removeProperty/.test(hostSrc) || !/setProperty/.test(hostSrc)) fail('hostfont.ts 应 setProperty 双写 / removeProperty 恢复');
  if (/__dshPromptLog|logEvent/.test(hostSrc)) fail('hostfont.ts 不应新增日志事件');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'index.ts'), 'utf8');
  if (!/subscribeRemote/.test(indexSrc) || !/syncHostFont/.test(indexSrc)) fail('index.ts 应在启动处订阅 remote 偏好并联动 syncHostFont（#92 接线）');
}
ok('宿主字桥接线（双写落点、无新日志事件）');
// #92 行为级（#92 未生效复盘：此前只有源码存在性断言，“写变量”从未被执行过）：
// 假 document 下直调 syncHostFont —— 开→两边 setProperty 且值为 hostContentFontPx(size)+'px'，
// 关→两边 removeProperty；再走 remote.ts 全链路（index.ts 接线形状：sync+subscribeRemote，
// setRemoteEnabled/Size 驱动），断每一次偏好变更都落到变量写操作。事后还原 document/fetch，不污染后续渲染器用例。
{
  const savedDoc = globalThis.document;
  const savedFetch = globalThis.fetch;
  const seen = [];
  const mkStyle = (tag) => ({
    setProperty: (k, v) => seen.push(tag + '|set|' + k + '|' + v),
    removeProperty: (k) => seen.push(tag + '|del|' + k),
  });
  globalThis.document = { documentElement: { style: mkStyle('root') }, body: { style: mkStyle('body') } };
  try { globalThis.fetch = undefined; } catch (e) { /* ignore */ }
  const FAUCET = '--dsh-content-font-size';
  const hostfont2 = require(path.join(DIR, 'hostfont.cjs'));
  // 开 2 档 → 双写 21px（= hostContentFontPx(2) + 'px'）
  hostfont2.syncHostFont(true, 2);
  if (seen.join(';') !== 'root|set|' + FAUCET + '|21px;body|set|' + FAUCET + '|21px') fail('开2档应双写 21px，实际 ' + seen.join(';'));
  // 开 10 档 → 双写 77px
  seen.length = 0;
  hostfont2.syncHostFont(true, 10);
  if (seen.join(';') !== 'root|set|' + FAUCET + '|77px;body|set|' + FAUCET + '|77px') fail('开10档应双写 77px，实际 ' + seen.join(';'));
  // 开 + 非法档 → 仍写默认 14px（开语义，不删）
  seen.length = 0;
  hostfont2.syncHostFont(true, 'x');
  if (seen.join(';') !== 'root|set|' + FAUCET + '|14px;body|set|' + FAUCET + '|14px') fail('开非法档应双写默认 14px，实际 ' + seen.join(';'));
  // 关 → 双写删（恢复宿主原样）
  seen.length = 0;
  hostfont2.syncHostFont(false, 10);
  if (seen.join(';') !== 'root|del|' + FAUCET + ';body|del|' + FAUCET) fail('关应双写删除，实际 ' + seen.join(';'));
  ok('宿主字桥直调行为（开写值/非法写默认/关删除）');
  // 全链路：偏好变更 → 变量写操作（去重后断言；持久化失败的重复通知只产生重复写，不改变值）
  let remote92Js = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src', 'client', 'remote.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  fs.writeFileSync(path.join(DIR, 'remote92.cjs'), remote92Js);
  const remote92 = require(path.join(DIR, 'remote92.cjs'));
  remote92.__resetRemoteForTests();
  const sync92 = () => {
    const p = remote92.getRemotePrefs();
    hostfont2.syncHostFont(p.enabled, p.size);
  };
  sync92();
  remote92.subscribeRemote(sync92);
  const uniqSeen = () => [...new Set(seen)].join(';');
  seen.length = 0;
  remote92.setRemoteEnabled(true);
  if (uniqSeen() !== 'root|set|' + FAUCET + '|42px;body|set|' + FAUCET + '|42px') fail('开总闸应写默认5档 42px，实际 ' + uniqSeen());
  seen.length = 0;
  remote92.setRemoteSize(10);
  if (uniqSeen() !== 'root|set|' + FAUCET + '|77px;body|set|' + FAUCET + '|77px') fail('拖到10档应写 77px，实际 ' + uniqSeen());
  seen.length = 0;
  remote92.setRemoteSize(5);
  if (uniqSeen() !== 'root|set|' + FAUCET + '|42px;body|set|' + FAUCET + '|42px') fail('拖到5档应写 42px，实际 ' + uniqSeen());
  seen.length = 0;
  remote92.setRemoteEnabled(false);
  if (uniqSeen() !== 'root|del|' + FAUCET + ';body|del|' + FAUCET) fail('关总闸应删变量，实际 ' + uniqSeen());
  ok('宿主字桥全链路行为（开关/拖档落到变量写操作）');
  remote92.__resetRemoteForTests();
  try {
    if (savedFetch === undefined) { try { delete globalThis.fetch; } catch (e) { globalThis.fetch = savedFetch; } }
    else globalThis.fetch = savedFetch;
  } catch (e) { /* ignore */ }
  try {
    if (savedDoc === undefined) { try { delete globalThis.document; } catch (e) { globalThis.document = savedDoc; } }
    else globalThis.document = savedDoc;
  } catch (e) { /* ignore */ }
}
// 工作区 D-targeted（行级钩子实测存在才断言：宿主包 session:/workspace: 行自带 data-row-key）：
// 假 document（head/createElement/querySelector 桩）下开→注入自家 style 写 zoom=档位全额，
// 换档→原位更新（不叠加），关→摘掉；无 DOM 时静默 no-op。
{
  const hostfontRows = require(path.join(DIR, 'hostfont.cjs'));
  if (typeof hostfontRows.syncRemoteRows !== 'function') fail('hostfont.ts 缺 syncRemoteRows（工作区 D-targeted）');
  const headKids = [];
  const fakeHead = {
    appendChild: (el) => { headKids.push(el); el.parentNode = fakeHead; return el; },
    removeChild: (el) => { const i = headKids.indexOf(el); if (i >= 0) headKids.splice(i, 1); return el; },
  };
  const mkStyleTag = () => ({
    attrs: {},
    textContent: '',
    parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
  });
  const savedDoc2 = globalThis.document;
  globalThis.document = {
    head: fakeHead,
    querySelector: () => headKids[0] || null,
    createElement: (tag) => (tag === 'style' ? mkStyleTag() : null),
  };
  // 开 5 档 → 注入 1 枚 style，zoom=3（=remoteSizeScale(5) 全额），选择器只走 data-row-key
  hostfontRows.syncRemoteRows(true, 5);
  if (headKids.length !== 1) fail('开应注入 1 枚 style，实际 ' + headKids.length);
  if (headKids[0].attrs['data-dsh-prompt-style'] !== 'dsh-prompt-remote-rows') fail('style 钩子应为自家位');
  if (headKids[0].textContent !== '[data-row-key^="session:"],[data-row-key^="workspace:"]{zoom:3;}') fail('应写 zoom=3，实际 ' + headKids[0].textContent);
  // 换档 → 原位更新不叠加
  hostfontRows.syncRemoteRows(true, 10);
  if (headKids.length !== 1) fail('换档不应叠加 style，实际 ' + headKids.length);
  if (headKids[0].textContent.indexOf('zoom:5.5') < 0) fail('换 10 档应更新 zoom=5.5，实际 ' + headKids[0].textContent);
  // 非法档 → 回默认 5 档 zoom:3（不断删，开语义）
  hostfontRows.syncRemoteRows(true, 'x');
  if (headKids[0].textContent.indexOf('zoom:3;') < 0) fail('非法档应回默认 zoom=3，实际 ' + headKids[0].textContent);
  // 关 → 摘掉，零残留
  hostfontRows.syncRemoteRows(false, 10);
  if (headKids.length !== 0) fail('关应摘掉 style，实际残留 ' + headKids.length);
  ok('工作区行跟随行为（开注zoom/换档更新/关摘）');
  try {
    if (savedDoc2 === undefined) { try { delete globalThis.document; } catch (e) { globalThis.document = savedDoc2; } }
    else globalThis.document = savedDoc2;
  } catch (e) { /* ignore */ }
}
// 大小跟随开关：关时一切正常尺寸（倍数恒 1，不因档位变）
let voff = view.computeRemoteView({ ids: mkIds(27), page: 0, orientation: 'landscape', enabled: false, size: 10, hostCaps: ABSENT, searchOpen: false });
if (voff.fontScale !== 1 || voff.controlScale !== 1) fail('关时倍数应恒为 1，实际 ' + voff.fontScale);
ok('大小跟随开关（关=正常尺寸）');

// 六格同一组用例换参（横竖 × 4K/2K/1080P）：槽位恒 12、方向正确
const SIX = [
  [3840, 2160, 'landscape'], [2160, 3840, 'portrait'],
  [2560, 1440, 'landscape'], [1440, 2560, 'portrait'],
  [1920, 1080, 'landscape'], [1080, 1920, 'portrait'],
];
for (const [w, hgt, want] of SIX) {
  const o = view.deriveRemoteOrientation(w, hgt);
  if (o !== want) fail('六格方向错误 ' + w + 'x' + hgt + ' 应 ' + want + ' 实际 ' + o);
  const vv = view.computeRemoteView({ ids: mkIds(27), page: 1, orientation: o, enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
  if (vv.slots.length !== 12 || vv.bottomBar.pageText !== '2/3') fail('六格槽位/页码错误 ' + w + 'x' + hgt);
}
ok('六格同一组用例换参（横竖×4K/2K/1080P）槽位恒十二');

// 门槛（去宿主化）：总闸只以自家面为准恒可用；无宿主缺席概念、无灰字
let wt = view.computeRemoteView({ ids: mkIds(5), page: 0, orientation: 'landscape', enabled: true, size: 2, hostCaps: ABSENT, searchOpen: false });
if (wt.threshold.masterEnabled !== true) fail('总闸应可用（去宿主化）');
if (wt.threshold.hostPending !== false || wt.threshold.hostNote !== '') fail('去宿主化后不应有灰字');
let wt2 = view.computeRemoteView({ ids: mkIds(5), page: 0, orientation: 'landscape', enabled: true, size: 2, hostCaps: { hasSystemOrientation: true, hasSystemFont: true, hasStableOpen: true }, searchOpen: false });
if (wt2.threshold.hostPending !== false || wt2.threshold.hostNote !== '') fail('hostCaps 仅兼容保留，不参与门控');
ok('去宿主化门槛：自家面恒可用、无灰字');

// 底栏：翻页与搜索同栏信号（模型回显 searchOpen + 上下页使能 + 两步页码）
if (v1.bottomBar.hasPrev !== false || v1.bottomBar.hasNext !== true) fail('第一页应无上页有下页');
if (v3.bottomBar.hasPrev !== true || v3.bottomBar.hasNext !== false) fail('末页应有上页无下页');
if (v1.bottomBar.pageText !== '1/3') fail('页码文本错误 ' + v1.bottomBar.pageText);
ok('底栏翻页使能与页码（两步可达输入）');

// 标签域：只留全部加在用动态词（去留与悬浮云同值，不另起维度）
const excl = view.remoteTagExcludeList();
for (const w of ['思考框架', '学习', '工程', '执行', '执行前', '执行中', '执行后', '自定义', 'all']) {
  if (!excl.includes(w)) fail('去留表缺 ' + w);
}
const opts = view.remoteTagOptions(['拆解', '思考框架', '执行前', '复盘', '自定义', '我的词']);
if (opts[0] !== '全部') fail('首项应为全部');
if (opts.includes('思考框架') || opts.includes('执行前') || opts.includes('自定义')) fail('领域/阶段/回落词不应进远程标签域');
if (!opts.includes('拆解') || !opts.includes('复盘') || !opts.includes('我的词')) fail('行动词与自定义新词应保留（平权）: ' + JSON.stringify(opts));
ok('标签域收敛（全部+在用动态词单选，自定义平权）');

// 源码级：纯模型不做排序与匹配（复用边界），无长度常量与减行逻辑
const viewSrc = fs.readFileSync(VIEW_TS, 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const viewCode = strip(viewSrc);
if (/sortedTemplates|matchLabel|templateHaystack/.test(viewCode)) fail('纯模型不应重做排序与匹配（复用 store 收敛点）');
if (/\dpx/.test(viewCode)) fail('纯模型不得出现长度常量');
if (/860/.test(viewCode)) fail('原型 min(860,room) 不得沿用');
if (/rows--/.test(viewCode)) fail('原型 rows-- 减行逻辑不得沿用');
ok('唯一新缝边界（不排序不匹配、无长度常量、无减行）');

// ── 2) 源码级：TemplateBrowser 远程分支 ──
const panelSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
const panelCode = strip(panelSrc);
const a = panelSrc.indexOf('REMOTE-BIG-LIST-START');
const b = panelSrc.indexOf('REMOTE-BIG-LIST-END');
if (a < 0 || b < 0 || b <= a) fail('panel.ts 缺 REMOTE-BIG-LIST 分支标记');
const remoteSliceRaw = panelSrc.slice(a, b);
const remoteSlice = strip(remoteSliceRaw);
for (const marker of [
  'data-dsh-prompt-remote-panel', 'data-dsh-prompt-remote-grid',
  'data-dsh-prompt-remote-card', 'data-dsh-prompt-remote-empty',
  'data-dsh-prompt-remote-prev', 'data-dsh-prompt-remote-next',
  'data-dsh-prompt-remote-search', 'data-dsh-prompt-remote-search-input',
  'data-dsh-prompt-remote-add', 'data-dsh-prompt-remote-close',
  'data-dsh-prompt-remote-page',
  'data-dsh-prompt-remote-orient',
]) {
  if (!remoteSlice.includes(marker)) fail('远程分支缺外部行为标记: ' + marker);
}
ok('远程分支外部行为标记齐（十二槽位/底栏键/方向外显）');
// 相对缩放：用相对单位与伸缩规则，无小列表固定尺寸与原型常量
for (const marker of ['minmax(0, 1fr)', 'repeat(', 'flex', '1%', '0.75em']) {
  if (!remoteSlice.includes(marker)) fail('远程分支缺相对缩放标记: ' + marker);
}
for (const bad of ['width: 560', 'height: 360', '860', 'rows--']) {
  if (remoteSlice.includes(bad)) fail('远程分支不得沿用旧常量/演示代码: ' + bad);
}
if (/\dpx/.test(remoteSlice)) fail('远程分支不得出现长度常量');
ok('尺寸规范源码齐（占满锚点上方、相对缩放、无封顶、不减行）');
// 栏头不设切换（#85 US10）：compact 头行仍无远程字样（远程分支独立头行除外）
const headSlice = panelCode.slice(panelCode.indexOf('compact ? h('), panelCode.indexOf('compact ? h(') + 3000);
if (/remote|远程|大列表|小列表/.test(headSlice)) fail('小列表栏头不得设大/小切换');
// trigger 未动（US27 管理面保持原样）
const triggerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'trigger.ts'), 'utf8');
if (/remote/i.test(strip(triggerSrc))) fail('/prompt 触发源不应被远程改动');
ok('栏头不设切换、管理面保持原样');

// ── 3) 渲染器：远程装配（只断外部行为，不刺探样式与 DOM 细节） ──
const MODULES = [
  ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), []],
  ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
  ['remote2.cjs', path.join(ROOT, 'src', 'client', 'remote.ts'), []],
  ['remoteView.cjs', VIEW_TS, []],
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
  js = js.split('require("./remoteView.cjs")').join('require("./remoteView.cjs")');
  const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
  fs.writeFileSync(path.join(DIR, outFile), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const panelMod = require(path.join(DIR, 'panel.cjs'));
const remote2 = require(path.join(DIR, 'remote2.cjs'));

// 关=小列表：远程面板不应出现（老用法零打扰）
remote2.__resetRemoteForTests();
remote2.__setRemoteHostCapsForTests(null);
let off1;
TR.act(() => { off1 = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
let panelsOff = off1.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-panel'] === '1');
if (panelsOff.length !== 0) fail('关时不应出现大列表（零打扰）');
ok('渲染器：关=小列表不变（零打扰）');

// 开=大列表：十二槽位恒十二、底栏键齐（去宿主化，无灰字）
remote2.setRemoteEnabled(true);
let on1;
TR.act(() => { on1 = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
let root = on1.root;
const byAttr = (k, v) => root.findAll((x) => x.props && x.props[k] === v);
const panelNode = byAttr('data-dsh-prompt-remote-panel', '1')[0];
if (!panelNode) fail('开时应出现大列表面板');
const grid = byAttr('data-dsh-prompt-remote-grid', '1')[0];
if (!grid) fail('缺十二槽网格');
const cards = byAttr('data-dsh-prompt-remote-card', '1');
const empties = byAttr('data-dsh-prompt-remote-empty', '1');
if (cards.length + empties.length !== 12) fail('可见槽位恒十二，实际卡 ' + cards.length + ' 空 ' + empties.length);
if (cards.length === 0) fail('预制 24 条下首屏应有卡');
// 卡面：标题加简介封顶、用量红色数字可见（只断存在，不刺探样式）；去宿主化后无灰字
const flat = JSON.stringify(on1.toJSON());
if (byAttr('data-dsh-prompt-remote-use', '1').length === 0) fail('卡面应显用量红色数字');
if (!/\d/.test(flat)) fail('卡面应显用量数');
if (/整机待宿主/.test(flat)) fail('去宿主化后不应有灰字');
// 底栏键同栏（#132）：新增 + 上页/搜索/下页 + 关闭 + 页码（标签已移除）
for (const [k, name] of [['data-dsh-prompt-remote-add', '新增'], ['data-dsh-prompt-remote-prev', '上页'], ['data-dsh-prompt-remote-next', '下页'], ['data-dsh-prompt-remote-search', '搜索'], ['data-dsh-prompt-remote-close', '关闭'], ['data-dsh-prompt-remote-page', '页码']]) {
  if (byAttr(k, '1').length === 0) fail('底栏缺 ' + name + ' [' + k + ']');
}
ok('渲染器：开=大列表十二槽位、底栏键同栏、无灰字');

// 搜索收起行内顶起：点底栏搜索键展开输入，再点收起
const searchBtn = byAttr('data-dsh-prompt-remote-search', '1')[0];
if (byAttr('data-dsh-prompt-remote-search-input', '1').length !== 0) fail('搜索默认应收起');
TR.act(() => { searchBtn.props.onClick(); });
if (byAttr('data-dsh-prompt-remote-search-input', '1').length !== 1) fail('点搜索键应展开行内输入');
const input = byAttr('data-dsh-prompt-remote-search-input', '1')[0];
// 输入过滤：按名称子串过滤，槽位仍恒十二
TR.act(() => { input.props.onChange({ target: { value: '复盘' } }); });
let cards2 = byAttr('data-dsh-prompt-remote-card', '1');
let empties2 = byAttr('data-dsh-prompt-remote-empty', '1');
if (cards2.length + empties2.length !== 12) fail('过滤后槽位仍恒十二');
if (cards2.length === 0) fail('搜“复盘”应有命中');
// 组词期 API 存在（保留输入法组词）
if (typeof input.props.onCompositionStart !== 'function' || typeof input.props.onCompositionEnd !== 'function') fail('搜索应保留输入法组词期处理');
ok('渲染器：搜索收起行内顶起、子串过滤、组词保留');

// #132 标签区已移除：底栏无标签域，过滤只走搜索框；新增键在搜索左侧紧邻，点击开新增弹窗
if (byAttr('data-dsh-prompt-remote-tags', '1').length !== 0) fail('标签域应已移除（#132）');
// 收起搜索避免叠加过滤
TR.act(() => { byAttr('data-dsh-prompt-remote-search', '1')[0].props.onClick(); });
const addBtn = byAttr('data-dsh-prompt-remote-add', '1')[0];
if (!addBtn) fail('底栏缺新增键（#132）');
const addText = Array.isArray(addBtn.children) ? addBtn.children.join('') : String(addBtn.children || '');
if (!/新增/.test(addText)) fail('新增键文案应含“新增”，实际 ' + addText);
if (addBtn.props['aria-label'] !== addBtn.props.title) fail('新增键名称应与可见标签一致（WCAG 2.5.3）');
TR.act(() => { addBtn.props.onClick(); });
if (root.findAll((x) => x.props && x.props['data-dsh-prompt-modal'] === '').length === 0) fail('点新增键应打开新增弹窗（#132）');
ok('渲染器：#132 去标签、新增键在搜索左侧并可开弹窗');

// 翻页：24 条预制下两页，翻页后仍恒十二
remote2.__resetRemoteForTests();
remote2.setRemoteEnabled(true);
let pg;
TR.act(() => { pg = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
let pgRoot = pg.root;
const pgBy = (k, v) => pgRoot.findAll((x) => x.props && x.props[k] === v);
const nextBtn = pgBy('data-dsh-prompt-remote-next', '1')[0];
if (!nextBtn || nextBtn.props.disabled === true) fail('首屏应可下翻（24 条两页）');
const page0 = pgBy('data-dsh-prompt-remote-page', '1')[0].children.join('');
if (page0 !== '1/2') fail('首屏页码应 1/2，实际 ' + page0);
TR.act(() => { nextBtn.props.onClick(); });
const page1 = pgBy('data-dsh-prompt-remote-page', '1')[0].children.join('');
if (page1 !== '2/2') fail('翻页后应 2/2，实际 ' + page1);
if (pgBy('data-dsh-prompt-remote-card', '1').length + pgBy('data-dsh-prompt-remote-empty', '1').length !== 12) fail('翻页后槽位仍恒十二');
ok('渲染器：翻页两步可达、槽位恒十二');

// #90 B 档渲染：面板透传 density，24 条预制下三页（8/8/8），槽位恒八
remote2.__resetRemoteForTests();
remote2.setRemoteEnabled(true);
remote2.setRemoteDensity('b');
let pgB;
TR.act(() => { pgB = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
let pgBRoot = pgB.root;
const pgBBy = (k, v) => pgBRoot.findAll((x) => x.props && x.props[k] === v);
if (pgBBy('data-dsh-prompt-remote-card', '1').length + pgBBy('data-dsh-prompt-remote-empty', '1').length !== 8) fail('B 档可见槽位恒八');
const pageB0 = pgBBy('data-dsh-prompt-remote-page', '1')[0].children.join('');
if (pageB0 !== '1/3') fail('B 档首屏页码应 1/3，实际 ' + pageB0);
const nextB = pgBBy('data-dsh-prompt-remote-next', '1')[0];
TR.act(() => { nextB.props.onClick(); });
if (pgBBy('data-dsh-prompt-remote-page', '1')[0].children.join('') !== '2/3') fail('B 档翻页后应 2/3');
if (pgBBy('data-dsh-prompt-remote-card', '1').length + pgBBy('data-dsh-prompt-remote-empty', '1').length !== 8) fail('B 档翻页后槽位仍恒八');
ok('渲染器：B 档八槽位、翻页三页可达');

// 方向属性：横竖由视口导出（只断属性，不刺探样式）
const orient = pgBy('data-dsh-prompt-remote-orient', 'landscape').length > 0 ? 'landscape' : (pgBy('data-dsh-prompt-remote-orient', 'portrait').length > 0 ? 'portrait' : '');
if (!orient) fail('缺方向属性（自适应布局外显）');
ok('渲染器：自适应方向外显（' + orient + '）');

// 编辑弹窗标签网格：建一条自建，进编辑弹窗，远程下标签为正方形网格（非 datalist），字形走卡根 em
const storeMod = require(path.join(DIR, 'store.cjs'));
remote2.__resetRemoteForTests();
remote2.setRemoteEnabled(true);
storeMod.addCustom('网格用例', ['复盘'], '正文占位');
let mgmt;
TR.act(() => { mgmt = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
const mgRoot = mgmt.root;
const mgBy = (k, v) => mgRoot.findAll((x) => x.props && x.props[k] === v);
const editBtn = mgBy('data-dsh-prompt-remote-act', 'edit')[0];
if (!editBtn) fail('自建卡应有编辑键');
TR.act(() => { editBtn.props.onClick({ stopPropagation: () => undefined }); });
if (mgBy('data-dsh-prompt-label-grid', '1').length !== 0) fail('网格平时不应常驻，应点触发键后浮出');
const picker = mgBy('data-dsh-prompt-label-picker', '1')[0];
if (!picker) fail('应有标签触发键');
TR.act(() => { picker.props.onClick(); });
if (mgBy('data-dsh-prompt-label-grid', '1').length !== 1) fail('点触发键后应浮出标签网格');
const cells = mgBy('data-dsh-prompt-label-cell', '1');
if (cells.length === 0) fail('网格应有候选格');
if (mgRoot.findAll((x) => x.type === 'datalist').length !== 0) fail('远程下不应再出原生下拉');
ok('渲染器：远程编辑弹窗标签正方形网格');

remote2.__resetRemoteForTests();
remote2.__setRemoteHostCapsForTests(null);

console.log('=== Test #83 PASS ===');
process.exit(0);
