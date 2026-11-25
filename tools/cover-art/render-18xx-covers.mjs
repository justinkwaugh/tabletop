/**
 * Renders catalogue covers for 18xx titles: a painting, print, map or engraving, from Wikimedia
 * Commons or a title's public rulebook, under new title lettering in SIL Open Font License fonts
 * from google/fonts. Each cover is written to games/<title>-ui/src/lib/images/cover.webp. See README.md beside this script for the
 * sources and licences.
 *
 * Prerequisites: network access, Playwright's Chromium, ImageMagick's `convert` and `identify`
 * with WebP, and poppler's `pdfimages`. Playwright is resolved from the working directory, so run it from a package that has
 * it:
 *
 *   cd apps/frontend && node ../../tools/cover-art/render-18xx-covers.mjs [title ...]
 *
 * With no titles it renders them all. Downloads are cached in the system temp directory.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('@playwright/test')

const repo = fileURLToPath(new URL('../../', import.meta.url))
const cache = join(tmpdir(), 'tabletop-cover-art')
const userAgent = 'tabletop-cover-art/1.0'

/** The google/fonts commit the fonts are taken from. */
const fontsCommit = '83c62e30d87daa70216dab6b984d00d20d96d585'

/** CSS family name → path in google/fonts. */
const fonts = {
    Bodoni: 'ofl/bodonimoda/BodoniModa[opsz,wght].ttf',
    Cinzel: 'ofl/cinzel/Cinzel[wght].ttf',
    Playfair: 'ofl/playfairdisplay/PlayfairDisplay[wght].ttf',
    PlayfairItalic: 'ofl/playfairdisplay/PlayfairDisplay-Italic[wght].ttf',
    FellItalic: 'ofl/imfellenglish/IMFeENit28P.ttf',
    FellCanon: 'ofl/imfellfrenchcanon/IMFeFCrm28P.ttf',
    Caslon: 'ofl/librecaslontext/LibreCaslonText[wght].ttf',
    Oswald: 'ofl/oswald/Oswald[wght].ttf',
    Abril: 'ofl/abrilfatface/AbrilFatface-Regular.ttf',
    AlfaSlab: 'ofl/alfaslabone/AlfaSlabOne-Regular.ttf',
    Rye: 'ofl/rye/Rye-Regular.ttf',
    Cormorant: 'ofl/cormorantgaramond/CormorantGaramond[wght].ttf',
    CormorantItalic: 'ofl/cormorantgaramond/CormorantGaramond-Italic[wght].ttf'
}

/** The cover's CSS size; it is drawn at twice this and saved at `outputWidth`. */
const width = 513
const height = 680
const outputWidth = 770

/**
 * Each cover names its art, a Commons `file` or the first image on a `pdf` page, and the window cut
 * from it, as fractions of the image: left
 * and right edges, the top edge, and the window's width/height (the cover's own by default). The
 * art is the cover's background, or wherever the cover's own CSS places `var(--art)`.
 */
