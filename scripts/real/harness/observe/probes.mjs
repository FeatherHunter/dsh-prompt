/**
 * 边界观测层之页面探针（#188）：一次 evaluate 原样采回六个观测面的原始 JSON。
 *
 * 原则：
 * - **只采集，不判断**：这里不写「应该是什么」，不算期望值，不做断言；缺元素就记 null/0/false；
 * - 只用公开契约定位：插件自己的 `data-dsh-prompt-*` 钩子 + 宿主契约（composer 的
 *   contenteditable / role=textbox、settings dialog 的 role=dialog + aria-modal）；
 * - 用户可见面用用户可见量：文本取 innerText，状态取 checked/aria-pressed，几何取 getBoundingClientRect；
 * - 内部状态（React fiber 的 inputActions 深度）单独放 detail，不混入可断言字段。
 *
 * 原始结果交给 observe/interpret.mjs 分级解释；本文件不 import interpret。
 */

import { HarnessError } from '../errors.mjs';
import { inputActionsInPage } from '../contract/preflight.mjs';

export const PROBE_VERSION = 1;

/** 插件侧契约钩子（data-dsh-prompt-* 是插件公开观测契约，不是内部类名）。 */
export const HOOKS = Object.freeze({
  entry: 'data-dsh-prompt-entry',
  panelRoot: 'data-dsh-prompt-panel-root',
  bar: 'data-dsh-prompt-bar',
  close: 'data-dsh-prompt-close',
  list: 'data-dsh-prompt-list',
  row: 'data-dsh-prompt-id',
  counts: 'data-dsh-prompt-counts',
  remotePanel: 'data-dsh-prompt-remote-panel',
  modal: 'data-dsh-prompt-modal',
  trigger: 'data-dsh-prompt-trigger',
  hideToggle: 'data-dsh-prompt-hide-toggle',
  remoteSection: 'data-dsh-prompt-remote-section',
});

/**
 * 页面内采集函数（必须自包含：会被 toString 注入页面）。
 * 返回票面 A 的六个观测面原始值。
 */
