// 回归测试 #31: 阶段“任意”彻底移除清洗
// 验收映射（#31 正文 + Agent Brief）：
//  A) 类型层写不出：Stage 联合与 StageEnum 均无“任意”（tsc 覆盖）
//  B) 全仓 grep“任意”仅剩注释/文档 + #23 有意三处（LABEL_RESERVED/i18n/test），无逻辑引用
//  C) 手改 stage 任意 PUT → 400（现有非法路径）；新形状与合法旧形状仍 200
//  D) 页签无“任意”项（复核）；npm test 全过 + build + typecheck
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

(async () => {
  console.log('=== Test #31 A/B: 类型与全仓引用 ===');
  const tplSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'templates.ts'), 'utf8');
  const stageLine = tplSrc.split('\n').find((l) => l.includes('export type Stage'));
  if (!stageLine || stageLine.includes('任意') && !stageLine.includes('#31')) fail('Stage 联合仍含逻辑“任意”：' + stageLine);
  ok('Stage 联合无“任意”取值');
  const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'index.js'), 'utf8');
  const enumLine = hostSrc.split('\n').find((l) => l.includes('const StageEnum'));
  if (!enumLine || (enumLine.includes('任意') && !enumLine.includes('#31'))) fail('StageEnum 仍含逻辑“任意”');
  ok('StageEnum 无“任意”取值');
  // 全仓 grep：允许集 = 注释/文档 + #23 有意三处
  const allow = [/LABEL_RESERVED/, /labelReserved/, /#31/, /幽灵/, /test-issue-23/, /回落/, /阻断/, /research\//];
  const scanFiles = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.rt-tmp' && e.name !== '.git') walk(p); }
      else if (/\.(ts|js|cjs)$/.test(e.name) && !/test-issue-31/.test(e.name) && e.name !== 'client.js') scanFiles.push(p);
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  walk(path.join(__dirname, '..', 'lib'));
  const bad = [];
  for (const f of scanFiles) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (l.includes('任意') && !allow.some((re) => re.test(l))) bad.push(path.relative(path.join(__dirname, '..'), f) + ':' + (i + 1) + ': ' + l.trim());
    });
  }
  if (bad.length) fail('逻辑引用残留：\n' + bad.join('\n'));
  ok('grep“任意”零逻辑引用（仅注释/文档/#23 有意三处）');

  console.log('=== Test #31 D: 页签复核（UI 无“任意”） ===');
  const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
  const MODULES = [
    ['templates.ts', SRC('templates.ts'), []],
    ['store.ts', SRC('store.ts'), ['./templates']],
    ['state.ts', SRC('state.ts'), []],
    ['i18n.ts', SRC('i18n.ts'), []],
    ['smartstore.ts', SRC('smartstore.ts'), []],
    ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
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
  const texts = (node, acc) => {
    if (node == null) return acc || [];
    acc = acc || [];
    if (typeof node === 'string') { acc.push(node); return acc }
    if (Array.isArray(node)) { node.forEach((n) => texts(n, acc)); return acc }
    if (node.children) texts(node.children, acc);
    return acc;
  };
  for (const compact of [false, true]) {
    let tree;
    TR.act(() => { tree = TR.create(React.createElement(panel.TemplateBrowser, { compact })); });
    const all = texts(tree.toJSON(), []);
    if (all.some((t) => t === '任意')) fail((compact ? '悬浮' : '设置页') + '出现裸“任意”选项');
    try { tree.unmount(); } catch (e) {}
  }
  ok('设置页/悬浮列表无“任意”选项');

  console.log('=== Test #31 C: 非法写入 400 路径 ===');
  fs.writeFileSync(path.join(DIR, 'dsh-storage-domain-stub31.mjs'),
    'export const defineDomain = (s) => s;\nexport const domainTable = (s) => ({ valueSchema: s });\n');
  const hsrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'index.js'), 'utf8')
    .split('from "@deepseek-ai/dsh-storage-domain"').join('from "./dsh-storage-domain-stub31.mjs"');
  fs.writeFileSync(path.join(DIR, 'prompt-host31.mjs'), hsrc);
  const host = await import(pathToFileURL(path.join(DIR, 'prompt-host31.mjs')).href);
  function makeTable() {
    const m = new Map();
    return { get: (k) => m.get(k), put: async (k, v) => { m.set(k, v) }, delete: async (k) => { m.delete(k) }, keys: function* () { for (const k of m.keys()) yield k } };
  }
  let globalVal = { lastUsed: null };
  const tables = { customs: makeTable(), usage: makeTable(), pinned: makeTable() };
  const fakeCtx = {
    storageDomain: { open: async (s) => ({ table: (n) => tables[n], global: { get: () => ({ ...globalVal }), set: async (v) => { globalVal = { ...v } } }, close: async () => undefined }) },
    webServer: { register: (route) => { registered = route; return () => undefined } },
    logger: { warn: () => undefined },
    effect: (fn) => fn(),
  };
  let registered = null;
  host.apply(fakeCtx, {});
  async function call(method, url, body) {
    const chunk = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = { method, url, headers: { host: '127.0.0.1:43120' }, [Symbol.asyncIterator]: async function* () { if (chunk) yield chunk } };
    let status = 200; let text = '';
    const res = { set statusCode(v) { status = v }, writeHead: (s) => { status = s }, end: (d) => { text = d } };
    await registered.handler(req, res);
    return { status, json: JSON.parse(text) };
  }
  // 手改 stage 任意 → 400
  let r = await call('POST', '/_dsh/dsh-prompt/customs/put', { template: { id: 'cx', name: 'X', nameEn: '', domain: '执行', stage: '任意', action: [], body: 'b', tag: 't', createdAt: 1 } });
  if (r.status !== 400) fail('stage 任意应 400，实得 ' + r.status);
  ok('手改 stage 任意 → 400 invalid custom template');
  // 合法旧形状仍 200（兼容分支不受影响）
  r = await call('POST', '/_dsh/dsh-prompt/customs/put', { template: { id: 'cy', name: 'Y', nameEn: '', domain: '执行', stage: '执行前', action: [], body: 'b', tag: 't', createdAt: 1 } });
  if (r.status !== 200) fail('合法旧形状应 200，实得 ' + r.status);
  ok('合法旧形状仍 200');
  // 新形状仍 200
  r = await call('POST', '/_dsh/dsh-prompt/customs/put', { template: { id: 'cz', name: 'Z', nameEn: '', labels: ['复盘'], body: 'b', builtin: false, createdAt: 1 } });
  if (r.status !== 200) fail('新形状应 200，实得 ' + r.status);
  ok('新形状仍 200');

  console.log('=== Test #31 PASS ===');
})().then(() => process.exit(0), (e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
