// Lays out the board's 93 points as the curved Kadon board draws them, and writes the plan to
// ../src/lib/board/pointPlan.ts. Build the logic package first: pnpm run layout-points
// The side points sit evenly along three circular arcs bowing out between the corners; every
// point inside settles where its lines are as near one length as they can be, as on the board,
// whose three pentads shorten the lines round them.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neighborsOf, POINTS, Side, sidesOf, TOP_CORNER } from '@tabletop/game-of-y'

const OUT = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'src',
    'lib',
    'board',
    'pointPlan.ts'
)
// How far each side bows out from the straight line between its corners, as a share of it.
const BULGE = 0.14
// The mean length of a line on the board, in board units.
const SPACING = 60
const ITERATIONS = 8000

const CORNERS = { [TOP_CORNER]: [0, -1], A1: [-Math.sqrt(3) / 2, 0.5], I1: [Math.sqrt(3) / 2, 0.5] }
const SIDE_ENDS = {
    [Side.Left]: [TOP_CORNER, 'A1'],
    [Side.Bottom]: ['A1', 'I1'],
    [Side.Right]: ['I1', TOP_CORNER]
}

function distances(from) {
    const steps = new Map([[from, 0]])
    const queue = [from]
    for (let point = queue.shift(); point !== undefined; point = queue.shift()) {
        for (const next of neighborsOf(point)) {
            if (!steps.has(next)) {
                steps.set(next, steps.get(point) + 1)
                queue.push(next)
            }
        }
    }
    return steps
}

function arcPoint([ax, ay], [bx, by], t) {
    const [mx, my] = [(ax + bx) / 2, (ay + by) / 2]
    const [dx, dy] = [bx - ax, by - ay]
    const chord = Math.hypot(dx, dy)
    let [nx, ny] = [-dy / chord, dx / chord]
    if (nx * mx + ny * my < 0) [nx, ny] = [-nx, -ny]
    const sagitta = BULGE * chord
    const radius = (sagitta ** 2 + (chord / 2) ** 2) / (2 * sagitta)
    const [cx, cy] = [mx - nx * (radius - sagitta), my - ny * (radius - sagitta)]
    const from = Math.atan2(ay - cy, ax - cx)
    let sweep = Math.atan2(by - cy, bx - cx) - from
    while (sweep > Math.PI) sweep -= 2 * Math.PI
    while (sweep < -Math.PI) sweep += 2 * Math.PI
    return [cx + radius * Math.cos(from + sweep * t), cy + radius * Math.sin(from + sweep * t)]
}

const fromCorner = Object.fromEntries(
    Object.keys(CORNERS).map((corner) => [corner, distances(corner)])
)
const fixed = new Map()
for (const point of POINTS) {
    const side = sidesOf(point)[0]
    if (side === undefined) continue
    const [start, end] = SIDE_ENDS[side]
    const along = fromCorner[start].get(point)
    fixed.set(
        point,
        arcPoint(CORNERS[start], CORNERS[end], along / (along + fromCorner[end].get(point)))
    )
}

const at = new Map(POINTS.map((point) => [point, fixed.get(point) ?? [0, 0]]))
// Each inside point first at the middle of its neighbours, so the lines start untangled.
for (let step = 0; step < 2000; step++) {
    for (const point of POINTS) {
        if (fixed.has(point)) continue
        const around = neighborsOf(point).map((other) => at.get(other))
        at.set(
            point,
            [0, 1].map((axis) => around.reduce((sum, p) => sum + p[axis], 0) / around.length)
        )
    }
}
const lines = POINTS.flatMap((point) =>
    neighborsOf(point)
        .filter((other) => POINTS.indexOf(other) > POINTS.indexOf(point))
        .map((other) => [point, other])
)
const length = ([a, b]) => Math.hypot(at.get(a)[0] - at.get(b)[0], at.get(a)[1] - at.get(b)[1])
for (let step = 0; step < ITERATIONS; step++) {
    const mean = lines.reduce((sum, line) => sum + length(line), 0) / lines.length
    const push = new Map(POINTS.map((point) => [point, [0, 0]]))
    for (const line of lines) {
        const [a, b] = line
        // Pulled by the square of its stretch, so the shortest lines give way least.
        const d = length(line)
        const k = (0.5 * Math.sign(d - mean) * ((d - mean) / mean) ** 2 * mean) / d
        const [dx, dy] = [at.get(b)[0] - at.get(a)[0], at.get(b)[1] - at.get(a)[1]]
        push.get(a)[0] += dx * k
        push.get(a)[1] += dy * k
        push.get(b)[0] -= dx * k
        push.get(b)[1] -= dy * k
    }
    for (const point of POINTS) {
        if (fixed.has(point)) continue
        const [x, y] = at.get(point)
        at.set(point, [x + 0.1 * push.get(point)[0], y + 0.1 * push.get(point)[1]])
    }
}

const mean = lines.reduce((sum, line) => sum + length(line), 0) / lines.length
const scale = SPACING / mean
const shortest = Math.min(...lines.map(length)) * scale
const round = (value) => Math.round(value * scale * 100) / 100
writeFileSync(
    OUT,
    [
        '// Written by scripts/layout-points.mjs: where each point lies on the board, seen from',
        `// straight above, in board units. The shortest line is ${shortest.toFixed(2)} long.`,
        'export const POINT_PLAN: Readonly<Record<string, { x: number; y: number }>> = {',
        ...POINTS.map((point) => {
            const [x, y] = at.get(point)
            return `    ${point}: { x: ${round(x)}, y: ${round(y)} },`
        }),
        '}',
        '',
        `export const SHORTEST_LINE = ${shortest.toFixed(2)}`,
        ''
    ].join('\n')
)
console.log(
    `shortest line ${shortest.toFixed(2)}, longest ${(Math.max(...lines.map(length)) * scale).toFixed(2)}`
)
