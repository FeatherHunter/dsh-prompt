#!/usr/bin/env node
/**
 * 宿主契约模块级自证：纯 Node、零浏览器、零网络。
 *
 * 目的（对应票 #185 的验收口径）：
 * 1) 版本匹配的已知观测 → 六项契约全绿；
 * 2) 每次只伪造一项观测 → 只红该项（其余保持绿），证明各检查相互独立；
 * 3) 宿主升级模拟：把"新宿主"的观测喂进来 → 旧契约红；只改契约里的版本/形状常量
 *    （evaluateContract 的 contract 参数）→ 同一批观测、同一批用例零改动恢复绿；
 * 4) 注入项（真机负例用的 DSH_REAL_CONTRACT_FAULT）与单项红一一对应。
 *
 * 运行：node scripts/real/harness/contract/selftest.mjs
 * 退出码：0 = 全绿；1 = 有失败。
 */

import {
  CONTRACT_FAULT_IDS,
  HOST_CONTRACT,
  applyFault,
  evaluateContract,
  normalizeLocale,
  parseBrowserVersion,
  parseSemver,
  parseStartupOutput,
  compareSemver,
  satisfiesRange,
} from './host.mjs';

let passCount = 0;
const failures = [];

function ok(cond, name, detail) {
  if (cond) {
    passCount += 1;
    return true;
  }
  failures.push({ name, detail });
  return false;
}

function eq(actual, expected, name) {
  return ok(Object.is(actual, expected), name, { expected, actual });
}

function deepEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  return ok(a === b, name, { expected, actual });
}

function section(title) {
  console.log('\n[' + title + ']');
}

/** 已知宿主（实测：DSH 0.2.1-rc.3 + Edge 156，2026-10-30）的观测快照。只做测试输入。 */
function knownGoodObservations() {
  return {
    startup: {
      stdout: 'dsh web: http://127.0.0.1:64154/?token=_vs6KU_tXmV1iPfYRbHl8Z-tE2Qzh61tX0EjxmFb0KQ\n',
      stderrBytes: 0,
      httpStatus: 200,
      serverPort: 64154,
    },
    gates: {
      actions: ['click:继续', 'hide-gate'],
      rounds: [
        { gate: true, phase: 'preview', action: 'click:继续', zIndex: 1000, textSample: '预览版说明 DeepSeek Harness 目前的 0.2 版本仍处于预览阶段…' },
        { gate: true, phase: 'login', action: 'hide-gate', zIndex: 1000, textSample: '开始使用 登录 DeepSeek 账号，或添加 API Key，即可开始使用。' },
      ],
      visibleOverlays: [],
      rootInert: false,
      rootAriaHidden: null,
      composerCount: 1,
    },
    inputActions: {
      ok: true,
      methods: {
        captureInsertion: 'function',
        insertText: 'function',
        setDraft: 'function',
        persistDraft: 'function',
        addAttachments: 'function',
        removeAttachment: 'function',
        pruneAttachments: 'function',
        submit: 'function',
      },
      capture: { start: 0, end: 0, draftRev: 0 },
      captureError: null,
      composerCount: 1,
      composer: {
        tag: 'DIV',
        attrs: {
          contenteditable: 'true',
          role: 'textbox',
          'data-composer-input': 'true',
          'data-lexical-editor': 'true',
        },
      },
    },
    storage: {
      root: {
        pathSuffix: 'storages',
        exists: true,
        singles: [
          {
            name: 'workspace.json',
            topKeys: ['unit', 'global', 'tables'],
            unit: { name: 'workspace', version: 2 },
            tables: ['workspaces'],
          },
        ],
      },
      pluginFile: { name: 'dsh_prompt.json', exists: false },
    },
    locale: { docLang: 'zh-CN', navLang: 'zh-CN', bodyLang: null },
    versions: {
      hostVersion: '0.2.1-rc.3',
      browserVersion: { browser: 'Edg/156.0.4314.50', protocolVersion: '1.3' },
    },
  };
}

function failingIds(result) {
  return result.checks.filter((check) => !check.ok).map((check) => check.id);
}

/* ------------------------------------------------------------------ */
section('A. 已知宿主观测 → 六项契约全绿');
{
  const result = evaluateContract(knownGoodObservations());
  ok(result.ok, 'A1 已知观测整体判定为绿', result.checks.filter((c) => !c.ok));
  deepEq(
    result.checks.map((check) => check.id),
    HOST_CONTRACT.items.map((item) => item.id),
    'A2 检查项与契约项清单一致（顺序固定）',
  );
  eq(result.checks.length, HOST_CONTRACT.items.length, 'A3 检查数量 = 契约条目数');
  for (const check of result.checks) {
    ok(typeof check.expected !== 'undefined', 'A4 ' + check.id + ' 带期望形状', check);
    ok(typeof check.observed !== 'undefined', 'A5 ' + check.id + ' 带观测值', check);
  }
}

