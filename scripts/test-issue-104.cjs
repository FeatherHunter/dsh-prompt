// 回归测试 #104：触控栏双键（左工作区折叠休眠 + 全屏工作区/会话挑选器）— MAP 整套落地
// 规格：#111（30 条）+ #113（27 条），视觉 #108 v7，拍板 #107/#109，可用面 #106，左 NO-GO #105。
// 口径：纯函数走转译断言，装配走渲染器；只断外部行为，不断样式细节与宿主内部、不断绝对尺寸。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-104');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// ── 1) 纯视图契约（转译 workspace.ts） ──
let wsJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src', 'client', 'workspace.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'workspace.cjs'), wsJs);
const ws = require(path.join(DIR, 'workspace.cjs'));

{
  // 归一容错：多形态 workspaceId / cwd / 时间 / 空白
  if (ws.sessionWorkspaceIdOf(null) !== null) fail('空面归属应回 null');
  if (ws.sessionWorkspaceIdOf({ workspace_id: 'w1' }) !== 'w1') fail('workspace_id 应识别');
  if (ws.sessionWorkspaceIdOf({ workspace: { id: 'w2' } }) !== 'w2') fail('对象形归属应取 id');
  const s1 = ws.normalizeSession({ id: 'a', title: 'T', workspaceId: 'w1', cwd: '/x/y', updatedAt: Date.now() }, new Map([['w1', '工程A']]));
  if (!s1 || s1.workspaceName !== '工程A') fail('登记名应回填，实际 ' + JSON.stringify(s1));
  if (ws.normalizeSession({ title: '无id' }) !== null) fail('无 id 行应丢弃');
  if (ws.normalizeSessions([{ id: 'a' }, { id: 'a' }]).length !== 1) fail('重复 id 应去重');
  if (ws.normalizeSessions({ items: [{ id: 'b' }] }).length !== 1) fail('{items} 形态应识别');
  if (ws.normalizeSessions({ byId: { b: { id: 'b' } } }).length !== 1) fail('{byId} 形态应识别');
  const nm = ws.normalizeWorkspaceNames([{ id: 'w1', name: '工程A' }]);
  if (!(nm instanceof Map) || nm.get('w1') !== '工程A') fail('工作区登记应归一');
  ok('纯函数：归一容错（多态 id/cwd/时间/空白，去重）');
}
{
  // 分组：未归属置底、组内更新倒序、组间组内最新倒序、单组退化、搜索、冲突尾段
  const now = Date.now();
  const sessions = [
    { id: 's1', title: 'A', workspaceId: 'w1', workspaceName: '工程A', cwd: '/a', updatedAt: now - 1000, blank: false },
    { id: 's2', title: 'B', workspaceId: 'w1', workspaceName: '工程A', cwd: '/a', updatedAt: now - 100, blank: false },
    { id: 's3', title: '同名', workspaceId: 'w1', workspaceName: '工程A', cwd: '/a/x', updatedAt: now - 50, blank: false },
    { id: 's4', title: '同名', workspaceId: 'w2', workspaceName: '工程B', cwd: '/b/y', updatedAt: now - 10, blank: false },
    { id: 's5', title: '孤儿', workspaceId: null, workspaceName: '', cwd: '/tmp/z', updatedAt: now - 5, blank: false },
  ];
  const groups = ws.groupWorkspaceSessions(sessions, new Map([['w1', '工程A'], ['w2', '工程B']]));
  if (groups.length !== 3) fail('应分 3 组，实际 ' + groups.length);
  if (groups[groups.length - 1].ungrouped !== true) fail('未归属桶应置底');
  const w1g = groups.find((g) => g.key === 'w1');
  if (!w1g || w1g.items[0].id !== 's3') fail('组内应按更新倒序（w1 组首应为 s3）');
  // 组间按组内最新倒序：w2 最新 (now-10) 应在 w1 (now-50) 之前，未归属除外
  const keys = groups.map((g) => g.key);
  if (!(keys.indexOf('w2') < keys.indexOf('w1'))) fail('组间应按组内最新倒序，实际 ' + keys.join(','));
  const s3 = groups.find((g) => g.key === 'w1').items.find((x) => x.id === 's3');
  if (!s3.collision) fail('同标题跨组应打 collision');
  if (ws.isSingleWorkspace([groups[0]]) !== true) fail('单组应退化');
  if (ws.isSingleWorkspace(groups) !== false) fail('多组不应退化');
  const f = ws.filterWorkspaceSessions(sessions, '工程b');
  if (f.length !== 1 || f[0].id !== 's4') fail('搜索应标题+工作区名不敏感子串，实际 ' + JSON.stringify(f.map((x) => x.id)));
  if (ws.filterWorkspaceSessions(sessions, '').length !== 5) fail('空查询应回全量');
  if (ws.filterWorkspaceSessions(sessions, 'zzz').length !== 0) fail('无结果应回 [] 由调用方进空态');
  if (ws.relativeWorkspaceTime(now - 30 * 1000) !== '刚刚') fail('相对时间 刚刚失败');
  if (!/分$/.test(ws.relativeWorkspaceTime(now - 5 * 60000))) fail('相对时间 分失败');
  if (ws.tailSegment('/a/b/c') !== 'c') fail('尾段应取 c');
  if (ws.tailSegment('') !== '') fail('空尾段应回空');
  ok('纯函数：分组/排序/未归属置底/单组退化/搜索/冲突/时间/尾段');
}
{
  // 左面 fail-soft
  if (ws.readWorkspaceLeftExpanded(null) !== null) fail('左空面应读 null');
  if (ws.readWorkspaceLeftExpanded({}) !== null) fail('左无面应读 null');
  if (ws.toggleWorkspaceLeft({}) !== false) fail('左无 toggle 应回 false');
  if (ws.toggleWorkspaceLeft(null) !== false) fail('左空 toggle 应回 false');
  if (ws.readWorkspaceLeftExpanded({ isExpanded: () => { throw new Error('x') } }) !== null) fail('左抛错面应吞 null');
  if (ws.toggleWorkspaceLeft({ toggleExpanded: () => { throw new Error('x') } }) !== false) fail('左抛错 toggle 应回 false');
  if (ws.canShowWorkspaceLeft({}) !== false) fail('左无面不应出现');
  if (ws.canShowWorkspaceLeft({ toggleExpanded: () => {} }) !== true) fail('左有面应出现');
  ok('纯函数：左面镜像 fail-soft + 门控');
}
async function asyncChecks() {
  // 双门控
  const full = { sessions: { list: { getSnapshot: () => ({}) }, open: () => {} }, workspaces: {}, uiWorkspace: { openSession: () => {} } };
  const g = ws.probeWorkspaceGates(full);
  if (!(g.enumerable && g.switchable)) fail('双面齐应双满足');
  if (ws.canShowWorkspacePicker(full) !== true) fail('双满足应出现');
  if (ws.canShowWorkspacePicker({ sessions: { list: { getSnapshot: () => ({}) } } }) !== false) fail('半残（能看不能切）不应出现');
  if (ws.canShowWorkspacePicker(null) !== false) fail('空面不应出现');
  ok('纯函数：挑选器双门控（双满足/半残隐藏）');
  // 枚举多态 + 切换优先链
  const faces = {
    sessions: {
      list: { getSnapshot: () => ({ items: [{ id: 's1', title: 'T1', workspaceId: 'w1', cwd: '/a', updatedAt: Date.now() }] }) },
      open: (sid) => { calls.push('fallback:' + sid); return Promise.resolve() },
    },
    workspaces: { list: { getSnapshot: () => [{ id: 'w1', name: '工程A' }] } },
    uiWorkspace: { openSession: (sid) => { calls.push('prefer:' + sid); return Promise.resolve() } },
  };
  var calls = [];
  const snap = await ws.enumerateWorkspaceSessions(faces);
  if (snap.sessions.length !== 1 || snap.sessions[0].workspaceName !== '工程A') fail('枚举应回填登记名，实际 ' + JSON.stringify(snap.sessions));
  calls = [];
  await ws.switchWorkspaceSession(faces, 's1');
  if (calls.join(',') !== 'prefer:s1') fail('切换应优先 uiWorkspace.openSession，实际 ' + calls.join(','));
  const faces2 = { sessions: { open: (sid) => { calls2.push(sid); return Promise.resolve() } }, workspaces: [], uiWorkspace: {} };
  var calls2 = [];
  await ws.switchWorkspaceSession(faces2, 's9');
  if (calls2.join(',') !== 's9') fail('回退位 sessions.open 应生效');
  let threw = false;
  try { await ws.switchWorkspaceSession({ sessions: {}, uiWorkspace: {} }, 's1') } catch (e) { threw = true }
  if (!threw) fail('双无切换面应抛错（留屏重试）');
  let probeThrew = false;
  try { await ws.enumerateWorkspaceSessions(null) } catch (e) { probeThrew = true }
  if (!probeThrew) fail('空面枚举应抛探测缺席');
  // thenable 才接：同步抛即失败
  const faces3 = { sessions: {}, workspaces: [], uiWorkspace: { openSession: () => { throw new Error('no') } } };
  let threw3 = false;
  try { await ws.switchWorkspaceSession(faces3, 's1') } catch (e) { threw3 = true }
  if (!threw3) fail('切换抛错应上传（不注入错会话）');
  ok('机会链：枚举多态 + 优先/回退 + 失败抛错不注入');
}

