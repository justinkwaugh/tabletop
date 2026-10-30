// Pre-renders every disc's look to its own bitmap in ../src/lib/images/looks, which the board and
// the icons show as images. Drawn live, the looks' thousands of paths made opening a game and each
// move slow on phones; shown as SVG images, iPhone browsers redrew each one every frame it moved.
// Rerun after changing how a disc is drawn (board/pieceShape.ts, components/DiscLook.svelte or
// PieceDefs.svelte), with the harness running:
//   node scripts/render-looks.mjs   (PORT defaults to 5173)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images', 'looks')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/looks`, { waitUntil: 'networkidle' })
await page.locator('svg[data-look]').first().waitFor()

// Each look as a standalone file: styles from the component's CSS become attributes, and only the
// gradients it uses are kept.
const files = await page.evaluate(() => {
    const STYLED = ['fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'fill-opacity']
    return [...document.querySelectorAll('svg[data-look]')].map((svg) => {
        const copy = svg.cloneNode(true)
        const originals = [...svg.querySelectorAll('*')]
        ;[...copy.querySelectorAll('*')].forEach((node, index) => {
            const original = originals[index]
            if (original.hasAttribute('class')) {
                const style = getComputedStyle(original)
                for (const property of STYLED) {
                    if (!node.hasAttribute(property)) {
                        const value = style.getPropertyValue(property)
                        if ((value && value !== 'none') || property === 'fill')
                            node.setAttribute(property, value)
                    }
                }
                node.removeAttribute('class')
            }
        })
        const text = new XMLSerializer().serializeToString(copy)
        const used = new Set([...text.matchAll(/url\(#([^)"]+)\)/g)].map((match) => match[1]))
        for (const gradient of copy.querySelectorAll('linearGradient, radialGradient')) {
            if (!used.has(gradient.id)) gradient.remove()
        }
        copy.removeAttribute('data-look')
        copy.removeAttribute('width')
        copy.removeAttribute('height')
        return { name: svg.dataset.look, text: new XMLSerializer().serializeToString(copy) }
    })
})

// Pixels per board unit: a disc about 640 px across, sharp at the board's full zoom on a phone.
const SCALE = 12
const bitmaps = await page.evaluate(
    async ({ files, scale }) =>
        Promise.all(
            files.map(async ({ name, text }) => {
                const image = new Image()
                image.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
                await image.decode()
                const [, , width, height] = text.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
                const canvas = document.createElement('canvas')
                canvas.width = Math.round(width * scale)
                canvas.height = Math.round(height * scale)
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
                return { name, data: canvas.toDataURL('image/webp', 0.9) }
            })
        ),
    { files, scale: SCALE }
)

mkdirSync(OUT, { recursive: true })
for (const old of readdirSync(OUT)) rmSync(join(OUT, old))
for (const { name, data } of bitmaps) {
    const bytes = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(join(OUT, `${name}.webp`), bytes)
    console.log(name, bytes.length)
}
await browser.close()
