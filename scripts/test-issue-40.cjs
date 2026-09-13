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
  // #41 的连带：update.ts 多了一条 `./updauto` 的 import 边（启动自动检查的判据 + 跳过记录的落点）。
  // 与 #40 给本脚本加 `./update` / `./about` 时同一条纪律：新 import 边必须进这张表，否则脚本直接崩。
  // #41 收口 R2 的连带同理：又多了一条 `./upddialog`（弹窗归属闸 —— 同屏不许叠两只可各自点安装的窗）。
  ['updauto.ts', SRC('updauto.ts'), []],
  ['upddialog.ts', SRC('upddialog.ts'), []],
  ['update.ts', SRC('update.ts'), ['./panel', './i18n', './updauto', './upddialog', '../update/bridge', '../update/gen/updateClient.derived.js']],
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
    const target = d === '../update/bridge' ? './bridge.cjs'
      : (d === './gen/updateClient.derived.js' || d === '../update/gen/updateClient.derived.js') ? './updateClient.derived.cjs'
        : d + '.cjs';
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
/**
 * 有界等待：条件成立返回 true；超过 `budgetMs` 仍不成立返回 **false**（= 调用方必须判红，并把当时的
 * 真实状态打进 FAIL 里）。**不是**「等不到就跳过 / 把断言放宽成 null 也算过」。
 *
 * 为什么 T11 非它不可：T11 驱动的是**真包宿主**，而宿主 handler 每条通话都要走一遍真 fs
 * （`node_modules/dsh-plugin-update/dist/host.js` 的 `getSharedReader` → `containingPackage`：
 * `realpath` + 逐级 `readFile`）。fs 回调是 libuv 的**宏任务**，不是微任务 —— `flush()` 那两次
 * `setTimeout(0)` 不构成「通话已完成 / 渲染已跟上」的屏障：
 *  · 回包晚于屏障落地 → 读到 `job=null`（本机 30 次探针里 2 次，就是「got=null want="failed"」那条假红）；
 *  · 更早的那一下点击会被 `run` 的单飞锁 `lock` **原地吞掉**（挂载那次 status 还在飞）→ 一条通话都不发，
 *    界面一动不动（同一次探针里 1 次；给假 fetch 只加一个 `setTimeout(0)` 的宏任务跳，重现率 100%）；
 *  · 渲染晚于屏障 → 读到「安装按钮还没出现」（旧脚本在这里是 `undefined.props` 崩，不是判红）。
 * 等它落地为止才是确定的。
 */