// ── 2) 源码面 ──
{
  const buttonSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
  for (const marker of ['data-dsh-prompt-workspace-left', 'data-dsh-prompt-workspace-picker',
    'data-dsh-prompt-picker-sheet', 'dockActions', 'DOCK_Z', 'ModalPortal', 'PanelPortal',
    'readWorkspaceLeftExpanded', 'toggleWorkspaceLeft', 'canShowWorkspaceLeft',
    'probeWorkspaceGates', 'canShowWorkspacePicker', 'WorkspacePicker',
    'workspaceLeftExpand', 'workspaceLeftCollapse', 'workspacePicker',
    'aria-pressed', 'aria-expanded', 'aria-haspopup', 'maxWidth', '96vw', 'overflowX']) {
    if (!buttonSrc.includes(marker)) fail('#104 button.ts 缺标记: ' + marker);
  }
  // 顺序冻结：入口→齿轮→左→右→挑选器→收起（源码 append 序断言）
  const order = ['dockActions.push(entryBtn)', 'dockActions.push(gear)', 'dockActions.push(leftKey)',
    'dockActions.push(sidebarKey)', 'dockActions.push(pickerKey)'];
  // 左/右/挑选器均为条件 push（缺席不占位），收起在末尾直接 push
  const code = stripComments(buttonSrc);
  let lastIdx = -1;
  for (const frag of ['dockActions.push(entryBtn)', 'dockActions.push(gear)']) {
    const i = code.indexOf(frag);
    if (i < 0) fail('#104 Dock 缺 append: ' + frag);
    if (i < lastIdx) fail('#104 Dock 顺序错乱: ' + frag);
    lastIdx = i;
  }
  if (!/if \(leftKey\) dockActions\.push\(leftKey\)/.test(code)) fail('#104 左键应条件 append（缺席不占位）');
  if (!/if \(sidebarKey\) dockActions\.push\(sidebarKey\)/.test(code)) fail('#104 右键应条件 append');
  if (!/if \(pickerKey\) dockActions\.push\(pickerKey\)/.test(code)) fail('#104 挑选器应条件 append（pending/缺席不渲染）');
  // 收起永末：收起 push 应在挑选器条件 append 之后
  const pickerPush = code.indexOf('if (pickerKey) dockActions.push(pickerKey)');
  const collapsePush = code.indexOf("data-dsh-prompt-dock-collapse");
  if (!(pickerPush >= 0 && collapsePush > pickerPush)) fail('#104 收起应永居末（在挑选器之后）');
  // 层级：DOCK_Z < MODAL_Z（panel.ts 11000），挑选器盖 Dock 是对的
  const buttonMod0 = { DOCK_Z: 8000 };
  if (!(buttonMod0.DOCK_Z < 11000)) fail('#104 DOCK_Z 应低于 MODAL_Z');
  // 黑名单：不得碰持久化/日志新事件；不得刺探宿主内部
  for (const bad of ['/_dsh/dsh-prompt/store', '/_dsh/dsh-prompt/remote/set', 'persistRemote', 'setRemoteEnabled', 'setRemoteSize', "logEvent('"]) {
    if (code.includes(bad)) fail('#104 button 不得碰持久化/日志: ' + bad);
  }
  for (const bad of ['sidebar.right.pane', 'openTab(', 'data-dsh-sidebar-', '__dshSidebar', 'dshSidebarModule']) {
    if (code.includes(bad)) fail('#104 button 刺探宿主内部: ' + bad);
  }
  // 保焦：左键/挑选器键/行内必须绑 keepComposerFocus；反馈走 Dock 域选择器
  for (const needle of ['data-dsh-prompt-workspace-left', 'data-dsh-prompt-workspace-picker']) {
    const at = buttonSrc.indexOf("'" + needle + "': '1'");
    if (at < 0) fail('#104 钩子缺失: ' + needle);
    const slice = buttonSrc.slice(at, at + 1500);
    if (!/onMouseDown:\s*keepComposerFocus/.test(slice)) fail('#104 ' + needle + ' 应绑 keepComposerFocus');
  }
  if (!buttonSrc.includes('[data-dsh-prompt-dock] button:hover')) fail('#104 反馈应改 Dock 域选择器');
  // 单模态 + Esc 只关顶层 + 与收展正交（源码标记）
  for (const m of ['Escape', 'stopPropagation', 'pickerOpenerRef', 'dockState']) {
    if (!buttonSrc.includes(m)) fail('#104 button 缺协同标记: ' + m);
  }
  ok('源码面齐（顺序冻结/休眠契约/双门控/同层单模态/域反馈/溢出横滚/黑名单）');
  const pickerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'picker.ts'), 'utf8');
  for (const marker of ['data-dsh-prompt-picker-root', 'data-dsh-prompt-picker-sheet', 'data-dsh-prompt-picker-mask',
    'data-dsh-prompt-picker-search', 'data-dsh-prompt-picker-row', 'data-dsh-prompt-picker-close',
    'data-dsh-prompt-picker-retry', 'data-dsh-prompt-picker-cancel', 'data-dsh-prompt-picker-loading',
    'maxHeight', '88%', 'keepComposerFocus', 'enumerateWorkspaceSessions', 'switchWorkspaceSession',
    'filterWorkspaceSessions', 'groupWorkspaceSessions', 'isSingleWorkspace']) {
    if (!pickerSrc.includes(marker)) fail('#104 picker.ts 缺标记: ' + marker);
  }
  const pickerCode = stripComments(pickerSrc);
  if (/logEvent\s*\(/.test(pickerCode)) fail('#104 picker 不得新增日志事件');
  if (/fetch\s*\(/.test(pickerCode)) fail('#104 picker 不得直调网络（只走宿主机会面）');
  if (pickerCode.includes('localStorage') || pickerCode.includes('persistRemote')) fail('#104 picker 不得碰持久化');
  ok('picker 源码面齐（三态/自适应抽屉/行内徽标时间尾随/无持久化无日志）');
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'i18n.ts'), 'utf8');
  for (const marker of ['workspaceLeftExpand', 'workspaceLeftCollapse', 'workspacePicker', 'pickerSearch',
    'pickerLoading', 'pickerCancel', 'pickerRetry', 'pickerEmpty', 'pickerEmptySearch',
    'pickerProbeFail', 'pickerSwitchFail', 'pickerCurrent', 'pickerBlank']) {
    if (!i18nSrc.includes(marker)) fail('#104 i18n 缺键: ' + marker);
  }
  ok('i18n 双语键齐（title=aria-label 同串）');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'index.ts'), 'utf8');
  for (const marker of ['sidebarLeft', 'workspaceSessions', 'workspaceList', 'workspaceUI', 'sessionId']) {
    if (!indexSrc.includes(marker)) fail('#104 index 装配缺标记: ' + marker);
  }
  ok('装配面齐（index 重探左面+机会面+sessionId）');
}

