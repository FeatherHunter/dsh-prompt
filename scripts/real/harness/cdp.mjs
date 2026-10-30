/**
 * 最小 CDP 客户端：只做真机套件需要的那几种操作。
 *
 * 约束：
 * - 零第三方依赖，Node 22 起自带的全局 WebSocket；
 * - 只用受支持的公开协议（Page / Runtime / Input / Log），不碰内部字段；
 * - 一切失败都变成带上下文的 HarnessError（工具故障），不冒充产品判定。
 */

import fs from 'node:fs';
import path from 'node:path';

import { HarnessError } from './errors.mjs';
import { sleep } from './proc.mjs';

const DEFAULT_CALL_TIMEOUT_MS = 30_000;

function describeException(details) {
  if (!details) return 'unknown';
  const exception = details.exception ?? {};
  if (typeof exception.description === 'string' && exception.description) return exception.description;
  if (typeof exception.value === 'string' && exception.value) return exception.value;
  if (typeof details.text === 'string' && details.text) return details.text;
  return JSON.stringify(details).slice(0, 800);
}

export async function listTargets(cdpPort, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('http://127.0.0.1:' + cdpPort + '/json/list', { signal: controller.signal });
    if (!response.ok) throw new HarnessError('CDP /json/list 返回 HTTP ' + response.status + '（port=' + cdpPort + '）');
    return await response.json();
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    throw new HarnessError('无法读取 CDP 目标列表（port=' + cdpPort + '）：' + String(error?.message ?? error));
  } finally {
    clearTimeout(timer);
  }
}

