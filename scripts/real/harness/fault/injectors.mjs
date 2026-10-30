/**
 * 故障注入器注册表（票 #191 交付物 C）。
 *
 * 目的：证明套件里的关键断言**有区分力**——把某个可观测能力按故障方式打断，
 * 对应断言必须变红；不注入时保持绿。注入只挂在 harness 层接缝（页面探针/fetch/
 * 输入驱动包装、契约探测降级），不改产品 `src/`，只在显式 `--fault <id>` 时生效，
 * 默认零影响，且每个注入点都能反向卸载（见 index.mjs 的 uninstall）。
 *
 * 每个注入器必须声明：
 * - `expectedRed`：注入后**预期变红**的检查名（支持精确名、前缀、`*` 通配）；
 *   diff 的 fault 模式直接把它转成 mustFlip（干净跑绿 → 注入跑红）清单；
 * - `expectedStayGreen`：注入不应牵连的检查（可选，用于收紧误伤面）。
 *
 * 注入器元数据会原样写进 report.environment.faults，报告读者不用翻代码就知道
 * 这一轮动过哪个接缝、期望哪条断言红。
 */

import { HarnessError } from '../errors.mjs';

/** 插件 store 的 HTTP 桥前缀（宿主契约事实，不是机器相关值）。 */
export const STORE_HTTP_PREFIX = '/_dsh/dsh-prompt/';

const INPUT_ACTIONS_KEY = '__dshPromptFaultInputActions';
const FETCH_FAULT_KEY = '__dshPromptFaultFetch';
const OFFSET_DX = 180;
const OFFSET_DY = 64;

function pageCall(fn, arg) {
  return '(' + fn.toString() + ')(' + JSON.stringify(arg ?? null) + ')';
}

/* ------------------------------------------------------------------------- */
/* ① 输入 actions 能力缺失：把宿主 inputActions.captureInsertion 摘掉。        */
/* ------------------------------------------------------------------------- */

/**
 * 页面内安装（必须自包含：会被 toString 注入页面）。
 *
 * 从 composer[contenteditable] 沿 React fiber 上溯，找到宿主传给插件的
 * `props.inputActions`（与产品运行时是**同一个对象引用**），把 captureInsertion
 * 置空再确认。产品 applyInsert 的 canEdit 随即为 false，走 setDraft 降级；
 * 观测探针 inputActionsInPage() 的 capture 也变 null（同一降级路径）。
 */
function installInputActionsMissingInPage() {
  const KEY = '__dshPromptFaultInputActions';
  if (window[KEY] && window[KEY].installed) {
    return { installed: true, already: true, depth: window[KEY].depth, hadCaptureInsertion: window[KEY].hadCaptureInsertion };
  }
  const editable = document.querySelector('[data-composer-input][contenteditable="true"], [contenteditable="true"]');
  if (!editable) return { installed: false, error: '页面上找不到 composer[contenteditable=true]' };
  const fiberKey = Object.keys(editable).find((key) => key.indexOf('__reactFiber$') === 0);
  if (!fiberKey) return { installed: false, error: 'composer 上没有 React fiber 标记' };
  let fiber = editable[fiberKey];
  let found = null;
  let depth = 0;
  while (fiber && depth <= 80) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    const inputActions = props ? props.inputActions : null;
    if (inputActions && typeof inputActions.insertText === 'function') {
      found = inputActions;
      break;
    }
    fiber = fiber.return;
    depth += 1;
  }
  if (!found) {
    return { installed: false, error: 'fiber 链上找不到宿主 inputActions.insertText（深度 ' + depth + '）' };
  }
  const originalCapture = typeof found.captureInsertion === 'function' ? found.captureInsertion : null;
  let patched = false;
  try {
    found.captureInsertion = undefined;
    patched = typeof found.captureInsertion !== 'function';
  } catch (error) {
    patched = false;
  }
  if (!patched) {
    try {
      delete found.captureInsertion;
      patched = typeof found.captureInsertion !== 'function';
    } catch (error) {
      patched = false;
    }
  }
  if (!patched) return { installed: false, error: 'inputActions.captureInsertion 无法被置空（只读属性？）' };
  window[KEY] = {
    installed: true,
    actions: found,
    originalCapture,
    depth,
    patchedAt: Date.now(),
    hadCaptureInsertion: typeof originalCapture === 'function',
  };
  return {
    installed: true,
    already: false,
    depth,
    hadCaptureInsertion: typeof originalCapture === 'function',
    captureTypeAfter: typeof found.captureInsertion,
    methods: { insertText: typeof found.insertText, setDraft: typeof found.setDraft },
  };
}

