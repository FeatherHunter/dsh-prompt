/**
 * 页面侧准备与观测助手：把"打开真机页面并确认插件在场"变成可复用步骤。
 *
 * 登录门/预览提示的识别条件、关闭动作与验证观测属于宿主契约，数据在
 * contract/host.mjs 的 gates 段（#185）。本文件只负责按契约执行并记录每轮观测，
 * 契约由 contract/preflight.mjs 在套件前复查；不修改插件代码。
 */

import { HOST_CONTRACT } from './contract/host.mjs';
import { HarnessError } from './errors.mjs';
import { sleep } from './proc.mjs';

export const SELECTORS = {
  entry: '[data-dsh-prompt-entry]',
  panel: '[data-dsh-prompt-panel-root]',
  bar: '[data-dsh-prompt-bar]',
  trigger: '[data-dsh-prompt-trigger]',
  close: '[data-dsh-prompt-close]',
};

function call(fn) {
  return '(' + fn.toString() + ')()';
}

function callWithArgs(fn, args) {
  return '(' + fn.toString() + ')(' + args.map((value) => JSON.stringify(value)).join(', ') + ')';
}

function hasSelector(selector) {
  return 'document.querySelector(' + JSON.stringify(selector) + ') !== null';
}

function missingSelector(selector) {
  return 'document.querySelector(' + JSON.stringify(selector) + ') === null';
}

export async function hideLoginGate(client) {
  return await client.evaluate(
    call(() => {
      const viewport = { width: window.innerWidth || 0, height: window.innerHeight || 0 };
      const hidden = [];
      const children = Array.from(document.body ? document.body.children : []);
      for (const el of children) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.tagName !== 'DIV') continue;
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' || style.display === 'none') continue;
        const zIndex = Number.parseInt(style.zIndex, 10);
        if (!Number.isFinite(zIndex) || zIndex < 100) continue;
        const rect = el.getBoundingClientRect();
        if (!(rect.width >= viewport.width * 0.9 && rect.height >= viewport.height * 0.9)) continue;
        el.style.display = 'none';
        hidden.push({ zIndex, width: Math.round(rect.width), height: Math.round(rect.height) });
      }
      return { hidden, viewport };
    }),
  );
}

export async function pageFacts(client) {
  return await client.evaluate(
    call(() => {
      const entry = document.querySelector('[data-dsh-prompt-entry]');
      const rect = entry ? entry.getBoundingClientRect() : null;
      const label = entry ? entry.getAttribute('title') || entry.getAttribute('aria-label') || entry.textContent || '' : '';
      return {
        title: document.title,
        lang: document.documentElement.lang,
        entryCount: document.querySelectorAll('[data-dsh-prompt-entry]').length,
        triggerCount: document.querySelectorAll('[data-dsh-prompt-trigger]').length,
        barCount: document.querySelectorAll('[data-dsh-prompt-bar]').length,
        panelCount: document.querySelectorAll('[data-dsh-prompt-panel-root]').length,
        entryLabel: String(label).trim(),
        entryRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      };
    }),
  );
}

/**
 * 页面内：按契约配置识别遮罩、清 inert、决定下一步动作。
 * 只接收纯数据配置（overlay/continueLabels/phases），不引用 Node 侧变量。
 */
