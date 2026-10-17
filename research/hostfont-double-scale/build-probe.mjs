/**
 * 生成忠实探针 probe-double-scale.html（issue #160 复核）。
 *
 * 为什么用生成器而不是手写 HTML：
 * 探针里的宿主派生链规则必须是**宿主体内那一份的原文**，不能靠手抄。
 * 本脚本从 asar 镜子里取出 `gradient_shadow_text_css_default` 这个 JS 字符串字面量、
 * 解码、与 `.dsh-extract/theme-css/gradient_shadow_text_css_default.css` 逐字节比对，
 * 再把其中「含 --dsw-font-markdown-base-font-size 的那条 body{...} 规则」原样嵌入探针。
 *
 * 跑法：node research/hostfont-double-scale/build-probe.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const HOST_CLIENT = path.join(
  ROOT, '.dsh-extract', 'dsh', 'node_modules', '@deepseek-ai',
  'dsh-client-ui-theme', 'lib', 'client.js'
)
const HOST_CSS_MIRROR = path.join(ROOT, '.dsh-extract', 'theme-css', 'gradient_shadow_text_css_default.css')
const OUT = path.join(ROOT, 'research', 'hostfont-double-scale', 'probe-double-scale.html')

// ── 1. 取 host client.js:1160 的字符串字面量并解码 ──
const src = fs.readFileSync(HOST_CLIENT, 'utf8')
const lines = src.split(/\r?\n/)
const lineNo = lines.findIndex((l) => l.includes('var gradient_shadow_text_css_default = "'))
if (lineNo < 0) throw new Error('未找到 gradient_shadow_text_css_default 声明行')
const line = lines[lineNo]
const open = line.indexOf('= "') + 2
const close = line.lastIndexOf('";')
if (close < open) throw new Error('字符串字面量边界未找到')
const bundle = JSON.parse(line.slice(open, close + 1))

// ── 2. 与 asar 抽取镜像逐字节比对（来源可信度锚） ──
const mirror = fs.readFileSync(HOST_CSS_MIRROR, 'utf8')
const mirrorCrlf = fs.readFileSync(HOST_CSS_MIRROR, 'utf8').replace(/\r\n/g, '\n')
const identical = bundle === mirror || bundle === mirrorCrlf
console.log(`# host client.js:${lineNo + 1}  var gradient_shadow_text_css_default  len=${line.length}  bundleLen=${bundle.length}`)
console.log(`# mirror .dsh-extract/theme-css/gradient_shadow_text_css_default.css  len=${mirror.length}`)
console.log(`# byte-identical(bundle vs mirror) = ${identical}`)
if (!identical) throw new Error('宿主 bundle 与抽取镜像不一致，探针不具备保真度')

// ── 3. 摘出含 markdown 基准变量的那条 body{...} 规则原文 ──
const anchor = bundle.indexOf('body{--dsh-content-font-delta')
if (anchor < 0) throw new Error('未找到 --dsh-content-font-delta 所在的 body 规则')
const end = bundle.indexOf('}', anchor)
if (end < 0) throw new Error('body 规则未闭合')
const fontChainRule = bundle.slice(anchor, end + 1)
console.log(`# font-chain body rule len=${fontChainRule.length}`)
console.log(`#   has markdown base var = ${fontChainRule.includes('--dsw-font-markdown-base-font-size:var(--dsh-content-font-size,14px)')}`)
console.log(`#   has delta             = ${fontChainRule.includes('--dsh-content-font-delta:calc(')}`)

// ── 4. 插件侧常量：直接从源码抽出，禁止手抄 ──
const remoteView = fs.readFileSync(path.join(ROOT, 'src', 'client', 'remoteView.ts'), 'utf8')
const scalesLit = remoteView.match(/REMOTE_SIZE_SCALES\s*=\s*(\[[^\]]*\])/)
if (!scalesLit) throw new Error('未找到 REMOTE_SIZE_SCALES')
const REMOTE_SIZE_SCALES = JSON.parse(scalesLit[1])
const baseVarLit = remoteView.match(/BASE_FONT_VAR\s*=\s*'([^']+)'/)
if (!baseVarLit) throw new Error('未找到 BASE_FONT_VAR')
const BASE_FONT_VAR = baseVarLit[1]
const hostfont = fs.readFileSync(path.join(ROOT, 'src', 'client', 'hostfont.ts'), 'utf8')
const varNameLit = hostfont.match(/HOST_CONTENT_FONT_VAR\s*=\s*'([^']+)'/)
if (!varNameLit) throw new Error('未找到 HOST_CONTENT_FONT_VAR')
const HOST_CONTENT_FONT_VAR = varNameLit[1]
const overrideLine = hostfont.split(/\r?\n/).find((l) => l.includes('applyOwnedStyle(doc, HOST_FONT_STYLE_ID,'))
const EXPECT_OVERRIDE_LINE =
  "    applyOwnedStyle(doc, HOST_FONT_STYLE_ID, 'body{' + HOST_CONTENT_FONT_VAR + ':' + px + ' !important;}')"
if (!overrideLine || overrideLine !== EXPECT_OVERRIDE_LINE) {
  throw new Error('hostfont.ts 覆盖段拼装行与预期不符，实际: ' + JSON.stringify(overrideLine))
}
const OVERRIDE_TEMPLATE = 'body{--dsh-content-font-size:<px> !important;}'
console.log(`# REMOTE_SIZE_SCALES = ${JSON.stringify(REMOTE_SIZE_SCALES)}`)
console.log(`# BASE_FONT_VAR      = ${BASE_FONT_VAR}`)
console.log(`# HOST_CONTENT_FONT_VAR = ${HOST_CONTENT_FONT_VAR}`)
console.log(`# override template  = ${OVERRIDE_TEMPLATE}`)
const roundOf = (size) => {
  const v = typeof size === 'number' && isFinite(size) ? Math.min(10, Math.max(1, Math.round(size))) : NaN
  const idx = v >= 1 && v <= 10 ? v : 5
  return REMOTE_SIZE_SCALES[idx - 1]
}
console.log(`# hostContentFontPx(1)=${Math.round(roundOf(1) * 14)} hostContentFontPx(5)=${Math.round(roundOf(5) * 14)} hostContentFontPx(10)=${Math.round(roundOf(10) * 14)}`)
console.log(`# remoteSizeScale(1)=${roundOf(1)} remoteSizeScale(5)=${roundOf(5)} remoteSizeScale(10)=${roundOf(10)}`)

const renderOverride = (px) => OVERRIDE_TEMPLATE.replace('<hostContentFontPx>', String(px)).replace('<px>', String(px))

const html = `<!doctype html>
<!--
  issue #160 复核探针（生成物，勿手改；改 build-probe.mjs 后重跑）

  保真度声明：
  - 宿主派生链规则 = asar 内 dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:${lineNo + 1}
    的 gradient_shadow_text_css_default 字符串，与 .dsh-extract/theme-css/ 镜像逐字节一致
    （build-probe.mjs 每次生成时校验，不一致就报错退出）。
  - 宿主写入方式 = dsh-client-ui-layout/lib/client.js:539 的 body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, \`\${snapshot.fontSize}px\`)
    （普通优先级行内声明），此处原样复刻。
  - 宿主样式表安装方式 = dsh-client-ui-theme/lib/client.js:1181-1193 installThemeStyles：
    <style data-plugin="@deepseek-ai/dsh-client-ui-theme" data-plugin-css=".../gradient-shadow-text.css"> 挂 document.head。
  - 插件覆盖 = src/client/hostfont.ts:92 的逐字形状 '${OVERRIDE_TEMPLATE}'，走 <style data-plugin="dsh-prompt">。
  - 自家面字号 = src/client/settings.ts:649 / panel.ts:1359,1364 / smart.ts:350 / button.ts:403 的逐字表达式；
    button.ts:440 的入口条走绝对 px，作为「只吃一遍」的对照组。
  - 未复刻：宿主 React 树形（无关：自定义属性按继承传播，与祖先 font-size 无关）。
-->
<html>
<head>
<meta charset="utf-8">
<title>#160 double-scale probe</title>
<style>
  /* 宿主装表 + 自家面消费方（选择器形状取自宿主模块与插件源码，值逐字） */
  .host-content { font-size: var(${HOST_CONTENT_FONT_VAR}, 14px); }        /* 宿主内容字消费方 */
  .md-base      { font-size: var(--dsw-font-markdown-base-font-size); }     /* 派生链中点 */
  /* 插件自家面（开机后由 JS 写内联 style，与 h(..., {style:{fontSize}}) 同义）；下面只给定位壳 */
  .own { outline: 1px dotted #888; }
</style>
</head>
<body>
  <div id="hostContent" class="host-content">host content</div>
  <div id="mdBase" class="md-base">markdown base</div>
  <div id="settRoot" class="own">plugin settings root</div>
  <div id="panelRoot" class="own">plugin panel root</div>
  <div id="smartCard" class="own">plugin smart card</div>
  <div id="gearCard" class="own">plugin gear modal card root (button.ts:403)</div>
  <div id="entryBar" class="own">plugin entry bar (absolute px, button.ts:440)</div>
  <div id="hostUserProbe" class="own">host user value probe</div>
  <pre id="out"></pre>
<script>
'use strict';
// ══ 宿主侧（逐条对应宿主源码） ══
var HOST_VAR = ${JSON.stringify(HOST_CONTENT_FONT_VAR)};
// dsh-client-ui-theme/lib/index.js:56 bootThemeBodyScript —— 首屏把用户字号写进 body 行内
function bootThemeBodyScript(fontSizePx) { document.body.style.setProperty(HOST_VAR, fontSizePx + 'px'); }
// dsh-client-ui-theme/lib/client.js:1181-1193 installThemeStyles —— 主题表挂 head
function installThemeStyles() {
  var tag = document.createElement('style');
  tag.dataset.plugin = '@deepseek-ai/dsh-client-ui-theme';
  tag.dataset.pluginCss = '@deepseek-ai/dsh-client-ui-theme/gradient-shadow-text.css';
  tag.textContent = HOST_BUNDLE_RULE;
  document.head.appendChild(tag);
  return tag;
}
// dsh-client-ui-layout/lib/client.js:539 ThemePresenter.apply
function themePresenterApply(fontSizePx) { document.body.style.setProperty(HOST_VAR, fontSizePx + 'px'); }
function hostInlineValue() { return document.body.style.getPropertyValue(HOST_VAR).trim(); }

// ══ 插件侧 ══
// src/client/remoteView.ts:132,141,149-151,167-174（逐字语义）
var REMOTE_SIZE_SCALES = ${JSON.stringify(REMOTE_SIZE_SCALES)};
function remoteSizeScale(size) {
  var v = (typeof size === 'number' && isFinite(size)) ? Math.min(10, Math.max(1, Math.round(size))) : NaN;
  var idx = (v >= 1 && v <= 10) ? v : 5;
  return REMOTE_SIZE_SCALES[idx - 1];
}
var BASE_FONT_VAR = ${JSON.stringify(BASE_FONT_VAR)};
function scaledBaseFontSize(enabled, size) {
  if (enabled !== true) return BASE_FONT_VAR;
  return 'calc(' + BASE_FONT_VAR + ' * ' + remoteSizeScale(size) + ')';
}
function hostContentFontPx(size) {
  if (typeof size !== 'number' || !isFinite(size)) return 14;
  return Math.round(remoteSizeScale(size) * 14);
}
// src/client/hostfont.ts:92 syncHostFont 的声明式覆盖段
var HOST_FONT_STYLE_ID = 'dsh-prompt-remote-hostfont';
function syncHostFont(enabled, size) {
  dropOwnedStyle();
  if (enabled !== true || typeof size !== 'number' || !isFinite(size)) return null;
  var st = document.createElement('style');
  st.setAttribute('data-plugin', 'dsh-prompt');
  st.setAttribute('data-dsh-prompt-style', HOST_FONT_STYLE_ID);
  st.textContent = 'body{' + HOST_VAR + ':' + hostContentFontPx(size) + 'px !important;}';
  document.head.appendChild(st);
  return st;
}
function dropOwnedStyle() {
  var prev = document.head.querySelector('[data-dsh-prompt-style="' + HOST_FONT_STYLE_ID + '"]');
  if (prev) prev.remove();
}

// ══ 自家面落点（逐字对应插件源码的 fontSize 表达式） ══
function paintOwnSurfaces() {
  var remote = window.__scenario;
  // settings.ts:649 —— 设置页根
  document.getElementById('settRoot').style.fontSize = scaledBaseFontSize(remote.enabled, remote.size);
  // panel.ts:1333,1359 —— 面板根（非设置页分支：uiFontScale = remoteSizeScale(enabled ? size : 1)）
  document.getElementById('panelRoot').style.fontSize =
    'calc(var(--dsw-font-markdown-base-font-size) * ' + remoteSizeScale(remote.enabled ? remote.size : 1) + ')';
  // smart.ts:205,350 —— 智能卡根（remoteChromeScale = remoteSizeScale）
  document.getElementById('smartCard').style.fontSize =
    'calc(var(--dsw-font-markdown-base-font-size) * ' + remoteSizeScale(remote.enabled ? remote.size : 1) + ')';
  // button.ts:400-404 —— 齿轮弹窗卡片根（gearCardStyle，包 SettingsPage）
  document.getElementById('gearCard').style.fontSize =
    'calc(var(--dsw-font-markdown-base-font-size) * ' + remoteSizeScale(remote.enabled ? remote.size : 1) + ')';
  // button.ts:272,440 / :716 —— 入口条与 Dock 走**绝对 px**（12 * remoteChromeScale），不吃宿主变量基
  document.getElementById('entryBar').style.fontSize =
    (12 * remoteSizeScale(remote.enabled ? remote.size : 1)) + 'px';
  // 修法方向的演示：自家面锚到「宿主行内用户设定值」（parseFloat 自行内声明，不被自家覆盖影响），
  // 只吃一遍档位。注意不能用 var(--dsh-content-font-size) 读——那个已被自家覆盖段改写为 42px。
  var hostUserPx = parseFloat(hostInlineValue()) || 14;
  var tierNow = remote.enabled === true ? remoteSizeScale(remote.size) : 1;
  document.getElementById('hostUserProbe').style.fontSize = (tierNow * hostUserPx) + 'px';
}

// ══ 测量 ══
var cs = function (id) { return getComputedStyle(document.getElementById(id)); };
var fpx = function (id) { return cs(id).fontSize; };
var bodyVar = function (name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); };

