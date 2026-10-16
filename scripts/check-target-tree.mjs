// 命名巡检（#171 由原型 prototype-target-tree/check.mjs 转正）：目标树形状断言。
// Run: node scripts/check-target-tree.mjs [--expect=current|target]
//   current (default): 旧树满足形状不变量；待搬重命名 = INFO。
//   target:           T5 落定树：33 个文件全员新名（npm run check 用此档）。
// Exit non-zero on any FAIL. No deps.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = join(dirname(process.argv[1]), '..');
const expect = (process.argv.find((a) => a.startsWith('--expect=')) || '--expect=current').split('=')[1];
let fails = 0;
const ok = (name, detail = '') => console.log(`PASS: ${name}${detail ? ' — ' + detail : ''}`);
const info = (name, detail = '') => console.log(`INFO: ${name}${detail ? ' — ' + detail : ''}`);
const fail = (name, detail = '') => { fails++; console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`); };

// --- 1. rename map from the frozen spec (§3 tables: | `old` | `new`|`保持` | reason |) ---
const spec = readFileSync(join(root, 'docs', 'naming-169-spec.md'), 'utf8');
const rows = [...spec.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(?:`([^`]+)`|(保持))\s*\|/gm)];
const oldToNew = new Map(); // old basename-or-path -> new basename-or-path (same if 保持)
for (const [, o, n, keep] of rows) oldToNew.set(o, keep ? o : n);
const base = (p) => p.split(/[/\\]/).pop();
const oldBases = new Set([...oldToNew.keys()].map(base));
const newBases = new Set([...oldToNew.values()].map(base));
rows.length >= 33 ? ok('rename-map parsed', `${rows.length} rows`) : fail('rename-map parsed', `only ${rows.length} rows`);

// --- 2. walk src ---
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.ts')) out.push(p);
  }
  return out;
};
const srcFiles = walk(join(root, 'src'));
info('src .ts count', `${srcFiles.length} files`);

// --- 3. coverage: every file has a home in the map ---
const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/');
if (expect === 'target') {
  const stragglers = srcFiles.filter((p) => !newBases.has(base(p)));
  stragglers.length === 0
    ? ok('target names complete', 'every src file carries its new name')
    : fail('target names complete', `stragglers: ${stragglers.map(rel).join(', ')}`);
  const leftovers = srcFiles.filter((p) => oldBases.has(base(p)) && ![...oldToNew.entries()].some(([o, n]) => base(o) === base(p) && base(n) === base(o)));
  leftovers.length === 0 ? ok('old names gone') : fail('old names gone', leftovers.map(rel).join(', '));
} else {
  const orphans = srcFiles.filter((p) => !oldBases.has(base(p)) && !newBases.has(base(p)));
  orphans.length === 0
    ? ok('every src file has a home in the rename map')
    : fail('every src file has a home in the rename map', orphans.map(rel).join(', '));
  const renamedOlds = new Set([...oldToNew.entries()].filter(([o, n]) => base(o) !== base(n)).map(([o]) => base(o)));
  const pending = srcFiles.filter((p) => renamedOlds.has(base(p)));
  info('pending renames (T5)', `${pending.length} files still carry old names`);
}

// --- 4. new names are kebab-case ---
const bad = [...newBases].filter((b) => !/^[a-z0-9]+(-[a-z0-9]+)*\.ts$/.test(b));
bad.length === 0 ? ok('new names kebab-case', `${newBases.size} names`) : fail('new names kebab-case', bad.join(', '));

// --- 5. forbidden buckets (research NOT 1–2) ---
for (const d of ['src/shared', 'src/features', 'tests']) {
  !existsSync(join(root, d)) ? ok(`no ${d}/ bucket`) : fail(`no ${d}/ bucket`, 'present');
}

// --- 6. GLOSSARY: format + no implementation leakage ---
const g = readFileSync(join(root, 'GLOSSARY.md'), 'utf8');
const terms = [...g.matchAll(/^\*\*(.+?)\*\*:/gm)].map((m) => m[1]);
const missingAvoid = terms.filter((t) => {
  const i = g.indexOf(`**${t}**:`);
  return !/_Avoid_:/.test(g.slice(i, i + 400));
});
terms.length >= 20 && missingAvoid.length === 0
  ? ok('GLOSSARY terms opinionated', `${terms.length} terms, all with _Avoid_`)
  : fail('GLOSSARY terms opinionated', `${terms.length} terms, missing _Avoid_: ${missingAvoid.join(', ')}`);
const leaks = [...g.matchAll(/\.ts\b|src\/|scripts\/|#[0-9]+/g)].map((m) => m[0]);
leaks.length === 0 ? ok('GLOSSARY free of implementation refs') : fail('GLOSSARY free of implementation refs', leaks.join(', '));

// --- 7. dual tsconfig = runtime firewall (F1) ---
const main = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
const host = JSON.parse(readFileSync(join(root, 'tsconfig.host.json'), 'utf8'));
const libs = (c) => (c.compilerOptions && c.compilerOptions.lib) || [];
!libs(host).includes('DOM') && libs(main).includes('DOM')
  ? ok('host config has no DOM lib (firewall holds)')
  : fail('host config has no DOM lib', `main=${libs(main)} host=${libs(host)}`);
((main.exclude || []).includes('src/update/host') && (host.include || []).includes('src/update'))
  ? ok('tsconfig split covers both runtimes')
  : fail('tsconfig split covers both runtimes');

// --- 8. scripts buckets (shape only) ---
const scripts = existsSync(join(root, 'scripts')) ? readdirSync(join(root, 'scripts')) : [];
info('scripts shape', `check-*.mjs=${scripts.filter((f) => f.startsWith('check-')).length} test-*.cjs=${scripts.filter((f) => f.startsWith('test-')).length} repro/=${existsSync(join(root, 'scripts', 'repro'))}`);

console.log(fails === 0 ? `\nRESULT: PASS (expect=${expect})` : `\nRESULT: ${fails} FAIL (expect=${expect})`);
process.exit(fails === 0 ? 0 : 1);
