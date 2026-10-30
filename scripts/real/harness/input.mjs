/**
 * 真实输入驱动（#188 票面 B）：把「用户输入」用 CDP 的公开输入协议打进页面。
 *
 * 为什么需要它：`element.click()` 是合成路径——没有悬停、没有 pointerdown/up 序列、
 * 事件 isTrusted=false，验证不了 hover 打开、物理焦点、真实按键与选区。
 * 本模块统一走 `harness/cdp.mjs` 的 Input 协议（唯一 CDP 客户端在 cdp.mjs）：
 *   move（多段）→ down → up；keyDown/keyUp（含修饰键）；Input.insertText；焦点/选区。
 *
 * 同时安装页面事件日志（含 isTrusted 标记）：套件把**物理路径**与**合成路径**的
 * 事件序列、原始观测和差异都写进报告（票面 C）。
 *
 * 合成点击保留为显式可选路径 `syntheticClick()`，返回值与报告里都标注 method。
 */

import { HarnessError } from './errors.mjs';
import {
  describePlan,
  modifierMask,
  planClick,
  planKey,
  planPointerPath,
  planShortcut,
  planTextInput,
} from './input-plan.mjs';

export const INPUT_LOG_KEY = '__dshPromptInputLog';
export const INPUT_LOG_CAP = 500;

const INPUT_EVENTS = [
  'pointerover',
  'pointerenter',
  'pointermove',
  'pointerdown',
  'pointerup',
  'pointerout',
  'pointerleave',
  'mousedown',
  'mouseup',
  'click',
  'keydown',
  'keyup',
  'beforeinput',
  'input',
  'focusin',
  'focusout',
  'selectionchange',
];

/** 页面内安装事件日志（必须自包含：会 toString 注入页面）。 */
function installInputLogInPage(config) {
  const key = config.key;
  if (window[key] && window[key].installed) return { installed: true, reused: true, cap: window[key].cap };
  const log = { installed: true, cap: config.cap, entries: [], seq: 0, startedAt: performance.now() };
  window[key] = log;

  // 契约属性名在**记录时**动态读取（面板打开后行/按钮才出现，安装时扫描会漏掉）。
  const readContractAttrs = (node) => {
    const attrs = {};
    const list = node && node.attributes ? node.attributes : [];
    for (let index = 0; index < list.length; index += 1) {
      const attr = list[index];
      if (attr.name.indexOf('data-dsh-prompt-') !== 0) continue;
      attrs[attr.name] = attr.value.length > 80 ? attr.value.slice(0, 80) : attr.value;
    }
    return attrs;
  };

  // 真实事件的 target 常是行内 span/svg（自己的契约属性可能只是另一个面，如
  // data-dsh-prompt-label）：向上走**整条契约链**，事件归给链上最近的组件（owner），
  // 并把链上所有 data-dsh-prompt-* 记进 chain——内层文本节点也能归入外层组件。
  const describe = (el) => {
    if (!el) return null;
    if (el.nodeType === 9) return { tag: '#document' };
    if (el.nodeType !== 1) return { tag: '#text' };
    const own = readContractAttrs(el);
    const chain = [];
    if (Object.keys(own).length > 0) chain.push({ tag: String(el.tagName || '').toLowerCase(), attrs: own });
    let owner = null;
    for (let node = el.parentElement; node && node.nodeType === 1; node = node.parentElement) {
      const attrs = readContractAttrs(node);
      if (Object.keys(attrs).length === 0) continue;
      const tag = String(node.tagName || '').toLowerCase();
      chain.push({ tag, attrs });
      if (!owner) {
        const ownerText = (node.innerText || node.textContent || '').trim();
        owner = {
          tag,
          attrs,
          text: ownerText.length > 60 ? ownerText.slice(0, 60) : ownerText,
        };
      }
      if (chain.length >= 5) break;
    }
    const out = { tag: String(el.tagName || '').toLowerCase(), attrs: owner ? owner.attrs : own };
    if (owner) out.owner = owner;
    if (chain.length > 0) out.chain = chain;
    if (el.getAttribute && el.getAttribute('role')) out.role = el.getAttribute('role');
    if (el.getAttribute && el.getAttribute('data-composer-input') !== null) out.composer = true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') out.contenteditable = true;
    const text = (el.innerText || el.textContent || '').trim();
    if (text) out.text = text.length > 60 ? text.slice(0, 60) : text;
    return out;
  };

  const push = (entry) => {
    log.seq += 1;
    entry.seq = log.seq;
    entry.at = Math.round(performance.now() - log.startedAt);
    log.entries.push(entry);
    if (log.entries.length > log.cap) log.entries.splice(0, log.entries.length - log.cap);
  };

  const record = (event) => {
    const entry = {
      type: event.type,
      trust: event.isTrusted === true,
      target: describe(event.target),
    };
    if (typeof event.key === 'string') entry.key = event.key;
    if (typeof event.code === 'string') entry.code = event.code;
    if (typeof event.modifiers === 'number') entry.modifiers = event.modifiers;
    else {
      let modifiers = 0;
      if (event.altKey) modifiers |= 1;
      if (event.ctrlKey) modifiers |= 2;
      if (event.metaKey) modifiers |= 4;
      if (event.shiftKey) modifiers |= 8;
      entry.modifiers = modifiers;
    }
    if (typeof event.button === 'number') entry.button = event.button;
    if (typeof event.buttons === 'number') entry.buttons = event.buttons;
    if (typeof event.clientX === 'number' && event.clientX !== 0) entry.x = Math.round(event.clientX * 100) / 100;
    if (typeof event.clientY === 'number' && event.clientY !== 0) entry.y = Math.round(event.clientY * 100) / 100;
    if (typeof event.inputType === 'string') entry.inputType = event.inputType;
    if (event.type === 'input' && event.target && typeof event.target.innerText === 'string') {
      entry.valueLength = event.target.innerText.length;
    }
    push(entry);
  };

  for (const type of config.events) {
    const options = type === 'focusin' || type === 'focusout' || type === 'selectionchange' ? true : true;
    document.addEventListener(type, record, options);
  }
  return { installed: true, reused: false, cap: log.cap };
}

