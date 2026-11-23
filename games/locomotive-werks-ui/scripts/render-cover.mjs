/**
 * Renders the catalogue thumbnail, src/lib/images/lw_cover.webp, from the banner engraving and two
 * locomotive cards in scripts/cover-art, which scripts/prepare-art.sh makes, and the title fonts.
 *
 * Prerequisites: Playwright's Chromium (pnpm exec playwright install chromium) and ImageMagick's
 * `convert` with WebP.
 *
 * Run: node games/locomotive-werks-ui/scripts/render-cover.mjs
 */
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lib = fileURLToPath(new URL('../src/lib/', import.meta.url))
const art = fileURLToPath(new URL('./cover-art/', import.meta.url))
const data = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`

const html = `<!doctype html><html><head><style>
@font-face { font-family: Playfair; src: url(${data(join(lib, 'fonts/PlayfairDisplay-BlackItalic.woff2'), 'font/woff2')}); }
@font-face { font-family: Baskerville; src: url(${data(join(lib, 'fonts/LibreBaskerville.woff2'), 'font/woff2')}); font-weight: 400 700; }
body { margin: 0; }
.cover { position: relative; width: 482px; height: 680px; overflow: hidden; background: #25303a; }
.palace { position: absolute; top: 0; left: -330px; height: 300px; opacity: 0.9; }
.shade { position: absolute; inset: 0; background: linear-gradient(#141b2100, #141b21cc 40%, #25303a 70%); }
h1 { position: absolute; top: 150px; width: 100%; margin: 0; text-align: center; font: 900 italic 66px/0.95 Playfair; color: #e9eef2; }
.years { position: absolute; top: 300px; width: 100%; text-align: center; font: 700 15px Baskerville; letter-spacing: 0.6em; color: #a7b8c5; }
.card { position: absolute; width: 300px; border-radius: 8px; box-shadow: 0 6px 16px #000a; }
.one { left: 30px; top: 360px; transform: rotate(-7deg); }
.two { left: 150px; top: 430px; transform: rotate(5deg); }
</style></head><body><div class="cover">
<img class="palace" src="${data(join(art, 'palace.webp'), 'image/webp')}">
<div class="shade"></div>
<h1>Locomotive<br>Werks</h1>
<div class="years">1804 · 1962</div>
<img class="card one" src="${data(join(art, 'card-05.webp'), 'image/webp')}">
<img class="card two" src="${data(join(art, 'card-40.webp'), 'image/webp')}">
</div></body></html>`

const work = mkdtempSync(join(tmpdir(), 'lw-cover-'))
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width: 482, height: 680 } })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    const png = join(work, 'cover.png')
    await page.locator('.cover').screenshot({ path: png })
    execFileSync('convert', [png, '-quality', '80', join(lib, 'images/lw_cover.webp')])
} finally {
    await browser.close()
    rmSync(work, { recursive: true, force: true })
}
