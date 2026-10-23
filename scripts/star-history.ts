// Star History 纯函数：按 UTC 日聚合 + 手绘风双轴 SVG 生成。
//
// 视觉契约来自源仓 dsh-mattpocock-skills-deck 的 B3 版（commit 1471c4a1，2026-10-21）：
//   · 双 Y 轴：Total Stars 读左轴、Daily New 读右轴，各自按自己的最大值缩放 ——
//     两条线共用一根轴时，总量一大，每日新增就被压成贴着 X 轴的一条平线，读不出趋势。
//   · 每套主题里一个系列只有一个色值：曲线、轴线、轴名、刻度数字、峰值标注共用，
//     左边一列红字配红线、右边一列蓝字配蓝线；轴名横排放在各自轴的正上方兼作色键，
//     所以没有图例、也没有竖排文字（不写 rotate()）。
//   · 两条曲线都必须圆滑、不能有尖锐折角：Total 单调上升走 Catmull-Rom；Daily 是小整数、
//     天天跳，原样过点会画成一排针，所以先按 [1,2,1]/4 二项核两轮确定性平滑（削掉针尖），
//     两条曲线再统一做两轮 Chaikin 角切（拐角削成 1/4、3/4 两点）后穿 Catmull-Rom。
//     平滑核与角切都只是凸组合：只会削峰、不会造出不存在的峰，曲线也不越过原始数据范围。
//   · 两条曲线的最高点直接标数字（data-peak 属性），描边用背景色垫底，压线也读得清。
//
// 本仓适配（三处，都是硬约束逼出来的）：
//   1. 一张 SVG 顶两套配色（CSS 变量 + prefers-color-scheme 媒体查询），不拆 dark/light 两张 ——
//      README 用纯 markdown 图片内嵌：市场详情页渲染器整段丢弃原始 HTML，<picture> 会整块消失；
//      而 SVG 内部的媒体查询在 <img> 里照样生效，深浅自动跟系统配色。
//      因此配色全部走 CSS 类（.total-fill / .daily-stroke…）：不靠元素 fill 属性，
//      这样 <style> 里的默认字色不会盖掉系列色（源仓 2026-10-21 踩过的坑）。
//   2. 文件名统一 .ts（本仓 Node ≥ 22.18 原生类型剥离直跑，不用 .mts）。
//   3. 抖动种子只吃数据不吃主题名 —— 只有一张图了。
//
// 不变量：buildSvg 是纯函数，同输入必产出同字节（每日 Action 在数据不变时不产生噪声提交）。
// 手绘感来自确定性种子抖动（fnv1a + mulberry32），不是 Math.random。

export interface StarDay {
  date: string
  total: number
  daily: number
}

// 输入：starredAtList（ISO 8601 时间戳数组）→ 输出：按 UTC 日聚合的 [{date,total,daily}]
export function aggregateByDay(starredAtList: string[]): StarDay[] {
  if (!Array.isArray(starredAtList) || starredAtList.length === 0) return []
  const dayCounts = new Map<string, number>()
  for (const iso of starredAtList) {
    if (typeof iso !== 'string' || !iso) continue
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10) // YYYY-MM-DD（UTC 日界）
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1)
  }
  const sortedDays = Array.from(dayCounts.keys()).sort()
  let running = 0
  return sortedDays.map((date) => {
    const daily = dayCounts.get(date) ?? 0
    running += daily
    return { date, total: running, daily }
  })
}

const FONT = '"Comic Sans MS","Comic Sans","Chalkboard SE","Marker Felt","Segoe Print",cursive'
const W = 840
const H = 480
// PAD_R 从 36 加到 64：右边距要放 Daily 右轴的刻度数字（两位数）和轴名，按 36 会裁出画布。
const PAD_L = 64
const PAD_R = 64
const PAD_T = 64
const PAD_B = 58

