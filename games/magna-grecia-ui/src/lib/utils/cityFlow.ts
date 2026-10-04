import {
    ClockwisePointyHexDirections,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { neighborCoords, type HydratedBoard } from '@tabletop/magna-grecia'
import { HEX, hexCenter } from './boardGeometry.js'
import { cityLayout, type CityHouse } from './cityLayout.js'

// A city tile pours out of the edges it shares with the player's city (or cities, when it merges
// them) and settles into its hex; a founding tile spreads from its centre. Houses then ripple out
// from the temple, and a merged city's temple sinks away.

export enum CityFlowMode {
    // Action playback: the full pour with a springy settle and the house ripple.
    Action = 'action',
    // Undo and history steps: the same shapes in at most 200ms.
    Fast = 'fast'
}

type CitySpaces = { id: string; spaces: AxialCoordinates[] }

type Segment = { from: Point; to: Point }
type MovingPoint = { start: Point; end: Point }
type RegionEdge = { a: number; b: number; kind: 'outer' | 'shared' | 'seam' }
type Region = { points: MovingPoint[]; edges: RegionEdge[]; centroid: Point }
type HouseStep = { house: CityHouse; kind: 'keep' | 'add' | 'remove'; wave: number }
type TempleStep = { point: Point; kind: 'keep' | 'add' | 'remove' }

export type CityFlowPlan = {
    playerId: string
    // Cities on the board being animated from, drawn by the flow instead while it plays.
    hiddenCityIds: string[]
    // When true the flow plays backwards, from the larger city back to the smaller ones.
    reversed: boolean
    staticTiles: Point[]
    staticEdges: Segment[]
    regions: Region[]
    houses: HouseStep[]
    temples: TempleStep[]
    founding: boolean
    merge: boolean
}

export type CityFlowFrame = {
    regionPaths: string[]
    edges: { d: string; opacity: number }[]
    houses: { scale: number; opacity: number }[]
    temples: { rise: number; opacity: number }[]
}

// Corner i and i + 1 bound the edge facing ClockwisePointyHexDirections[i], as in cityLayout.
const CORNERS: Point[] = [
    { x: HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: HEX.xRadius, y: HEX.yRadius / 2 },
    { x: 0, y: HEX.yRadius },
    { x: -HEX.xRadius, y: HEX.yRadius / 2 },
    { x: -HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: 0, y: -HEX.yRadius }
]

export function cityFlowPlan(from: HydratedBoard, to: HydratedBoard): CityFlowPlan | undefined {
    const fromSpaces = from.cities.flatMap((city) => city.spaces)
    const toSpaces = to.cities.flatMap((city) => city.spaces)
    const added = toSpaces.filter((space) => !includes(fromSpaces, space))
    const removed = fromSpaces.filter((space) => !includes(toSpaces, space))
    if (added.length === 1 && removed.length === 0) {
        const grown = growth(from.cities, to.cities, added[0])
        return (
            grown && {
                ...grown,
                hiddenCityIds: grown.parts.map((part) => part.id),
                reversed: false
            }
        )
    }
    if (removed.length === 1 && added.length === 0) {
        const grown = growth(to.cities, from.cities, removed[0])
        return grown && { ...grown, hiddenCityIds: [grown.whole.id], reversed: true }
    }
    return undefined
}

function growth(
    smaller: readonly (CitySpaces & { playerId: string })[],
    larger: readonly (CitySpaces & { playerId: string })[],
    tile: AxialCoordinates
) {
    const whole = larger.find((city) => includes(city.spaces, tile))
    if (!whole) {
        return undefined
    }
    const parts = smaller.filter(
        (city) =>
            city.playerId === whole.playerId &&
            city.spaces.every((space) => includes(whole.spaces, space))
    )
    if (parts.reduce((count, part) => count + part.spaces.length, 0) + 1 !== whole.spaces.length) {
        return undefined
    }
    return { ...buildPlan(parts, whole, tile), playerId: whole.playerId, whole, parts }
}

function buildPlan(parts: CitySpaces[], whole: CitySpaces, tile: AxialCoordinates) {
    const partSpaces = parts.flatMap((part) => part.spaces)
    const center = hexCenter(tile)
    const corners = CORNERS.map((corner) => add(center, corner))
    // Perimeter positions in half edges: even is corner p / 2, odd the middle of edge (p - 1) / 2.
    const at = (position: number): Point => {
        const p = mod(position, 12)
        return p % 2 === 0
            ? corners[p / 2]
            : midpoint(corners[(p - 1) / 2], corners[((p - 1) / 2 + 1) % 6])
    }
    const shared = ClockwisePointyHexDirections.map((direction) =>
        includes(partSpaces, neighborCoords(tile, direction))
    )
    const founding = !shared.includes(true) || !shared.includes(false)
    const regions = founding ? [foundingRegion(center, corners)] : pourRegions(shared, center, at)

    const toLayout = cityLayout(whole.spaces, whole.spaces[0])
    const fromLayouts = parts.map((part) => cityLayout(part.spaces, part.spaces[0]))
    const fromHouses = fromLayouts.flatMap((layout) => layout.houses)
    const toKeys = new Set(toLayout.houses.map(houseKey))
    const fromKeys = new Set(fromHouses.map(houseKey))
    const newHouses = toLayout.houses.filter((house) => !fromKeys.has(houseKey(house)))
    const anchor = toLayout.temple ?? center
    const changing = [...newHouses, ...fromHouses.filter((house) => !toKeys.has(houseKey(house)))]
    const reach = changing.map((house) => distance(house.center, anchor))
    const nearest = Math.min(...reach)
    const span = Math.max(Math.max(...reach) - nearest, 1)
    const wave = (house: CityHouse) => (distance(house.center, anchor) - nearest) / span

    const temples: TempleStep[] = fromLayouts.flatMap((layout) =>
        layout.temple
            ? [
                  {
                      point: layout.temple,
                      kind:
                          toLayout.temple && distance(layout.temple, toLayout.temple) < 0.01
                              ? ('keep' as const)
                              : ('remove' as const)
                  }
              ]
            : []
    )
    if (toLayout.temple && !temples.some((temple) => temple.kind === 'keep')) {
        temples.push({ point: toLayout.temple, kind: 'add' })
    }

    return {
        staticTiles: partSpaces.map(hexCenter),
        staticEdges: outerEdges(whole.spaces, tile),
        regions,
        houses: [
            ...fromHouses.map((house) => ({
                house,
                kind: toKeys.has(houseKey(house)) ? ('keep' as const) : ('remove' as const),
                wave: wave(house)
            })),
            ...newHouses.map((house) => ({ house, kind: 'add' as const, wave: wave(house) }))
        ],
        temples,
        founding,
        merge: parts.length > 1
    }
}

function foundingRegion(center: Point, corners: Point[]): Region {
    return {
        points: corners.map((end) => ({ start: center, end })),
        edges: corners.map((_, i) => ({ a: i, b: (i + 1) % 6, kind: 'outer' as const })),
        centroid: center
    }
}

// Each run of shared edges pours its own lobe. With several runs (a merge) the lobes split the hex
// between them along seams through its centre and meet there.
function pourRegions(shared: boolean[], center: Point, at: (position: number) => Point): Region[] {
    const firstEdge = shared.findIndex((isShared, i) => isShared && !shared[(i + 5) % 6])
    const runs: { first: number; last: number }[] = []
    for (let k = 0; k < 6; k++) {
        const edge = (firstEdge + k) % 6
        if (!shared[edge]) continue
        const run = runs[runs.length - 1]
        if (run && (run.last + 1) % 6 === edge) run.last = edge
        else runs.push({ first: edge, last: edge })
    }
    // The open stretch after each run ends halfway to the next run.
    const splits = runs.map((run, k) => {
        const from = 2 * (run.last + 1)
        let to = 2 * runs[(k + 1) % runs.length].first
        while (to <= from) to += 12
        return (from + to) / 2
    })
    const isSharedBetween = (p: number, q: number) =>
        shared[Math.floor(mod(Math.min(p, q), 12) / 2)]

    return runs.map((run, k) => {
        const start = 2 * run.first
        let end = 2 * (run.last + 1)
        while (end <= start) end += 12
        const chain: Point[] = []
        for (let p = start; p <= end; p += 2) chain.push(at(p))

        let positions: number[]
        if (runs.length === 1) {
            positions = [0, 2, 4, 6, 8, 10].map((p) => p + start)
        } else {
            let before = splits[(k + runs.length - 1) % runs.length]
            let after = splits[k]
            while (before > start) before -= 12
            while (before <= start - 12) before += 12
            while (after <= end) after += 12
            while (after > end + 12) after -= 12
            positions = [before]
            for (let p = Math.floor(before) + 1; p < after; p++) if (p % 2 === 0) positions.push(p)
            positions.push(after)
        }
        const onChain = (p: number) => {
            let q = p
            while (q < start) q += 12
            return q % 2 === 0 && q <= end
        }
        const points: MovingPoint[] = positions.map((p) => {
            const end = at(p)
            return { start: onChain(p) ? end : nearestOn(chain, end), end }
        })
        const edges: RegionEdge[] = positions.slice(1).map((p, i) => ({
            a: i,
            b: i + 1,
            kind: isSharedBetween(positions[i], p) ? 'shared' : 'outer'
        }))
        const last = positions.length - 1
        if (runs.length === 1) {
            edges.push({
                a: last,
                b: 0,
                kind: isSharedBetween(positions[last], positions[0] + 12) ? 'shared' : 'outer'
            })
        } else {
            points.push({ start: nearestOn(chain, center), end: center })
            edges.push({ a: last, b: last + 1, kind: 'seam' }, { a: last + 1, b: 0, kind: 'seam' })
        }
        const centroid = scale(
            points.reduce((sum, point) => add(sum, point.end), { x: 0, y: 0 }),
            1 / points.length
        )
        return { points, edges, centroid }
    })
}

function outerEdges(spaces: AxialCoordinates[], skip: AxialCoordinates): Segment[] {
    return spaces.flatMap((space) => {
        if (sameCoordinates(space, skip)) {
            return []
        }
        const center = hexCenter(space)
        return ClockwisePointyHexDirections.flatMap((direction, i) =>
            includes(spaces, neighborCoords(space, direction))
                ? []
                : [{ from: add(center, CORNERS[i]), to: add(center, CORNERS[(i + 1) % 6]) }]
        )
    })
}

// ---- timing ----

type Timing = {
    border: number
    spring: number
    bulge: number
    seamFade: [number, number]
    waveStart: number
    waveSpread: number
    pop: number
    templeRise: [number, number]
    templeSink: [number, number]
}

function timing(plan: CityFlowPlan, mode: CityFlowMode): Timing {
    if (mode === CityFlowMode.Fast) {
        return {
            border: 150,
            spring: 0,
            bulge: 0.15,
            seamFade: [110, 150],
            waveStart: 90,
            waveSpread: 0,
            pop: 100,
            templeRise: [70, 190],
            templeSink: [40, 150]
        }
    }
    const waveStart = 380
    return {
        border: 500,
        spring: 1,
        bulge: 0.22,
        seamFade: [200, 320],
        waveStart: plan.founding ? waveStart + 220 : waveStart,
        waveSpread: plan.merge ? 520 : 320,
        pop: 220,
        templeRise: [waveStart - 80, waveStart + 300],
        templeSink: [waveStart - 60, waveStart + 220]
    }
}

// Milliseconds the flow takes in the given mode.
export function cityFlowDuration(plan: CityFlowPlan, mode: CityFlowMode): number {
    const t = timing(plan, mode)
    return Math.max(t.border, t.waveStart + t.waveSpread + t.pop, t.templeRise[1], t.templeSink[1])
}

// The picture at `elapsed` milliseconds into the flow, played backwards for a reversed plan.
export function cityFlowFrame(
    plan: CityFlowPlan,
    mode: CityFlowMode,
    elapsed: number
): CityFlowFrame {
    const tm = timing(plan, mode)
    const t = plan.reversed ? cityFlowDuration(plan, mode) - elapsed : elapsed
    const regionPaths: string[] = []
    const edges: CityFlowFrame['edges'] = []
    const seamOpacity = 1 - progress(t, tm.seamFade[0], tm.seamFade[1] - tm.seamFade[0])

    for (const region of plan.regions) {
        const moved = region.points.map(() => {
            const local = progress(t, 0, tm.border)
            return tm.spring > 0 ? easeOutBack(local, tm.spring) : easeOutCubic(local)
        })
        const positions = region.points.map((point, i) => lerp(point.start, point.end, moved[i]))
        const curve = (edge: RegionEdge) => {
            const a = positions[edge.a]
            const b = positions[edge.b]
            if (edge.kind === 'shared') {
                return { a, b, control: midpoint(a, b) }
            }
            const settled = (clamp(moved[edge.a]) + clamp(moved[edge.b])) / 2
            const endA = region.points[edge.a].end
            const endB = region.points[edge.b].end
            let normal = unit({ x: -(endB.y - endA.y), y: endB.x - endA.x })
            const middle = midpoint(endA, endB)
            if (dot(sub(middle, region.centroid), normal) < 0) {
                normal = scale(normal, -1)
            }
            const swell =
                tm.bulge *
                Math.sin(Math.PI * settled) *
                Math.max(distance(a, b), distance(endA, endB) * settled)
            return { a, b, control: add(midpoint(a, b), scale(normal, swell)) }
        }
        let d = `M ${positions[0].x} ${positions[0].y}`
        for (const edge of region.edges) {
            const { b, control } = curve(edge)
            d += ` Q ${control.x} ${control.y} ${b.x} ${b.y}`
        }
        regionPaths.push(`${d} Z`)
        for (const edge of region.edges) {
            if (edge.kind === 'shared') continue
            const { a, b, control } = curve(edge)
            edges.push({
                d: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`,
                opacity: edge.kind === 'seam' ? seamOpacity : 1
            })
        }
    }

    const houses = plan.houses.map(({ kind, wave }) => {
        if (kind === 'keep') {
            return { scale: 1, opacity: 1 }
        }
        const start = tm.waveStart + wave * tm.waveSpread
        if (kind === 'add') {
            const u = progress(t, start, tm.pop)
            return {
                scale: u === 0 ? 0 : 0.2 + 0.8 * easeOutBack(u, 2.2),
                opacity: clamp(u * 2.5)
            }
        }
        const u = progress(t, start - 60, tm.pop * 0.7)
        return { scale: 1 - 0.25 * u, opacity: 1 - u }
    })
    const temples = plan.temples.map(({ kind }) => {
        if (kind === 'keep') {
            return { rise: 1, opacity: 1 }
        }
        if (kind === 'add') {
            const u = progress(t, tm.templeRise[0], tm.templeRise[1] - tm.templeRise[0])
            return { rise: u === 0 ? 0 : easeOutBack(u, 1.6), opacity: clamp(u * 3) }
        }
        const u = easeInOut(progress(t, tm.templeSink[0], tm.templeSink[1] - tm.templeSink[0]))
        return { rise: 1 - u, opacity: 1 - u }
    })
    return { regionPaths, edges, houses, temples }
}

// ---- geometry helpers ----

function includes(spaces: readonly AxialCoordinates[], coords: AxialCoordinates): boolean {
    return spaces.some((space) => sameCoordinates(space, coords))
}

function houseKey(house: CityHouse): string {
    return `${house.center.x.toFixed(2)},${house.center.y.toFixed(2)}`
}

function nearestOn(line: Point[], point: Point): Point {
    let best = line[0]
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i]
        const ab = sub(line[i + 1], a)
        const along = clamp(dot(sub(point, a), ab) / dot(ab, ab))
        const candidate = add(a, scale(ab, along))
        if (distance(point, candidate) < distance(point, best)) best = candidate
    }
    return best
}

const mod = (value: number, n: number) => ((value % n) + n) % n
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s })
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const unit = (a: Point): Point => scale(a, 1 / (Math.hypot(a.x, a.y) || 1))
const lerp = (a: Point, b: Point, t: number): Point => add(a, scale(sub(b, a), t))
const midpoint = (a: Point, b: Point) => lerp(a, b, 0.5)
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const progress = (t: number, start: number, duration: number) =>
    duration <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / duration)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutBack = (t: number, s: number) =>
    1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
