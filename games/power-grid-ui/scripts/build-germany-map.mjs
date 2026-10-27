// Builds src/lib/maps/germanyArt.ts: Natural Earth geography warped onto the board's city layout.
// Usage: node scripts/build-germany-map.mjs <dir with ne_10m_admin_0_countries, ne_10m_land,
//        ne_10m_lakes and ne_10m_rivers_lake_centerlines geojson>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const geoDir = process.argv[2]
const out = new URL('../src/lib/maps/germanyArt.ts', import.meta.url)

// Board positions (the printed board turned north-up) and real coordinates [lat, lon].
// The board positions come from boardgamers/powergrid (MIT), whose x runs south and y west.
const CITIES = {
    flensburg: [37, 427, 54.78, 9.44, 'teal'],
    kiel: [106, 392, 54.32, 10.14, 'teal'],
    hamburg: [212, 396, 53.55, 9.99, 'teal'],
    hannover: [378, 395, 52.37, 9.73, 'teal'],
    bremen: [276, 463, 53.08, 8.8, 'teal'],
    wilhelmshaven: [211, 521, 53.53, 8.11, 'teal'],
    cuxhaven: [168, 474, 53.87, 8.69, 'teal'],
    luebeck: [153, 341, 53.87, 10.69, 'brown'],
    rostock: [128, 256, 54.09, 12.1, 'brown'],
    schwerin: [217, 297, 53.63, 11.41, 'brown'],
    stralsund: [210, 126, 54.31, 13.09, 'brown'],
    magdeburg: [389, 271, 52.13, 11.63, 'brown'],
    berlin: [355, 170, 52.52, 13.4, 'brown'],
    frankfurt_oder: [381, 99, 52.34, 14.55, 'brown'],
    halle: [493, 259, 51.48, 11.97, 'yellow'],
    leipzig: [526, 222, 51.34, 12.37, 'yellow'],
    dresden: [572, 126, 51.05, 13.74, 'yellow'],
    erfurt: [567, 309, 50.98, 11.03, 'yellow'],
    fulda: [628, 398, 50.55, 9.68, 'yellow'],
    wuerzburg: [735, 386, 49.79, 9.95, 'yellow'],
    nuernberg: [780, 309, 49.45, 11.08, 'yellow'],
    osnabrueck: [359, 516, 52.28, 8.05, 'red'],
    muenster: [427, 554, 51.96, 7.63, 'red'],
    essen: [475, 603, 51.46, 7.01, 'red'],
    duisburg: [456, 645, 51.43, 6.76, 'red'],
    dortmund: [505, 543, 51.51, 7.47, 'red'],
    duesseldorf: [537, 635, 51.23, 6.78, 'red'],
    kassel: [524, 430, 51.31, 9.48, 'red'],
    aachen: [614, 654, 50.78, 6.08, 'blue'],
    koeln: [590, 589, 50.94, 6.96, 'blue'],
    trier: [739, 628, 49.75, 6.64, 'blue'],
    mainz: [697, 514, 50.0, 8.27, 'blue'],
    frankfurt_main: [672, 473, 50.11, 8.68, 'blue'],
    saarbruecken: [818, 568, 49.24, 6.99, 'blue'],
    mannheim: [796, 479, 49.49, 8.47, 'blue'],
    freiburg: [966, 537, 47.99, 7.85, 'purple'],
    stuttgart: [884, 458, 48.78, 9.18, 'purple'],
    konstanz: [1011, 459, 47.66, 9.18, 'purple'],
    augsburg: [911, 346, 48.37, 10.9, 'purple'],
    regensburg: [846, 256, 49.01, 12.1, 'purple'],
    muenchen: [967, 278, 48.14, 11.58, 'purple'],
    passau: [904, 153, 48.57, 13.43, 'purple']
}

// The board stretches east–west by about 16% against north–south.
const SCALE = 1.05
const WIDTH_STRETCH = 1.16
const MARGIN = 60

const ids = Object.keys(CITIES)
const boardRaw = ids.map((id) => {
    const [x, y] = CITIES[id]
    return [(700 - y) * WIDTH_STRETCH * SCALE, x * SCALE]
})
const project = ([lat, lon]) => [lon * Math.cos((51 * Math.PI) / 180) * 100, -lat * 100]
const real = ids.map((id) => project([CITIES[id][2], CITIES[id][3]]))

