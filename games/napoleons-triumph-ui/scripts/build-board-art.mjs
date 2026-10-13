import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const [
    board,
    setupMarks,
    sharpDir = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../node_modules/.pnpm/sharp@0.34.5/node_modules'
    )
] = process.argv.slice(2)
if (!board || !setupMarks) {
    console.error(
        'Usage: node scripts/build-board-art.mjs <board without set-up marks> <set-up marks on transparency> [sharp module dir]\n' +
            'Writes the board art used by the UI: a full-detail image, a light one that loads first,\n' +
            'and the printed set-up marks as a layer of their own, shown only until play begins.'
    )
    process.exit(1)
}
const require = createRequire(sharpDir + '/')
const sharp = require('sharp')
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/images')
const BOARD_ART_WIDTH = 3400

const report = (name, info) =>
    console.log(name, info.width, info.height, Math.round(info.size / 1024), 'KB')

for (const [name, width, quality] of [
    ['board', BOARD_ART_WIDTH, 80],
    ['board-preview', 1275, 70]
]) {
    const info = await sharp(board, { limitInputPixels: false })
        .resize({ width })
        .webp({ quality, effort: 6 })
        .toFile(join(out, `${name}.webp`))
    report(name, info)
}

report(
    'setup-marks',
    await sharp(setupMarks, { limitInputPixels: false })
        .resize({ width: BOARD_ART_WIDTH })
        .webp({ lossless: true, effort: 6 })
        .toFile(join(out, 'setup-marks.webp'))
)
