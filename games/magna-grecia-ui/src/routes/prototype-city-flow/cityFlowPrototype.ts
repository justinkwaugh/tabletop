// PROTOTYPE, throwaway: city tile animations (found, expand, notch, merge) in three motion styles.
// Not production code. See +page.svelte in this folder.
import {
    ClockwisePointyHexDirections,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { neighborCoords } from '@tabletop/magna-grecia'
import { HEX, hexCenter } from '$lib/utils/boardGeometry.js'
import { cityLayout, type CityHouse } from '$lib/utils/cityLayout.js'

export type Variant = 'A' | 'B' | 'C' | 'D'
export const VARIANT_NAMES: Record<Variant, string> = {
    A: 'Pour',
    B: 'Trace',
    C: 'Stretch',
    D: 'Springy pour'
}

// A city is its spaces, founding tile first.
export type Scenario = {
    name: string
    from: AxialCoordinates[][]
    to: AxialCoordinates[]
    added: AxialCoordinates
}

const O = { q: 3, r: 3 }
const step = (c: AxialCoordinates, i: number) => neighborCoords(c, ClockwisePointyHexDirections[i])
// direction indexes: 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE
const E = 0,
    SE = 1,
    SW = 2,
    W = 3,
    NE = 5

export const SCENARIOS: Scenario[] = [
    { name: 'Found', from: [], to: [O], added: O },
    {
        name: 'Expand',
        from: [[O]],
        to: [O, step(O, E)],
        added: step(O, E)
    },
    {
        name: 'Fill notch',
        from: [[O, step(O, E), step(O, SW)]],
        to: [O, step(O, E), step(O, SW), step(O, SE)],
        added: step(O, SE)
    },
    {
        name: 'Merge',
        from: [
            [O, step(O, SW)],
            [step(step(O, E), E), step(step(step(O, E), E), NE)]
        ],
        to: [O, step(O, SW), step(O, E), step(step(O, E), E), step(step(step(O, E), E), NE)],
        added: step(O, E)
    }
]
void W

const CORNERS: Point[] = [
    { x: HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: HEX.xRadius, y: HEX.yRadius / 2 },
    { x: 0, y: HEX.yRadius },
    { x: -HEX.xRadius, y: HEX.yRadius / 2 },
    { x: -HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: 0, y: -HEX.yRadius }
]

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s })
const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
})
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Point, b: Point) => lerp(a, b, 0.5)
const has = (spaces: AxialCoordinates[], c: AxialCoordinates) =>
    spaces.some((s) => sameCoordinates(s, c))

export type Segment = { from: Point; to: Point }
type MovingPoint = { start: Point; end: Point; lag: number; fixed: boolean }
type RegionEdge = { a: number; b: number; kind: 'outer' | 'shared' | 'seam' }
type Region = { points: MovingPoint[]; edges: RegionEdge[]; centroid: Point }
type HousePlan = { house: CityHouse; kind: 'keep' | 'add' | 'remove'; delay: number }
type TemplePlan = { point: Point; kind: 'keep' | 'add' | 'remove' }

export type Plan = {
    staticTiles: Point[]
    addedCenter: Point
    staticEdges: Segment[]
    sharedEdges: Segment[]
    regions: Region[]
    traceArcs: Point[][]
    houses: HousePlan[]
    temples: TemplePlan[]
    founding: boolean
    merge: boolean
}

function hexEdges(spaces: AxialCoordinates[], skip?: AxialCoordinates): Segment[] {
    return spaces.flatMap((space) => {
        if (skip && sameCoordinates(space, skip)) return []
        const c = hexCenter(space)
        return ClockwisePointyHexDirections.flatMap((_, i) =>
            has(spaces, step(space, i))
                ? []
                : [{ from: add(c, CORNERS[i]), to: add(c, CORNERS[(i + 1) % 6]) }]
        )
    })
}

function nearestOnPolyline(p: Point, line: Point[]): Point {
    let best = line[0]
    let bestD = Infinity
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i]
        const b = line[i + 1]
        const ab = sub(b, a)
        const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y))
        )
        const q = add(a, scale(ab, t))
        const d = dist(p, q)
        if (d < bestD) {
            bestD = d
            best = q
        }
    }
    return best
}