const waitFor = async (pred, budgetMs = 8000, stepMs = 5) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
};
/** 同上，但条件看的是**渲染结果**：等的时候要 pump React（与 T14 的轮询等待同一写法）。 */
const waitShown = async (pred, budgetMs = 8000, stepMs = 10) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await TR.act(async () => { await new Promise((r) => setTimeout(r, stepMs)) });
  }
};
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
/** 宿主树按文档序展开（#60-A 的「排在两个图标之前」靠它判定）。 */
const domSeq = (n) => {
  const out = [];
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { c.forEach(walk); return }
    out.push(c);
    (c.children || []).forEach(walk);
  };
  walk(n);
  return out;
};
/** 宿主树的父子表（同一行 = 两个图标与入口同一个父节点）。 */
const parentMap = (root) => {
  const map = new Map();
  const walk = (c, p) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { c.forEach((x) => walk(x, p)); return }
    map.set(c, p);
    (c.children || []).forEach((x) => walk(x, c));
  };
  walk(root, null);
  return map;
};
/** 一只窗里的动作按钮（`data-dsh-prompt-update-action`）。 */
const actionsOf = (c) => nodes(c, 'data-dsh-prompt-update-action');
const actOf = (c, a) => actionsOf(c).filter((n) => n.props['data-dsh-prompt-update-action'] === a)[0];
/** accent（主）按钮：`btn(true)` 的底就是 TOK.accent —— 「同一时刻只有一个主按钮」靠它数。 */
const ACCENT = 'var(--dsw-specific-accent,#f0a45c)';
const accentsOf = (c) => actionsOf(c).filter((n) => n.props.style && n.props.style.background === ACCENT);
/** 结论行（#60-B 的唯一主角）：拿它的形态与文案。 */
const verdictOf = (c) => {
  const n = one(c, 'data-dsh-prompt-update-verdict');
  return n ? { kind: n.props['data-dsh-prompt-update-verdict'], text: String(txt(n)) } : null;
};
/** 展开「详情」（三个版本号默认收起）。 */
const openDetails = async (c) => {
  const t = one(c, 'data-dsh-prompt-update-details-toggle');
  if (t) await act(() => { t.props.onClick() });
};
const fieldOf = (c, k) => nodes(c, 'data-dsh-prompt-update-field').filter((n) => n.props['data-dsh-prompt-update-field'] === k)[0];

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
/** 构建期派生出来的取值文件（电话名与轮询间隔的唯一真值）。 */
const derived = require(path.join(DIR, 'updateClient.derived.cjs'));

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

  console.log('=== T3: 入口（在插件身份行里，与 🌟 / 💬 同一行） ===');
  script.status = okEnv(snap(), 'dsh plugin --profile web add --save-exact dsh-prompt@0.1.7 --registry=https://registry.npmjs.org/');
  const page = await mount(React.createElement(settings.SettingsPage, {}));
  await flush();
  const kids = page.toJSON().children;
  eq(kids.length, 6, '设置页顶层六块（#60-A：入口并进身份行，不再单独成块）');
  // #60 追加交付 A（用户第二次真机反馈「检查更新和版本号和 star 的按钮在一起」）：入口与两个图标
  // 同一行、同一父节点，顺序在图标之前。变异判据：把它挪回独立的一块 / 挪到图标之后 ⇒ 下面几条当场变红。
  eq(jsonAnchors(kids[0]).length, 2, '#37 的右上角两个图标按钮原样在第 0 块（顺序不变）');
  eq(jsonAnchors(kids[0]).map((a) => a.props.href).join('|'),
    'https://github.com/FeatherHunter/dsh-prompt|https://github.com/FeatherHunter/dsh-prompt/issues',
    '#37 两个按钮的地址与顺序一字不动');
  eq(txt(kids[0]).indexOf(STR.sectionName.zh) >= 0, true, '#53：第 0 块左边仍是插件名字');
  eq(txt(kids[0]).indexOf(STR.updateEntry.zh) >= 0, true, '#60-A：入口在**身份行里面**（不再另起一块）');
  eq(txt(kids[0]).indexOf('v0.1.7') >= 0, true, '入口带当前版本号（v0.1.7，来自 status 回包）');
  eq(kids.filter((k) => txt(k).indexOf(STR.updateEntry.zh) >= 0).length, 1, '#60-A：整页只有身份行那一块带入口文案');
  eq(txt(kids[0]).indexOf('⛭') < 0, true, '#37 的旧文字链接仍不在');
  {
    // 同一父节点 + 顺序在图标之前：两条都在**宿主树**上判（React 树的 parent 走得上去，这里更直接）。
    const seq0 = domSeq(kids[0]);
    const entryNode = seq0.find((n) => n.props && n.props['data-dsh-prompt-update'] !== undefined);
    eq(!!entryNode, true, '#60-A：入口是身份行里的一枚元素');
    eq(!!entryNode && entryNode.type, 'button', '#60-A：入口是可点的 <button>（不是纯文字）');
    const host = entryNode ? parentMap(kids[0]).get(entryNode) : null;
    eq(!!host && host.children.filter((c) => jsonAnchors(c).length > 0).length, 2,
      '#60-A：两个图标与入口是同一父节点下的兄弟（同一行）');
    const at = (pred) => seq0.findIndex(pred);
    const iEntry = at((n) => n.props && n.props['data-dsh-prompt-update'] !== undefined);
    const iStar = at((n) => n.type === 'a' && n.props.href === 'https://github.com/FeatherHunter/dsh-prompt');
    const iIssue = at((n) => n.type === 'a' && n.props.href === 'https://github.com/FeatherHunter/dsh-prompt/issues');
    eq(iEntry >= 0 && iEntry < iStar && iStar < iIssue, true,
      '#60-A：DOM 顺序 = 入口 → 🌟 → 💬（' + iEntry + ' < ' + iStar + ' < ' + iIssue + '）');
  }
  const all = page.root.findAll(() => true);
  const entryIdx = all.findIndex((x) => x.props && x.props['data-dsh-prompt-update'] !== undefined);
  const linkIdx = all.findIndex((x) => x.props && x.props['aria-label'] === STR.gitHubRepo.zh);
  eq(entryIdx >= 0 && linkIdx >= 0 && entryIdx < linkIdx, true, '#60-A：图标按钮排在入口之后（DOM 顺序）');
  eq(requests.length, 1, '打开设置页只发生一次通话（正好一次，不重复打）');
  eq(requests[0].which, 'status', '打的是 status（只读本机、不联网）；自动查新版是 #41 的事，本票不擅自联网');
  eq(requests[0].method, 'POST', '通话走 POST');

  console.log('=== T3b: #60-A 入口的版式（身份行里的一枚按钮：可点 / 悬停 / 徽标；卡片与 borderBottom 都没了） ===');
  {
    const rowOf = () => one(page, 'data-dsh-prompt-update');
    // ① 它不再有自己的容器：卡片（SettingGroup 那种 section）与整宽 borderBottom 都删了。
    const rs = rowOf().props.style;
    eq(rowOf().props.type, 'button', '入口是 <button>');
    eq(rs.cursor, 'pointer', '可点线索一：整枚 cursor: pointer');
    eq(rs.display, 'inline-flex', '内联布局 —— 与两个图标同一行');
    eq(rs.border, 0, '自己不带边框（卡片已删）');
    eq(rs.borderBottom, undefined, '整宽 borderBottom 已删（它是「看着像页面 header」的来源）');
    eq(rs.borderRadius, 8, '圆角 8（既有数值：与同页 Btn 同）');
    eq(rs.padding, '4px 6px', '内距 4px 6px（0/4/6 都是这一页既有的数值）');
    eq(rs.gap, 6, '文案与徽标之间 gap 6（既有数值）');
    const anc = [];
    for (let p = rowOf().parent; p; p = p.parent) anc.push(p);
    eq(anc.filter((x) => x.type === 'section').length, 0, '入口不再被任何卡片包着（SettingGroup 那张卡没了）');
    // ② 文案：既有字号，窄容器下可收缩（省略号）——「挤坏也不能挤掉徽标与图标」的前半条。
    const label = rowOf().findAll((x) => x.type === 'span' && txt(x) === STR.updateEntry.zh)[0];
    eq(!!label, true, '左边是入口文案');
    eq(label && label.props.style.fontSize, 12.5, '文案 12.5px（既有字号：与同页 Btn 同）');
    eq(label && label.props.style.minWidth, 0, '窄容器下文案可收缩（minWidth 0）');
    eq(label && label.props.style.textOverflow, 'ellipsis', '收缩时用省略号（与身份行的插件名字同一处理）');
    eq(label && label.props.style.whiteSpace, 'nowrap', '文案不换行');
    // ③ 版本徽标：等宽小字 + 底色 + 圆角，恒定不收缩、不换行（后半条：徽标必须留着）。
    const badge = one(page, 'data-dsh-prompt-update-version');
    eq(badge.props.style.fontFamily, 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', '徽标用既有等宽字体 TOK.mono');
    eq(badge.props.style.fontSize, 11.5, '徽标 11.5px（既有字号）');
    eq(badge.props.style.color, 'var(--dsw-alias-label-secondary)', '徽标 labelSecondary');
    eq(badge.props.style.background, 'var(--dsw-alias-bg-layer-3)', '徽标底色 bgLayer');
    eq(badge.props.style.borderRadius, 6, '徽标圆角 6（既有数值）');
    eq(badge.props.style.padding, '1px 6px', '徽标内距 1px 6px');
    eq(badge.props.style.flex, 'none', '徽标 flex:none（挤的时候不会被压掉）');
    eq(badge.props.style.whiteSpace, 'nowrap', '徽标不换行');
    // ④ 两个图标同样不收缩 —— 窄容器下入口可以瘦，图标必须在。
    const icons = page.root.findAll((x) => x.type === 'a' && !!x.props['aria-label']);
    eq(icons.length === 2 && icons.every((i) => i.props.style.flex === 'none'), true, '两个图标 flex:none（不会被入口挤掉）');
    // ⑤ 悬停态：内联样式没有 :hover，靠 useState + 进入/离开（既有 Btn 的写法）。
    await act(() => { rowOf().props.onMouseEnter() });
    eq(rowOf().props.style.background, 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))', '悬停铺 bgHover（可点线索二）');
    await act(() => { rowOf().props.onMouseLeave() });
    eq(rowOf().props.style.background, 'transparent', '移开后底色收回（不留常驻高亮）');
  }
  await act(() => { one(page, 'data-dsh-prompt-update').props.onClick() });
  eq(!!one(page, 'data-dsh-prompt-update-modal'), true, '点入口打开弹窗');
  eq(txt(one(page, 'data-dsh-prompt-update-modal')).length > 30, true, '弹窗有内容（不是空白）');
  page.unmount();

  console.log('=== T3c: #60-B 结论行 = 唯一主角（三选一），同一时刻只有一个主（accent）按钮 ===');
  {
    // 测试自己按 i18n 模板填占位（与实现无关地算出期望文案；模板错、接线错都会红）。
    const fillT = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
    const oneAccent = (cc, want, msg) => {
      const acc = accentsOf(cc);
      eq(acc.length, 1, msg + '：整只窗只有一个 accent 主按钮（实际 ' + acc.length + ' 个）');
      eq(acc.length === 1 ? acc[0].props['data-dsh-prompt-update-action'] : null, want, msg + '：主按钮是 ' + want);
    };
    /**
     * 「结论行是唯一的视觉主角」的可判定形态：弹窗**卡片里**铺了底色的块只有一个 ——
     * 正常态是结论行（`blockStyle + background: bgLayer`），待重启态是那条横幅。
     * 只看卡片的直接孩子（遮罩与卡片自己的底色不算「块」，按钮/命令码也不是 div）。
     */
    const filledBlocks = (cc) => {
      const card = one(cc, 'data-dsh-prompt-update-modal').findAll((x) => x.type === 'div')[1];
      return card.children.filter((ch) => ch && ch.props && ch.props.style && ch.props.style.background).length;
    };
    // (a) 已是最新：最新版 == 正在跑的版本。
    script.status = okEnv(snap({ latestVersion: '0.1.7', canInstall: true }), 'CMD');
    let c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(verdictOf(c) && verdictOf(c).kind, 'uptodate', '（已是最新）结论行形态 = uptodate');
    eq(verdictOf(c) && verdictOf(c).text, fillT(STR.updateVerdictUpToDate.zh, { version: '0.1.7' }), '（已是最新）结论行文案：已是最新版本（0.1.7）');
    oneAccent(c, 'check', '（已是最新）');
    eq(!!actOf(c, 'install'), false, '（已是最新）不给安装按钮（没有新版本可装）');
    eq(filledBlocks(c), 1, '（已是最新）铺底色的块只有一个 = 结论行（唯一视觉主角）');
    eq(!!one(c, 'data-dsh-prompt-update-banner'), false, '（已是最新）没有待重启横幅');
    eq(txt(one(c, 'data-dsh-prompt-update-modal')).indexOf('万能药') < 0, true, '（已是最新）命令块的免责声明不再出现（它平常压根不渲染）');
    c.unmount();

    // (b) 有新版本：最新版比正在跑的新 ⇒ 主按钮变「安装新版本」，「检查更新」降为次级（仍可点）。
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(verdictOf(c) && verdictOf(c).kind, 'newer', '（有新版本）结论行形态 = newer');
    eq(verdictOf(c) && verdictOf(c).text, fillT(STR.updateVerdictNewer.zh, { latest: '0.1.9', running: '0.1.7' }), '（有新版本）结论行文案带新版号与当前版本');
    oneAccent(c, 'install', '（有新版本）');
    eq(!!actOf(c, 'check'), true, '（有新版本）「检查更新」仍作为次级按钮在（随时能重查）');
    eq(actOf(c, 'check').props.style.background !== ACCENT, true, '（有新版本）「检查更新」不是 accent（同一时刻只有一个主按钮）');
    eq(!!one(c, 'data-dsh-prompt-update-manual'), false, '（有新版本）一切正常 ⇒ 手工命令不出现（不再常驻）');
    c.unmount();

    // (c) 这次没查到（电话级失败）：结论行说「这次没查到」，原因与下一步由既有失败块给（形态一字不改）。
    script.status = failEnv('bridge-unreachable');
    c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(verdictOf(c) && verdictOf(c).kind, 'unknown', '（电话级失败）结论行形态 = unknown');
    eq(verdictOf(c) && verdictOf(c).text, STR.updateVerdictUnknown.zh, '（电话级失败）结论行说「这次没查到」');
    oneAccent(c, 'check', '（电话级失败）');
    eq(!!actOf(c, 'install'), false, '（电话级失败）不给安装按钮');
    eq(!!one(c, 'data-dsh-prompt-update-hostfail'), true, '（电话级失败）既有失败块仍在（原因 + 下一步），弹窗不是空白');
    c.unmount();

    // (d) 刚打开、还没查过：结论行也是「这次没查到」，并补一句下一步（此时没有别的块替它说）。
    script.status = okEnv(snap(), 'CMD');
    c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(verdictOf(c) && verdictOf(c).kind, 'unknown', '（还没查过）结论行形态 = unknown');
    eq(String(txt(one(c, 'data-dsh-prompt-update-verdict-box'))).indexOf(STR.updateVerdictUnknownHint.zh) >= 0, true, '（还没查过）结论行补一句下一步（点「检查更新」问一次）');
    oneAccent(c, 'check', '（还没查过）');
    eq(filledBlocks(c), 1, '（还没查过）铺底色的块仍是只有结论行一个');
    c.unmount();
    ok('三种结论形态（已是最新 / 有新版本 / 这次没查到）各如其分，且任何时刻只有一个主按钮');
  }

  console.log('=== T3d: #60-B 三个版本号收进可展开的「详情」，默认收起 ===');
  {
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(!!one(c, 'data-dsh-prompt-update-modal'), true, '弹窗已开');
    eq(nodes(c, 'data-dsh-prompt-update-field').length, 0, '默认收起：三个版本号一个都不在页面上');
    eq(!!one(c, 'data-dsh-prompt-update-details'), false, '收起时连容器都不渲染');
    eq(!!one(c, 'data-dsh-prompt-update-details-toggle'), true, '有一枚「详情」切换按钮');
    eq(txt(one(c, 'data-dsh-prompt-update-details-toggle')).indexOf(STR.updateDetails.zh) >= 0, true, '切换按钮的文案是「详情」');
    await openDetails(c);
    eq(nodes(c, 'data-dsh-prompt-update-field').length, 3, '展开后当前 / 已装 / 最新三个版本号都在');
    eq(txt(fieldOf(c, 'running')), '0.1.7', '详情：当前版本');
    eq(txt(fieldOf(c, 'installed')), '0.1.7', '详情：已装版本');
    eq(txt(fieldOf(c, 'latest')), '0.1.9', '详情：最新版本');
    await act(() => { one(c, 'data-dsh-prompt-update-details-toggle').props.onClick() });
    eq(nodes(c, 'data-dsh-prompt-update-field').length, 0, '再点一次收回（默认态可来回切）');
    eq(actionsOf(c).filter((n) => n.props['data-dsh-prompt-update-action'] === 'details').length, 0,
      '「详情」不是动作按钮（不进「这只窗有几个动作」的账）');
    c.unmount();
  }

  console.log('=== T3e: #60-B 手工兜底命令只在「装不了 / 失败」时出现；四行免责声明与缓存说明已删 ===');
  {
    // 正常态之一：宿主给了命令、但没给任何装不了的理由 ⇒ 不出（这一条就是「不再常驻」的判据）。
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD_HIDDEN');
    let c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(!!one(c, 'data-dsh-prompt-update-manual'), false, '正常态：手工命令块不出现');
    eq(!!one(c, 'data-dsh-prompt-update-command'), false, '正常态：命令本身也不在');
    eq(!!one(c, 'data-dsh-prompt-update-manual-empty'), false, '正常态：连「宿主没给命令」那句也不出现（它只在需要兜底时才说）');
    eq(String(txt(one(c, 'data-dsh-prompt-update-modal'))).indexOf('万能药') < 0, true, '正常态：全文没有那段免责声明');
    c.unmount();

    // 装不了：宿主给了 blockedReason 且 canInstall 为假 ⇒ 命令块出现，命令下面**只有一句**。
    script.status = okEnv(snap({ blockedReason: 'installation-changed', canInstall: false }), 'CMD_NEEDED');
    c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    eq(txt(one(c, 'data-dsh-prompt-update-command')), 'CMD_NEEDED', '装不了：命令块出现（自动安装不可用时它就是出口）');
    const mt = String(txt(one(c, 'data-dsh-prompt-update-modal')));
    eq(mt.indexOf(STR.updateManualHint.zh) >= 0, true, '命令下面留一句说清它能做什么');
    eq(STR.updateManualHint.zh.split('。').filter((s) => s.trim()).length, 1, '命令下面只有一句（不是四行自我辩解）');
    eq(mt.indexOf('万能药') < 0, true, '四行免责声明（「这不是万能药…」）不再出现');
    eq(mt.indexOf('不缓存') < 0, true, '底部那句缓存机制说明不再出现');
    eq(Object.prototype.hasOwnProperty.call(STR, 'updateStatusNote'), false, 'i18n 里那条缓存说明文案已删（updateStatusNote 不存在）');
    eq(fs.readFileSync(SRC('i18n.ts'), 'utf8').indexOf('updateStatusNote') < 0, true, '源码里也不再引用 updateStatusNote');
    c.unmount();
  }

  console.log('=== T4: 详情里的三个版本号 + 检查/安装按钮（含裸调 install 的功能守卫） ===');
  script.status = okEnv(snap({ canInstall: false }), 'CMD_STATUS');
  let m = await mount(React.createElement(update.UpdateEntry, {}));
  let modal = one(m, 'data-dsh-prompt-update-modal');
  eq(!!modal, false, '弹窗前不渲染遮罩');
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  modal = one(m, 'data-dsh-prompt-update-modal');
  eq(!!modal, true, '弹窗已开');
  // #60-B：三个版本号默认收起 ⇒ 先展开「详情」再读（默认收起本身由 T3d 钉着）。
  await openDetails(m);
  const field = (k) => fieldOf(m, k);
  eq(txt(field('running')), '0.1.7', '详情：当前版本');
  eq(txt(field('installed')), '0.1.7', '详情：已装版本');
  eq(txt(field('latest')), STR.updateLatestNone.zh, '详情：最新版本（没查过就明说，不留空）');
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
  eq(txt(field('latest')), '0.1.9', '详情：最新版本取回包（现刷，不缓存）');
  const installBtn = nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0];
  eq(!!installBtn, true, 'canInstall 为真 → 出现安装按钮');
  requests.length = 0;
  await act(() => { installBtn.props.onClick() });
  eq(requests.map((r) => r.which), ['check', 'install'],
    '点安装时手里那张凭证已过期（expiresAt=2 早于现在）→ 先补 check 再 install（不裸调、不拿过期凭证赌运气）');
  eq(requests[1].body.checkId, 'CHK-42', '安装带上「检查更新」发的 checkId（不是裸调）');
  eq(typeof requests[1].body.requestId === 'string' && requests[1].body.requestId.length > 0, true, '安装带上 requestId');
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

  console.log('=== T6: 电话级失败必须分类呈现（桥没回答 / 能力没接通 / 宿主回答了但没成），且不是空白 ===');
  // 三类文案必须分开：
  //  · `bridge-*` / `no-fetch` 才是「宿主这次一个字都没回」（BRIDGE_DOWN_CODES）；
  //  · `update-capability-unavailable` / `phone-failed` / `unknown-phone` 是宿主**回了话**、但回的是
  //    「更新能力本身没接通」（CAP_DOWN_CODES）—— 把它们说成「宿主是通的、不用刷新页面」就是撒谎
  //    （红队 L2 第二轮 N1；#43 真机验收最容易撞的失败态正是宿主半没加载）；
  //  · 其余码是「宿主回答了、这次操作没成」（整改 M2 之前它们全被说成「宿主没有回答更新状态」）。
  const DOWN = ['bridge-unreachable', 'bridge-bad-json'];
  const CAPDOWN = ['update-capability-unavailable', 'phone-failed', 'unknown-phone'];
  const ANSWERED = ['unknown-profile', 'check-expired', 'invalid-release', 'check-failed', 'install-failed', 'update-busy', 'a-brand-new-code-2077'];
  for (const code of DOWN.concat(CAPDOWN, ANSWERED)) {
    script.status = failEnv(code);
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    await flush();
    eq(txt(one(c, 'data-dsh-prompt-update-version')), STR.updateVersionUnknown.zh, code + '：入口行宁可说「版本未知」，也不空白');
    const hostfail = one(c, 'data-dsh-prompt-update-hostfail');
    if (!hostfail) { bad(code + '：snapshot 为 null 时弹窗没有专门呈现（会是一片空白）'); c.unmount(); continue }
    const body = txt(hostfail);
    const down = DOWN.indexOf(code) >= 0;
    const capdown = CAPDOWN.indexOf(code) >= 0;
    const wantKey = down ? 'updateHostFailTitle' : capdown ? 'updateCapDownTitle' : 'updateFailAnsweredTitle';
    eq(body.indexOf(STR[wantKey].zh) >= 0, true, code + '：标题就是它该在的那一类（' + wantKey + '）');
    for (const other of ['updateHostFailTitle', 'updateCapDownTitle', 'updateFailAnsweredTitle']) {
      if (other !== wantKey) eq(body.indexOf(STR[other].zh) >= 0, false, code + '：另两类的标题不许同时出现（' + other + '）');
    }
    eq(txt(one(c, 'data-dsh-prompt-update-code')), code, code + '：把原始错误码给出来');
    eq(body.indexOf(code) >= 0, true, code + '：失败块里带着原始码（报 Issue 靠它）');
    // 动作行：桥没回答那一类靠 hint 自带做法；宿主回了话的另两类**必须**有一条动作行，
    // 不认识的码也落兜底动作（N4：不许「承诺了做法却不给做法」）。
    const action = one(c, 'data-dsh-prompt-update-fail-action');
    if (down) {
      eq(!!action, false, code + '：桥一个字没回那一类的做法在 hint 里，不另给动作行');
    } else {
      eq(!!action, true, code + '：宿主回了话就必须给一条动作行（不许承诺了做法却是空的）');
      eq(String(txt(action)).length > 8, true, code + '：动作行有实际内容（不是空串）');
      if (capdown) eq(String(txt(action)).indexOf(STR.updateCapDownAction.zh) >= 0, true, code + '：动作是「重启宿主让能力重建」');
      if (code === 'a-brand-new-code-2077') eq(String(txt(action)).indexOf(STR.updateFailUnknown.zh) >= 0, true, '不认识的码落 updateFailUnknown 兜底动作');
    }
    if (capdown) {
      // N1 的核心两问：① 文案回到「能力没接通」那一类（上一版对它是说对的）；② 不许出现那句劝退话。
      eq(body.indexOf('更新能力可能没接通') >= 0, true, code + '：文案回到「更新能力可能没接通 / 宿主半未加载」那一类');
      eq(body.indexOf(STR.updateFailAnsweredTitle.zh) >= 0, false, code + '：不许说成「宿主是通的、这次操作没成」');
      eq(body.indexOf('不用刷新页面') >= 0, false, code + '：不许再说「宿主是通的，不用刷新页面，也不用报「宿主没接通」」（撒谎 + 劝退）');
    }
    if (code === 'unknown-profile') {
      eq(body.indexOf(STR.updateWhyUnknownProfile.zh) >= 0, true, 'unknown-profile：电话级失败时也把「该做什么」给出来（同一张原因码表）');
    }
    if (code === 'check-expired') {
      eq(body.indexOf(STR.updateFailCheckExpired.zh) >= 0, true, 'check-expired：动作是「重取凭证再提交」（包 README 第 11 节）');
      eq(body.indexOf(STR.updateFailNoFault.zh) >= 0, true, 'check-expired：说清它不是故障码（README 第 11 节点名）');
    }
    eq(txt(one(c, 'data-dsh-prompt-update-modal')).length > 30, true, code + '：弹窗整体有内容（不是空白）');
    c.unmount();
  }

  console.log('=== T6b: 真宿主半「能力起不来」→ 面板说「能力没接通」+ 有动作（红队 L2 的 N1 现场） ===');
  {
    // 手法与红队一致：拿**真宿主半产物**（lib/update.js 跑真 createUpdateCapability）把能力打到「起不来」——
    // `hostUpdate.createHostUpdate()` 直接抛，等价于宿主半 `src/update/host/index.ts` 里两条 degraded 路
    // （依赖装载失败 / 能力建不起来）。真回包 = degradedCapability 的 `update-capability-unavailable`。
    const capMod = await import(pathToFileURL(path.join(ROOT, 'lib', 'update.js')).href);
    const degraded = await capMod.createUpdateCapability({
      hostUpdate: { createHostUpdate() { throw new Error('simulated build failure') } },
    });
    eq(degraded.ok, false, '真宿主半：createHostUpdate 抛 → 能力起不来（degraded 实例）');
    const phoneOut = await degraded.runRoute(STATUS_PATH, {});
    eq(phoneOut, { ok: false, error: 'update-capability-unavailable', errorKind: 'simulated build failure' },
      '真宿主半回的就是 update-capability-unavailable（与 host/index.ts:52 的 UNAVAILABLE 同字）');
    // lib/index.js 那条真路由的信封（T11 抄的是同一个形状）：电话回包进 value，error.code = 电话的 error。
    const envelope = { ok: false, value: phoneOut, error: { code: String(phoneOut.error), message: String(phoneOut.errorKind) } };
    const realFetch3 = globalThis.fetch;
    globalThis.fetch = async () => ({ status: 200, json: async () => envelope });
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    await flush();
    const block = one(c, 'data-dsh-prompt-update-hostfail');
    const body = block ? String(txt(block)) : '';
    eq(!!block, true, '能力没接通：有专门的失败块（不是空白）');
    eq(String(txt(one(c, 'data-dsh-prompt-update-code'))), 'update-capability-unavailable', '失败块给出真码');
    eq(body.indexOf(STR.updateCapDownTitle.zh) >= 0, true, '文案回到「能力没接通」那一类（updateCapDownTitle）');
    eq(body.indexOf(STR.updateHostFailHint.zh) >= 0, true, '并说清「更新能力可能没接通 / 宿主半未加载」');
    const action = one(c, 'data-dsh-prompt-update-fail-action');
    eq(!!action, true, '★ 有动作行（修前这里是 null：承诺了做法却不给）');
    eq(String(txt(action)).indexOf(STR.updateCapDownAction.zh) >= 0, true, '动作行给的是「重启宿主让能力重建」');
    eq(body.indexOf(STR.updateFailAnsweredTitle.zh) >= 0, false, '不许说「宿主回答了：这次操作没成」（把这个码划到那一侧是撒谎）');
    eq(body.indexOf('不用刷新页面') >= 0, false, '不许出现「宿主是通的，不用刷新页面」那句劝退话');
    c.unmount();
    globalThis.fetch = realFetch3;
  }

  console.log('=== T6c: 失败码表里不许有凭空编的码（红队 L2 的 N2） ===');
  {
    eq(updateSrc.indexOf('update-params') >= 0, false, '源码里没有凭空编的「参数不对」那个码（上一版它在表里，却没有任何产出点）');
    eq(Object.prototype.hasOwnProperty.call(STR, 'updateFailParams'), false, '也没有为它编的那条具体情形文案');
    const tableStart = updateSrc.indexOf('const UPDATE_FAIL_KEYS');
    const table = updateSrc.slice(tableStart, updateSrc.indexOf('\n}', tableStart));
    const codes = Array.from(table.matchAll(/'([a-z-]+)':/g)).map((m) => m[1]);
    eq(codes.length >= 10, true, '动作表里有 ' + codes.length + ' 个码：' + codes.join(' / '));
    // 每个码都要在**真产出点**里找得到：更新包 dist + 真宿主半产物 + 宿主半源码 + 桥源码。
    // 上一版那条编出来的码在这里当场红（整个 dist 连 `params` 这个词都没有）。
    const corpus = distFiles.map(distOf).join('\n')
      + fs.readFileSync(path.join(ROOT, 'lib', 'update.js'), 'utf8')
      + fs.readFileSync(path.join(ROOT, 'src', 'update', 'host', 'index.ts'), 'utf8')
      + fs.readFileSync(path.join(ROOT, 'src', 'update', 'bridge.ts'), 'utf8');
    const missing = codes.filter((k) => corpus.indexOf("'" + k + "'") < 0 && corpus.indexOf('"' + k + '"') < 0);
    eq(missing, [], '表里每个码都在真产出点里出现过（不是猜的 / 不是编的）');
    eq(corpus.indexOf('params') >= 0, false, '真产出点里连 params 这个词都没有（那条码没有任何对应情形）');
  }

  console.log('=== T7: ⚠️ 待重启横幅（显眼样式、说清版本与重启、不给安装按钮、不抢主角） ===');
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
    // #60-B：这一种状态的主角是横幅 —— 结论行**不出现**（同一时刻只许有一个主角）。
    eq(!!one(m, 'data-dsh-prompt-update-verdict'), false, '待重启：结论行让位给横幅（不并排两个主角）');
    eq(one(m, 'data-dsh-prompt-update-modal').findAll((x) => x.type === 'div')[1].children
      .filter((ch) => ch && ch.props && ch.props.style && ch.props.style.background).length, 1,
      '待重启：铺底色的块同样只有一个 = 那条横幅（主角换了人，仍然只有一个）');
    await openDetails(m);
    const seen = m.root.findAll(() => true);
    const at = (n) => seen.findIndex((x) => x.props && x.props['data-dsh-prompt-update-field'] === n);
    eq(seen.indexOf(banner) < at('running'), true, '横幅在版本详情之上（顶部横幅）');
  }
  eq(nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install').length, 0,
    '待重启期间不给安装按钮');
  eq(accentsOf(m).length, 1, '待重启期间也只有一个主按钮');
  m.unmount();

  console.log('=== T8: 手工命令现刷不缓存 + 只在「装不了 / 失败」时才出现（#60-B 第 4 条） ===');
  // 先给一个**不该出现**的基线：宿主手里有命令、但这台机器没有装不了的理由 ⇒ 命令一个字都不出现。
  script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD_A');
  m = await mount(React.createElement(update.UpdateEntry, {}));
  await act(() => { one(m, 'data-dsh-prompt-update').props.onClick() });
  eq(!!one(m, 'data-dsh-prompt-update-command'), false, '一切正常：命令块**不**出现（改造前它常驻，正是用户说的主次颠倒）');
  eq(txt(m).indexOf('CMD_A'), -1, '一切正常：命令文本也不在页面上');
  // 装不了 + 宿主给了命令 ⇒ 出现；随后每次回包都现刷，不缓存。
  script.check = okEnv(snap({ blockedReason: 'installation-changed', canInstall: false }), 'CMD_B', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(txt(one(m, 'data-dsh-prompt-update-command')), 'CMD_B', '装不了 ⇒ 命令块出现，且取的是这次回包的值');
  eq(txt(m).indexOf(STR.updateManualHint.zh) >= 0, true, '命令下面一句说清它能做什么（不是四行免责声明）');
  script.check = okEnv(snap({ blockedReason: 'installation-changed', canInstall: false }), 'CMD_C', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(txt(one(m, 'data-dsh-prompt-update-command')), 'CMD_C', 'check 回包换了命令 → 界面跟着换（不是缓存旧命令）');
  eq(txt(m).indexOf('CMD_B'), -1, '旧命令不再留在界面上');
  script.check = okEnv(snap({ blockedReason: 'unknown-profile', canInstall: false }), '', null);
  await act(() => {
    nodes(m, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
  });
  eq(!!one(m, 'data-dsh-prompt-update-command'), false, '回包命令为空 → 命令整块消失');
  eq(!!one(m, 'data-dsh-prompt-update-manual-empty'), true, '需要兜底却没命令时，给一句「宿主没给命令」的说明');
  // 复制按钮：把**当前**命令写进剪贴板（不是旧的那条）
  script.check = okEnv(snap({ blockedReason: 'installation-changed', canInstall: false }), 'CMD_COPY', null);
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

  if (process.env.T40_TRACE) {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      const which = u === STATUS_PATH ? 'status' : u === CHECK_PATH ? 'check' : u === INSTALL_PATH ? 'install' : 'other';
      const out = await origFetch(url, init);
      console.log('    [trace] ' + which + ' method=' + (init && init.method));
      return out;
    };
  }
  console.log('=== T11: 安装任务的终态失败必须说出来（不是「一切恢复正常」） ===');
  // 整改 M1（红队 L1）：真宿主里 `runInstall` 抛 → 后台任务落成 `job={state:"failed",message:"install-failed"}`，
  // 而 `blockedReason` 仍是 null（包只在「已装 != 正在跑」时才翻 recovery-required）⇒ 面板曾一个字都不说。
  // 这里跑的是**真包的 phone handler**（把 lib/index.js 那条真路由抄下来），只把 runInstall 换成抛错版。
  {
    const fakeEnv = {
      profileName: 'web', environmentKind: 'cli', homeDir: 'C:\\fake\\.dsh', profileDir: 'C:\\fake\\.dsh\\profiles\\web',
      installedVersion: '0.1.7', packageValid: true, sourceInstall: false, blockedReason: null,
      installationKey: 'KEY-1', eligible: true,
    };
    let now = 1_000_000;
    let job = null;
    let seq = 0;
    const hostMod = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'host.js')).href);
    hostMod.__resetSharedUpdateReaderForTests?.();
    const host = hostMod.createHostUpdate({ readerOverrides: {
      runningVersion: '0.1.7',
      readInstalled: async () => ({ ...fakeEnv }),
      readJob: async () => job,
      writeJob: async (j) => { job = j },
      now: () => now,
      randomId: () => 'rid-' + (++seq),
      nodeVersion: 'v22.0.0',
      homeDir: 'C:\\fake\\.dsh',
      profileDir: 'C:\\fake\\.dsh\\profiles\\web',
      environmentKind: 'cli',
      fetchImpl: async () => {
        const body = JSON.stringify({
          name: 'dsh-prompt', version: '0.1.9', engines: { node: '>=22' },
          dist: { tarball: 'https://registry.npmjs.org/dsh-prompt/-/dsh-prompt-0.1.9.tgz', integrity: 'sha512-' + 'A'.repeat(86) + '==' },
        });
        return { ok: true, status: 200, headers: { get: () => String(Buffer.byteLength(body)) }, text: async () => body };
      },
      runInstall: async () => { throw Object.assign(new Error('npm ERR! exit 1'), { code: 'install-failed' }) },
      tryAcquireLock: async () => true,
      releaseLock: async () => {},
    } }, { pluginId: 'dsh-prompt', prefix: 'prompt', targetPackageName: 'dsh-prompt', registryUrl: 'https://registry.npmjs.org/' });
    // lib/index.js 那条真路由的信封：宿主 handler 直接就是电话回包（`{ok:true,snapshot,manual,receipt}`
    // 或 `{ok:false,error,errorKind}`，见 host.js 的 loggedPhone），这里原样进 `value`、按 `ok` 定信封。
    const callHost = async (which, args) => {
      const k = which === 'status' ? 'updateStatus' : which === 'check' ? 'updateCheck' : 'updateInstall';
      const out = await host.handlers[host.phoneNames[k]](args);
      const isFail = out === null || out.ok !== true;
      return { ok: !isFail, value: out, error: isFail ? { code: String(out?.error ?? 'update-capability-unavailable'), message: String(out?.errorKind ?? '') } : null };
    };
    const realFetch2 = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      const which = u === STATUS_PATH ? 'status' : u === CHECK_PATH ? 'check' : u === INSTALL_PATH ? 'install' : '';
      if (!which) return { status: 200, json: async () => ({ ok: false, error: { code: 'test-other-endpoint' } }) };
      return { status: 200, json: async () => callHost(which, JSON.parse((init && init.body) || '{}')) };
    };
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    const btnOf = (a) => nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === a)[0];
    const clickable = (a) => { const b = btnOf(a); return !!b && b.props.disabled === false };
    const callSeq = () => (requests.map((r) => r.which).join('|') || '(无)');
    const modalText = () => String(txt(one(c, 'data-dsh-prompt-update-modal')));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    // 三个「等它在界面上真的可点，再点」的关卡（有界；等不到=判红并打印通话序列与当时的界面）。
    // 为什么不能点完就走：
    //  1) 挂载那次 `status` 也是真通话（过真 fs），它没落地之前面板是「忙」的 —— `run` 的单飞锁
    //     `lock` 会把这一下点击**原地吞掉**（一条通话都不发、界面一动不动）。实测：给假 fetch 只加一个
    //     `setTimeout(0)` 的宏任务跳，check 这一枪就永远发不出去（`[t+10ms] WAIT0 btn=no`，全程零 check）。
    //     所以「可点」= 按钮不再是 `disabled`（面板空闲），这才是确定性的点击前提。
    //  2) 安装按钮要等 check 回包落地才渲染（`canInstall` 为假时不给按钮），立刻点会 `undefined.props` 崩脚本。
    //  3) 失败块的渲染要等下一次回包落地（T13/T14 已证明面板会自己轮询/重查，这里只是等它）。
    t11: {
      if (!await waitShown(() => clickable('check'))) {
        bad('真包宿主：等 8s 面板仍不空闲（挂载那次 status 没落地）；通话序列=' + callSeq());
        break t11;
      }
      await act(() => { btnOf('check').props.onClick() });
      if (!await waitShown(() => clickable('install'))) {
        bad('真包宿主：等 8s 安装按钮仍不可点（check 回包没落地 / canInstall 一直是假）；通话序列=' + callSeq() +
          '；弹窗=' + modalText());
        break t11;
      }
      await act(() => { btnOf('install').props.onClick() });
      // 后台任务（`service.js` 的 `runBackground`）写终态也是**跨真 fs** 的宏任务：
      // 等到终态为止；等不到=判红（不判过），并把当时的真实 job 摆出来。
      if (!await waitFor(() => !!(job && (job.state === 'failed' || job.state === 'interrupted')))) {
        bad('真包宿主：等 8s 后台任务仍没落成终态；当时 job=' + JSON.stringify(job) + '；通话序列=' + callSeq());
        break t11;
      }
      eq(job.state, 'failed', '真包宿主：runInstall 抛 → 任务落成 failed');
      eq(job.message, 'install-failed', '真包宿主：job.message 是精确码 install-failed');
      const blockedSnap = await callHost('status', {});
      eq(blockedSnap.value && blockedSnap.value.snapshot && blockedSnap.value.snapshot.blockedReason, null,
        '真包宿主：这条路 blockedReason 仍是 null（包只在「已装 != 正在跑」时才翻 recovery-required）');
      now += 3000;
      await act(() => { btnOf('check').props.onClick() });
      if (!await waitShown(() => !!one(c, 'data-dsh-prompt-update-job-failed'))) {
        bad('安装失败在面板上一个字都不说（静默失败：安装按钮还回来、横幅/原因块/失败块全无）；当时 job=' +
          JSON.stringify(job) + '；通话序列=' + callSeq() + '；弹窗=' + modalText());
        break t11;
      }
      const body = txt(one(c, 'data-dsh-prompt-update-job-failed'));
      eq(body.indexOf('install-failed') >= 0, true, '失败块把安装任务的码 install-failed 摆出来（原文里出现 0 次 → 现在 ≥1 次）');
      eq(body.indexOf(STR.updateJobFailTitle.zh) >= 0, true, '失败块说清「这次安装没成功」');
      eq(body.indexOf(STR.updateFailInstallFailed.zh) >= 0, true, '并给出下一步（手工命令 / 重取凭证再试）');
      eq(!!one(c, 'data-dsh-prompt-update-manual'), true, '手工兜底命令仍在（装机失败时它就是出口）');
      eq(!!one(c, 'data-dsh-prompt-update-hostfail'), false, '安装失败不是「电话级失败」：不冒充「宿主没有回答」');
      eq(!!one(c, 'data-dsh-prompt-update-reason'), false, '安装失败也不冒充八条 blockedReason 之一（README 第 8 节没这条情形）');
    }
    eq(String(txt(one(c, 'data-dsh-prompt-update-modal'))).length > 30, true, '弹窗整体有内容');
    c.unmount();
    globalThis.fetch = realFetch2;
  }

  console.log('=== T12: 失败的 check 不许把上一份好快照抹掉 ===');
  {
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD_GOOD', null);
    let mode = 'ok';
    script.check = () => (mode === 'ok'
      ? okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD_GOOD', null)
      : failEnv('check-failed'));
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    await act(() => {
      nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
    });
    eq(txt(one(c, 'data-dsh-prompt-update-version')), 'v0.1.7', '成功时入口有版本');
    await openDetails(c);
    const before = {
      running: txt(fieldOf(c, 'running')),
      installed: txt(fieldOf(c, 'installed')),
      latest: txt(fieldOf(c, 'latest')),
    };
    // 成功那一刻手里那条命令**不**在页面上（#60-B：只有在需要兜底时才出现）。
    eq(!!one(c, 'data-dsh-prompt-update-command'), false, '成功态：命令不常驻');
    mode = 'fail';
    await act(() => {
      nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
    });
    const fieldVal = (k) => { const n = fieldOf(c, k); return n ? txt(n) : null };
    eq(txt(one(c, 'data-dsh-prompt-update-version')), 'v0.1.7', '失败后入口**没有**变成「版本未知」（已知版本不被抹掉）');
    eq(fieldVal('running'), before.running, '失败后「当前版本」还是 0.1.7');
    eq(fieldVal('installed'), before.installed, '失败后「已装版本」还在');
    eq(fieldVal('latest'), before.latest, '失败后「最新版本」还在（上次查到的那份）');
    // 这一枪失败了 ⇒ 兜底命令**这才**出现（不是常驻），并且标明它来自上一份成功回包。
    eq(txt(one(c, 'data-dsh-prompt-update-command')), 'CMD_GOOD', '失败后手工命令块出现（失败就是需要兜底的那一刻）');
    eq(!!one(c, 'data-dsh-prompt-update-manual-stale'), true, '并标明这条命令来自上一份成功回包');
    eq(String(txt(one(c, 'data-dsh-prompt-update-hostfail'))).indexOf(STR.updateHostFailTitle.zh) >= 0, false,
      '失败说明不冒充「宿主没有回答」（宿主回答了 check-failed）');
    eq(txt(one(c, 'data-dsh-prompt-update-code')), 'check-failed', '失败块给出原始码');
    c.unmount();
  }

  console.log('=== T13: check-expired → 自动补一次 check 再重提（README 第 11 节） ===');
  {
    requests.length = 0;
    let lived = 0;
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', null);
    script.check = () => { lived++; return okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', { checkId: 'CHK-' + lived, checkedAt: 1, expiresAt: Date.now() + 900000 }); };
    // 安装回包模拟「刚点完安装、宿主已受理」，但**凭证在宿主眼里已过期**（用户在别的页面待久了）：
    // 这一段的重点不是第一枪成不成，而是面板拿到 check-expired 之后自己怎么办。
    script.install = () => failEnv('check-expired');
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    requests.length = 0;
    await act(() => {
      nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0].props.onClick();
    });
    eq(requests.map((r) => r.which), ['check', 'install', 'check', 'install'],
      '收到 check-expired → 重取凭证再提交一次（序列 check,install,check,install），不是把过期凭证原地再交一遍、也不是装两次');
    if (requests.length === 4) {
      eq(requests[1].body.checkId !== requests[3].body.checkId, true, '重提用的是**新**凭证（不是拿旧 checkId 硬顶）');
      eq(requests[3].body.requestId, requests[1].body.requestId, '重提是同一个安装请求（requestId 不变，不是装两次）');
    }
    eq(String(txt(one(c, 'data-dsh-prompt-update-code'))), 'check-expired', '两轮都没成时把码摆到界面上（不静默）');
    eq(!!one(c, 'data-dsh-prompt-update-job-failed'), false, '这不是安装任务失败（任务根本没起来），不冒充 install-failed');
    c.unmount();
  }

  console.log('=== T13b: 重试那一轮必须**强制重查**（N3：宿主拒凭证时手里那张面板自认还是新鲜的） ===');
  {
    // 红队 L2 实测的形态：面板时钟没动、宿主那边已判死（或另一处 check 抢掉了唯一的 checked 槽）。
    // 上一版 `ensureCheckId` 读的是**本次渲染闭包里的 `res`**，失败回包在同一个事件处理里还没落地 ⇒
    // 第二轮把同一张「面板自认新鲜」的死凭证原样再交一遍：`status,check,install[rid-1],install[rid-1]`。
    requests.length = 0;
    let lived = 0;
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', null);
    script.check = () => { lived++; return okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', { checkId: 'FRESH-' + lived, checkedAt: 1, expiresAt: Date.now() + 900000 }); };
    script.install = () => failEnv('check-expired');
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    // 用户先点一次「检查更新」→ 手里那张凭证在面板看来有 15 分钟有效期。
    await act(() => {
      nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'check')[0].props.onClick();
    });
    eq(requests.filter((r) => r.which === 'check').length, 1, '用户点检查更新：拿到一张 FRESH-1');
    requests.length = 0;
    await act(() => {
      nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0].props.onClick();
    });
    const seq = requests.map((r) => r.which + (r.which === 'install' ? '[' + r.body.checkId + ']' : ''));
    eq(requests.map((r) => r.which), ['install', 'check', 'install'],
      '序列 = install[旧凭证] → check → install[新凭证]（修前是 install[FRESH-1],install[FRESH-1]：中间零 check、重试空转）');
    if (requests.length === 3) {
      eq(seq[0], 'install[FRESH-1]', '第一枪用的是手里那张（面板自认新鲜 ⇒ 不当场多查一次）');
      eq(requests[0].body.checkId !== requests[2].body.checkId, true, '重提换了凭证（强制重查拿到 FRESH-2，不是拿死凭证硬顶）');
      eq(requests[2].body.checkId, 'FRESH-2', '重提用的正是那一发强查的新凭证');
      eq(requests[2].body.requestId, requests[0].body.requestId, '同一个 requestId（包里幂等重放 ⇒ 只装了 1 次、不是 2 次安装）');
    }
    eq(requests.filter((r) => r.which === 'install').length, 2, 'install 通话有界：正好 2 次（≤2 轮，不是无限重试）');
    eq(requests.filter((r) => r.which === 'check').length, 1, '重试只补 1 次 check（不是每轮都重查）');
    eq(String(txt(one(c, 'data-dsh-prompt-update-code'))), 'check-expired', '两轮都没成时码仍摆到界面上');
    c.unmount();
  }

  console.log('=== T13c: 单飞锁挡下点击时的说法（N5：真实原因是「面板正忙」，不是「宿主没给凭证」） ===');
  {
    let mode = 'noreceipt';
    let releaseCheck;
    const gate = new Promise((r) => { releaseCheck = r });
    script.status = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', null);
    script.check = async () => {
      if (mode === 'hang') { await gate; return okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', { checkId: 'LATE-1', checkedAt: 1, expiresAt: Date.now() + 900000 }); }
      if (mode === 'noreceipt') return okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', null);
      return okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD', { checkId: 'HOLD-1', checkedAt: 1, expiresAt: Date.now() + 900000 });
    };
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await flush();
    const btn = (a) => nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === a)[0];
    const modalText = () => String(txt(one(c, 'data-dsh-prompt-update-modal')));
    await act(() => { one(c, 'data-dsh-prompt-update').props.onClick() });
    // 负控：宿主**真的**回了一个不带凭证的回包 → 照旧说「这次没给凭证」，且一条 install 都不发。
    requests.length = 0;
    await act(() => { btn('install').props.onClick() });
    eq(requests.map((r) => r.which), ['check'], '真没凭证：先补 check、不发 install');
    eq(modalText().indexOf(STR.updateNoCredential.zh) >= 0, true, '负控：真没凭证时照旧说「宿主这次没给安装凭证」');
    // 正题：上一次通话还在飞（轮询那一发 / 用户刚点下的检查更新）时点安装 —— `run` 的单飞锁把它挡回，
    // `ensureCheckId` 拿到 null。真实原因是**面板正忙**，说成「宿主没给凭证」就是提示说反了。
    mode = 'hang';
    await act(() => { btn('check').props.onClick() });
    const inFlight = requests.filter((r) => r.which === 'check').length;
    eq(inFlight >= 1, true, '先有一发 check 在飞（锁被占着）');
    requests.length = 0;
    await act(() => { btn('install').props.onClick() });
    eq(requests.filter((r) => r.which === 'install').length, 0, '被锁挡下：一条 install 都没发出去');
    eq(modalText().indexOf(STR.updateBusyRetry.zh) >= 0, true, '提示说的是「上一次通话还没回来，等一拍再点」');
    eq(modalText().indexOf(STR.updateNoCredential.zh) >= 0, false, '不再说「宿主这次没给安装凭证」（真实原因是被自己的锁挡了）');
    releaseCheck();
    await flush();
    c.unmount();
  }

  console.log('=== T14: 弹窗打开期间按 UPD_POLL 轮询（安装中能收敛；关掉就停表） ===');
  {
    eq(typeof derived.UPD_POLL === 'number' && derived.UPD_POLL >= derived.UPD_POLL_MIN, true,
      '派生文件给的 UPD_POLL = ' + derived.UPD_POLL + '（≥ 下限 ' + derived.UPD_POLL_MIN + '）');
    eq(new RegExp('UPD_POLL').test(updateSrc), true, 'update.ts 引了派生文件的 UPD_POLL（间隔不写字面量）');
    eq(/from '\.\.\/update\/gen\/updateClient\.derived\.js'/.test(updateSrc), true, 'UPD_POLL 从派生文件 import');
    eq(new RegExp('setInterval\\([\\s\\S]{0,200}UPD_POLL').test(updateSrc), true, 'setInterval 的间隔取 UPD_POLL');
    eq(/clearInterval\(timer\)/.test(updateSrc), true, '关闭 / 卸载时 clearInterval');
    // 行为面：安装任务从 installing 收敛到 restart-required，**中间不点任何按钮**。
    // 手法：安装回包立刻回一个 installing 快照（真宿主就是这样，真装在后台跑），后台落地由 gate 控制；
    // 面板必须自己按 UPD_POLL 轮询、自己收敛。查询一律用直接 findAll（与本次整改的探针同一写法）。
    let phase = 'idle';
    let mode = 'quick';
    let releaseInstall;
    const gate = new Promise((r) => { releaseInstall = r });
    const S = (o) => Object.assign({ runningVersion: '0.1.7', installedVersion: '0.1.7', latestVersion: '0.1.9', canInstall: true, blockedReason: null, job: null }, o);
    requests.length = 0;
    script.status = () => {
      // 只有「还没开始装」那一份快照说 canInstall=true（像真宿主：点完安装它就把按钮收起来）。
      // 面板挂载时打的那次 status 就是这一份 —— 然后这一份（带着凭证）一直留在 res/lastGood 上，
      // 正是「用户看着安装按钮点下去」那一刻手里真有的东西。
      if (phase === 'idle') return okEnv(S({ canInstall: true }), 'CMD', { checkId: 'CHK-P', checkedAt: 1, expiresAt: Date.now() + 900000 });
      if (phase === 'installing') return okEnv(S({ canInstall: false, job: { state: 'installing' } }), 'CMD', null);
      return okEnv(S({ canInstall: false, blockedReason: 'pending-restart', installedVersion: '0.1.9', job: { state: 'restart-required' } }), 'CMD', null);
    };
    script.check = () => okEnv(S({}), 'CMD', { checkId: 'CHK-P', checkedAt: 1, expiresAt: Date.now() + 900000 });
    script.install = async () => {
      if (mode === 'wait') await gate;
      return okEnv(S({ canInstall: false, job: { state: 'installing' } }), 'CMD', null);
    };
    const c = await mount(React.createElement(update.UpdateEntry, {}));
    await flush();
    const q = (attr) => c.root.findAll((x) => !!x.props && x.props[attr] !== undefined);
    const rowEl = q('data-dsh-prompt-update')[0];
    const btn = (a) => q('data-dsh-prompt-update-action').filter((x) => x.props['data-dsh-prompt-update-action'] === a)[0];
    await act(() => { rowEl.props.onClick() });
    const ib = btn('install');
    eq(!!ib, true, '弹窗打开后有安装按钮（status 回包 canInstall=true）');
    // 用户按下安装之后：宿主开始装（status 从此回 installing），面板这一切通话都从这一刻算起。
    phase = 'installing';
    requests.length = 0;
    await act(() => { if (ib) ib.props.onClick() });
    const modalText = () => String(txt(q('data-dsh-prompt-update-modal')[0]));
    eq(modalText().indexOf(STR.updateBtnInstalling.zh) >= 0, true, '安装中：面板停在「安装中…」');
    const st = () => requests.filter((r) => r.which === 'status').length;
    const seen = () => requests.map((r) => r.which).join(',');
    const t0 = st();
    // 轮询只该在「安装任务还没到终态」时跑 —— 真值面无从外部直接读，就用一个间接但确定的口子：
    // 第一次轮询之后把后台任务切成「会阻塞」；只要面板还在轮询，就一定再次撞上这个阻塞。
    mode = 'wait';
    let blocked = false;
    for (let i = 0; i < 60 && !blocked; i++) {
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 100)) });
      blocked = seen().indexOf('install,status,status') >= 0;
    }
    eq(blocked, true, '弹窗打开期间真在轮询（status 通话 ' + t0 + ' → ' + st() + '，间隔 = UPD_POLL ' + derived.UPD_POLL + 'ms）');
    eq(seen().split(',').pop(), 'status', '轮询发的是 status（只读本机、不联网），不是 check（不替用户擅自联网查新版）');
    phase = 'done';
    releaseInstall();
    await flush();
    let settled = false;
    for (let i = 0; i < 80 && !settled; i++) {
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 100)) });
      const banner = q('data-dsh-prompt-update-banner')[0];
      if (banner && txt(banner).indexOf('0.1.9') >= 0) settled = true;
    }
    eq(settled, true, '不点任何按钮，面板自己收敛出 ⚠️ 待重启横幅（轮询看到终态）');
    const atSettle = st();
    eq(modalText().indexOf(STR.updateBtnInstalling.zh) >= 0, false, '终态后「安装中…」不再挂着');
    await TR.act(async () => { await new Promise((r) => setTimeout(r, derived.UPD_POLL + 600)) });
    eq(st() - atSettle <= 1, true, '终态（不再是 installing/verifying）后停止空转打 status（终态后又打了 ' + (st() - atSettle) + ' 次）');
    const beforeUnmount = st();
    c.unmount();
    await TR.act(async () => { await new Promise((r) => setTimeout(r, derived.UPD_POLL + 300)) });
    eq(st(), beforeUnmount, '卸载后 interval 已清（不再打 status）');
  }


  const I18N_KEYS = ['updateEntry', 'updateEntryHint', 'updateVersionUnknown', 'updateRowRunning', 'updateRowInstalled',
    'updateRowLatest', 'updateLatestNone', 'updateNotAvailable', 'updateBtnCheck', 'updateBtnChecking', 'updateBtnInstall',
    'updateBtnInstalling', 'updateBtnCopy', 'updateCopied', 'updateCopyFail', 'updateClose', 'updateHostFailTitle',
    'updateHostFailHint', 'updateReasonTitle', 'updateReasonUnknown', 'updatePendingBanner', 'updatePendingHint',
    'updateManualTitle', 'updateManualNone', 'updateManualHint',
    // #60 追加交付 B 新增：结论行三条 + 没查到时的下一步 + 「详情」
    'updateVerdictUpToDate', 'updateVerdictNewer', 'updateVerdictUnknown', 'updateVerdictUnknownHint', 'updateDetails',
    // 整改 M1/M2 新增：失败两类文案 + 按码动作 + 安装任务终态失败 + 旧命令标注
    'updateFailAnsweredTitle', 'updateFailAnsweredHint', 'updateFailNoFault', 'updateFailBusy', 'updateFailCheckFailed',
    'updateFailInvalidRelease', 'updateFailInstallFailed', 'updateFailCheckExpired', 'updateFailInstallationChanged',
    'updateFailRegistryConflict', 'updateFailRecoveryRequired', 'updateFailUnknown',
    // L2 第二轮 N1/N5 新增（能力没接通那一类 + 单飞锁挡下时的说法）；N2 删掉了凭空编的 updateFailParams
    'updateCapDownTitle', 'updateCapDownAction', 'updateBusyRetry',
    'updateNoCredential', 'updateJobFailTitle', 'updateJobFailHint', 'updateManualStale'];
  // 注意：#60-B 第 6 条把「版本与状态每次现算、不缓存」那句说明删了（行为不变，只是不再写出来），
  // 所以它不在上面的清单里 —— 上面 T3e 另有一条断言钉着它确实不存在。
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
