// 回归测试 #123：三键TS落地与远程真机验收（TS部分）
// 覆盖 #123 验收自查（承 #119/#120/#121/#122 定稿 + v3 7条）：
//  1) 复用挑选器mask＋缩放根数学，仅对齐/上限/max-width三参数不同
//  2) 键盘感知scrollIntoView＋dvh
//  3) isComposing门
//  4) 双层文案i18n＋恒disabled
//  5) 宽度min(100%-1em,36em)，ADR续篇禁第三套math
//  6) 模型键零占位＋首次一次性提示
//  7) 单模态互斥＋Esc＋遮罩关＋焦点回opener＋session校验＋去抖串行
// 口径：纯函数走转译断言，其余走源码级（禁止第三套math、零占位、单模态）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-123');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const PURE_TS = path.join(ROOT, 'src', 'client', 'remoteInput.ts');

// ── 1) 纯函数（转译后断言） ──
let pureJs = ts.transpileModule(fs.readFileSync(PURE_TS, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'remoteInput.cjs'), pureJs);
const m = require(path.join(DIR, 'remoteInput.cjs'));

// 常量：去抖300ms同 PanelHost 拍，宽min三段，dvh上限
if (m.MIRROR_DEBOUNCE_MS !== 300) fail('去抖应为300ms同桥拍，实际 ' + m.MIRROR_DEBOUNCE_MS);
if (m.SHEET_WIDTH !== 'min(100% - 1em, 36em)') fail('宽应为min(100%-1em,36em)，实际 ' + m.SHEET_WIDTH);
if (m.SHEET_MIN_WIDTH !== 'min(100% - 1em, 20em)') fail('最小宽应为min(100%-1em,20em)');
if (m.SHEET_MAX_HEIGHT !== '62dvh') fail('上限应为62dvh，实际 ' + m.SHEET_MAX_HEIGHT);
ok('常量：去抖300ms＋宽min三段＋上限62dvh（v3定稿）');

// session校验＋isComposing门
if (m.shouldWriteMirror('s1', 's1', false) !== true) fail('同会话非组词应可写');
if (m.shouldWriteMirror('s1', 's2', false) !== false) fail('跨会话应停写（防串写）');
if (m.shouldWriteMirror('s1', 's1', true) !== false) fail('组词中只收不发');
if (m.shouldWriteMirror('', 's1', false) !== false) fail('空captured不应写');
if (m.shouldWriteMirror('s1', '', false) !== false) fail('空current不应写');
ok('写前session校验＋isComposing门（119约束镜面）');

// host→sheet采纳（不盖在敲的字）
if (m.shouldAdoptHostDraft({ hostDraft: 'b', local: 'a-edited', lastHost: 'a', composing: false, focused: true }) !== false)
  fail('聚焦且本地有未同步编辑时不应盖字');
if (m.shouldAdoptHostDraft({ hostDraft: 'b', local: 'a', lastHost: 'a', composing: true, focused: false }) !== false)
  fail('组词中不应采纳host');
if (m.shouldAdoptHostDraft({ hostDraft: 'a', local: 'a', lastHost: 'a', composing: false, focused: false }) !== false)
  fail('host无变化不应采纳');
if (m.shouldAdoptHostDraft({ hostDraft: 'b', local: 'a', lastHost: 'a', composing: false, focused: false }) !== true)
  fail('失焦且host变了应采纳');
if (m.shouldAdoptHostDraft({ hostDraft: 'b', local: 'a', lastHost: 'a', composing: false, focused: true }) !== true)
  fail('聚焦但本地与上次一致（无未同步编辑）应采纳');
ok('host→sheet采纳：组词/在敲不盖字，其余跟host走（双向镜）');

// chip透传不断言形状（只断存在性）
if (m.hasChipChar('hello') !== false) fail('纯文本不应含chip');
if (m.hasChipChar('a\uE100b') !== true) fail('应检出chip区段');
ok('chip形透传（与panel同式）');

// 模型门今日恒false（120 ABSENT：零占位，不自造不代点）
if (m.canShowRemoteModel(undefined) !== false) fail('无面应隐藏');
if (m.canShowRemoteModel({ sessions: [], uiWorkspace: {} }) !== false) fail('有形无面仍隐藏（今日ABSENT）');
ok('模型键休眠门恒false（今日ABSENT，零占位）');

// 一次性提示键形状
if (typeof m.MODEL_SEEN_KEY !== 'string' || m.MODEL_SEEN_KEY === '') fail('MODEL_SEEN_KEY应为非空串');
if (typeof m.hasSeenRemoteModel !== 'function' || typeof m.markSeenRemoteModel !== 'function') fail('一次性提示读写应导出');
ok('模型首次一次性提示键形（见过即灭）');