// 深浅两套 B3 配色写进 CSS 变量：浅色是默认值，深色在 prefers-color-scheme: dark 下覆盖。
// 浅色主题整体压深（红 #b93a34 / 蓝 #1d4ed8），13px 刻度小字也过 WCAG AA 4.5:1；
// 深色主题用亮色（红 #ff6b6b / 蓝 #38bdf8）。每套主题里一个系列只有一个色值。
const THEME_CSS = [
  ':root{--bg:#fffdf7;--text:#24292f;--muted:#57606a;--grid:#e8ebf0;--axis:#24292f;--total:#b93a34;--daily:#1d4ed8}',
  '@media (prefers-color-scheme: dark){:root{--bg:#0b0e14;--text:#e6edf3;--muted:#9aa3b2;--grid:#232b3a;--axis:#cdd9e5;--total:#ff6b6b;--daily:#38bdf8}}',
  `text{font-family:${FONT};fill:var(--text)}`,
  '.bg{fill:var(--bg)}',
  '.grid{stroke:var(--grid)}',
  '.axis{stroke:var(--axis)}',
  '.total-stroke{stroke:var(--total)}',
  '.daily-stroke{stroke:var(--daily)}',
  '.total-fill{fill:var(--total)}',
  '.daily-fill{fill:var(--daily)}',
  '.muted-fill{fill:var(--muted)}',
  '.halo{stroke:var(--bg)}',
].join('\n  ')

function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, rough))))
  for (const m of [1, 2, 5, 10]) if (m * pow >= rough) return m * pow
  return 10 * pow
}

// 向上就近取整数：给坐标轴顶部用（如 239.2→250），档位比 niceStep 密，最差也有八成占位。
function niceCeil125(x: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, x))))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= x) return m * pow
  return 10 * pow
}

// Catmull-Rom 转贝塞尔，让单调上升的 Total 曲线圆滑接近手绘描线
function smoothPath(pts: number[][]): string {
  if (pts.length === 1) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// 每日新增先去针尖：数据是小整数、天天跳，原样过点会画成一排针。
// 用 [1,2,1]/4 的二项核做两轮确定性平滑（等效 [1,4,6,4,1]/16 的宽度），边缘夹住端点。
// 每一步都是凸组合 —— 结果永远夹在上一轮的最小/最大值之间，只会削峰、不会造出不存在的峰。
export function smoothDaily(values: number[], passes = 2): number[] {
  let cur = values.slice()
  for (let p = 0; p < passes; p++) {
    const prev = cur
    cur = prev.map((v, i) => {
      const a = prev[Math.max(0, i - 1)]
      const b = prev[Math.min(prev.length - 1, i + 1)]
      return (a + 2 * v + b) / 4
    })
  }
  return cur
}

// Chaikin 角切：每轮把折线每个拐角削成两段（取 1/4、3/4 两点），两轮后尖角都被削圆。
// 新点都落在相邻两点的连线上（凸组合）—— 不越过原始范围；首尾端点保留，
// 曲线仍从第一颗星开始、到最后一颗星结束，峰值数字也还贴得住曲线顶点。
export function chaikin(pts: number[][], iterations = 2): number[][] {
  let cur = pts
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 3) break
    const next: number[][] = [cur[0]]
    for (let i = 0; i < cur.length - 1; i++) {
      const p = cur[i]
      const q = cur[i + 1]
      next.push([p[0] + (q[0] - p[0]) * 0.25, p[1] + (q[1] - p[1]) * 0.25])
      next.push([p[0] + (q[0] - p[0]) * 0.75, p[1] + (q[1] - p[1]) * 0.75])
    }
    next.push(cur[cur.length - 1])
    cur = next
  }
  return cur
}

