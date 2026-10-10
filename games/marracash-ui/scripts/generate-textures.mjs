/**
 * Renders the board's noise textures to the image tiles in src/lib/images that TextureDefs.svelte
 * lays over the street and the stalls. Each texture is fixed, seeded noise, so it is drawn once
 * here rather than generated in the browser on every redraw of the board.
 *
 * Prerequisites:
 *   • Playwright's Chromium is installed:
 *       cd games/marracash-ui && pnpm exec playwright install chromium
 *   • ImageMagick's `convert`, built with WebP, is on the PATH.
 *
 * Run:
 *   node games/marracash-ui/scripts/generate-textures.mjs
 */
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const images = fileURLToPath(new URL('../src/lib/images/', import.meta.url))

function noise(id, size, baseFrequency, numOctaves, seed, matrix) {
    return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
        <feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${numOctaves}" seed="${seed}" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="${matrix}"/>
    </filter>`
}

// `size` is the tile's side in board units, drawn at two pixels a unit; `encode` is passed to
// `convert`. Every tile but the sand is drawn on transparency, to lie over what is beneath it.
const tiles = [
    {
        // Pale rose-sand packed earth: soft mottling under a fine grit
        file: 'sand.webp',
        size: 400,
        body: `${noise('mottle', 400, '0.012', 3, 21, '0 0 0 0 0.62  0 0 0 0 0.42  0 0 0 0 0.28  0.9 0 0 0 -0.32')}
               ${noise('grit', 400, '0.55', 2, 2, '0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.22  0.7 0 0 0 -0.3')}
               <rect width="400" height="400" fill="#ead6b6"/>
               <rect width="400" height="400" filter="url(#mottle)"/>
               <rect width="400" height="400" filter="url(#grit)"/>`,
        encode: ['-quality', '90']
    },
    {
        // Broad, faint dust patches: smooth enough to keep at half a pixel a unit
        file: 'dust.webp',
        size: 560,
        body: `${noise('dust', 560, '0.0075', 4, 8, '0 0 0 0 0.5  0 0 0 0 0.36  0 0 0 0 0.22  0.8 0 0 0 -0.42')}
               <rect width="560" height="560" filter="url(#dust)"/>`,
        encode: ['-resize', '280x280', '-quality', '80', '-define', 'webp:alpha-quality=80']
    },
    {
        // A woven grain for the stalls: fine, with no large features, so a small tile is enough
        file: 'stall-weave.webp',
        size: 128,
        body: `${noise('weave', 128, '0.9 0.22', 2, 4, '0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.05  0.9 0 0 0 -0.35')}
               <rect width="128" height="128" filter="url(#weave)"/>`,
        encode: ['-quality', '60', '-define', 'webp:alpha-quality=70']
    }
]

const work = mkdtempSync(join(tmpdir(), 'marracash-textures-'))
const browser = await chromium.launch()
try {
    const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: { width: 700, height: 700 }
    })
    for (const tile of tiles) {
        const { size } = tile
        await page.setContent(
            `<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block">${tile.body}</svg></body>`
        )
        const png = join(work, `${tile.file}.png`)
        await page.screenshot({
            path: png,
            omitBackground: true,
            clip: { x: 0, y: 0, width: size, height: size }
        })
        execFileSync('convert', [png, ...tile.encode, join(images, tile.file)])
        console.log(`wrote ${tile.file}`)
    }
} finally {
    await browser.close()
    rmSync(work, { recursive: true })
}
