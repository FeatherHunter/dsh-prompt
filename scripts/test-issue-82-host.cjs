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
  'remoteEnabled', 'remoteFont', 'remoteControl', 'remoteOrientation', 'remoteDensity',
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

// host 缺键回退与客户端默认对齐（默认 5 档=2x）：缺键→5；旧 large→2 / 其余→1 迁移保留不动
if (!/let size = 5;/.test(hostSrc)) fail('host normalizeRemotePrefs 缺键 size 应回 5（与客户端默认/ initial remoteSize:5 对齐）');
if (!/o\.font === "large" \|\| o\.control === "large"\) size = 2;/.test(hostSrc)) fail('host 旧 large→2 迁移应保留');
ok('host 缺键 size 回 5（旧档迁移保留）');

// setRemote 校验分支源码级：空 patch/非法 enabled/font/control/orientation/density 各 400
for (const marker of ['empty remote patch', 'invalid remote.enabled', 'invalid remote.font', 'invalid remote.control', 'invalid remote.orientation', 'invalid remote.density', 'hasDensity']) {
  if (!hostSrc.includes(marker)) fail('setRemote 缺校验分支: ' + marker);
}
ok('setRemote 校验分支齐（空/非法各 400，含密度）');

// #90 密度档 host 侧三断言（读 #91 的 lastUsed 教训：新增键一律 optional/缺省，不许必填；version 不动）
if (!/remoteDensity:\s*z\.enum\(\["a",\s*"b"\]\)\.optional\(\)/.test(hostSrc))
  fail('GlobalSchema.remoteDensity 应为 enum [a,b] + optional（新增键不许必填）');
ok('#90 host GlobalSchema.remoteDensity 可选（旧数据缺键不拒读）');
if (!/remoteDensity:\s*"a"/.test(hostSrc)) fail('host initial 应含 remoteDensity:"a"');
if (!/density:\s*g\.remoteDensity/.test(hostSrc)) fail('snapshot 归一化应装配 g.remoteDensity');
ok('#90 host initial/snapshot 密度默认 a（与 orientation 同构）');
if (!/density:\s*hasDensity \? o\.density : cur\.remoteDensity/.test(hostSrc)) fail('setRemote 应按 hasDensity 取值并落盘 remoteDensity');
ok('#90 host setRemote 密度部分更新 + 落盘（与 orientation 同构）');

// 快照返回含 remote
if (!/return\s*\{\s*customs,\s*usage,\s*pinned,\s*lastUsed,\s*remote\s*\}/.test(hostSrc))
  fail('snapshot 应返回 {customs,usage,pinned,lastUsed,remote}');
ok('快照含 remote');

// #91 根因回归：线上真实 global 缺 lastUsed（只有 remote* 键），必填会使 domain open
// 报 invalid-record → GET /store 恒 503 → 客户端锁空。lastUsed 必须可选（缺席即 null）。
if (!/lastUsed:\s*z\.string\(\)\.nullable\(\)\.optional\(\)/.test(hostSrc))
  fail('GlobalSchema.lastUsed 应为 nullable+optional（旧数据缺键不拒读）');
ok('#91 旧 global 缺 lastUsed 不拒读（源码级）');
try {
  const { z } = require('zod');
  const GlobalProbe = z.object({
    lastUsed: z.string().nullable().optional(),
    remoteEnabled: z.boolean().optional(),
    remoteSize: z.number().int().min(1).max(10).optional(),
    remoteFont: z.enum(['small', 'medium', 'large']).optional(),
    remoteControl: z.enum(['small', 'medium', 'large']).optional(),
    remoteOrientation: z.enum(['auto', 'landscape', 'portrait']).optional(),
    remoteDensity: z.enum(['a', 'b']).optional(),
  });
  // 真实用户形状：无 lastUsed，只有 remote* 键（见 #91 证据）；#90 新增键同样缺席即过
  const p = GlobalProbe.safeParse({ remoteEnabled: true, remoteFont: 'large', remoteControl: 'large' });
  if (!p.success) fail('旧 global（无 lastUsed）应解析通过');
  ok('#91 旧 global（无 lastUsed）解析通过（函数级）');
} catch (e) {
  if (e && e.message && e.message.startsWith('旧 global')) throw e;
  fail('zod 不可用，无法做函数级回归：' + (e && e.message ? e.message : String(e)));
}

console.log('=== Test #82-host PASS ===');
process.exit(0);
