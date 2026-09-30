// 回归测试 #86-host：整机横竖真切自实现（host 半 spawn powershell 调 Win32，去宿主化）
// 覆盖：system/orientation GET+POST 路由 + 执行器契约 + 已知路由表 + 错误码封闭。
// 口径：源码级契约（import 目标只在 DSH host 运行时解析，此处不断言可加载）+ 脚本片段抽取断言。
const fs = require('node:fs');
const path = require('node:path');

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const hostSrc = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');

// 1) 路由与已知表（深模块外缝 + 内缝各就其位：spawn 唯一实现，解析/构造为纯函数）
for (const marker of [
  '/_dsh/dsh-prompt/system/orientation', 'ORIENT_ROUTE',
  'queryOsOrientation', 'changeOsOrientation', 'runPowershell', 'parseJsonLines',
  'buildSetScript', 'mapApplyFailure', 'spawnErrorToOrient',
  'resolvePowershellExe', 'enqueueOrient', 'orientBusy', 'lastKnownOrientation',
]) {
  if (!hostSrc.includes(marker)) fail('lib/index.js 缺少真切执行器标记: ' + marker);
}
ok('真切执行器源码齐（查询/切换/spawn/解析/构造/串行/忙位/回声）');
if (hostSrc.includes('spawnPowershellJson') || hostSrc.includes('spawnPowershellRaw')) {
  fail('Json/Raw 双生 spawn 应已合并为 runPowershell（删穿透适配器）');
}
ok('无双生 spawn（单实现 + 纯解析）');
if (!hostSrc.includes('"/_dsh/dsh-prompt/system/orientation"')) fail('KNOWN_ROUTES 缺新路径');
ok('已知路由表含新路径');

// 2) Win32 落点（与 MS 文档对齐）
for (const marker of [
  'ChangeDisplaySettingsEx', 'EnumDisplaySettings', 'EnumDisplayDevices',
  'dmDisplayOrientation', '0x80 -bor 0x80000 -bor 0x100000',
  'CDS_TEST', 'CDS_UPDATEREGISTRY',
]) {
  if (!hostSrc.includes(marker)) fail('缺少 Win32 落点标记: ' + marker);
}
ok('Win32 落点齐（Ex + DEVMODE方向位 + TEST先行 + 注册表持久）');

// 3) 错误码封闭四码
for (const marker of ['"unsupported"', '"busy"', '"denied"', '"unknown"']) {
  if (!hostSrc.includes(marker)) fail('错误码表缺 ' + marker);
}
if (!hostSrc.includes('orientation-invalid-target')) fail('非法输入应归 unknown');
if (!hostSrc.includes('orientation-change-in-progress')) fail('并发应回 busy');
ok('错误码封闭（unsupported|busy|denied|unknown）');

// 4) 安全形态：argv 数组、无 shell:true、windowsHide、超时、动态 import
if (/shell\s*:\s*true/.test(hostSrc)) fail('不得用 shell:true（防注入，argv 数组）');
for (const marker of ['windowsHide: true', 'ORIENT_TIMEOUT_MS', 'import("node:child_process")', 'import("node:fs")']) {
  if (!hostSrc.includes(marker)) fail('缺安全形态标记: ' + marker);
}
ok('安全形态齐（argv/隐藏窗/超时/动态import）');

// 5) 只动主屏策略：不接受屏号参数，硬编码枚举主屏
if (/body\?\.device|body\.device/.test(hostSrc)) fail('不得接受客户端屏号参数（只动主屏策略）');
if (!hostSrc.includes('StateFlags -band 4')) fail('缺主屏 PRIMARY 判定');
ok('只动主屏策略（显式设备名 + PRIMARY 判定）');

// 6) 宽高对调 + 复读回滚
for (const marker of ['needSwap', 'orientation-verify-mismatch', 'orientation-test-rejected', 'orientation-apply-failed']) {
  if (!hostSrc.includes(marker)) fail('缺切换语义标记: ' + marker);
}
ok('切换语义齐（宽高对调 + TEST + 复读 + 回滚）');

// 7) 嵌入脚本可解析性：抽取 ORIENT_QUERY_PS/ORIENT_SET_PS/ORIENT_CS，断言关键语句齐
for (const marker of ['ORIENT_QUERY_PS', 'ORIENT_SET_PS', 'ORIENT_CS', 'Add-Type -TypeDefinition', 'ConvertTo-Json -Compress', 'DMDO']) {
  if (!hostSrc.includes(marker)) fail('缺嵌入脚本标记: ' + marker);
}
ok('嵌入 PowerShell 脚本齐（查询/切换/程序集）');

console.log('=== Test #86-host PASS ===');
process.exit(0);