const covers = {
    1817: {
        file: 'File:Joseph Pennell, The Stock Exchange, 1904, NGA 32874.jpg',
        crop: { left: 0.05, right: 0.95, top: 0.04 },
        css: `
.cover{background-color:#efe9dc}
.scrim{background:linear-gradient(#efe9dcd0 0,#efe9dc70 20%,#efe9dc00 32%,#0000 84%,#efe9dccc 100%)}
.num{top:28px;font:900 146px/1 Playfair;font-variant-numeric:lining-nums;color:#1d1a17;letter-spacing:.01em}
.credit{color:#1d1a17}.artist{color:#1d1a17cc}`,
        html: `<div class="scrim"></div><div class="abs num">1817</div>
<div class="credit">Craig Bartell<br>Tim Flowers</div><div class="artist">after Joseph Pennell<br>The Stock Exchange, 1904</div>`
    },
    1822: {
        file: 'File:Turner - Rain, Steam and Speed - National Gallery file.jpg',
        crop: { left: 0.42, right: 0.9, top: 0.148 },
        css: `
.scrim{background:linear-gradient(#f1e6c8d0 0,#f1e6c860 30%,#f1e6c800 44%,#0000 72%,#1a120a99 100%)}
.of{top:46px;font:600 15px Cinzel;letter-spacing:.42em;color:#3a2614;padding-left:.42em}
.num{top:60px;font:900 150px/1 Bodoni;color:#5b1a12;letter-spacing:-.02em;text-shadow:0 1px 0 #f6edd4,0 2px 10px #f6edd460}
.rule{top:213px;margin:auto;width:230px;border-top:1px solid #5b1a12aa}
.gb{top:222px;font:600 25px Cinzel;letter-spacing:.24em;color:#3a2614;padding-left:.24em}
.credit{color:#f3e7cc;text-shadow:0 1px 3px #000c}.artist{color:#f3e7cccc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs of">The Railways of</div><div class="abs num">1822</div>
<div class="abs rule"></div><div class="abs gb">Great Britain</div>
<div class="credit">Simon Cutforth</div><div class="artist">after J. M. W. Turner<br>Rain, Steam and Speed, 1844</div>`
    },
    '1833ne': {
        file: 'File:City of Fall River, Mass. 1877. LOC 75694571.jpg',
        full: true,
        crop: { left: 0.50245, right: 0.68627, top: 0.62025, aspect: 1.166 },
        // paints out the "MOUNT HOPE BAY" label with the water below it
        retouch: [
            {
                from: { left: 0.50245, top: 0.84506, width: 0.18382, height: 0.01664 },
                to: { left: 0.50245, top: 0.82676 }
            }
        ],
        css: `
.cover{background:#eee6d0}
.art{position:absolute;left:0;right:0;top:0;height:440px;background:var(--art) center/cover;border-bottom:1px solid #23364a}
.num{top:462px;font:900 112px/1 Playfair;font-variant-numeric:lining-nums;color:#23364a}
.ne{font-size:.62em;letter-spacing:.04em;margin-left:.04em}
.r1{margin:auto;width:300px;border-top:1px solid #23364a;top:590px}
.sub{top:602px;font:600 15px Cinzel;letter-spacing:.34em;color:#2a2219;padding-left:.34em}
.credit{color:#2a2219;bottom:14px}.artist{color:#2a2219;bottom:12px}`,
        html: `<div class="art"></div><div class="abs num">1833<span class="ne">NE</span></div><div class="abs r1"></div>
<div class="abs sub">Railroading in New England</div>
<div class="credit">Tom Lehmann</div><div class="artist">after O. H. Bailey &amp; J. C. Hazen<br>City of Fall River, Mass., 1877</div>`
    },
    1846: {
        file: 'File:American railroad scene- lightning express trains leaving the junction LCCN90708612.jpg',
        crop: { left: 0.07, right: 0.55, top: 0.36, aspect: 1.5 },
        css: `
.cover{background:#f0e8d2}
.edge{position:absolute;inset:12px;border:2px solid #1d1a17}
.l1{top:26px;font:400 22px Rye;color:#1d1a17;letter-spacing:.08em}
.num{top:68px;font:400 150px/1 AlfaSlab;color:#a3231a;letter-spacing:.01em}
.l2{top:222px;font:700 30px/1 Oswald;letter-spacing:.12em;color:#1d1a17;padding-left:.12em}
.bar{margin:auto;width:420px;border-top:3px solid #1d1a17}.b1{top:214px}.b2{top:262px}
.vig{position:absolute;left:70px;right:70px;top:278px;height:244px;background:var(--art) center/cover;filter:grayscale(1) contrast(1.35);mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 62%,#0000 100%)}
.cities{top:546px;font:600 13px/1.7 Oswald;letter-spacing:.2em;color:#1d1a17;padding-left:.2em}
.by{top:562px;font:400 20px Rye;color:#a3231a;letter-spacing:.06em}
.artist{bottom:24px;right:0;left:0;text-align:center;color:#1d1a17aa}`,
        html: `<div class="edge"></div><div class="abs l1">— Tom Lehmann’s —</div>
<div class="abs num">1846</div><div class="abs bar b1"></div><div class="abs l2">THE RACE FOR THE MIDWEST</div><div class="abs bar b2"></div>
<div class="vig"></div>
<div class="abs cities">CHICAGO · DETROIT · CLEVELAND · TOLEDO<br>CINCINNATI · ST. LOUIS · PITTSBURGH</div>
<div class="artist">vignette after Currier &amp; Ives, Lightning Express Trains, 1874</div>`
    },
    1849: {
        file: 'File:Mount Etna From Taormina, Sicily, Explore Thomas Cole.png',
        crop: { left: 0.47, right: 0.959, top: 0 },
        css: `
.scrim{background:linear-gradient(#0000 58%,#1b0d08b0 100%)}
.num{top:4px;font:italic 900 136px/1 PlayfairItalic;color:#8e2414;text-shadow:0 1px 0 #f7dcc1,0 3px 14px #f7dcc180}
.sub{bottom:74px;font:600 13px Cinzel;letter-spacing:.34em;color:#f6e3c8;padding-left:.34em;text-shadow:0 1px 4px #000d}
.sub2{bottom:40px;font:italic 600 27px CormorantItalic;color:#f6e3c8;letter-spacing:.03em;text-shadow:0 1px 5px #000d}
.credit{color:#f6e3c8;text-shadow:0 1px 3px #000c}.artist{color:#f6e3c8cc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs num">1849</div>
<div class="abs sub">The Game of</div><div class="abs sub2">Sicilian Railways</div>
<div class="credit">Federico Vellani</div><div class="artist">after Thomas Cole<br>Mount Etna from Taormina</div>`
    },
    1862: {
        pdf: {
            url: 'https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/1862/1862_TRAIN_RULES-Final.pdf',
            page: 1
        },
        crop: { left: 0.05, right: 0.94, top: 0.02, aspect: 1.2 },
        css: `
.cover{background:#efe5cc}
.art{position:absolute;left:20px;right:20px;top:262px;bottom:50px;background:var(--art) center/cover;border:1px solid #1f3b2b}
.frame{position:absolute;left:14px;right:14px;top:256px;bottom:44px;border:1px solid #1f3b2b}
.rule{margin:auto;width:300px;border-top:1px solid #1f3b2b}
.r1{top:24px}.r2{top:28px}
.num{top:36px;font:400 124px/1 AlfaSlab;color:#1f4a33;letter-spacing:.02em}
.mania{top:170px;font:700 23px Cinzel;letter-spacing:.3em;color:#2a2219;padding-left:.3em}
.counties{top:202px;font:400 26px/1 FellItalic;color:#7a2a1c}
.credit{color:#2a2219;bottom:16px}.artist{color:#2a2219;bottom:14px}`,
        html: `<div class="abs rule r1"></div><div class="abs rule r2"></div>
<div class="abs num">1862</div><div class="abs mania">Railway Mania</div>
<div class="abs counties">in the Eastern Counties</div>
<div class="art"></div><div class="frame"></div>
<div class="credit">Mike Hutton</div><div class="artist">after the Illustrated London News, 1845,<br>coloured for the rulebook</div>`
    },
    1860: {
        file: 'File:Ventnor, Isle of Wight, England, ca. 1899.jpg',
        crop: { left: 0.04, right: 0.595, top: 0 },
        css: `
.scrim{background:linear-gradient(#f4f1e6e0 0,#f4f1e680 24%,#f4f1e600 38%,#0000 76%,#0c1a2288 100%)}
.num{top:30px;font:italic 900 128px/1 PlayfairItalic;color:#17405e;text-shadow:0 1px 0 #fffbf0}
.sub{top:168px;font:italic 400 25px PlayfairItalic;color:#17405e;letter-spacing:.01em}
.credit{color:#f6f1e3;text-shadow:0 1px 3px #000c}.artist{color:#f6f1e3cc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs num">1860</div>
<div class="abs sub">Railways on the Isle of Wight</div>
<div class="credit">Mike Hutton</div><div class="artist">Photochrom, Detroit Publishing Co.<br>Ventnor from the East Cliff, 1890s</div>`
    },
    1882: {
        file: 'File:The Prairie section of the Canadian Pacific railway, showing the land Grant along the prairie line in Manitoba and the northwest territories - btv1b530229663 (1 of 2).jpg',
        crop: { left: 0.2667, right: 0.625, top: 0.2179, aspect: 1.0886 },
        css: `
.cover{background:#efe3c4}
.art{position:absolute;left:18px;right:18px;top:196px;bottom:46px;background:var(--art) center/cover;border:1px solid #6b2b1c;outline:1px solid #6b2b1c;outline-offset:4px}
.num{top:22px;font:400 112px/1 AlfaSlab;color:#7c2618;letter-spacing:.02em}
.name{top:140px;font:500 30px Oswald;letter-spacing:.5em;color:#2d241a;padding-left:.5em}
.credit{color:#4a3a28;left:20px;bottom:16px}.artist{color:#4a3a28;right:18px;bottom:14px}`,
        html: `<div class="art"></div><div class="abs num">1882</div><div class="abs name">ASSINIBOIA</div>
<div class="credit">Marc Voyer</div><div class="artist">American Bank Note Co. map, 1880s<br>The Prairie Section of the Canadian Pacific</div>`
    },
    1894: {
        pdf: {
            url: 'https://raw.githubusercontent.com/Galatolol/1894/999516ef097f13dbbe862a4fe0f24a1dab9db6b9/1894_rules.pdf',
            page: 1
        },
        crop: { left: 0, right: 1, top: 0.15, aspect: 0.99 },
        css: `
.cover{background:#eee6d3}
.rule{left:18px;right:18px;border-top:1px solid #1b1714}
.r1{top:16px}.r2{top:20px;border-top-width:3px}.r3{top:160px;border-top-width:3px}.r4{top:166px}
.num{top:22px;font:900 132px/1 Playfair;font-variant-numeric:lining-nums;color:#a12318;letter-spacing:.01em}
.byline{top:172px;font:600 11px Cinzel;letter-spacing:.42em;color:#1b1714;padding-left:.42em}
.art{position:absolute;left:18px;right:18px;top:194px;bottom:44px;background:var(--art) center/cover;border:1px solid #1b1714;filter:sepia(.35) contrast(1.05)}
.caption{bottom:20px;font:italic 500 13px CormorantItalic;color:#1b1714;letter-spacing:.02em}`,
        html: `<div class="abs rule r1"></div><div class="abs rule r2"></div><div class="abs num">1894</div>
<div class="abs rule r3"></div><div class="abs rule r4"></div><div class="abs byline">Jan Kłos</div>
<div class="art"></div>
<div class="abs caption">The derailment at the gare Montparnasse, 22 October 1895</div>`
    },
    '18chesapeake': {
        file: 'File:George Inness - The Lackawanna Valley - Google Art Project.jpg',
        crop: { left: 0.12, right: 0.626, top: 0 },
        css: `
.scrim{background:linear-gradient(#0000 60%,#16120a88 100%)}
.eighteen,.name,.orn,.sub{left:150px;right:14px}
.eighteen{top:30px;font:400 46px/1 FellCanon;color:#3c3a1c;letter-spacing:.06em}
.name{top:72px;font:400 76px/1 FellItalic;color:#2d2f16;letter-spacing:-.005em;text-shadow:0 1px 0 #fbf1d2}
.orn{top:164px;margin:auto;width:150px;border-top:1px solid #4b442388}
.sub{top:176px;font:400 11px/1.7 Caslon;letter-spacing:.3em;color:#4b4423;padding-left:.3em}
.credit{color:#f6eed6;text-shadow:0 1px 3px #000c}.artist{color:#f6eed6cc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs eighteen">18</div><div class="abs name">Chesapeake</div>
<div class="abs orn"></div><div class="abs sub">THE BIRTH OF<br>AMERICAN RAILROADS</div>
<div class="credit">Scott Petersen</div><div class="artist">after George Inness<br>The Lackawanna Valley, c. 1856</div>`
    },
    '18mex': {
        file: 'File:José María Velasco - The Metlac Ravine - Google Art Project.jpg',
        crop: { left: 0.24, right: 0.729, top: 0 },
        css: `
.scrim{background:linear-gradient(#0000 70%,#0d140d99 100%)}
.name{top:250px;font:400 118px/1 Abril;color:#f4ead2;letter-spacing:.01em;text-shadow:0 2px 0 #7d1d12,0 4px 0 #5c140c,0 8px 20px #0008}
.sub{top:378px;font:600 14px Cinzel;letter-spacing:.36em;color:#f4ead2;padding-left:.36em;text-shadow:0 1px 4px #000c}
.credit{color:#f4ead2;text-shadow:0 1px 3px #000c}.artist{color:#f4ead2cc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs name">18MEX</div>
<div class="abs sub">The Railroads Come to Mexico</div>
<div class="credit">Mark Derrick</div><div class="artist">after José María Velasco<br>Cañada de Metlac, 1893</div>`
    },
    '18usa': {
        file: 'File:After Frances Flora Bond Palmer, Across the Continent - "Westward the Course of Empire Takes its Way", 1868, NGA 66574.jpg',
        crop: { left: 0.33, right: 0.783, top: 0.04 },
        css: `
.scrim{background:linear-gradient(#1a243899 0,#1a243840 22%,#0000 34%,#0000 74%,#1a120a99 100%)}
.name{top:44px;font:400 116px/1 Rye;color:#f3e6c4;text-shadow:0 2px 0 #8a2a17,0 4px 0 #6b1e10,0 8px 18px #0009}
.credit{color:#f3e6c4;text-shadow:0 1px 3px #000c}.artist{color:#f3e6c4cc;text-shadow:0 1px 2px #000c}`,
        html: `<div class="scrim"></div><div class="abs name">18USA</div>
<div class="credit">Shawn Fox · Edward Reece<br>Mark Hendrickson</div><div class="artist">after Frances F. Palmer<br>Across the Continent, 1868</div>`
    }
}

