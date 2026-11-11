// Writes the catalog image: `node scripts/make-cover.mjs [--titled] [--art <image>] [--out <file>]`.
// Colours come from app.css and the colorizer, forms from the shape module, and the title from the
// table's own font, so the cover has nothing of its own to keep in step. The page and its title
// band come from `src/lib/utils/coverPage.ts`. With `--art`, the image stands behind the title band
// in place of the drawn scene; with `--titled` as well, the image prints its own title and is the
// whole cover, placed by the page's crop rule (`coverPlacement`), around the box front's printed
// title when the image is the box front. `--titled` alone takes the box
// front from `src/lib/art/cover-source/`, or the rulebook's cover while no box front is there.
// With an image, the cover goes to the supplied art folder; without one, to `src/lib/images/`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { BoxFrontTitle, CoverSize, coverSvg } from '../src/lib/utils/coverPage.ts'
import {
    CrownPath,
    GuildIconPaths,
    KeepPath,
    PawnBodyPath,
    PawnMedallion
} from '../src/lib/utils/pieceShapes.ts'

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

const art = values.art ?? (values.titled ? coverSource() : undefined)
const out =
    values.out ?? join(Root, art ? 'src/lib/art/supplied/cover.webp' : 'src/lib/images/cover.webp')

const css = readFileSync(join(Root, 'src/app.css'), 'utf8')
const tokens = new Map(
    [...css.matchAll(/^\s*--feudum-([a-z-]+):\s*(#[^;]+);/gm)].map((match) => [match[1], match[2]])
)
const token = (name) => tokens.get(name)

// The five seats, from the colorizer's own table, so a change there changes the cover.
const colorizer = readFileSync(join(Root, 'src/lib/definitions/colorizer.ts'), 'utf8')
const uiColors = colorizer.slice(0, colorizer.indexOf('getBgColor'))
const seat = (name) => new RegExp(`Color\\.${name}:\\s*return '(#[0-9a-f]+)'`).exec(uiColors)?.[1]
const Seats = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'].map(seat)

function fontFace(family, file) {
    const path = join(Root, 'src/lib/fonts', file)
    if (!existsSync(path)) {
        return ''
    }
    const data = readFileSync(path).toString('base64')
    return `@font-face { font-family: '${family}'; src: url(data:font/${file.split('.').pop()};base64,${data}); }`
}

function medallion(guild, x, y, r) {
    const scale = (r * 1.5) / 24
    const offset = (r * 1.5) / 2
    return `
        <circle cx="${x}" cy="${y}" r="${r}" fill="${token('parchment')}" stroke="${token('ink')}" stroke-width="2" />
        <path d="${GuildIconPaths[guild]}" fill="${token('ink')}" fill-rule="evenodd"
            transform="translate(${x - offset} ${y - offset}) scale(${scale})" />`
}

function pawn(fill, x, y, scale) {
    return `<g transform="translate(${x} ${y}) scale(${scale})">
        <path d="${PawnBodyPath}" fill="${fill}" stroke="${token('map-ink')}" stroke-width="1" />
        <circle cx="${PawnMedallion.x}" cy="${PawnMedallion.y}" r="${PawnMedallion.r}" fill="${token('parchment')}" />
    </g>`
}

function drawnScene() {
    const guilds = Object.keys(GuildIconPaths)
    const arc = guilds.map((guild, index) => {
        const angle = Math.PI * (1.1 + (0.8 * index) / (guilds.length - 1))
        return medallion(guild, Width / 2 + 215 * Math.cos(angle), 300 + 215 * Math.sin(angle), 34)
    })
    const pawns = Seats.map((fill, index) => pawn(fill, 66 + index * 90, 382, 1.65))
    return `
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${token('sky-dusk')}" />
            <stop offset="0.6" stop-color="${token('surface-raised')}" />
            <stop offset="1" stop-color="${token('sky-dawn')}" />
        </linearGradient></defs>
        <rect width="${Width}" height="${Height}" fill="url(#sky)" />
        <path d="M0 400 C120 300 420 300 ${Width} 400 L${Width} ${Height} L0 ${Height} Z" fill="${token('terrain-forest')}" />
        <g transform="translate(${Width / 2 - 125} 145) scale(2.5)">
            <path d="${KeepPath}" fill="${token('terrain-line')}" />
        </g>
        <path d="M${Width / 2 - 2} 90 L${Width / 2 + 2} 90 L${Width / 2 + 2} 225 L${Width / 2 - 2} 225 Z" fill="${token('terrain-line')}" />
        <path d="${CrownPath}" transform="translate(${Width / 2 - 30} 44) scale(2.5)" fill="${token('accent')}" stroke="${token('map-ink')}" stroke-width="0.5" />
        ${arc.join('')}
        ${pawns.join('')}`
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

let scene = { kind: 'drawn', markup: drawnScene() }
if (art) {
    const href = artHref(art)
    scene = values.titled
        ? {
              kind: 'art',
              href,
              titled: true,
              size: await sizeOf(href),
              title: basename(art, extname(art)) === 'box-front' ? BoxFrontTitle : undefined
          }
        : { kind: 'art', href, titled: false }
    console.log(`from ${art}`)
}

const page = `<!doctype html><html><head><style>
    ${fontFace('MedievalSharp', 'MedievalSharp.ttf')}
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
