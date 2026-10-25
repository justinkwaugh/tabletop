// Renders the storm of cloud (src/lib/board/storm.ts) into the images the UI shows, one per
// tone, in ../src/lib/images. Tracing the streaks takes seconds, so it is done here rather than
// as a game opens. Rerun after changing the storm or its tones: pnpm run render-storm
// The drawing runs in headless Chromium, the same canvas the players' browsers would have used.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { transformWithEsbuild } from 'vite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOARD = join(ROOT, 'src', 'lib', 'board')
const IMAGES = join(ROOT, 'src', 'lib', 'images')
const ORIGIN = 'http://storm.render'

// Each tone exported by storm.ts and the image it is rendered to.
const RENDERS = [
    { tone: 'TABLE_STORM', file: 'storm-table.webp' },
    { tone: 'BOARD_STORM', file: 'storm-board.webp' }
]
// Quality 1 is lossless WebP: smaller than lossy here (each tone is one colour, and alpha is
// stored losslessly either way) and about half a PNG's size.
const QUALITY = 1

const browser = await chromium.launch()
try {
    const page = await browser.newPage()
    // Serves the board modules from source, types stripped, so storm.ts and its imports load
    // as they are in the repository.
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

    for (const { tone, file } of RENDERS) {
        const started = performance.now()
        const dataUrl = await page.evaluate(
            async ({ tone, quality }) => {
                const storm = await import('/storm.js')
                const canvas = document.createElement('canvas')
                canvas.width = canvas.height = Math.round(storm.STORM_SIZE * storm.STORM_RESOLUTION)
                storm.drawStorm(canvas.getContext('2d'), storm[tone])
                return canvas.toDataURL('image/webp', quality)
            },
            { tone, quality: QUALITY }
        )
        if (!dataUrl.startsWith('data:image/webp;base64,')) {
            throw new Error(`The browser did not encode ${file} as WebP`)
        }
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
        await writeFile(join(IMAGES, file), bytes)
        const seconds = ((performance.now() - started) / 1000).toFixed(1)
        console.log(`${file}: ${(bytes.length / 1024).toFixed(0)} KB in ${seconds} s`)
    }
} finally {
    await browser.close()
}