function inspectGateInPage(config) {
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const overlay = config.overlay;
  const isGate = (el) => {
    if (!(el instanceof HTMLElement) || el.tagName !== overlay.bodyDirectTag) return false;
    const style = getComputedStyle(el);
    if (style.position !== overlay.position || style.display === 'none') return false;
    const zIndex = Number.parseInt(style.zIndex, 10);
    if (!Number.isFinite(zIndex) || zIndex < overlay.minZIndex) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= vw * overlay.minWidthRatio && rect.height >= vh * overlay.minHeightRatio;
  };
  // 先清 inert / aria-hidden：宿主启动期会把 #root 标成不可交互，不清掉入口不接收指针事件。
  let inertRemoved = 0;
  for (const el of Array.from(document.querySelectorAll('[inert]'))) {
    el.removeAttribute('inert');
    inertRemoved += 1;
  }
  const root = document.getElementById('root');
  if (root && root.getAttribute('aria-hidden') === 'true') {
    root.removeAttribute('aria-hidden');
    inertRemoved += 1;
  }
  const gate = Array.from(document.body ? document.body.children : []).find(isGate) || null;
  if (!gate) {
    return { gate: false, inertRemoved, phase: null, action: inertRemoved > 0 ? 'remove-inert' : null, link: inertRemoved > 0 ? 'inert-cleanup' : null };
  }
  const text = String(gate.innerText || gate.textContent || '').replace(/\s+/g, ' ').trim();
  const phase = (config.phases || []).find((item) => (item.textKeys || []).some((key) => text.indexOf(key) >= 0)) || null;
  const buttons = Array.from(gate.querySelectorAll('button, [role=button]'));
  for (const btn of buttons) {
    const label = String(btn.innerText || btn.textContent || '').trim();
    if (config.continueLabels.indexOf(label) < 0) continue;
    const rect = btn.getBoundingClientRect();
    return {
      gate: true,
      inertRemoved,
      phase: phase ? phase.id : null,
      action: 'click:' + label,
      link: 'continue-label',
      point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      zIndex: Number.parseInt(getComputedStyle(gate).zIndex, 10),
      textSample: text.slice(0, 80),
      className: String(gate.className || '').slice(0, 80),
    };
  }
  // 没有可点按钮（实测：登录提示）→ 只在本次会话里隐藏；不改产品、不点登录。
  gate.style.display = 'none';
  return {
    gate: true,
    inertRemoved,
    phase: phase ? phase.id : null,
    action: 'hide-gate',
    link: 'hide-fallback',
    zIndex: Number.parseInt(getComputedStyle(gate).zIndex, 10),
    textSample: text.slice(0, 120),
    className: String(gate.className || '').slice(0, 80),
  };
}

/**
 * 关掉宿主启动时挡在页面最上层的说明/登录遮罩，直到没有可识别的遮罩或动作。
 * 识别条件、按钮文案、动作表、最大轮数全部来自宿主契约（HOST_CONTRACT.gates）。
 * 返回 { actions, rounds }：rounds 是每轮的识别观测，进证据并供 preflight 复查。
 */
export async function dismissGates(client) {
  const contract = HOST_CONTRACT.gates;
  const config = { overlay: contract.overlay, continueLabels: contract.continueLabels, phases: contract.phases };
  const rounds = [];
  for (let round = 0; round < contract.maxRounds; round += 1) {
    const step = await client.evaluate(callWithArgs(inspectGateInPage, [config]));
    if (!step.action) break;
    rounds.push(step);
    if (step.point) {
      await client.click(step.point.x, step.point.y);
      await sleep(700);
    } else {
      await sleep(250);
    }
  }
  return { actions: rounds.map((step) => step.action), rounds };
}

/** 页面内：关闭后复查状态（可见遮罩、#root 可交互性、composer 在场）。 */
function gateFactsInPage(overlay) {
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const overlays = [];
  for (const el of Array.from(document.body ? document.body.children : [])) {
    if (!(el instanceof HTMLElement) || el.tagName !== overlay.bodyDirectTag) continue;
    const style = getComputedStyle(el);
    if (style.position !== overlay.position) continue;
    const rect = el.getBoundingClientRect();
    overlays.push({
      className: String(el.className || '').slice(0, 80),
      display: style.display,
      zIndex: Number.parseInt(style.zIndex, 10) || 0,
      widthRatio: vw ? Math.round((rect.width / vw) * 100) / 100 : 0,
      heightRatio: vh ? Math.round((rect.height / vh) * 100) / 100 : 0,
    });
  }
  const visibleOverlays = overlays.filter(
    (item) => item.display !== 'none' && item.zIndex >= overlay.minZIndex && item.widthRatio >= overlay.minWidthRatio && item.heightRatio >= overlay.minHeightRatio,
  );
  const root = document.getElementById('root');
  return {
    overlays,
    visibleOverlays,
    rootInert: root ? root.hasAttribute('inert') : null,
    rootAriaHidden: root ? root.getAttribute('aria-hidden') : null,
    composerCount: document.querySelectorAll('[contenteditable="true"]').length,
  };
}

/** 关闭遮罩后的页面观测（契约 host.startup-gates 的"验证观测"部分）。 */
export async function gateFacts(client) {
  return await client.evaluate(callWithArgs(gateFactsInPage, [HOST_CONTRACT.gates.overlay]));
}

