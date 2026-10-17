// 回归：宿主运行时包的导入必须自包含，而且不得装进插件 profile（#147；同一门禁以 test:issue-147 别名挂出）
// 背景 A（外部目录自包含）：lib/index.js 首行 import @deepseek-ai/dsh-storage-domain，早期
// package.json 正式依赖只有 zod，外部目录 D:\dsh-plugin\dsh-prompt 下 Node 按父文件向上找，
// 够不到 npx 缓存里的宿主副本 → ERR_MODULE_NOT_FOUND，dsh web 卡死。
//   → 宿主包要能在仓库根解析到：声明在 devDependencies（本地开发/测试用），
//     保证 node -e "import('./lib/index.js')" 在外部目录也能跑。
// 背景 B（#147，profile 里不得多出副本）：把它写进 dependencies 时，插件安装会往 profile 里
// 装一份私有副本。profile 是加载器根，宿主自己的 storage-domain 行会解析到这份副本；DSH 0.2.1
// 线的 app-boot 兼容门拿副本的 peer 精确版本比对运行版本，对不上就禁用该行 → storageDomain
// 服务缺失 → 插件永远 pending。
//   → 宿主运行时包必须声明为 optional peerDependency（由宿主提供；optional 还能挡住
//     autoInstallPeers 之类的自动装 peer 行为又把它装回来），绝不进 dependencies。
// 断言（全部真实读文件/解析，不用 stub）：
//  1) dependencies 里没有任何宿主运行时包（#147 的直接回归点，不看它有没有被裸导入）；
//  2) 宿主运行时 peer 形状：optional === true，值是 `>=` 开头的下界区间（精确 pin 会在
//     autoInstallPeers 类自动装 peer 行为下把副本钉在旧线，重演 #147）；
//  3) lib/index.js 里每个裸导入都能在仓库根解析到：宿主包走 devDependencies，
//     非宿主包必须写进 dependencies（只写 dev / peer 的话，用户装到的 profile 里没有它）；
//  4) package-lock 与 package.json 同源，且生产依赖闭包（root.dependencies 递归）里没有
//     宿主运行时包——「profile 里不会多出副本」的静态等价（真机 E2E 见 #147 票面）；
//  5) 真实 import('./lib/index.js') 成功且导出 apply/inject/promptDomainSpec 形状正确。
// 旧 test:issue-20-host 用字符串替换把宿主包 stub 掉了，所以从没红过——本门禁补上这个洞。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); // 仅用于 require.resolve(宿主依赖探测)，源码一律 import

// 宿主提供的运行时包：DSH 自己的包 + cordis 插件框架。它们由宿主 bundle 提供，
// 装进 profile 就会遮住宿主那一行（#147 的根因），所以只能 optional peer + 本地 devDep。
const HOST_RUNTIME_RE = /^@deepseek-ai\/(?:dsh(?:-|$)|cordis$)/;

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log(' ok: ' + msg); }

