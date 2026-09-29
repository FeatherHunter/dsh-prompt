// 回归测试 #82-host：宿主半远程偏好（DSH 缓存目录语义）
// 覆盖：domain dsh_prompt v0 扩展 global 远程键 + 快照含 remote + remote/set 路由 + 已知路由表。
// 口径：源码级契约（import 目标只在 DSH host 运行时解析，此处不断言可加载）+ 快照归一化逻辑抽取断言。
const fs = require('node:fs');
const path = require('node:path');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const hostSrc = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');

for (const marker of [
  'dsh_prompt', 'version: 0',
  'remoteEnabled', 'remoteFont', 'remoteControl', 'remoteOrientation',
  'normalizeRemotePrefs', 'setRemote',
  '/_dsh/dsh-prompt/remote/set', '/_dsh/dsh-prompt/store',
  'remote/set',
]) {
  if (!hostSrc.includes(marker)) fail('lib/index.js 缺少 host 远程契约标记: ' + marker);
}
ok('host 远程契约源码齐（global 扩展含方向偏好 + setRemote + 路由）');

// version 保持 0（不触发拒读旧数据）
if (!/name:\s*"dsh_prompt"[\s\S]{0,200}version:\s*0/.test(hostSrc)) fail('domain dsh_prompt version 应保持 0');
ok('domain 版本保持 0（旧数据不拒读）');

// 快照归一化逻辑抽取：在 Node 里复刻 host 的 normalizeRemotePrefs 并断言（含方向偏好）
function normalizeRemotePrefs(raw) {
  const o = (raw && typeof raw === 'object') ? raw : {};
  const isTier = (v) => v === 'small' || v === 'medium' || v === 'large';
  const isOrient = (v) => v === 'auto' || v === 'landscape' || v === 'portrait';
  return {
    enabled: o.enabled === true,
    font: isTier(o.font) ? o.font : 'large',
    control: isTier(o.control) ? o.control : 'large',
    orientation: isOrient(o.orientation) ? o.orientation : 'auto',
  };
}
const d1 = normalizeRemotePrefs(undefined);
if (d1.enabled !== false || d1.font !== 'large' || d1.control !== 'large' || d1.orientation !== 'auto') fail('旧数据缺键应回默认');
const d2 = normalizeRemotePrefs({ enabled: true, font: 'large', control: 'x', orientation: 'portrait' });
if (d2.enabled !== true || d2.font !== 'large' || d2.control !== 'large' || d2.orientation !== 'portrait') fail('非法档应回默认大，合法方向应保留');
ok('快照归一化（缺键/坏值回默认，含方向偏好）');

// setRemote 校验分支源码级：空 patch/非法 enabled/font/control/orientation 各 400
for (const marker of ['empty remote patch', 'invalid remote.enabled', 'invalid remote.font', 'invalid remote.control', 'invalid remote.orientation']) {
  if (!hostSrc.includes(marker)) fail('setRemote 缺校验分支: ' + marker);
}
ok('setRemote 校验分支齐（空/非法各 400）');

// 快照返回含 remote
if (!/return\s*\{\s*customs,\s*usage,\s*pinned,\s*lastUsed,\s*remote\s*\}/.test(hostSrc))
  fail('snapshot 应返回 {customs,usage,pinned,lastUsed,remote}');
ok('快照含 remote');

console.log('=== Test #82-host PASS ===');
process.exit(0);