export async function connect({ cdpPort, timeoutMs = 15_000 }) {
  const targets = await listTargets(cdpPort, timeoutMs);
  const page = targets.find((target) => target.type === 'page') ?? targets[0];
  if (!page || !page.webSocketDebuggerUrl) {
    throw new HarnessError('CDP 没有可用的页面目标（port=' + cdpPort + '）：' + JSON.stringify(targets).slice(0, 500));
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new HarnessError('连接 CDP WebSocket 超时（' + timeoutMs + 'ms）：' + page.webSocketDebuggerUrl)), timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(new HarnessError('连接 CDP WebSocket 失败：' + String(event?.message ?? event)));
    });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  let closed = false;

  ws.addEventListener('message', (event) => {
    let message;
    try {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.id != null) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) {
        entry.reject(new HarnessError('CDP ' + entry.method + ' 失败：' + (message.error.message ?? JSON.stringify(message.error))));
      } else {
        entry.resolve(message.result ?? {});
      }
      return;
    }
    if (typeof message.method === 'string') {
      for (const listener of listeners) {
        try {
          listener(message);
        } catch {
          /* 监听器异常不影响主流程 */
        }
      }
    }
  });

  const closedPromise = new Promise((resolve) => {
    ws.addEventListener('close', () => {
      closed = true;
      for (const entry of pending.values()) entry.reject(new HarnessError('CDP 连接已关闭（' + entry.method + '）'));
      pending.clear();
      resolve();
    });
  });

  function send(method, params = {}, timeoutMs = DEFAULT_CALL_TIMEOUT_MS) {
    if (closed) return Promise.reject(new HarnessError('CDP 连接已关闭，无法调用 ' + method));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new HarnessError('CDP 调用超时（' + timeoutMs + 'ms）：' + method));
      }, timeoutMs);
      pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(new HarnessError('CDP 发送失败（' + method + '）：' + String(error?.message ?? error)));
      }
    });
  }

  async function evaluate(expression, options = {}) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: options.returnByValue !== false,
      awaitPromise: options.awaitPromise !== false,
      userGesture: options.userGesture !== false,
    });
    if (result.exceptionDetails) {
      throw new HarnessError('页面内执行失败：' + describeException(result.exceptionDetails) + '\nexpression: ' + String(expression).slice(0, 400));
    }
    return result.result ? result.result.value : undefined;
  }

  async function waitFor(expression, options = {}) {
    const timeoutMs = options.timeoutMs ?? 8_000;
    const pollMs = options.pollMs ?? 100;
    const label = options.label ?? String(expression).slice(0, 200);
    const deadline = Date.now() + timeoutMs;
    let lastValue;
    while (Date.now() < deadline) {
      lastValue = await evaluate(expression);
      if (lastValue) return lastValue;
      await sleep(pollMs);
    }
    throw new HarnessError('等待超时（' + timeoutMs + 'ms）：' + label);
  }

  async function navigate(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? 60_000;
    await send('Page.enable', {}, timeoutMs);
    await send('Page.navigate', { url }, timeoutMs);
    const base = String(url).split('?')[0];
    await waitFor('location.href.indexOf(' + JSON.stringify(base) + ') === 0 && document.readyState === "complete"', {
      timeoutMs,
      label: '页面加载完成：' + base,
    });
  }

  async function getRect(selector, options = {}) {
    const rect = await evaluate(
      '(() => { const el = document.querySelector(' + JSON.stringify(selector) + '); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; })()',
    );
    if (!rect && options.required !== false) throw new HarnessError('页面上找不到元素：' + selector);
    return rect;
  }

  async function mouseMove(x, y, options = {}) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, modifiers: options.modifiers ?? 0 });
  }

  async function mouseDown(x, y, options = {}) {
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: options.button ?? 'left',
      buttons: options.buttons ?? 1,
      clickCount: options.clickCount ?? 1,
      modifiers: options.modifiers ?? 0,
    });
  }

  async function mouseUp(x, y, options = {}) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: options.button ?? 'left',
      buttons: options.buttons ?? 0,
      clickCount: options.clickCount ?? 1,
      modifiers: options.modifiers ?? 0,
    });
  }

  async function click(x, y, options = {}) {
    const button = options.button ?? 'left';
    const clickCount = options.clickCount ?? 1;
    await mouseMove(x, y);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount, buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount, buttons: 0 });
  }

  async function clickSelector(selector, options = {}) {
    const rect = await getRect(selector, options);
    await click(rect.cx, rect.cy, options);
    return rect;
  }

  async function insertText(text) {
    await send('Input.insertText', { text });
  }

  const KEYS = {
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
    Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
    Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
    Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
    End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
  };

  async function pressKey(name) {
    const spec = KEYS[name] ?? { key: name, code: name, windowsVirtualKeyCode: 0 };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...spec });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...spec });
  }

  /**
   * 低层按键：type = keyDown | rawKeyDown | keyUp。
   * 带文本的按键走 keyDown（会产出 text/入力），带修饰键的组合键走 rawKeyDown（DevTools 同款）。
   */
  async function keyDown(spec = {}) {
    const hasText = typeof spec.text === 'string' && spec.text.length > 0;
    const payload = {
      type: hasText ? 'keyDown' : 'rawKeyDown',
      key: spec.key ?? '',
      code: spec.code ?? '',
      windowsVirtualKeyCode: spec.windowsVirtualKeyCode ?? 0,
      nativeVirtualKeyCode: spec.nativeVirtualKeyCode ?? spec.windowsVirtualKeyCode ?? 0,
      modifiers: spec.modifiers ?? 0,
    };
    if (hasText) payload.text = spec.text;
    await send('Input.dispatchKeyEvent', payload);
  }

  async function keyUp(spec = {}) {
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: spec.key ?? '',
      code: spec.code ?? '',
      windowsVirtualKeyCode: spec.windowsVirtualKeyCode ?? 0,
      nativeVirtualKeyCode: spec.nativeVirtualKeyCode ?? spec.windowsVirtualKeyCode ?? 0,
      modifiers: spec.modifiers ?? 0,
    });
  }

  async function screenshot(filePath) {
    const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  }

  function onEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function close() {
    if (closed) return;
    try {
      ws.close();
    } catch {
      /* 已关 */
    }
    await Promise.race([closedPromise, sleep(3_000)]);
  }

  return {
    cdpPort,
    pageTarget: page,
    send,
    evaluate,
    waitFor,
    navigate,
    getRect,
    mouseMove,
    mouseDown,
    mouseUp,
    click,
    clickSelector,
    insertText,
    pressKey,
    keyDown,
    keyUp,
    screenshot,
    onEvent,
    close,
  };
}
