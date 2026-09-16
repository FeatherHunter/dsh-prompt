// 回归 #56：isAllowed 必须真验 loopback（注释与实现一致），且更新能力可用性不倒退。
// 方法：与 test-issue-39.cjs 同一套 —— 把 lib/index.js 复制到临时目录、host-only 裸导入换成
// 本地 stub，进程内跑起宿主半（fake ctx + fake HTTP），直接驱动注册表的 handler。
// 断言：
//  (a) 放行：127/8、localhost、[::1]（带端口剥离）+ 同源 Origin / 无 Origin 一律非 403，
//      store 与 update/status 两条路由都可达（更新能力缺席时回 update-capability-unavailable，
//      但状态码仍 200 —— 403 才代表被围栏拦住）；
//  (b) 拒绝：evil Host 无 Origin、nip.io rebinding、局域网 IP、0.0.0.0、缺 Host、cross-site、
//      跨 origin、跨端口 origin、Host 与 Origin 双 evil，一律 403。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-56');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log(' ok: ' + msg); }
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIR, 'log'), { recursive: true });

  // 注释与实现一致：注释写 loopback 必须，实现里必须真验（防下次改回“只查存在”）。
  const indexSrc = readSrc('lib/index.js');
  if (!indexSrc.includes('function isLoopbackHostValue')) fail('lib/index.js 缺 isLoopbackHostValue（loopback 字面量校验被删了？）');
  if (!indexSrc.includes('if (!isLoopbackHostValue(hostValue)) return false;')) fail('isAllowed 没有先验 Host 是否 loopback');

  const hostCopy = indexSrc.split('from "@deepseek-ai/dsh-storage-domain"').join('from "./dsh-storage-domain-stub.mjs"');
  fs.writeFileSync(path.join(DIR, 'dsh-storage-domain-stub.mjs'),
    'export const defineDomain = (s) => s;\nexport const domainTable = (s) => ({ valueSchema: s });\n');
  fs.writeFileSync(path.join(DIR, 'prompt-host.mjs'), hostCopy);
  fs.writeFileSync(path.join(DIR, 'log', 'index.js'),
    'export async function installLogCapability() { return { ok: true, log() { return true } }; }\n');

  const host = await import(pathToFileURL(path.join(DIR, 'prompt-host.mjs')).href);

  function makeTable() {
    const m = new Map();
    return {
      get: (k) => m.get(k),
      put: async (k, v) => { m.set(k, v); },
      delete: async (k) => { m.delete(k); },
      keys: function* () { for (const k of m.keys()) yield k; },
    };
  }
  let globalVal = { lastUsed: null };
  const tables = { customs: makeTable(), usage: makeTable(), pinned: makeTable() };
  const fakeCtx = {
    storageDomain: {
      open: async () => ({
        table: (n) => tables[n],
        global: { get: () => ({ ...globalVal }), set: async (v) => { globalVal = { ...v }; } },
      }),
    },
    webServer: { register: (route) => { registered = route; return () => undefined; } },
    logger: { warn: () => undefined },
    effect: (fn) => fn(),
  };
  let registered = null;
  host.apply(fakeCtx, {});
  if (!registered || registered.path !== '/_dsh/dsh-prompt') fail('应注册 prefix 路由 /_dsh/dsh-prompt');

  async function drive(route, method, headers) {
    const chunk = method === 'POST' ? Buffer.from('{}') : null;
    const req = {
      method, url: route, headers,
      [Symbol.asyncIterator]: async function* () { if (chunk) yield chunk; },
    };
    let status = 200; let text = '';
    const res = {
      set statusCode(v) { status = v; }, get statusCode() { return status; },
      writeHead: (s) => { status = s; }, end: (d) => { text = d; },
      setHeader: () => undefined,
    };
    await registered.handler(req, res);
    return { status, json: text ? JSON.parse(text) : null };
  }

  const STORE = '/_dsh/dsh-prompt/store';
  const UPDATE_STATUS = '/_dsh/dsh-prompt/update/status';
  const PROBE_ROUTES = [STORE, UPDATE_STATUS];

  // (a) 放行：更新可用性不倒退 —— 自家客户端（127.0.0.1:43120 同源）必须非 403。
  const allowCases = [
    ['127.0.0.1 无 Origin', { host: '127.0.0.1:43120' }],
    ['127.0.0.1 同源 Origin', { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:43120' }],
    ['localhost', { host: 'localhost:43120' }],
    ['[::1]', { host: '[::1]:43120' }],
    ['127/8 段内', { host: '127.0.0.2:43120' }],
    ['same-origin 站点', { host: '127.0.0.1:43120', 'sec-fetch-site': 'same-origin' }],
  ];
  for (const [label, headers] of allowCases) {
    for (const route of PROBE_ROUTES) {
      const out = await drive(route, route === STORE ? 'GET' : 'POST', { ...headers });
      if (out.status === 403) fail('放行用例被拦：' + label + ' 打 ' + route + ' 回 403');
    }
  }
  const storeOut = await drive(STORE, 'GET', { host: '127.0.0.1:43120' });
  if (storeOut.status !== 200 || storeOut.json?.ok !== true) fail('store 自家调用应 200 ok，实为 ' + JSON.stringify(storeOut));
  ok('(a) 放行：自家客户端（127/8、localhost、[::1]，同源/无 Origin）两条路由都非 403，store 照常 200');

  // (b) 拒绝：票面两个实测形状 + 同族变形，一律 403。
  const denyCases = [
    ['evil Host 无 Origin（票面主形状）', { host: 'evil.example.com' }],
    ['nip.io rebinding（票面第二形状）', { host: '127.0.0.1.nip.io' }],
    ['局域网 IP', { host: '192.168.1.10:43120' }],
    ['0.0.0.0', { host: '0.0.0.0:43120' }],
    ['缺 Host', {}],
    ['cross-site', { host: '127.0.0.1:43120', 'sec-fetch-site': 'cross-site' }],
    ['跨 origin', { host: '127.0.0.1:43120', origin: 'http://evil.example.com' }],
    ['跨端口 origin', { host: '127.0.0.1:43120', origin: 'http://127.0.0.1:9999' }],
    ['Host 与 Origin 双 evil', { host: 'evil.example.com', origin: 'http://evil.example.com' }],
  ];
  for (const [label, headers] of denyCases) {
    for (const route of PROBE_ROUTES) {
      const out = await drive(route, route === STORE ? 'GET' : 'POST', { ...headers });
      if (out.status !== 403) fail('拒绝用例未拦：' + label + ' 打 ' + route + ' 应 403，实为 ' + out.status);
    }
  }
  ok('(b) 拒绝：evil/nip.io/局域网/0.0.0.0/缺 Host/cross-site/跨 origin（含双 evil）一律 403');

  console.log('=== Test #56 PASS ===');
})();
