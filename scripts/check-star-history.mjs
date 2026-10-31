// check-star-history.mjs — 星标曲线的门禁（数据 / 画图 / 两页 README 的引用）
//
// 2026-10-21 用户要求：给本仓加一个 Star History 展示，放在交流群（GROUP 区）下面；
// 同日又要求把曲线改成源仓 B3 的视觉效果（双 Y 轴、每系列一色的刻度、横排轴名、峰值标注）；
// 再来一轮：曲线不要尖锐折角、要平缓 —— Daily 先做二项平滑、两条线都做 Chaikin 角切再穿线。
// 这条门禁盯四件事：
//   1. 聚合与画图是纯函数、同数据同字节 —— 每日 Action 才能在数据没变时不提交噪声；
//   2. 盘上的 SVG 与盘上的 JSON 必须是同一份数据画的（改了数据忘了重画就红）；
//   3. B3 的双轴视觉契约 + 曲线圆滑契约（两轴各用系列色、横排轴名、无竖排文字、
//      曲线全是三次段、不造假峰、峰值数字来自数据）；
//   4. 两页 README 都在交流群二维码之后引用这张图，且带 ?v=YYYYMMDDHHmm 缓存戳
//      （图片代理按 URL 缓存；12 位戳来自 base 包 readme:sync 读 docs/star-history.json 的末条日期）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateByDay, buildSvg, smoothDaily, chaikin, withZeroStart } from './star-history.ts'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ZH = readFileSync(join(ROOT, 'README.md'), 'utf8')
const EN = readFileSync(join(ROOT, 'docs', 'README.en.md'), 'utf8')
const DATA = JSON.parse(readFileSync(join(ROOT, 'docs', 'star-history.json'), 'utf8'))
const SVG = readFileSync(join(ROOT, 'docs', 'star-history.svg'), 'utf8')
const CHART_URL = 'https://raw.githubusercontent.com/FeatherHunter/dsh-prompt/main/docs/star-history.svg'

test('aggregateByDay：空输入返回空数组', () => {
  assert.deepEqual(aggregateByDay([]), [])
})

test('aggregateByDay：同一天的多颗星算成一天，total 是 daily 的累积和', () => {
  const got = aggregateByDay(['2026-08-15T01:00:00Z', '2026-08-15T23:59:59Z', '2026-08-16T00:00:01Z'])
  assert.deepEqual(got, [
    { date: '2026-08-15', total: 2, daily: 2 },
    { date: '2026-08-16', total: 3, daily: 1 },
  ])
})

test('aggregateByDay：坏时间戳被跳过，日期按 UTC 日界切', () => {
  const got = aggregateByDay(['not-a-date', '', '2026-08-15T23:30:00Z'])
  assert.deepEqual(got, [{ date: '2026-08-15', total: 1, daily: 1 }])
})

test('buildSvg：同数据两次调用字节一致（手绘抖动来自种子，不是随机数）', () => {
  const data = [
    { date: '2026-08-15', total: 1, daily: 1 },
    { date: '2026-08-16', total: 3, daily: 2 },
  ]
  assert.equal(buildSvg(data), buildSvg(data))
})

test('一张图顶两套配色（CSS 变量 + prefers-color-scheme），不拆深浅两个文件', () => {
  const svg = buildSvg([{ date: '2026-08-15', total: 1, daily: 1 }])
  assert.ok(svg.includes('@media (prefers-color-scheme: dark)'), 'SVG 内应带深色模式媒体查询')
  assert.ok(svg.includes('--bg:#fffdf7') && svg.includes('--bg:#0b0e14'), '深浅两套底色都该在 CSS 变量里')
  assert.equal(/star-history-(dark|light)[.]svg/.test(svg), false, '不再拆成深浅两个文件')
})

test('B3 配色：每套主题一个系列一个色值，浅色压深到过 AA 对比度', () => {
  const svg = buildSvg(DATA)
  // 浅色主题整体压深：红 #b93a34、蓝 #1d4ed8；深色主题用亮色：红 #ff6b6b、蓝 #38bdf8。
  for (const hex of ['#b93a34', '#1d4ed8', '#ff6b6b', '#38bdf8']) {
    assert.ok(svg.includes(hex), `配色里应有 ${hex}`)
    assert.equal((svg.match(new RegExp(hex, 'g')) || []).length, 1, `${hex} 只该在主题变量里出现一次（一个系列一个色值）`)
  }
  assert.ok(!svg.includes('#d94f4f') && !svg.includes('#2f81f7'), '旧的浅色亮色不该回潮')
})