(async () => {
  const root = path.join(import.meta.dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const peers = pkg.peerDependencies || {};
  const peersMeta = pkg.peerDependenciesMeta || {};
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

  const resolveFromRoot = (top, why) => {
    try {
      require.resolve(top, { paths: [root] });
    } catch (e) {
      fail('require.resolve(' + top + ') 失败：' + e.message + '（' + why + '）');
    }
  };

  // 1) dependencies 里一个宿主运行时包都不许有 —— 与「有没有被裸导入」无关
  const inDeps = Object.keys(deps).filter((n) => HOST_RUNTIME_RE.test(n));
  if (inDeps.length > 0) {
    fail('宿主运行时包不能进 dependencies：' + inDeps.join(', ') + '（#147：会被装进 profile，遮住宿主那一行，版本线错开就被兼容门禁用）');
  }
  ok('dependencies 里没有宿主运行时包');

  // 2) 宿主运行时 peer 的形状：optional + `>=` 下界区间
  const hostPeers = Object.keys(peers).filter((n) => HOST_RUNTIME_RE.test(n));
  for (const top of hostPeers) {
    const meta = peersMeta[top];
    if (!meta || meta.optional !== true) {
      fail('宿主运行时包 ' + top + ' 的 peerDependenciesMeta.optional 必须为 true（否则 npm/pnpm 自动装 peer 会把它装回来）');
    }
    if (!/^>=/.test(String(peers[top]).trim())) {
      fail('宿主运行时包 ' + top + ' 的 peer 区间 ' + JSON.stringify(peers[top]) + ' 必须以 >= 开头（精确 pin / 带上限会在自动装 peer 时把副本钉在旧线，重演 #147）');
    }
  }
  ok('宿主运行时 peer 形状正确: ' + (hostPeers.map((n) => n + '@' + peers[n]).join(', ') || '(无)'));

  const src = fs.readFileSync(path.join(root, 'lib', 'index.js'), 'utf8');

  const bare = new Set();
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const s = m[1];
    if (s.startsWith('.') || s.startsWith('/') || s.startsWith('node:')) continue;
    bare.add(s);
  }
  if (bare.size === 0) fail('lib/index.js 里没找到裸导入，正则可能失效');
  ok('裸导入: ' + [...bare].join(', '));

  for (const s of bare) {
    const top = s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0];
    if (HOST_RUNTIME_RE.test(top)) {
      if (!peers[top]) {
        fail('宿主运行时包 ' + top + ' 必须声明为 peerDependencies（由宿主提供；只写 devDep 的话用户 profile 里没人给）');
      }
      if (!devDeps[top]) {
        fail('宿主运行时包 ' + top + ' 必须在 devDependencies 里留一份本地副本（外部目录自包含：node -e "import(\'./lib/index.js\')" 要能跑）');
      }
      resolveFromRoot(top, 'devDependencies 要能装出本地副本，先跑 npm install？');
      ok(top + ': 不进 dependencies、optional peer(' + peers[top] + ')、本地 devDep(' + devDeps[top] + ') 可解析');
    } else {
      if (!deps[top]) {
        fail('非宿主裸导入 ' + s + ' 的顶层包 ' + top + ' 必须在 dependencies 里声明（devDependencies / peer 只服务本地，用户装到的 profile 里没有它）');
      }
      resolveFromRoot(top, '先跑 npm install？');
      ok('非宿主导入声明 + 本地可解析: ' + top + '@' + deps[top]);
    }
  }

  // 3) lock 与 package.json 同源（lock 漂了，profile 装出来就不是这个形状）
  const packages = lock.packages || {};
  const rootEntry = packages[''] || {};
  const rootDeps = rootEntry.dependencies || {};
  const rootDev = rootEntry.devDependencies || {};
  const rootPeers = rootEntry.peerDependencies || {};
  const rootPeersMeta = rootEntry.peerDependenciesMeta || {};
  for (const n of Object.keys(rootDeps)) {
    if (HOST_RUNTIME_RE.test(n)) fail('package-lock root.dependencies 里有宿主运行时包 ' + n + '（lock 漂了，重跑 npm install --package-lock-only）');
  }
  for (const top of hostPeers) {
    if (rootPeers[top] !== peers[top]) {
      fail('package-lock root.peerDependencies.' + top + ' 与 package.json 不一致：' + JSON.stringify(rootPeers[top]) + ' !== ' + JSON.stringify(peers[top]));
    }
    if (!rootPeersMeta[top] || rootPeersMeta[top].optional !== true) {
      fail('package-lock root.peerDependenciesMeta.' + top + '.optional 应为 true');
    }
    if (!rootDev[top]) fail('package-lock root.devDependencies 缺 ' + top + '（重跑 npm install --package-lock-only）');
  }
  ok('package-lock 与 package.json 同源（peer/meta/dev 一致，dependencies 无宿主包）');

  // 4) 生产依赖闭包（root.dependencies 递归）里没有宿主运行时包
  const nameOf = (key) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const resolveEntry = (from, name) => {
    let dir = from;
    for (;;) {
      const cand = (dir ? dir + '/' : '') + 'node_modules/' + name;
      if (packages[cand]) return cand;
      if (!dir) return null;
      const i = dir.lastIndexOf('/node_modules/');
      dir = i === -1 ? '' : dir.slice(0, i);
    }
  };
  const seen = new Set();
  const hostInClosure = [];
  const queue = Object.keys(deps).map((n) => ({ from: '', name: n, via: 'root' }));
  while (queue.length > 0) {
    const cur = queue.pop();
    const key = resolveEntry(cur.from, cur.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = packages[key];
    const name = nameOf(key);
    if (HOST_RUNTIME_RE.test(name)) hostInClosure.push(name + '@' + entry.version + '（经 ' + cur.via + '）');
    for (const d of [...Object.keys(entry.dependencies || {}), ...Object.keys(entry.optionalDependencies || {})]) {
      queue.push({ from: key, name: d, via: name });
    }
  }
  if (hostInClosure.length > 0) {
    fail('生产依赖闭包里出现宿主运行时包：' + hostInClosure.join('; ') + '（装进 profile 就会多出副本，重演 #147）');
  }
  ok('生产依赖闭包无宿主运行时包（' + seen.size + ' 个包）');

  // 真实导入（无 stub）：复现用户现场 node -e "import('./lib/index.js')"
  let host;
  try {
    host = await import(pathToFileURL(path.join(root, 'lib', 'index.js')).href);
  } catch (e) {
    fail('真实 import lib/index.js 失败：' + (e && e.message ? e.message : String(e)));
  }
  if (typeof host.apply !== 'function') fail('apply 应为函数');
  if (!Array.isArray(host.inject) || !host.inject.includes('storageDomain')) fail('inject 应含 storageDomain');
  if (!host.promptDomainSpec || host.promptDomainSpec.name !== 'dsh_prompt') fail('promptDomainSpec.name 应为 dsh_prompt');
  ok('真实 import 成功（apply/inject/promptDomainSpec 形状正确）');

  console.log('=== Test host-deps PASS ===');
  process.exit(0);
})().catch((e) => { console.log('HARNESS-ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : String(e))); process.exit(3); });
