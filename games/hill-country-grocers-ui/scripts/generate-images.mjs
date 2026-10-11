/**
 * Renders the map's paper grain and the logo's drop shadow to the image files in src/lib/images
 * that TerrainLayer.svelte draws. Both are fixed, so they are drawn once here rather than by
 * SVG and CSS filters in the browser on every redraw of the board.
 *
 * Prerequisites:
 *   • Playwright's Chromium is installed:
 *       cd games/hill-country-grocers-ui && pnpm exec playwright install chromium
 *   • ImageMagick's `convert`, built with WebP, is on the PATH.
 *
 * Run:
 *   node games/hill-country-grocers-ui/scripts/generate-images.mjs
 */
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const images = fileURLToPath(new URL('../src/lib/images/', import.meta.url))
const logo = `data:image/png;base64,${readFileSync(join(images, 'hcg_logo.png')).toString('base64')}`

// Each image is drawn at two pixels a board unit over the `view` box; `encode` is passed to
// `convert`. Both are drawn on transparency, to lie over the map.
const renders = [
    {
        // Fine paper grain with no large features, so a small tile repeats unseen
        file: 'paper-grain.webp',
        view: { x: 0, y: 0, width: 128, height: 128 },
        body: `<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
                   <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
                   <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.16  0 0 0 0.16 0"/>
               </filter>
               <rect width="128" height="128" filter="url(#grain)"/>`,
        encode: ['-quality', '60', '-define', 'webp:alpha-quality=70']
    },
    {
        // The logo at its 210 x 134 board size, with room round it for its shadow
        file: 'hcg_logo_shadowed.webp',
        view: { x: -8, y: -8, width: 226, height: 150 },
        body: `<image href="${logo}" width="210" height="134"
                   style="filter: drop-shadow(0 3px 4px rgba(30, 20, 5, 0.45))"/>`,
        encode: ['-quality', '90', '-define', 'webp:alpha-quality=90']
    }
]

const work = mkdtempSync(join(tmpdir(), 'hcg-images-'))
const browser = await chromium.launch()
try {
    const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: { width: 400, height: 400 }
    })
    for (const render of renders) {
        const { x, y, width, height } = render.view
        await page.setContent(
            `<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" style="display:block">${render.body}</svg></body>`
        )
        const png = join(work, `${render.file}.png`)
        await page.screenshot({
            path: png,
            omitBackground: true,
            clip: { x: 0, y: 0, width, height }
        })
        execFileSync('convert', [png, ...render.encode, join(images, render.file)])
        console.log(`wrote ${render.file}`)
    }
} finally {
    await browser.close()
    rmSync(work, { recursive: true })
}