export function makePlan(s: Scenario): Plan {
    const oldSpaces = s.from.flat()
    const C = hexCenter(s.added)
    const P = CORNERS.map((c) => add(C, c))
    // perimeter position: even = corner p/2, odd = midpoint of edge (p-1)/2
    const at = (pos: number): Point => {
        const p = ((pos % 12) + 12) % 12
        return p % 2 === 0 ? P[p / 2] : mid(P[(p - 1) / 2], P[((p - 1) / 2 + 1) % 6])
    }
    const shared = ClockwisePointyHexDirections.map((_, i) => has(oldSpaces, step(s.added, i)))
    const founding = !shared.some(Boolean) || shared.every(Boolean)

    const regions: Region[] = []
    const traceArcs: Point[][] = []

    if (founding) {
        const points = P.map((end) => ({ start: C, end, lag: 0, fixed: false }))
        regions.push({
            points,
            edges: points.map((_, i) => ({ a: i, b: (i + 1) % 6, kind: 'outer' as const })),
            centroid: C
        })
        // trace from the top corner both ways to the bottom corner
        traceArcs.push([10, 0, 2, 4].map(at), [10, 8, 6, 4].map(at))
    } else {
        // groups of consecutive shared edges
        const startEdge = shared.findIndex((v, i) => v && !shared[(i + 5) % 6])
        const groups: { first: number; last: number }[] = []
        for (let k = 0; k < 6; k++) {
            const i = (startEdge + k) % 6
            if (!shared[i]) continue
            const g = groups[groups.length - 1]
            if (g && (g.last + 1) % 6 === i) g.last = i
            else groups.push({ first: i, last: i })
        }
        const n = groups.length
        // free arc after group g: from corner pos 2*(last+1) forward to 2*first of next group
        const arcs = groups.map((g, k) => {
            const next = groups[(k + 1) % n]
            const a = 2 * (g.last + 1)
            let b = 2 * next.first
            while (b <= a) b += 12
            return { a, b, split: (a + b) / 2 }
        })
        for (const arc of arcs) {
            const fwd: Point[] = []
            for (let p = arc.a; p <= arc.split; p++)
                if (p % 2 === 0 || p === arc.split) fwd.push(at(p))
            const back: Point[] = []
            for (let p = arc.b; p >= arc.split; p--)
                if (p % 2 === 0 || p === arc.split) back.push(at(p))
            traceArcs.push(fwd, back)
        }
        groups.forEach((g, k) => {
            const chain: Point[] = []
            let chainEnd = 2 * (g.last + 1)
            while (chainEnd <= 2 * g.first) chainEnd += 12
            for (let p = 2 * g.first; p <= chainEnd; p += 2) chain.push(at(p))
            const isShared = (p: number, q: number) => {
                const edge = Math.floor((((Math.min(p, q) % 12) + 12) % 12) / 2)
                return shared[edge]
            }
            let positions: number[]
            if (n === 1) {
                positions = [0, 2, 4, 6, 8, 10].map((p) => p + 2 * g.first)
            } else {
                const prev = arcs[(k + n - 1) % n]
                let sp = prev.split
                let sn = arcs[k].split
                while (sp > 2 * g.first) sp -= 12
                while (sp <= 2 * g.first - 12) sp += 12
                while (sn <= chainEnd) sn += 12
                while (sn > chainEnd + 12) sn -= 12
                positions = [sp]
                for (let p = Math.floor(sp) + 1; p < sn; p++) if (p % 2 === 0) positions.push(p)
                positions.push(sn)
            }
            const onChain = (p: number) => {
                let q = p
                while (q < 2 * g.first) q += 12
                return q % 1 === 0 && q >= 2 * g.first && q <= chainEnd && q % 2 === 0
            }
            const points: MovingPoint[] = positions.map((p) => {
                const end = at(p)
                const fixed = onChain(p)
                return { start: fixed ? end : nearestOnPolyline(end, chain), end, lag: 0, fixed }
            })
            const edges: RegionEdge[] = []
            for (let i = 0; i < positions.length - 1; i++)
                edges.push({
                    a: i,
                    b: i + 1,
                    kind: isShared(positions[i], positions[i + 1]) ? 'shared' : 'outer'
                })
            if (n === 1) {
                edges.push({
                    a: positions.length - 1,
                    b: 0,
                    kind: isShared(positions[positions.length - 1], positions[0] + 12)
                        ? 'shared'
                        : 'outer'
                })
            } else {
                points.push({ start: nearestOnPolyline(C, chain), end: C, lag: 0, fixed: false })
                edges.push({ a: positions.length - 1, b: positions.length, kind: 'seam' })
                edges.push({ a: positions.length, b: 0, kind: 'seam' })
            }
            const maxD = Math.max(...points.map((pt) => dist(pt.start, pt.end)), 1)
            for (const pt of points) pt.lag = dist(pt.start, pt.end) / maxD
            const centroid = scale(
                points.reduce((acc, pt) => add(acc, pt.end), { x: 0, y: 0 }),
                1 / points.length
            )
            regions.push({ points, edges, centroid })
        })
    }

    const sharedEdges: Segment[] = shared.flatMap((v, i) =>
        v && !founding ? [{ from: P[i], to: P[(i + 1) % 6] }] : []
    )

    // houses and temples
    const toLayout = cityLayout(s.to, s.to[0])
    const fromLayouts = s.from.map((city) => cityLayout(city, city[0]))
    const key = (h: CityHouse) => `${h.center.x.toFixed(2)},${h.center.y.toFixed(2)}`
    const toKeys = new Set(toLayout.houses.map(key))
    const fromHouses = fromLayouts.flatMap((l) => l.houses)
    const fromKeys = new Set(fromHouses.map(key))
    const anchor = toLayout.temple ?? C
    const changing = [
        ...toLayout.houses.filter((h) => !fromKeys.has(key(h))),
        ...fromHouses.filter((h) => !toKeys.has(key(h)))
    ].map((h) => dist(h.center, anchor))
    const minD = changing.length ? Math.min(...changing) : 0
    const maxD = changing.length ? Math.max(...changing) : 1
    const norm = (h: CityHouse) => (dist(h.center, anchor) - minD) / Math.max(maxD - minD, 1)
    const houses: HousePlan[] = [
        ...fromHouses.map((house) => ({
            house,
            kind: toKeys.has(key(house)) ? ('keep' as const) : ('remove' as const),
            delay: norm(house)
        })),
        ...toLayout.houses
            .filter((h) => !fromKeys.has(key(h)))
            .map((house) => ({ house, kind: 'add' as const, delay: norm(house) }))
    ]
    const temples: TemplePlan[] = fromLayouts.flatMap((l) =>
        l.temple
            ? [
                  {
                      point: l.temple,
                      kind:
                          toLayout.temple && dist(l.temple, toLayout.temple) < 0.01
                              ? ('keep' as const)
                              : ('remove' as const)
                  }
              ]
            : []
    )
    if (toLayout.temple && !temples.some((t) => t.kind === 'keep'))
        temples.push({ point: toLayout.temple, kind: 'add' })

    return {
        staticTiles: oldSpaces.map(hexCenter),
        addedCenter: C,
        staticEdges: hexEdges(s.to, s.added),
        sharedEdges,
        regions,
        traceArcs,
        houses,
        temples,
        founding,
        merge: s.from.length > 1
    }
}