const base = `
*{box-sizing:border-box}
body{margin:0}
.cover{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:var(--art) center/cover}
.scrim{position:absolute;inset:0}
.abs{position:absolute;left:0;right:0;text-align:center}
.credit{position:absolute;left:22px;bottom:18px;font:600 10.5px/1.35 Cinzel;letter-spacing:.14em;text-transform:uppercase}
.artist{position:absolute;right:20px;bottom:18px;font:italic 400 9.5px/1.3 CormorantItalic;letter-spacing:.04em;text-align:right}
`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Fetches a URL, retrying with backoff when Commons rate-limits. */
async function fetchOk(url) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
        if (response.ok) return response
        if (attempt === 4) throw new Error(`${response.status} for ${url}`)
        await sleep(5000 * (attempt + 1))
    }
}

/** Downloads `url` to the cache once and returns the cached path. */
async function cached(name, url) {
    const path = join(cache, name)
    if (!existsSync(path))
        writeFileSync(path, Buffer.from(await (await fetchOk(await url())).arrayBuffer()))
    return path
}

/** A Commons file scaled to at most 3840 pixels wide, or at its original size when `full`. */
function commonsImage(title, full) {
    return async () => {
        const query = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: title,
            prop: 'imageinfo',
            iiprop: 'url',
            ...(full ? {} : { iiurlwidth: '3840' })
        })
        const json = await (
            await fetchOk(`https://commons.wikimedia.org/w/api.php?${query}`)
        ).json()
        const info = Object.values(json.query.pages)[0].imageinfo[0]
        return full ? info.url : (info.thumburl ?? info.url)
    }
}

