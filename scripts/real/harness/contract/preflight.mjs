/**
 * 宿主契约 preflight（#185）：在真机套件执行前，把套件依赖的宿主行为事实逐项核对。
 *
 * 职责边界：
 * - 契约数据与纯探测在 harness/contract/host.mjs（零 IO）；
 * - 本文件只做"检查执行"：从 CDP 页面、宿主进程输出、一次性 DSH_HOME 采集**观测**，
 *   调 evaluateContract 得到逐项判定；
 * - run.mjs 决定怎么记账（失败用 recorder.blocked 记一条指名契约项，跳过套件，退出码 2）。
 *
 * 为什么住在 harness/ 下：契约数据本身就是"平台契约层"的宿主行为事实（浏览器产品名、
 * 语言标签、启动输出形状），与绑定层/探测层同层；真机静态门禁（#186）只对这一层豁免
 * R4/R5，用例层仍然被禁止写宿主事实。
 * 任何一项断链只报该一项；不调用套件，避免把"宿主没就绪"误报成产品 FAIL（假 FAIL）。
 */

import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT_FAULT_IDS, HOST_CONTRACT, evaluateContract } from './host.mjs';
import { HarnessError } from '../errors.mjs';
import { gateFacts } from '../page.mjs';

function callWithArgs(fn, args) {
  return '(' + fn.toString() + ')(' + args.map((value) => JSON.stringify(value)).join(', ') + ')';
}

/* ------------------------------------------------------------------ */
/* 观测采集：每种观测都返回纯数据，交给 contract/host.mjs 判定            */
/* ------------------------------------------------------------------ */

/** ① 启动输出原文与 HTTP 探针结果（token 只在内存里解析，不写进观测/证据）。 */
function collectStartup(server) {
  const logs = server.readLogs();
  return {
    stdout: logs.stdout,
    stderrBytes: Buffer.byteLength(logs.stderr || '', 'utf8'),
    httpStatus: server.httpStatus,
    serverPort: server.port,
  };
}

/** ② 门关闭后的页面状态（识别轮次来自 preparePage 的证据）。 */
async function collectGates(client, prepared) {
  const state = await gateFacts(client);
  return {
    actions: prepared && prepared.gate ? prepared.gate.gateActions : [],
    rounds: prepared && prepared.gate ? prepared.gate.gateRounds : [],
    ...state,
  };
}

/**
 * 页面内：从 composer 的 React fiber 链上取宿主公开的 inputActions（只读探测）。
 * 不依赖插件内部，也不依赖宿主模块导出：这是页面里真实可用的能力面。
 */
export function inputActionsInPage() {
  const composer = document.querySelector('[contenteditable="true"]');
  const composerCount = document.querySelectorAll('[contenteditable="true"]').length;
  if (!composer) {
    return { ok: false, err: '页面没有 contenteditable=true 的 composer', methods: {}, capture: null, composerCount, composer: null };
  }
  const fiberKey = Object.keys(composer).find((name) => name.startsWith('__reactFiber$'));
  if (!fiberKey) {
    return { ok: false, err: 'composer 上没有 React fiber 键，无法取得宿主 inputActions', methods: {}, capture: null, composerCount, composer: null };
  }
  let fiber = composer[fiberKey];
  let actions = null;
  let depth = 0;
  for (let i = 0; fiber && i < 80; i += 1) {
    const props = fiber.memoizedProps;
    if (props && props.inputActions && typeof props.inputActions.insertText === 'function') {
      actions = props.inputActions;
      depth = i;
      break;
    }
    fiber = fiber.return;
  }
  if (!actions) {
    return { ok: false, err: '沿 React fiber 链未找到 inputActions', methods: {}, capture: null, composerCount, composer: null };
  }
  const methods = {};
  for (const name of Object.keys(actions)) methods[name] = typeof actions[name];
  let capture = null;
  let captureError = null;
  try {
    capture = actions.captureInsertion();
  } catch (error) {
    captureError = String(error && error.message ? error.message : error);
  }
  if (capture && typeof capture === 'object') {
    capture = { start: capture.start, end: capture.end, draftRev: capture.draftRev };
  }
  return {
    ok: true,
    depth,
    methods,
    capture,
    captureError,
    composerCount,
    composer: {
      tag: composer.tagName,
      attrs: {
        contenteditable: composer.getAttribute('contenteditable'),
        role: composer.getAttribute('role'),
        'data-composer-input': composer.getAttribute('data-composer-input'),
        'data-lexical-editor': composer.getAttribute('data-lexical-editor'),
      },
    },
  };
}

/** ③ 输入 actions 能力面。 */
async function collectInputActions(client) {
  return await client.evaluate(callWithArgs(inputActionsInPage, []));
}

