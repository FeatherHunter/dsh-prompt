// 回归 #42：DSH 版本声明只能有一份真值，测试把「package.json ↔ 两份 README」三处钉在一起。
//
// 背景（#42 票面）：版本声明写两处就会走散。本次不引入运行时校验，只做「写得准、写得唯一」：
//   - 真值住在 `package.json` 的 `dsh.engines.dsh`（不新造顶层键，也不用会被包管理器强制的
//     `peerDependencies`）；
//   - 两份 README（`README.md` 中文 / `docs/README.en.md` 英文）各有一段**声明块**，逐字抄真值；
//   - 本测试从 README 里把声明块读出来与 `package.json` 比对，不一致就红。
//
// 断言清单：
//  1) `package.json` 里 `dsh.engines.dsh` **存在**且是非空字符串，形如 `>=X.Y.Z[-pre]`
//     —— 显式判存在，否则「两边都缺」会被 `undefined === undefined` 钉成假的 PASS（本图前几票踩过）。
//  2) `dsh` 版本没有跑到顶层 `engines`（放错位置等于没人读）。
//  3) 每份 README 恰好有一个声明块（按 `dsh.engines.dsh =` 行识别），块内键不重复、行行可解析。
//  4) 两份 README 的 `dsh.engines.dsh` 都逐字等于 `package.json` 的值 —— 改一处忘另一处必红。
//  5) `dsh.cli` 必须等于 `dsh.engines.dsh` 的下界（基线即最低支持版本）。
//  6) 两份 README 的 `dsh.cli` / `dsh.desktop` 互相一致（中英不会各自漂）。
//  7) 人的那一半也真的写了：声明块**上方的正文字**里必须出现 `dsh.cli` / `dsh.desktop` 的版本号，
//     以及「未验证」这句诚实口径；章节标题唯一。
//  8) 断言计数器 > 0：本文件从不 `return`，但如果哪天被人改成提前退出，末行会自己红。
//
// 变异证据（每次手工改坏一处都实测变红，改完逐字节复原并核 sha256）：见
// `.wayfinder/update/42-progress.md`。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PKG_FILE = 'package.json';
const READMES = [
  { file: 'README.md', heading: '支持的 DSH 版本', honesty: '未验证' },
  { file: 'docs/README.en.md', heading: 'Supported DSH versions', honesty: 'not verified' },
];
const RANGE_KEY = 'dsh.engines.dsh';
const CLI_KEY = 'dsh.cli';
const DESKTOP_KEY = 'dsh.desktop';
// 下界：`>=0.1.5-rc.1` → `0.1.5-rc.1`（也容忍 `>=0.1.5-rc.1 <1.0.0` 这种写法）
const FLOOR_RE = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/;
// 围栏代码块：开栏行（可带 info string）→ 到最近的闭栏行
const FENCE_RE = /^[ \t]*```[^\r\n]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*\r?$/gm;

let checks = 0;
function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log(' ok: ' + msg); checks++; }
function assert(cond, msg) { if (!cond) fail(msg); checks++; }
function eq(actual, expected, msg) {
  if (actual !== expected) {
    fail(msg + '\n    got:  ' + JSON.stringify(actual) + '\n    want: ' + JSON.stringify(expected));
  }
  checks++;
}

function read(file) {
  const abs = path.join(ROOT, file);
  assert(fs.existsSync(abs), '缺文件：' + file);
  return fs.readFileSync(abs, 'utf8');
}

// 从一份 README 里取出声明块（恰好一个）并解析成 Map
function parseDecl(file, text) {
  const KEY_LINE_RE = new RegExp('^[ \\t]*' + RANGE_KEY.replace(/\./g, '\\.') + '[ \\t]*=', 'm');
  const withDecl = [...text.matchAll(FENCE_RE)].filter((m) => KEY_LINE_RE.test(m[1]));
  eq(withDecl.length, 1, file + '：声明块必须恰好 1 个（按 `' + RANGE_KEY + ' =` 行识别）');
  const decl = new Map();
  for (const line of withDecl[0][1].split(/\r?\n/)) {
    const t = line.trim();
    if (t === '') continue;
    const m = /^([A-Za-z0-9._-]+)[ \t]*=[ \t]*(\S+)$/.exec(t);
    assert(m !== null, file + '：声明块里有解析不了的行：' + JSON.stringify(line));
    assert(!decl.has(m[1]), file + '：声明块里键重复：' + m[1]);
    decl.set(m[1], m[2]);
  }
  return { block: withDecl[0][1], decl, start: withDecl[0].index };
}

// ---------- 真值侧：package.json ----------
const pkg = JSON.parse(read(PKG_FILE));
const range = pkg && pkg.dsh && pkg.dsh.engines ? pkg.dsh.engines.dsh : undefined;
assert(
  typeof range === 'string' && range.length > 0,
  PKG_FILE + '：缺 `' + RANGE_KEY + '`，或它不是非空字符串（got=' + JSON.stringify(range) + '）'
);
assert(
  !(pkg.engines && Object.prototype.hasOwnProperty.call(pkg.engines, 'dsh')),
  PKG_FILE + '：`dsh` 版本声明放到了顶层 engines —— 应在 `' + RANGE_KEY + '`（放错地方没人读）'
);
assert(
  /^>=/.test(range),
  PKG_FILE + '：`' + RANGE_KEY + '` 期望 `>=` 开头（只声明、不挡安装），got=' + JSON.stringify(range)
);
const floor = FLOOR_RE.exec(range);
assert(floor !== null, PKG_FILE + '：`' + RANGE_KEY + '` 里读不出版本号：' + JSON.stringify(range));
const floorVersion = floor[1];
ok(PKG_FILE + '：' + RANGE_KEY + ' = ' + range + '（下界 ' + floorVersion + '）');

// ---------- 声明侧：两份 README ----------
const seen = new Map(READMES.map((r) => [r.file, null]));
for (const spec of READMES) {
  const text = read(spec.file);

  eq(text.split(spec.heading).length - 1, 1, spec.file + '：章节标题「' + spec.heading + '」必须恰好出现 1 次');

  const { decl, start } = parseDecl(spec.file, text);
  for (const key of [RANGE_KEY, CLI_KEY, DESKTOP_KEY]) {
    assert(decl.has(key), spec.file + '：声明块缺键 `' + key + '`');
  }

  // 4) 与 package.json 逐字一致
  eq(decl.get(RANGE_KEY), range, spec.file + '：声明块 `' + RANGE_KEY + '` 与 ' + PKG_FILE + ' 不一致');
  // 5) 基线 = 下界
  eq(decl.get(CLI_KEY), floorVersion, spec.file + '：`' + CLI_KEY + '` 必须等于 ' + RANGE_KEY + ' 的下界');
  assert(FLOOR_RE.test(decl.get(DESKTOP_KEY)), spec.file + '：`' + DESKTOP_KEY + '` 不像版本号：' + JSON.stringify(decl.get(DESKTOP_KEY)));

  // 7) 人的那一半：声明块上方的正文字真的写了版本与「未验证」
  const headingAt = text.indexOf(spec.heading);
  assert(start > headingAt, spec.file + '：解析不到声明块在章节标题之后的位置');
  const prose = text.slice(headingAt, start);
  assert(prose.includes(decl.get(CLI_KEY)), spec.file + '：章节正文字里没写 CLI 基线 ' + decl.get(CLI_KEY));
  assert(prose.includes(decl.get(DESKTOP_KEY)), spec.file + '：章节正文字里没写 Desktop 基线 ' + decl.get(DESKTOP_KEY));
  assert(prose.includes(spec.honesty), spec.file + '：章节正文字里没写「' + spec.honesty + '」这一句诚实口径');

  seen.set(spec.file, decl);
  ok(spec.file + '：声明块与 ' + PKG_FILE + ' 一致（' + CLI_KEY + '=' + decl.get(CLI_KEY) + '，' + DESKTOP_KEY + '=' + decl.get(DESKTOP_KEY) + '）');
}

// 6) 中英两份互相一致
const [zh, en] = READMES.map((r) => seen.get(r.file));
for (const key of [RANGE_KEY, CLI_KEY, DESKTOP_KEY]) {
  eq(zh.get(key), en.get(key), '中英两份 README 的 `' + key + '` 不一致');
}
ok('中英两份 README 的三个键逐字一致');

// 8) 断言计数器自检
assert(checks >= 12, '断言数异常偏少（' + checks + '）—— 测试可能被短路，别信这个绿');
console.log('ok: ' + checks + ' assertions passed');
