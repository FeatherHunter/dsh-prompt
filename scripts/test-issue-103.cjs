/**
 * #103 回归：主会话 AI 跟随远程档位（野路子三期）。
 *
 * 根因：0.2.0-rc.2 起主会话 AI 正文走定死 --dsw-font-xs-13（13px）+ 标题/code 定死 px，
 * 变量桥（--dsh-content-font-size）够不着；全档位复现。
 * 修法：hostfont.ts 新增 syncAssistantZoom，与 syncRemoteRows 同体例——
 * 选择器只走稳定 data-chat-group-part="response"，zoom 取档位全额，开注/换档更新/关摘。
 *
 * 体例沿用 scripts/test-issue-83.cjs（ts 转译 + 假 document + 源码级断言）。
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const DIR = __dirname;
let failures = 0;
function fail(msg) { console.error('FAIL:', msg); failures++; }
function ok(msg) { console.log('ok:', msg); }

// 1) 转译 hostfont + remoteView（与 83 同形状）
let view;
try {
  const viewSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'remoteView.ts'), 'utf8');
  let viewJs = ts.transpileModule(viewSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(DIR, '.rt-103-remoteView.cjs'), viewJs);
  view = require(path.join(DIR, '.rt-103-remoteView.cjs'));
} catch (e) { fail('remoteView 转译失败：' + ((e && e.message) || e)); }
try {
  const hostSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'hostfont.ts'), 'utf8');
  let hostJs = ts.transpileModule(hostSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  hostJs = hostJs.split('require("./remoteView")').join('require("./.rt-103-remoteView.cjs")');
  fs.writeFileSync(path.join(DIR, '.rt-103-hostfont.cjs'), hostJs);
} catch (e) { fail('hostfont 转译失败：' + ((e && e.message) || e)); }
if (failures) process.exit(1);

const hostfont = require(path.join(DIR, '.rt-103-hostfont.cjs'));
const hostSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'hostfont.ts'), 'utf8');

// 2) 源码级：存在性 + 纪律（无哈希类、无新日志、稳定钩、全额倍数）
if (typeof hostfont.syncAssistantZoom !== 'function') fail('hostfont.ts 缺 syncAssistantZoom（#103）');
if (/haSm5q_|cJsG2q_|xz4KEq_|v1kfCW_|p_wyXq_|qWvkEq_/.test(hostSrc)) fail('hostfont.ts 不应硬编码宿主哈希类名');
if (!/data-chat-group-part/.test(hostSrc)) fail('hostfont.ts 应走稳定 data-chat-group-part="response"');
if (!/dsh-prompt-remote-assistant/.test(hostSrc)) fail('hostfont.ts 应有自家 style 钩 dsh-prompt-remote-assistant');
if (!/remoteSizeScale/.test(hostSrc)) fail('hostfont.ts AI 桥应取档位全额 remoteSizeScale');
if (/__dshPromptLog|logEvent/.test(hostSrc)) fail('hostfont.ts 不应新增日志事件');
const indexSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'index.ts'), 'utf8');
if (!/syncAssistantZoom/.test(indexSrc)) fail('index.ts 应联动 syncAssistantZoom');
if (!/subscribeRemote/.test(indexSrc)) fail('index.ts 应保持 subscribeRemote 接线');
ok('源码纪律（稳定钩/无哈希类/无新日志/接线）');

// 3) 无 DOM 时静默 no-op
try {
  hostfont.syncAssistantZoom(true, 10);
  hostfont.syncAssistantZoom(true, 'x');
  hostfont.syncAssistantZoom(false, 10);
  hostfont.syncAssistantZoom(undefined, undefined);
} catch (e) { fail('无 DOM 时 syncAssistantZoom 不应抛：' + ((e && e.message) || e)); }
if (typeof document !== 'undefined') fail('回归环境应无 DOM');
ok('无 DOM 静默 no-op');

// 4) 假 document 行为：开注 zoom / 换档更新 / 非法回默认 / 关摘
{
  const headKids = [];
  const fakeHead = {
    appendChild: (el) => { headKids.push(el); el.parentNode = fakeHead; return el; },
    removeChild: (el) => { const i = headKids.indexOf(el); if (i >= 0) headKids.splice(i, 1); return el; },
  };
  const mkStyleTag = () => ({
    attrs: {},
    textContent: '',
    parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
  });
  const savedDoc = globalThis.document;
  globalThis.document = {
    head: fakeHead,
    querySelector: () => headKids[0] || null,
    createElement: (tag) => (tag === 'style' ? mkStyleTag() : null),
  };
  try {
    hostfont.syncAssistantZoom(true, 5);
    if (headKids.length !== 1) fail('开应注入 1 枚 style，实际 ' + headKids.length);
    if (headKids[0].attrs['data-dsh-prompt-style'] !== 'dsh-prompt-remote-assistant') fail('style 钩子应为自家 AI 位');
    const expect5 = '[data-chat-group-part="response"]{zoom:2;}';
    if (headKids[0].textContent !== expect5) fail('5 档应写 ' + expect5 + '，实际 ' + headKids[0].textContent);
    // 换档不叠加
    hostfont.syncAssistantZoom(true, 10);
    if (headKids.length !== 1) fail('换档不应叠加 style，实际 ' + headKids.length);
    if (headKids[0].textContent.indexOf('zoom:3.25') < 0) fail('10 档应更新 zoom=3.25，实际 ' + headKids[0].textContent);
    // 1 档=100%
    hostfont.syncAssistantZoom(true, 1);
    if (headKids[0].textContent.indexOf('zoom:1;') < 0) fail('1 档应 zoom=1，实际 ' + headKids[0].textContent);
    // 非法档回默认 5 档 zoom=2（开语义，与行桥一致）
    hostfont.syncAssistantZoom(true, 'x');
    if (headKids[0].textContent.indexOf('zoom:2') < 0) fail('非法档应回默认 zoom=2，实际 ' + headKids[0].textContent);
    // 关摘零残留
    hostfont.syncAssistantZoom(false, 10);
    if (headKids.length !== 0) fail('关应摘掉 style，实际残留 ' + headKids.length);
    // 关后重复关不抛不建
    hostfont.syncAssistantZoom(false, 10);
    if (headKids.length !== 0) fail('重复关不应新建，实际 ' + headKids.length);
    ok('AI 跟随行为（开注zoom/换档更新/非法回默认/关摘）');
  } finally {
    try {
      if (savedDoc === undefined) { try { delete globalThis.document; } catch (e) { globalThis.document = savedDoc; } }
      else globalThis.document = savedDoc;
    } catch (e) { /* ignore */ }
  }
}

