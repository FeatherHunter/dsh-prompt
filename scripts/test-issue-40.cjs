// 回归 #40：设置面板顶部的「检查更新」入口 + 更新弹窗（手动路径，含 8 条失败原因中文文案）
//
// 契约（票面「交付」0–4 与「验收」逐条）：
//  1) 设置面板顶层第一行是「检查更新」入口（左对齐、带当前版本号），排在 #37 那一行右上角图标**之上**，
//     且不重排 #37 的内容（同样的块、同样的顺序，只是整体后移一位）；
//  2) 弹窗复用 panel.ts 的 ModalPortal + MODAL_Z（不另起一套顶层机制）；
//  3) 弹窗内四件事全做：状态区（当前/已装/最新 + 检查/安装按钮，canInstall 为假时不给安装按钮）、
//     失败原因文案（给「用户该做什么」，不是只给英文原因码）、⚠️ 待重启横幅（显眼样式）、
//     手工兜底命令（现刷不缓存、为空时只讲原因，并交代它不是万能药）；
//  4) 文案在 i18n.ts 里中英双语；客户端电话表只走 src/update/bridge.ts（本票不写字面量）。
//
// 三条形态必须都收（票面「开工前的前置条件」5）：
//  a) `blockedReason:"installation-changed"` —— 正常回包里的原因；
//  b) **电话级失败**（宿主回 `{ok:false, value:{…}, error:{code}}`）→ 客户端 `snapshot` 为 null：
//     只按 `snapshot.blockedReason` 渲染会**空白**，本票必须有明确呈现（#55 真机实测的形态）；
//  c) `blockedReason` 中文映射 —— 本版本实产 7 条，第 8 条 `registry-conflict` 零处产出，只许预留。
//
// 本脚本**不碰真机**：假 fetch 只应答桥的三条端点，不联网、不装包、不动 profile。
// 另外它替 #39 的复审 H 钉住「前置条件 2（R2）」：新成因在特定序列下不许永久不可见（见 T9）。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-40');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);