function uninstallInputActionsMissingInPage() {
  const KEY = '__dshPromptFaultInputActions';
  const state = window[KEY];
  if (!state || !state.installed) return { restored: false, reason: '未安装' };
  if (typeof state.originalCapture === 'function') {
    try {
      state.actions.captureInsertion = state.originalCapture;
    } catch (error) {
      return { restored: false, error: 'captureInsertion 恢复失败：' + String(error && error.message ? error.message : error) };
    }
  }
  delete window[KEY];
  return { restored: true, captureType: typeof state.actions.captureInsertion };
}

/* ------------------------------------------------------------------------- */
/* ② 插入点击坐标偏移：物理点击命中模板行时把落点挪开，插入不发生。            */
/* ------------------------------------------------------------------------- */

/** 页面内探测某个点是否落在模板行上，返回行矩形（自包含）。 */
function pageRowRectAt(point) {
  const el = document.elementFromPoint(point.x, point.y);
  if (!el) return null;
  const row = el.closest('[data-dsh-prompt-id]');
  if (!row) return null;
  const rect = row.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    id: row.getAttribute('data-dsh-prompt-id'),
  };
}

/**
 * 把 input 驱动的 clickAt 包一层：物理点击的落点若命中模板行
 * （`[data-dsh-prompt-id]`），就改成行右侧面板空白处（或固定偏移），
 * 模拟"坐标算错了"的插入故障；未命中行的点击原样透传（不干扰其它交互）。
 */
function createInsertCoordinateOffset(input) {
  const originalClickAt = input.clickAt.bind(input);
  const client = input.client;
  const log = { injected: true, shifted: 0, bypassed: 0, attempts: [] };
  const wrappedClickAt = async (point, clickOptions = {}) => {
    let rowRect = null;
    try {
      rowRect = await client.evaluate(pageCall(pageRowRectAt, { x: point.x, y: point.y }), { returnByValue: true });
    } catch (error) {
      rowRect = null;
    }
    if (!rowRect) {
      log.bypassed += 1;
      return originalClickAt(point, clickOptions);
    }
    // 行内点击 → 挪到行右缘之外（同一面板内的空白），再退而求其次用固定偏移。
    const target = {
      x: Math.round(rowRect.x + rowRect.width + 18),
      y: Math.round(point.y),
    };
    if (Math.abs(target.x - point.x) < 2 && Math.abs(target.y - point.y) < 2) {
      target.x = Math.round(point.x + OFFSET_DX);
      target.y = Math.round(point.y + OFFSET_DY);
    }
    log.shifted += 1;
    if (log.attempts.length < 20) {
      log.attempts.push({
        from: { x: Math.round(point.x), y: Math.round(point.y) },
        to: target,
        row: { x: Math.round(rowRect.x), y: Math.round(rowRect.y), width: Math.round(rowRect.width), height: Math.round(rowRect.height), id: rowRect.id },
      });
    }
    return originalClickAt(target, clickOptions);
  };
  return { input: { ...input, clickAt: wrappedClickAt }, log };
}

/* ------------------------------------------------------------------------- */
/* ③ 持久化写入失败：页面侧拦截插件 store 写请求，读请求放行。                 */
/* ------------------------------------------------------------------------- */

/**
 * 页面内安装（自包含）：覆写 window.fetch。
 * 只拒绝「插件 store 前缀 + 写方法」的请求；GET /store 等读通道放行，
 * 保证外部观测（套件的 persistence.read）仍能读到未变化的 store。
 */
