/**
 * 原始观测 → 分级字段（#188 的「先记录再解释」中的解释半步）。
 *
 * 页面探针（probes.mjs）只负责原样采集：几何、文本、属性、公开接口返回值。
 * 解释器在这里把原始 JSON 变成**带来源等级的字段**，期望值由套件从规格/契约给出——
 * 解释器不认识「应该是多少」，只回答「观测到了什么、这个值有多可信」。
 *
 * 六个观测面（票面 A）：
 *   ① panel   —— 应用面板根与开关状态
 *   ② rows    —— 模板列表行（身份走契约钩子，文本走用户可见）
 *   ③ composer—— 编辑器草稿文本与光标位置
 *   ④ settings—— 设置页区块与控件
 *   ⑤ overlays—— 弹层/远程列表
 *   ⑥ trigger —— 触发按钮及状态
 * 另加 ⑦ store（持久化通道）用于双通道对账。
 */

import { grade } from './source.mjs';
import { normalizeText, matchText } from './text.mjs';

/** 安全读取嵌套字段。 */
function pick(object, path) {
  let current = object;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

function field(value, source) {
  return grade(value, source);
}

function rectField(rect) {
  if (!rect || typeof rect !== 'object') return field(null, 'user-visible');
  return field(
    { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    'user-visible',
  );
}

/* ────────────────────────────── ① 面板根与开关 ────────────────────────────── */

export function interpretPanel(raw) {
  const panel = pick(raw, ['panel']) || {};
  const visible = panel.visible === true;
  return {
    fields: {
      present: field((panel.holderCount || 0) > 0, 'public-api'),
      visible: field(visible, 'user-visible'),
      open: field(visible, 'user-visible'),
      rect: rectField(panel.rect),
      childCount: field(panel.childCount || 0, 'user-visible'),
      barPresent: field(!!(panel.bar && panel.bar.present), 'public-api'),
      barText: field(String((panel.bar && panel.bar.text) || ''), 'user-visible'),
      countsText: field(panel.bar ? String(panel.bar.countsText || '') : '', 'user-visible'),
    },
  };
}

/* ────────────────────────────── ② 模板列表行 ────────────────────────────── */

export function interpretRows(raw) {
  const list = pick(raw, ['panel', 'list']) || {};
  const rows = Array.isArray(list.rows) ? list.rows : [];
  return {
    fields: {
      listPresent: field(!!list.present, 'public-api'),
      count: field(rows.length, 'user-visible'),
      visibleCount: field(rows.filter((row) => row && row.visible !== false).length, 'user-visible'),
      ids: field(rows.map((row) => (row && typeof row.id === 'string' ? row.id : '')), 'public-api'),
      texts: field(rows.map((row) => normalizeText(row && row.text)), 'user-visible'),
      rects: field(rows.map((row) => (row && row.rect ? row.rect : null)), 'user-visible'),
      rowSources: field({ id: 'public-api', text: 'user-visible', rect: 'user-visible' }, 'public-api'),
    },
  };
}

/* ────────────────────────────── ③ 草稿文本与光标 ────────────────────────────── */

export function interpretComposer(raw) {
  const composer = pick(raw, ['composer']) || {};
  const text = typeof composer.text === 'string' ? composer.text : '';
  const selection = composer.selection || {};
  const inputActions = composer.inputActions || {};
  const capture = inputActions.capture || null;
  return {
    fields: {
      present: field(!!composer.present, 'public-api'),
      draftText: field(text, 'user-visible'),
      draftChars: field(text.length, 'user-visible'),
      focused: field(composer.focused === true, 'user-visible'),
      rect: rectField(composer.rect),
      caretStart: field(capture ? capture.start : null, 'public-api'),
      caretEnd: field(capture ? capture.end : null, 'public-api'),
      draftRev: field(capture ? capture.draftRev : null, 'public-api'),
      selectionStart: field(typeof selection.start === 'number' ? selection.start : null, 'user-visible'),
      selectionEnd: field(typeof selection.end === 'number' ? selection.end : null, 'user-visible'),
      selectionCollapsed: field(selection.collapsed === true, 'user-visible'),
      inputActionsFound: field(inputActions.found === true, 'public-api'),
    },
    detail: {
      captureError: inputActions.captureError || null,
      inputActionsDepth: typeof inputActions.depth === 'number' ? inputActions.depth : null,
    },
  };
}

/* ────────────────────────────── ④ 设置页区块与控件 ────────────────────────────── */

export function interpretSettings(raw, options = {}) {
  const settings = pick(raw, ['settings']) || {};
  const dialog = settings.dialog || {};
  const section = settings.section || {};
  const navRows = Array.isArray(dialog.sectionNavRows) ? dialog.sectionNavRows : [];
  const hideToggle = section.hideToggle || {};
  const triggerButton = section.triggerButton || {};
  const sectionNames = options.sectionName === undefined ? [] : [].concat(options.sectionName);
  const navMatch = sectionNames.length > 0
    && navRows.some((row) => sectionNames.some((name) => matchText(row && row.text, String(name))));
  const ariaPressed = typeof triggerButton.ariaPressed === 'string' ? triggerButton.ariaPressed : null;
  let triggerMode = null;
  if (ariaPressed === 'true') triggerMode = 'click';
  else if (ariaPressed === 'false') triggerMode = 'hover';
  return {
    fields: {
      dialogOpen: field(dialog.present === true, 'user-visible'),
      dialogVisible: field(dialog.visible === true, 'user-visible'),
      dialogRect: rectField(dialog.rect),
      ariaModal: field(dialog.ariaModal === true, 'user-visible'),
      navRows: field(navRows.map((row) => normalizeText(row && row.text)), 'user-visible'),
      navMatch: field(navMatch, 'user-visible'),
      sectionPresent: field(section.present === true, 'user-visible'),
      hidePreset: field(typeof hideToggle.checked === 'boolean' ? hideToggle.checked : null, 'user-visible'),
      hideTogglePresent: field(!!hideToggle.present, 'public-api'),
      hideToggleRect: rectField(hideToggle.rect),
      remoteSectionPresent: field(!!(section.remoteSection && section.remoteSection.present), 'public-api'),
      triggerAriaPressed: field(ariaPressed, 'user-visible'),
      triggerMode: field(triggerMode, 'public-api'),
      triggerButtonText: field(String(triggerButton.text || ''), 'user-visible'),
    },
  };
}

/* ────────────────────────────── ⑤ 弹层/远程列表 ────────────────────────────── */

export function interpretOverlays(raw) {
  const overlays = pick(raw, ['overlays']) || {};
  const modals = Array.isArray(pick(raw, ['panel', 'modals'])) ? pick(raw, ['panel', 'modals']) : [];
  const remotePanel = pick(raw, ['panel', 'remotePanel']) || {};
  const remoteRows = Array.isArray(remotePanel.rows) ? remotePanel.rows : [];
  return {
    fields: {
      modalCount: field(typeof overlays.modalCount === 'number' ? overlays.modalCount : modals.length, 'user-visible'),
      modalRects: field(modals.map((modal) => (modal && modal.rect) || null), 'user-visible'),
      remotePanelPresent: field(remotePanel.present === true, 'public-api'),
      remotePanelVisible: field(remotePanel.visible === true, 'user-visible'),
      remoteRowCount: field(remoteRows.length, 'user-visible'),
      settingsDialogPresent: field(overlays.settingsDialogPresent === true, 'user-visible'),
    },
  };
}

/* ────────────────────────────── ⑥ 触发按钮及状态 ────────────────────────────── */

export function interpretTrigger(raw) {
  const trigger = pick(raw, ['trigger']) || {};
  const barTrigger = trigger.barTrigger || {};
  const entry = pick(raw, ['entry', 'first']) || {};
  const ariaPressed = typeof barTrigger.ariaPressed === 'string' ? barTrigger.ariaPressed : null;
  return {
    fields: {
      entryPresent: field(trigger.entryPresent === true, 'public-api'),
      entryText: field(String(entry.text || ''), 'user-visible'),
      entryRect: rectField(trigger.entryRect || entry.rect),
      entryTitle: field(entry.title || null, 'user-visible'),
      barTriggerPresent: field(trigger.barTrigger && trigger.barTrigger.present === true, 'public-api'),
      barTriggerAriaPressed: field(ariaPressed, 'user-visible'),
      barTriggerText: field(String(barTrigger.text || ''), 'user-visible'),
      barTriggerRect: rectField(barTrigger.rect),
    },
  };
}

/* ────────────────────────────── ⑦ 持久化通道（双通道之一） ────────────────────────────── */

export function interpretStore(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      fields: {
        storePresent: field(false, 'persisted'),
        hidePreset: field(null, 'persisted'),
        hoverTrigger: field(null, 'persisted'),
        usage: field({}, 'persisted'),
        lastUsed: field(null, 'persisted'),
        customCount: field(null, 'persisted'),
        customs: field([], 'persisted'),
      },
    };
  }
  const present = snapshot.storePresent !== false;
  const customs = Array.isArray(snapshot.customs) ? snapshot.customs : [];
  return {
    fields: {
      storePresent: field(present, 'persisted'),
      hidePreset: field(typeof snapshot.hidePreset === 'boolean' ? snapshot.hidePreset : null, 'persisted'),
      hoverTrigger: field(typeof snapshot.hoverTrigger === 'boolean' ? snapshot.hoverTrigger : null, 'persisted'),
      usage: field(snapshot.usage && typeof snapshot.usage === 'object' ? snapshot.usage : {}, 'persisted'),
      lastUsed: field(snapshot.lastUsed === undefined ? null : snapshot.lastUsed, 'persisted'),
      customCount: field(present ? customs.length : null, 'persisted'),
      customs: field(customs.map((item) => ({ id: item && item.id, name: item && item.name })), 'persisted'),
    },
  };
}

/** 统一入口：一次解释六个观测面（store 另走 interpretStore，避免和双通道混在一起）。 */
export function interpretSnapshot(raw, options = {}) {
  return {
    panel: interpretPanel(raw),
    rows: interpretRows(raw),
    composer: interpretComposer(raw),
    settings: interpretSettings(raw, options),
    overlays: interpretOverlays(raw),
    trigger: interpretTrigger(raw),
  };
}