/* ------------------------------------------------------------------ */
section('B. 单项伪造 → 只红该项');
{
  const mutations = [
    ['host.startup-output', (obs) => { obs.startup.stdout = 'dsh web listening on http://127.0.0.1:64154/ (token in env)\n'; }],
    ['host.startup-gates', (obs) => { obs.gates.visibleOverlays = [{ zIndex: 1000, widthRatio: 1, heightRatio: 1, display: 'flex' }]; }],
    ['host.input-actions', (obs) => { delete obs.inputActions.methods.captureInsertion; obs.inputActions.capture = null; }],
    ['host.storage-schema', (obs) => { obs.storage.root.singles = []; }],
    ['host.ui-locale', (obs) => { obs.locale.docLang = 'ja'; }],
    ['host.versions', (obs) => { obs.versions.hostVersion = '0.1.7-rc.2'; }],
  ];
  for (const [id, mutate] of mutations) {
    const obs = knownGoodObservations();
    mutate(obs);
    const result = evaluateContract(obs);
    deepEq(failingIds(result), [id], 'B1 仅 ' + id + ' 变红');
    ok(!result.ok, 'B2 ' + id + ' 不匹配时整体为红');
  }
}

/* ------------------------------------------------------------------ */
section('C. 宿主升级模拟：只改契约常量 → 同一批用例零改动恢复');
{
  // C1 版本升级：新宿主 0.2.2-rc.1
  const upgraded = knownGoodObservations();
  upgraded.versions.hostVersion = '0.2.2-rc.1';
  const oldContractResult = evaluateContract(upgraded);
  deepEq(failingIds(oldContractResult), ['host.versions'], 'C1 新宿主在旧契约下只红版本项');

  const stretchedContract = {
    ...HOST_CONTRACT,
    host: { ...HOST_CONTRACT.host, knownGoodRange: '>=0.2.0-rc.2 <=0.2.2-rc.9', tested: [...HOST_CONTRACT.host.tested, '0.2.2-rc.1'] },
  };
  const patchedResult = evaluateContract(upgraded, { contract: stretchedContract });
  ok(patchedResult.ok, 'C2 只改契约版本常量后同一观测恢复全绿（用例零改动）', failingIds(patchedResult));

  // C3 启动输出形状升级：宿主编排输出多了一行前言
  const newShape = knownGoodObservations();
  newShape.startup.stdout = 'starting dsh web…\n' + newShape.startup.stdout;
  deepEq(failingIds(evaluateContract(newShape)), ['host.startup-output'], 'C3 新增前言行在旧契约下只红启动形状项');

  const tolerantContract = {
    ...HOST_CONTRACT,
    startup: { ...HOST_CONTRACT.startup, allowPreambleLines: true },
  };
  ok(evaluateContract(newShape, { contract: tolerantContract }).ok, 'C4 只改契约 allowPreambleLines 后恢复绿（用例零改动）');

  // C5 探测输入升级：captureInsertion 多了字段（保持必需字段不变）
  const richer = knownGoodObservations();
  richer.inputActions.capture = { start: 0, end: 0, draftRev: 7, extra: 'new-field' };
  ok(evaluateContract(richer).ok, 'C5 captureInsertion 增加可选字段不影响契约（向后兼容）');
}

/* ------------------------------------------------------------------ */
section('D. 注入项 ↔ 单项红（真机负例 DSH_REAL_CONTRACT_FAULT 的纯函数版）');
{
  deepEq(CONTRACT_FAULT_IDS, HOST_CONTRACT.items.map((item) => item.id), 'D1 注入项清单 = 契约项清单');
  const base = knownGoodObservations();
  for (const id of CONTRACT_FAULT_IDS) {
    const result = evaluateContract(base, { fault: id });
    deepEq(failingIds(result), [id], 'D2 注入 ' + id + ' 只红该项');
  }
  const unknown = applyFault(base, 'host.not-a-fault');
  ok(typeof unknown.error === 'string' && unknown.error.includes('未知注入项'), 'D3 未知注入项返回可操作错误', unknown);
  const applied = applyFault(base, 'host.ui-locale');
  eq(applied.observations.locale.docLang, 'ja', 'D4 注入只替换目标观测');
  eq(applied.observations.versions.hostVersion, '0.2.1-rc.3', 'D5 注入不污染其他观测');
  eq(base.locale.docLang, 'zh-CN', 'D6 注入不修改调用方输入');
}

