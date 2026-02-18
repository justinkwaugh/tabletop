#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const TARGET_IDS = ['A05', 'A09', 'A27', 'D13']
const GEOMETRY_FILE = path.resolve(
    process.cwd(),
    'src/lib/definitions/boardGeometry.ts'
)
const BASE_PATHS = {
    A05: 'M 178.15 382.26 C 182.98 378.44 197.47 375.17 205.18 379.29 C 227.93 391.47 273.43 444.26 287.15 470.76 C 290.66 477.55 289.57 487.97 286.12 498.54 C 284.66 503.02 276.7 519.41 262.07 525.01 C 256.11 527.29 251.64 526.54 248.87 524.46 C 233.03 512.53 232.87 490.1 219.41 467.88 C 201.13 437.72 194.68 432.71 177.77 408.65 C 174.84 404.5 169.16 389.41 178.15 382.28 Z',
    A09: 'M 314.86 594.22 C 318.78 591.28 324.1 592.35 327.38 594.4 C 334.27 598.73 353.36 617.64 366.45 635.56 C 384.4 660.17 383.26 663.19 385.08 672.38 C 385.62 675.13 386.58 687.3 378.77 692.45 C 369.6 698.48 352.34 684.38 347.49 677.69 C 330.26 653.95 318.77 635.17 314.85 619.8 C 312.56 610.8 309.48 598.21 314.85 594.21 Z',
    A27: 'M 536.21 396.34 C 547.05 394.96 566.57 393.02 579.82 391.61 C 590.88 390.41 597.38 389.41 608.13 390.56 C 612.51 391.02 617.48 393.03 621.82 397.37 C 629.66 405.24 629.34 417.08 629.13 424 C 628.69 439.4 623.99 439.19 624.1 449.68 C 624.22 459.46 631.42 464.15 636.66 480.34 C 637.84 483.98 637.21 493.04 635.66 496.42 C 629.81 509.14 606.41 527.32 595.68 528.24 C 595.68 528.24 588.66 529.3 585.41 527.77 C 582.27 526.3 578.09 522.64 575.25 509.25 C 571.25 490.43 576.94 485.58 573.64 472.69 C 571.36 463.74 568.86 450.82 556.3 447.78 C 538.51 443.49 529.62 424.71 528.56 413.74 C 527.19 399.45 533.83 396.63 536.21 396.33 Z',
    D13: 'M 1604.48 773.58 C 1606.42 769.48 1625.11 769.21 1630.95 766.28 C 1639.23 762.12 1646.84 757.72 1648.77 752.87 C 1650.18 749.32 1646.21 744.66 1644.7 742.34 C 1642.14 738.45 1640.21 737.7 1639.2 734.09 C 1638.89 732.97 1638.91 729.48 1640.61 726.35 S 1644.55 722.32 1647.35 721.49 C 1648.78 721.08 1654.27 720.5 1659.77 721.49 C 1661.71 721.85 1669.75 725.01 1671.98 736.05 C 1673.48 743.45 1674.5 749.97 1675.44 773.57 C 1676.06 788.97 1674.72 797.08 1671.69 811.04 C 1669.73 820.08 1665.44 826.67 1659.36 834.16 C 1652.74 842.3 1646.8 845.05 1633.7 843.96 C 1612.73 842.2 1597.04 840.16 1581.07 831.26 C 1574.97 827.86 1572.61 813.57 1572.21 811.26 C 1571.18 805.07 1571.9 799.09 1573.02 797.22 C 1577.46 789.81 1595.52 795.57 1601.73 792.27 C 1605.21 790.42 1600 783.09 1604.48 773.57 Z'
}

function usage() {
    console.log(`Usage:
  npm run tune:westgroup -- [--dx N] [--dy N] [--sx N] [--sy N] [--anchor-x N] [--anchor-y N] [--write]

Examples:
  npm run tune:westgroup -- --dx 8 --dy -6 --sx 0.98 --sy 0.98
  npm run tune:westgroup -- --dx 8 --dy -6 --sx 0.98 --sy 0.98 --write

Notes:
  - Affects only: ${TARGET_IDS.join(', ')}
  - Always starts from the baked baseline paths in this script (non-compounding)
  - Scaling is around anchor (default: current target bbox center)
  - Supports M/L/C/S/Z path commands
  - Without --write, this is a dry run (preview only)
`)
}

function parseArgs(argv) {
    const opts = {
        dx: 0,
        dy: 0,
        sx: 1,
        sy: 1,
        anchorX: null,
        anchorY: null,
        write: false,
        help: false
    }

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--help' || arg === '-h') {
            opts.help = true
            continue
        }
        if (arg === '--write') {
            opts.write = true
            continue
        }
        if (arg === '--dx') opts.dx = Number(argv[++i])
        else if (arg === '--dy') opts.dy = Number(argv[++i])
        else if (arg === '--sx') opts.sx = Number(argv[++i])
        else if (arg === '--sy') opts.sy = Number(argv[++i])
        else if (arg === '--anchor-x') opts.anchorX = Number(argv[++i])
        else if (arg === '--anchor-y') opts.anchorY = Number(argv[++i])
        else throw new Error(`Unknown arg: ${arg}`)
    }

    const numeric = ['dx', 'dy', 'sx', 'sy', 'anchorX', 'anchorY']
    for (const key of numeric) {
        if (opts[key] !== null && Number.isNaN(opts[key])) {
            throw new Error(`Invalid number for ${key}`)
        }
    }
    return opts
}

function fmt(n) {
    return Number(n.toFixed(2)).toString()
}

function extractPaths(source) {
    const found = new Map()
    for (const id of TARGET_IDS) {
        const re = new RegExp(`(id:\\s*'${id}'\\s*,\\s*path:\\s*')([^']*)(')`)
        const m = source.match(re)
        if (!m) throw new Error(`Could not find path for ${id}`)
        found.set(id, { raw: m[2], re })
    }
    return found
}