/** 安装页面事件日志（幂等；返回安装信息）。 */
export async function installInputLog(client) {
  const result = await client.evaluate(
    '(' + installInputLogInPage.toString() + ')(' + JSON.stringify({ key: INPUT_LOG_KEY, cap: INPUT_LOG_CAP, events: INPUT_EVENTS }) + ')',
    { returnByValue: true },
  );
  return result;
}

/** 读取事件日志；默认清空（每条用例从零开始，避免上一场景污染）。 */
export async function readInputLog(client, options = {}) {
  const clear = options.clear !== false;
  const expression =
    '(function () {' +
    '  const log = window[' + JSON.stringify(INPUT_LOG_KEY) + '];' +
    '  const entries = log ? log.entries.slice() : [];' +
    (clear ? '  if (log) log.entries = [];' : '') +
    '  return { entries: entries, seq: log ? log.seq : 0, installed: !!(log && log.installed) };' +
    '})()';
  const result = await client.evaluate(expression, { returnByValue: true });
  return Array.isArray(result.entries) ? result.entries : [];
}

/** 清空事件日志。 */
export async function clearInputLog(client) {
  await client.evaluate(
    '(function () { const log = window[' + JSON.stringify(INPUT_LOG_KEY) + ']; if (log) log.entries = []; return true; })()',
    { returnByValue: true },
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 执行动作计划：唯一出口是 cdp.mjs 的公开输入方法。 */
async function dispatchPlan(client, plan, options = {}) {
  for (const op of plan) {
    if (op.type === 'mouseMoved') {
      await client.mouseMove(op.x, op.y, { modifiers: op.modifiers });
    } else if (op.type === 'mousePressed') {
      await client.mouseDown(op.x, op.y, { button: op.button, buttons: op.buttons, clickCount: op.clickCount, modifiers: op.modifiers });
    } else if (op.type === 'mouseReleased') {
      await client.mouseUp(op.x, op.y, { button: op.button, buttons: op.buttons, clickCount: op.clickCount, modifiers: op.modifiers });
    } else if (op.type === 'keyDown') {
      await client.keyDown(op);
    } else if (op.type === 'keyUp') {
      await client.keyUp(op);
    } else if (op.type === 'insertText') {
      await client.insertText(op.text);
    } else {
      throw new HarnessError('未知输入动作类型：' + JSON.stringify(op.type));
    }
    if (options.stepDelayMs) await sleep(options.stepDelayMs);
  }
  return plan;
}

/**
 * 真实输入驱动句柄。所有方法返回 {plan, description, ...}，计划与摘要可直接进报告。
 */
export function createInputDriver(client, options = {}) {
  if (!client || typeof client.mouseMove !== 'function' || typeof client.keyDown !== 'function') {
    throw new HarnessError('createInputDriver 需要 CDP client（含 mouseMove/keyDown）');
  }
  const defaultSteps = options.steps ?? 8;
  const stepDelayMs = options.stepDelayMs ?? 0;

  async function drive(plan) {
    await dispatchPlan(client, plan, { stepDelayMs });
    return { plan, description: describePlan(plan), method: 'physical' };
  }

  return {
    client,
    /** 安装/读取事件日志（含 isTrusted）。 */
    log: {
      install: () => installInputLog(client),
      read: (logOptions) => readInputLog(client, logOptions),
      clear: () => clearInputLog(client),
    },
    /** 多段指针移动：from → to（省略 from 时先移到 (1,1) 再进入，模拟真实用户轨迹）。 */
    async move(from, to, moveOptions = {}) {
      const start = from || { x: 1, y: 1 };
      const path = planPointerPath(start, to, { steps: moveOptions.steps ?? defaultSteps });
      const plan = path.map((point) => ({
        type: 'mouseMoved',
        x: point.x,
        y: point.y,
        buttons: 0,
        button: 'none',
        clickCount: 0,
        modifiers: modifierMask(moveOptions.modifiers),
      }));
      return await drive(plan);
    },
    /** 移动到某个矩形中心（元素几何来自观测层）。 */
    async moveToRect(rect, moveOptions = {}) {
      if (!rect) throw new HarnessError('moveToRect 需要矩形');
      return await this.move(moveOptions.from || null, { x: rect.cx ?? rect.x + rect.width / 2, y: rect.cy ?? rect.y + rect.height / 2 }, moveOptions);
    },
    /** 物理点击：多段 move → pressed → released。 */
    async clickAt(point, clickOptions = {}) {
      const plan = planClick(point, {
        from: clickOptions.from || { x: 1, y: 1 },
        steps: clickOptions.steps ?? defaultSteps,
        button: clickOptions.button,
        clickCount: clickOptions.clickCount,
        modifiers: clickOptions.modifiers,
      });
      return await drive(plan);
    },
    /** 物理点击矩形中心（模板行、按钮等观测到的几何）。 */
    async clickRect(rect, clickOptions = {}) {
      if (!rect) throw new HarnessError('clickRect 需要矩形');
      return await this.clickAt({ x: rect.cx ?? rect.x + rect.width / 2, y: rect.cy ?? rect.y + rect.height / 2 }, clickOptions);
    },
    /** 单键（可带修饰键数组）。 */
    async key(name, keyOptions = {}) {
      return await drive(planKey(name, { modifiers: keyOptions.modifiers }));
    },
    /** 快捷键简写，如 "Ctrl+A" / "Shift+ArrowLeft"。 */
    async shortcut(spec) {
      return await drive(planShortcut(spec));
    },
    /** 文本输入（一次 insertText，等价粘贴语义）。 */
    async typeText(text) {
      return await drive(planTextInput(text));
    },
    /** 重复按键（如多次 Shift+ArrowLeft 做选区）。 */
    async keyRepeat(spec, times) {
      const count = Math.max(1, Math.floor(Number(times) || 1));
      const plans = [];
      for (let index = 0; index < count; index += 1) plans.push(...planShortcut(spec));
      return await drive(plans);
    },
    /**
     * 把元素滚进可点击区域（机械预备动作，非用户输入语义；返回滚动后的最新矩形）。
     * 设置页控件可能初始在折叠区外，物理点击前必须先让其几何落在视口内。
     *
     * 为什么不用原生 `el.scrollIntoView()`：在宿主设置弹窗（固定定位 + 内部滚动容器）里实测
     * 会把插件控件滚到视口上方（#188 真机：触发按钮 y=-64，点击坐标落在视口外），根因是
     * 原生算法对固定定位祖先 + 嵌套滚动容器的处理与"用户能点到"不是同一个语义。
     * 这里改为**逐层最小位移**滚动：只在不完全可见时滚，滚完复核可见性；
     * 滚不动时返回 ok=false，套件据此记 BLOCKED（工具/宿主滚动容器限制，不能算产品失败）。
     */
    async scrollIntoView(selector, scrollOptions = {}) {
      const margin = scrollOptions.margin === undefined ? 8 : Number(scrollOptions.margin);
      const result = await client.evaluate(
        '(async function () {' +
        '  const selector = ' + JSON.stringify(selector) + ';' +
        '  const margin = ' + JSON.stringify(Number.isFinite(margin) ? margin : 8) + ';' +
        '  const el = document.querySelector(selector);' +
        '  if (!el) return { ok: false, reason: "找不到元素" };' +
        '  const frame = () => new Promise((resolve) => {' +
        '    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());' +
        '    else setTimeout(resolve, 16);' +
        '  });' +
        '  const settle = async () => { await frame(); await frame(); };' +
        '  const box = (rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2 });' +
        '  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;' +
        '  const visibleEnough = (rect) => rect.width > 0 && rect.height > 0 && rect.top >= margin && rect.bottom <= viewportHeight - margin;' +
        // 元素在 [bandTop, bandBottom] 内的最小位移目标（已可见的方向保持不动）。
        '  const targetTop = (rect, bandTop, bandBottom) => {' +
        '    if (rect.top < bandTop) return bandTop;' +
        '    if (rect.bottom > bandBottom) return Math.max(bandTop, bandBottom - rect.height);' +
        '    return rect.top;' +
        '  };' +
        '  const steps = [];' +
        '  let rect = el.getBoundingClientRect();' +
        '  if (!visibleEnough(rect)) {' +
        '    for (let node = el.parentElement; node && node.nodeType === 1; node = node.parentElement) {' +
        '      const style = getComputedStyle(node);' +
        '      const scrollable = /(auto|scroll|overlay)/.test(String(style.overflowY || "")) && node.scrollHeight > node.clientHeight + 1;' +
        '      if (!scrollable) continue;' +
        '      const container = node.getBoundingClientRect();' +
        '      const bandTop = Math.max(container.top, 0) + margin;' +
        '      const bandBottom = Math.min(container.bottom, viewportHeight) - margin;' +
        '      const wanted = targetTop(rect, bandTop, bandBottom);' +
        '      const delta = wanted - rect.top;' +
        '      if (Math.abs(delta) < 0.5) continue;' +
        '      const before = node.scrollTop;' +
        '      node.scrollTop = before - delta;' +
        '      await settle();' +
        '      rect = el.getBoundingClientRect();' +
        '      steps.push({ tag: String(node.tagName || "").toLowerCase(), scrollTopBefore: before, scrollTopAfter: node.scrollTop, rect: box(rect) });' +
        '      if (visibleEnough(rect)) break;' +
        '    }' +
        '  }' +
        '  if (!visibleEnough(rect)) {' +
        '    const scrolling = document.scrollingElement;' +
        '    if (scrolling && scrolling.scrollHeight > viewportHeight + 1) {' +
        '      const bandTop = margin;' +
        '      const bandBottom = viewportHeight - margin;' +
        '      const delta = targetTop(rect, bandTop, bandBottom) - rect.top;' +
        '      if (Math.abs(delta) >= 0.5) {' +
        '        const before = scrolling.scrollTop;' +
        '        scrolling.scrollTop = before - delta;' +
        '        await settle();' +
        '        rect = el.getBoundingClientRect();' +
        '        steps.push({ tag: "scrollingElement", scrollTopBefore: before, scrollTopAfter: scrolling.scrollTop, rect: box(rect) });' +
        '      }' +
        '    }' +
        '  }' +
        '  const ok = visibleEnough(rect);' +
        '  return { ok: ok, rect: box(rect), margin: margin, viewport: { width: window.innerWidth || 0, height: viewportHeight }, steps: steps, reason: ok ? null : "滚动后元素仍不在视口内" };' +
        '})()',
        { returnByValue: true },
      );
      return { ...result, method: 'custom.scrollIntoView()' };
    },
    /** 焦点：调 DOM focus()（不改选区）；返回焦点前后 activeElement 的语义描述。 */    async focus(selector) {
      const result = await client.evaluate(
        '(function () {' +
        '  const el = document.querySelector(' + JSON.stringify(selector) + ');' +
        '  if (!el) return { ok: false, reason: "找不到元素" };' +
        '  const before = document.activeElement ? String(document.activeElement.tagName || "") : null;' +
        '  el.focus();' +
        '  return { ok: document.activeElement === el, before, after: document.activeElement ? String(document.activeElement.tagName || "") : null };' +
        '})()',
        { returnByValue: true },
      );
      return { ...result, method: 'dom.focus()' };
    },
    /** 失焦：document.activeElement.blur()。 */
    async blur() {
      const result = await client.evaluate(
        '(function () {' +
        '  const active = document.activeElement;' +
        '  if (active && typeof active.blur === "function") active.blur();' +
        '  return { ok: !document.activeElement || document.activeElement === document.body, tag: document.activeElement ? String(document.activeElement.tagName || "") : null };' +
        '})()',
        { returnByValue: true },
      );
      return { ...result, method: 'dom.blur()' };
    },
    /**
     * 选区（selection API 路径）：在 selector 元素的文本内容里设 [start,end)。
     * 与 shift+方向键路径互补——后者走真实键盘，前者精确定位。
     */
    async setSelection(selector, start, end) {
      const result = await client.evaluate(
        '(function () {' +
        '  const root = document.querySelector(' + JSON.stringify(selector) + ');' +
        '  if (!root) return { ok: false, reason: "找不到元素" };' +
        '  const from = ' + JSON.stringify(Number(start)) + ';' +
        '  const to = ' + JSON.stringify(Number(end === undefined ? start : end)) + ';' +
        '  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);' +
        '  let offset = 0; let startNode = null; let startOffset = 0; let endNode = null; let endOffset = 0; let node;' +
        '  while ((node = walker.nextNode())) {' +
        '    const length = node.textContent ? node.textContent.length : 0;' +
        '    if (startNode === null && from <= offset + length) { startNode = node; startOffset = Math.max(0, from - offset); }' +
        '    if (endNode === null && to <= offset + length) { endNode = node; endOffset = Math.max(0, to - offset); }' +
        '    offset += length;' +
        '  }' +
        '  if (!startNode || !endNode) {' +
        '    if (offset === 0 && from === 0 && to === 0) {' +
        '      const emptyRange = document.createRange();' +
        '      emptyRange.setStart(root, 0); emptyRange.setEnd(root, 0);' +
        '      const emptySel = window.getSelection();' +
        '      emptySel.removeAllRanges(); emptySel.addRange(emptyRange);' +
        '      return { ok: true, start: 0, end: 0, collapsed: true, length: 0, empty: true };' +
        '    }' +
        '    return { ok: false, reason: "偏移超出文本长度", length: offset };' +
        '  }' +
        '  const range = document.createRange();' +
        '  range.setStart(startNode, startOffset);' +
        '  range.setEnd(endNode, endOffset);' +
        '  const selection = window.getSelection();' +
        '  selection.removeAllRanges();' +
        '  selection.addRange(range);' +
        '  return { ok: true, start: from, end: to, collapsed: selection.isCollapsed, length: offset };' +
        '})()',
        { returnByValue: true },
      );
      return { ...result, method: 'selection API' };
    },
    /**
     * 合成点击（显式可选路径）：element.click()。用于票面 C 的两路径对照。
     * 返回 method=synthetic.click()，调用方必须在报告里标注「不是物理路径」。
     */
    async syntheticClick(selector) {
      const result = await client.evaluate(
        '(function () {' +
        '  const el = document.querySelector(' + JSON.stringify(selector) + ');' +
        '  if (!el) return { ok: false, reason: "找不到元素" };' +
        '  const text = (el.innerText || el.textContent || "").trim();' +
        '  el.click();' +
        '  return { ok: true, tag: String(el.tagName || "").toLowerCase(), text: text.length > 60 ? text.slice(0, 60) : text };' +
        '})()',
        { returnByValue: true },
      );
      return { ...result, method: 'synthetic.click()', synthetic: true };
    },
    /** 轮询事件日志直到 predicate(entries) 为真；返回命中的日志（不清空）。 */
    async waitForLog(predicate, waitOptions = {}) {
      const timeoutMs = waitOptions.timeoutMs ?? options.timeouts?.panelMs ?? 8_000;
      const pollMs = waitOptions.pollMs ?? 100;
      const label = waitOptions.label || '输入事件出现';
      const started = Date.now();
      let entries = [];
      while (Date.now() - started <= timeoutMs) {
        entries = await readInputLog(client, { clear: false });
        if (predicate(entries)) return entries;
        await sleep(pollMs);
      }
      throw new HarnessError('等待超时（' + timeoutMs + 'ms）：' + label + '；事件数=' + entries.length);
    },
  };
}