export function buildSvg(data: StarDay[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('buildSvg: 没有数据可画（先跑 update-star-history 拉星标时间）')
  }
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  // 抖动种子只吃数据：同数据必同字节
  const rng = mulberry32(fnv1a(JSON.stringify(data)))
  const j = (amp: number): number => (rng() - 0.5) * 2 * amp

  const totals = data.map((d) => d.total)
  const maxTotal = Math.max(1, ...totals)
  // 左轴（Total，红线）：顶部取 maxTotal × 1.15 向上就近的 1/2/2.5/5/10 整数
  // （如 208→250），红线峰值贴着顶部；刻度按量程五等分取整步长。
  const yMaxTop = niceCeil125(maxTotal * 1.15)
  const yStep = niceStep(yMaxTop / 5)
  const yMax = Math.max(yStep, yMaxTop)

  // 右轴（Daily，蓝线）：蓝线峰值不得超过红线峰值屏幕高度的一半。
  // 量程按红线实际占位反推：dTarget = maxDaily / (0.5 × maxTotal/yMax)；
  // 刻度仍按“目标量程的一半”找步长、最多 3 档（如 daily 峰值 8、红线占位 83% 时量程到 20）。
  const dailies = data.map((d) => d.daily)
  const maxDaily = Math.max(1, ...dailies)
  const redFrac = maxTotal / yMax
  const dTarget = maxDaily / (0.5 * redFrac)
  const dStep = niceStep(dTarget / 2)
  const dMax = Math.max(dStep, Math.ceil(dTarget / dStep) * dStep)

  // 横轴按真实时间线性放：没有新星的日子照样占时间跨度
  const times = data.map((d) => Date.parse(d.date + 'T00:00:00Z'))
  const minX = Math.min(...times)
  const maxX = Math.max(...times)
  const X = (i: number): number =>
    data.length === 1 ? PAD_L + plotW / 2 : PAD_L + ((times[i] - minX) / (maxX - minX)) * plotW
  const Y = (v: number): number => PAD_T + plotH - (v / yMax) * plotH
  // 右轴映射：和左轴共用同一条 0 基线（都从底部起），只是比例尺各自独立。
  const Yd = (v: number): number => PAD_T + plotH - (v / dMax) * plotH

  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v)
  const dTicks: number[] = []
  for (let v = 0; v <= dMax; v += dStep) dTicks.push(v)
  const want = Math.min(5, data.length)
  const xTicks: Array<{ i: number; label: string }> = [
    ...new Set(Array.from({ length: want }, (_, k) => Math.round((k * (data.length - 1)) / (want - 1 || 1)))),
  ].map((i) => ({ i, label: data[i].date.slice(5).replace('-', '/') }))

  // 点先做确定性手绘抖动；Daily 的取值再走两轮二项平滑去掉针尖。
  const totalRaw = data.map((d, i) => [X(i) + j(1.1), Y(d.total) + j(1.1)])
  const dailyVals = smoothDaily(dailies, 2)
  const dailyRaw = dailyVals.map((v, i) => [X(i) + j(1.1), Yd(v) + j(1.1)])
  // 两条曲线都做两轮角切再去穿曲线：线圆滑、没有尖锐折角，也不越过原始数据范围。
  const totalPts = chaikin(totalRaw, 2)
  const dailyPts = chaikin(dailyRaw, 2)

  // 峰值标注：两条曲线各自的最高点直接标数字，读者不用拿眼睛对坐标轴估峰值。
  // 取「第一次出现最高值」的那一天；位置用画出来的点（含抖动），数字才贴着曲线尖。
  const peakIndex = (values: number[]): number => values.indexOf(Math.max(...values))

  const axisY = PAD_T + plotH
  const sketchy = (x1: number, y1: number, x2: number, y2: number): string => {
    let d = `M ${x1} ${y1}`
    const segs = 8
    for (let s = 1; s <= segs; s++) {
      const f = s / segs
      d += ` L ${(x1 + (x2 - x1) * f + j(1.2)).toFixed(1)} ${(y1 + (y2 - y1) * f + j(1.2)).toFixed(1)}`
    }
    return d
  }

  const gridLines = yTicks
    .slice(1)
    .map(
      (v) =>
        `<line class="grid" x1="${PAD_L}" y1="${Y(v).toFixed(1)}" x2="${W - PAD_R}" y2="${Y(v).toFixed(1)}" stroke-width="1" opacity="0.7"/>`,
    )
    .join('\n  ')
  // 两侧刻度数字各用自己系列的颜色：左列红字读 Total，右列蓝字读 Daily。
  // 文字色与曲线、轴名、轴线同一个色值（每套主题每系列只有一种颜色），
  // 这样「这根线读哪根尺子」不靠图例、全凭颜色对得上。
  const yLabels = yTicks
    .map((v) => `<text class="total-fill" x="${PAD_L - 10}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="13" data-axis="total">${v}</text>`)
    .join('\n  ')
  const dLabels = dTicks
    .map((v) => `<text class="daily-fill" x="${W - PAD_R + 10}" y="${(Yd(v) + 4).toFixed(1)}" text-anchor="start" font-size="13" data-axis="daily">${v}</text>`)
    .join('\n  ')
  // 右轴刻度位置不落在左轴网格线上，只给数字会显得“浮空”；补一小段同色刻度短线。
  const dAxisTicks = dTicks
    .map(
      (v) =>
        `<path class="daily-stroke" d="${sketchy(W - PAD_R - 6, Yd(v), W - PAD_R, Yd(v))}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    )
    .join('\n  ')
  const xLabels = xTicks
    .map((tk) => `<text class="muted-fill" x="${X(tk.i).toFixed(1)}" y="${axisY + 24}" text-anchor="middle" font-size="13">${tk.label}</text>`)
    .join('\n  ')

  // 峰值数字的摆法：默认放在点上方 10px；靠近画布顶部就翻到点下方，
  // 靠近左右边缘时改对齐方式，避免数字顶出绘图区或压到右轴刻度。
  // 描边用背景色垫一大圈底衬（paint-order=stroke 让描边在字下面），压在网格线或曲线上也读得清。
  const peakLabel = (pt: number[], value: number, kind: string): string => {
    const px = pt[0]
    const py = pt[1]
    const y = py - 10 < PAD_T + 14 ? py + 19 : py - 10
    const anchor = px > W - PAD_R - 34 ? 'end' : px < PAD_L + 34 ? 'start' : 'middle'
    const x = anchor === 'end' ? px - 6 : anchor === 'start' ? px + 6 : px
    return `<text class="${kind}-fill halo" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="13" font-weight="600" stroke-width="3" paint-order="stroke" stroke-linejoin="round" data-peak="${kind}">${value}</text>`
  }
  // 峰值标注：两条曲线各自的最高点直接标数字，读者不用拿眼睛对坐标轴估峰值。
  // 数字仍取原始数据的最大 total / daily（daily 平滑后顶点会矮一点，标签照标真实峰值）；
  // 位置放在画出来的曲线顶点上（含抖动与角切），数字贴着线、不悬空。
  const apex = (pts: number[][]): number[] => pts.reduce((a, b) => (b[1] < a[1] ? b : a), pts[0])
  const peakLabels = [
    peakLabel(apex(totalPts), totals[peakIndex(totals)], 'total'),
    peakLabel(apex(dailyPts), dailies[peakIndex(dailies)], 'daily'),
  ].join('\n  ')

  // 轴名横排放在各自那根轴的正上方、用该系列颜色写：竖排字要歪头读（门禁禁 rotate()），
  // 横排轴名同时充当色键 —— 红色读左轴 Total、蓝色读右轴 Daily，所以整块图例可以省掉。
  const axisTitles = [
    `<text class="total-fill" x="${PAD_L}" y="${PAD_T - 10}" font-size="12" font-weight="600">Total Stars</text>`,
    `<text class="daily-fill" x="${W - PAD_R}" y="${PAD_T - 10}" text-anchor="end" font-size="12" font-weight="600">Daily New</text>`,
  ].join('\n  ')

  const last = data[data.length - 1]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
  ${THEME_CSS}
  </style>
  <rect class="bg" width="100%" height="100%"/>
  <text x="${W / 2}" y="34" text-anchor="middle" font-size="21">⭐ Star History</text>
  ${axisTitles}
  ${gridLines}
  <path class="axis" d="${sketchy(PAD_L, axisY, W - PAD_R, axisY)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path class="total-stroke" d="${sketchy(PAD_L, PAD_T, PAD_L, axisY)}" stroke-width="1.6" fill="none" stroke-linecap="round" data-axis="total"/>
  <path class="daily-stroke" d="${sketchy(W - PAD_R, PAD_T, W - PAD_R, axisY)}" stroke-width="1.6" fill="none" stroke-linecap="round" data-axis="daily"/>
  ${dAxisTicks}
  ${yLabels}
  ${dLabels}
  ${xLabels}
  <text class="muted-fill" x="${W / 2}" y="${H - 12}" font-size="12" text-anchor="middle">Date</text>
  <path class="daily-stroke" d="${smoothPath(dailyPts)}" fill="none" stroke-width="1.8" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  <path class="total-stroke" d="${smoothPath(totalPts)}" fill="none" stroke-width="3" stroke-linecap="round"/>
  ${peakLabels}
  <text class="muted-fill" x="${W - PAD_R}" y="${axisY + 44}" text-anchor="end" font-size="12">${last.total} stars · ${last.date}</text>
</svg>`
}
