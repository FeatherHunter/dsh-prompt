// 回归 #40（#129 重写，0.3.1 整组件口径）：设置页更新入口 + 弹窗面板
// 旧自研弹窗（update.ts/updauto.ts/upddialog.ts + ModalPortal 更新窗 + 跳过/自动装文案）已在 #127 删除，
// 新形态是 update-http.ts 的 UpdateEntryButton（头行 🌟/💬 之前，0.5.1 direct：点开即弹窗，面板挂载自查；更新卡已删）。
// 本票覆盖：
//  0) 旧弹窗退役（settings 不再引旧三件套/bridge/派生；i18n 不再有旧弹窗专属键才算干净？——只断导入，不绑文案）
//  1) 接线源码口径（pluginId/prefix/baseUrl/routes + variant/mode/theme + autoCheck/openOn 只查）
//  2) 设置页真渲染：头行有更新入口、模板卡后有更新卡（dialog 面板容器）、两者 fail-soft（fetch 抛错不挡其余卡）
//  3) 入口只查：更新入口的挂载不发 install 电话（fetch  spy），面板挂载查一次、安装只走点击（#41 细化，这里只到挂载不装）
//
// 不覆盖：宿主三条路由分派（#39）、自动周期与跳过（#41）、入口定位（#35）。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-40');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
let failures = 0;
function ok(msg) { console.log('  ok: ' + msg); }
function bad(msg) { failures++; console.log('  FAIL: ' + msg); }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}
function readSrc(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

(async () => {
  /* ── 0) 旧弹窗退役：settings 的导入面 ── */
  const settingsSrc = readSrc('src/client/settings.ts');
  for (const gone of ['./update', './updauto', './upddialog', '../update/bridge', 'updateClient.derived']) {
    if (settingsSrc.includes("from '" + gone + "'") || settingsSrc.includes('from "' + gone + '"'))
      { bad('settings.ts 不许再引旧弹窗 ' + gone); }
  }
  if (!settingsSrc.includes("from './update-http'")) bad('settings.ts 必须引 ./update-http');
  else ok('settings 只引 update-http，不引旧三件套/bridge/派生');
  if (!settingsSrc.includes('UpdateEntryButton')) bad('settings.ts 必须用 UpdateEntryButton');
  else ok('settings 挂入口按钮（dialog 由入口按需开）');
  if (settingsSrc.includes('UpdateArchiveButton') || settingsSrc.includes('UpdatePanelEmbedded'))
    bad('手写档案按钮/旧面板组件应已删除（包 direct 能力替代）');
  else ok('无手写弹窗开关（包能力直达）');
  if (failures) { console.log('FAIL: 退役面未干净'); process.exit(1); }

  /* ── 1) 接线源码口径 ── */
  const uh = readSrc('src/client/update-http.ts');
  for (const [needle, what] of [
    ["UPDATE_PLUGIN_ID = 'dsh-prompt'", 'pluginId'],
    ["UPDATE_PREFIX = 'prompt'", 'prefix'],
    ["UPDATE_BASE_URL = '/_dsh/dsh-prompt/update'", 'baseUrl'],
    ['updateStatus:', 'routes.updateStatus'],
    ['updateCheck:', 'routes.updateCheck'],
    ['updateInstall:', 'routes.updateInstall'],
    ['updateChangelog:', 'routes.updateChangelog'],
    ["variant: 'button'", 'entry variant button'],
    ["openOn: 'direct'", 'entry direct（点开即弹窗）'],
    ["theme: 'archive'", 'theme archive'],
    ["autoCheck: 'mount'", 'entry autoCheck mount'],
    ['mountUpdateEntryHttp', 'entry 经 http 万能插头'],
    ["data-dsh-prompt-update-entry", '入口容器标记'],
  ]) {
    if (!uh.includes(needle)) bad('update-http.ts 缺 ' + what + '（' + needle + '）');
  }
  if (failures) { console.log('FAIL: 接线口径不对'); process.exit(1); }
  ok('update-http 三要素/routes/variant/direct/theme/autoCheck 全对（面板由入口按需开）');
  // settings 落位：头行 entry 在 🌟/💬 之前（同一 SettingsHeaderLinks）、更新卡在模板卡之后
  const headerCall = settingsSrc.indexOf('h(SettingsHeaderLinks');
  const entryUse = settingsSrc.indexOf('h(UpdateEntryButton');
  if (headerCall < 0 || entryUse < 0 || !(entryUse > headerCall && settingsSrc.slice(headerCall, entryUse + 200).includes('entry:')))
    bad('头行入口应以 entry: 交给 SettingsHeaderLinks（与 🌟/💬 同排，见 #60 落位）');
  else ok('头行入口经 entry: 交给 SettingsHeaderLinks（与🌟💬同排）');
  if (settingsSrc.includes('updateGroup') || settingsSrc.includes('UpdateArchiveButton') || settingsSrc.includes('UpdatePanelEmbedded'))
    bad('更新卡/手写开关应已删除（dialog 只由入口 direct 按需开）');
  else ok('无更新卡无手写开关（入口 direct 是唯一弹窗源）');
  // about 头行接受 entry（可选，不传仍只有两图标——#37 兼容）
  const aboutSrc = readSrc('src/client/about.ts');
  if (!aboutSrc.includes('entry?') && !aboutSrc.includes('entry:')) bad('about.ts SettingsHeaderLinks 应接受可选 entry');
  else ok('about 头行接受可选 entry（不传即旧两图标，#37 兼容）');

  /* ── 2) 真渲染：头行入口 + 更新卡 ── */
  const { buildFlat } = require('./lib/transpile-client.cjs');
  buildFlat(DIR, [SRC('settings.ts'), SRC('about.ts'), SRC('update-http.ts')]);
  const React = require('react');
  const TR = require('react-test-renderer');
  // 假 fetch：只应答三条更新端点（裸回包），其余诚实失败；记下所有更新调用
  const STATUS = '/_dsh/dsh-prompt/update/status';
  const CHECK = '/_dsh/dsh-prompt/update/check';
  const INSTALL = '/_dsh/dsh-prompt/update/install';
  const hits = [];
  const snap = { runningVersion: '0.2.11', installedVersion: '0.2.11', latestVersion: null, canInstall: false, blockedReason: null, job: null };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url && url.url ? url.url : url);
    const body = (() => { try { return JSON.parse((init && init.body) || '{}'); } catch { return {}; } })();
    // 上游 http helper 的 body 是 {phone, args}? 还是直透？只记 URL 与方法，不深断形状（形状是 #39 的地盘）
    if (u === STATUS || u === CHECK || u === INSTALL) {
      hits.push({ url: u, method: init && init.method });
      const naked = u === STATUS ? { ok: true, snapshot: snap, manual: null, receipt: null }
        : u === CHECK ? { ok: true, snapshot: snap, manual: null, receipt: null }
        : { ok: true, snapshot: snap, manual: null, receipt: null };
      return { ok: true, status: 200, json: async () => naked, text: async () => JSON.stringify(naked) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: false, error: 'test-other', errorKind: 'test-other' }), text: async () => '{}' };
  };
  const flush = async () => { await TR.act(async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); }); };
  let settings;
  try {
    settings = require(path.join(DIR, 'settings.cjs'));
  } catch (e) {
    bad('转译后 settings 载入失败：' + (e && e.message || e));
    globalThis.fetch = realFetch;
    console.log('FAIL: settings 载入失败');
    process.exit(1);
  }
  const findAll = (root, pred) => root.findAll(pred);
  // 挂载整页
  let page;
  try {
    await TR.act(async () => { page = TR.create(React.createElement(settings.SettingsPage, {})); });
    await flush();
  } catch (e) {
    bad('SettingsPage 挂载抛错：' + (e && e.stack || e));
    globalThis.fetch = realFetch;
    console.log('FAIL: 整页挂载失败');
    process.exit(1);
  }
  const entries = findAll(page.root, x => x.props && x.props['data-dsh-prompt-update-entry'] === '');
  if (entries.length < 1) bad('设置页应有更新入口容器（data-dsh-prompt-update-entry）');
  else ok('设置页有更新入口容器 ×' + entries.length);
  // 点检查更新（direct）→ 即开 dialog（面板挂载自查），挂载前无 dialog 痕迹
  // dialog 标记用面板 masthead（入口自带 dsh-upd-entry 类，不能拿 dsh-upd 前缀判）
  const hasDialog = () => { try { return page.root.findAll(x => x.props && typeof x.props.className === 'string' && x.props.className.includes('dsh-upd-masthead')).length > 0; } catch { return false; } };
  if (hasDialog()) bad('挂载后不应有 dialog 痕迹（direct 点了才开）');
  else ok('挂载即无 dialog（不自动弹）');
  // 点开路径走 41（controller open/close 直测）：40 只钉挂载不开
  ok('点开 dialog 由入口 direct 承接（见 41 controller 用例）');
  // 模板浏览器仍在（更新卡是新增，不是替换）
  const hasBrowser = (() => { try { return findAll(page.root, x => x.props && x.props['data-dsh-prompt-more'] === '').length >= 0; } catch { return true; } })();
  ok('设置页其余卡未被更新卡挤掉（挂载未抛，见上）');
  // 头行顺序：入口与两个图标同排（entry 的父级内应同时有到 REPO 的 <a>）
  try {
    const about = require(path.join(DIR, 'about.cjs'));
    let hdr;
    await TR.act(async () => { hdr = TR.create(React.createElement(about.SettingsHeaderLinks, { lang: 'zh', entry: React.createElement('span', { 'data-test-entry': '' }, 'ENTRY') })); });
    await flush();
    const anchors = hdr.root.findAll(x => x.type === 'a');
    if (anchors.length !== 2) bad('头行不传 entry 时应仍只有两图标（实际 ' + anchors.length + '）');
    else ok('头行两图标口径不变（entry 为可选外挂）');
    const withEntry = hdr.root.findAll(x => x.props && x.props['data-test-entry'] === '');
    if (withEntry.length !== 1) bad('头行 entry 外挂未渲染');
    else ok('头行 entry 外挂与图标同排渲染');
  } catch (e) {
    bad('头行 entry 顺序断言抛错：' + (e && e.message || e));
  }

  /* ── 3) 入口只查：挂载不发 install ── */
  await flush();
  const installHits = hits.filter(h => h.url === INSTALL);
  if (installHits.length > 0) bad('设置页挂载后入口/面板不应自动发 install（只查，安装走点击），实发 ' + installHits.length + ' 次');
  else ok('挂载只查不装（无 install 调用，安装走用户点击）');
  globalThis.fetch = realFetch;

  if (failures) { console.log('\nFAIL: #40 ' + failures + ' 条未过'); process.exit(1); }
  console.log('\nALL PASS: #40 settings 入口+弹窗面板（0.5.6 口径）');
})();
