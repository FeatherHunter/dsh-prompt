// Host 逻辑仿真 #20：lib/index.js 全路径（不依赖 DSH 运行时）
// 方法：源码级替换 host-only import（@deepseek-ai/dsh-storage-domain → 本地 stub），
// zod 用仓库真实依赖；storageDomain/webServer/ctx 全 fake；驱动 HTTP handler 跑 CRUD。
// 覆盖：路由注册、空快照、put 校验（body≤1000）、bump 原子计数+lastUsed、pinned 上限与对账、
// 删除同步清 pinned、未知路由 404、spec 形状（dsh_prompt/v0/三表/global）。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
}

(async () => {
  // ── stub host-only 包（透传声明，供 fake open 检验） ──
  fs.writeFileSync(path.join(DIR, 'dsh-storage-domain-stub.mjs'),
    'export const defineDomain = (s) => s;\nexport const domainTable = (s) => ({ valueSchema: s });\n');
  const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'index.js'), 'utf8')
    .split('from "@deepseek-ai/dsh-storage-domain"').join('from "./dsh-storage-domain-stub.mjs"');
  fs.writeFileSync(path.join(DIR, 'prompt-host.mjs'), hostSrc);

  const host = await import(pathToFileURL(path.join(DIR, 'prompt-host.mjs')).href);
  if (host.name !== 'dsh-prompt') fail('host name 应为 dsh-prompt');
  if (!Array.isArray(host.inject) || !host.inject.includes('storageDomain') || !host.inject.includes('webServer')) {
    fail('host inject 应含 storageDomain + webServer');
  }
  ok('host 导出形状（name/inject/apply）');

  // spec 形状
  const spec = host.promptDomainSpec;
  eq(spec.name, 'dsh_prompt', 'domain 名');
  eq(spec.version, 0, 'domain 版本');
  eq(Object.keys(spec.tables).sort(), ['customs', 'pinned', 'usage'], '三表');
  eq(spec.global.initial, { lastUsed: null }, 'global 初值');
  ok('domain spec（dsh_prompt v0 + 三表 + lastUsed）');

  // ── fake DSH host ──
  function makeTable() {
    const m = new Map();
    return {
      get: (k) => m.get(k),
      put: async (k, v) => { m.set(k, v) },
      delete: async (k) => { m.delete(k) },
      keys: function* () { for (const k of m.keys()) yield k },
    };
  }
  let globalVal = { lastUsed: null };
  const tables = { customs: makeTable(), usage: makeTable(), pinned: makeTable() };
  const fakeStorageDomain = {
    open: async (s) => {
      if (s !== spec) throw new Error('open 应传入 promptDomainSpec');
      return {
        table: (n) => tables[n],
        global: { get: () => ({ ...globalVal }), set: async (v) => { globalVal = { ...v } } },
        close: async () => undefined,
      };
    },
  };
  let registered = null;
  const fakeCtx = {
    storageDomain: fakeStorageDomain,
    webServer: { register: (route) => { registered = route; return () => undefined } },
    logger: { warn: () => undefined },
    effect: (fn) => fn(),
  };

  host.apply(fakeCtx, {});
  if (!registered || registered.kind !== 'prefix' || registered.path !== '/_dsh/dsh-prompt') {
    fail('应注册 prefix 路由 /_dsh/dsh-prompt');
  }
  ok('路由注册（prefix /_dsh/dsh-prompt §5-4 定位兑现）');

  // ── fake HTTP ──
  function req(method, url, body) {
    const chunk = body === undefined ? null : Buffer.from(JSON.stringify(body));
    return {
      method, url,
      headers: { host: '127.0.0.1:43120' },
      [Symbol.asyncIterator]: async function* () { if (chunk) yield chunk },
    };
  }
  async function call(method, url, body) {
    const r = req(method, url, body);
    let status = 200; let text = '';
    const res = {
      set statusCode(v) { status = v }, get statusCode() { return status },
      writeHead: (s) => { status = s }, end: (d) => { text = d },
      setHeader: () => undefined,
    };
    await registered.handler(r, res);
    return { status, json: JSON.parse(text) };
  }

  // 空快照（直接切换：旧数据不在此处）
  let out = await call('GET', '/_dsh/dsh-prompt/store');
  eq(out.status, 200, 'GET store 状态码');
  eq(out.json.value, { customs: [], usage: {}, pinned: [], lastUsed: null }, '空快照');
  ok('GET store 空快照');

  // put 有效模板
  const tpl = { id: 'c1', name: 'T1', nameEn: '', domain: '执行', stage: '执行前', action: [], body: '正文', tag: '自定义', createdAt: 1 };
  out = await call('POST', '/_dsh/dsh-prompt/customs/put', { template: tpl });
  eq(out.status, 200, 'put 状态码');
  out = await call('GET', '/_dsh/dsh-prompt/store');
  eq(out.json.value.customs.length, 1, '快照含 1 模板');
  ok('customs/put + 快照可见');

  // put 非法（body 超 1000）→ 400
  out = await call('POST', '/_dsh/dsh-prompt/customs/put', { template: { ...tpl, id: 'cbad', body: 'x'.repeat(1001) } });
  eq(out.status, 400, '超长 body 应 400');
  ok('schema 校验（body≤1000）拒绝非法写入');

  // bump 两次 → count 2 + lastUsed
  await call('POST', '/_dsh/dsh-prompt/usage/bump', { id: 'c1' });
  out = await call('POST', '/_dsh/dsh-prompt/usage/bump', { id: 'c1' });
  eq(out.json.value, { id: 'c1', count: 2 }, 'bump 返回');
  out = await call('GET', '/_dsh/dsh-prompt/store');
  eq(out.json.value.usage, { c1: 2 }, 'usage 计数');
  eq(out.json.value.lastUsed, 'c1', 'lastUsed 原子设置');
  ok('usage/bump 计数 + lastUsed 原子');

  // pinned：超限 400，有效对账
  out = await call('POST', '/_dsh/dsh-prompt/pinned/set', { ids: ['a', 'b', 'c', 'd', 'e', 'f'] });
  eq(out.status, 400, '6 个置顶应 400');
  out = await call('POST', '/_dsh/dsh-prompt/pinned/set', { ids: ['c1'] });
  eq(out.status, 200, 'pinned set 状态码');
  out = await call('GET', '/_dsh/dsh-prompt/store');
  eq(out.json.value.pinned, ['c1'], 'pinned 对账');
  ok('pinned/set 上限 5 + 全量对账');

  // delete 同步清 pinned
  out = await call('POST', '/_dsh/dsh-prompt/customs/delete', { id: 'c1' });
  eq(out.status, 200, 'delete 状态码');
  out = await call('GET', '/_dsh/dsh-prompt/store');
  eq(out.json.value.customs, [], '模板已删');
  eq(out.json.value.pinned, [], 'pinned 同步清理');
  ok('customs/delete 同步清 pinned');

  // 未知路由 404
  out = await call('GET', '/_dsh/dsh-prompt/nope');
  eq(out.status, 404, '未知路由应 404');
  ok('未知路由 404');

  console.log('=== Test #20-host PASS ===');
  process.exit(0);
})().catch((e) => { console.log('HARNESS-ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : String(e))); process.exit(3) });