test('双 Y 轴契约：两根轴线各带 data-axis，两列刻度各用系列色，且没有竖排文字', () => {
  const svg = buildSvg(DATA)
  assert.ok(/class="total-stroke" d="[^"]+" stroke-width="1.6" fill="none" stroke-linecap="round" data-axis="total"/.test(svg), '左轴线应是 Total 色并带 data-axis="total"')
  assert.ok(/class="daily-stroke" d="[^"]+" stroke-width="1.6" fill="none" stroke-linecap="round" data-axis="daily"/.test(svg), '右轴线应是 Daily 色并带 data-axis="daily"')
  assert.ok(/class="total-fill" x="[^"]+" y="[^"]+" text-anchor="end" font-size="13" data-axis="total"/.test(svg), '左列刻度数字应是 Total 色')
  assert.ok(/class="daily-fill" x="[^"]+" y="[^"]+" text-anchor="start" font-size="13" data-axis="daily"/.test(svg), '右列刻度数字应是 Daily 色')
  assert.ok(svg.includes('>Total Stars<') && svg.includes('>Daily New<'), '两根轴的正上方各应有横排轴名')
  assert.equal(svg.includes('rotate('), false, '轴名必须横排；谁都不该歪头读图')
  assert.equal(svg.includes('class="legend"'), false, '轴名兼作色键，不该再有图例')
})

test('曲线：两条都是 C 段平滑路径（无折线），Daily 是虚线', () => {
  const svg = buildSvg(DATA)
  const total = (svg.match(/class="total-stroke" d="([^"]+)" fill="none" stroke-width="3"/) || [])[1] || ''
  const daily = (svg.match(/class="daily-stroke" d="([^"]+)" fill="none" stroke-width="1.8" stroke-dasharray="6 4"/) || [])[1] || ''
  assert.ok(total.includes(' C ') && !total.includes(' L '), 'Total 曲线应是 C 段平滑路径，不许退回折线')
  assert.ok(daily.includes(' C ') && !daily.includes(' L '), 'Daily 曲线应是 C 段平滑路径，不许退回折线')
  assert.ok(svg.includes('stroke-dasharray="6 4"'), '每日新增应是虚线')
})

test('smoothDaily：凸组合平滑，永不越出原始范围，针尖被削平', () => {
  const spike = [1, 1, 1, 3, 1, 1, 1]
  const out = smoothDaily(spike, 2)
  assert.deepEqual(smoothDaily(spike, 2), out, '平滑是确定性的，不用随机数')
  assert.equal(out.length, spike.length, '平滑不改变点数')
  for (const v of out) {
    assert.ok(v >= Math.min(...spike) && v <= Math.max(...spike), `平滑后的 ${v} 越出了原始范围，会造假峰`)
  }
  const peak = (xs) => Math.max(...xs)
  assert.ok(peak(out) < peak(spike), '针尖应被削平（峰值降低）')
  assert.ok(peak(out) > 1, '削平不是抹平：峰还在，只是矮了一点')
  assert.deepEqual(smoothDaily([0, 1, 0, 2, 1], 2)[0], 0, '首点钉死在原点：曲线从 0 起笔，不悬空')
  assert.deepEqual(smoothDaily([0, 1, 0, 2, 1], 2).slice(-1)[0], 1, '末点钉死在原始值')
  assert.deepEqual(smoothDaily([]), [], '空输入安全')
})

test('chaikin：角切端点保留、所有点落在输入范围内（不造假峰）', () => {
  const zig = [
    [0, 100],
    [40, 60],
    [80, 100],
    [120, 20],
    [160, 80],
  ]
  const out = chaikin(zig, 2)
  assert.deepEqual(chaikin(zig, 2), out, '角切是确定性的')
  assert.deepEqual(out[0], zig[0], '首点保留')
  assert.deepEqual(out[out.length - 1], zig[zig.length - 1], '末点保留')
  const lo = Math.min(...zig.map((p) => p[1]))
  const hi = Math.max(...zig.map((p) => p[1]))
  for (const [, y] of out) {
    assert.ok(y >= lo - 1e-9 && y <= hi + 1e-9, `角切后的点 ${y} 越出原始范围，会造假峰`)
  }
  for (let i = 1; i < out.length; i++) assert.ok(out[i][0] > out[i - 1][0], '角切后的点横向仍严格递增')
})

