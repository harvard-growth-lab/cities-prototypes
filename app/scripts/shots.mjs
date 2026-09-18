#!/usr/bin/env node
/* Screenshots of the app at phone / tablet / desktop widths, with a check
   that nothing widens the page or the tool's scroller.

     node scripts/shots.mjs --routes /,/city/boston-ma/fundamentals --widths 390,768,1440
     options: --base http://localhost:5173  --height 900  --out shots  --full (full-page)
              --scroll 600 (scroll #pages by N px before the shot)

   Needs a running dev server (pnpm dev) and Google Chrome. */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? dflt : args[i + 1]
}
const flag = (name) => args.includes(`--${name}`)

const base = opt('base', 'http://localhost:5173')
const routes = opt('routes', '/,/city/boston-ma/fundamentals').split(',')
const widths = opt('widths', '390,768,1440').split(',').map(Number)
const height = Number(opt('height', 900))
const out = opt('out', 'shots')
const scroll = Number(opt('scroll', 0))
const full = flag('full')
const executablePath = opt('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })
let flagged = 0

for (const route of routes) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto(base + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    if (scroll) {
      await page.evaluate((y) => document.getElementById('pages')?.scrollTo({ top: y }), scroll)
      await page.waitForTimeout(500)
    }
    const m = await page.evaluate(() => {
      const pages = document.getElementById('pages')
      return {
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        pagesScroll: pages?.scrollWidth ?? null,
        pagesClient: pages?.clientWidth ?? null,
      }
    })
    const name = `${route.replace(/^\//, '').replace(/[/#?=]+/g, '_') || 'landing'}-${width}${scroll ? `-s${scroll}` : ''}.png`
    await page.screenshot({ path: `${out}/${name}`, fullPage: full })
    const over = m.docScroll > m.docClient || (m.pagesScroll !== null && m.pagesScroll > m.pagesClient)
    if (over) flagged++
    console.log(
      `${over ? 'H-OVERFLOW ' : 'ok         '}${route} @${width}  doc ${m.docScroll}/${m.docClient}` +
        (m.pagesScroll !== null ? `  #pages ${m.pagesScroll}/${m.pagesClient}` : '') +
        `  → ${out}/${name}` +
        (errors.length ? `\n           errors: ${errors.slice(0, 3).join(' | ')}` : ''),
    )
    await page.close()
  }
}
await browser.close()
if (flagged) console.log(`${flagged} route×width combination(s) overflow horizontally`)