/** The first image on a page of a PDF, as a PNG. */
async function pdfImage(id, { url, page }) {
    const pdf = await cached(`${id}-source.pdf`, async () => url)
    const prefix = join(cache, `${id}-pdf`)
    execFileSync('pdfimages', ['-png', '-f', `${page}`, '-l', `${page}`, pdf, prefix])
    return `${prefix}-000.png`
}

/**
 * Cuts the cover's window out of its source and returns it as a JPEG data URL. A `retouch` copies
 * a strip of the source (`from`, fractions of the image) over another place (`to`), to paint out a
 * printed label with the texture beside it.
 */
async function art(id, { file, full, pdf, crop, retouch }) {
    const source = pdf
        ? await pdfImage(id, pdf)
        : await cached(`${id}-source`, commonsImage(file, full))
    const [w, h] = execFileSync('identify', ['-format', '%w %h', `${source}[0]`], {
        encoding: 'utf8'
    })
        .split(' ')
        .map(Number)
    const left = Math.round(crop.left * w)
    const top = Math.round(crop.top * h)
    const cropWidth = Math.round((crop.right - crop.left) * w)
    const cropHeight = Math.round(cropWidth / (crop.aspect ?? width / height))
    const patches = (retouch ?? []).flatMap(({ from, to }) => [
        '(',
        '+clone',
        '-crop',
        `${Math.round(from.width * w)}x${Math.round(from.height * h)}+${Math.round(from.left * w) - left}+${Math.round(from.top * h) - top}`,
        '+repage',
        ')',
        '-geometry',
        `+${Math.round(to.left * w) - left}+${Math.round(to.top * h) - top}`,
        '-composite'
    ])
    const jpeg = join(cache, `${id}-crop.jpg`)
    execFileSync('convert', [
        `${source}[0]`,
        '-crop',
        `${cropWidth}x${cropHeight}+${left}+${top}`,
        '+repage',
        ...patches,
        '-resize',
        `${width * 2}x`,
        '-quality',
        '92',
        jpeg
    ])
    return `data:image/jpeg;base64,${readFileSync(jpeg).toString('base64')}`
}