// ── 2) 源码级：复用挑选器math禁第三套 ──
const btnSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
const sheetSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'remoteInputSheet.ts'), 'utf8');
const pickerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'picker.ts'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// 根＋遮罩同式（同MODAL_Z、同calc根、同rgba），仅三参数不同
for (const [name, src] of [['button.ts', btnSrc], ['remoteInputSheet.ts', sheetSrc]]) {
  void name; void src;
}
if (!sheetSrc.includes('MODAL_Z')) fail('Sheet根应吃MODAL_Z同层（与齿轮/挑选器同层，高于Dock）');
if (!sheetSrc.includes('remoteSizeScale')) fail('Sheet根应吃remoteSizeScale缩放根（禁第三套）');
if (!sheetSrc.includes("calc(1em * ' + uiScale + ')'") && !sheetSrc.includes('calc(1em *')) fail('Sheet根fontSize应为calc(1em*scale)同式');
if (!sheetSrc.includes('rgba(0,0,0,0.55)')) fail('Sheet遮罩应复用挑选器同色rgba(0,0,0,0.55)');
if (!sheetSrc.includes('flex-end')) fail('Sheet遮罩仅对齐不同：底贴flex-end（其余同式）');
const pureSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'remoteInput.ts'), 'utf8');
if (!pureSrc.includes('62dvh')) fail('上限常量应为62dvh（v3定稿，键盘感知）');
if (!pureSrc.includes('min(100% - 1em, 36em)')) fail('宽常量应为min(100%-1em,36em)（em地板）');
if (!sheetSrc.includes('SHEET_WIDTH') || !sheetSrc.includes('SHEET_MAX_HEIGHT')) fail('Sheet应吃SHEET_WIDTH/SHEET_MAX_HEIGHT常量（复用，不手写第二套）');
ok('复用挑选器mask＋缩放根数学，仅对齐/上限/max-width三参数不同（禁第三套math）');

// 禁第三套math：Sheet不得自起档位表/缩放根/遮罩色
if (/REMOTE_SIZE_SCALES\s*=/.test(sheetSrc)) fail('Sheet不得自起档位表（只吃remoteView一处）');
if (/scaledBaseFontSize/.test(sheetSrc) && /calc\(var\(--dsw-font-markdown-base-font-size\)/.test(sheetSrc)) fail('Sheet不得手写第二套缩放根表达式');
if (/DOCK_Z\s*=/.test(sheetSrc)) fail('Sheet不得自定DOCK层（只读panel.MODAL_Z）');
ok('禁第三套math（档位/缩放根/层级无分叉）');

// ADR续篇存在且点名三参数
const adrPath = path.join(ROOT, 'docs', 'adr', '0005-remote-input-sheet-sizing.md');
if (!fs.existsSync(adrPath)) fail('缺ADR续篇 docs/adr/0005-remote-input-sheet-sizing.md');
const adr = fs.readFileSync(adrPath, 'utf8');
for (const k of ['复用', '62dvh', 'min(100%-1em,36em)', '禁第三套']) {
  if (!adr.includes(k)) fail('ADR续篇缺关键句: ' + k);
}
ok('ADR续篇禁第三套math（三参数点名）');

// ── 3) 发送键与解释文案已删（2026-10-06 用户拍板：输入区禁用发送按钮＋解释文本全部删除） ──
if (sheetSrc.includes('data-dsh-prompt-remote-input-send')) fail('发送键应已删除（不得再渲染 data-dsh-prompt-remote-input-send）');
if (sheetSrc.includes('remoteInputSend') || sheetSrc.includes('remoteInputExplicitMain') || sheetSrc.includes('remoteInputExplicitSub')) fail('Sheet不得再引用发送键/双层文案i18n（已删）');
if (/setDraft.*Enter|dispatch.*Enter|KeyboardEvent.*Enter/.test(sheetSrc)) fail('Sheet不得合成Enter/派发键盘伪造发送');
const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'i18n.ts'), 'utf8');
for (const k of ['remoteInputSend', 'remoteInputExplicitMain', 'remoteInputExplicitSub', 'remoteInputSendTitle']) {
  if (!i18nSrc.includes(k)) fail('i18n应保留双层文案键作兼容（仅Sheet不再引用）: ' + k);
}
ok('发送键与解释文案已删（Sheet零引用，i18n键兼容保留，绝不伪造）');

