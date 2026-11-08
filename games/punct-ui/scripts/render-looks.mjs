// Pre-renders each piece body, dish and icon to its own bitmap in ../src/lib/images/looks, which
// the board and the cards show as images, with each piece's specks drawn over it (board/looks.ts).
// Drawn live, their thousands of paths and gradients made opening a game and each move slow on
// phones. It also writes board/lookUrls.ts, importing each file by name. Rerun after changing how
// a piece is drawn (board/pieceShape.ts, board/dishShape.ts, board/pieceColours.ts,
// components/PieceBody.svelte, DishLook.svelte, PieceDefs.svelte, or an icon's specks), with the
// harness running:
//   node scripts/render-looks.mjs   (PORT defaults to 5173)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')
const OUT = join(LIB, 'images', 'looks')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/looks`, { waitUntil: 'networkidle' })
await page.locator('svg[data-look]').first().waitFor()

// Each look as a standalone file: styles from the component's CSS become attributes, and only the
// gradients it uses are kept.
const files = await page.evaluate(() => {
    const STYLED = ['fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'fill-opacity', 'opacity']
    const svgs = [
        ...[...document.querySelectorAll('svg[data-look]')].map((svg) => [svg, svg.dataset.look]),
        ...[...document.querySelectorAll('[data-icon]')].map((span) => [
            span.querySelector('svg'),
            span.dataset.icon
        ])
    ]
    return svgs.map(([svg, name]) => {
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
        copy.removeAttribute('class')
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        return { name, text: new XMLSerializer().serializeToString(copy) }
    })
})

// Pixels per board unit: sharp at the board's full zoom on a phone (about 1.3 CSS pixels a unit at
// 3 device pixels each). Icons are drawn about 0.24 CSS pixels a unit at most.
const scaleOf = (name) => (name.startsWith('icon-') ? 1.2 : 4)
// Each look is drawn this many times larger and halved down to SCALE, which blends away the fine
// seams between the many bands of the groove's walls. Only the drawing grows, not the files.
const SUPERSAMPLE = 4
// One at a time: all at once, the browser ran out of memory.
const bitmaps = []
for (const file of files) {
    bitmaps.push(
        await page.evaluate(
            async ({ name, text, scale, supersample }) => {
                const image = new Image()
                image.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
                await image.decode()
                const [, , width, height] = text
                    .match(/viewBox="([^"]+)"/)[1]
                    .split(' ')
                    .map(Number)
                const size = {
                    width: Math.round(width * scale),
                    height: Math.round(height * scale)
                }
                let canvas = document.createElement('canvas')
                canvas.width = size.width * supersample
                canvas.height = size.height * supersample
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
                URL.revokeObjectURL(image.src)
                // Halving at each step keeps every source pixel in the blend.
                while (canvas.width > size.width) {
                    const next = document.createElement('canvas')
                    next.width = Math.max(size.width, Math.round(canvas.width / 2))
                    next.height = Math.max(size.height, Math.round(canvas.height / 2))
                    const context = next.getContext('2d')
                    context.imageSmoothingQuality = 'high'
                    context.drawImage(canvas, 0, 0, next.width, next.height)
                    canvas = next
                }
                return { name, data: canvas.toDataURL('image/webp', 0.9) }
            },
            { ...file, scale: scaleOf(file.name), supersample: SUPERSAMPLE }
        )
    )
}

mkdirSync(OUT, { recursive: true })
for (const old of readdirSync(OUT)) rmSync(join(OUT, old))
for (const { name, data } of bitmaps) {
    const bytes = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(join(OUT, `${name}.webp`), bytes)
    console.log(name, bytes.length)
}

// Each file imported on its own: Vite and the published bundle's rollup both turn such an import
// into the file's URL, where a glob is Vite's alone and fails in the bundle.
const names = bitmaps.map(({ name }) => name).toSorted()
const variable = (name) => name.replace(/-(\w)/g, (_, letter) => letter.toUpperCase())
// A name that is already its variable's name needs only that.
const entry = (name) =>
    name === variable(name) ? name : `${/^\w+$/.test(name) ? name : `'${name}'`}: ${variable(name)}`
writeFileSync(
    join(LIB, 'board', 'lookUrls.ts'),
    [
        '// Written by scripts/render-looks.mjs: the file of every look, by name.',
        ...names.map((name) => `import ${variable(name)} from '../images/looks/${name}.webp'`),
        '',
        'export const LOOK_URLS: Record<string, string> = {',
        ...names.map((name, index) => `    ${entry(name)}${index < names.length - 1 ? ',' : ''}`),
        '}',
        ''
    ].join('\n')
)
await browser.close()
