// Renders the board textures in src/lib/utils/boardTextures.ts to WebP images in
// src/lib/textures, with Chromium's own noise filters, so the images match what the filters drew.
//
// Run from games/marracash-ui: node scripts/render-textures.mjs
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { BoardTextures } from '../src/lib/utils/boardTextures.ts'

const Quality = 0.82

const noise = ({ size, baseFrequency, numOctaves, seed, matrix }, index) => `
    <filter id="noise-${index}" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
        <feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${numOctaves}"
            seed="${seed}" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="${matrix}"/>
    </filter>
    <rect width="${size}" height="${size}" filter="url(#noise-${index})" fill="none"/>`

const browser = await chromium.launch()
for (const { file, size, resolution, base, layers } of Object.values(BoardTextures)) {
    const page = await browser.newPage({ deviceScaleFactor: resolution })
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
        `<body style="margin:0;background:transparent">
            <svg id="tile" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
                xmlns="http://www.w3.org/2000/svg" style="display:block">
                ${base ? `<rect width="${size}" height="${size}" fill="${base}"/>` : ''}
                ${layers.map((layer, index) => noise({ size, ...layer }, index)).join('')}
            </svg>
        </body>`
    )
    const png = await page.locator('#tile').screenshot({ omitBackground: base === undefined })
    const webp = await page.evaluate(
        async ({ data, quality }) => {
            const image = new Image()
            image.src = `data:image/png;base64,${data}`
            await image.decode()
            const canvas = document.createElement('canvas')
            canvas.width = image.naturalWidth
            canvas.height = image.naturalHeight
            canvas.getContext('2d').drawImage(image, 0, 0)
            return canvas.toDataURL('image/webp', quality).split(',')[1]
        },
        { data: png.toString('base64'), quality: Quality }
    )
    await page.close()
    const bytes = Buffer.from(webp, 'base64')
    await writeFile(new URL(`../src/lib/textures/${file}.webp`, import.meta.url), bytes)
    console.log(`${file}.webp: ${size * resolution}px, ${Math.round(bytes.length / 1024)} KB`)
}
await browser.close()