// ── 3b) 会话弹窗新规格（2026-10-06 用户拍板） ──
// 底贴遥控栏顶部向上展开、占满至屏顶；会话区＋工作区（两行）左右滑动；工作区名全显；两层翻页键保留。
if (!pickerSrc.includes("alignItems: 'flex-end'")) fail('挑选器遮罩应底贴（flex-end），自遥控栏顶部向上展开');
if (!pickerSrc.includes('5em')) fail('挑选器遮罩底垫应留 Dock 位（5em，同输入镜）');
if (!pickerSrc.includes('calc(100dvh - 5.5em)')) fail('挑选器面板高应 calc(100dvh-5.5em)，自遥控栏占满至屏顶');
if (!pickerSrc.includes("overflowX: 'auto'") || !pickerSrc.includes("overflowY: 'hidden'")) fail('会话滚动区应横滑（overflowX auto / overflowY hidden）');
if (!pickerSrc.includes("gridAutoFlow: 'column'")) fail('会话/工作区应 gridAutoFlow column 横滑');
if (!pickerSrc.includes("gridTemplateRows: 'repeat(2,")) fail('会话/工作区应两行（repeat(2, ...)）');
if (!pickerSrc.includes("whiteSpace: 'normal'")) fail('工作区名应全显（whiteSpace normal，无省略）');
if (pickerSrc.includes("whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',\n        },\n      }, g.name)")) fail('工作区名不得再省略（nm ellipsis 应删）');
// 两层翻页键保留（顺序与内外层形色沿 #115，不重断细则，只断存在性与可翻页 wiring）
for (const k of ["'ws-prev'", "'ss-prev'", "'ss-next'", "'ws-next'", 'tabGo', 'ssGo', 'wsScrollToPage', 'ssScrollToPage']) {
  if (!pickerSrc.includes(k)) fail('翻页键/ wiring 缺失: ' + k);
}
// 当前会话所在工作区优先展开（打开即见当前）
if (!pickerSrc.includes('当前会话所在工作区优先') && !pickerSrc.includes('当前会话')) fail('挑选器应优先展开当前会话所在工作区');
ok('会话弹窗新规格：底贴向上占满＋双区横滑＋两行＋名全显＋双层翻页＋当前优先');

// ── 4) Dock注册式＋顺序冻结＋门控隐藏 ──
const btnCode = strip(btnSrc);
if (!btnCode.includes('dockActions.push(inputKey)')) fail('输入键应走dockActions注册式续加');
if (!btnSrc.includes('挑选器→输入框→收起') && !btnSrc.includes('挑选器→输入框')) fail('Dock顺序注释应冻结挑选器→输入框→收起');
const orderIdx = (s) => btnCode.indexOf(s);
const iPicker = orderIdx('dockActions.push(pickerKey)');
const iInput = orderIdx('dockActions.push(inputKey)');
const iCollapse = orderIdx("key: 'dock-collapse'");
if (!(iPicker >= 0 && iInput > iPicker && iCollapse > iInput)) fail('Dock装配序应为挑选器→输入框→收起（收起永末）');
if (!btnSrc.includes('canShowRemoteModel')) fail('模型键应走canShowRemoteModel门控（休眠保留）');
if (!btnSrc.includes('const modelKey = null')) fail('模型今日休眠应为null零占位（不渲染不占位）');
if (btnSrc.includes('data-dsh-prompt-remote-model')) fail('今日ABSENT不得渲染模型键占位（零占位）');
ok('Dock注册式＋顺序冻结挑选器→输入框→收起＋模型零占位隐藏');

// 左键重验不断（118 HAVE-shape）：门控仍在
if (!btnSrc.includes('canShowWorkspaceLeft')) fail('左键门控canShowWorkspaceLeft应保留（118重验不断）');
ok('左键休眠契约保留（重验不断）');

// ── 5) 单模态＋Esc＋遮罩关＋焦点回opener ──
if (!btnSrc.includes('inputOpenState[1](false)') || !btnSrc.includes('pickerOpenState[1](false)')) fail('开任一应关另两（单模态互斥）');
if (!btnSrc.includes('closeRemoteInput')) fail('应有closeRemoteInput（焦点回opener）');
if (!sheetSrc.includes('e.target === e.currentTarget')) fail('Sheet遮罩点关（点遮罩关）');
if (!btnSrc.includes('inputOpen') || !btnSrc.includes('Escape')) fail('Esc应含输入栈（只关顶层）');
if (!sheetSrc.includes('scrollIntoView')) fail('应有scrollIntoView键盘感知');
if (!sheetSrc.includes('MIRROR_DEBOUNCE_MS') || !sheetSrc.includes('shouldWriteMirror')) fail('Sheet应走去抖串行＋session校验（300ms＋镜面门）');
if (!sheetSrc.includes('onCompositionStart') || !sheetSrc.includes('onCompositionEnd')) fail('Sheet应有isComposing门（组词中只收不发）');
ok('单模态互斥＋Esc＋遮罩关＋焦点回opener＋session校验＋去抖串行＋isComposing门');

// ── 6) 草稿桥双写只走setDraft全文（119：读H+D，写唯一） ──
if (!sheetSrc.includes('actions.setDraft')) fail('镜写应唯一走actions.setDraft全文替换');
if (/inputActions\.setDraft.*insert|\.insert\(/.test(sheetSrc)) fail('镜面不得走insert/拼接（全量替换）');
if (sheetSrc.includes('localStorage') && !sheetSrc.includes('MODEL_SEEN')) fail('Sheet不得碰持久化（除模型一次性提示外；草稿不落盘）');
ok('草稿桥双写唯一setDraft全文（不伪造发送，不落盘）');

console.log('=== Test #123 PASS ===');
process.exit(0);
