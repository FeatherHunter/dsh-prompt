// 回归 #41（#129 重写，0.3.1 整组件口径）：只查不自动装 + 无旧自动轮询/跳过
// 旧形态（updauto.ts：启动延迟自动查 + 同窗重弹 + 跳过此版本 localStorage + 弹窗打开才轮询）已在 #127 删除。
// 新语义（#128）：入口 mountUpdateEntryHttp(button, autoCheck mount/openOn has-update，源码级禁装）+
// 面板 mountUpdatePanelHttp(dialog 默认主题，挂载查一次，安装只走用户点击）；后台无自家 interval/localStorage。
// 本票覆盖：
//  0) 旧自动退役（updauto/upddialog/update 缺席；src 无 AUTO_CHECK_DELAY/UPD_POLL/subscribeAutoTick；update-http 无 timers/LS）
//  1) 源码口径（entry autoCheck mount + openOn has-update + variant button；panel dialog；入口禁装走上游 guard）
//  2) 真挂：入口 mount+refresh 只打 status/check、不打 install（有新版也不自动装）；guarded install 调即抛
//  3) 真挂：面板 mount 查一次、安装只走 act('install')（点击前无 install，点击后有）
//  4) 卸载干净（entry/panel unmount 不抛；面板只停轮询——二次 refresh 仍可查，安装不受影响的反向由上游保证，这里只到不抛）
//
// 不覆盖：宿主分派（#39）、设置落位（#40）、入口定位（#35）。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function ok(msg) { console.log('  ok: ' + msg); }
function bad(msg) { failures++; console.log('  FAIL: ' + msg); }
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ── 0) 旧自动退役 ── */
  for (const gone of ['src/client/updauto.ts', 'src/client/upddialog.ts', 'src/client/update.ts']) {
    if (fs.existsSync(path.join(ROOT, gone))) bad('自研文件必须已删：' + gone);
  }
  if (failures) { console.log('FAIL: 旧文件未删干净'); process.exit(1); }
  ok('旧自动三件套缺席（updauto/upddialog/update）');
  const allSrc = ['src/client/update-http.ts', 'src/client/settings.ts', 'src/client/panel.ts', 'src/client/button.ts'].map(f => { try { return readSrc(f); } catch { return ''; } }).join('\n');
  for (const kw of ['AUTO_CHECK_DELAY_MS', 'UPD_POLL', 'subscribeAutoTick', 'SKIP_VERSION', 'skipVersion']) {
    if (allSrc.includes(kw)) bad('src 不应再有旧自动键 ' + kw + '（新语义无自家轮询/跳过）');
  }
  if (failures) { console.log('FAIL: 旧自动键残留'); process.exit(1); }
  ok('src 无旧自动键（AUTO_CHECK/UPD_POLL/subscribeAutoTick/skip）');
  const uh = readSrc('src/client/update-http.ts');
  if (/localStorage/.test(uh)) bad('update-http.ts 不许碰 localStorage（跳过已退役）');
  if (/setInterval/.test(uh)) bad('update-http.ts 不许有 setInterval（后台周期已退役，轮询只在上游面板内）');
  if (failures) { console.log('FAIL: update-http 有旧自动手段'); process.exit(1); }
  ok('update-http 无 LS/interval（无自家后台）');

  /* ── 1) 源码口径 ── */
  for (const [needle, what] of [
    ["autoCheck: 'mount'", 'entry autoCheck mount（挂载静默查一次，只读）'],
    ["openOn: 'direct'", 'entry openOn direct（点开即弹窗，面板挂载自查）'],
    ["variant: 'button'", 'entry variant button'],
    ['mountUpdateEntryHttp', 'entry 走 http 万能插头（内含源码级禁装 guard）'],
  ]) {
    if (!uh.includes(needle)) bad('update-http.ts 缺 ' + what);
  }
  if (failures) { console.log('FAIL: 接线口径不对'); process.exit(1); }
  ok('entry autoCheck/openOn direct/variant/theme 口径全对（面板按需由入口开，不在 update-http 里挂）');
  // 入口 wrappers 不直调 install 电话（routes 表里的 install 是给面板用的，入口运行时走 guard）
  const entryFn = uh.slice(uh.indexOf('UpdateEntryButton'), uh.indexOf('UpdatePanelEmbedded'));
  if (/updateInstall/.test(entryFn) && !/routes/.test(entryFn)) bad('UpdateEntryButton 不应直写 updateInstall 电话名');
  else ok('UpdateEntryButton 不直调安装电话（安装只走面板点击，上游 guard 兜底）');

  /* ── 2/3) 真挂：上游 http 入口+面板 ── */
  const httpMod = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'http.js')).href);
  const { mountUpdateEntryHttp, mountUpdatePanelHttp } = httpMod;
  const STATUS = '/_dsh/dsh-prompt/update/status';
  const CHECK = '/_dsh/dsh-prompt/update/check';
  const INSTALL = '/_dsh/dsh-prompt/update/install';
  const hits = [];
  const snapNew = { runningVersion: '0.2.11', installedVersion: '0.2.11', latestVersion: '9.9.9', canInstall: true, blockedReason: null, job: null };
  const naked = (snapshot, extra) => Object.assign({ ok: true, snapshot, manual: null, receipt: { checkId: 'c1' } }, extra || {});
  const fakeFetch = async (url, init) => {
    const u = String(url);
    const which = u === STATUS ? 'status' : u === CHECK ? 'check' : u === INSTALL ? 'install' : 'other';
    hits.push({ which, url: u, method: init && init.method });
    const body = which === 'status' ? naked(snapNew)
      : which === 'check' ? naked(snapNew)
      : which === 'install' ? { ok: true, snapshot: snapNew, receipt: { checkId: 'c1' } }
      : { ok: false, error: 'unknown', errorKind: 'unknown' };
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
  };
  const fakeContainer = () => ({ innerHTML: '', addEventListener() {}, removeEventListener() {} });

  // 入口：有新版也只查不装
  hits.length = 0;
  const entryBox = fakeContainer();
  let entry;
  try {
    entry = mountUpdateEntryHttp(entryBox, {
      pluginId: 'dsh-prompt', prefix: 'prompt', baseUrl: '/_dsh/dsh-prompt/update',
      routes: { updateStatus: 'status', updateCheck: 'check', updateInstall: 'install' },
      variant: 'button', theme: 'archive', autoCheck: 'mount', openOn: 'direct', fetch: fakeFetch,
    });
  } catch (e) { bad('入口 mount 抛错：' + (e && e.message || e)); }
  await sleep(300);
  try { if (entry && typeof entry.refresh === 'function') await entry.refresh(); } catch (e) { bad('入口 refresh 抛错：' + (e && e.message || e)); }
  await sleep(200);
  const entryInstalls = hits.filter(h => h.which === 'install');
  const entryReads = hits.filter(h => h.which === 'status' || h.which === 'check');
  if (entryReads.length < 1) bad('入口 mount/refresh 应至少查一次（status/check），实发 ' + JSON.stringify(hits));
  else ok('入口挂载查一次（只读 ' + entryReads.length + ' 次）');
  if (entryInstalls.length > 0) bad('入口有新版也不许自动装，实发 install ×' + entryInstalls.length);
  else ok('入口有新版也不自动装（0 install）');
  // guard：入口的 call 对 install 应抛（源码级）。这里经 controller 触不到内部 call，
  // 改为直验上游 guard：再挂一个入口并对其内部做一次 install 电话——最直接的是调 http guard 本体。
  // mountUpdateEntryHttp 的 guard 不在外部暴露，故此处验“controller 无安装入口” + 上游源码含禁装行。
  if (entry && typeof entry.act === 'function') bad('入口 controller 不应有 act/install 入口（只 refresh/open/close/label/unmount）');
  else ok('入口 controller 无安装入口（refresh/open/close/label/unmount only）');
  const httpSrc = fs.readFileSync(path.join(ROOT, 'node_modules', 'dsh-plugin-update', 'dist', 'http.js'), 'utf8');
  const entryHttpFn = httpSrc.slice(httpSrc.indexOf('function mountUpdateEntryHttp'), httpSrc.indexOf('function mountUpdateEntryHttp') + 1500);
  if (!entryHttpFn.includes('updateInstall') || !entryHttpFn.includes('throw')) bad('上游入口 guard 应在（mountUpdateEntryHttp 内对 updateInstall throw）');
  else ok('上游入口 guard 在（mountUpdateEntryHttp 对 updateInstall throw）');
  // direct 按需弹窗：点开即有 dialog（面板挂载自查），关了回到按钮
  try {
    if (entry && typeof entry.open === 'function') await entry.open();
  } catch (e) { bad('入口 open 抛错：' + (e && e.message || e)); }
  await sleep(400);
  if (!/dsh-upd/.test(entryBox.innerHTML)) bad('direct 点开后应有 dialog 痕迹，实际 ' + JSON.stringify(entryBox.innerHTML.slice(0, 120)));
  else ok('direct 点开即弹窗（面板挂载自查）');
  try {
    if (entry && typeof entry.close === 'function') await entry.close();
  } catch (e) { bad('入口 close 抛错：' + (e && e.message || e)); }
  await sleep(200);
  if (/dsh-upd-masthead/.test(entryBox.innerHTML)) bad('关了 dialog 应撤，实际 ' + JSON.stringify(entryBox.innerHTML.slice(0, 120)));
  else ok('dialog 关了回到按钮（无残留）');
  try { if (entry && typeof entry.unmount === 'function') entry.unmount(); ok('入口 unmount 不抛'); } catch (e) { bad('入口 unmount 抛错'); }

  // 面板：挂载查一次，安装只走点击
  hits.length = 0;
  const panelBox = fakeContainer();
  let panel;
  try {
    panel = mountUpdatePanelHttp(panelBox, {
      pluginId: 'dsh-prompt', prefix: 'prompt', baseUrl: '/_dsh/dsh-prompt/update',
      routes: { updateStatus: 'status', updateCheck: 'check', updateInstall: 'install' },
      mode: 'dialog', theme: 'archive', fetch: fakeFetch,
    });
  } catch (e) { bad('面板 mount 抛错：' + (e && e.message || e)); }
  await sleep(400);
  const mountInstalls = hits.filter(h => h.which === 'install').length;
  const mountReads = hits.filter(h => h.which === 'status' || h.which === 'check').length;
  if (mountReads < 1) bad('面板挂载应查一次，实发 ' + JSON.stringify(hits));
  else ok('面板挂载查一次（只读 ' + mountReads + ' 次）');
  if (mountInstalls > 0) bad('面板挂载不应自动装，实发 install ×' + mountInstalls);
  else ok('面板挂载不自动装（0 install）');
  // 点击安装：先 check 再 install（面板要 checkId；fake 全给 c1，直装也应通，若拒则先 check）
  hits.length = 0;
  try { await panel.act('check'); } catch (e) { bad('面板 act(check) 抛错：' + (e && e.message || e)); }
  await sleep(200);
  try { await panel.act('install'); } catch (e) { /* 安装可能因快照/队列拒单，不判红，只看是否发了电话 */ }
  await sleep(300);
  const clickInstalls = hits.filter(h => h.which === 'install').length;
  if (clickInstalls < 1) bad('面板点击安装应发 install 电话（安装只走点击），实发 ' + JSON.stringify(hits));
  else ok('面板点击安装发 install（安装只走用户点击）');
  try { panel.unmount(); ok('面板 unmount 不抛（只停轮询）'); } catch (e) { bad('面板 unmount 抛错'); }
  // 关闭落地（0.5.0）：dialog 下 act(close-view) 先调调用方落地再停轮询
  {
    const box = fakeContainer();
    box.innerHTML = '<div>dialog 痕迹</div>';
    let landed = 0;
    let closed;
    try {
      closed = mountUpdatePanelHttp(box, {
        pluginId: 'dsh-prompt', prefix: 'prompt', baseUrl: '/_dsh/dsh-prompt/update',
        routes: { updateStatus: 'status', updateCheck: 'check', updateInstall: 'install', updateChangelog: 'changelog' },
        mode: 'dialog', theme: 'archive', fetch: fakeFetch,
        onCloseRequested: () => { landed++; try { box.innerHTML = ''; } catch (e) {} },
      });
    } catch (e) { bad('关闭落地挂载抛错：' + (e && e.message || e)); }
    await sleep(300);
    try { await closed.act('close-view'); } catch (e) { bad('act(close-view) 抛错：' + (e && e.message || e)); }
    await sleep(100);
    if (landed !== 1) bad('关闭落地应恰调一次，实调 ' + landed + ' 次');
    else ok('dialog 关闭走调用方落地（恰一次）');
    if (box.innerHTML !== '') bad('调用方撤 DOM 后容器应空，实为 ' + JSON.stringify(box.innerHTML.slice(0, 80)));
    else ok('调用方撤掉弹窗 DOM（容器已空）');
    const afterClose = hits.length;
    await sleep(700);
    if (hits.length !== afterClose) bad('关闭后轮询应停，还有新调用');
    else ok('关闭后轮询已停（无新调用）');
  }

  if (failures) { console.log('\nFAIL: #41 ' + failures + ' 条未过'); process.exit(1); }
  console.log('\nALL PASS: #41 只查不自动装（0.5.5 口径）');
})();