var out = [];
function line(s) { out.push(s); }
function scenario(name, hostUserPx, enabled, size) {
  window.__scenario = { enabled: enabled, size: size };
  syncHostFont(enabled, size);
  // 宿主 ThemePresenter 每次 theme/change 重放自己的值（普通行内声明，被自家 !important 压住）
  themePresenterApply(hostUserPx);
  paintOwnSurfaces();
  var tier = enabled === true ? remoteSizeScale(size) : 1;
  var expectFixed = (tier * hostUserPx).toFixed(2).replace(/\\.00$/, '');
  line('');
  line('== ' + name + ' ==');
  line('  hostInline(--dsh-content-font-size, 宿主用户设定) = ' + hostInlineValue());
  line('  body computed --dsh-content-font-size           = ' + bodyVar(HOST_VAR));
  line('  body computed --dsw-font-markdown-base-font-size = ' + bodyVar('--dsw-font-markdown-base-font-size'));
  line('  hostContent(宿主内容字, #92)                     = ' + fpx('hostContent'));
  line('  mdBase(派生链中点)                               = ' + fpx('mdBase'));
  line('  own.settingsRoot  settings.ts:649                 = ' + fpx('settRoot'));
  line('  own.panelRoot     panel.ts:1359                  = ' + fpx('panelRoot'));
  line('  own.smartCard     smart.ts:350                   = ' + fpx('smartCard'));
  line('  own.gearCard      button.ts:403                  = ' + fpx('gearCard'));
  line('  own.entryBar      button.ts:440（绝对 px，应只一遍） = ' + fpx('entryBar'));
  line('  [修法演示] 自家面锚宿主行内用户值 x 单遍档位     = ' + fpx('hostUserProbe'));
  line('  [推导] 档位倍数 x 宿主用户设定 = ' + tier + ' x ' + hostUserPx + ' = ' + expectFixed + 'px');
  line('  [推导] 档位倍数^2 x 基线14     = ' + (tier * tier * 14) + 'px');
}