test('Daily 曲线确实被平滑：顶点不高过原始峰值，且明显低于原始峰值', () => {
  const svg = buildSvg(DATA)
  const daily = (svg.match(/class="daily-stroke" d="([^"]+)" fill="none" stroke-width="1.8"/) || [])[1] || ''
  assert.ok(daily, '应有 Daily 曲线')
  const nums = [...daily.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
  const ys = nums.filter((_, i) => i % 2 === 1)
  // 从右轴刻度反推像素/单位：0 刻度在底部，最大值刻度在顶部。
  const ticks = [...svg.matchAll(/class="daily-fill" x="[^"]+" y="([\d.]+)"[^>]*data-axis="daily">(\d+)</g)].map((m) => ({
    y: Number(m[1]),
    v: Number(m[2]),
  }))
  assert.ok(ticks.length >= 2, '右轴应有两档以上刻度')
  const zero = ticks.find((t) => t.v === 0)
  const top = ticks.reduce((a, b) => (b.v > a.v ? b : a))
  const pxPerUnit = (zero.y - top.y) / top.v
  const maxDaily = Math.max(...DATA.map((d) => d.daily))
  const rawApexY = zero.y - maxDaily * pxPerUnit
  const curveApexY = Math.min(...ys)
  assert.ok(curveApexY >= rawApexY - 1, `曲线顶点 ${curveApexY} 高过原始峰值 ${rawApexY}：造了假峰`)
  assert.ok(curveApexY > rawApexY + 5, `曲线顶点 ${curveApexY} 仍贴着原始峰值 ${rawApexY}：平滑没生效`)
})

test('峰值标注：两条曲线各自的最高点直接标数字，且来自盘上的数据', () => {
  const svg = buildSvg(DATA)
  const maxTotal = Math.max(...DATA.map((d) => d.total))
  const maxDaily = Math.max(...DATA.map((d) => d.daily))
  const totalPeak = (svg.match(/data-peak="total">(\d+)<\/text>/) || [])[1] || ''
  const dailyPeak = (svg.match(/data-peak="daily">(\d+)<\/text>/) || [])[1] || ''
  assert.equal(totalPeak, String(maxTotal), 'Total 峰值标注应等于数据里的最大 total')
  assert.equal(dailyPeak, String(maxDaily), 'Daily 峰值标注应等于数据里的最大 daily')
})

test('画布契约：固定 viewBox、标题只一次、日期刻度与页脚来自数据', () => {
  const svg = buildSvg(DATA)
  assert.ok(svg.includes('viewBox="0 0 840 480"'), '应有固定 viewBox')
  assert.equal((svg.match(/Star History/g) || []).length, 1, '标题只出现一次')
  const first = DATA[0].date.slice(5).replace('-', '/')
  const last = DATA[DATA.length - 1]
  assert.ok(svg.includes(`>${first}<`), `横轴应有第一天的心跳刻度 ${first}`)
  assert.ok(svg.includes(`${last.total} stars · ${last.date}`), '右下角应写明当前总数与日期')
})

test('盘上的产物必须与盘上的数据一致（改了 JSON 忘了重画就红）', () => {
  assert.equal(SVG, buildSvg(DATA), 'docs/star-history.svg 应是 docs/star-history.json 现画出来的')
})

test('docs/star-history.json：日期升序，total 是 daily 的累积和', () => {
  assert.ok(DATA.length > 0, '本仓至少有一颗星')
  const dates = DATA.map((d) => d.date)
  assert.deepEqual(dates, [...dates].sort(), '日期应升序')
  let running = 0
  for (const d of DATA) {
    running += d.daily
    assert.equal(d.total, running, `${d.date} 的 total 应等于 daily 的累积和`)
  }
})

test('docs/star-history.json：零星日起点，Daily New 从 0,0 开始', () => {
  assert.deepEqual(withZeroStart([]), [], '空数组保持空')
  const first = DATA[0]
  assert.equal(first.total, 0, '首行 total 应为 0：' + JSON.stringify(first))
  assert.equal(first.daily, 0, '首行 daily 应为 0：' + JSON.stringify(first))
  assert.deepEqual(withZeroStart(DATA), DATA, '已有零星行必须幂等返回')
})

test('两页 README 都在交流群二维码之后引用星标图，且带 ?v=YYYYMMDDHHmm 缓存戳', () => {
  const lastDate = DATA[DATA.length - 1].date
  const stamp = lastDate.replace(/-/g, '') + '0000'
  for (const [name, doc] of [['中文页', ZH], ['英文页', EN]]) {
    // 群码现在来自 base 包的 CDN 整卡（card-feishu.png），不再是仓内 contact-feishu-permanent.png。
    const qr = doc.search(/data\/img\/card-feishu\.png/)
    const at = doc.indexOf(CHART_URL)
    assert.ok(qr > -1, `${name} 应有交流群二维码（base CDN 整卡）`)
    assert.ok(at > qr, `${name} 的星标图应落在交流群二维码之后`)
    assert.ok(doc.includes(`${CHART_URL}?v=${stamp}`), `${name} 的星标图 URL 应带 ?v=${stamp}`)
  }
})