// ---- Thin-plate spline from real (projected) coordinates to board coordinates ----
function solve(A, b) {
    const n = A.length
    const M = A.map((row, i) => [...row, b[i]])
    for (let c = 0; c < n; c++) {
        let p = c
        for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
        ;[M[c], M[p]] = [M[p], M[c]]
        for (let r = 0; r < n; r++) {
            if (r === c) continue
            const f = M[r][c] / M[c][c]
            for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
        }
    }
    return M.map((row, i) => row[n] / row[i])
}
const U = (r2) => (r2 === 0 ? 0 : r2 * Math.log(r2))
function fitTps(src, dst, lambda) {
    const n = src.length
    const size = n + 3
    const A = Array.from({ length: size }, () => new Array(size).fill(0))
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const dx = src[i][0] - src[j][0]
            const dy = src[i][1] - src[j][1]
            A[i][j] = U(dx * dx + dy * dy) + (i === j ? lambda : 0)
        }
        A[i][n] = 1
        A[i][n + 1] = src[i][0]
        A[i][n + 2] = src[i][1]
        A[n][i] = 1
        A[n + 1][i] = src[i][0]
        A[n + 2][i] = src[i][1]
    }
    const wx = solve(A, [...dst.map((p) => p[0]), 0, 0, 0])
    const wy = solve(A, [...dst.map((p) => p[1]), 0, 0, 0])
    return ([x, y]) => {
        let fx = wx[n] + wx[n + 1] * x + wx[n + 2] * y
        let fy = wy[n] + wy[n + 1] * x + wy[n + 2] * y
        for (let i = 0; i < n; i++) {
            const dx = x - src[i][0]
            const dy = y - src[i][1]
            const u = U(dx * dx + dy * dy)
            fx += wx[i] * u
            fy += wy[i] * u
        }
        return [fx, fy]
    }
}
const warp = fitTps(real, boardRaw, 2000)
const toBoard = ([lon, lat]) => warp(project([lat, lon]))

// ---- Geography ----
const read = (name) => JSON.parse(readFileSync(join(geoDir, `${name}.geojson`), 'utf8'))
const countries = read('ne_10m_admin_0_countries')
const inBox = ([lon, lat]) => lon > 1 && lon < 20 && lat > 45 && lat < 57.5
function rings(geometry) {
    if (geometry.type === 'Polygon') return geometry.coordinates
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
    if (geometry.type === 'LineString') return [geometry.coordinates]
    if (geometry.type === 'MultiLineString') return geometry.coordinates
    return []
}
const germanyFeature = countries.features.find((f) => f.properties.ADM0_A3 === 'DEU')
const germanyRings = rings(germanyFeature.geometry).filter((ring) => ring.length > 30)
const neighbourRings = countries.features
    .filter((f) => f.properties.ADM0_A3 !== 'DEU')
    .flatMap((f) => rings(f.geometry))
    .filter((ring) => ring.some(inBox) && ring.length > 8)
const lakes = read('ne_10m_lakes')
    .features.flatMap((f) => rings(f.geometry))
    .filter((ring) => ring.some(inBox) && ring.length > 20)
const RIVERS = [
    'Rhine',
    'Elbe',
    'Danube',
    'Main',
    'Weser',
    'Oder',
    'Mosel',
    'Neckar',
    'Havel',
    'Saale',
    'Spree',
    'Ems',
    'Fulda',
    'Werra',
    'Isar',
    'Inn',
    'Lech',
    'Neisse'
]
const rivers = read('ne_10m_rivers_lake_centerlines')
    .features.filter((f) => RIVERS.some((name) => (f.properties.name ?? '').includes(name)))
    .flatMap((f) => rings(f.geometry))
    .filter((line) => line.some(inBox))

// ---- Warp and frame ----
const warped = (ring) => ring.map(toBoard)
const germany = germanyRings.map(warped)
const xs = germany.flat().map((p) => p[0])
const ys = germany.flat().map((p) => p[1])
const minX = Math.min(...xs) - MARGIN
const minY = Math.min(...ys) - MARGIN
const width = Math.max(...xs) + MARGIN - minX
const height = Math.max(...ys) + MARGIN - minY
const shift = ([x, y]) => [x - minX, y - minY]
const round = (v) => Math.round(v * 10) / 10