function collectSnapshotInPage(hooks) {
  const doc = document;
  const h = hooks;
  const round = (value) => Math.round(value * 100) / 100;
  const rectOf = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
      cx: round(rect.x + rect.width / 2),
      cy: round(rect.y + rect.height / 2),
    };
  };
  const styleOf = (el) => {
    try {
      return getComputedStyle(el);
    } catch (error) {
      return null;
    }
  };
  const visibleOf = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = styleOf(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) <= 0) return false;
    return rect.width > 0 && rect.height > 0;
  };
  const textOf = (el) => {
    if (!el) return '';
    const inner = typeof el.innerText === 'string' ? el.innerText : '';
    const text = inner || el.textContent || '';
    return String(text).trim();
  };
  const all = (selector, root) => {
    try {
      return Array.from((root || doc).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  };
  const visibleButtons = (root) => {
    const buttons = all('button', root);
    const out = [];
    for (const button of buttons) {
      if (!visibleOf(button)) continue;
      const text = textOf(button);
      if (!text) continue;
      out.push({ text: text.length > 80 ? text.slice(0, 80) : text, rect: rectOf(button) });
      if (out.length >= 60) break;
    }
    return out;
  };

  const out = { version: 1, at: Date.now(), href: String(location.href), lang: String(doc.documentElement.lang || '') };

  /* ① 面板根与开关 + 触发按钮入口 */
  const entries = all('[' + h.entry + ']');
  out.entry = {
    count: entries.length,
    first: entries[0]
      ? { rect: rectOf(entries[0]), text: textOf(entries[0]), visible: visibleOf(entries[0]), title: entries[0].getAttribute('title') }
      : null,
  };
  const holders = all('[' + h.panelRoot + ']');
  let panelRect = null;
  let panelChildCount = 0;
  let panelVisible = false;
  const holderChildCounts = [];
  for (const holder of holders) {
    const children = Array.from(holder.children);
    holderChildCounts.push(children.length);
    for (const child of children) {
      if (!visibleOf(child)) continue;
      panelVisible = true;
      panelRect = rectOf(child);
      panelChildCount = children.length;
      break;
    }
    if (panelVisible) break;
  }
  out.panel = {
    holderCount: holders.length,
    holderChildCounts,
    visible: panelVisible,
    rect: panelRect,
    childCount: panelChildCount,
  };

  const bars = all('[' + h.bar + ']');
  const visibleBar = bars.find((bar) => visibleOf(bar)) || null;
  out.panel.bar = visibleBar
    ? {
        present: true,
        text: textOf(visibleBar),
        countsText: (() => {
          const counts = visibleBar.querySelector('[' + h.counts + ']');
          return counts ? textOf(counts) : null;
        })(),
        closePresent: !!visibleBar.querySelector('[data-dsh-prompt-close]'),
        closeRect: (() => {
          const closeEl = visibleBar.querySelector('[data-dsh-prompt-close]');
          return closeEl ? rectOf(closeEl) : null;
        })(),
        goSettingsPresent: !!visibleBar.querySelector('[data-dsh-prompt-chrome="goSettings"]'),
        goSettingsRect: (() => {
          const goEl = visibleBar.querySelector('[data-dsh-prompt-chrome="goSettings"]');
          return goEl ? rectOf(goEl) : null;
        })(),
        rect: rectOf(visibleBar),
      }
    : { present: false, text: '', countsText: null, closePresent: false, closeRect: null, goSettingsPresent: false, goSettingsRect: null, rect: null };

  /* ② 模板列表行（compact 列表；按契约钩子 + 用户可见文本采集） */
  const lists = all('[' + h.list + ']');
  const listEl = lists.find((el) => visibleOf(el)) || lists[0] || null;
  const rowEls = listEl ? all('[' + h.row + ']', listEl) : [];
  out.panel.list = {
    present: !!listEl,
    rows: rowEls.map((row, index) => ({
      index,
      id: row.getAttribute(h.row) || '',
      text: textOf(row),
      visible: visibleOf(row),
      rect: rectOf(row),
    })),
  };

  /* ⑤ 弹层/远程列表 */
  const remotePanels = all('[' + h.remotePanel + ']');
  const remotePanel = remotePanels.find((el) => visibleOf(el)) || remotePanels[0] || null;
  const remoteRows = remotePanel ? all('[' + h.row + ']', remotePanel) : [];
  out.panel.remotePanel = {
    present: remotePanels.length > 0,
    visible: remotePanel ? visibleOf(remotePanel) : false,
    rect: remotePanel ? rectOf(remotePanel) : null,
    textSnippet: remotePanel ? textOf(remotePanel).slice(0, 200) : '',
    rows: remoteRows.map((row, index) => ({ index, id: row.getAttribute(h.row) || '', text: textOf(row), rect: rectOf(row) })),
  };
  const modals = all('[' + h.modal + ']');
  out.panel.modals = modals.map((modal) => ({
    rect: rectOf(modal),
    visible: visibleOf(modal),
    textSnippet: textOf(modal).slice(0, 200),
  }));

  /* ③ 编辑器草稿文本与光标位置 */
  const composerEl =
    doc.querySelector('[data-composer-input][contenteditable="true"]') ||
    doc.querySelector('[contenteditable="true"][role="textbox"]') ||
    doc.querySelector('[contenteditable="true"]');
  let selection = { start: null, end: null, collapsed: true, anchorText: '', focusText: '', rangeCount: 0 };
  if (composerEl) {
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0) {
      const offsetOf = (node, offset) => {
        try {
          const range = doc.createRange();
          range.selectNodeContents(composerEl);
          range.setEnd(node, offset);
          return range.toString().length;
        } catch (error) {
          return null;
        }
      };
      const anchorIn = sel.anchorNode && composerEl.contains(sel.anchorNode);
      const focusIn = sel.focusNode && composerEl.contains(sel.focusNode);
      selection = {
        start: anchorIn ? offsetOf(sel.anchorNode, sel.anchorOffset) : null,
        end: focusIn ? offsetOf(sel.focusNode, sel.focusOffset) : null,
        collapsed: sel.isCollapsed === true,
        anchorText: (sel.anchorNode && sel.anchorNode.textContent ? sel.anchorNode.textContent : '').slice(0, 40),
        focusText: (sel.focusNode && sel.focusNode.textContent ? sel.focusNode.textContent : '').slice(0, 40),
        rangeCount: sel.rangeCount,
      };
    }
  }
  const active = doc.activeElement;
  out.composer = {
    present: !!composerEl,
    count: all('[contenteditable="true"]').length,
    rect: composerEl ? rectOf(composerEl) : null,
    focused: !!(composerEl && active && (active === composerEl || composerEl.contains(active))),
    text: composerEl ? String(composerEl.innerText === undefined ? composerEl.textContent || '' : composerEl.innerText) : '',
    textLength: composerEl ? String(composerEl.innerText === undefined ? composerEl.textContent || '' : composerEl.innerText).length : 0,
    selection,
    inputActions: { found: false, depth: null, capture: null, captureError: null },
  };

  /* ④ 设置页区块与控件（宿主弹窗按 role=dialog + aria-modal 语义定位） */
  const dialogs = all('[role="dialog"]').filter((el) => visibleOf(el) && el.getAttribute('aria-modal') === 'true');
  const dialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
  const scope = dialog || doc;
  const hideToggleEl = scope.querySelector('[' + h.hideToggle + ']');
  const remoteSectionEl = scope.querySelector('[' + h.remoteSection + ']');
  const triggerInScope = all('[' + h.trigger + ']', scope)[0] || null;
  out.settings = {
    dialog: {
      present: !!dialog,
      visible: dialog ? visibleOf(dialog) : false,
      rect: dialog ? rectOf(dialog) : null,
      ariaModal: dialog ? dialog.getAttribute('aria-modal') === 'true' : false,
      shortcutModal: dialog ? dialog.getAttribute('data-shortcut-modal') : null,
      sectionNavRows: dialog ? visibleButtons(dialog) : [],
    },
    section: {
      present: !!(hideToggleEl || remoteSectionEl || triggerInScope),
      hideToggle: hideToggleEl
        ? { present: true, checked: hideToggleEl.checked === true, disabled: hideToggleEl.disabled === true, rect: rectOf(hideToggleEl) }
        : { present: false, checked: null, disabled: false, rect: null },
      remoteSection: { present: !!remoteSectionEl, rect: remoteSectionEl ? rectOf(remoteSectionEl) : null },
      triggerButton: triggerInScope
        ? {
            present: true,
            ariaPressed: triggerInScope.getAttribute('aria-pressed'),
            text: textOf(triggerInScope),
            title: triggerInScope.getAttribute('title'),
            rect: rectOf(triggerInScope),
          }
        : { present: false, ariaPressed: null, text: '', title: null, rect: null },
    },
  };

  /* ⑥ 触发按钮及状态（入口 + 底栏触发方式按钮） */
  const visibleBarEl = bars.find((bar) => visibleOf(bar)) || null;
  const barTriggerEl = visibleBarEl ? all('[' + h.trigger + ']', visibleBarEl)[0] || null : null;
  const triggerEls = all('[' + h.trigger + ']');
  out.trigger = {
    entryPresent: entries.length > 0,
    entryRect: entries[0] ? rectOf(entries[0]) : null,
    triggerCount: triggerEls.length,
    barTrigger: barTriggerEl
      ? {
          present: true,
          ariaPressed: barTriggerEl.getAttribute('aria-pressed'),
          text: textOf(barTriggerEl),
          title: barTriggerEl.getAttribute('title'),
          rect: rectOf(barTriggerEl),
        }
      : { present: false, ariaPressed: null, text: '', title: null, rect: null },
  };

  /* ⑤ 弹层汇总（解释器可整面断言） */
  out.overlays = {
    modalCount: modals.length,
    remotePanelPresent: remotePanels.length > 0,
    remotePanelVisible: remotePanel ? visibleOf(remotePanel) : false,
    settingsDialogPresent: !!dialog,
  };

  return out;
}

