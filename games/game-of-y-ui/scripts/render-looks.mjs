// Saves the stones, lit pixel by pixel on the /looks page (board/stoneLight.ts), and the board's
// wood (board/woodTexture.ts) as the images in ../src/lib/images/looks the board shows: drawing
// them as a game opens would take seconds. It also writes board/lookUrls.ts, importing each file
// by name. Rerun after changing how a stone is lit or the grain, with the harness running:
//   pnpm run render-looks   (PORT defaults to 5210)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')
const OUT = join(LIB, 'images', 'looks')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://localhost:${process.env.PORT ?? 5210}/looks`, { waitUntil: 'networkidle' })
const drawn = await page.locator('[data-looks]').getAttribute('data-looks', { timeout: 60_000 })
await browser.close()

const looks = Object.entries(JSON.parse(drawn)).toSorted(([a], [b]) => a.localeCompare(b))
mkdirSync(OUT, { recursive: true })
for (const old of readdirSync(OUT)) rmSync(join(OUT, old))
for (const [name, data] of looks) {
    const bytes = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(join(OUT, `${name}.webp`), bytes)
    console.log(name, bytes.length)
}

// Each file imported on its own: Vite and the published bundle's rollup both turn such an import
// into the file's URL, where a glob is Vite's alone and fails in the bundle.
const variable = (name) => name.replace(/-(\w)/g, (_, letter) => letter.toUpperCase())
writeFileSync(
    join(LIB, 'board', 'lookUrls.ts'),
    [
        '// Written by scripts/render-looks.mjs: the file of every look, by name.',
        ...looks.map(([name]) => `import ${variable(name)} from '../images/looks/${name}.webp'`),
        '',
        'export const LOOK_URLS: Record<string, string> = {',
        ...looks.map(
            ([name], index) =>
                `    '${name}': ${variable(name)}${index < looks.length - 1 ? ',' : ''}`
        ),
        '}',
        ''
    ].join('\n')
)
