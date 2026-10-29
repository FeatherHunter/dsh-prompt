/**
 * smoke 套件：证明「一次性宿主 + 被测产物 + 浏览器观测」这条回路是通的。
 *
 * 只检查三件事：页面能加载、插件入口在场、悬浮与显式关闭可用。
 * 它不替代任何功能套件，作用是让后续套件有一个已知可用的基线。
 */

import path from 'node:path';

import { closePanel, diagnoseHover, hoverTrigger, startErrorCollector } from '../harness/page.mjs';

function isTimeout(error) {
  return /等待超时/.test(String(error && error.message ? error.message : error));
}

export async function runSmoke({ recorder, client, server, prepared, shotsDir, timeouts }) {
  const collector = await startErrorCollector(client);

  if (server.httpStatus === 200 && server.htmlBytes > 0) {
    recorder.pass('宿主页面可加载', 'HTTP ' + server.httpStatus + '，' + server.htmlBytes + ' bytes');
  } else {
    recorder.fail('宿主页面可加载', {
      expected: 'HTTP 200 且页面非空',
      observed: 'HTTP ' + server.httpStatus + '，' + server.htmlBytes + ' bytes',
    });
  }

  const entryCount = prepared.facts.entryCount;
  if (entryCount >= 1) {
    recorder.pass('插件入口渲染', '入口文案: ' + JSON.stringify(prepared.facts.entryLabel));
  } else {
    recorder.fail('插件入口渲染', { expected: '至少 1 个 [data-dsh-prompt-entry]', observed: '0 个' });
  }

  let hovered = null;
  try {
    hovered = await hoverTrigger(client, { timeouts });
    if (hovered.open && hovered.visible) recorder.pass('悬停打开模板面板', JSON.stringify(hovered.rect));
    else {
      recorder.fail('悬停打开模板面板', {
        expected: '[data-dsh-prompt-panel-root] 存在且可见',
        observed: JSON.stringify(hovered),
      });
    }
    await client.screenshot(path.join(shotsDir, 'panel-open.png'));
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    const diagnosis = await diagnoseHover(client).catch(() => null);
    if (isTimeout(error)) recorder.fail('悬停打开模板面板', { expected: '悬停后出现面板', observed: text, detail: diagnosis });
    else recorder.blocked('悬停打开模板面板', text + (diagnosis ? '；现场=' + JSON.stringify(diagnosis) : ''));
  }

  try {
    const closed = await closePanel(client, { timeouts });
    if (!closed.open) recorder.pass('显式关闭面板', '点击 [data-dsh-prompt-close] 后面板消失');
    else recorder.fail('显式关闭面板', { expected: '面板消失', observed: JSON.stringify(closed) });
    await client.screenshot(path.join(shotsDir, 'panel-closed.png'));
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    if (isTimeout(error)) recorder.fail('显式关闭面板', { expected: '点击关闭后面板消失', observed: text });
    else recorder.blocked('显式关闭面板', text);
  }

  const errors = collector.stop();
  if (errors.length === 0) recorder.pass('页面无未捕获错误', 'Runtime.exceptionThrown 与 Log error 均为 0 条');
  else recorder.fail('页面无未捕获错误', { expected: '0 条', observed: JSON.stringify(errors).slice(0, 1500) });
}