/** 构造注入页面的表达式：采集快照 + 宿主公开接口 inputActions 捕获（#185 的 fiber 探测复用）。 */
export function snapshotExpression() {
  return (
    '(function () {' +
    '  const collect = (' + collectSnapshotInPage.toString() + ');' +
    '  const capture = (' + inputActionsInPage.toString() + ');' +
    '  const raw = collect(' + JSON.stringify(HOOKS) + ');' +
    '  let got = { ok: false, depth: null, capture: null, captureError: null };' +
    '  try { got = capture(); } catch (error) { got = { ok: false, depth: null, capture: null, captureError: String(error && error.message ? error.message : error) }; }' +
    '  raw.composer.inputActions = {' +
    '    found: got && got.ok === true,' +
    '    depth: got && typeof got.depth === "number" ? got.depth : null,' +
    '    capture: got && got.capture ? { start: got.capture.start, end: got.capture.end, draftRev: got.capture.draftRev } : null,' +
    '    captureError: got && got.captureError ? String(got.captureError) : null,' +
    '  };' +
    '  return raw;' +
    '})()'
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 采集一次原始快照（不解释、不断言）。 */
export async function collectSnapshot(client, options = {}) {
  const timeoutMs = options.timeoutMs === undefined ? 15_000 : options.timeoutMs;
  const raw = await client.evaluate(snapshotExpression(), { returnByValue: true, timeoutMs });
  if (!raw || typeof raw !== 'object' || raw.version !== PROBE_VERSION) {
    throw new HarnessError('观测快照版本不符：' + JSON.stringify(raw && raw.version) + '（期望 ' + PROBE_VERSION + '）');
  }
  return raw;
}

/**
 * 轮询直到 predicate(raw) 为真；超时抛 HarnessError（消息含「等待超时」以对齐套件的 FAIL 判定）。
 */
export async function waitForSnapshot(client, predicate, options = {}) {
  const timeoutMs = options.timeoutMs === undefined ? 8_000 : options.timeoutMs;
  const pollMs = options.pollMs === undefined ? 100 : options.pollMs;
  const label = options.label || '观测条件成立';
  const started = Date.now();
  let last = null;
  let lastError = null;
  while (Date.now() - started <= timeoutMs) {
    try {
      last = await collectSnapshot(client, { timeoutMs: Math.max(2_000, timeoutMs) });
      lastError = null;
      if (predicate(last)) return last;
    } catch (error) {
      lastError = error;
    }
    await sleep(pollMs);
  }
  if (lastError) {
    throw new HarnessError('等待超时（' + timeoutMs + 'ms）：' + label + '；采集失败：' + String(lastError.message || lastError));
  }
  throw new HarnessError('等待超时（' + timeoutMs + 'ms）：' + label + '；末次快照=' + JSON.stringify(last && {
    panel: last.panel && last.panel.visible,
    dialog: last.settings && last.settings.dialog && last.settings.dialog.present,
    composer: last.composer && {
      text: last.composer.text,
      focused: last.composer.focused,
      selection: last.composer.selection,
      capture: last.composer.inputActions && last.composer.inputActions.capture,
      captureError: last.composer.inputActions && last.composer.inputActions.captureError,
    },
  }));
}

/* ────────────────────────── 诊断探针（#183 评审整改 F1） ──────────────────────────
 * 这些表达式原先写在 boundary 套件里，但它们同属「页面观测设施」而不是场景断言：
 * 套件只该按六元组写布置与断言，页面探针必须沉在观测层，字段清单与维护入口才唯一。
 * 三者都只读页面状态（装 scroll 日志只加 capture 监听、不改页面行为），不参与期望值计算。
 */

/**
 * document.elementFromPoint 的命中链 + 所有 trigger 按钮的几何/状态。
 * 只在「等待观测条件超时」「物理点击没打到目标」时采集，用来区分「产品没响应」与「点击没打到目标」；
 * 属于诊断证据，不是断言来源。
 */
export function hitTestExpression(point) {
  return (
    '(function () {' +
    '  const point = ' + JSON.stringify({ x: point.x, y: point.y }) + ';' +
    '  const contractAttrs = (node) => {' +
    '    const attrs = {};' +
    '    for (const attr of (node.attributes || [])) {' +
    '      if (attr.name.indexOf("data-dsh-prompt-") !== 0) continue;' +
    '      attrs[attr.name] = attr.value.length > 80 ? attr.value.slice(0, 80) : attr.value;' +
    '    }' +
    '    return attrs;' +
    '  };' +
    '  const describe = (node) => {' +
    '    if (!node || node.nodeType !== 1) return node ? { tag: String(node.nodeName || "") } : null;' +
    '    let owner = null;' +
    '    for (let cur = node; cur && cur.nodeType === 1; cur = cur.parentElement) {' +
    '      const attrs = contractAttrs(cur);' +
    '      if (Object.keys(attrs).length > 0) { owner = { tag: String(cur.tagName || "").toLowerCase(), attrs }; break; }' +
    '    }' +
    '    const rect = node.getBoundingClientRect();' +
    '    let pointerEvents = null;' +
    '    try { pointerEvents = getComputedStyle(node).pointerEvents; } catch (error) { pointerEvents = null; }' +
    '    return {' +
    '      tag: String(node.tagName || "").toLowerCase(),' +
    '      owner,' +
    '      role: node.getAttribute ? node.getAttribute("role") : null,' +
    '      text: String(node.innerText || node.textContent || "").trim().slice(0, 60),' +
    '      pointerEvents,' +
    '      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 },' +
    '    };' +
    '  };' +
    '  const triggers = Array.from(document.querySelectorAll("[data-dsh-prompt-trigger]")).map((node) => ({' +
    '    ariaPressed: node.getAttribute("aria-pressed"),' +
    '    text: String(node.innerText || node.textContent || "").trim().slice(0, 40),' +
    '    rect: (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; })(),' +
    '  }));' +
    '  return {' +
    '    point,' +
    '    hit: describe(document.elementFromPoint(point.x, point.y)),' +
    '    activeElement: describe(document.activeElement),' +
    '    triggerCount: triggers.length,' +
    '    triggers,' +
    '    dialogCount: Array.from(document.querySelectorAll("[role=dialog][aria-modal=true]")).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length,' +
    '  };' +
    '})()'
  );
}

/** 页面滚动事件日志键（诊断用）。 */
export const SCROLL_LOG_KEY = '__dshPromptScrollLog';

/**
 * 页面滚动事件日志（诊断用）：capture 阶段记录任何容器/文档的 scroll 事件与 scrollTop。
 * 用来区分「滚动是产品行为」还是「工具/宿主滚动容器行为」——尤其是设置页控件几何在
 * 快照与点击之间变化时，先看是谁在什么时候滚了它。
 */
export function scrollLogInstallExpression() {
  return (
    '(function () {' +
    '  if (window.' + SCROLL_LOG_KEY + ') return "already-installed";' +
    '  window.' + SCROLL_LOG_KEY + ' = [];' +
    '  const attrsOf = (node) => {' +
    '    const attrs = {};' +
    '    for (const attr of (node.attributes || [])) {' +
    '      if (attr.name.indexOf("data-dsh-prompt-") !== 0) continue;' +
    '      attrs[attr.name] = attr.value.length > 60 ? attr.value.slice(0, 60) : attr.value;' +
    '    }' +
    '    return attrs;' +
    '  };' +
    '  document.addEventListener("scroll", (event) => {' +
    '    const node = event.target;' +
    '    const isElement = !!(node && node.nodeType === 1);' +
    '    window.' + SCROLL_LOG_KEY + '.push({' +
    '      at: Math.round(window.performance && performance.now ? performance.now() : Date.now()),' +
    '      tag: isElement ? String(node.tagName || "").toLowerCase() : "#document",' +
    '      attrs: isElement ? attrsOf(node) : {},' +
    '      scrollTop: Math.round(isElement ? node.scrollTop : (document.scrollingElement || {}).scrollTop || 0),' +
    '      scrollHeight: isElement ? node.scrollHeight : (document.scrollingElement || {}).scrollHeight,' +
    '      clientHeight: isElement ? node.clientHeight : (document.scrollingElement || {}).clientHeight,' +
    '    });' +
    '    if (window.' + SCROLL_LOG_KEY + '.length > 300) window.' + SCROLL_LOG_KEY + '.shift();' +
    '  }, true);' +
    '  return "installed";' +
    '})()'
  );
}

/** 清空页面滚动事件日志。 */
export function scrollLogClearExpression() {
  return '(window.' + SCROLL_LOG_KEY + ' = [], "cleared")';
}

/** 读取页面滚动事件日志（最近 80 条）。 */
export function scrollLogReadExpression() {
  return '(window.' + SCROLL_LOG_KEY + ' || []).slice(-80)';
}
