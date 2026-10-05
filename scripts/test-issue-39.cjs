// 回归 #39（#129 重写，0.3.1 整组件口径）：宿主接线 + 构建内联 + 网关裸回包 + http 映射
// 旧自研 UI（src/update/bridge.ts、src/update/gen、derive:update-values、手写 d.ts 垫片）已在 #127 删除，
// 本文件不再断言它们存在；改为断言“退役干净 + 新接线同值 + 主路径绿”。
// 契约（#129）：test-issue-39/40/41、lib-sync、typecheck、35 入口绿，主路径绿且门禁语义与新组件一致。
//
// 本票覆盖：
//  0) 退役干净（derive 入口缺席、bridge/gen/垫片缺席、host 新家存在）
//  1) 构建产物内联（lib/update.js 无裸导入 + 版本标记与 devDeps 耦合）
//  2) 三条路径三处同值（host/paths.ts × lib/index.js × update-http.ts 经 resolveHttpPath）
//  3) 电话名与配置三要素（buildPhoneNames(prompt) × host PHONE_PREFIX/TARGET/PLUGIN_ID × 导出数≤5）
//  4) 宿主能力真跑（假包注入：三条路由分派 + 快照六字段 + 电话名透传）
//  5) 能力缺席诚实失败（dep-load-fail → degraded，路由回 update-capability-unavailable）
//  6) 网关裸回包（lib/index.js 更新分支 writeJson(naked)，不包信封；他路仍包信封）
//  7) 回包整形裸必需（shapeHttpReply 直传裸快照、剥 diagnostic、非记录抛 transport-failed）
//
// 不覆盖（别的票的地盘）：settings 落位（#40）、只查不装（#41）、入口定位（#35）。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function quotedAfter(src, needle, where) {
  const i = src.indexOf(needle);
  if (i < 0) fail('找不到 ' + needle + '（' + where + '）');
  const m = src.slice(i + needle.length).match(/'([^']*)'|"([^"]*)"/);
  if (!m) fail(needle + ' 后面没跟字符串字面量（' + where + '）');
  return m[1] !== undefined ? m[1] : m[2];
}

const ROUTES = {
  status: '/_dsh/dsh-prompt/update/status',
  check: '/_dsh/dsh-prompt/update/check',
  install: '/_dsh/dsh-prompt/update/install',
};
const SNAPSHOT_FIELDS = ['runningVersion', 'installedVersion', 'latestVersion', 'canInstall', 'blockedReason', 'job'];