// ---- timing ----

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutBack = (t: number, s = 1.7) =>
    1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
const window01 = (t: number, start: number, dur: number) => clamp01((t - start) / dur)

export type Timing = {
    border: number
    lag: number
    bulge: number
    overshoot: boolean
    spring: number
    seamFade: [number, number]
    waveStart: number
    waveSpread: number
    pop: number
    templeRise: [number, number]
    templeSink: [number, number]
    flood: [number, number]
}

export function timing(variant: Variant, plan: Plan): Timing {
    const base = {
        A: { border: 560, lag: 0, bulge: 0.3, overshoot: false },
        B: { border: 420, lag: 0, bulge: 0, overshoot: false },
        C: { border: 420, lag: 0, bulge: 0, overshoot: true },
        D: { border: 500, lag: 0, bulge: 0.22, overshoot: true }
    }[variant]
    const waveStart = variant === 'B' ? 520 : base.border - 120
    return {
        ...base,
        spring: variant === 'D' ? 1.0 : 1.4,
        seamFade: base.overshoot ? [200, 320] : [base.border - 80, base.border + 60],
        waveStart: plan.founding ? waveStart + 220 : waveStart,
        waveSpread: plan.merge ? 520 : 320,
        pop: 220,
        templeRise: [waveStart - 80, waveStart + 300],
        templeSink: [waveStart - 60, waveStart + 220],
        flood: [360, 560]
    }
}

export function totalDuration(t: Timing): number {
    return Math.max(t.waveStart + t.waveSpread + t.pop, t.templeRise[1], t.flood[1]) + 60
}

// ---- frame ----

export type Frame = {
    regionPaths: { d: string; opacity: number }[]
    animatedEdges: { d: string; opacity: number; dash?: string }[]
    sharedEdgeOpacity: number
    houses: { house: CityHouse; scale: number; opacity: number }[]
    temples: { point: Point; rise: number; opacity: number }[]
}

function arcLength(points: Point[]) {
    let len = 0
    for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i])
    return len
}