function installPersistenceWriteFailInPage(config) {
  const KEY = '__dshPromptFaultFetch';
  if (window[KEY] && window[KEY].installed) return { installed: true, already: true, prefix: window[KEY].prefix };
  const prefix = config.prefix;
  const original = window.fetch;
  if (typeof original !== 'function') return { installed: false, error: 'window.fetch 不可用' };
  const state = { installed: true, prefix, rejected: 0, passed: 0, attempts: [], original, installedAt: Date.now() };
  window[KEY] = state;
  const isWrite = (method) => method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  window.fetch = function faultFetch(input, init) {
    let url = '';
    let method = 'GET';
    try {
      url = typeof input === 'string' ? input : input && input.url ? String(input.url) : '';
      method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    } catch (error) {
      url = '';
    }
    if (url.indexOf(prefix) >= 0 && isWrite(method)) {
      state.rejected += 1;
      if (state.attempts.length < 50) {
        state.attempts.push({ url, method, at: Date.now() - state.installedAt });
      }
      return Promise.reject(new TypeError('fault:persistence-write-fail ' + method + ' ' + url));
    }
    return original.call(this, input, init);
  };
  return {
    installed: true,
    already: false,
    prefix,
    fetchType: typeof window.fetch,
    originalFetch: original.name || 'fetch',
  };
}

function readPersistenceWriteFailStateInPage() {
  const KEY = '__dshPromptFaultFetch';
  const state = window[KEY];
  if (!state || !state.installed) return { installed: false };
  return {
    installed: true,
    prefix: state.prefix,
    rejected: state.rejected,
    passed: state.passed,
    attempts: state.attempts.slice(0, 20),
  };
}

function uninstallPersistenceWriteFailInPage() {
  const KEY = '__dshPromptFaultFetch';
  const state = window[KEY];
  if (!state || !state.installed) return { restored: false, reason: '未安装' };
  window.fetch = state.original;
  delete window[KEY];
  return { restored: true, rejected: state.rejected, fetchType: typeof window.fetch };
}

/* ------------------------------------------------------------------------- */
/* 注册表                                                                     */
/* ------------------------------------------------------------------------- */

/** 输入 actions 降级后应红的断言：两路插入的 captureInsertion 光标证据都拿不到。 */
const INPUT_ACTIONS_EXPECTED_RED = [
  '③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）',
  '③光标位置（合成路径）：插入后光标在正文末尾',
];

/** 坐标错位后应红：物理点击不会发生插入 → 场景 2 的等待条件超时。 */
const OFFSET_EXPECTED_RED = ['场景 2：行插入落位：等待观测条件超时'];

/** 写失败后应红：场景 2 的 usage/lastUsed 等待、场景 3 的 hidePreset 等待超时。 */
const WRITE_FAIL_EXPECTED_RED = [
  '场景 2：行插入落位：等待观测条件超时',
  '场景 3：设置页控件切换：等待观测条件超时',
];