// 首屏：宿主 boot script 与主题表（顺序同宿主：boot 先写行内，表后挂 head）
bootThemeBodyScript(14);
var hostSheet = installThemeStyles();

scenario('S0 关闭远程档位（宿主用户设定 14px，无自家覆盖段）', 14, false, 5);
scenario('S1 远程 1 档（覆盖 14px !important）', 14, true, 1);
scenario('S2 远程 5 档（覆盖 42px !important）', 14, true, 5);
scenario('S3 远程 5 档 + 宿主用户设定 22px（覆盖 42px 仍赢）', 22, true, 5);
scenario('S4 远程 10 档（覆盖 77px !important）', 14, true, 10);
scenario('S5 关闭远程 + 宿主用户设定 22px（自家面回宿主用户值）', 22, false, 5);
scenario('S6 远程 2 档（覆盖 21px !important）', 14, true, 2);

// 关闭态零写入自证（#148 语义）
window.__scenario = { enabled: false, size: 5 };
syncHostFont(false, 5);
line('');
line('== 附：关闭态宿主状态自证 ==');
line('  自家覆盖段仍存在？ ' + (document.head.querySelector('[data-dsh-prompt-style="' + HOST_FONT_STYLE_ID + '"]') !== null));
line('  宿主行内原样？     ' + hostInlineValue());