export function frame(variant: Variant, plan: Plan, tm: Timing, t: number): Frame {
    const regionPaths: Frame['regionPaths'] = []
    const animatedEdges: Frame['animatedEdges'] = []
    let sharedEdgeOpacity = 0

    if (variant === 'B') {
        const u = easeInOut(window01(t, 0, tm.border))
        const flood = easeOutCubic(window01(t, tm.flood[0], tm.flood[1] - tm.flood[0]))
        const hex = CORNERS.map((c) => add(plan.addedCenter, c))
        regionPaths.push({
            d: `M ${hex.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`,
            opacity: flood
        })
        for (const arc of plan.traceArcs) {
            const len = arcLength(arc)
            animatedEdges.push({
                d: `M ${arc.map((p) => `${p.x} ${p.y}`).join(' L ')}`,
                opacity: 1,
                dash: `${len * u} ${len + 1}`
            })
        }
        sharedEdgeOpacity = 1 - flood
    } else {
        for (const region of plan.regions) {
            const progress = region.points.map((pt) => {
                const delay = pt.lag * tm.lag * tm.border
                const local = window01(t, delay, tm.border - delay)
                return tm.overshoot ? easeOutBack(local, tm.spring) : easeOutCubic(local)
            })
            const pos = region.points.map((pt, i) => lerp(pt.start, pt.end, progress[i]))
            const seg = (e: RegionEdge) => {
                const a = pos[e.a]
                const b = pos[e.b]
                if (e.kind === 'shared' || tm.bulge === 0) return { ctrl: mid(a, b), a, b }
                const u = (clamp01(progress[e.a]) + clamp01(progress[e.b])) / 2
                const ea = region.points[e.a].end
                const eb = region.points[e.b].end
                let nrm = { x: -(eb.y - ea.y), y: eb.x - ea.x }
                const nl = Math.hypot(nrm.x, nrm.y) || 1
                nrm = scale(nrm, 1 / nl)
                if (
                    (mid(ea, eb).x - region.centroid.x) * nrm.x +
                        (mid(ea, eb).y - region.centroid.y) * nrm.y <
                    0
                )
                    nrm = scale(nrm, -1)
                const amount =
                    tm.bulge * Math.sin(Math.PI * u) * Math.max(dist(a, b), dist(ea, eb) * u)
                return { ctrl: add(mid(a, b), scale(nrm, amount)), a, b }
            }
            let d = `M ${pos[0].x} ${pos[0].y}`
            for (const e of region.edges) {
                const { ctrl, b } = seg(e)
                d += ` Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`
            }
            regionPaths.push({ d: d + ' Z', opacity: 1 })
            const seamOpacity = 1 - window01(t, tm.seamFade[0], tm.seamFade[1] - tm.seamFade[0])
            for (const e of region.edges) {
                if (e.kind === 'shared') continue
                const { ctrl, a, b } = seg(e)
                animatedEdges.push({
                    d: `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`,
                    opacity: e.kind === 'seam' ? seamOpacity : 1
                })
            }
        }
    }

    const houses = plan.houses.map(({ house, kind, delay }) => {
        if (kind === 'keep') return { house, scale: 1, opacity: 1 }
        const start = tm.waveStart + delay * tm.waveSpread
        if (kind === 'add') {
            const u = window01(t, start, tm.pop)
            return {
                house,
                scale: u === 0 ? 0 : 0.2 + 0.8 * easeOutBack(u, 2.2),
                opacity: clamp01(u * 2.5)
            }
        }
        const u = window01(t, start - 60, tm.pop * 0.7)
        return { house, scale: 1 - 0.25 * u, opacity: 1 - u }
    })
    const temples = plan.temples.map(({ point, kind }) => {
        if (kind === 'keep') return { point, rise: 1, opacity: 1 }
        if (kind === 'add') {
            const u = window01(t, tm.templeRise[0], tm.templeRise[1] - tm.templeRise[0])
            return { point, rise: u === 0 ? 0 : easeOutBack(u, 1.6), opacity: clamp01(u * 3) }
        }
        const u = easeInOut(window01(t, tm.templeSink[0], tm.templeSink[1] - tm.templeSink[0]))
        return { point, rise: 1 - u, opacity: 1 - u }
    })
    return { regionPaths, animatedEdges, sharedEdgeOpacity, houses, temples }
}

export function backgroundSpaces(s: Scenario): AxialCoordinates[] {
    const seen: AxialCoordinates[] = []
    const all = [...s.to, ...s.from.flat()]
    for (const c of all)
        for (let i = -1; i < 6; i++) {
            const n1 = i < 0 ? c : step(c, i)
            for (let j = -1; j < 6; j++) {
                const n2 = j < 0 ? n1 : step(n1, j)
                if (!has(seen, n2)) seen.push(n2)
            }
        }
    return seen
}