async function fontFaces() {
    const faces = []
    for (const [family, path] of Object.entries(fonts)) {
        const file = await cached(
            path.replaceAll('/', '_'),
            async () =>
                `https://raw.githubusercontent.com/google/fonts/${fontsCommit}/${path.replaceAll('[', '%5B').replaceAll(']', '%5D')}`
        )
        const data = readFileSync(file).toString('base64')
        faces.push(
            `@font-face{font-family:${family};src:url(data:font/ttf;base64,${data});font-weight:100 900}`
        )
    }
    return faces.join('\n')
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(covers)
const unknown = ids.filter((id) => !covers[id])
if (unknown.length)
    throw new Error(`No cover for ${unknown.join(', ')}; known: ${Object.keys(covers).join(', ')}`)

mkdirSync(cache, { recursive: true })
const faces = await fontFaces()
const browser = await chromium.launch()
try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
    for (const id of ids) {
        const cover = covers[id]
        const style = `--art:url(${await art(id, cover)})`
        await page.setContent(
            `<!doctype html><html><head><style>${faces}${base}${cover.css}</style></head>` +
                `<body><div class="cover" style="${style}">${cover.html}</div></body></html>`
        )
        await page.evaluate(() => document.fonts.ready)
        const png = join(cache, `${id}-cover.png`)
        await page.locator('.cover').screenshot({ path: png })
        const webp = join(repo, 'games', `${id}-ui`, 'src/lib/images/cover.webp')
        execFileSync('convert', [png, '-resize', `${outputWidth}x`, '-quality', '84', webp])
        console.log(`wrote ${webp}`)
    }
} finally {
    await browser.close()
}