document.title = 'PROBE DONE';
var pre = document.getElementById('out');
pre.textContent = '\\n' + out.join('\\n') + '\\n';
pre.setAttribute('data-probe', 'done');
</script>
</body>
</html>
`.replace('HOST_BUNDLE_RULE', () => JSON.stringify(fontChainRule))

fs.writeFileSync(OUT, html, 'utf8')
console.log(`# wrote ${path.relative(ROOT, OUT)}  (${html.length} bytes)`)

// ══════════════════════════════════════════════════════════════════════════
// 第二个探针：#148 前后「自限 vs 常驻」对照
// 旧实现取 git 47d58d3:src/client/hostfont.ts:36-46,80-84（documentElement + body 双写
// setProperty / removeProperty）；新实现取 9ecd0c3 起的声明式覆盖（src/client/hostfont.ts:92）。
// ══════════════════════════════════════════════════════════════════════════
const OUT2 = path.join(ROOT, 'research', 'hostfont-double-scale', 'probe-148-persistence.html')
const html2 = `<!doctype html>
<!--
  issue #160 第三分句复核：#148 是否让「自家面吃两遍档位」从自限变成常驻。
  旧实现（git 47d58d3:src/client/hostfont.ts:36-46 collectStyleTargets = documentElement + body；
  :80-84 逐个 st.setProperty(HOST_CONTENT_FONT_VAR, px)）＝ 行内双写、普通优先级。
  新实现（src/client/hostfont.ts:92）＝ <style> body{var:42px !important}。
  宿主重放（dsh-client-ui-layout/lib/client.js:539）＝ body.style.setProperty(HOST_VAR, 用户值+'px')，
  普通优先级 ⇒ 压不住 !important，但能压住旧实现的行内同优先级后写。
  生成物，勿手改；改 build-probe.mjs 后重跑。
-->
<html><head><meta charset="utf-8"><title>#148 persistence probe</title>
<style>
  .own { font-size: calc(var(--dsw-font-markdown-base-font-size) * 3); }  /* settings.ts:649 @5档 */
  .md  { font-size: var(--dsw-font-markdown-base-font-size); }
</style></head>
<body>
  <div id="own" class="own">own surface</div>
  <div id="md" class="md">md base</div>
  <pre id="out"></pre>
<script>
'use strict';
var HOST_VAR = '--dsh-content-font-size';
var hostSheet = document.createElement('style');
hostSheet.dataset.plugin = '@deepseek-ai/dsh-client-ui-theme';
hostSheet.textContent = HOST_BUNDLE_RULE;
document.head.appendChild(hostSheet);

function hostReplay(px) { document.body.style.setProperty(HOST_VAR, px + 'px'); }   // layout client.js:539
function ownPx() { return getComputedStyle(document.getElementById('own')).fontSize; }
function mdPx() { return getComputedStyle(document.getElementById('md')).fontSize; }
function bodyVar() { return getComputedStyle(document.body).getPropertyValue(HOST_VAR).trim(); }

var out = [];
function line(s) { out.push(s); }
function m(label) { line('    ' + label + '  own=' + ownPx() + '  mdBase=' + mdPx() + '  bodyVar=' + bodyVar()); }

function oldWrite(px) {   // 47d58d3:36-46 + :80-84
  var targets = [document.documentElement.style, document.body.style];
  for (var i = 0; i < targets.length; i++) targets[i].setProperty(HOST_VAR, px + 'px');
}
function oldClear() {
  var targets = [document.documentElement.style, document.body.style];
  for (var i = 0; i < targets.length; i++) targets[i].removeProperty(HOST_VAR);
}
function newOverlay(px) {   // 9ecd0c3+（src/client/hostfont.ts:92）
  var prev = document.head.querySelector('[data-dsh-prompt-style="dsh-prompt-remote-hostfont"]');
  if (prev) prev.remove();
  var st = document.createElement('style');
  st.setAttribute('data-plugin', 'dsh-prompt');
  st.setAttribute('data-dsh-prompt-style', 'dsh-prompt-remote-hostfont');
  st.textContent = 'body{' + HOST_VAR + ':' + px + 'px !important;}';
  document.head.appendChild(st);
  return st;
}
function newClear() {
  var prev = document.head.querySelector('[data-dsh-prompt-style="dsh-prompt-remote-hostfont"]');
  if (prev) prev.remove();
}

line('===== A. 旧实现（#148 之前：documentElement + body 行内双写） =====');
hostReplay(14);                       // 宿主首屏/快照
line('  A0 宿主 14px、插件未写');
m('基线');
oldWrite(42);                         // 插件开 5 档
line('  A1 插件双写 42px（此刻直到宿主下一次重放）');
m('旧实现写入后');
hostReplay(14);                       // 宿主 theme/change 重放自己的 14px
line('  A2 宿主重放 14px 之后（「自限」发生点）');
m('宿主重放后');
hostReplay(22);                       // 用户在宿主设置里改到 22px
line('  A3 宿主再重放 22px');
m('再次重放后');
oldClear();                           // 旧实现关闭态 removeProperty
line('  A4 旧实现关闭（removeProperty 两边）');
m('关闭后');

line('');
line('===== B. 新实现（#148：body{var:42px !important} 声明式覆盖） =====');
hostReplay(14);
line('  B0 宿主 14px、插件未写');
m('基线');
newOverlay(42);
line('  B1 插件覆盖 42px !important');
m('覆盖后');
hostReplay(14);
line('  B2 宿主重放 14px（旧实现在此被打回，新实现应压住）');
m('重放后');
hostReplay(22);
line('  B3 宿主再重放 22px');
m('再次重放后');
var overlay = document.head.querySelector('[data-dsh-prompt-style="dsh-prompt-remote-hostfont"]');
newClear();
line('  B4 摘掉自家段（关远程）');
m('摘段后');
line('  宿主行内（B4） = ' + document.body.style.getPropertyValue(HOST_VAR).trim() + '  ← 全程未被插件改过');

document.title = 'PERSISTENCE PROBE DONE';
var pre = document.getElementById('out');
pre.textContent = '\\n' + out.join('\\n') + '\\n';
pre.setAttribute('data-probe', 'done');
</script></body></html>
`.replace('HOST_BUNDLE_RULE', () => JSON.stringify(fontChainRule))
fs.writeFileSync(OUT2, html2, 'utf8')
console.log(`# wrote ${path.relative(ROOT, OUT2)}  (${html2.length} bytes)`)

