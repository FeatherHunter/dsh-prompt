/**
 * 原始观测差分与「双通道」比较（#188）。
 *
 * 设计前提：观测层只做两件事——**先原样记录**，再按契约解释。本模块负责记录侧的比较：
 * 1. flattenObservation / diffObservations：同一场景在两次快照之间的原始差异（含路径）；
 *    ignore 只允许「几何抖动 / 时间戳 / run tag」这类与行为无关的路径，不允许整面忽略；
 * 2. compareDualChannels：界面文本（user-visible）与持久化数据（persisted）两条独立通道的
 *    对账。它强制每路都带来源等级，防止拿同一份内部状态当两路证据；
 * 3. diffEventSequences：物理指针路径与合成点击路径的事件序列差异（行为语义对账）。
 *
 * 纯函数、零 IO；页面侧的采集在 probes.mjs / input.mjs。
 */

import { assertSourceId, rankOf } from './source.mjs';

/** 路径是否命中 ignore 规则：精确相等、"prefix.*" 前缀、或 "prefix" 前缀（点分层级）。 */
function isIgnored(path, ignoreRules) {
  for (const rule of ignoreRules) {
    if (typeof rule !== 'string' || !rule) continue;
    if (rule.endsWith('.*')) {
      const prefix = rule.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + '.')) return true;
      // 兼容 "panel.rect.*" 命中 "panel.rect.width" 与更深层
    } else if (rule.endsWith('*')) {
      if (path.startsWith(rule.slice(0, -1))) return true;
    } else if (path === rule || path.startsWith(rule + '.')) {
      return true;
    }
  }
  return false;
}

/**
 * 把任意 JSON 值拍平成 [{path, value}]（对象递归、数组按下标）。
 * 顺序 = 对象键插入顺序；报告里可逐条人工核对。
 */
export function flattenObservation(value, prefix = '', out = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      flattenObservation(value[index], prefix ? prefix + '.' + index : String(index), out);
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      flattenObservation(value[key], prefix ? prefix + '.' + key : key, out);
    }
    return out;
  }
  out.push({ path: prefix, value });
  return out;
}

/** 两次原始观测的差异清单；ignore 命中的路径不出现。 */
export function diffObservations(before, after, options = {}) {
  const ignoreRules = Array.isArray(options.ignore) ? options.ignore : [];
  const beforeMap = new Map(flattenObservation(before).map((item) => [item.path, item.value]));
  const afterMap = new Map(flattenObservation(after).map((item) => [item.path, item.value]));
  const paths = [];
  for (const path of beforeMap.keys()) if (!paths.includes(path)) paths.push(path);
  for (const path of afterMap.keys()) if (!paths.includes(path)) paths.push(path);
  const diffs = [];
  for (const path of paths) {
    if (isIgnored(path, ignoreRules)) continue;
    const hasBefore = beforeMap.has(path);
    const hasAfter = afterMap.has(path);
    const oldValue = beforeMap.get(path);
    const newValue = afterMap.get(path);
    if (hasBefore && hasAfter && Object.is(oldValue, newValue)) continue;
    if (hasBefore && hasAfter && JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    diffs.push({
      path,
      before: hasBefore ? oldValue : undefined,
      after: hasAfter ? newValue : undefined,
    });
  }
  return { same: diffs.length === 0, count: diffs.length, diffs };
}

/** 两份原始观测是否无可观察差异。 */
export function sameObservation(before, after, options = {}) {
  return diffObservations(before, after, options).same;
}

/**
 * 双通道对账：a/b 各是 { name, value, source }。
 * 名称缺省用 "value"；compare 可注入（如界面文本 "3" vs 持久化 3）。
 *
 * #183 评审整改 S4：两路证据必须来自不同层（按 source.mjs 的 rank 阶梯）。
 * 同一层（例如两个 user-visible、两个 persisted、甚至同一个 source id）不能当「独立两路」，
 * 否则「双通道一致」只是同一份内部状态的自我复述。同层时 agree=false 并置 sourceConflict=true，
 * 让套件把它记成 FAIL 而不是静默通过。
 */
export function compareDualChannels(a, b, options = {}) {
  if (!a || typeof a !== 'object' || !('value' in a)) throw new Error('双通道 a 需要 {name,value,source}');
  if (!b || typeof b !== 'object' || !('value' in b)) throw new Error('双通道 b 需要 {name,value,source}');
  const name = options.name || 'value';
  const compare = typeof options.compare === 'function' ? options.compare : (x, y) => Object.is(x, y);
  const left = { name: a.name || 'ui', value: a.value, source: assertSourceId(a.source) };
  const right = { name: b.name || 'store', value: b.value, source: assertSourceId(b.source) };
  const leftRank = rankOf(left.source);
  const rightRank = rankOf(right.source);
  if (leftRank === rightRank) {
    return {
      name,
      agree: false,
      sourceConflict: true,
      a: left,
      b: right,
      detail:
        '两路证据同源（' + left.source + ' 与 ' + right.source + ' 同为来源等级 ' + leftRank + '），证据不闭合：' +
        '双通道必须来自不同层（如 user-visible vs persisted、public-api vs user-visible），' +
        '同一层只能当同一事实的复述，不能当两条独立证据',
    };
  }
  const agree = !!compare(a.value, b.value);
  let detail = '';
  if (!agree) {
    detail = left.name + '=' + JSON.stringify(left.value) + '（' + left.source + '），' +
      right.name + '=' + JSON.stringify(right.value) + '（' + right.source + '）';
  }
  return { name, agree, sourceConflict: false, a: left, b: right, detail };
}

/** 事件日志 → 事件名序列（type 字段）。 */
export function eventTypeSequence(events) {
  if (!Array.isArray(events)) return [];
  return events.map((event) => (event && typeof event.type === 'string' ? event.type : String(event)));
}

/**
 * 两路事件序列的多重集差异：各自独有的 type（保留出现次数）。
 * 用于「物理指针路径 vs 合成点击路径」的差异清单——序列本身不必相同，行为观测才要一致。
 */
export function diffEventSequences(leftEvents, rightEvents) {
  const left = eventTypeSequence(leftEvents);
  const right = eventTypeSequence(rightEvents);
  const leftCounts = new Map();
  const rightCounts = new Map();
  for (const type of left) leftCounts.set(type, (leftCounts.get(type) || 0) + 1);
  for (const type of right) rightCounts.set(type, (rightCounts.get(type) || 0) + 1);
  const onlyLeft = [];
  const onlyRight = [];
  for (const type of leftCounts.keys()) {
    const delta = leftCounts.get(type) - (rightCounts.get(type) || 0);
    for (let i = 0; i < delta; i += 1) onlyLeft.push(type);
  }
  for (const type of rightCounts.keys()) {
    const delta = rightCounts.get(type) - (leftCounts.get(type) || 0);
    for (let i = 0; i < delta; i += 1) onlyRight.push(type);
  }
  return {
    same: onlyLeft.length === 0 && onlyRight.length === 0,
    left,
    right,
    onlyLeft,
    onlyRight,
  };
}
