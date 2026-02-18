#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const TARGET_IDS = ['F08', 'F09', 'C37', 'C38', 'C39']
const GEOMETRY_FILE = path.resolve(
    process.cwd(),
    'src/lib/definitions/boardGeometry.ts'
)
const BASE_PATHS = {
    F08: 'M 2008.72 509.9 C 1984.86 515.96 1979.14 516.14 1960.23 549.18 C 1945.31 575.59 1931.17 604.71 1940.02 632.08 C 1940.92 634.59 1947.69 646.58 1962.9 651.86 C 1966.22 653.01 1989.67 654.78 1996.53 649.42 C 2023.82 626.47 1987.55 606.61 1979.84 588.73 C 1976.88 577.79 1982.43 567.22 1983.7 564.78 C 1988.17 547.23 2030.1 556.33 2047.2 552.31 C 2077.69 542.41 2066.11 515.58 2040.33 509.9 C 2028.68 507.48 2016.36 508.48 2008.73 509.9 Z',
    F09: 'M 2316.23 546.89 C 2272.09 539.26 2234.02 577.62 2267.94 613.92 C 2273.78 629.11 2344.39 644.97 2356.53 643.48 C 2376.42 642.6 2402.77 644.97 2400.03 622.05 C 2398.43 614.31 2392.28 612.88 2384.08 604.38 C 2375.02 594.98 2377.23 589.55 2370.67 578.29 C 2359.62 559.31 2335.31 549.22 2316.23 546.88 Z',
    C37: 'M 1883.99 942.69 C 1914.72 943.21 1924.48 953.51 1948.68 972.83 C 2023.83 1031.92 1882.85 1037.82 1854.14 1036.7 C 1820.02 1033.48 1818.87 1024.65 1822.52 1002.98 C 1826.35 988.79 1847.72 942.42 1884 942.69 Z',
    C38: 'M 2034.07 963 C 2054.44 946.43 2067.83 940.29 2092.34 940.15 C 2139.96 941.38 2099.01 993.11 2076.61 1011.6 C 2065.63 1021.84 2022.92 1057.34 2015.72 1024.09 C 2010.49 1005.02 2016.26 975.83 2034.07 963 Z',
    C39: 'M 2138.89 841.24 C 2173.78 827.59 2253.53 825.65 2277.23 854.54 C 2299.13 881.27 2279.76 948.39 2235.25 952.78 C 2204.12 944.07 2208.62 905.61 2136.65 890.82 C 2106.07 878.68 2122.02 849.76 2138.89 841.24 Z'
}

function usage() {
    console.log(`Usage:
  npm run tune:eastgroups -- [--dx N] [--dy N] [--sx N] [--sy N] [--anchor-x N] [--anchor-y N] [--write]

Examples:
  npm run tune:eastgroups -- --dx 8 --dy -6 --sx 0.98 --sy 0.98
  npm run tune:eastgroups -- --dx 8 --dy -6 --sx 0.98 --sy 0.98 --write

Notes:
  - Affects only: ${TARGET_IDS.join(', ')}
  - Always starts from the baked baseline paths in this script (non-compounding)
  - Scaling is around anchor (default: current target bbox center)
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

function parseMCZPath(pathData) {
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
        const segs = parseMCZPath(BASE_PATHS[id])
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