// ══════════════════════════════════════════════════════════════════════════
// 第三个产物：可视化海报（同样在真实浏览器里现算，供截图取证）
// ══════════════════════════════════════════════════════════════════════════
const OUT3 = path.join(ROOT, 'research', 'hostfont-double-scale', 'poster-double-scale.html')
const html3 = `<!doctype html>
<!-- issue #160 可视化海报：所有数字都在本页真实浏览器里用 getComputedStyle 现算，非手抄。
     宿主规则 = asar dsh-client-ui-theme/lib/client.js:1160 原文（build-probe.mjs 注入）。
     生成物，勿手改。 -->
<html><head><meta charset="utf-8"><title>#160 double-scale poster</title>
<style>
  body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 22px 26px;
         background: #14161a; color: #e8eaed; width: 1120px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { font-size: 13px; color: #9aa0a6; margin-bottom: 18px; }
  .row { display: flex; gap: 18px; margin-bottom: 16px; }
  .card { flex: 1; min-width: 0; overflow: hidden; background: #1e2126; border: 1px solid #33373d; border-radius: 10px; padding: 12px 14px; }
  .card h2 { font-size: 13px; margin: 0 0 8px; color: #9aa0a6; font-weight: 600; letter-spacing: .04em; }
  .big { font-size: 44px; font-weight: 700; color: #ffb454; line-height: 1; }
  .big.ok { color: #7fd18a; }
  .big.bad { color: #ff6b6b; }
  .cap { font-size: 12px; color: #9aa0a6; margin-top: 6px; }
  .sample { border-top: 1px dashed #3a3f46; margin-top: 10px; padding-top: 8px; white-space: nowrap; overflow: hidden; }
  table { border-collapse: collapse; font-size: 13px; }
  td, th { border: 1px solid #33373d; padding: 5px 10px; text-align: left; }
  th { background: #23262b; color: #9aa0a6; font-weight: 600; }
  code { color: #7fb2ff; }
  .verdict { font-size: 15px; font-weight: 700; margin-top: 4px; }
</style></head>
<body>
<h1>issue #160 · 远程档位下插件自家面「乘两遍」复核</h1>
<div class="sub">下面每个数字都是本页在真实 Chromium 里用 getComputedStyle 现算的（宿主派生链 = asar 原文注入）。</div>
<div class="row">
  <div class="card"><h2>宿主内容字（#92，应跟档一遍）</h2><div class="big ok" id="hostN">…</div>
    <div class="cap">5 档 · var(--dsh-content-font-size)</div>
    <div class="sample" id="hostSample">正文样例 Aa 123</div></div>
  <div class="card"><h2>插件自家面根（settings.ts:649）</h2><div class="big bad" id="ownN">…</div>
    <div class="cap">5 档 · calc(var(--dsw-font-markdown-base-font-size) × 3)</div>
    <div class="sample" id="ownSample">设置页样例 Aa 123</div></div>
</div>
<table>
  <tr><th>场景</th><th>宿主内容字</th><th>自家面根（实测）</th><th>算式</th></tr>
  <tr><td>关闭远程（宿主用户设定 14px）</td><td id="t0h"></td><td id="t0o"></td><td>1 × 14</td></tr>
  <tr><td>远程 1 档</td><td id="t1h"></td><td id="t1o"></td><td>1 × 14</td></tr>
  <tr><td><b>远程 5 档</b></td><td id="t5h"></td><td id="t5o"></td><td id="t5e"></td></tr>
  <tr><td>远程 10 档</td><td id="t10h"></td><td id="t10o"></td><td id="t10e"></td></tr>
  <tr><td>关闭远程（宿主用户设定 22px）</td><td id="t22h"></td><td id="t22o"></td><td>1 × 22</td></tr>
</table>
<div class="verdict" id="verdict"></div>
<pre id="raw" style="display:none"></pre>
<script>
'use strict';
var HOST_VAR = ${JSON.stringify(HOST_CONTENT_FONT_VAR)};
var overlay = null;
var sheet = document.createElement('style');
sheet.dataset.plugin = '@deepseek-ai/dsh-client-ui-theme';
sheet.textContent = HOST_BUNDLE_RULE;
document.head.appendChild(sheet);

function dropOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
// src/client/hostfont.ts:92（5 档 → 42px；1 档 → 14px；10 档 → 77px）
function overlayFor(px) {
  dropOverlay();
  overlay = document.createElement('style');
  overlay.setAttribute('data-plugin', 'dsh-prompt');
  overlay.setAttribute('data-dsh-prompt-style', 'dsh-prompt-remote-hostfont');
  overlay.textContent = 'body{' + HOST_VAR + ':' + px + 'px !important;}';
  document.head.appendChild(overlay);
}
function measure(enabled, size) {
  var probe = document.createElement('div');
  probe.className = 'host-content';
  var md = document.createElement('div');
  md.className = 'md-base';
  var own = document.createElement('div');
  // 与 src/client/remoteView.ts:149-151 scaledBaseFontSize(enabled, size) 逐字同式
  own.style.fontSize = enabled
    ? 'calc(' + ${JSON.stringify(BASE_FONT_VAR)} + ' * ' + remoteSizeScale(size) + ')'
    : ${JSON.stringify(BASE_FONT_VAR)};
  probe.textContent = 'x'; md.textContent = 'x'; own.textContent = 'x';
  document.body.appendChild(probe); document.body.appendChild(md); document.body.appendChild(own);
  var r = {
    host: getComputedStyle(probe).fontSize,
    md: getComputedStyle(md).fontSize,
    own: getComputedStyle(own).fontSize,
    inline: document.body.style.getPropertyValue(HOST_VAR).trim(),
    bodyVar: getComputedStyle(document.body).getPropertyValue(HOST_VAR).trim(),
    mdVar: getComputedStyle(document.body).getPropertyValue('--dsw-font-markdown-base-font-size').trim()
  };
  probe.remove(); md.remove(); own.remove();
  return r;
}
var REMOTE_SIZE_SCALES = ${JSON.stringify(REMOTE_SIZE_SCALES)};
function remoteSizeScale(size) {
  var v = (typeof size === 'number' && isFinite(size)) ? Math.min(10, Math.max(1, Math.round(size))) : NaN;
  var idx = (v >= 1 && v <= 10) ? v : 5;
  return REMOTE_SIZE_SCALES[idx - 1];
}
var hostContentCss = document.createElement('style');
hostContentCss.textContent = '.host-content{font-size:var(' + HOST_VAR + ',14px);}.md-base{font-size:var(--dsw-font-markdown-base-font-size);}';
document.head.appendChild(hostContentCss);

function scenario(hostUserPx, enabled, size) {
  document.body.style.setProperty(HOST_VAR, hostUserPx + 'px');   // 宿主 ThemePresenter.apply（客户端重放）
  if (enabled) {
    var v = (typeof size === 'number' && isFinite(size)) ? Math.min(10, Math.max(1, Math.round(size))) : 5;
    overlayFor(Math.round(REMOTE_SIZE_SCALES[v - 1] * 14));
  } else dropOverlay();
  return measure(enabled, size);
}
function put(id, v) { document.getElementById(id).textContent = v; }

var S = {};
S.s0  = scenario(14, false, 5);
S.s1  = scenario(14, true, 1);
S.s5  = scenario(14, true, 5);
S.s10 = scenario(14, true, 10);
S.s22 = scenario(22, false, 5);

put('hostN', S.s5.host);
put('ownN', S.s5.own);
document.getElementById('hostSample').style.fontSize = S.s5.host;
document.getElementById('ownSample').style.fontSize = S.s5.own;

put('t0h', S.s0.host);   put('t0o', S.s0.own);
put('t1h', S.s1.host);   put('t1o', S.s1.own);
put('t5h', S.s5.host);   put('t5o', S.s5.own);   put('t5e', '3 × 14 = 42 再 × 3 = ' + S.s5.own);
put('t10h', S.s10.host); put('t10o', S.s10.own); put('t10e', '5.5 × 14 = 77 再 × 5.5 = ' + S.s10.own);
put('t22h', S.s22.host); put('t22o', S.s22.own);

var v = document.getElementById('verdict');
var ok = (S.s5.own === '126px' && S.s5.host === '42px' && S.s1.own === '14px' && S.s0.own === '14px');
v.style.color = ok ? '#7fd18a' : '#ff6b6b';
v.textContent = (ok ? '复现成立：5 档自家面 ' + S.s5.own + ' = 42px × 3（宿主内容字 ' + S.s5.host + ' 的 3 倍）'
                    : '未复现，见 raw');
document.getElementById('raw').textContent = JSON.stringify(S, null, 2);
document.title = 'POSTER DONE';
</script></body></html>
`.replace('HOST_BUNDLE_RULE', () => JSON.stringify(fontChainRule))
fs.writeFileSync(OUT3, html3, 'utf8')
console.log(`# wrote ${path.relative(ROOT, OUT3)}  (${html3.length} bytes)`)