function parsePath(pathData) {
    const tokens = pathData.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
    const segments = []
    let i = 0
    let cmd = ''
    while (i < tokens.length) {
        if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++]
        if (cmd === 'M' || cmd === 'L') {
            while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
                const x = Number(tokens[i++])
                const y = Number(tokens[i++])
                segments.push({ cmd, values: [x, y] })
            }
        } else if (cmd === 'C') {
            while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
                const values = [
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++])
                ]
                segments.push({ cmd, values })
            }
        } else if (cmd === 'S') {
            while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
                const values = [
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++]),
                    Number(tokens[i++])
                ]
                segments.push({ cmd, values })
            }
        } else if (cmd === 'Z') {
            segments.push({ cmd, values: [] })
        } else {
            throw new Error(`Unsupported command "${cmd}" in path "${pathData.slice(0, 64)}..."`)
        }
    }
    return segments
}

function serializeSegments(segments) {
    return segments
        .map((seg) => {
            if (seg.cmd === 'Z') return 'Z'
            return `${seg.cmd} ${seg.values.map((v) => fmt(v)).join(' ')}`
        })
        .join(' ')
}

function pointsFromSegments(segments) {
    const points = []
    for (const seg of segments) {
        if (seg.cmd === 'M' || seg.cmd === 'L') {
            points.push([seg.values[0], seg.values[1]])
        } else if (seg.cmd === 'C') {
            points.push(
                [seg.values[0], seg.values[1]],
                [seg.values[2], seg.values[3]],
                [seg.values[4], seg.values[5]]
            )
        } else if (seg.cmd === 'S') {
            points.push(
                [seg.values[0], seg.values[1]],
                [seg.values[2], seg.values[3]]
            )
        }
    }
    return points
}

function bboxOfPoints(points) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of points) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    }
    return { minX, minY, maxX, maxY }
}

function transformSegments(segments, opts) {
    const { dx, dy, sx, sy, anchorX, anchorY } = opts
    const tx = (x) => anchorX + (x - anchorX) * sx + dx
    const ty = (y) => anchorY + (y - anchorY) * sy + dy

    return segments.map((seg) => {
        if (seg.cmd === 'Z') return seg
        if (seg.cmd === 'M' || seg.cmd === 'L') {
            return { ...seg, values: [tx(seg.values[0]), ty(seg.values[1])] }
        }
        if (seg.cmd === 'C') {
            return {
                ...seg,
                values: [
                    tx(seg.values[0]),
                    ty(seg.values[1]),
                    tx(seg.values[2]),
                    ty(seg.values[3]),
                    tx(seg.values[4]),
                    ty(seg.values[5])
                ]
            }
        }
        if (seg.cmd === 'S') {
            return {
                ...seg,
                values: [
                    tx(seg.values[0]),
                    ty(seg.values[1]),
                    tx(seg.values[2]),
                    ty(seg.values[3])
                ]
            }
        }
        throw new Error(`Unexpected segment command: ${seg.cmd}`)
    })
}

function main() {
    const opts = parseArgs(process.argv.slice(2))
    if (opts.help) {
        usage()
        return
    }

    const source = fs.readFileSync(GEOMETRY_FILE, 'utf8')
    const extracted = extractPaths(source)

    const parsed = new Map()
    const allPoints = []
    for (const id of TARGET_IDS) {
        const segs = parsePath(BASE_PATHS[id])
        parsed.set(id, segs)
        allPoints.push(...pointsFromSegments(segs))
    }

    const currentBox = bboxOfPoints(allPoints)
    const defaultAnchorX = (currentBox.minX + currentBox.maxX) / 2
    const defaultAnchorY = (currentBox.minY + currentBox.maxY) / 2
    const anchorX = opts.anchorX ?? defaultAnchorX
    const anchorY = opts.anchorY ?? defaultAnchorY

    const actualOpts = { ...opts, anchorX, anchorY }

    const transformedById = new Map()
    const transformedPoints = []
    for (const id of TARGET_IDS) {
        const transformed = transformSegments(parsed.get(id), actualOpts)
        transformedById.set(id, transformed)
        transformedPoints.push(...pointsFromSegments(transformed))
    }
    const nextBox = bboxOfPoints(transformedPoints)

    console.log(`Target ids: ${TARGET_IDS.join(', ')}`)
    console.log(
        `Anchor: (${fmt(anchorX)}, ${fmt(anchorY)}) | dx=${fmt(opts.dx)} dy=${fmt(opts.dy)} sx=${fmt(opts.sx)} sy=${fmt(opts.sy)}`
    )
    console.log(
        `Before bbox: [${fmt(currentBox.minX)}, ${fmt(currentBox.minY)}] -> [${fmt(currentBox.maxX)}, ${fmt(currentBox.maxY)}]`
    )
    console.log(
        `After  bbox: [${fmt(nextBox.minX)}, ${fmt(nextBox.minY)}] -> [${fmt(nextBox.maxX)}, ${fmt(nextBox.maxY)}]`
    )

    let updated = source
    for (const id of TARGET_IDS) {
        const newPath = serializeSegments(transformedById.get(id))
        console.log(`${id}: ${newPath.slice(0, 120)}...`)
        const { re } = extracted.get(id)
        updated = updated.replace(re, `$1${newPath}$3`)
    }

    if (opts.write) {
        fs.writeFileSync(GEOMETRY_FILE, updated)
        console.log(`Wrote updated paths to ${GEOMETRY_FILE}`)
    } else {
        console.log('Dry run only. Re-run with --write to apply.')
    }
}

try {
    main()
} catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    usage()
    process.exit(1)
}
