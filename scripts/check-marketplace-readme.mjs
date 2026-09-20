/**
 * 市场侧 README 体检 —— 「一份 README，两个面都要读得通」的守门人
 *
 * 为什么有这条：
 *   同一个 README 会被两处渲染——GitHub 仓库页，和 awesome 插件市场的详情页正文
 *   （https://awesome-dsh-plugin.com/p/FeatherHunter/dsh-prompt/）。
 *   市场那侧**丢弃全部原始 HTML**：`<h2 align="center">`、`<img>`、`<summary>` 里的字
 *   一律不见。于是「GitHub 上明明有标题有图」和「市场详情页只剩一堵没结构的文字墙」
 *   可以同时成立——肉眼在仓库里永远看不出来，只有把上游那套渲染跑一遍才知道。
 *
 * 上游规则出处（本文件是它的逐行复刻，只多出断言与报告）：
 *   awesome-dsh-plugin/awesome-dsh-plugin · scripts/build-site.mjs → renderReadme()
 *   · raw HTML 丢弃        renderer.html: () => ''
 *   · 标题降一级           walkTokens: t.depth + 1
 *   · 相对图片改写成 raw    walkTokens: image → `${rawBase}${href}`
 *   · 只放行 GitHub 托管的图（徽章服务的图会被丢掉，这是刻意的）
 *   上游改了规则，这里要跟着改，否则体检会变成假绿。
 *
 * 判红（四条，都是「市场那侧悄悄少东西」的症状）：
 *   1. 源文件用原始 HTML `<img>` 装本仓自己的图 —— 一律丢，市场详情页没图；
 *   2. 源文件用原始 HTML `<h2>`–`<h6>` 写章节标题 —— 一律丢，市场正文没结构；
 *   3. markdown 图片没全部渲染出来；
 *   4. markdown 标题没全部渲染出来。
 * 只提示不判红：第三方图床的图（徽章，上游按隐私规则刻意丢弃）、`<summary>` 里的字、
 * 只有 GitHub 看得见的 `<details>` 折叠壳。
 *
 * 跑法：npm run test:marketplace
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REPO = 'FeatherHunter/dsh-prompt'

// 与上游 build-site.mjs::SCREENSHOT_HOSTS 一致
const SCREENSHOT_HOSTS = new Set([
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.com',
])
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const isOwnImage = (href) => {
  if (!href) return false
  if (!/^https?:\/\//i.test(href)) return true // 相对路径 → 上游改写成 raw.githubusercontent.com
  try { return SCREENSHOT_HOSTS.has(new URL(href).hostname) } catch { return false }
}

/** 逐行复刻上游 build-site.mjs::renderReadme。 */
function renderReadme(rm) {
  const abs = (href, base, allowData = false) => {
    if (!href || /^(https?:|mailto:|#)/i.test(href)) return href
    if (/^data:/i.test(href)) return allowData ? href : '#'
    return base + href.replace(/^\.\//, '').replace(/^\//, '')
  }
  const imgAllowed = (href) => {
    if (/^data:/i.test(href)) return true
    try { return SCREENSHOT_HOSTS.has(new URL(href).hostname) } catch { return false }
  }
  const md = new Marked({
    walkTokens(t) {
      if (t.type === 'heading') t.depth = Math.min(t.depth + 1, 6)
      else if (t.type === 'image') t.href = abs(t.href, rm.base, true)
      else if (t.type === 'link') t.href = abs(t.blobBase)
    },
    renderer: {
      html: () => '',
      image({ href, title, text }) {
        if (!href || !imgAllowed(href)) return ''
        const t = title ? ` title="${esc(title)}"` : ''
        return `<img src="${esc(href)}" alt="${esc(text ?? '')}"${t} loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      },
    },
  })
  try {
    const src = rm.md.replace(/^\s*# .*\n/, '')
    let html = md.parse(src)
    for (let prev = null; prev !== html;) {
      prev = html
      html = html.replace(/<a\b[^>]*>\s*<\/a>/g, '').replace(/<p>\s*<\/p>\s*/g, '')
    }
    return html
  } catch {
    return null
  }
}

/** 走一遍词法器，把 markdown 语义（图片/标题）与原始 HTML 块分开数。 */
function inventory(md) {
  const own = []        // 指向本仓的 markdown 图片
  const outside = []    // 第三方图床的 markdown 图片（徽章）
  const htmlChunks = [] // 原始 HTML token 的原文
  let headings = 0
  const walk = (tokens) => {
    for (const t of tokens) {
      if (t.type === 'image') (isOwnImage(t.href) ? own : outside).push(t.href ?? '')
      else if (t.type === 'heading') headings += 1
      else if (t.type === 'html') htmlChunks.push(t.text ?? t.raw ?? '')
      if (Array.isArray(t.tokens)) walk(t.tokens)
      if (Array.isArray(t.items)) walk(t.items)
    }
  }
  walk(new Marked().lexer(md))
  // HTML 注释里的示例代码不算结构（本仓 README 顶部就有一条说明性注释）
  const html = htmlChunks.join('\n').replace(/<!--[\s\S]*?-->/g, '')
  return { own, outside, headings, html }
}

// [文件, 它在仓库里的目录（相对图片基准），语言标签]
const FILES = [
  ['README.md', '', '中文'],
  ['docs/README.en.md', 'docs', 'English'],
]

const problems = []
console.log('=== 市场侧 README 体检（awesome-dsh-plugin.com 详情页正文）===')

for (const [file, dir, label] of FILES) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const base = `https://raw.githubusercontent.com/${REPO}/HEAD/${dir ? dir + '/' : ''}`
  const html = renderReadme({ md, base, blobBase: `https://github.com/${REPO}/blob/HEAD/${dir ? dir + '/' : ''}` })
  if (html === null) {
    problems.push(`${file} 渲染直接抛错`)
    console.log(`\n${file}（${label}）\n  ✗ 渲染抛错`)
    continue
  }

  const inv = inventory(md)
  const gotImgs = [...html.matchAll(/<img\b/g)].length
  const gotHeads = [...html.matchAll(/<h[1-6]\b/g)].length

  console.log(`\n${file}（${label}）`)
  console.log(`  markdown 图片 : 本仓 ${inv.own.length} 张 → 渲染后 ${gotImgs} 张`)
  console.log(`  markdown 标题 : ${inv.headings} 个 → 渲染后 ${gotHeads} 个`)
  console.log(`  第三方图床图  : ${inv.outside.length} 张（徽章等，上游按隐私规则刻意丢弃，不算缺陷）`)

  if (gotImgs !== inv.own.length) {
    problems.push(`${file}：本仓 ${inv.own.length} 张图，市场详情页只剩 ${gotImgs} 张`)
  }
  if (gotHeads < inv.headings) {
    problems.push(`${file}：${inv.headings - gotHeads} 个 markdown 标题没渲染出来`)
  }

  // 1. 原始 HTML 装的本仓图片 —— 市场那侧一律丢
  const rawImgs = [...inv.html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => (m[0].match(/src\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? '')
    .filter((src) => isOwnImage(src))
  if (rawImgs.length) {
    problems.push(`${file}：${rawImgs.length} 张图写在原始 HTML <img> 里，市场详情页看不到`)
    for (const s of rawImgs) console.log(`  ✗ 原始 <img>：${s} —— 改成 ![](路径)`)
  }

  // 2. 原始 HTML 写的章节标题 —— 市场那侧一律丢
  const rawHeads = [...inv.html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  if (rawHeads.length) {
    problems.push(`${file}：${rawHeads.length} 个章节标题写在原始 HTML 里，市场详情页看不到`)
    for (const m of rawHeads) console.log(`  ✗ 原始 <h${m[1]}>：${stripTags(m[2])} —— 改成 markdown 标题`)
  }

  // 3. 只提示：<summary> 里的字只有 GitHub 看得见
  const summaries = [...inv.html.matchAll(/<summary>([\s\S]*?)<\/summary>/gi)].map((m) => stripTags(m[1]))
  if (summaries.length) {
    console.log(`  ⚠ ${summaries.length} 处 <summary> 只出现在 GitHub 的折叠壳上：${summaries.join(' / ')}`)
  }
}

if (problems.length) {
  console.log('\n=== 不合格 ===')
  for (const p of problems) console.log('  ✗ ' + p)
  console.log('\n修法：市场那侧只认 markdown —— 标题 `## 标题`、图片 `![说明](路径)`；')
  console.log('     想在 GitHub 上居中，用 <div align="center"> 包一层：壳被丢弃，里面的 markdown 照常渲染。')
  process.exit(1)
}
console.log('\n=== Test marketplace PASS ===')