function simplify(points, tolerance) {
    if (points.length < 3) return points
    const keep = [points[0]]
    let last = points[0]
    for (let i = 1; i < points.length - 1; i++) {
        const [x, y] = points[i]
        if (Math.hypot(x - last[0], y - last[1]) >= tolerance) {
            keep.push(points[i])
            last = points[i]
        }
    }
    keep.push(points.at(-1))
    return keep
}
function pathOf(lines, closed, tolerance = 1.2) {
    return lines
        .map((line) => simplify(line.map(shift), tolerance))
        .filter((line) => line.length > 1)
        .map(
            (line) =>
                'M' +
                line.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') +
                (closed ? 'Z' : '')
        )
        .join('')
}
// Far outside the board the warp extrapolates; keep only geography near the frame.
const nearFrame = (ring) =>
    ring.some(
        ([x, y]) =>
            x > minX - 300 && x < minX + width + 300 && y > minY - 300 && y < minY + height + 300
    )

const cities = Object.fromEntries(ids.map((id, i) => [id, shift(boardRaw[i]).map(round)]))

// ---- Regions: Voronoi cells around the cities, clipped later to Germany ----
function clip(poly, a, b, c, source) {
    // keep a*x + b*y <= c
    const result = []
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i]
        const q = poly[(i + 1) % poly.length]
        const fp = a * p.x + b * p.y - c
        const fq = a * q.x + b * q.y - c
        if (fp <= 0) result.push(p)
        if (fp <= 0 !== fq <= 0) {
            const t = fp / (fp - fq)
            result.push({
                x: p.x + t * (q.x - p.x),
                y: p.y + t * (q.y - p.y),
                edge: fp <= 0 ? source : p.edge
            })
        }
        if (fp <= 0 && fq > 0) result.at(-1).edge = source
    }
    return result
}
const regionOf = Object.fromEntries(ids.map((id) => [id, CITIES[id][4]]))
const cells = ids.map((id) => {
    const [px, py] = cities[id]
    let poly = [
        { x: -50, y: -50, edge: -1 },
        { x: width + 50, y: -50, edge: -1 },
        { x: width + 50, y: height + 50, edge: -1 },
        { x: -50, y: height + 50, edge: -1 }
    ]
    ids.forEach((other, j) => {
        if (other === id) return
        const [qx, qy] = cities[other]
        const a = qx - px
        const b = qy - py
        const c = (qx * qx + qy * qy - px * px - py * py) / 2
        poly = clip(poly, a, b, c, j)
    })
    return { id, poly }
})
const regionCells = {}
const borderSegments = []
for (const { id, poly } of cells) {
    const d = 'M' + poly.map((p) => `${round(p.x)} ${round(p.y)}`).join('L') + 'Z'
    ;(regionCells[regionOf[id]] ??= []).push(d)
    poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length]
        const neighbour = ids[p.edge]
        if (p.edge >= 0 && regionOf[neighbour] !== regionOf[id] && id < neighbour) {
            borderSegments.push(`M${round(p.x)} ${round(p.y)}L${round(q.x)} ${round(q.y)}`)
        }
    })
}

const art = {
    width: round(width),
    height: round(height),
    cities,
    land: pathOf(germany, true, 1),
    neighbours: pathOf(neighbourRings.map(warped).filter(nearFrame), true, 2),
    lakes: pathOf(lakes.map(warped).filter(nearFrame), true, 1),
    rivers: pathOf(rivers.map(warped).filter(nearFrame), false, 2),
    regions: Object.fromEntries(
        Object.entries(regionCells).map(([region, ds]) => [region, ds.join('')])
    ),
    regionBorders: borderSegments.join('')
}

writeFileSync(
    out,
    `// Generated by scripts/build-germany-map.mjs from Natural Earth (public domain).\n` +
        `import type { MapArt } from './mapArt.js'\n\n` +
        `export const GERMANY_ART: MapArt = ${JSON.stringify(art, null, 4)}\n`
)
console.log('wrote', out.pathname, art.width, art.height)