/** 悬停失败时的现场：入口矩形、入口坐标上实际命中的元素、遮罩与 inert 状态。 */
export async function diagnoseHover(client) {
  return await client.evaluate(
    call(() => {
      const entry = document.querySelector('[data-dsh-prompt-entry]');
      if (!entry) return { entry: null };
      const rect = entry.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      const gates = Array.from(document.body ? document.body.children : [])
        .filter((el) => {
          if (!(el instanceof HTMLElement) || el.tagName !== 'DIV') return false;
          const style = getComputedStyle(el);
          if (style.position !== 'fixed' || style.display === 'none') return false;
          const zIndex = Number.parseInt(style.zIndex, 10);
          if (!Number.isFinite(zIndex) || zIndex < 100) return false;
          const r = el.getBoundingClientRect();
          return r.width >= vw * 0.9 && r.height >= vh * 0.9;
        })
        .map((el) => ({ zIndex: getComputedStyle(el).zIndex, cls: String(el.className).slice(0, 60) }));
      return {
        entry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        topElement: top ? { tag: top.tagName, cls: String(top.className).slice(0, 80) } : null,
        gates,
        inertCount: document.querySelectorAll('[inert]').length,
        rootAriaHidden: document.getElementById('root') ? document.getElementById('root').getAttribute('aria-hidden') : null,
      };
    }),
  );
}

/** 打开真机页面直到插件入口在场。返回 { gate, facts } 作为证据一部分。 */
export async function preparePage(client, { url, timeouts }) {
  await client.navigate(url, { timeoutMs: timeouts.pageLoadMs });
  await client.waitFor(hasSelector(SELECTORS.entry), {
    timeoutMs: timeouts.pluginReadyMs,
    label: '插件入口 ' + SELECTORS.entry + ' 渲染',
  });
  // 启动说明弹窗通常比插件入口晚一步挂载：等一拍再收掉，避免收早了又被盖住。
  await sleep(800);
  const gate = await dismissGates(client);
  await sleep(300);
  return { gate: { gateActions: gate.actions, gateRounds: gate.rounds }, facts: await pageFacts(client) };
}

export async function panelState(client) {
  return await client.evaluate(
    call(() => {
      // holder 只是挂到 body 的空 div，真正可见的是它内部第一个有尺寸的子元素。
      const holder = document.querySelector('[data-dsh-prompt-panel-root]');
      if (!holder) return { open: false, visible: false, rect: null, childCount: 0 };
      let visibleRect = null;
      const children = Array.from(holder.children);
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (!(rect.width > 0 && rect.height > 0)) continue;
        visibleRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        break;
      }
      const holderRect = holder.getBoundingClientRect();
      return {
        open: true,
        visible: Boolean(visibleRect),
        rect: visibleRect || { x: holderRect.x, y: holderRect.y, width: holderRect.width, height: holderRect.height },
        childCount: children.length,
      };
    }),
  );
}

export async function hoverTrigger(client, { timeouts }) {
  const rect = await client.getRect(SELECTORS.entry, { required: true });
  await client.mouseMove(1, 1);
  await client.mouseMove(rect.cx, rect.cy);
  await client.waitFor(hasSelector(SELECTORS.panel), { timeoutMs: timeouts.panelMs, label: '悬停后面板打开' });
  return await panelState(client);
}

export async function closePanel(client, { timeouts }) {
  const rect = await client.getRect(SELECTORS.close, { required: true });
  await client.click(rect.cx, rect.cy);
  await client.waitFor(missingSelector(SELECTORS.panel), { timeoutMs: timeouts.panelMs, label: '点击关闭后面板消失' });
  return await panelState(client);
}

/** 收集页面级错误：未捕获异常与 level=error 的日志条目。 */
export async function startErrorCollector(client) {
  const errors = [];
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  const off = client.onEvent((message) => {
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params ? message.params.exceptionDetails : null;
      const description = details && details.exception ? details.exception.description : null;
      errors.push({ source: 'Runtime.exceptionThrown', text: description || (details && details.text) || 'unknown exception' });
      return;
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params ? message.params.entry : null;
      if (entry && entry.level === 'error') errors.push({ source: 'Log.entryAdded', text: entry.text });
    }
  });
  return {
    errors,
    stop: () => {
      off();
      return errors;
    },
  };
}
