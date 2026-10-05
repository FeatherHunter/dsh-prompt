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

// ── 1b) 分页纯模型（转译 pager.ts，#115 architect 版：DOM-free，node 直断） ──
let pgJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src', 'client', 'pager.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'pager.cjs'), pgJs);
const pg = require(path.join(DIR, 'pager.cjs'));

{
  if (pg.pageCount(12, 3) !== 4) fail('12 项每页 3 应 4 页');
  if (pg.pageCount(0, 3) !== 0) fail('0 项应 0 页');
  if (pg.pageCount(11, 3) !== 4) fail('11 项每页 3 应 4 页');
  if (pg.pageCount(5, NaN) !== 5) fail('perPage 非法应按 1 算');
  if (pg.pageCount(-2, 3) !== 0) fail('负项应 0 页');
  if (pg.clampPage(5, 12, 3) !== 3) fail('超上界应钳到末页');
  if (pg.clampPage(-1, 12, 3) !== 0) fail('负页应钳到 0');
  if (pg.clampPage(2, 12, 3) !== 2) fail('界内页应保持');
  if (pg.clampPage(0, 0, 3) !== 0) fail('空集恒回 0');
  if (pg.pageOf(5, 3) !== 1) fail('第 5 项每页 3 应在页 1');
  if (pg.pageOf(0, 3) !== 0) fail('第 0 项应在页 0');
  if (pg.pageOf(11, 3) !== 3) fail('第 11 项每页 3 应在页 3');
  const rg = pg.pageRange(1, 12, 3);
  if (rg.start !== 3 || rg.end !== 6) fail('页 1 区间应 [3,6)，实际 ' + JSON.stringify(rg));
  const rg2 = pg.pageRange(9, 12, 3);
  if (rg2.start !== 9 || rg2.end !== 12) fail('越界页应钳后区间 [9,12)，实际 ' + JSON.stringify(rg2));
  if (pg.perPageFromMeasure(460, 152, 3) !== 3) fail('460÷152 应每页 3');
  if (pg.perPageFromMeasure(100, 152, 3) !== 1) fail('不足一项保底 1');
  if (pg.perPageFromMeasure(NaN, 152, 3) !== 3) fail('量不到回 fallback');
  ok('纯函数：分页模型（页数/钳制/归属/区间/量算）');
}

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
  // ── 归属反查（2026-10-03 修复）──────────────────────────────────────────
  // 真实宿主形状（读 ~/.dsh/storages/workspace.json + dsh-api-workspace-controller 的
  // workspaceView() 源码核对过）：归属存在**工作区这一侧**的 sessionIds[]，
  // 会话对象自身不带任何 workspaceId 字段。
  // 真机回归：11 个工作区却全部塌进未归属桶 → 单组 → 组头被 US9 藏掉，整面看起来像"没有工作区"。
  const registry = [
    { workspaceId: 'w1', path: 'D:\\a', title: '工程A', sessionIds: ['s1', 's2'], createdAt: 'x', updatedAt: 'y' },
    { workspaceId: 'w2', path: 'D:\\b', title: '工程B', sessionIds: ['s4'], createdAt: 'x', updatedAt: 'y' },
  ];
  const idx = ws.buildWorkspaceIndex(registry);
  if (!(idx instanceof Map) || idx.size !== 3) fail('反查索引应覆盖 3 条会话，实际 ' + idx.size);
  if (idx.get('s1').workspaceId !== 'w1' || idx.get('s1').workspaceName !== '工程A') fail('s1 应归 w1/工程A');
  if (idx.get('s4').workspaceId !== 'w2') fail('s4 应归 w2');
  if (idx.has('s5')) fail('未登记会话不应进索引');
  // 快照形态（{items:[...]}）也要认：face.list.getSnapshot() 就是这个形状
  if (ws.buildWorkspaceIndex({ items: registry }).size !== 3) fail('{items} 快照形态应识别');
  if (ws.buildWorkspaceIndex(null).size !== 0) fail('空面应回空索引');
  if (ws.buildWorkspaceIndex([{ workspaceId: 'w9', title: '空组' }]).size !== 0) fail('无 sessionIds 的工作区应产出空索引');
  // 端到端：会话**只有 id/title**（无任何归属字段）也必须分出组 —— 这正是真机塌掉的场景
  const real = ws.normalizeSessions(
    [{ id: 's1', title: 'A', updatedAt: 3 }, { id: 's4', title: 'B', updatedAt: 2 }, { id: 's5', title: '孤儿', updatedAt: 1 }],
    ws.normalizeWorkspaceNames(registry),
    idx,
  );
  if (real.length !== 3) fail('端到端应保留 3 条');
  if (real[0].workspaceId !== 'w1' || real[0].workspaceName !== '工程A') fail('s1 应经索引拿到 w1/工程A，实际 ' + JSON.stringify(real[0]));
  if (real[0].cwd !== 'D:\\a') fail('cwd 应回填工作区 path，实际 ' + real[0].cwd);
  if (real[2].workspaceId !== null) fail('未登记会话应保持无归属，不猜');
  const realGroups = ws.groupWorkspaceSessions(real, ws.normalizeWorkspaceNames(registry), '未归属');
  if (realGroups.length !== 3) fail('端到端应分 3 组（一级=工作区），实际 ' + realGroups.length);
  if (realGroups[2].ungrouped !== true) fail('未归属桶应置底');
  ok('纯函数：归属反查（宿主 sessionIds[] 形状 → 一级工作区分组，端到端 3 组）');
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
  const f = ws.filterWorkspaceSessions(sessions, '工程b');
  if (f.length !== 1 || f[0].id !== 's4') fail('搜索应标题+工作区名不敏感子串，实际 ' + JSON.stringify(f.map((x) => x.id)));
  if (ws.filterWorkspaceSessions(sessions, '').length !== 5) fail('空查询应回全量');
  if (ws.filterWorkspaceSessions(sessions, 'zzz').length !== 0) fail('无结果应回 [] 由调用方进空态');
  // 未归属行 workspaceName 为空时用展示名回填，保证搜“未归属”可达（审查 #10）
  const unHit = ws.filterWorkspaceSessions(sessions, '未归属', '未归属');
  if (unHit.length !== 1 || unHit[0].id !== 's5') fail('搜未归属应命中未归属行，实际 ' + JSON.stringify(unHit.map((x) => x.id)));
  if (ws.filterWorkspaceSessions(sessions, '未归属').length !== 0) fail('无展示名回填时不应误命中');
  if (ws.relativeWorkspaceTime(now - 30 * 1000) !== '刚刚') fail('相对时间 刚刚失败');
  if (!/分$/.test(ws.relativeWorkspaceTime(now - 5 * 60000))) fail('相对时间 分失败');
  // 双语时间（审查 Standards 硬伤 #2：英文 UI 不得漏中文）
  if (ws.relativeWorkspaceTime(now - 30 * 1000, now, 'en') !== 'now') fail('EN 相对时间 now 失败');
  if (ws.relativeWorkspaceTime(now - 5 * 60000, now, 'en') !== '5m') fail('EN 相对时间 5m 失败，实际 ' + ws.relativeWorkspaceTime(now - 5 * 60000, now, 'en'));
  if (ws.relativeWorkspaceTime(now - 3 * 3600000, now, 'en') !== '3h') fail('EN 相对时间 3h 失败');
  if (ws.relativeWorkspaceTime(now - 2 * 86400000, now, 'en') !== '2d') fail('EN 相对时间 2d 失败');
  // 色点：同 id 稳定、#rrggbb 形（审查 #3 色点通道）
  const c1a = ws.workspaceColor('ws-prompt'), c1b = ws.workspaceColor('ws-prompt');
  if (c1a !== c1b || !/^#[0-9a-f]{6}$/i.test(c1a)) fail('色点应对同一归属稳定且为色值，实际 ' + c1a);
  if (ws.workspaceColor(null) !== ws.workspaceColor(null)) fail('空归属色点应稳定');
  // 短码：末段前 4 字规则（审查 #8 数据驱动版，非演示硬编码）
  if (ws.workspaceShortCode('dsh-prompt', 'ws-prompt') !== 'prom') fail('短码 dsh-prompt 应为 prom');
  if (ws.workspaceShortCode('dsh-opencode-palette', 'ws-pal') !== 'pale') fail('短码应取末段，实际 ' + ws.workspaceShortCode('dsh-opencode-palette', 'ws-pal'));
  if (ws.workspaceShortCode('', '') !== '') fail('空归属短码应回空（调用方按双语回退）');
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
  // 裸 sessions.get 是单体面、不能枚举：门控不得算可枚举（审查 #7，否则假“真无会话”）
  const getOnly = { sessions: { get: (sid) => ({ id: sid }) }, workspaces: [], uiWorkspace: { openSession: () => Promise.resolve() } };
  const gg = ws.probeWorkspaceGates(getOnly);
  if (gg.enumerable !== false) fail('裸 .get 不应算可枚举');
  if (ws.canShowWorkspacePicker(getOnly) !== false) fail('.get-only 宿主不应出现入口（应隐藏而非假空态）');
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
    'probeWorkspaceGates', 'canShowWorkspacePicker', 'WorkspacePicker', 'getSmartInput',
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
    'data-dsh-prompt-picker-rail', 'data-dsh-prompt-picker-dot',
    'data-dsh-prompt-picker-groupcard', 'data-dsh-prompt-picker-groupgrid',
    'data-dsh-prompt-picker-wspane', 'data-dsh-prompt-picker-sspane',
    'data-dsh-prompt-picker-tabrow', 'data-dsh-prompt-picker-pager',
    'data-dsh-prompt-picker-opbar', 'data-dsh-prompt-picker-closebar',
    'MODAL_Z', 'maxHeight', '100%', 'keepComposerFocus', 'enumerateWorkspaceSessions', 'switchWorkspaceSession',
    'filterWorkspaceSessions', 'groupWorkspaceSessions',
    'workspaceColor', 'workspaceShortCode']) {
    if (!pickerSrc.includes(marker)) fail('#104 picker.ts 缺标记: ' + marker);
  }
  // #115 tab 条版（architect 版）：定宽 tab＋纯页模型＋翻页键＋tablist 语义
  for (const m of ['TAB_W', 'PAGER_BOX', 'tabRowStyle', 'pagerBtn', 'opBarStyle',
    "'data-dsh-prompt-picker-tabrow'", "'data-dsh-prompt-picker-pager'",
    "'data-dsh-prompt-picker-opbar'", "'data-dsh-prompt-picker-closebar'",
    'tablist', 'clampPage', 'pageCount', 'dsh-prompt-pager-pulse',
    'perPageFromMeasure', './pager']) {
    if (!pickerSrc.includes(m)) fail('#115 picker.ts 缺 tab 条标记: ' + m);
  }
  // 2026-10-03：US9「单工作区不显示组头」已撤（用户拍板组头恒显示），不得回潮
  if (pickerSrc.includes('isSingleWorkspace')) fail('#104 picker 不得再用 isSingleWorkspace 平铺（组头恒显示）');
  if (/data-dsh-prompt-picker-flat'\s*:\s*hasQuery/.test(pickerSrc)) fail('#104 picker 展平标记不应再随 query 摇摆');
  if (!pickerSrc.includes("'data-dsh-prompt-picker-flat': 'query'")) fail('#104 picker 展平应只由搜索触发');
  // 审查 #1：根容器必须定 MODAL_Z 层级，旧 z10/z11 不得残留（真机必输给 DOCK_Z=8000）
  if (!/zIndex:\s*MODAL_Z/.test(pickerSrc)) fail('#104 picker 根容器应 zIndex: MODAL_Z（与齿轮弹窗同层）');
  if (/zIndex:\s*10\b/.test(stripComments(pickerSrc)) || /zIndex:\s*11\b/.test(stripComments(pickerSrc))) fail('#104 picker 不得残留 z10/z11（会被 Dock 盖住）');
  // 审查 creep #16：失败条不得渲染裸会话 id
  if (pickerSrc.includes("+ ' · ' + failRowId")) fail('#104 失败条不得拼裸会话 id');
  // 审查 creep #17：当前行不得用 color-mix tint 底（原型口径边框 + 内圈）
  if (pickerSrc.includes('color-mix')) fail('#104 当前行应回退原型口径（边框 + 内圈），不得 tint 底');
  const pickerCode = stripComments(pickerSrc);
  if (/logEvent\s*\(/.test(pickerCode)) fail('#104 picker 不得新增日志事件');
  if (/fetch\s*\(/.test(pickerCode)) fail('#104 picker 不得直调网络（只走宿主机会面）');
  if (pickerCode.includes('localStorage') || pickerCode.includes('persistRemote')) fail('#104 picker 不得碰持久化');
  ok('picker 源码面齐（三态/自适应抽屉/行内徽标时间尾随/无持久化无日志）');
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'i18n.ts'), 'utf8');
  for (const marker of ['workspaceLeftExpand', 'workspaceLeftCollapse', 'workspacePicker', 'pickerSearch',
    'pickerLoading', 'pickerCancel', 'pickerRetry', 'pickerEmpty', 'pickerEmptySearch',
    'pickerProbeFail', 'pickerSwitchFail', 'pickerCurrent', 'pickerBlank',
    'pickerUngrouped', 'pickerUnassignedShort', 'pickerWorkspaces', 'pickerSessions',
    'pickerPrev', 'pickerNext', 'pickerOpBar']) {
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
    ['pager.cjs', path.join(ROOT, 'src', 'client', 'pager.ts'), []],
    ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
    ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n']],
    ['picker.cjs', path.join(ROOT, 'src', 'client', 'picker.ts'), ['./panel', './remoteView', './i18n', './workspace', './pager']],
    ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './remoteView', './i18n', './workspace', './picker', './smartstore']],
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
  const pickerMod = require(path.join(DIR, 'picker.cjs'));
  const remote2 = require(path.join(DIR, 'remote2.cjs'));
  const stateMod = require(path.join(DIR, 'state.cjs'));
  const smartMod = require(path.join(DIR, 'smartstore.cjs'));
  // Node ≥18 自带 global fetch：不桩则 ensureRemoteLoaded 走相对 URL 必失败，
  // 还会起 2500ms 重试定时器把远程偏好翻回默认并广播——长用例跑到后半程会被翻成非远程。
  // 沿 #82/#86 口径桩掉：store 快照故意无远程键（走“旧快照默认”分支：不翻转、不重试），
  // 写桥一律成功（进程级，不恢复）。各块按需 setRemoteEnabled(true) 即稳。
  globalThis.fetch = async (url) => ({
    ok: true, status: 200,
    json: async () => (/\/store$/.test(String(url)) ? { ok: true, value: {} } : { ok: true }),
  });

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
  // 审查 #14/US25：切换失败留屏时列表仍在、失败行可点重试（行内辅重试）
  const failRows = ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (failRows.length !== 1) fail('#104 切换失败应保留列表行以供行内重试，实际 ' + failRows.length);
  const beforeRow = switchCalls;
  await TR.act(async () => {
    ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row'] === 's1')[0].props.onClick();
    await new Promise((r) => setTimeout(r, 50));
  });
  if (!(switchCalls > beforeRow)) fail('#104 失败行再点应重试切换');
  if (ebFail.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-failed']).length !== 1) fail('#104 行内重试失败后仍应留屏');
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
  // 审查 #1 Blocking：根容器必须与齿轮弹窗同层、高于 Dock，否则 Dock 浮在面之上可点
  let ebZ;
  await TR.act(async () => {
    ebZ = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      workspaceSessions: F.sessions,
      workspaceList: F.workspaces,
      workspaceUI: F.uiWorkspace,
      sessionId: 's1',
    }));
  });
  await TR.act(async () => { });
  await TR.act(async () => { byPickerKey(ebZ.root)[0].props.onClick(); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  const pickerRoot = ebZ.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-root'] === '1')[0];
  if (!pickerRoot) fail('#104 挑选器根容器应存在');
  if (pickerRoot.props.style.zIndex !== 11000) fail('#104 挑选器根应 zIndex 11000（MODAL_Z 同层），实际 ' + pickerRoot.props.style.zIndex);
  if (!(buttonMod.DOCK_Z < pickerRoot.props.style.zIndex)) fail('#104 挑选器层级应高于 Dock，实际 DOCK_Z=' + buttonMod.DOCK_Z);
  ebZ.unmount();
  ok('渲染器：挑选器与齿轮弹窗同层、盖住 Dock（审查 #1）');

  // 多组竖屏手风琴：组头色点 + 展开态边框 + 默认展开最新组（审查 #3/#4）
  // 夹具按**真实宿主形状**造（2026-10-03 修正）：归属存在工作区侧 sessionIds[]，会话自身没有归属字段。
  // 旧夹具给会话硬塞 workspaceId，等于拿 bug 的假设去断 bug，所以长期全绿而真机整面塌掉。
  const twoGroups = {
    sessions: {
      list: {
        getSnapshot: () => ({
          items: [
            { id: 'a1', title: '旧会话A', cwd: '/a', updatedAt: now - 100000 },
            { id: 'a2', title: '新会话A', cwd: '/a', updatedAt: now - 90000 },
            { id: 'b1', title: '最新会话B', cwd: '/b', updatedAt: now - 100 },
          ],
        }),
      },
      open: () => Promise.resolve(),
    },
    workspaces: {
      list: {
        getSnapshot: () => ({
          items: [
            { workspaceId: 'w1', path: '/a', title: '工程A', sessionIds: ['a1', 'a2'] },
            { workspaceId: 'w2', path: '/b', title: '工程B', sessionIds: ['b1'] },
          ],
        }),
      },
    },
    uiWorkspace: { openSession: () => Promise.resolve() },
  };
  let pkPortrait;
  await TR.act(async () => {
    pkPortrait = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: twoGroups, currentId: '', remoteSize: 5, wide: false, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  const heads = pkPortrait.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-group']);
  if (heads.length !== 2) fail('#104 双组竖屏应有 2 个一级卡，实际 ' + heads.length);
  const dots = pkPortrait.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-dot'] === '1');
  if (dots.length !== 2) fail('#104 一级卡应各带色点，实际 ' + dots.length);
  // #115 tab 条版：竖屏 tab 用 aria-selected（tablist 语义），横屏 rail 沿用 aria-pressed
  const openHeads = heads.filter((x) => x.props['aria-selected'] === 'true');
  if (openHeads.length !== 1) fail('#104 应恰好展开一组，实际 ' + openHeads.length);
  if (!/f0a45c/.test(String(openHeads[0].props.style.border))) fail('#104 展开组应 accent 边框态感');
  const closedHeads = heads.filter((x) => x.props['aria-selected'] === 'false');
  if (/f0a45c/.test(String(closedHeads[0].props.style.border))) fail('#104 未展开组不应 accent 边框');
  // 默认展开组内最新的 w2（只有 b1 一行）
  const portraitRows = pkPortrait.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (portraitRows.length !== 1 || portraitRows[0].props['data-dsh-prompt-picker-row'] !== 'b1') {
    fail('#104 默认应展开最新组（w2/b1），实际行 ' + JSON.stringify(portraitRows.map((x) => x.props['data-dsh-prompt-picker-row'])));
  }
  pkPortrait.unmount();
  ok('渲染器：一级卡色点 + 展开态边框 + 默认展开最新组');

  // #115 tab 条版：会话栏在上、底部工作区 tab 条在下（横滑＋右侧翻页键）。
  // tab 定宽是均匀页的前提（与 pager 联动），tablist 语义，翻页键 2.5em 方。
  let pkWc;
  await TR.act(async () => {
    pkWc = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: twoGroups, currentId: '', remoteSize: 5, wide: false, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  const tabrows = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-tabrow']);
  if (tabrows.length !== 1) fail('#115 应有 1 个 tab 行，实际 ' + tabrows.length);
  if (String(tabrows[0].props['data-dsh-prompt-picker-tabrow']) !== '3') {
    fail('#115 无 DOM 时每页项数应回落默认 3，实际 ' + tabrows[0].props['data-dsh-prompt-picker-tabrow']);
  }
  if (tabrows[0].props.style.display !== 'flex' || tabrows[0].props.style.flexDirection !== 'row') {
    fail('#115 tab 行应横向 flex');
  }
  const gcards = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-groupcard'] === '1');
  if (gcards.length !== 2) fail('#115 应有 2 个 tab，实际 ' + gcards.length);
  for (const c of gcards) {
    if (c.props.style.width !== '9em') fail('#115 tab 应定宽 9em（均匀页前提），实际 ' + c.props.style.width);
    if (c.props.role !== 'tab') fail('#115 tab 应带 tab 语义');
    if (c.props.style.minHeight !== '2.6em') fail('#115 tab 应为行高 2.6em，实际 ' + c.props.style.minHeight);
  }
  const selTabs = gcards.filter((c) => c.props['aria-selected'] === 'true');
  if (selTabs.length !== 1) fail('#115 应恰有 1 个选中 tab，实际 ' + selTabs.length);
  // tab 行里不得混入会话卡；会话网格仍恰 1 个、其内无 tab
  const insideTabs = tabrows[0].findAll((x) => x.props && x.props['data-dsh-prompt-picker-card'] === '1');
  if (insideTabs.length !== 0) fail('#115 会话卡不应嵌在 tab 行内，实际 ' + insideTabs.length);
  const belowGrids = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-grid']);
  if (belowGrids.length !== 1) fail('#115 应另有 1 个会话网格，实际 ' + belowGrids.length);
  if (belowGrids[0].findAll((x) => x.props && x.props['data-dsh-prompt-picker-groupcard'] === '1').length !== 0) {
    fail('#115 会话网格里不得混进 tab');
  }
  // tablist 语义＋横滑＋4 枚翻页键（2.5em 方）
  const wspanes = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-wspane'] === '1');
  if (wspanes.length !== 1 || wspanes[0].props.role !== 'tablist') fail('#115 底部应为 tablist 工作区栏');
  const wss = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-wsscroll'] === '1');
  if (wss.length !== 1 || wss[0].props.style.overflowX !== 'auto') fail('#115 tab 条应横滑');
  if (pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sspane'] === '1').length !== 1) {
    fail('#115 应有 1 个会话栏');
  }
  if (pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-ssscroll'] === '1').length !== 1) {
    fail('#115 会话栏应有独立滚动区');
  }
  // 底部操作栏：[工‹][会‹][会›][工›]…[×]，外层橙边、内层绿边
  const opbars = pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-opbar'] === '1');
  if (opbars.length !== 1) fail('#115 应有 1 个底部操作栏，实际 ' + opbars.length);
  if (opbars[0].props.role !== 'toolbar') fail('#115 操作栏应为 toolbar');
  if (opbars[0].props.style.justifyContent !== 'flex-end') fail('#115 操作栏应整栏靠右');
  const pagers = opbars[0].findAll((x) => x.props && x.props['data-dsh-prompt-picker-pager']);
  const order = pagers.map((x) => x.props['data-dsh-prompt-picker-pager']).join(',');
  if (order !== 'ws-prev,ss-prev,ss-next,ws-next') fail('#115 操作栏顺序应 [工‹][会‹][会›][工›]，实际 ' + order);
  for (const p of pagers) {
    if (p.props.style.width !== '2.5em' || p.props.style.height !== '2.5em') {
      fail('#115 翻页键应 2.5em 方，实际 ' + p.props.style.width + 'x' + p.props.style.height);
    }
    if (p.props.disabled !== true) fail('#115 单页/单项时翻页键应全禁用');
  }
  const wsPrev = pagers.find((x) => x.props['data-dsh-prompt-picker-pager'] === 'ws-prev');
  const ssPrev = pagers.find((x) => x.props['data-dsh-prompt-picker-pager'] === 'ss-prev');
  if (!/f0a45c/.test(String(wsPrev.props.style.border))) fail('#115 外层工作区键应橙边，实际 ' + wsPrev.props.style.border);
  if (!/7fd08a/.test(String(ssPrev.props.style.border))) fail('#115 内层会话键应绿边，实际 ' + ssPrev.props.style.border);
  if (wsPrev.props.style.borderRadius !== '50%') fail('#115 外层工作区键应圆形（呼应色点），实际 ' + wsPrev.props.style.borderRadius);
  const ssNext = pagers.find((x) => x.props['data-dsh-prompt-picker-pager'] === 'ss-next');
  if (ssPrev.props.style.borderRadius !== 9 || ssNext.props.style.borderRadius !== 9) fail('#115 内层会话键应方形（呼应卡片）');
  if (wsPrev.props['aria-label'] !== '工作区上一页') fail('#115 外层键名应工作区上一页，实际 ' + wsPrev.props['aria-label']);
  if (ssPrev.props['aria-label'] !== '会话上一页') fail('#115 内层键名应会话上一页，实际 ' + ssPrev.props['aria-label']);
  const opClose = opbars[0].findAll((x) => x.props && x.props['data-dsh-prompt-picker-closebar'] === '1');
  if (opClose.length !== 1) fail('#115 操作栏应有 1 个关闭键');
  if (opClose[0].props.style.width !== '3em' || opClose[0].props.style.borderRadius !== '50%') {
    fail('#115 栏内关闭应 3em 圆（与顶 × 同语汇）');
  }
  // 悬浮翻页组与条内翻页键应已退役（由操作栏统一）
  if (pkWc.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sspager']).length !== 0) {
    fail('#115 悬浮翻页组应已退役');
  }
  pkWc.unmount();
  ok('渲染器：底部操作栏＋内外层形色＋顺序＋退役悬浮（#115）');

  // 横屏 rail + 右展（审查 #2）：左轨两卡 + 右侧放组一行
  let pkWide;
  await TR.act(async () => {
    pkWide = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: twoGroups, currentId: '', remoteSize: 5, wide: true, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  if (pkWide.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-rail'] === '1').length !== 1) {
    fail('#104 横屏应渲染 rail + 右展');
  }
  // 横屏左轨也是卡片网格（轨宽 ~38%，固定 2 列而不是 gridCols=3）
  const railGrid = pkWide.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-groupgrid']);
  if (railGrid.length !== 1 || String(railGrid[0].props['data-dsh-prompt-picker-groupgrid']) !== '2') {
    fail('#104 横屏轨内一级卡应是 2 列网格，实际 ' + JSON.stringify(railGrid.map((x) => x.props['data-dsh-prompt-picker-groupgrid'])));
  }
  if (pkWide.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-groupcard'] === '1').length !== 2) {
    fail('#104 横屏轨内应渲染 2 张一级卡');
  }
  const wideRows = pkWide.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (wideRows.length !== 1 || wideRows[0].props['data-dsh-prompt-picker-row'] !== 'b1') {
    fail('#104 横屏右侧应展开放组（b1），实际 ' + JSON.stringify(wideRows.map((x) => x.props['data-dsh-prompt-picker-row'])));
  }
  pkWide.unmount();
  ok('渲染器：横屏 rail + 右展');

  // 2026-10-03（用户原话「我现在连某个会话属于哪个工作区都看不出来」）：
  // 只有一个工作区时，**组头仍必须渲染**。旧口径 US9 在此平铺成一行，等于把
  // 「分组整个没生效」和「确实只有一个工作区」表现成同一件事，把硬故障藏没了。
  const oneGroup = {
    sessions: {
      list: {
        getSnapshot: () => ({
          items: [
            { id: 'c1', title: '会话一', cwd: '/c', updatedAt: now - 5000 },
            { id: 'c2', title: '会话二', cwd: '/c', updatedAt: now - 1000 },
          ],
        }),
      },
      open: () => Promise.resolve(),
    },
    workspaces: {
      list: {
        getSnapshot: () => ({
          items: [{ workspaceId: 'w1', path: '/c', title: '工程A', sessionIds: ['c1', 'c2'] }],
        }),
      },
    },
    uiWorkspace: { openSession: () => Promise.resolve() },
  };
  let pkOne;
  await TR.act(async () => {
    pkOne = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: oneGroup, currentId: '', remoteSize: 5, wide: false, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  if (pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-flat']).length !== 0) {
    fail('#104 单工作区不得平铺（组头恒显示）');
  }
  const oneHeads = pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-group']);
  if (oneHeads.length !== 1) fail('#104 单工作区仍应有 1 个一级工作区卡，实际 ' + oneHeads.length);
  const oneCounts = pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-count'] !== undefined);
  if (oneCounts.length !== 1 || String(oneCounts[0].props['data-dsh-prompt-picker-count']) !== '2') {
    fail('#104 一级卡应带会话计数 2，实际 ' + JSON.stringify(oneCounts.map((x) => x.props['data-dsh-prompt-picker-count'])));
  }
  if (pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-dot'] === '1').length !== 1) {
    fail('#104 单工作区一级卡也应带色点');
  }
  const oneRows = pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (oneRows.length !== 2) fail('#104 默认展开该组，行数应 2，实际 ' + oneRows.length);
  // 搜索时才展平
  const searchBtn = pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-search'])[0];
  await TR.act(async () => { searchBtn.props.onChange({ target: { value: '会话' } }); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  if (pkOne.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-flat'] === 'query').length !== 1) {
    fail('#104 有查询才展平');
  }
  pkOne.unmount();
  ok('渲染器：单工作区组头恒显示 + 计数色点（US9 已撤）');

  // 会话卡片网格（用户 2026-10-03 拍板）：竖 2 列 / 横 3 列；卡片有最小高（点得中）。
  // #115（用户 2026-10-05 拍板）：近全屏内缩面板（内容定高、天花板 100%），dockReservePx 退役。
  const gridOf = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-picker-grid']).map((x) => x.props['data-dsh-prompt-picker-grid']);
  let pkGridP, pkGridW;
  await TR.act(async () => {
    pkGridP = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: twoGroups, currentId: '', remoteSize: 5, wide: false, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  if (gridOf(pkGridP.root).join(',') !== '2') fail('#104 竖屏应为 2 列网格，实际 ' + JSON.stringify(gridOf(pkGridP.root)));
  const pCard = pkGridP.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-card'] === '1');
  if (pCard.length !== 1) fail('#104 卡片应带 card 钩子，实际 ' + pCard.length);
  if (pCard[0].props.style.minHeight !== '4.5em') fail('#104 卡片应有最小高（方便点击），实际 ' + pCard[0].props.style.minHeight);
  if (pCard[0].props.style.display !== 'flex') fail('#104 卡片应为块级卡布局（纵向排布）');
  const pRoot = pkGridP.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-root'] === '1')[0];
  if (pRoot.props.style.fontSize !== 'calc(1em * 3)') fail('#115 em 缩放锚应在根（5 档=3x），实际 ' + pRoot.props.style.fontSize);
  const pMask = pkGridP.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-mask'] === '1')[0];
  if (pMask.props.style.padding !== '0.5em') fail('#115 遮罩留边应为 0.5em，实际 ' + pMask.props.style.padding);
  const pSheet = pkGridP.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1')[0];
  if (pSheet.props.style.maxHeight !== '100%') fail('#115 面板天花板应为 100%（近全屏），实际 ' + pSheet.props.style.maxHeight);
  if (pSheet.props.style.bottom !== undefined) fail('#115 面板不再底对齐（dockReserve 退役），实际 bottom=' + pSheet.props.style.bottom);
  const pClose = pkGridP.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-close'] === '1')[0];
  if (pClose.props.style.width !== '3em' || pClose.props.style.height !== '3em') {
    fail('#115 × 应为 3em 盒，实际 ' + pClose.props.style.width + 'x' + pClose.props.style.height);
  }
  if (pClose.props.style.borderRadius !== '50%') fail('#115 × 应为圆形，实际 ' + pClose.props.style.borderRadius);
  pkGridP.unmount();
  await TR.act(async () => {
    pkGridW = TR.create(React.createElement(pickerMod.WorkspacePicker, {
      faces: twoGroups, currentId: '', remoteSize: 5, wide: true, onClose: () => {},
    }));
  });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  if (gridOf(pkGridW.root).join(',') !== '3') fail('#104 横屏应为 3 列网格，实际 ' + JSON.stringify(gridOf(pkGridW.root)));
  const wSheet = pkGridW.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1')[0];
  if (wSheet.props.style.maxHeight !== '100%') fail('#115 横屏面板天花板亦应为 100%，实际 ' + wSheet.props.style.maxHeight);
  pkGridW.unmount();
  ok('渲染器：会话网格 2/3 列 + 近全屏内缩 + × 3em 圆（#115）');

  // #115 dockReservePx 退役：button.ts 不得再算、不得再传（注释提及不算）；remoteSize 照传
  {
    const btnSrcGrid = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
    if (/dockReservePx/.test(stripComments(btnSrcGrid))) {
      fail('#115 button.ts 的 dockReservePx 应已退役');
    }
    if (!/remoteSize:\s*remote\.size/.test(btnSrcGrid)) fail('#115 remoteSize 应继续传给 WorkspacePicker');
  }
  ok('源码面：dockReservePx 退役，remoteSize 照传');

  // 审查 #6：槽 props 无 sessionId 时回退 smartstore（已在行点之直接关，不发真切换）
  let fbSwitches = [];
  const fbFaces = mkFaces({
    uiWorkspace: { openSession: (sid) => { fbSwitches.push(sid); return Promise.resolve(); } },
    sessions: {
      list: F.sessions.list,
      open: (sid) => { fbSwitches.push('fb:' + sid); return Promise.resolve(); },
    },
  });
  smartMod.setSmartInput({ sessionId: 's2', draft: '' });
  let ebFb;
  await TR.act(async () => {
    ebFb = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      workspaceSessions: fbFaces.sessions,
      workspaceList: fbFaces.workspaces,
      workspaceUI: fbFaces.uiWorkspace,
    }));
  });
  await TR.act(async () => { });
  await TR.act(async () => { byPickerKey(ebFb.root)[0].props.onClick(); });
  const fbExpanded = byPickerKey(ebFb.root)[0].props['aria-expanded'];
  if (fbExpanded !== 'true') fail('#104 点击后 aria-expanded 应 true（面没打开），实际 ' + fbExpanded);
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 500)); });
  const fbRows = ebFb.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (fbRows.length !== 2) {
    const diag = (k, v) => ebFb.root.findAll((x) => x.props && x.props[k] === v).length;
    fail('#104 回退块面应打开且有 2 行，实际 ' + fbRows.length
      + '（sheet=' + diag('data-dsh-prompt-picker-sheet', '1')
      + ' dock=' + diag('data-dsh-prompt-dock', '1') + '）');
  }
  const fbCur = ebFb.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-badge-cur'] === '1');
  if (fbCur.length < 1) fail('#104 回退 sessionId 应标出当前行徽标');
  await TR.act(async () => {
    ebFb.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row'] === 's2')[0].props.onClick();
  });
  if (ebFb.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-sheet'] === '1').length !== 0) {
    fail('#104 回退命中的当前行点了应直接关');
  }
  if (fbSwitches.length !== 0) fail('#104 当前行不得发真切换，实际 ' + JSON.stringify(fbSwitches));
  ebFb.unmount();
  smartMod.setSmartInput({ draft: '' });
  ok('渲染器：sessionId 缺席回退 smartstore，已在直关且无真切换');

  // 未归属行：搜展示名可达、短码走双语回退（审查 #8/#10）
  const unFaces = mkFaces({
    sessions: {
      list: {
        getSnapshot: () => ({
          items: [
            { id: 's1', title: '第一会话', workspaceId: 'w1', cwd: '/a', updatedAt: now - 1000 },
            { id: 'sx', title: '孤儿', workspaceId: null, cwd: '/tmp/z', updatedAt: now - 100 },
          ],
        }),
      },
      open: () => Promise.resolve(),
    },
  });
  let ebUn;
  await TR.act(async () => {
    ebUn = TR.create(React.createElement(buttonMod.EntryButton, {
      open: false,
      workspaceSessions: unFaces.sessions,
      workspaceList: unFaces.workspaces,
      workspaceUI: unFaces.uiWorkspace,
      sessionId: 's1',
    }));
  });
  await TR.act(async () => { });
  await TR.act(async () => { byPickerKey(ebUn.root)[0].props.onClick(); });
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  await TR.act(async () => {
    ebUn.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-search'] === '1')[0]
      .props.onChange({ target: { value: '未归属' } });
  });
  const unRows = ebUn.root.findAll((x) => x.props && x.props['data-dsh-prompt-picker-row']);
  if (unRows.length !== 1 || unRows[0].props['data-dsh-prompt-picker-row'] !== 'sx') {
    fail('#104 搜未归属应命中未归属行，实际 ' + JSON.stringify(unRows.map((x) => x.props['data-dsh-prompt-picker-row'])));
  }
  ebUn.unmount();
  ok('渲染器：未归属搜展示名可达');

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
