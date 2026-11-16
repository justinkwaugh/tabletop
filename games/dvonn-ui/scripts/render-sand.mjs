// Renders the sand board's grain (src/lib/board/sandTexture.ts) into the image the UI shows,
// ../src/lib/images/sand.webp. Drawing it takes seconds, so it is done here rather than as a game
// opens. Rerun after changing the grain: pnpm run render-sand
// The drawing runs in headless Chromium, the same canvas the players' browsers would have used.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { transformWithEsbuild } from 'vite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOARD = join(ROOT, 'src', 'lib', 'board')
const OUT = join(ROOT, 'src', 'lib', 'images', 'sand.webp')
const ORIGIN = 'http://sand.render'
// Lossy WebP at 0.9 keeps the finest grain (0.8 smears it) in about 120 KB; lossless is over 600 KB.
const QUALITY = Number(process.env.QUALITY ?? 0.9)

const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    // Serves the board modules from source, types stripped, so sandTexture.ts and its imports
    // load as they are in the repository.
    await page.route(`${ORIGIN}/**`, async (route) => {
        const path = new URL(route.request().url()).pathname
        if (path === '/') {
            return route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
        }
        const source = join(BOARD, path.replace(/\.js$/, '.ts'))
        const { code } = await transformWithEsbuild(await readFile(source, 'utf8'), source)
        return route.fulfill({ contentType: 'text/javascript', body: code })
    })
    await page.goto(`${ORIGIN}/`)

    const started = performance.now()
    const dataUrl = await page.evaluate(async (quality) => {
        const sand = await import('/sandTexture.js')
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(sand.SAND_SIZE.width * sand.SAND_RESOLUTION)
        canvas.height = Math.round(sand.SAND_SIZE.height * sand.SAND_RESOLUTION)
        sand.drawSand(canvas.getContext('2d'))
        return canvas.toDataURL('image/webp', quality)
    }, QUALITY)
    if (!dataUrl.startsWith('data:image/webp;base64,')) {
        throw new Error('The browser did not encode the sand as WebP')
    }
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    await writeFile(OUT, bytes)
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    console.log(`sand.webp: ${(bytes.length / 1024).toFixed(0)} KB in ${seconds} s`)
} finally {
    await browser.close()
}