// 5) 全链路：偏好变更落到 AI 桥（与变量桥/行桥同路）
try {
  let remoteJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src', 'client', 'remote.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  fs.writeFileSync(path.join(DIR, '.rt-103-remote.cjs'), remoteJs);
  const remote = require(path.join(DIR, '.rt-103-remote.cjs'));
  remote.__resetRemoteForTests();
  const headKids = [];
  const fakeHead = {
    appendChild: (el) => { headKids.push(el); el.parentNode = fakeHead; return el; },
    removeChild: (el) => { const i = headKids.indexOf(el); if (i >= 0) headKids.splice(i, 1); return el; },
  };
  const mkStyleTag = () => ({
    attrs: {}, textContent: '', parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
  });
  const savedDoc = globalThis.document;
  globalThis.document = {
    head: fakeHead,
    querySelector: (sel) => headKids.find((el) => ('style[data-dsh-prompt-style="' + el.attrs['data-dsh-prompt-style'] + '"]') === sel) || null,
    createElement: (tag) => (tag === 'style' ? mkStyleTag() : null),
  };
  const sync = () => {
    const p = remote.getRemotePrefs();
    hostfont.syncAssistantZoom(p.enabled, p.size);
  };
  sync();
  remote.subscribeRemote(sync);
  remote.setRemoteEnabled(true);
  if (headKids.length !== 1 || headKids[0].textContent.indexOf('zoom:2') < 0) fail('开总闸 AI 桥应写默认 5 档 zoom=2，实际 ' + (headKids[0] && headKids[0].textContent));
  remote.setRemoteSize(10);
  if (headKids[0].textContent.indexOf('zoom:3.25') < 0) fail('拖到 10 档 AI 桥应 zoom=3.25，实际 ' + headKids[0].textContent);
  remote.setRemoteEnabled(false);
  if (headKids.length !== 0) fail('关总闸 AI 桥应摘除，实际残留 ' + headKids.length);
  ok('AI 桥全链路（开关/拖档落到 zoom 写操作）');
  remote.__resetRemoteForTests();
  try {
    if (savedDoc === undefined) { try { delete globalThis.document; } catch (e) { globalThis.document = savedDoc; } }
    else globalThis.document = savedDoc;
  } catch (e) { /* ignore */ }
} catch (e) { fail('全链路异常：' + ((e && e.stack) || e)); }

// 清理转译残留
try { fs.unlinkSync(path.join(DIR, '.rt-103-remoteView.cjs')); } catch (e) { /* ignore */ }
try { fs.unlinkSync(path.join(DIR, '.rt-103-hostfont.cjs')); } catch (e) { /* ignore */ }
try { fs.unlinkSync(path.join(DIR, '.rt-103-remote.cjs')); } catch (e) { /* ignore */ }

if (failures) { console.error('FAILURES:', failures); process.exit(1); }
console.log('ALL GREEN: #103');
