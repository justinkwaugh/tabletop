import { TileRadius, type PrintedLine } from '@tabletop/18xx-ui'
import { Map1870, RiverHexes, type RiverHex } from '@tabletop/1870'

type Point = { x: number; y: number }

// The Mississippi alone divides the map under the rules, so it stands out from the rest.
const RiverColor = '#2f78c0'
const SourceWidth = 4.4
const MouthWidth = 7.6
const TributaryColor = '#8dbbe0'
const TributaryWidth = 2

/** A hex corner's angle, the bottom one 0 and going clockwise. */
const cornerAngle = (index: number) => Math.PI / 2 + (index * Math.PI) / 3
const polar = (angle: number, radius: number): Point => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
})
const corner = (index: number) => polar(cornerAngle(index), TileRadius)
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Point, by: number): Point => ({ x: a.x * by, y: a.y * by })
const lengthOf = (a: Point) => Math.hypot(a.x, a.y)
const unit = (a: Point) => scale(a, 1 / (lengthOf(a) || 1))
const sameCorner = (a: Point, b: Point) => lengthOf(minus(a, b)) < 0.01

const riverIds = Object.keys(RiverHexes)

function hexCenters(): Point[] {
    const centers: Point[] = [{ x: 0, y: 0 }]
    for (const [index, id] of riverIds.slice(0, -1).entries()) {
        const edge = ([0, 1, 2, 3, 4, 5] as const).find(
            (candidate) => Map1870.neighbor(id, candidate)?.id === riverIds[index + 1]
        )
        if (edge === undefined) throw new Error(`The river leaves ${id} for no neighbour`)
        const apart = polar(cornerAngle(edge) + Math.PI / 6, Math.sqrt(3) * TileRadius)
        centers.push(add(centers[index], apart))
    }
    return centers
}

function entries(centers: readonly Point[]): number[] {
    const worldCorner = (hex: number, index: number) => add(centers[hex], corner(index))
    return riverIds.map((id, hex) => {
        const { course } = RiverHexes[id]
        const previous = riverIds[hex - 1]
        if (previous) {
            const enter = course.find((index) =>
                RiverHexes[previous].course.some((other) =>
                    sameCorner(worldCorner(hex, index), worldCorner(hex - 1, other))
                )
            )
            if (enter === undefined)
                throw new Error(`The river does not run from ${previous} to ${id}`)
            return enter
        }
        const next = RiverHexes[riverIds[hex + 1]].course
        const exit = course.find((index) =>
            next.some((other) => sameCorner(worldCorner(hex, index), worldCorner(hex + 1, other)))
        )
        return exit === course[0] ? course[1] : course[0]
    })
}

// The two hexes where the river goes the long way round a stop, drawn by hand as a formula's even
// curve looks ruled. St. Louis stays on the Mississippi's west bank, the town on its east.
const LoopsByHand: Readonly<Record<string, readonly Point[]>> = {
    C18: [
        { x: -25, y: -34 },
        { x: 0, y: -38 },
        { x: 24, y: -33 },
        { x: 33, y: -14 },
        { x: 26, y: 8 },
        { x: 31, y: 22 },
        { x: 21, y: 36 }
    ],
    K14: [
        { x: 20, y: -30 },
        { x: -4, y: -24 },
        { x: -24, y: -27 },
        { x: -35, y: -8 },
        { x: -27, y: 10 },
        { x: -31, y: 23 },
        { x: -14, y: 36 }
    ]
}

const wander = (hex: number, step: number) =>
    Math.sin(hex * 2.399 + step * 1.7) * TileRadius * 0.055

const clockwiseTurn = (from: number, to: number) => ((to - from + 6) % 6) * (Math.PI / 3)

function bends({ stopBank, banks, course }: RiverHex, hex: number, enter: number): Point[] {
    const exit = course[0] === enter ? course[1] : course[0]
    const drawn = LoopsByHand[riverIds[hex]]
    if (drawn) return [...drawn]
    if (stopBank === undefined) {
        const a = corner(enter)
        const b = corner(exit)
        const side = unit({ x: b.y - a.y, y: a.x - b.x })
        const across = lengthOf(minus(b, a))
        const towardMiddle = (b.x - a.x) * a.y - (b.y - a.y) * a.x > 0 ? 1 : -1
        const swing =
            across > TileRadius * 1.9
                ? TileRadius * 0.34 * (hex % 2 ? 1 : -1)
                : across < TileRadius * 1.1
                  ? TileRadius * 0.24 * towardMiddle
                  : 0
        return [0.3, 0.5, 0.7].map((along, step) =>
            add(
                add(a, scale(minus(b, a), along)),
                scale(side, wander(hex, step) + swing * Math.sin(along * Math.PI))
            )
        )
    }
    const farBank = banks[stopBank === 0 ? 1 : 0]
    // A bank's edges run clockwise from the corner of the same number.
    const start = course.find((index) => farBank.some((edge) => edge === index)) ?? enter
    const span = farBank.length
    const clockwise = start === enter
    const turn =
        (clockwise ? 1 : -1) * clockwiseTurn(clockwise ? enter : exit, clockwise ? exit : enter)
    const depth = span === 1 ? 0.82 : span === 2 ? 0.76 : span === 3 ? 0.62 : 0.8
    return [0.2, 0.4, 0.6, 0.8].map((along, step) => {
        const radius = 1 - (1 - depth) * Math.sin(along * Math.PI) ** 0.7
        return polar(cornerAngle(enter) + turn * along, TileRadius * radius + wander(hex, step))
    })
}

