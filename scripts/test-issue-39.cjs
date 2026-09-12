// 回归 #39：更新能力的宿主接线与构建准备
// 方法：与 test-issue-20-host.cjs 同一套 —— 把 lib/index.js 复制到临时目录、把 host-only
// 裸导入换成本地 stub，然后在**进程内**真的跑起宿主半（fake ctx + fake HTTP），驱动既有路由
// 处理器。差异是这里还把 lib/update.js 与 lib/log/index.js 换成「可观测的假件」，好让三条更新
// 路由真的被走到，同时不连网、不装包、不依赖真机 DSH 宿主。
//
// 断言（对应任务书第 3 节的 a–d）：
//  (a) 三条路由经既有路由构造器注册后可命中（且非 POST / 未知路径不被更新能力抢走）
//  (b) 状态快照带齐包 README 第 8 节的六字段，且与真实 dsh-plugin-update 的 buildSnapshot 对账
//  (c) 同源防护没有被削弱：非 loopback / 跨站 / 跨 origin 请求仍被拒，同源仍放行
//  (d) 客户端 shim 的电话名映射到上述三条端点（源码级静态断言，含与真实更新包 buildPhoneNames 对账）
// 另有结构断言：依赖声明、构建产物把第三方包留作外部依赖、四处路径常量不漂移、能力缺席时诚实失败。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-39');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
}

const SNAPSHOT_FIELDS = ['runningVersion', 'installedVersion', 'latestVersion', 'canInstall', 'blockedReason', 'job'];
const ROUTES = {
  status: '/_dsh/dsh-prompt/update/status',
  check: '/_dsh/dsh-prompt/update/check',
  install: '/_dsh/dsh-prompt/update/install',
};
const PHONE_NAMES = {
  updateStatus: 'prompt.updateStatus',
  updateCheck: 'prompt.updateCheck',
  updateInstall: 'prompt.updateInstall',
};
const PATH_CONST = { status: 'UPDATE_STATUS_PATH', check: 'UPDATE_CHECK_PATH', install: 'UPDATE_INSTALL_PATH' };
const PHONE_CONST = { status: 'UPD_STATUS', check: 'UPD_CHECK', install: 'UPD_INSTALL' };