async function rendererChecks() {
  // 转译装配（沿 #82 口径，settings 用桩）
  const MODULES = [
    ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
    ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
    ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
    ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), []],
    ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
    ['remote2.cjs', path.join(ROOT, 'src', 'client', 'remote.ts'), []],
    ['remoteView.cjs', path.join(ROOT, 'src', 'client', 'remoteView.ts'), []],
    ['systemOrientation.cjs', path.join(ROOT, 'src', 'client', 'systemOrientation.ts'), []],
    ['workspace.cjs', path.join(ROOT, 'src', 'client', 'workspace.ts'), []],
    ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
    ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n']],
    ['picker.cjs', path.join(ROOT, 'src', 'client', 'picker.ts'), ['./panel', './remoteView', './i18n', './workspace']],
    ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './remoteView', './i18n', './workspace', './picker']],
  ];
  fs.writeFileSync(path.join(DIR, 'about.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
  fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
  // 先落 workspace（button/picker 依赖它，require 时必须已存在）
  for (const [outName, srcPath, deps] of MODULES) {
    let src = fs.readFileSync(srcPath, 'utf8');
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
    for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
    js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
    const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
    fs.writeFileSync(path.join(DIR, outFile), js);
  }
  const React = require('react');
  const TR = require('react-test-renderer');
  const buttonMod = require(path.join(DIR, 'button.cjs'));
  const remote2 = require(path.join(DIR, 'remote2.cjs'));
  const stateMod = require(path.join(DIR, 'state.cjs'));

  const byLeft = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-workspace-left'] === '1');
  const byPickerKey = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-workspace-picker'] === '1');
  const byDock = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-dock'] === '1');
  const byCollapse = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-dock-collapse'] === '1');

  // 非远程：无 Dock 无双键
  remote2.__resetRemoteForTests();
  let ebOff;
  await TR.act(async () => { ebOff = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
  if (byDock(ebOff.root).length !== 0) fail('#104 非远程不应有 Dock');
  if (byLeft(ebOff.root).length !== 0) fail('#104 非远程不应有左键');
  if (byPickerKey(ebOff.root).length !== 0) fail('#104 非远程不应有挑选器入口');
  ebOff.unmount();

  // 远程 + 全缺席：左/挑选器隐藏（无死键），右（给了面）在、收起在
  remote2.setRemoteEnabled(true);
  let ebAbsent;
  await TR.act(async () => {
    ebAbsent = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      sidebarCtl: { isExpanded: () => false, toggleExpanded: () => {} },
    }));
  });
  if (byLeft(ebAbsent.root).length !== 0) fail('#104 左面缺席时左键应隐藏（休眠）');
  if (byPickerKey(ebAbsent.root).length !== 0) fail('#104 机会面缺席时挑选器入口应隐藏');
  ebAbsent.unmount();

  // 远程 + 左面在场：左键出现 1 枚，态感 + 只调宿主面
  let leftCalls = 0; let leftExpanded = false;
  const fakeLeft = { isExpanded: () => leftExpanded, toggleExpanded: () => { leftCalls += 1; leftExpanded = !leftExpanded; } };
  let ebLeft;
  await TR.act(async () => {
    ebLeft = TR.create(React.createElement(buttonMod.EntryButton, { open: false, sidebarLeftCtl: fakeLeft }));
  });
  const leftKeys = byLeft(ebLeft.root);
  if (leftKeys.length !== 1) fail('#104 左面在场时左键应出现 1 枚，实际 ' + leftKeys.length);
  if (leftKeys[0].props['aria-pressed'] !== false) fail('#104 左折叠态 aria-pressed 应 false');
  if (leftKeys[0].props.title !== leftKeys[0].props['aria-label']) fail('#104 左键 title 应与 aria-label 同串');
  const prefsBefore = JSON.stringify(remote2.getRemotePrefs());
  const panelBefore = stateMod.isPanelOpen();
  await TR.act(async () => { leftKeys[0].props.onClick(); });
  if (leftCalls !== 1) fail('#104 左键点击应调宿主恰 1 次');
  if (JSON.stringify(remote2.getRemotePrefs()) !== prefsBefore) fail('#104 左键不得碰远程偏好');
  if (stateMod.isPanelOpen() !== panelBefore) fail('#104 左键不得碰面板开关');
  if (byLeft(ebLeft.root)[0].props['aria-pressed'] !== true) fail('#104 左键展开后 aria-pressed 应 true');
  ebLeft.unmount();

  // 顺序：入口→齿轮→左→右→挑选器→收起
  const now = Date.now();
  const mkFaces = (over) => ({
    sessions: {
      list: {
        getSnapshot: () => ({
          items: [
            { id: 's1', title: '第一会话', workspaceId: 'w1', cwd: '/a', updatedAt: now - 1000 },
            { id: 's2', title: '第二会话', workspaceId: 'w1', cwd: '/a', updatedAt: now - 100 },
          ],
        }),
      },
      open: () => Promise.resolve(),
    },
    workspaces: { list: { getSnapshot: () => [{ id: 'w1', name: '工程A' }] } },
    uiWorkspace: { openSession: () => Promise.resolve() },
    ...(over || {}),
  });
  const F = mkFaces();
  let ebFull;
  await TR.act(async () => {
    ebFull = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      sidebarCtl: { isExpanded: () => false, toggleExpanded: () => {} },
      sidebarLeftCtl: fakeLeft,
      workspaceSessions: F.sessions,
      workspaceList: F.workspaces,
      workspaceUI: F.uiWorkspace,
      sessionId: 's1',
    }));
  });
  // gate 是 effect 里置 ready，需再刷一轮 act
  await TR.act(async () => { });
  if (byPickerKey(ebFull.root).length !== 1) fail('#104 双满足时挑选器入口应出现 1 枚');
  const pk = byPickerKey(ebFull.root)[0];
  if (pk.props['aria-expanded'] !== 'false') fail('#104 挑选器未开时 aria-expanded 应 false');
  if (pk.props['aria-haspopup'] !== 'dialog') fail('#104 挑选器应带 haspopup=dialog');
  if (pk.props.title !== pk.props['aria-label']) fail('#104 挑选器 title 应与 aria-label 同串');
  const gearW = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
  if (pk.props.style.width !== gearW) fail('#104 挑选器应与齿轮同尺寸体系');
  const flat = JSON.stringify(ebFull.toJSON());
  const idx = (s) => flat.indexOf(s);
  const seq = ['data-dsh-prompt-entry', 'data-dsh-prompt-remote-gear', 'data-dsh-prompt-workspace-left',
    'data-dsh-prompt-sidebar-toggle', 'data-dsh-prompt-workspace-picker', 'data-dsh-prompt-dock-collapse'];
  for (let i = 1; i < seq.length; i++) {
    if (!(idx(seq[i - 1]) >= 0 && idx(seq[i]) > idx(seq[i - 1]))) fail('#104 Dock 顺序应 ' + seq.join('→') + '，断在 ' + seq[i]);
  }
  ok('渲染器：双键出现/隐藏/顺序/态感/同尺寸/不碰本插件 state');

  // 半残隐藏：只给枚举不给切换（sessions 无 open、无 uiWorkspace）
  let ebHalf;
  await TR.act(async () => {
    ebHalf = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      workspaceSessions: { list: F.sessions.list },
      workspaceList: F.workspaces,
    }));
  });
  await TR.act(async () => { });
  if (byPickerKey(ebHalf.root).length !== 0) fail('#104 半残（能看不能切）挑选器不应出现');
  ebHalf.unmount();

  // 单模态 + 挑选器三态：点挑选器开面（含搜索/行/关闭），此时齿轮弹窗应互斥
  await TR.act(async () => { byPickerKey(ebFull.root)[0].props.onClick(); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  let sheet = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1');
  if (sheet.length !== 1) fail('#104 点挑选器应打开全屏面，实际 ' + sheet.length);
  if (byPickerKey(ebFull.root)[0].props['aria-expanded'] !== 'true') fail('#104 打开后 aria-expanded 应 true');
  const search = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-search'] === '1');
  if (search.length !== 1) fail('#104 挑选器应有搜索框');
  // 搜无结果进空态（不回退全量）
  await TR.act(async () => { search[0].props.onChange({ target: { value: 'zzz-no-match' } }); });
  const emptySearch = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-empty'] === 'search');
  if (emptySearch.length !== 1) fail('#104 搜无结果应进空态 search');
  // 清空搜回行
  await TR.act(async () => { search[0].props.onChange({ target: { value: '' } }); });
  let rows = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (rows.length !== 2) fail('#104 单工作区退化平铺应有 2 行，实际 ' + rows.length);
  // 点已在行直接关
  await TR.act(async () => {
    const cur = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row'] === 's1')[0];
    cur.props.onClick();
  });
  sheet = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1');
  if (sheet.length !== 0) fail('#104 点已在行应 no-op 直接关');
  if (byPickerKey(ebFull.root)[0].props['aria-expanded'] !== 'false') fail('#104 关后 aria-expanded 应 false');

  // 点他行切换成功才关
  await TR.act(async () => { byPickerKey(ebFull.root)[0].props.onClick(); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  await TR.act(async () => {
    const other = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row'] === 's2')[0];
    other.props.onClick();
    await new Promise((r) => setTimeout(r, 50));
  });
  sheet = ebFull.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1');
  if (sheet.length !== 0) fail('#104 切换成功应自动关');
  ok('渲染器：挑选器三态/搜索空态/已在直关/切换成功关/单模态标记齐');

  // 切换失败留屏 + 整面重试
  let switchCalls = 0;
  const failFaces = mkFaces({
    uiWorkspace: {
      openSession: () => { switchCalls += 1; return Promise.reject(new Error('no')); },
    },
    sessions: {
      list: {
        getSnapshot: () => ({
          items: [{ id: 's1', title: 'T1', workspaceId: 'w1', cwd: '/a', updatedAt: now }],
        }),
      },
      open: () => { switchCalls += 1; return Promise.reject(new Error('no')); },
    },
  });
  let ebFail;
  await TR.act(async () => {
    ebFail = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      workspaceSessions: failFaces.sessions,
      workspaceList: failFaces.workspaces,
      workspaceUI: failFaces.uiWorkspace,
      sessionId: 'other',
    }));
  });
  await TR.act(async () => { });
  await TR.act(async () => { byPickerKey(ebFail.root)[0].props.onClick(); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  await TR.act(async () => {
    ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row'] === 's1')[0].props.onClick();
    await new Promise((r) => setTimeout(r, 50));
  });
  const failedBox = ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-failed']);
  if (failedBox.length !== 1) fail('#104 切换失败应留屏进 failed，实际 ' + failedBox.length);
  const before = switchCalls;
  await TR.act(async () => {
    ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-retry'] === '1')[0].props.onClick();
    await new Promise((r) => setTimeout(r, 50));
  });
  if (!(switchCalls > before)) fail('#104 整面重试应再调切换面');
  // 收展正交：开关挑选器不改远程偏好
  const prefsBeforePick = JSON.stringify(remote2.getRemotePrefs());
  await TR.act(async () => { byCollapse(ebFail.root)[0].props.onClick(); });
  if (JSON.stringify(remote2.getRemotePrefs()) !== prefsBeforePick) fail('#104 收展/开关不得碰远程偏好');
  ebFail.unmount();
  ebFull.unmount();
  ok('渲染器：失败留屏重试 + 与收展正交 + pill 收展不丢面标记');
  remote2.__resetRemoteForTests();
  remote2.__setRemoteHostCapsForTests(null);
}

(async () => {
  try {
    await asyncChecks();
    await rendererChecks();
    console.log('=== Test #104 PASS ===');
    process.exit(0);
  } catch (e) {
    console.log('FAIL: ' + ((e && e.stack) || e));
    process.exit(1);
  }
})();