const SamplesPerCurve = 8

function smoothPath(points: readonly Point[], first: Point, last: Point) {
    const tangents = points.map((point, index) => {
        if (index === 0) return scale(first, lengthOf(minus(points[1], point)))
        if (index === points.length - 1)
            return scale(last, lengthOf(minus(point, points[index - 1])))
        return scale(minus(points[index + 1], points[index - 1]), 0.5)
    })
    const number = (value: number) => value.toFixed(1)
    let d = `M ${number(points[0].x)} ${number(points[0].y)}`
    const samples: Point[] = [points[0]]
    for (let index = 1; index < points.length; index++) {
        const start = points[index - 1]
        const end = points[index]
        const c1 = add(start, scale(tangents[index - 1], 1 / 3))
        const c2 = minus(end, scale(tangents[index], 1 / 3))
        d += ` C ${number(c1.x)} ${number(c1.y)} ${number(c2.x)} ${number(c2.y)} ${number(end.x)} ${number(end.y)}`
        for (let step = 1; step <= SamplesPerCurve; step++) {
            const t = step / SamplesPerCurve
            const u = 1 - t
            samples.push(
                add(
                    add(scale(start, u * u * u), scale(c1, 3 * u * u * t)),
                    add(scale(c2, 3 * u * t * t), scale(end, t * t * t))
                )
            )
        }
    }
    return { d, samples }
}

export type RiverLeg = { locationId: string; points: readonly Point[]; center: Point }

export function riverLegs(): RiverLeg[] {
    const centers = hexCenters()
    const entered = entries(centers)
    return riverIds.map((locationId, hex) => {
        const river = RiverHexes[locationId]
        const enter = entered[hex]
        const exit = river.course[0] === enter ? river.course[1] : river.course[0]
        return {
            locationId,
            center: centers[hex],
            points: [corner(enter), ...bends(river, hex, enter), corner(exit)]
        }
    })
}

function mississippiLines(): Record<string, PrintedLine> {
    const legs = riverLegs()
    const world = (leg: RiverLeg, point: Point) => add(leg.center, point)
    return Object.fromEntries(
        legs.map((leg, index) => {
            const { points } = leg
            const previous = legs[index - 1]
            const next = legs[index + 1]
            const into = previous
                ? minus(world(leg, points[1]), world(previous, previous.points.at(-2) ?? points[0]))
                : minus(points[1], points[0])
            const out = next
                ? minus(world(next, next.points[1]), world(leg, points.at(-2) ?? points[0]))
                : minus(points.at(-1) ?? points[0], points.at(-2) ?? points[0])
            const width =
                SourceWidth + ((MouthWidth - SourceWidth) * index) / Math.max(1, legs.length - 1)
            const { d, samples } = smoothPath(points, unit(into), unit(out))
            return [
                leg.locationId,
                { d, points: samples, color: RiverColor, width: Number(width.toFixed(2)) }
            ]
        })
    )
}

function mapCenter(locationId: string): Point {
    const row = locationId.charCodeAt(0) - 'A'.charCodeAt(0)
    const column = Number(locationId.slice(1))
    return { x: (column * Math.sqrt(3) * TileRadius) / 2, y: row * 1.5 * TileRadius }
}

type TributaryLeg = readonly [locationId: string, points: readonly Point[]]

