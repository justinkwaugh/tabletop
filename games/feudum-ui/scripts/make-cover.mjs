// Writes the catalog image: `node scripts/make-cover.mjs (--titled | --art <image>) [--out <file>]`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { BoxFrontTitle, CoverSize, coverSvg } from '../src/lib/utils/coverPage.ts'

const Root = fileURLToPath(new URL('..', import.meta.url))
const { width: Width, height: Height } = CoverSize
const MostBytes = 120 * 1024

// Publisher images, kept out of git: the box front, and the rulebook's cover standing in for it.
const CoverSource = join(Root, 'src/lib/art/cover-source')
const SourceNames = ['box-front', 'rulebook-cover']
const SourceTypes = ['.png', '.jpg', '.jpeg', '.webp']

const { values } = parseArgs({
    options: {
        art: { type: 'string' },
        titled: { type: 'boolean', default: false },
        out: { type: 'string' }
    }
})

function coverSource() {
    for (const name of SourceNames) {
        for (const type of SourceTypes) {
            const path = join(CoverSource, name + type)
            if (existsSync(path)) {
                return path
            }
        }
    }
    throw new Error(
        `No cover source: put box-front.png (or .jpg, .webp) in ${CoverSource}, or pass --art <image>`
    )
}

if (!values.art && !values.titled) {
    throw new Error(
        'Pass --titled for the box front, or --art <image>: no cover is drawn without one'
    )
}
const art = values.art ?? coverSource()
const out = values.out ?? join(Root, 'src/lib/art/supplied/cover.webp')

const css = readFileSync(join(Root, 'src/app.css'), 'utf8')
const tokens = new Map(
    [...css.matchAll(/^\s*--feudum-([a-z-]+):\s*(#[^;]+);/gm)].map((match) => [match[1], match[2]])
)
const token = (name) => tokens.get(name)

function fontFace(family, file) {
    const path = join(Root, 'src/lib/fonts', file)
    if (!existsSync(path)) {
        return ''
    }
    const data = readFileSync(path).toString('base64')
    return `@font-face { font-family: '${family}'; src: url(data:font/${file.split('.').pop()};base64,${data}); }`
}

const ImageTypes = { '.png': 'image/png', '.webp': 'image/webp' }

function artHref(path) {
    const type = ImageTypes[extname(path).toLowerCase()] ?? 'image/jpeg'
    return `data:${type};base64,${readFileSync(path).toString('base64')}`
}

const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: Width, height: Height } })

/** The image's own size, which the crop rule needs. */
async function sizeOf(href) {
    return tab.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        return { width: image.naturalWidth, height: image.naturalHeight }
    }, href)
}

const href = artHref(art)
const size = await sizeOf(href)
const scene = values.titled
    ? {
          href,
          titled: true,
          size,
          title: basename(art, extname(art)) === 'box-front' ? BoxFrontTitle : undefined
      }
    : { href, titled: false, size }
console.log(`from ${art}`)

const page = `<!doctype html><html><head><style>
    ${fontFace('MedievalSharp', 'MedievalSharp.woff2')}
    ${fontFace('IM Fell English', 'IMFellEnglish-Latin.woff2')}
    html, body { margin: 0; }
</style></head><body>
${coverSvg(scene, token)}
</body></html>`

await tab.setContent(page)
await tab.evaluate(() => document.fonts.ready)
const shot = (await tab.screenshot({ type: 'png' })).toString('base64')

const encoded = await tab.evaluate(
    async ({ shot, mostBytes, width, height }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${shot}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0)
        let quality = 0.85
        let url = canvas.toDataURL('image/webp', quality)
        while (url.length * 0.75 > mostBytes && quality > 0.3) {
            quality -= 0.05
            url = canvas.toDataURL('image/webp', quality)
        }
        return url.split(',')[1]
    },
    { shot, mostBytes: MostBytes, width: Width, height: Height }
)
await browser.close()

const file = Buffer.from(encoded, 'base64')
writeFileSync(out, file)
console.log(`${out}: ${file.length} bytes`)
