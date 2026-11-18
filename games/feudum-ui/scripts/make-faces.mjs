// Writes a desk guild button's faces: `node scripts/make-faces.mjs`, from `games/feudum-ui`.
// Each guild's face is cut from its supplied print (`board.guild.<guild>.webp`) round the centre
// `PrintedFaces` names, turned upright as the open side turns the print (`printedFaceTurn`), and
// written beside it as `face.<guild>.webp`: 72 x 72, twice the 36 px circle the button draws, lossy
// WebP. Rendered in Chromium, as the cover is, so the same prints give the same files.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { GuildIds } from '@tabletop/feudum'
import { PrintedFaceRadius, PrintedFaces, printedFaceTurn } from '../src/lib/utils/printedGuilds.ts'

const Root = fileURLToPath(new URL('..', import.meta.url))
const Supplied = join(Root, 'src/lib/art/supplied')
const Size = 72
const Quality = 0.9
/** The panel's local units across, which `PrintedFaces` is measured in (`GuildBox` in boardGeometry). */
const PanelWidth = 500

const browser = await chromium.launch()
const tab = await browser.newPage()

for (const guild of GuildIds) {
    const print = readFileSync(join(Supplied, `board.guild.${guild}.webp`)).toString('base64')
    const encoded = await tab.evaluate(
        async ({ print, centre, radius, turn, panelWidth, size, quality }) => {
            const image = new Image()
            image.src = `data:image/webp;base64,${print}`
            await image.decode()
            // The print's pixels to the panel's local units.
            const unit = image.naturalWidth / panelWidth
            const canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size
            const context = canvas.getContext('2d', { alpha: false })
            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = 'high'
            context.translate(size / 2, size / 2)
            context.rotate((turn * Math.PI) / 180)
            context.scale(size / (2 * radius * unit), size / (2 * radius * unit))
            context.drawImage(image, -centre.x * unit, -centre.y * unit)
            return canvas.toDataURL('image/webp', quality).split(',')[1]
        },
        {
            print,
            centre: PrintedFaces[guild],
            radius: PrintedFaceRadius,
            turn: printedFaceTurn(guild),
            panelWidth: PanelWidth,
            size: Size,
            quality: Quality
        }
    )
    const file = Buffer.from(encoded, 'base64')
    const out = join(Supplied, `face.${guild}.webp`)
    writeFileSync(out, file)
    console.log(`${out}: ${file.length} bytes`)
}
await browser.close()