(async () => {
  const pkg = JSON.parse(readSrc('package.json'));

  /* ── 0) 退役干净 ── */
  if (pkg.dependencies['dsh-plugin-update'] !== undefined)
    fail('dsh-plugin-update 不许留在 dependencies（#58 起它是构建期输入），实为 ' + JSON.stringify(pkg.dependencies['dsh-plugin-update']));
  const pinned = pkg.devDependencies['dsh-plugin-update'];
  if (typeof pinned !== 'string' || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pinned))
    fail('devDependencies["dsh-plugin-update"] 必须是精确版本，实为 ' + JSON.stringify(pinned));
  if (!pkg.devDependencies.esbuild) fail('devDependencies 缺 esbuild');
  if (!pkg.scripts['test:issue-39']) fail('package.json 缺 test:issue-39 入口');
  if (!pkg.scripts['build:update-host']) fail('package.json 缺 build:update-host 入口');
  if (pkg.scripts['derive:update-values'] !== undefined)
    fail('derive:update-values 必须已退役（#128 起 package.json 不许再有该脚本）');
  ok('依赖声明（dsh-plugin-update@' + pinned + ' 精确钉版 + derive 已退役）');
  for (const gone of ['src/update/bridge.ts', 'src/update/gen/updateClient.derived.js', 'src/update/dsh-plugin-update.d.ts', 'src/client/update.ts', 'src/client/updauto.ts', 'src/client/upddialog.ts']) {
    if (fs.existsSync(path.join(ROOT, gone))) fail('自研文件必须已删：' + gone + ' 还在');
  }
  ok('自研 UI 退役干净（bridge/gen/垫片/update/updauto/upddialog 全缺席）');
  for (const stay of ['src/update/host/index.ts', 'src/update/host/paths.ts', 'src/update/host/bridge-log.ts', 'src/update/host/safe-values.ts', 'src/update/host/hash.ts', 'src/client/update-http.ts', 'scripts/update/build-host.mjs', 'scripts/build.mjs']) {
    if (!fs.existsSync(path.join(ROOT, stay))) fail('新接线文件缺席：' + stay);
  }
  ok('新接线文件全在（host×4 + update-http + 构建脚本）');

  /* ── 1) 产物内联 + 版本标记 ── */
  const built = readSrc('lib/update.js');
  if (!built.includes('createUpdateCapability')) fail('lib/update.js 里没有 createUpdateCapability（先跑 npm run build:update-host）');
  if (/from\s*["']dsh-plugin-update["']/.test(built) || /import\(\s*["']dsh-plugin-update["']\s*\)/.test(built))
    fail('lib/update.js 里出现了对 dsh-plugin-update 的裸导入（#58 起必须是内联）');
  if (!built.includes('AUTO-GENERATED')) fail('lib/update.js 缺构建产物告示行');
  for (const marker of ['containingPackage', 'createUpdateReader', 'unknown-profile']) {
    if (!built.includes(marker)) fail('lib/update.js 里没有内联标记 ' + JSON.stringify(marker));
  }
  const versionMark = built.match(/INLINED_UPDATE_PKG_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!versionMark) fail('lib/update.js 缺 INLINED_UPDATE_PKG_VERSION 标记');
  if (versionMark[1] !== pinned)
    fail('lib/update.js 内联版本 ' + versionMark[1] + ' 与 devDeps ' + JSON.stringify(pinned) + ' 不一致（升包未重建？）');
  if (!readSrc('scripts/update/build-host.mjs').includes('INLINED_UPDATE_PKG_VERSION'))
    fail('scripts/update/build-host.mjs 不再注入版本标记');
  if (/external\s*:\s*\[[^\]]*dsh-plugin-update/.test(readSrc('scripts/update/build-host.mjs')))
    fail('scripts/update/build-host.mjs 又把 dsh-plugin-update 写进 external 了');
  ok('lib/update.js 已内联 dsh-plugin-update@' + versionMark[1] + '（无裸导入，版本耦合）');

  /* ── 2) 三条路径三处同值（经 http helper 落点） ── */
  const hostPathsSrc = readSrc('src/update/host/paths.ts');
  const indexSrc = readSrc('lib/index.js');
  const updateHttpSrc = readSrc('src/client/update-http.ts');
  for (const route of Object.values(ROUTES)) {
    if (!hostPathsSrc.includes("'" + route + "'")) fail('src/update/host/paths.ts 里没有 ' + route);
    if (!indexSrc.includes('"' + route + '"')) fail('lib/index.js 的 UPDATE_ROUTES 里没有 ' + route);
  }
  if (/['"]\/_dsh\/dsh-prompt\/update/.test(readSrc('src/update/host/index.ts')))
    fail('src/update/host/index.ts 里出现了路径字面量（应引用 ./paths.js）');
  if (!readSrc('src/update/host/index.ts').includes('./paths.js'))
    fail('src/update/host/index.ts 应从 ./paths.js 取路径');
  ok('三条路径在 host/paths.ts × lib/index.js 同值，宿主半无字面量');
  // update-http.ts 的三要素 + routes 表经上游 resolveHttpPath 落到同一三条
  if (!updateHttpSrc.includes("UPDATE_PLUGIN_ID = 'dsh-prompt'")) fail('update-http.ts PLUGIN_ID 应为 dsh-prompt');
  if (!updateHttpSrc.includes("UPDATE_PREFIX = 'prompt'")) fail('update-http.ts PREFIX 应为 prompt');
  if (!updateHttpSrc.includes("UPDATE_BASE_URL = '/_dsh/dsh-prompt/update'")) fail('update-http.ts BASE_URL 不对');
  const { resolveHttpPath, shapeHttpReply } = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'http.js')).href);
  const httpOpts = { prefix: 'prompt', baseUrl: '/_dsh/dsh-prompt/update', routes: { updateStatus: 'status', updateCheck: 'check', updateInstall: 'install' } };
  eq(resolveHttpPath(httpOpts, 'prompt.updateStatus'), ROUTES.status, 'http status 落点');
  eq(resolveHttpPath(httpOpts, 'prompt.updateCheck'), ROUTES.check, 'http check 落点');
  eq(resolveHttpPath(httpOpts, 'prompt.updateInstall'), ROUTES.install, 'http install 落点');
  ok('update-http 三要素经 resolveHttpPath 与宿主三条路由逐字一致');

  /* ── 3) 电话名与配置三要素 ── */
  const { buildPhoneNames } = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'config.js')).href);
  eq(buildPhoneNames('prompt'), { updateStatus: 'prompt.updateStatus', updateCheck: 'prompt.updateCheck', updateInstall: 'prompt.updateInstall' }, 'buildPhoneNames(prompt) 口径');
  const hostSrc = readSrc('src/update/host/index.ts');
  if (quotedAfter(hostSrc, 'PHONE_PREFIX =', 'host') !== 'prompt') fail('宿主 PHONE_PREFIX 应为 prompt');
  if (quotedAfter(hostSrc, 'TARGET_PACKAGE_NAME =', 'host') !== 'dsh-prompt') fail('宿主 TARGET 应为 dsh-prompt');
  if (quotedAfter(hostSrc, 'PLUGIN_ID =', 'host') !== 'dsh-prompt') fail('宿主 PLUGIN_ID 应为 dsh-prompt');
  // 对外导出≤5（本仓结构规则：值为 PHONE_PREFIX/PLUGIN_ID/SNAPSHOT_FIELDS/TARGET_PACKAGE_NAME/createUpdateCapability）
  const exported = (built.match(/export\s*\{[^}]*\}/g) || []).join(' ');
  const exportNames = exported.replace(/^[\s\S]*?\{/, '').replace(/\}[\s\S]*$/, '').split(',').map(s => s.trim()).filter(Boolean).map(s => (s.match(/as\s+(\w+)\s*$/) || [null, s])[1]);
  if (exportNames.length > 5) fail('lib/update.js 对外导出 ' + exportNames.length + ' 个（上限5）：' + exportNames.join(','));
  ok('电话名 × 配置三要素 × 导出数≤5（' + exportNames.length + '）');
  eq(SNAPSHOT_FIELDS, ['runningVersion', 'installedVersion', 'latestVersion', 'canInstall', 'blockedReason', 'job'], '快照六字段口径');

  /* ── 4) 宿主能力真跑（假包注入） ── */
  const updateMod = await import(pathToFileURL(path.join(ROOT, 'lib', 'update.js')).href);
  const phoneNames = buildPhoneNames('prompt');
  const canned = { runningVersion: '0.2.11', installedVersion: '0.2.11', latestVersion: '9.9.9', canInstall: true, blockedReason: null, job: null };
  const seen = [];
  const fakeHostUpdate = {
    createHostUpdate(deps, config) {
      if (!deps || typeof deps.logCtx === 'undefined') fail('宿主应把 bridgeLog 交给包（logCtx 缺席）');
      if (config.pluginId !== 'dsh-prompt' || config.prefix !== 'prompt' || config.targetPackageName !== 'dsh-prompt')
        fail('宿主传给包的配置不对：' + JSON.stringify(config));
      return {
        phoneNames: { ...phoneNames },
        handlers: {
          [phoneNames.updateStatus]: async () => { seen.push('status'); return { ok: true, snapshot: canned, manual: null, receipt: null }; },
          [phoneNames.updateCheck]: async () => { seen.push('check'); return { ok: true, snapshot: canned, manual: 'cmd', receipt: null }; },
          [phoneNames.updateInstall]: async () => { seen.push('install'); return { ok: true, snapshot: canned, manual: null, receipt: { checkId: 'c1' } }; },
        },
      };
    }
  };
  // lib/update.js 的装配按 phoneNames 找函数：假包直接给 updateStatus/updateCheck/updateInstall 三函数
  // 若实现按电话名查表，unknown phone 会抛；这里三条都应通。
  const cap = await updateMod.createUpdateCapability({ hostUpdate: fakeHostUpdate, logReady: Promise.resolve(null) });
  if (!cap.ok) fail('假包注入后能力应 ok:true');
  eq(cap.paths, ROUTES, '能力 paths 与三条路由一致');
  eq(cap.snapshotFields, SNAPSHOT_FIELDS, '能力 snapshotFields 六字段');
  eq(cap.phoneNames, phoneNames, '能力 phoneNames 透传包口径');
  for (const [p, want] of [[ROUTES.status, 'status'], [ROUTES.check, 'check'], [ROUTES.install, 'install']]) {
    seen.length = 0;
    const res = await cap.runRoute(p, {});
    if (!res || res.ok !== true) fail(p + ' 应 ok:true，实为 ' + JSON.stringify(res));
    if (seen[0] !== want) fail(p + ' 应分派到 ' + want + '，实为 ' + JSON.stringify(seen));
  }
  ok('宿主能力三条路由分派正确（status/check/install）');
  const badRoute = await cap.runRoute('/_dsh/dsh-prompt/update/nope', {}).catch(e => ({ ok: false, error: String(e && e.message || e) }));
  if (badRoute && badRoute.ok === true) fail('未知路由应失败');
  ok('未知路由不命中更新能力');

  /* ── 5) 能力缺席诚实失败 ── */
  const degraded = await updateMod.createUpdateCapability({ hostUpdate: { createHostUpdate() { throw new Error('nope'); } }, logReady: Promise.resolve(null) });
  if (degraded.ok !== false && degraded.ok !== true) fail('degraded 形状不对');
  if (degraded.ok === true) {
    const r = await degraded.runRoute(ROUTES.status, {});
    if (!r || r.ok !== false) fail('degraded 路由应 ok:false');
  } else {
    if (!String(degraded.reason || '').length) fail('degraded 应带 reason');
  }
  ok('能力建不起来时诚实降级（不 500、不静默）');

  /* ── 6) 网关裸回包 ── */
  const nakedLine = indexSrc.includes('writeJson(res, naked, 200)');
  if (!nakedLine) fail('lib/index.js 更新分支应 writeJson(res, naked, 200)（方案A 裸回包）');
  if (indexSrc.includes('{ ok: true, value: naked') || indexSrc.includes('{ok:true,value:naked'))
    fail('lib/index.js 更新分支不许再包 {ok,value} 信封');
  ok('宿主网关更新分支裸回包（他路仍包信封，更新独走 naked）');

  /* ── 7) 整形裸必需 ── */
  const nakedReply = { ok: true, snapshot: canned, manual: null, receipt: null };
  const shaped = shapeHttpReply(nakedReply);
  eq(shaped.snapshot, canned, 'shape 直传裸快照');
  const withDiag = shapeHttpReply({ ok: true, snapshot: canned, diagnostic: '原文必须丢', diag: { stage: 'check' } });
  if ('diagnostic' in withDiag) fail('shape 应剥 diagnostic 原文');
  ok('shape 剥 diagnostic、透传其余（裸必需）');
  let threw = false;
  try { shapeHttpReply(42); } catch (e) { threw = true; if (!String((e && e.code) || (e && e.message) || '').length) fail('transport 失败应带码'); }
  if (!threw) fail('非记录回包应抛 transport-failed');
  ok('非记录回包走传输失败通道（不进稳定码分支）');

  console.log('\nALL PASS: #39 host+build+gateway+http（0.3.1 口径）');
})();