export const INJECTORS = Object.freeze([
  Object.freeze({
    id: 'input-actions-missing',
    title: '输入 actions 能力缺失（强制走 setDraft 降级）',
    description:
      '把 composer 宿主 inputActions.captureInsertion 置空：产品 applyInsert 走降级分支，观测探针捕获不到插入位置。',
    expectedRed: Object.freeze([...INPUT_ACTIONS_EXPECTED_RED]),
    expectedStayGreen: Object.freeze([
      'fixture 起始态',
      '③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）',
      '双通道·持久化：插入后 usage 计数 +1（store，期望=声明值+1）',
    ]),
    async install({ client }) {
      const evidence = await client.evaluate(pageCall(installInputActionsMissingInPage, null), { returnByValue: true });
      if (!evidence || evidence.installed !== true) {
        throw new HarnessError(
          '故障注入 input-actions-missing 安装失败：' + (evidence && evidence.error ? evidence.error : '页面内未确认'),
        );
      }
      return {
        evidence,
        handles: {},
        async uninstall() {
          const restored = await client.evaluate(pageCall(uninstallInputActionsMissingInPage, null), { returnByValue: true });
          return { ...restored, evidence };
        },
      };
    },
  }),
  Object.freeze({
    id: 'insert-coordinate-offset',
    title: '插入点击坐标偏移（物理点击落到行外）',
    description:
      '包装输入驱动 clickAt：命中模板行的物理点击被挪到行右侧空白，插入不触发；未命中行的点击原样透传。',
    expectedRed: Object.freeze([...OFFSET_EXPECTED_RED]),
    expectedStayGreen: Object.freeze([
      // 坐标错位让「插入是否发生」的第一次等待就超时，场景 2 后续检查不会被记录；
      // 所以只声明运行级起始态（一定先跑）作为「注入没有污染基线」的证据。
      'fixture 起始态',
    ]),
    async install({ input }) {
      const wrapped = createInsertCoordinateOffset(input);
      return {
        evidence: wrapped.log,
        handles: { input: wrapped.input },
        async uninstall() {
          return { restored: true, shifted: wrapped.log.shifted, bypassed: wrapped.log.bypassed, attempts: wrapped.log.attempts.slice(0, 20) };
        },
      };
    },
  }),
  Object.freeze({
    id: 'persistence-write-fail',
    title: '持久化写入失败（store 写请求被拒）',
    description:
      '页面侧覆写 window.fetch：插件 store 前缀的写请求一律 reject，读请求放行；产品无法把插入/勾选/触发方式落盘。',
    expectedRed: Object.freeze([...WRITE_FAIL_EXPECTED_RED]),
    expectedStayGreen: Object.freeze([
      'fixture 起始态',
      '③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）',
      '④设置页：物理点勾选框后 UI 状态翻转（true→false）',
    ]),
    async install({ client }) {
      const evidence = await client.evaluate(
        pageCall(installPersistenceWriteFailInPage, { prefix: STORE_HTTP_PREFIX }),
        { returnByValue: true },
      );
      if (!evidence || evidence.installed !== true) {
        throw new HarnessError(
          '故障注入 persistence-write-fail 安装失败：' + (evidence && evidence.error ? evidence.error : '页面内未确认'),
        );
      }
      return {
        evidence,
        handles: {},
        async uninstall() {
          const state = await client.evaluate(pageCall(readPersistenceWriteFailStateInPage, null), { returnByValue: true });
          const restored = await client.evaluate(pageCall(uninstallPersistenceWriteFailInPage, null), { returnByValue: true });
          return { ...restored, state };
        },
      };
    },
  }),
]);

export const INJECTOR_IDS = Object.freeze(INJECTORS.map((injector) => injector.id));

export function getInjector(id) {
  const injector = INJECTORS.find((candidate) => candidate.id === id);
  if (!injector) {
    throw new HarnessError('未知故障注入器：' + id + '。可用：' + INJECTOR_IDS.join(', '));
  }
  return injector;
}

/** 只暴露报告需要的元数据（不带函数）。 */
export function describeInjector(injector) {
  return {
    id: injector.id,
    title: injector.title,
    description: injector.description,
    expectedRed: [...injector.expectedRed],
    expectedStayGreen: [...injector.expectedStayGreen],
  };
}

export function listInjectors() {
  return INJECTORS.map(describeInjector);
}

/** 把 `--fault a,b` / `DSH_REAL_FAULT=a,b` 解析成去空的 id 数组。 */
export function parseFaultIds(value) {
  if (value == null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = [];
  for (const item of raw) {
    const id = String(item).trim();
    if (!id) continue;
    if (!ids.includes(id)) ids.push(id);
    else throw new HarnessError('重复的故障注入器：' + id + '（--fault 里每个 id 只能出现一次）');
  }
  return ids;
}

export function assertKnownFaultIds(ids) {
  for (const id of ids) getInjector(id);
  return ids;
}
