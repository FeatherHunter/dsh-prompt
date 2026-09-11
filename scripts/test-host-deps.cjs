// 回归：host 半裸导入必须自包含（dsh 0.1.5-rc.2 启动失败复盘）
// 背景：lib/index.js 首行 import @deepseek-ai/dsh-storage-domain，但 package.json
// 正式依赖只有 zod，外部目录 D:\dsh-plugin\dsh-prompt 下 Node 按父文件向上找，
// 够不到 npx 缓存里的宿主副本 → ERR_MODULE_NOT_FOUND，dsh web 卡死。
// 本测试不用 stub，直接真实 import，断言：
//  1) lib/index.js 里所有裸导入都在 dependencies 里声明（外部目录自包含；
//     peerDependencies 靠宿主提供，外部目录够不到，不算数）；
//  2) 真实 import('./lib/index.js') 成功且导出 apply/inject/promptDomainSpec 形状正确。
// 旧 test:issue-20-host 用字符串替换把宿主包 stub 掉了，所以从没红过——本测试补上这个洞。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log(' ok: ' + msg); }

(async () => {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
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
    if (!deps[top]) {
      fail(`裸导入 ${s} 的顶层包 ${top} 不在 dependencies 里（外部目录自包含要求；peer 不算）`);
    }
    try {
      require.resolve(top, { paths: [root] });
    } catch (e) {
      fail(`require.resolve(${top}) 失败：${e.message}（先跑 npm install？）`);
    }
    ok(`依赖声明 + 本地可解析: ${top}@${deps[top]}`);
  }

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
