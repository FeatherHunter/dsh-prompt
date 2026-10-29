/**
 * 页面侧准备与观测助手：把"打开真机页面并确认插件在场"变成可复用步骤。
 *
 * 登录门处理目前是启发式（宿主契约占位）：body 直属、position:fixed、
 * z-index >= 100、覆盖视口 90% 以上的元素视为登录遮罩，只在本次会话里隐藏；
 * 不修改插件代码，也不代表产品行为。等 #185 把宿主契约正式化后替换。
 */

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
 * 关掉宿主启动时挡在页面最上层的说明/登录遮罩。
 *
 * 优先点掉真实的「继续」类按钮（等价于用户操作，宿主自己清干净）；
 * 没有可点按钮时退化为隐藏遮罩；同时清掉宿主可能挂在 #root 上的 inert/aria-hidden，
 * 否则入口按钮虽然可见却不接收指针事件。
 */
export async function dismissGates(client) {
  const actions = [];
  const inspect = () =>
    client.evaluate(
      call(() => {
        const vw = window.innerWidth || 0;
        const vh = window.innerHeight || 0;
        const isGate = (el) => {
          if (!(el instanceof HTMLElement) || el.tagName !== 'DIV') return false;
          const style = getComputedStyle(el);
          if (style.position !== 'fixed' || style.display === 'none') return false;
          const zIndex = Number.parseInt(style.zIndex, 10);
          if (!Number.isFinite(zIndex) || zIndex < 100) return false;
          const rect = el.getBoundingClientRect();
          return rect.width >= vw * 0.9 && rect.height >= vh * 0.9;
        };
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
        if (!gate) return { gate: false, inertRemoved, action: inertRemoved > 0 ? 'remove-inert' : null };
        const wanted = ['继续', 'Continue', '跳过', 'Skip', '知道了', 'Got it', 'OK'];
        const buttons = Array.from(gate.querySelectorAll('button, [role=button]'));
        for (const btn of buttons) {
          const text = String(btn.innerText || btn.textContent || '').trim();
          if (wanted.indexOf(text) < 0) continue;
          const rect = btn.getBoundingClientRect();
          return { gate: true, inertRemoved, action: 'click:' + text, point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } };
        }
        gate.style.display = 'none';
        return { gate: true, inertRemoved, action: 'hide-gate' };
      }),
    );

  for (let round = 0; round < 4; round += 1) {
    const step = await inspect();
    if (!step.action) return actions;
    actions.push(step.action);
    if (step.point) {
      await client.click(step.point.x, step.point.y);
      await sleep(700);
    } else {
      await sleep(250);
    }
  }
  return actions;
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
  const gateActions = await dismissGates(client);
  await sleep(300);
  return { gate: { gateActions }, facts: await pageFacts(client) };
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