// The lesser rivers, for the costs printed on their hexes, traced from the published map. Each leg
// lists its points in that hex's coordinates; it starts where the leg before it ended, and each
// river ends on the Mississippi.
const Tributaries: readonly (readonly TributaryLeg[])[] = [
    // The Missouri, north of Kansas City and into the Mississippi above St. Louis.
    [
        [
            'A10',
            [
                { x: -2, y: -50 },
                { x: 10, y: -28 },
                { x: 17, y: -5 },
                { x: 24, y: 16 },
                { x: 30, y: 36 }
            ]
        ],
        [
            'B11',
            [
                { x: 8, y: -40 },
                { x: 30, y: -30 },
                { x: 43.3, y: -8 }
            ]
        ],
        [
            'B13',
            [
                { x: -29, y: 7 },
                { x: -12, y: 23 },
                { x: 10, y: 28 },
                { x: 30, y: 38 }
            ]
        ],
        [
            'C14',
            [
                { x: 6, y: -27 },
                { x: 25, y: -7 },
                { x: 43.3, y: 8 }
            ]
        ],
        [
            'C16',
            [
                { x: -19, y: 19 },
                { x: 9, y: 15 },
                { x: 33, y: -5 },
                { x: 43.3, y: -25 }
            ]
        ]
    ],
    // The Red, from the west edge past Alexandria.
    [
        [
            'G2',
            [
                { x: -43.3, y: 8 },
                { x: -15, y: 19 },
                { x: 8, y: 22 },
                { x: 22, y: 38 }
            ]
        ],
        [
            'H3',
            [
                { x: -3, y: -21 },
                { x: 21, y: -13 },
                { x: 43.3, y: -2 }
            ]
        ],
        [
            'H5',
            [
                { x: -19, y: 15 },
                { x: 12, y: 21 },
                { x: 43.3, y: 22 }
            ]
        ],
        [
            'H7',
            [
                { x: -12, y: 27 },
                { x: 10, y: 22 },
                { x: 22, y: 38 }
            ]
        ],
        [
            'I8',
            [
                { x: 0, y: -24 },
                { x: 23, y: -15 },
                { x: 43.3, y: 8 }
            ]
        ],
        [
            'I10',
            [
                { x: -24, y: 16 },
                { x: -6, y: 17 },
                { x: 12, y: 22 },
                { x: 26, y: 27 },
                { x: 22, y: 38 }
            ]
        ],
        [
            'J11',
            [
                { x: -27, y: -14 },
                { x: -24, y: 8 },
                { x: -30, y: 24 },
                { x: -22, y: 38 }
            ]
        ],
        [
            'K10',
            [
                { x: 31, y: -13 },
                { x: 29, y: 8 },
                { x: 31, y: 22 },
                { x: 33, y: 31 }
            ]
        ],
        [
            'L11',
            [
                { x: 10, y: -41 },
                { x: 28, y: -31 },
                { x: 38, y: -13 },
                { x: 43.3, y: 8 }
            ]
        ],
        [
            'L13',
            [
                { x: -18, y: 17 },
                { x: 3, y: 20 },
                { x: 21, y: 12 }
            ]
        ]
    ],
    // The short branch at E20, between its two towns and in where the river bends.
    [
        [
            'E20',
            [
                { x: 43.3, y: -8 },
                { x: 24, y: -14 },
                { x: 8, y: -15 },
                { x: -1, y: -2 },
                { x: -9, y: 11 },
                { x: -27, y: 19 },
                { x: -43.3, y: 25 }
            ]
        ]
    ]
]

function tributaryLines(): [locationId: string, line: PrintedLine][] {
    return Tributaries.flatMap((legs) => {
        let last: Point | undefined
        const worldLegs = legs.map(([locationId, points]) => {
            const center = mapCenter(locationId)
            const local = last ? [minus(last, center), ...points] : points
            last = add(center, local.at(-1) ?? center)
            return { locationId, center, points: local }
        })
        return worldLegs.map(({ locationId, center, points }, index): [string, PrintedLine] => {
            const previous = worldLegs[index - 1]
            const next = worldLegs[index + 1]
            const start = add(center, points[0])
            const end = add(center, points.at(-1) ?? points[0])
            const into = previous
                ? minus(
                      add(center, points[1]),
                      add(previous.center, previous.points.at(-2) ?? start)
                  )
                : minus(points[1], points[0])
            const out = next
                ? minus(add(next.center, next.points[1]), add(center, points.at(-2) ?? end))
                : minus(points.at(-1) ?? end, points.at(-2) ?? end)
            const { d, samples } = smoothPath(points, unit(into), unit(out))
            return [
                locationId,
                { d, points: samples, color: TributaryColor, width: TributaryWidth }
            ]
        })
    })
}

export function riverLines(): Readonly<Record<string, readonly PrintedLine[]>> {
    const lines: Record<string, PrintedLine[]> = {}
    for (const [locationId, line] of tributaryLines()) (lines[locationId] ??= []).push(line)
    for (const [locationId, line] of Object.entries(mississippiLines()))
        (lines[locationId] ??= []).push(line)
    return lines
}

export const RiverTerrainPositions: Readonly<Record<string, Point>> = {
    A10: { x: -13, y: 26 },
    A16: { x: -18, y: 28 },
    B13: { x: 4, y: -25 },
    C14: { x: -13, y: 13 },
    C16: { x: -8, y: -13 },
    C18: { x: -6, y: 30 },
    E20: { x: 9, y: 30 },
    I10: { x: -14, y: 30 },
    J11: { x: 7, y: 0 },
    J15: { x: -16, y: 0 },
    K10: { x: -6, y: 0 },
    N15: { x: -12, y: 22 }
}
