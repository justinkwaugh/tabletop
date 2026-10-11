import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const [
    source,
    sharpDir = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../node_modules/.pnpm/sharp@0.34.5/node_modules'
    )
] = process.argv.slice(2)
if (!source) {
    console.error(
        'Usage: node scripts/build-board-art.mjs <source image> [sharp module dir]\n' +
            'Writes the board art used by the UI: a full-detail image and a light one that loads first.'
    )
    process.exit(1)
}
const require = createRequire(sharpDir + '/')
const sharp = require('sharp')
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/images')

for (const [name, width, quality] of [
    ['board', 3400, 80],
    ['board-preview', 1275, 70]
]) {
    const info = await sharp(source, { limitInputPixels: false })
        .resize({ width })
        .webp({ quality, effort: 6 })
        .toFile(join(out, `${name}.webp`))
    console.log(name, info.width, info.height, Math.round(info.size / 1024), 'KB')
}