/* ------------------------------------------------------------------ */
section('E. 探测单元：解析与比较函数');
{
  const parsed = parseStartupOutput(knownGoodObservations().startup.stdout, { serverPort: 64154 });
  ok(parsed.ok, 'E1 实测启动行可解析', parsed);
  eq(parsed.port, 64154, 'E2 解析端口');
  eq(parsed.lineCount, 1, 'E3 单行');
  eq(parsed.tokenLength, 43, 'E4 token 长度');
  ok(!JSON.stringify(parsed).includes('_vs6KU_tXmV1iPfYRbHl8Z'), 'E5 观测里 token 已打码');

  const missingToken = parseStartupOutput('dsh web: http://127.0.0.1:64154/\n', { serverPort: 64154 });
  ok(!missingToken.ok && missingToken.problems.length > 0, 'E6 缺 token → 红', missingToken);
  const wrongPort = parseStartupOutput(knownGoodObservations().startup.stdout, { serverPort: 60000 });
  ok(!wrongPort.ok, 'E7 解析端口与实际监听端口不一致 → 红', wrongPort);
  const http = parseStartupOutput('dsh web: http://127.0.0.1:64154/?token=abc\n');
  ok(!http.ok, 'E8 token 过短 → 红');

  eq(compareSemver(parseSemver('0.2.1-rc.3'), parseSemver('0.2.1-rc.2')) > 0, true, 'E9 rc.3 > rc.2');
  eq(compareSemver(parseSemver('0.2.1-rc.3'), parseSemver('0.2.1')) < 0, true, 'E10 预发布 < 正式版');
  eq(satisfiesRange(parseSemver('0.2.1-rc.3'), '>=0.2.0-rc.2 <=0.2.1-rc.3'), true, 'E11 区间内');
  eq(satisfiesRange(parseSemver('0.2.2-rc.1'), '>=0.2.0-rc.2 <=0.2.1-rc.3'), false, 'E12 区间外');
  eq(parseSemver('not-a-version'), null, 'E13 不可解析版本 → null');

  const browser = parseBrowserVersion('Edg/156.0.4314.50');
  eq(browser.product, 'Edg', 'E14 浏览器产品');
  eq(browser.major, 156, 'E15 浏览器主版本');
  eq(parseBrowserVersion('Firefox/140.0'), null, 'E16 非 Chromium 产品 → null');

  eq(normalizeLocale('zh-CN').locale, 'zh', 'E17 zh-CN 归一为 zh');
  eq(normalizeLocale('zh-CN').expectedTag, 'zh-CN', 'E18 zh 的宿主写回形状 zh-CN');
  eq(normalizeLocale('en').expectedTag, 'en', 'E19 en 的宿主写回形状 en');
  eq(normalizeLocale('ja').locale, null, 'E20 未知语言 → null');
  eq(normalizeLocale('').locale, null, 'E21 空 lang → null');
}

/* ------------------------------------------------------------------ */
section('F. 契约条目自带文档字段（版本/探测方式/失败后果/升级路径）');
{
  for (const item of HOST_CONTRACT.items) {
    ok(typeof item.id === 'string' && item.id.length > 0, 'F1 ' + String(item.id) + ' 有 id');
    ok(typeof item.title === 'string' && item.title.length > 0, 'F2 ' + item.id + ' 有 title');
    ok(typeof item.hostRange === 'string' && item.hostRange.length > 0, 'F3 ' + item.id + ' 有适用宿主版本范围');
    ok(typeof item.probe === 'string' && item.probe.length > 0, 'F4 ' + item.id + ' 有探测方式说明');
    ok(typeof item.expected === 'string' && item.expected.length > 0, 'F5 ' + item.id + ' 有期望形状说明');
    ok(typeof item.onFailure === 'string' && item.onFailure.length > 0, 'F6 ' + item.id + ' 有失败后果');
    ok(typeof item.upgradePath === 'string' && item.upgradePath.length > 0, 'F7 ' + item.id + ' 有升级路径');
  }
  eq(HOST_CONTRACT.version >= 1, true, 'F8 契约版本为整数且 >= 1');
}

/* ------------------------------------------------------------------ */
if (failures.length > 0) {
  console.error('\n[selftest] FAILED ' + failures.length + ' 项：');
  for (const failure of failures) console.error('  - ' + failure.name + ' ' + JSON.stringify(failure.detail));
  console.error('\n[selftest] PASS ' + passCount + ' / FAIL ' + failures.length);
  process.exit(1);
}
console.log('\n[selftest] PASS ' + passCount + ' / FAIL 0 —— 宿主契约模块自证全绿（契约版本 ' + HOST_CONTRACT.version + '）');
process.exit(0);
