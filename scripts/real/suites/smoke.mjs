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
    recorder.pass('宿主页面可加载', {
      detail: 'HTTP ' + server.httpStatus + '，' + server.htmlBytes + ' bytes',
      claim: '一次性宿主 web 服务返回 200 且页面非空，浏览器才能进入被测界面',
      steps: ['启动一次性 DSH_HOME 的宿主 web 服务', '读服务 HTTP 状态与 HTML 字节数', '断言 HTTP 200 且 HTML 非空'],
      observations: { httpStatus: server.httpStatus, htmlBytes: server.htmlBytes },
      inference: '页面能加载时，后续入口/控件检查才有观测前提',
    });
  } else {
    recorder.fail('宿主页面可加载', {
      expected: 'HTTP 200 且页面非空',
      observed: 'HTTP ' + server.httpStatus + '，' + server.htmlBytes + ' bytes',
      claim: '一次性宿主 web 服务返回 200 且页面非空',
      steps: ['启动一次性 DSH_HOME 的宿主 web 服务', '读服务 HTTP 状态与 HTML 字节数', '断言 HTTP 200 且 HTML 非空'],
      observations: { httpStatus: server.httpStatus, htmlBytes: server.htmlBytes },
      inference: '页面都没加载出来时，后续入口/控件检查全部不可归因',
    });
  }

  const entryCount = prepared.facts.entryCount;
  if (entryCount >= 1) {
    recorder.pass('插件入口渲染', {
      detail: '入口文案: ' + JSON.stringify(prepared.facts.entryLabel),
      claim: '被测插件产物安装后，宿主页面渲染出插件入口按钮',
      steps: ['读 preparePage 采集的页面事实', '断言 [data-dsh-prompt-entry] 数量 >= 1 并记录入口文案'],
      observations: { entryCount, entryLabel: prepared.facts.entryLabel },
      inference: '入口在场说明安装/加载链路成立，可以继续测交互',
    });
  } else {
    recorder.fail('插件入口渲染', {
      expected: '至少 1 个 [data-dsh-prompt-entry]',
      observed: '0 个',
      claim: '被测插件产物安装后，宿主页面渲染出插件入口按钮',
      steps: ['读 preparePage 采集的页面事实', '断言 [data-dsh-prompt-entry] 数量 >= 1'],
      observations: { entryCount },
      inference: '入口缺失时后续悬停/点击类检查都不成立',
    });
  }

  let hovered = null;
  try {
    hovered = await hoverTrigger(client, { timeouts });
    if (hovered.open && hovered.visible) {
      // 六元组示范（docs/real/report.md）：conditions 由 run.mjs 注入的环境自动补全，
      // 套件只写它自己知道的部分；原始观测与推断分字段，不要混写。
      recorder.pass('悬停打开模板面板', {
        detail: JSON.stringify(hovered.rect),
        claim: '物理悬停插件入口后，模板面板出现在入口下方且可见',
        steps: [
          '读取 [data-dsh-prompt-entry] 的矩形',
          '经 CDP 物理移动鼠标到入口中心',
          '轮询 [data-dsh-prompt-panel-root] 的 open/visible 与矩形',
        ],
        observations: { trigger: 'data-dsh-prompt-entry', open: hovered.open, visible: hovered.visible, rect: hovered.rect },
        inference: '输入命中入口且面板在预算内可见，悬停打开链路成立。',
      });
    } else {
      recorder.fail('悬停打开模板面板', {
        expected: '[data-dsh-prompt-panel-root] 存在且可见',
        observed: JSON.stringify(hovered),
        claim: '物理悬停插件入口后，模板面板出现在入口下方且可见',
        steps: [
          '读取 [data-dsh-prompt-entry] 的矩形',
          '经 CDP 物理移动鼠标到入口中心',
          '轮询 [data-dsh-prompt-panel-root] 的 open/visible 与矩形',
        ],
        observations: { trigger: 'data-dsh-prompt-entry', open: hovered.open, visible: hovered.visible, rect: hovered.rect },
        inference: '悬停后面板未在预算内出现时，打开链路或入口命中失败',
      });
    }
    await client.screenshot(path.join(shotsDir, 'panel-open.png'));
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    const diagnosis = await diagnoseHover(client).catch(() => null);
    if (isTimeout(error)) {
      recorder.fail('悬停打开模板面板', {
        expected: '悬停后出现面板',
        observed: text,
        detail: diagnosis,
        claim: '物理悬停插件入口后，模板面板出现在入口下方且可见',
        steps: [
          '读取 [data-dsh-prompt-entry] 的矩形',
          '经 CDP 物理移动鼠标到入口中心',
          '轮询 [data-dsh-prompt-panel-root] 的 open/visible 与矩形',
        ],
        observations: { error: text, diagnosis },
        inference: '等待超时=产品未在预算内响应，或入口被遮罩/几何漂移挡住',
      });
    } else {
      recorder.blocked('悬停打开模板面板', text + (diagnosis ? '；现场=' + JSON.stringify(diagnosis) : ''), {
        claim: '物理悬停插件入口后，模板面板出现在入口下方且可见',
        steps: ['读取入口矩形', '物理移动鼠标到入口中心', '轮询面板 open/visible'],
        observations: { error: text, diagnosis },
        inference: '异常来自工具链/宿主（CDP/遮罩/页面），不记产品失败',
      });
    }
  }

  try {
    const closed = await closePanel(client, { timeouts });
    if (!closed.open) {
      recorder.pass('显式关闭面板', {
        detail: '点击 [data-dsh-prompt-close] 后面板消失',
        claim: '点击面板关闭按钮后，模板面板消失（open=false）',
        steps: ['读取 [data-dsh-prompt-close] 的矩形', '物理点击关闭按钮', '轮询面板 open/visible'],
        observations: { closeButton: 'data-dsh-prompt-close', open: closed.open, visible: closed.visible },
        inference: '点击后观测到面板关闭，关闭链路成立。',
      });
    } else {
      recorder.fail('显式关闭面板', {
        expected: '面板消失',
        observed: JSON.stringify(closed),
        claim: '点击面板关闭按钮后，模板面板消失（open=false）',
        steps: ['读取 [data-dsh-prompt-close] 的矩形', '物理点击关闭按钮', '轮询面板 open/visible'],
        observations: { open: closed.open, visible: closed.visible },
        inference: '点击后面板仍在时，关闭链路或关闭按钮命中失败',
      });
    }
    await client.screenshot(path.join(shotsDir, 'panel-closed.png'));
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    if (isTimeout(error)) {
      recorder.fail('显式关闭面板', {
        expected: '点击关闭后面板消失',
        observed: text,
        claim: '点击面板关闭按钮后，模板面板消失（open=false）',
        steps: ['读取 [data-dsh-prompt-close] 的矩形', '物理点击关闭按钮', '轮询面板 open/visible'],
        observations: { error: text },
        inference: '等待超时=面板未在预算内收起，产品关闭链路失败',
      });
    } else {
      recorder.blocked('显式关闭面板', text, {
        claim: '点击面板关闭按钮后，模板面板消失（open=false）',
        steps: ['读取关闭按钮矩形', '物理点击关闭按钮', '轮询面板 open/visible'],
        observations: { error: text },
        inference: '异常来自工具链/宿主，不记产品失败',
      });
    }
  }

  const errors = collector.stop();
  if (errors.length === 0) {
    recorder.pass('页面无未捕获错误', {
      detail: 'Runtime.exceptionThrown 与 Log error 均为 0 条',
      claim: '整个 smoke 场景期间页面没有未捕获异常或 error 级日志',
      steps: ['preparePage 前启动 Runtime.exceptionThrown / Log.entryAdded 收集器', '场景结束后 stop 收集器并读 errors', '断言 errors.length===0'],
      observations: { errorCount: 0 },
      inference: '无页面错误时，前面的 UI 观测不是异常副作用',
    });
  } else {
    recorder.fail('页面无未捕获错误', {
      expected: '0 条',
      observed: JSON.stringify(errors).slice(0, 1500),
      claim: '整个 smoke 场景期间页面没有未捕获异常或 error 级日志',
      steps: ['preparePage 前启动 Runtime.exceptionThrown / Log.entryAdded 收集器', '场景结束后 stop 收集器并读 errors', '断言 errors.length===0'],
      observations: { errors },
      inference: '页面错误会让 UI 观测不可信，先修错误再看功能',
    });
  }
}