/** ④ 持久化位置与顶层 schema：一次性 DSH_HOME 下真实落盘的样子。 */
function collectStorage(homeDir) {
  const rootPath = path.join(homeDir, HOST_CONTRACT.storage.rootRelative);
  const exists = fs.existsSync(rootPath);
  const singles = [];
  if (exists) {
    let entries = [];
    try {
      entries = fs.readdirSync(rootPath, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const doc = JSON.parse(fs.readFileSync(path.join(rootPath, entry.name), 'utf8'));
        singles.push({
          name: entry.name,
          topKeys: Object.keys(doc),
          unit: doc.unit && typeof doc.unit === 'object' ? { name: doc.unit.name, version: doc.unit.version } : null,
          tables: doc.tables && typeof doc.tables === 'object' ? Object.keys(doc.tables) : null,
        });
      } catch {
        singles.push({ name: entry.name, topKeys: [], parseError: true });
      }
    }
  }
  const pluginPath = path.join(rootPath, HOST_CONTRACT.storage.pluginDomain.file);
  return {
    root: { pathSuffix: path.basename(rootPath), exists, singles },
    pluginFile: { name: HOST_CONTRACT.storage.pluginDomain.file, exists: fs.existsSync(pluginPath) },
  };
}

/** ⑤ 语言面。 */
async function collectLocale(client) {
  return await client.evaluate(
    callWithArgs(() => {
      return {
        docLang: document.documentElement.lang,
        navLang: navigator.language,
        bodyLang: document.body ? document.body.getAttribute('lang') : null,
      };
    }, []),
  );
}

/** ⑥ 版本：宿主版本来自绑定层（`dsh --version`），浏览器版本来自 CDP /json/version。 */
function collectVersions(bindings, browserVersion) {
  return {
    hostVersion: bindings.hostVersion,
    browserVersion: browserVersion
      ? { browser: browserVersion.browser, protocolVersion: browserVersion.protocolVersion }
      : null,
  };
}

/**
 * 采集一份观测快照。单项采集失败只让对应观测变形（该契约项红），不中断其它项。
 * 采集失败信息写进观测的 __collectError，最终进该检查项的 detail。
 */
export async function collectObservations({ client, server, prepared, homeDir, bindings, browserVersion }) {
  const startup = { ...collectStartup(server) };
  const collect = async (label, fn) => {
    try {
      return await fn();
    } catch (error) {
      return { __collectError: label + '采集失败：' + String(error && error.message ? error.message : error) };
    }
  };
  const gates = await collect('门状态', () => collectGates(client, prepared));
  const inputActions = await collect('输入 actions', () => collectInputActions(client));
  const locale = await collect('语言面', () => collectLocale(client));
  const versions = collectVersions(bindings, browserVersion);
  return {
    startup,
    gates,
    inputActions,
    storage: collectStorage(homeDir),
    locale,
    versions,
  };
}

/**
 * 执行 preflight。
 * @param {object} params
 * @param {object} params.client CDP 客户端
 * @param {object} params.server startWebServer 返回值（含 readLogs/端口/HTTP 状态）
 * @param {object} params.prepared preparePage 返回值
 * @param {string} params.homeDir 一次性 DSH_HOME
 * @param {object} params.bindings 运行期绑定（含 hostVersion）
 * @param {object} [params.browserVersion] CDP /json/version 结果
 * @param {string|null} [params.fault] 负例注入项（DSH_REAL_CONTRACT_FAULT），未知项直接报错
 * @returns {Promise<{ok: boolean, contractVersion: number, fault: string|null, checks: Array}>}
 */
export async function runPreflight({ client, server, prepared, homeDir, bindings, browserVersion, fault = null }) {
  if (fault && !CONTRACT_FAULT_IDS.includes(fault)) {
    throw new HarnessError('未知契约注入项：' + fault + '。可选：' + CONTRACT_FAULT_IDS.join(', '));
  }
  const observations = await collectObservations({ client, server, prepared, homeDir, bindings, browserVersion });
  const result = evaluateContract(observations, { fault });
  // 诊断提示：采集失败时把原因挂到对应检查项 detail（probe 的 problems 已覆盖大部分场景）。
  for (const check of result.checks) {
    const observationKey = {
      'host.startup-output': 'startup',
      'host.startup-gates': 'gates',
      'host.input-actions': 'inputActions',
      'host.storage-schema': 'storage',
      'host.ui-locale': 'locale',
      'host.versions': 'versions',
    }[check.id];
    const observation = observations[observationKey];
    if (check.ok && observation && observation.__collectError) {
      check.ok = false;
      check.detail = observation.__collectError;
    }
  }
  result.ok = result.checks.every((check) => check.ok);
  return {
    ok: result.ok,
    contractVersion: result.contractVersion,
    fault: result.fault,
    checks: result.checks,
  };
}