let failures = 0;
function ok(msg) { console.log('  ok: ' + msg) }
function bad(msg) { failures++; console.log('  FAIL: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}

/* ── 转译客户端模块到 .rt-tmp-40（沿用仓内既有先例：ts.transpileModule → CJS + 改 require 后缀） ── */
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const MODULES = [
  ['templates.ts', SRC('templates.ts'), []],
  ['store.ts', SRC('store.ts'), ['./templates']],
  ['state.ts', SRC('state.ts'), []],
  ['i18n.ts', SRC('i18n.ts'), []],
  ['smartstore.ts', SRC('smartstore.ts'), []],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['about.ts', SRC('about.ts'), ['./panel', './i18n']],
  ['update.ts', SRC('update.ts'), ['./panel', './i18n', '../update/bridge']],
  ['settings.ts', SRC('settings.ts'), ['./panel', './about', './update', './smartstore', './i18n']],
  ['bridge.ts', path.join(ROOT, 'src', 'update', 'bridge.ts'), ['./gen/updateClient.derived.js']],
  ['updateClient.derived.js', path.join(ROOT, 'src', 'update', 'gen', 'updateClient.derived.js'), []],
];
for (const [outName, srcPath, deps] of MODULES) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const d of deps) {
    // '../update/bridge' 这类跨目录依赖要落到本临时目录里的同名产物上（bridge 的派生文件同理）
    const target = d === '../update/bridge' ? './bridge.cjs' : d === './gen/updateClient.derived.js' ? './updateClient.derived.cjs' : d + '.cjs';
    js = js.split('require("' + d + '")').join('require("' + target + '")');
  }
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs').replace(/\.js$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const panel = require(path.join(DIR, 'panel.cjs'));
const settings = require(path.join(DIR, 'settings.cjs'));
const update = require(path.join(DIR, 'update.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));

/* ── 假宿主：只应答桥的三条端点，形状与 lib/index.js 的 writeJson 一致 ── */
const STATUS_PATH = '/_dsh/dsh-prompt/update/status';
const CHECK_PATH = '/_dsh/dsh-prompt/update/check';
const INSTALL_PATH = '/_dsh/dsh-prompt/update/install';
const requests = [];
const others = [];
const script = { status: null, check: null, install: null };
const okEnv = (snapshot, manual, receipt) => ({
  ok: true, value: { ok: true, snapshot, manual: manual === undefined ? null : manual, receipt: receipt === undefined ? null : receipt },
});
/** 电话级失败 / 能力缺席：宿主 `lib/index.js:508` 的 `{ ok:false, value:<电话回包>, error:{code} }`。 */
const failEnv = (code) => ({ ok: false, value: { ok: false, error: code, errorKind: code }, error: { code, message: code } });
const snap = (over) => Object.assign({
  runningVersion: '0.1.7', installedVersion: '0.1.7', latestVersion: null, canInstall: false, blockedReason: null, job: null,
}, over);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const which = u === STATUS_PATH ? 'status' : u === CHECK_PATH ? 'check' : u === INSTALL_PATH ? 'install' : '';
  if (!which) {
    // 设置页还会按老路子问宿主别的端点（store 的 ensureLoaded）—— 那是别的票的地盘，
    // 这里只记一笔、回一个诚实的失败信封，别让它干扰本票的三条电话。
    others.push(u);
    return { status: 200, json: async () => ({ ok: false, error: { code: 'test-other-endpoint' } }) };
  }
  requests.push({ which, url: u, method: init && init.method, body: JSON.parse((init && init.body) || '{}') });
  const body = typeof script[which] === 'function' ? script[which]() : script[which];
  if (!body) throw new Error('测试没给 ' + which + ' 的回包');
  return { status: 200, json: async () => body };
};

/* ── 渲染小工具 ── */
const txt = (n) => {
  if (n && typeof n.toJSON === 'function') n = n.toJSON();
  const parts = [];
  const walk = (c) => {
    if (c === null || c === undefined || c === false || c === true) return;
    if (typeof c === 'string' || typeof c === 'number') { parts.push(String(c)); return }
    if (Array.isArray(c)) { c.forEach(walk); return }
    if (c.children) c.children.forEach(walk);
  };
  walk(n);
  return parts.join('');
};
const flush = async () => {
  await TR.act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
};
const mount = async (el) => {
  let c;
  await TR.act(async () => { c = TR.create(el) });
  await flush();
  return c;
};
const nodes = (c, attr) => c.root.findAll((x) => !!x.props && x.props[attr] !== undefined);
const one = (c, attr) => nodes(c, attr)[0];
const act = async (fn) => { await TR.act(async () => { fn() }); await flush() };
/** 从 toJSON 的宿主树里捞 <a>（复用 test-issue-37 的走法，按内容找而不是按索引钉死）。 */
const jsonAnchors = (n) => {
  const out = [];
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { c.forEach(walk); return }
    if (c.type === 'a') out.push(c);
    (c.children || []).forEach(walk);
  };
  walk(n);
  return out;
};

/** 包 README 第 8 节第三列的可执行要求：逐字抄成可判定的片段（与本仓文案表相互独立）。 */
const README_DO = {
  'unknown-profile': '检查使用范围名是否含特殊字符',
  'source-install': '不给手工命令',
  'invalid-installation': '重装当前版本',
  'installation-changed': '让指纹重新绑定',
  'pending-restart': '重启宿主',
  'registry-conflict': '改成版本号再试',
  'incompatible-node': 'Node 到 22',
  'recovery-required': '重新点一次',
};
/** 本版本（包 0.1.1）**实产**的 7 条；`registry-conflict` 零处产出，只许预留文案（不许为它编情形）。 */
const PRODUCED = ['unknown-profile', 'invalid-installation', 'installation-changed', 'source-install', 'pending-restart', 'incompatible-node', 'recovery-required'];
const RESERVED = ['registry-conflict'];
/** 包 README 第 9 节：manual 为空是正常的两种情形（源码安装与认不出使用范围）。 */
const EMPTY_MANUAL = ['unknown-profile', 'source-install'];

(async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const updateSrc = fs.readFileSync(SRC('update.ts'), 'utf8');
  const bridgeSrc = fs.readFileSync(path.join(ROOT, 'src', 'update', 'bridge.ts'), 'utf8');
  const panelSrc = fs.readFileSync(SRC('panel.ts'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'README.md'), 'utf8');

  console.log('=== T1: 接线纪律（电话表只走 bridge，顶层机制复用 panel） ===');
  eq(typeof pkg.scripts['test:issue-40'], 'string', 'package.json 有 test:issue-40 入口');
  eq(/from '\.\.\/update\/bridge'/.test(updateSrc), true, 'update.ts 从 src/update/bridge 取电话表');
  eq(/createUpdateBridge|updatePhoneNames/.test(updateSrc), true, 'update.ts 用的是 bridge 给的工厂与电话名');
  eq(/(prompt\.updateStatus|prompt\.updateCheck|prompt\.updateInstall)/.test(updateSrc), false,
    'update.ts 里没有电话名字面量（名字从派生文件来）');
  eq(/['"`]\/_dsh\/dsh-prompt/.test(updateSrc), false, 'update.ts 里没有端点路径字面量（路径在 bridge 里）');
  eq(/import \{[^}]*ModalPortal[^}]*\} from '\.\/panel'/.test(updateSrc), true, '弹窗经 panel.ts 的 ModalPortal 顶层化');
  eq(/MODAL_Z/.test(updateSrc), true, '弹窗层叠用 panel.ts 的 MODAL_Z');
  eq(/export function ModalPortal/.test(panelSrc), true, 'panel.ts 导出 ModalPortal（#40 的最小接入：只加 export，不重排）');

  console.log('=== T2: 八条原因码与包 README 对账 + 本版本实产 7 条 ===');
  // 只在第 8 节那一节里数表行（README 别处也有 `| \`x\` |` 形状的表，不切片会多出无关行）
  const sec8 = readme.slice(readme.indexOf('## 8.'), readme.indexOf('## 9.'));
  const tableRows = sec8.split('\n').filter((l) => /^\| `[a-z-]+` \|/.test(l));
  const readmeCodes = tableRows.map((l) => l.split('|')[1].trim().replace(/`/g, ''));
  eq(readmeCodes.length, 8, '包 README 第 8 节列了 8 条原因码');
  eq(Object.keys(update.UPDATE_REASON_KEYS).sort(), readmeCodes.slice().sort(), '本仓文案表与 README 的八条逐条对齐（不多不少）');
  for (const code of readmeCodes) {
    const key = update.UPDATE_REASON_KEYS[code];
    const zh = STR[key] && STR[key].zh, en = STR[key] && STR[key].en;
    if (!zh || !en) { bad('文案表缺 ' + code + ' → ' + key); continue }
    eq(zh.indexOf(README_DO[code]) >= 0, true, code + '：中文文案含 README 第三列的可执行要求（' + README_DO[code] + '）');
    eq(/[\u4e00-\u9fff]/.test(en), false, code + '：英文文案不含中文');
    eq(zh !== en, true, code + '：中英不同（不是复制同一份）');
  }
  // 「实产 7 条」不是说法而是可量的：只数**真正的产出点** —— 包里给 `blockedReason` 赋字面量的那些行
  // （reader.js 的 env 判定 + service.js 的快照判定）。包升版若开始产 registry-conflict，这里先红，
  // 提醒补情形——这条红是**刻意的**，不是误报。
  const distFiles = fs.readdirSync(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist')).filter((f) => f.endsWith('.js'));
  const distOf = (f) => fs.readFileSync(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', f), 'utf8');
  const producers = [];
  for (const f of distFiles) {
    for (const line of distOf(f).split('\n')) {
      if (line.indexOf('blockedReason') < 0) continue;
      for (const m of line.matchAll(/"([a-z-]+)"/g)) if (readmeCodes.indexOf(m[1]) >= 0) producers.push(m[1]);
    }
  }
  eq(Array.from(new Set(producers)).sort(), PRODUCED.slice().sort(),
    '包 0.1.1 里 blockedReason 的产出点正好是这 7 条（registry-conflict 一个产出点都没有）');
  eq(producers.indexOf('registry-conflict'), -1, '没有任何一行把 registry-conflict 写进 blockedReason');
  // 但也不许说「包里没有这个词」：它确实出现在两处**非产出**的地方（透传白名单 / job.message 判断）。
  // 实测位置：host.js 的 known 码表、service.js:284 的 `code === "registry-conflict"` 透传判断。
  eq(distOf('host.js').indexOf('registry-conflict') >= 0, true,
    'registry-conflict 出现在 host.js 的 known 码表里（透传白名单，不是产出点）');
  eq(distOf('service.js').split('\n').filter((l) => l.indexOf('registry-conflict') >= 0 && l.indexOf('blockedReason') < 0).length > 0, true,
    'registry-conflict 也出现在 service.js 的安装失败 job.message 判断里（同样不是 blockedReason 产出点）');
  for (const code of RESERVED) {
    const key = update.UPDATE_REASON_KEYS[code];
    eq(typeof (STR[key] && STR[key].zh) === 'string' && STR[key].zh.length > 0, true, code + '：预留文案在表里（没有为它编情形）');
  }

  console.log('=== T3: 入口行（设置页顶层第一行，带当前版本号；点开弹窗） ===');
  script.status = okEnv(snap(), 'dsh plugin --profile web add --save-exact dsh-prompt@0.1.7 --registry=https://registry.npmjs.org/');
  const page = await mount(React.createElement(settings.SettingsPage, {}));
  await flush();
  const kids = page.toJSON().children;
  eq(kids.length, 7, '设置页顶层七块（#40 在 #37 的六块之上加了一行）');
  eq(txt(kids[0]).indexOf(STR.updateEntry.zh) >= 0, true, '第 1 块是「检查更新」入口');
  eq(txt(kids[0]).indexOf('v0.1.7') >= 0, true, '入口行带当前版本号（v0.1.7，来自 status 回包）');
  eq(txt(kids[1]).indexOf('⛭') < 0, true, '#37 的旧文字链接仍不在');
  eq(jsonAnchors(kids[1]).length, 2, '#37 的右上角两个图标按钮原样在第二行（顺序不变）');
  eq(jsonAnchors(kids[1]).map((a) => a.props.href).join('|'),
    'https://github.com/FeatherHunter/dsh-prompt|https://github.com/FeatherHunter/dsh-prompt/issues',
    '#37 两个按钮的地址与顺序一字不动');
  const all = page.root.findAll(() => true);
  const entryIdx = all.findIndex((x) => x.props && x.props['data-dsh-prompt-update'] !== undefined);
  const linkIdx = all.findIndex((x) => x.props && x.props['aria-label'] === STR.gitHubRepo.zh);
  eq(entryIdx >= 0 && linkIdx >= 0 && entryIdx < linkIdx, true, '入口排在 #37 图标行之上（DOM 顺序）');
  eq(requests.length, 1, '打开设置页只发生一次通话（正好一次，不重复打）');
  eq(requests[0].which, 'status', '打的是 status（只读本机、不联网）；自动查新版是 #41 的事，本票不擅自联网');
  eq(requests[0].method, 'POST', '通话走 POST');
  await act(() => { one(page, 'data-dsh-prompt-update').props.onClick() });
  eq(!!one(page, 'data-dsh-prompt-update-modal'), true, '点入口行打开弹窗');
  eq(txt(one(page, 'data-dsh-prompt-update-modal')).length > 30, true, '弹窗有内容（不是空白）');
  page.unmount();

  console.log('=== T4: 状态区 + 检查/安装按钮（含裸调 install 的功能守卫） ===');
  script.status = okEnv(snap({ canInstall: false }), 'CMD_STATUS');
  let m = await mount(React.createElement(update.UpdateEntry, {}));
  let modal = one(m, 'data-dsh-prompt-update-modal');
  eq(!!modal, false, '弹窗前不渲染遮罩');
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  modal = one(m, 'data-dsh-prompt-update-modal');
  eq(!!modal, true, '弹窗已开');
  const field = (k) => nodes(m, 'data-dsh-prompt-update-field').filter((n) => n.props['data-dsh-prompt-update-field'] === k)[0];
  eq(txt(field('running')), '0.1.7', '状态区：当前版本');
  eq(txt(field('installed')), '0.1.7', '状态区：已装版本');
  eq(txt(field('latest')), STR.updateLatestNone.zh, '状态区：最新版本（没查过就明说，不留空）');
  eq(!!one(m, 'data-dsh-prompt-update-action'), true, '有「检查更新」按钮');
  eq(nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install').length, 0,
    'canInstall 为假 → 不给安装按钮');
  // 点「检查更新」→ 拿到最新版本与凭证 → 安装按钮出现
  requests.length = 0;
  script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD_CHECK', { checkId: 'CHK-42', checkedAt: 1, expiresAt: 2 });
  script.install = okEnv(snap({ latestVersion: '0.1.9', canInstall: true, job: { state: 'restart-required' } }), 'CMD_INSTALL', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(requests.map((r) => r.which), ['check'], '点「检查更新」只打 check');
  eq(txt(field('latest')), '0.1.9', '状态区：最新版本取回包（现刷，不缓存）');
  const installBtn = nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0];
  eq(!!installBtn, true, 'canInstall 为真 → 出现安装按钮');
  requests.length = 0;
  await act(() => { installBtn.props.onClick() });
  eq(requests.map((r) => r.which), ['install'], '点安装只打 install（手里已有凭证）');
  eq(requests[0].body.checkId, 'CHK-42', '安装带上「检查更新」发的 checkId（不是裸调）');
  eq(typeof requests[0].body.requestId === 'string' && requests[0].body.requestId.length > 0, true, '安装带上 requestId');
  m.unmount();

  // 裸调 install 必回 check-expired（包的功能守卫）：面板不许赌，没有凭证就先补一次 check。
  script.status = okEnv(snap({ canInstall: true, latestVersion: '0.1.9' }), 'CMD_STATUS', null);
  m = await mount(React.createElement(update.UpdateEntry, {}));
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  requests.length = 0;
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0].props.onClick();
  });
  eq(requests.map((r) => r.which), ['check', 'install'], 'canInstall 为真但手里没凭证：先补 check 再 install（不裸调）');
  eq(requests[1].body.checkId, 'CHK-42', '补 check 拿到的凭证用在了 install 上');
  m.unmount();

  console.log('=== T5: 七条实产原因的中文文案（含 manual 为空的两种情形） ===');
  for (const code of PRODUCED) {
    const manual = EMPTY_MANUAL.indexOf(code) >= 0 ? '' : 'dsh plugin --profile web add --save-exact dsh-prompt@9.9.9 --registry=https://registry.npmjs.org/';
    script.status = okEnv(snap({ blockedReason: code, latestVersion: '0.1.9' }), manual);
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    const reason = one(c, 'data-dsh-prompt-update-reason');
    if (!reason) { bad(code + '：没有渲染原因块'); c.unmount(); continue }
    const body = txt(reason);
    eq(body.indexOf(code) >= 0, true, code + '：原因块带原始原因码（便于报 Issue）');
    eq(body.indexOf(STR[update.UPDATE_REASON_KEYS[code]].zh) >= 0, true, code + '：原因块给的是「用户该做什么」中文文案');
    eq(body.replace(code, '').trim().length > 8, true, code + '：不是只显示英文原因码');
    if (manual) {
      eq(txt(one(c, 'data-dsh-prompt-update-command')), manual, code + '：手工命令逐字展示');
      eq(!!one(c, 'data-dsh-prompt-update-manual-empty'), false, code + '：有命令就不显示「没有命令」那句');
    } else {
      eq(!!one(c, 'data-dsh-prompt-update-command'), false, code + '：manual 为空 → 不展示命令');
      eq(!!one(c, 'data-dsh-prompt-update-manual-empty'), true, code + '：manual 为空 → 只讲原因（并说明没有命令）');
    }
    c.unmount();
  }
  ok('七条实产原因逐条对过（' + PRODUCED.join(' / ') + '）；manual 为空的两种情形 = ' + EMPTY_MANUAL.join(' / '));

  console.log('=== T6: 电话级失败（snapshot 为 null）必须有呈现，不是空白 ===');
  for (const code of ['unknown-profile', 'update-capability-unavailable']) {
    script.status = failEnv(code);
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    await flush();
    eq(txt(one(c, 'data-dsh-prompt-update-version')), STR.updateVersionUnknown.zh, code + '：入口行宁可说「版本未知」，也不空白');
    const hostfail = one(c, 'data-dsh-prompt-update-hostfail');
    if (!hostfail) { bad(code + '：snapshot 为 null 时弹窗没有专门呈现（会是一片空白）'); c.unmount(); continue }
    const body = txt(hostfail);
    eq(body.indexOf(STR.updateHostFailTitle.zh) >= 0, true, code + '：说清「宿主没有回答更新状态」');
    eq(txt(one(c, 'data-dsh-prompt-update-code')), code, code + '：把原始错误码给出来');
    if (code === 'unknown-profile') {
      eq(body.indexOf(STR.updateWhyUnknownProfile.zh) >= 0, true, 'unknown-profile：电话级失败时也把「该做什么」给出来（同一张原因码表）');
    }
    eq(txt(one(c, 'data-dsh-prompt-update-modal')).length > 30, true, code + '：弹窗整体有内容（不是空白）');
    c.unmount();
  }

  console.log('=== T7: ⚠️ 待重启横幅（显眼样式、说清版本与重启、不给安装按钮） ===');
  script.status = okEnv(snap({ blockedReason: 'pending-restart', runningVersion: '0.1.6', installedVersion: '0.1.7', latestVersion: '0.1.7', canInstall: false }), 'CMD');
  m = await mount(React.createElement(update.UpdateEntry, {}));
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  const banner = one(m, 'data-dsh-prompt-update-banner');
  if (!banner) bad('pending-restart 没有渲染横幅');
  else {
    const body = txt(banner);
    eq(body.indexOf('⚠️') >= 0, true, '横幅带 ⚠️');
    eq(body.indexOf('0.1.7') >= 0 && body.indexOf('0.1.6') >= 0, true, '横幅说清新版号与正在跑的版本');
    eq(body.indexOf('重启宿主后生效') >= 0, true, '横幅说清「重启宿主后生效」');
    eq(!!banner.props.style && !!banner.props.style.background && !!banner.props.style.border, true,
      '横幅是显眼样式（有底色与描边，不是一行灰字）');
    eq(banner.props.title, undefined, '横幅不是悬停提示里的一行小字');
    const seen = m.root.findAll(() => true);
    const at = (n) => seen.findIndex((x) => x.props && x.props['data-dsh-prompt-update-field'] === n);
    eq(seen.indexOf(banner) < at('running'), true, '横幅在状态区之上（顶部横幅）');
  }
  eq(nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install').length, 0,
    '待重启期间不给安装按钮');
  m.unmount();

  console.log('=== T8: 手工命令现刷不缓存 + 它不是万能药（前置条件 6） ===');
  script.status = okEnv(snap(), 'CMD_A');
  m = await mount(React.createElement(update.UpdateEntry, {}));
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  eq(txt(one(m, 'data-dsh-prompt-update-command')), 'CMD_A', '先展示 status 给的命令');
  eq(txt(m).indexOf(STR.updateManualHint.zh) >= 0, true, '命令旁边交代局限（干活的是已装那一侧 / 清不掉 installation-changed）');
  script.check = okEnv(snap(), 'CMD_B', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(txt(one(m, 'data-dsh-prompt-update-command')), 'CMD_B', 'check 回包换了命令 → 界面跟着换（不是缓存旧命令）');
  eq(txt(m).indexOf('CMD_A'), -1, '旧命令不再留在界面上');
  script.check = okEnv(snap(), '', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(!!one(m, 'data-dsh-prompt-update-command'), false, '回包命令为空 → 命令整块消失');
  eq(!!one(m, 'data-dsh-prompt-update-manual-empty'), true, '空命令时给出「宿主没给命令」的说明');
  // 复制按钮：把**当前**命令写进剪贴板（不是旧的那条）
  script.check = okEnv(snap(), 'CMD_COPY', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(txt(one(m, 'data-dsh-prompt-update-command')), 'CMD_COPY', '回包里换了一条命令');
  let copied = '';
  // Node 20+ 自带只读的 globalThis.navigator（accessor、无 setter）⇒ 直接赋值会被静默忽略，
  // 必须 defineProperty 顶掉它，否则走的是「没有剪贴板 API」那条兜底路（本机无 DOM ⇒ 复制失败）。
  const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true, value: { clipboard: { writeText: async (t2) => { copied = t2 } } },
  });
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'copy')[0].props.onClick();
  });
  eq(copied, 'CMD_COPY', '复制按钮把当前命令逐字写进剪贴板');
  eq(txt(m).indexOf(STR.updateCopied.zh) >= 0, true, '复制成功有回执');
  if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
  m.unmount();

  console.log('=== T9: 前置条件 2（R2）——新成因不许永久不可见（#39 复审 H 的序列） ===');
  const builtPath = path.join(ROOT, 'lib', 'update.js');
  if (!fs.existsSync(builtPath)) bad('lib/update.js 不存在（先 npm run build）');
  const builtMod = await import(pathToFileURL(builtPath).href);
  let r2Now = 0;
  const r2Fired = [];
  let r2Deps = null;
  await builtMod.createUpdateCapability({
    logReady: Promise.resolve({ log: (event, fields) => { r2Fired.push([event, fields]); return true } }),
    hostUpdate: { createHostUpdate(deps) { r2Deps = deps; return { phoneNames: {}, handlers: {} } } },
    now: () => r2Now,
    relogFloorMs: 60000,
  });
  const causeA = 'cafebabe', causeB = 'deadc0de';
  const fail = (h) => r2Deps.logCtx.fire('warn', 'host.call.fail', { method: 'prompt.updateStatus', kind: 'phone-failed', errorHash: h, pluginId: 'dsh-prompt' });
  const lines = () => r2Fired.filter((e) => e[0] === 'host.call.fail');
  fail(causeA);
  eq(lines().length, 1, '成因 A 首条必落');
  r2Now += 1000;
  fail(causeB);
  eq(lines().length, 1, '间隔内来的成因 B 先排队（这一格不落盘）');
  r2Now += 60000;
  fail(causeA);
  fail(causeA);
  fail(causeA);
  eq(lines().length, 2, 'A 反复失败时，队首的 B 在间隔到点后被补落（旧实现这里是 0 行：B 永久不可见）');
  eq(lines()[1] && lines()[1][1].errorHash, causeB, '补落那一行写的是 B 的指纹（不是拿当前请求的 A 顶替——记账与落盘必须一致）');
  r2Now += 60000;
  fail(causeA);
  eq(lines().length, 2, '补落过的 B 不会反复补落（成因账稳定）');
  // 前置条件 4（「新加的断言要用生产默认值测」）：上面几格都注入了时钟与间隔，全绿说明不了生产口径。
  // 下面这一格**不注入任何东西**（真时钟 + 生产默认 60 秒下限）：同一毫秒内 A → B → A，
  // 只许落首条 A —— 把生产默认的下限改成 0，B 会当场落成第二行，这条立刻变红。
  const r2Fired2 = [];
  let r2Deps2 = null;
  await builtMod.createUpdateCapability({
    logReady: Promise.resolve({ log: (event, fields) => { r2Fired2.push([event, fields]); return true } }),
    hostUpdate: { createHostUpdate(deps) { r2Deps2 = deps; return { phoneNames: {}, handlers: {} } } },
  });
  const fail2 = (h) => r2Deps2.logCtx.fire('warn', 'host.call.fail', { method: 'prompt.updateCheck', kind: 'update-check', errorHash: h, pluginId: 'dsh-prompt' });
  fail2('aaaa1111');
  fail2('bbbb2222');
  fail2('aaaa1111');
  eq(r2Fired2.filter((e) => e[0] === 'host.call.fail').length, 1,
    '生产默认（真时钟 + 默认下限，不注入）：同一毫秒内 A/B/A 只落首条——间隔内到达的成因先排队，不当场落');
  // 默认下限的量级也钉一下：只注入式的断言挡不住「把生产默认改成 0」，这条挡住格式化的那条路了。
  eq(/DEFAULT_RELOG_FLOOR_MS = 60000/.test(fs.readFileSync(path.join(ROOT, 'src', 'update', 'host', 'bridge-log.ts'), 'utf8')), true,
    '生产默认重落下限是 60000ms（改小它这条会红）');

  console.log('=== T10: 双语文案（英文不许夹中文） ===');
  const I18N_KEYS = ['updateEntry', 'updateEntryHint', 'updateVersionUnknown', 'updateRowRunning', 'updateRowInstalled',
    'updateRowLatest', 'updateLatestNone', 'updateNotAvailable', 'updateBtnCheck', 'updateBtnChecking', 'updateBtnInstall',
    'updateBtnInstalling', 'updateBtnCopy', 'updateCopied', 'updateCopyFail', 'updateClose', 'updateHostFailTitle',
    'updateHostFailHint', 'updateReasonTitle', 'updateReasonUnknown', 'updatePendingBanner', 'updatePendingHint',
    'updateManualTitle', 'updateManualNone', 'updateManualHint', 'updateStatusNote'];
  for (const k of I18N_KEYS) {
    const zh = STR[k] && STR[k].zh, en = STR[k] && STR[k].en;
    if (!zh || !en) { bad('缺文案 ' + k); continue }
    if (!/[\u4e00-\u9fff]/.test(zh)) bad(k + '.zh 不是中文');
    if (/[\u4e00-\u9fff]/.test(en)) bad(k + '.en 夹了中文');
    if (zh === en) bad(k + ' 中英是同一份');
  }
  ok('新文案 ' + I18N_KEYS.length + ' 条 + 8 条原因文案：中英齐全、英文不夹中文');
  eq(tr('en', STR.updatePendingBanner).indexOf('{new}') >= 0, true, '待重启横幅英文也有版本占位（渲染时填）');

  globalThis.fetch = realFetch;
  console.log(failures === 0 ? 'ALL PASS: #40 更新入口 + 更新弹窗' : 'FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log('FAIL: 脚本抛了异常：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
