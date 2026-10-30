/**
 * 观测来源等级模型（#188）：一个观测值有多可信，只取决于它从哪来。
 *
 * 票面口径（由弱到强）：
 *   自述 self-report  —— 产品/插件自己声称的状态（日志、全局钩子、返回值），可能先于现实；
 *   内部状态 internal-state —— React fiber / 内部类名 / 实现私有结构，能读但随时会漂；
 *   公开接口 public-api —— 宿主/插件公开或钉住的接口（inputActions、契约 data-* 钩子、HTTP 桥路由）；
 *   用户可见 user-visible —— 用户真能看到的渲染结果（文本、computed、尺寸、aria 状态）；
 *   持久化 persisted —— 已落盘/可读回的数据（store 快照），重启后仍在。
 *
 * 为什么把等级做成数据而不是字符串注释：断言/报告要机器可判「这条检查最弱的证据是哪一级」，
 * 并支持 weakestSource 汇总——只靠人记「这条来自界面」迟早会被一个截图当真相的检查混过去。
 * 本文件零 IO、零依赖，可在 Node 与自证脚本里直接用。
 */

/** 五个来源等级（纯数据，顺序即强度：从弱到强）。 */
export const SOURCES = Object.freeze([
  Object.freeze({
    id: 'self-report',
    rank: 1,
    label: '自述',
    description: '产品/插件自己声称的状态：日志、全局钩子、API 返回值；可能先于现实、也可能说不清自己',
  }),
  Object.freeze({
    id: 'internal-state',
    rank: 2,
    label: '内部状态',
    description: 'React fiber / 内部类名 / 实现私有结构：能读，但重构即漂，不能作为验收依据',
  }),
  Object.freeze({
    id: 'public-api',
    rank: 3,
    label: '公开接口',
    description: '宿主/插件公开或钉住的接口：inputActions、契约 data-dsh-prompt-* 钩子、持久化 HTTP 桥',
  }),
  Object.freeze({
    id: 'user-visible',
    rank: 4,
    label: '用户可见',
    description: '用户真能看到的渲染结果：文本、computed 样式、尺寸、aria 状态',
  }),
  Object.freeze({
    id: 'persisted',
    rank: 5,
    label: '持久化',
    description: '已落盘并可读回的数据：store 快照；重启后仍在，是双通道里的独立一票',
  }),
]);

/** 等级 id 列表（从弱到强）。 */
export const SOURCE_IDS = Object.freeze(SOURCES.map((source) => source.id));

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

/** 是否是已知来源等级。 */
export function isSourceId(value) {
  return typeof value === 'string' && SOURCE_BY_ID.has(value);
}

/** 校验来源等级，未知值直接抛错：报告里不允许出现匿名等级。 */
export function assertSourceId(value) {
  if (!isSourceId(value)) {
    throw new Error(
      '未知来源等级：' + JSON.stringify(value) + '（可用：' + SOURCE_IDS.join(', ') + '）',
    );
  }
  return value;
}

/** 取等级强度（1 最弱、5 最强）；未知值抛错，避免把拼写错误悄悄当 0 分。 */
export function rankOf(sourceId) {
  assertSourceId(sourceId);
  return SOURCE_BY_ID.get(sourceId).rank;
}

/** 两个来源里更强的那个；同级返回第一个。 */
export function strongerSource(a, b) {
  if (a === null || a === undefined) return assertSourceId(b);
  if (b === null || b === undefined) return assertSourceId(a);
  return rankOf(b) > rankOf(a) ? assertSourceId(b) : assertSourceId(a);
}

/** 一组来源里最弱的一个（证据链由最弱一环决定）；空集合返回 null。 */
export function weakestSource(sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return null;
  let weakest = null;
  for (const sourceId of sourceIds) {
    if (weakest === null || rankOf(sourceId) < rankOf(weakest)) weakest = sourceId;
  }
  return weakest;
}

/** 来源是否至少达到某个等级（例如「这条断言必须双通道，持久化最低 user-visible」）。 */
export function meetsMinimum(sourceId, minimum) {
  return rankOf(sourceId) >= rankOf(minimum);
}

/** 把一个值与它的来源等级绑在一起：没有出处的值不进报告。 */
export function grade(value, sourceId) {
  return { value, source: assertSourceId(sourceId) };
}

/**
 * 汇总若干「带来源的字段」：最弱来源、最弱字段清单、字段数。
 * fields 形如 { text: { value, source }, ... }；不带 source 的字段视为非法。
 */
export function summarizeGrading(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new Error('summarizeGrading 需要 { 字段名: {value, source} } 对象');
  }
  const names = Object.keys(fields);
  const sources = [];
  const weak = [];
  let minSource = null;
  let minRank = Infinity;
  for (const name of names) {
    const field = fields[name];
    if (!field || typeof field !== 'object' || !('value' in field)) {
      throw new Error('字段 ' + name + ' 不是带来源的观测：需要 {value, source}');
    }
    sources.push(assertSourceId(field.source));
    const rank = rankOf(field.source);
    if (rank < minRank) {
      minRank = rank;
      minSource = field.source;
    }
  }
  for (const name of names) {
    if (rankOf(fields[name].source) === minRank) weak.push(name);
  }
  return { fields: names.length, minSource, weak };
}

/** 有序等级表（文档/报告共用一份，避免两处各写一遍）。 */
export function describeSources() {
  return SOURCES.map((source) => source.label + '(' + source.rank + ')');
}