/* ── 源码读取与静态断言小工具 ── */
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }
function quotedAfter(src, needle, where) {
  const i = src.indexOf(needle);
  if (i < 0) fail('找不到 ' + needle + '（' + where + '）');
  const m = src.slice(i + needle.length).match(/'([^']*)'|"([^"]*)"/);
  if (!m) fail(needle + ' 后面没跟字符串字面量（' + where + '）');
  return m[1] !== undefined ? m[1] : m[2];
}
const squash = (s) => s.replace(/\s+/g, ' ');

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIR, 'log'), { recursive: true });

  const pkg = JSON.parse(readSrc('package.json'));

  /* ── 0) 结构：依赖与脚本入口 ── */
  if (pkg.dependencies['dsh-plugin-update'] !== '0.1.1') {
    fail('dependencies["dsh-plugin-update"] 应为精确 "0.1.1"，实为 ' + JSON.stringify(pkg.dependencies['dsh-plugin-update']));
  }
  if (!pkg.devDependencies.esbuild) fail('devDependencies 缺 esbuild');
  if (!pkg.scripts['test:issue-39']) fail('package.json 缺 test:issue-39 入口');
  if (!pkg.scripts['build:update-host']) fail('package.json 缺 build:update-host 入口');
  if (!pkg.scripts['derive:update-values']) fail('package.json 缺 derive:update-values 入口');
  ok('依赖声明（dsh-plugin-update@0.1.1 + esbuild + test:issue-39 + build:update-host + derive:update-values）');
  // 400 行告警线（地图 #38 grilling 拍板）：生产代码按「文件行数」算。本脚本自己的数字不被人工数骗到
  // （PowerShell 的 Get-Content 在 UTF-8 文件上会少报），所以这里真数一遍，超线的当场点名。
  // lib/index.js 在 #39 之前就已超线（本票必须往里加约 40 行接线），不是本票新增文件的毛病 ——
  // 按结构纪律「当场报警、本轮不拆」：这里列出超线文件，不阻断其余断言，也不顺手重排既有文件。
  const ALERT_LINES = 400;
  const lineCount = (rel) => readSrc(rel).split('\n').length - (readSrc(rel).endsWith('\n') ? 1 : 0);
  const watchFiles = ['lib/index.js', 'lib/update.js', 'src/update/bridge.ts', 'src/update/host/index.ts'];
  const over = watchFiles.filter((f) => lineCount(f) > ALERT_LINES);
  const counts = watchFiles.map((f) => f + '=' + lineCount(f)).join(' ');
  if (over.length > 0 && over.length === watchFiles.length) fail('行数统计可疑：四个生产文件全超线，先确认 readSrc 没读错（' + counts + '）');
  ok('行数告警线（' + ALERT_LINES + '）：' + counts + (over.length ? '  ⚠️ 超线：' + over.join(' ') : '  全部在线的以内'));

  /* ── 1) 构建产物存在，且第三方包保持外部依赖 ── */
  const built = readSrc('lib/update.js');
  if (!built.includes('createUpdateCapability')) fail('lib/update.js 里没有 createUpdateCapability（先跑 npm run build:update-host）');
  if (!/import\(\s*["']dsh-plugin-update["']\s*\)/.test(built)) {
    fail('lib/update.js 应按包名动态 import dsh-plugin-update（externals），实际没有');
  }
  if (!built.includes('AUTO-GENERATED')) fail('lib/update.js 缺构建产物告示行（人手改过？）');
  ok('lib/update.js 为构建产物，且 dsh-plugin-update 保持外部依赖（升级只改 package.json 一处）');

  /* ── 2) 路径常量四处不漂移：产物 / 宿主源码 / 客户端源码 / lib/index.js ── */
  const bridgeSrc = readSrc('src/update/bridge.ts');
  const hostSrc = readSrc('src/update/host/index.ts');
  const indexSrc = readSrc('lib/index.js');
  for (const [key, route] of Object.entries(ROUTES)) {
    const inBuilt = quotedAfter(built, PATH_CONST[key], 'lib/update.js');
    if (inBuilt !== route) fail('lib/update.js 里 ' + key + ' 路径为 ' + inBuilt + '，期望 ' + route);
    if (!built.includes(JSON.stringify(route))) fail('lib/update.js 里没有出现字面量 ' + route);
    if (!bridgeSrc.includes("'" + route + "'")) fail('src/update/bridge.ts 里没有 ' + route);
    if (!indexSrc.includes('"' + route + '"')) fail('lib/index.js 的 UPDATE_ROUTES 里没有 ' + route);
  }
  if (!hostSrc.includes("from '../bridge.js'")) fail('src/update/host/index.ts 应从 ../bridge.js 取路径，不该自己写');
  if (/['"]\/_dsh\/dsh-prompt\/update/.test(hostSrc)) fail('src/update/host/index.ts 里出现了路径字面量（应引用 bridge）');
  ok('三条路径在 产物 / 宿主源码 / 客户端源码 / lib/index.js 四处同值');

  /* ── 3) (d) 客户端 shim：电话名 → 三条端点 ── */
  // 派生文件直接 import 一次：它真的能加载，且导出的电话名与更新包按同一前缀拼出来的一致。
  const derivedMod = await import(pathToFileURL(path.join(ROOT, 'src/update/gen/updateClient.derived.js')).href);
  const derivedSrc = readSrc('src/update/gen/updateClient.derived.js');
  if (!derivedSrc.includes('derive-client-values.mjs')) fail('派生文件缺生成命令告示行（人手改过？）');
  const { buildPhoneNames } = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'config.js')).href);
  eq(
    { updateStatus: derivedMod.UPD_STATUS, updateCheck: derivedMod.UPD_CHECK, updateInstall: derivedMod.UPD_INSTALL },
    PHONE_NAMES,
    '派生常量 ↔ README 口径的三个电话名',
  );
  eq(buildPhoneNames('prompt'), PHONE_NAMES, '派生电话名 ↔ 更新包 buildPhoneNames("prompt")');
  if (derivedMod.UPD_POLL !== 1000 || derivedMod.UPD_POLL_MIN !== 250) {
    fail('派生轮询常量应为 1000 / 250，实为 ' + derivedMod.UPD_POLL + ' / ' + derivedMod.UPD_POLL_MIN);
  }
  const hostPhonePrefix = quotedAfter(hostSrc, 'PHONE_PREFIX =', 'src/update/host/index.ts');
  if (hostPhonePrefix !== 'prompt') fail('宿主半 PHONE_PREFIX 应为 prompt，实为 ' + hostPhonePrefix);
  // bridge 的电话表：键=派生常量，值=以对应端点为参数的 call
  const flat = squash(bridgeSrc);
  for (const [key, route] of Object.entries(ROUTES)) {
    if (!flat.includes('[' + PHONE_CONST[key] + ']: (args = {}) => call(' + PATH_CONST[key] + ', args)')) {
      fail('bridge 电话表缺一行：' + PHONE_CONST[key] + ' → ' + PATH_CONST[key]);
    }
    if (!flat.includes('export const ' + PATH_CONST[key] + " = '" + route + "'")) {
      fail('bridge 没声明端点常量 ' + PATH_CONST[key] + '（' + route + '）');
    }
  }
  ok('(d) 客户端 shim：三个派生电话名 → 三条端点的 POST 封装（源码级断言）');

  /* ── 3b) 客户端 shim 真跑一次（把 fetch 换成假的，断言它把请求发对了、回包拆对了）──
   * tsdown 只打 src/client/index.ts 那一张图，本票不做面板入口，所以 shim 目前不在 lib/client.js 里。
   * 这里把 bridge.ts 原样搬一份（只去一处类型标注，不动逻辑）到临时目录跑，
   * 用假 fetch 盯住三件事：method/URL/请求体、信封拆解、失败与异常两种回包的形状。
   */
  // 只做「去类型」这一件事：删掉 import 类型的那一行、删掉两个 interface 与两个 type 声明
  // （按大括号配对切，不靠正则猜内容）、再去掉剩下的标注。逻辑一行不动。
  function stripTypes(src) {
    let out = src.replace(/^import \{ UPD_[A-Z]+(?:, UPD_[A-Z]+)* \} from '\.\/gen\/updateClient\.derived\.js'\n/m, '')
    for (const [kw, name] of [['interface', 'BridgeEnvelope'], ['interface', 'UpdateCallResult'], ['type', 'UpdatePhone'], ['type', 'UpdatePhoneTable']]) {
      const start = out.indexOf(`export ${kw} ${name}`);
      if (start < 0) fail('去类型：找不到 export ' + kw + ' ' + name + '（bridge.ts 改过了？）');
      const open = out.indexOf('{', start);
      if (open < 0 && kw === 'type') { out = out.slice(0, start) + out.slice(out.indexOf('\n', start) + 1); continue }
      let depth = 0; let end = -1;
      for (let i = open; i < out.length; i++) {
        if (out[i] === '{') depth++;
        else if (out[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end < 0) fail('去类型：' + name + ' 的大括号没配对');
      out = out.slice(0, start) + out.slice(out.indexOf('\n', end) + 1);
    }
    return out
      .replace(/\(res: Response\): Promise<BridgeEnvelope>/g, '(res)')
      .replace(/\(env: BridgeEnvelope\): UpdateCallResult/g, '(env)')
      .replace(/\(raw: unknown\): BridgeEnvelope/g, '(raw)')
      .replace(/\): UpdatePhoneTable \{/g, ') {')
      .replace(/async \(route: string, args: Record<string, unknown>\): Promise<UpdateCallResult> => \{/g, 'async (route, args) => {')
      .replace(/\(route: string\): string/g, '(route)')
      .replace(/\(args: Record<string, unknown>\)/g, '(args)')
      .replace(/const args: Record<string, unknown>/g, 'const args')
      .replace(/const withLocation: unknown = globalThis/g, 'const withLocation = globalThis')
      .replace(/\(withLocation as \{ location\?: \{ origin\?: string \} \}\)\.location/, 'withLocation.location')
      .replace(/const value = env\.value !== null && typeof env\.value === 'object'\n(\s*)\? \(env\.value as \{[^}]*\}\)\n\s*: \{\}/, 'const value = env.value !== null && typeof env.value === "object" ? env.value : {}')
      .replace(/const snapshot = value\.snapshot !== null && typeof value\.snapshot === 'object'\n(\s*)\? \(value\.snapshot as Record<string, unknown>\)\n\s*: null/, 'const snapshot = value.snapshot !== null && typeof value.snapshot === "object" ? value.snapshot : null')
      .replace(/typeof \(raw as \{ ok\?: unknown \}\)\.ok === 'boolean'/, 'typeof raw.ok === "boolean"')
      .replace(/return raw as BridgeEnvelope/, 'return raw')
  }
  const bridgeJs = stripTypes(bridgeSrc)
  const leftOverTypes = bridgeJs.match(/:\s*(Response|BridgeEnvelope|UpdateCallResult|UpdatePhoneTable)\b/g)
  if (leftOverTypes) fail('bridge.ts 的临时搬运没把类型标注去干净（剩 ' + leftOverTypes.join(',') + '），3b 段会跑不起来');
  const bridgeModuleSrc = derivedSrc + '\n' + bridgeJs;
  fs.writeFileSync(path.join(DIR, 'bridge-under-test.mjs'), bridgeModuleSrc);

  const calls = [];
  let respond = async () => ({ status: 200, body: { ok: true, value: { snapshot: { job: null }, manual: 'cmd', receipt: { checkId: 'c1' } } } });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: JSON.parse(String(init.body)), headers: init.headers });
    const r = await respond();
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
  };
  const bridgeMod = await import(pathToFileURL(path.join(DIR, 'bridge-under-test.mjs')).href);
  const table = bridgeMod.createUpdateBridge();
  eq(Object.keys(table).sort(), Object.values(PHONE_NAMES).sort(), 'shim 电话表的键 = 三个派生电话名');
  for (const [key, route] of Object.entries(ROUTES)) {
    calls.length = 0;
    const args = key === 'install' ? { checkId: 'c1', requestId: 'r1' } : {};
    const res = await table[PHONE_NAMES[key === 'status' ? 'updateStatus' : key === 'check' ? 'updateCheck' : 'updateInstall']](args);
    eq(calls.length, 1, key + ' 应恰好发一次 fetch');
    eq(calls[0].method, 'POST', key + ' 应走 POST');
    eq(calls[0].url, route, key + ' 应打到对应端点');
    eq(calls[0].body, args, key + ' 请求体应为入参原文');
    eq(calls[0].headers['content-type'], 'application/json', key + ' content-type');
    eq(res.ok, true, key + ' 回包 ok');
    eq(res.snapshot, { job: null }, key + ' 拆出 snapshot');
    eq(res.manual, 'cmd', key + ' 拆出 manual');
    eq(res.receipt, { checkId: 'c1' }, key + ' 拆出 receipt');
  }
  // 回包不是信封 / 桥 403 / fetch 抛错：三种失败都要给出 ok=false + 能读的错误码，不抛
  respond = async () => ({ status: 200, body: { unexpected: true } });
  let res = await table[PHONE_NAMES.updateStatus]();
  eq(res.ok, false, '非信封回包应 ok=false');
  eq(res.error.code, 'bridge-bad-shape', '非信封回包的错误码');
  respond = async () => ({ status: 403, body: { ok: false, error: { code: 'forbidden', message: 'untrusted host' } } });
  res = await table[PHONE_NAMES.updateStatus]();
  eq(res.ok, false, '桥 403 应 ok=false');
  eq(res.error.code, 'forbidden', '桥 403 应透出宿主的错误码');
  respond = async () => { throw new Error('boom') };
  res = await table[PHONE_NAMES.updateStatus]();
  eq(res.ok, false, 'fetch 抛错应 ok=false（不往外抛）');
  eq(res.error.code, 'bridge-unreachable', 'fetch 抛错时的错误码');
  delete globalThis.fetch;
  ok('(d+) shim 真跑：三条电话各打对 POST 端点、拆对信封，三类失败都不抛');

  /* ── 4) 三条场景各自装一份临时宿主 ──
   * lib/index.js 是「能力建不起来就回 degraded / null」的语义，三条场景要各验一次
   * （正常 / 产物缺失 / 能力降级）。每份宿主住自己的目录，避免共用同一个 `./update.js`
   * 解析结果 —— 否则「换掉 update.js 再 import」会被模块缓存吃成同一个实例。
   */
  const hostCopy = readSrc('lib/index.js')
    .split('from "@deepseek-ai/dsh-storage-domain"').join('from "./dsh-storage-domain-stub.mjs"');
  const LOG_FAKE =
    'export const __logEvents = [];\n' +
    'export async function installLogCapability() {\n' +
    '  return { ok: true, log(event, fields) { __logEvents.push([event, fields]); return true } };\n' +
    '}\n';

  /** 装一份宿主到 dir；update.js 内容由调用方给（null = 不放，模拟产物缺失）。 */
  function installHost(dir, updateJs) {
    fs.mkdirSync(path.join(dir, 'log'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dsh-storage-domain-stub.mjs'),
      'export const defineDomain = (s) => s;\nexport const domainTable = (s) => ({ valueSchema: s });\n');
    fs.writeFileSync(path.join(dir, 'prompt-host.mjs'), hostCopy);
    fs.writeFileSync(path.join(dir, 'log', 'index.js'), LOG_FAKE);
    if (updateJs !== null) fs.writeFileSync(path.join(dir, 'update.js'), updateJs);
  }

  /* ── 4a) 场景一：正常能力（含「更新包 → 日志口」接线与依赖注入断言） ──
   * 假更新能力形状抄真包（loggedPhone 的三事件 + 六字段快照），把收到的入参记下来。
   * 日志口按宿主约定只吃 { logReady }（日志能力的 Promise），这里等它就绪后把事件记到
   * 真日志能力那本账上，好断言这条线真的通了；logReady 不是 Promise 就直接抛，防止
   * 宿主把入参接错却测成「能力缺席」。
   */
  const fakeLines = [
    'export const __seen = [];',
    'let logCap = null;',
    'const SNAPSHOT = { runningVersion: "0.1.7", installedVersion: "0.1.7", latestVersion: null, canInstall: false, blockedReason: "source-install", job: null };',
    'const phoneNames = ' + JSON.stringify(PHONE_NAMES) + ';',
    'const routeTable = ' + JSON.stringify(ROUTES) + ';',
    'const byRoute = { [routeTable.status]: phoneNames.updateStatus, [routeTable.check]: phoneNames.updateCheck, [routeTable.install]: phoneNames.updateInstall };',
    'export async function createUpdateCapability(options) {',
    '  if (!options.logReady || typeof options.logReady.then !== "function") {',
    '    throw new Error("宿主没把日志能力的 Promise（{ logReady }）传给 createUpdateCapability，实收键：" + Object.keys(options).join(","));',
    '  }',
    '  logCap = await options.logReady;',
    '  const fire = (event, fields) => { if (logCap && typeof logCap.log === "function") logCap.log(event, fields) };',
    '  const handlers = {',
    '    [phoneNames.updateStatus]: async (args) => {',
    '      __seen.push(["status", args]);',
    '      fire("host.call", { method: phoneNames.updateStatus, kind: "update-status", pluginId: "dsh-prompt" });',
    '      return { ok: true, snapshot: { ...SNAPSHOT }, manual: "dsh plugin --profile web add --save-exact dsh-prompt@0.1.8", receipt: null };',
    '    },',
    '    [phoneNames.updateCheck]: async (args) => {',
    '      __seen.push(["check", args]);',
    '      return { ok: true, snapshot: { ...SNAPSHOT }, manual: null, receipt: null };',
    '    },',
    '    [phoneNames.updateInstall]: async (args) => {',
    '      __seen.push(["install", args]);',
    '      fire("update.install.exec", { route: "cli", ok: true, exitCode: 0, durationMs: 1, pluginId: "dsh-prompt" });',
    '      return { ok: true, snapshot: { ...SNAPSHOT }, manual: null, receipt: { checkId: "c1" } };',
    '    },',
    '  };',
    '  return { ok: true, phoneNames, paths: routeTable, snapshotFields: ' + JSON.stringify(SNAPSHOT_FIELDS) + ',',
    '    async runRoute(path, args) {',
    '      const name = byRoute[path];',
    '      if (!name) return { ok: false, error: { code: "unknown-phone", message: path } };',
    '      return await handlers[name](args);',
    '    } };',
    '}',
  ];
  const DIR_OK = path.join(DIR, 'ok');
  installHost(DIR_OK, fakeLines.join('\n') + '\n');

  /* ── 4b) 场景二：产物缺失 ── */
  const DIR_MISSING = path.join(DIR, 'missing');
  installHost(DIR_MISSING, null);

  /* ── 4c) 场景三：产物在、但能力降级（更新包建不起来）── */
  const DIR_DEGRADED = path.join(DIR, 'degraded');
  installHost(DIR_DEGRADED,
    'export async function createUpdateCapability() {\n' +
    '  return { ok: false, reason: "dep-load-fail: simulated", phoneNames: {}, paths: {},\n' +
    '    async runRoute() { return { ok: false, error: "update-capability-unavailable", errorKind: "dep-load-fail: simulated" } } };\n' +
    '}\n');

  const host = await import(pathToFileURL(path.join(DIR_OK, 'prompt-host.mjs')).href);

  /* ── 5) fake DSH host ── */
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
    open: async () => ({
      table: (n) => tables[n],
      global: { get: () => ({ ...globalVal }), set: async (v) => { globalVal = { ...v } } },
    }),
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
  ok('宿主装配成功（lib/index.js 未因新增更新接线而炸）');

  /** 走一次注册表的处理器；dropHost 为 true 时模拟「非 loopback」请求（无 Host 头）。 */
  async function call(route, method, body, headers, dropHost) {
    const chunk = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const base = Object.assign({ host: '127.0.0.1:43120' }, headers || {});
    if (dropHost) delete base.host;
    return await drive(registered, route, method, chunk, base);
  }

  /** 把一次 HTTP 请求交给某份注册表（三条场景各自一份宿主，不能共用 registered）。 */
  async function drive(registration, route, method, chunk, headers) {
    const req = {
      method, url: route, headers,
      [Symbol.asyncIterator]: async function* () { if (chunk) yield chunk },
    };
    let status = 200; let text = '';
    const res = {
      set statusCode(v) { status = v }, get statusCode() { return status },
      writeHead: (s) => { status = s }, end: (d) => { text = d },
      setHeader: () => undefined,
    };
    await registration.handler(req, res);
    return { status, json: text ? JSON.parse(text) : null };
  }

  /* ── 6) (a) 三条路由可命中 ── */
  const seen = (await import(pathToFileURL(path.join(DIR_OK, 'update.js')).href)).__seen;
  seen.length = 0;
  for (const [key, route] of Object.entries(ROUTES)) {
    const out = await call(route, 'POST', { probe: key });
    eq(out.status, 200, key + ' 路由状态码');
    eq(out.json.ok, true, key + ' 路由回包 ok（实际回包 ' + JSON.stringify(out.json) + '）');
    eq(out.json.value.snapshot !== null, true, key + ' 路由带回快照');
    eq(seen[seen.length - 1], [key, { probe: key }], key + ' 路由落到对应电话且入参原样转交');
  }
  let out = await call(ROUTES.status, 'GET');
  eq(out.status, 404, 'GET 更新路由应落回既有 404');
  out = await call('/_dsh/dsh-prompt/update/nope', 'POST', {});
  eq(out.status, 404, '未知更新子路径应 404');
  out = await call('/_dsh/dsh-prompt/store', 'GET');
  eq(out.status, 200, '既有 store 路由未被更新接线破坏');
  eq(out.json.value.customs, [], '既有 store 快照仍为空');
  ok('(a) 三条更新路由可命中；既有路由与 404 语义未变');

  /* ── 7) (b) 六字段快照 + 与真实更新包对账 ── */
  // 真包验两件事：六字段口径（README 第 8 节）与失败回包形状（`loggedPhone` 的 error 是字符串）。
  // 后者决定 lib/index.js 那个信封是谁包的一层 —— 包这一层不能靠读代码猜，得断言。
  const realHostSrc = readSrc('node_modules/dsh-plugin-update/dist/host.js');
  const loggedPhoneBody = realHostSrc.slice(realHostSrc.indexOf('function loggedPhone'), realHostSrc.indexOf('function createHostUpdate'));
  // 失败回包：`return { ok: false, ...payload }`，payload 由 toUpdateErrorPayload 产出。
  if (!/return\s*\{\s*ok:\s*false\s*,\s*\.\.\.payload\s*\}/.test(loggedPhoneBody)) {
    fail('真实更新包 loggedPhone 失败回包不再是 { ok:false, ...payload }（形状变了，lib/index.js 的信封要跟着改）');
  }
  const toErrorBody = realHostSrc.slice(realHostSrc.indexOf('function toUpdateErrorPayload'), realHostSrc.indexOf('function manualOfEnv'));
  if (!/return\s*\{\s*error:\s*code\s*,\s*errorKind:\s*code\s*\}/.test(toErrorBody) || !/error:\s*"check-failed",\s*errorKind:\s*"internal"/.test(toErrorBody)) {
    fail('真实更新包错误载荷不再是 { error: <字符串>, errorKind: <字符串> }（lib/index.js 的信封要跟着改）');
  }
  const declaredResult = readSrc('src/update/dsh-plugin-update.d.ts');
  if (!/error\?:\s*string/.test(declaredResult)) fail('本仓对 UpdatePhoneResult.error 的声明应为 string');
  ok('包契约对账：loggedPhone 失败回包 { ok:false, error(字符串), errorKind } 与本仓声明一致');
  const realHost = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'host.js')).href);
  if (typeof realHost.createHostUpdate !== 'function') fail('dsh-plugin-update 的 createHostUpdate 应为函数');
  const serviceSrc = readSrc('node_modules/dsh-plugin-update/dist/service.js');
  const buildSnapshotBody = serviceSrc.slice(serviceSrc.indexOf('function buildSnapshot'), serviceSrc.indexOf('async function status'));
  const returnBlock = buildSnapshotBody.slice(buildSnapshotBody.indexOf('return {'));
  for (const field of SNAPSHOT_FIELDS) {
    if (!new RegExp('\\b' + field + '\\b').test(returnBlock)) {
      fail('真实更新包 buildSnapshot 的返回块里没有字段 ' + field + '（README 第 8 节的六字段口径变了？）');
    }
  }
  out = await call(ROUTES.status, 'POST', {});
  eq(Object.keys(out.json.value.snapshot).sort(), SNAPSHOT_FIELDS.slice().sort(), '快照字段集合');
  eq(typeof out.json.value.manual, 'string', '状态快照顺带的手工兜底命令');
  const declared = built.match(/SNAPSHOT_FIELDS\s*=\s*\[\s*([\s\S]*?)\]/);
  if (!declared) fail('lib/update.js 里找不到 SNAPSHOT_FIELDS 声明');
  eq([...declared[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]), SNAPSHOT_FIELDS, '宿主半声明的快照字段表');
  ok('(b) 状态快照六字段齐（并与真实更新包 buildSnapshot 的返回块对账）');

  /* ── 8) 更新包 → 日志口接线 ── */
  const logCap = await import(pathToFileURL(path.join(DIR_OK, 'log', 'index.js')).href);
  const events = logCap.__logEvents.map((e) => e[0]);
  if (!events.includes('host.call')) fail('更新包的电话调用没经日志口转交（缺 host.call）');
  if (!events.includes('update.install.exec')) fail('装更新事件没经日志口转交（缺 update.install.exec）');
  ok('更新包的 host.call / update.install.exec 经 logReady 转交日志能力');

  /* ── 8b) 日志能力的闸门对更新包三条事件的真实取舍（不吹牛：该丢的说清丢在哪）
   * 更新包报三条事件：host.call / host.call.fail / update.install.exec（各带 pluginId）。
   * 本仓的事件清单是字段白名单的唯一权威。这里**真跑一次闸门**，把账算清楚，
   * 而不是在报告里凭印象说「日志能定位」。
   */
  const { createEventGate } = await import(pathToFileURL(path.join(ROOT, 'lib', 'log', 'gate.js')).href);
  const manifest = JSON.parse(readSrc('event-list.dsh-prompt.json'));
  const gate = createEventGate(manifest, { pluginId: 'dsh-prompt' });
  const gateVerdict = {
    'host.call': gate.filter('host.call', { method: 'prompt.updateStatus', kind: 'update-status', pluginId: 'dsh-prompt' }),
    'host.call.fail': gate.filter('host.call.fail', { method: 'prompt.updateStatus', kind: 'update-status', errorHash: 'deadbeef', pluginId: 'dsh-prompt' }),
    'update.install.exec': gate.filter('update.install.exec', { route: 'cli', ok: true, exitCode: 0, durationMs: 12, pluginId: 'dsh-prompt' }),
  };
  eq(gateVerdict['host.call'].ok, false, 'host.call 未在清单里 → 整条丢弃（成功轨迹不落盘）');
  eq(gateVerdict['update.install.exec'].ok, false, 'update.install.exec 未在清单里 → 整条丢弃（安装轨迹不落盘）');
  eq(gateVerdict['host.call.fail'].ok, true, 'host.call.fail 在清单里 → 可落盘');
  eq(gateVerdict['host.call.fail'].fields, { method: 'prompt.updateStatus', kind: 'update-status', errorHash: 'deadbeef' },
    'host.call.fail 落盘字段：pluginId 被闸门丢弃');
  ok('(e) 更新事件落盘账：只有 host.call.fail 落盘（且 pluginId 被清单挡掉），另两条整条丢弃');

  /* ── 9) (c) 同源防护没被削弱 ── */
  const denyCases = [
    ['非 loopback（无 Host 头）', {}, true],
    ['跨站 sec-fetch-site', { 'sec-fetch-site': 'cross-site' }, false],
    ['跨 origin', { origin: 'http://evil.example.com' }, false],
    ['跨端口 origin', { origin: 'http://127.0.0.1:9999' }, false],
  ];
  for (const [label, headers, dropHost] of denyCases) {
    for (const [key, route] of Object.entries(ROUTES)) {
      const denied = await call(route, 'POST', {}, headers, dropHost);
      if (denied.status !== 403) fail(label + ' 打 ' + key + ' 路由应 403，实为 ' + denied.status);
    }
    const deniedStore = await call('/_dsh/dsh-prompt/store', 'GET', undefined, headers, dropHost);
    if (deniedStore.status !== 403) fail(label + ' 打既有 store 路由应 403，实为 ' + deniedStore.status);
  }
  out = await call(ROUTES.status, 'POST', {}, { origin: 'http://127.0.0.1:43120' });
  eq(out.status, 200, '同源 origin 应放行（防护没有变成一律拒绝）');
  out = await call(ROUTES.status, 'POST', {});
  eq(out.status, 200, '无 origin 的同源请求应放行');
  ok('(c) 同源防护未削弱：非 loopback / 跨站 / 跨 origin 一律 403，同源仍放行');

  /* ── 10) 更新能力建不起来时诚实失败 ──
   * lib/index.js 对更新能力是「建不起来只降级、不抛」的语义，这里用两条独立路径把它钉死：
   * 产物缺失（capability 为 null）与产物在但能力降级（回 update-capability-unavailable）。
   * 两条路径各用一份自己的宿主目录（见 4b / 4c），避免共用同一个 `./update.js` 解析结果
   * 被模块缓存吃成同一个实例 —— 这类「测了假路径却像测真路径」是回归脚本自己最容易骗自己的地方。
   */
  let registeredMissing = null;
  const ctxMissing = Object.assign({}, fakeCtx, { webServer: { register: (route) => { registeredMissing = route; return () => undefined } } });
  const hostMissing = await import(pathToFileURL(path.join(DIR_MISSING, 'prompt-host.mjs')).href);
  hostMissing.apply(ctxMissing, {});
  out = await drive(registeredMissing, ROUTES.status, 'POST', Buffer.from('{}'), { host: '127.0.0.1:43120' });
  eq(out.status, 200, '产物缺失时状态码仍 200（失败写在回包里）');
  eq(out.json.ok, false, '产物缺失时 ok=false（实际回包 ' + JSON.stringify(out.json) + '）');
  eq(out.json.error.code, 'update-capability-unavailable', '产物缺失时的错误码');
  out = await drive(registeredMissing, '/_dsh/dsh-prompt/store', 'GET', null, { host: '127.0.0.1:43120' });
  eq(out.status, 200, '产物缺失时既有路由照常工作');

  let registeredDegraded = null;
  const ctxDegraded = Object.assign({}, fakeCtx, { webServer: { register: (route) => { registeredDegraded = route; return () => undefined } } });
  const hostDegraded = await import(pathToFileURL(path.join(DIR_DEGRADED, 'prompt-host.mjs')).href);
  hostDegraded.apply(ctxDegraded, {});
  out = await drive(registeredDegraded, ROUTES.check, 'POST', Buffer.from('{}'), { host: '127.0.0.1:43120' });
  eq(out.status, 200, '能力降级时状态码仍 200');
  eq(out.json.ok, false, '能力降级时 ok=false（实际回包 ' + JSON.stringify(out.json) + '）');
  eq(out.json.error.code, 'update-capability-unavailable', '能力降级时的错误码');
  if (!String(out.json.error.message).includes('simulated')) fail('能力降级时应把真实原因透出来，实为 ' + JSON.stringify(out.json.error));
  out = await drive(registeredDegraded, '/_dsh/dsh-prompt/store', 'GET', null, { host: '127.0.0.1:43120' });
  eq(out.status, 200, '能力降级时既有路由照常工作');
  ok('更新能力缺席 / 降级 → 三条路由明确回 update-capability-unavailable，既有路由不受影响');

  /* ── 11) 真产物（lib/update.js）直跑：配置三要素、电话表、日志口、降级 ──
   * 这一段不看源码，直接 import 构建产物、注入假的包入口，验的是「真代码在这条路径上做什么」。
   */
  const builtMod = await import(pathToFileURL(path.join(ROOT, 'lib', 'update.js')).href);
  if (builtMod.PLUGIN_ID !== 'dsh-prompt' || builtMod.PHONE_PREFIX !== 'prompt' || builtMod.TARGET_PACKAGE_NAME !== 'dsh-prompt') {
    fail('产物里的三要素应为 dsh-prompt / prompt / dsh-prompt，实为 ' +
      [builtMod.PLUGIN_ID, builtMod.PHONE_PREFIX, builtMod.TARGET_PACKAGE_NAME].join(' / '));
  }
  eq(builtMod.SNAPSHOT_FIELDS, SNAPSHOT_FIELDS, '产物里的快照字段表');
  let captured = null;
  const fired = [];
  const fakePkg = {
    createHostUpdate(deps, config) {
      captured = { deps, config };
      return {
        phoneNames: { updateStatus: 'prompt.updateStatus', updateCheck: 'prompt.updateCheck', updateInstall: 'prompt.updateInstall' },
        handlers: { 'prompt.updateStatus': async () => ({ ok: true, snapshot: { job: null } }) },
      };
    },
  };
  const builtCap = await builtMod.createUpdateCapability({
    ctx: { get: () => undefined },
    logReady: Promise.resolve({ log: (event) => { fired.push(event); return true } }),
    hostUpdate: fakePkg,
  });
  eq(builtCap.ok, true, '真产物应建起能力');
  eq(captured.config, { pluginId: 'dsh-prompt', prefix: 'prompt', targetPackageName: 'dsh-prompt' }, '传给更新包的配置（其余走包默认值）');
  eq(Object.keys(captured.deps).sort(), ['ctx', 'logCtx'], '传给更新包的依赖键');
  eq(captured.deps.logCtx.fire('host.call', {}), undefined, '日志口 fire 应为同步无返回');
  if (!fired.includes('host.call')) fail('产物里的日志口没把事件转给日志能力');
  eq(await builtCap.runRoute(ROUTES.status, {}), { ok: true, snapshot: { job: null } }, '产物按路由转电话');
  const unknown = await builtCap.runRoute('/_dsh/dsh-prompt/update/nope', {});
  eq([unknown.ok, unknown.error], [false, 'unknown-phone'], '产物对未知路由的回包');
  const broken = await builtMod.createUpdateCapability({
    hostUpdate: { createHostUpdate() { throw new Error('unknown-profile') } },
  });
  eq([broken.ok, broken.reason], [false, 'unknown-profile'], '更新包建不起来时的降级原因');
  const brokenReply = await broken.runRoute(ROUTES.check, {});
  eq([brokenReply.ok, brokenReply.error, brokenReply.errorKind], [false, 'update-capability-unavailable', 'unknown-profile'], '降级回包的形状');
  ok('真产物直跑：三要素/六字段/日志口/按路由转电话/降级，全部对账');

  console.log('=== Test #39 PASS ===');
  process.exit(0);
})().catch((e) => { console.log('HARNESS-ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : String(e))); process.exit(3) });
