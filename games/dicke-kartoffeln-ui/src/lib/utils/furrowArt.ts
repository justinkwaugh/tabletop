import { getPrng, type Point, type RandomFunction } from '@tabletop/common'

export const FURROW_CARD_WIDTH = 100
export const ART_INSET = 4.5

export type Ridge = { ink: string[]; highlight: string; trough: string; width: number }
export type Dot = Point & { r: number }
export type Blob = { path: string }
export type Tuft = { wash: Point & { rx: number; ry: number }; blades: string[] }
export type Flower = Point & { petals: Dot[]; colour: string }

export type FurrowArt = {
    ridges: Ridge[]
    ticks: string[]
    stipple: Dot[]
    clods: Blob[]
    pebbles: Blob[]
    tufts: Tuft[]
    flowers: Flower[]
}

const RIDGES = 6

function between(random: RandomFunction, min: number, max: number): number {
    return min + random() * (max - min)
}

function point(p: Point): string {
    return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
}

// A Catmull-Rom curve through the points, as cubic Béziers.
function smooth(points: readonly Point[]): string {
    const parts = [`M${point(points[0])}`]
    for (let index = 0; index < points.length - 1; index++) {
        const before = points[Math.max(0, index - 1)]
        const from = points[index]
        const to = points[index + 1]
        const after = points[Math.min(points.length - 1, index + 2)]
        const c1 = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 }
        const c2 = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 }
        parts.push(`C${point(c1)} ${point(c2)} ${point(to)}`)
    }
    return parts.join(' ')
}

function blob(random: RandomFunction, centre: Point, radius: number, squash = 0.75): Blob {
    const corners = 7
    const points = Array.from({ length: corners }, (_, index) => {
        const angle = (index / corners) * Math.PI * 2
        const reach = radius * between(random, 0.7, 1.15)
        return {
            x: centre.x + Math.cos(angle) * reach,
            y: centre.y + Math.sin(angle) * reach * squash
        }
    })
    return { path: `${smooth([...points, points[0], points[1]])} Z` }
}

function ridgeLine(random: RandomFunction, y: number, left: number, right: number): Point[] {
    const steps = 9
    const lean = between(random, -2, 2)
    const bow = between(random, -4, 4)
    const phase = between(random, 0, Math.PI * 2)
    return Array.from({ length: steps + 1 }, (_, index) => {
        const t = index / steps
        return {
            x: left + t * (right - left) + between(random, -0.8, 0.8),
            y:
                y +
                lean * (t - 0.5) * 2 +
                bow * ((t - 0.5) ** 2 * 4 - 1) * 0.5 +
                Math.sin(phase + t * 3.5) * 1.4 +
                between(random, -0.5, 0.5)
        }
    })
}

function shifted(points: readonly Point[], dy: number): Point[] {
    return points.map((p) => ({ x: p.x, y: p.y + dy }))
}

// A pen lifts now and then: each ridge is inked in two or three strokes with small gaps.
function strokes(random: RandomFunction, points: readonly Point[]): string[] {
    const breaks = random() < 0.5 ? [4] : [3, 6]
    const pieces: Point[][] = []
    let start = 0
    for (const at of [...breaks, points.length - 1]) {
        pieces.push(points.slice(start, at + 1))
        start = at + (random() < 0.6 ? 1 : 0)
    }
    return pieces.filter((piece) => piece.length > 1).map(smooth)
}

export function furrowArt(seed: number, height: number): FurrowArt {
    const random = getPrng(seed * 7919 + 17)
    const left = ART_INSET + 3
    const right = FURROW_CARD_WIDTH - ART_INSET - 3
    const top = ART_INSET + 4
    const bottom = height - ART_INSET - 6
    const spacing = (bottom - top) / (RIDGES - 1)

    const lines = Array.from({ length: RIDGES }, (_, index) =>
        ridgeLine(random, top + index * spacing, left, right)
    )
    const ridges = lines.map((line) => {
        const trough = [...shifted(line, -spacing * 0.55), ...line.toReversed()]
        return {
            ink: strokes(random, line),
            highlight: smooth(shifted(line, 1.3)),
            trough: `${smooth(trough)} Z`,
            width: between(random, 1.1, 1.6)
        }
    })

    // Short pen ticks shading the furrow troughs, as the board shades its hedges and grass.
    const ticks = lines.slice(1).flatMap((line) =>
        Array.from({ length: 4 }, () => {
            const at = line[1 + Math.floor(random() * (line.length - 2))]
            const x = at.x + between(random, -2, 2)
            const y = at.y - between(random, 1.2, spacing * 0.45)
            return `M${x.toFixed(2)} ${y.toFixed(2)} l${between(random, 0.8, 1.6).toFixed(2)} ${(-between(random, 1.2, 2)).toFixed(2)}`
        })
    )

    const stipple = Array.from({ length: 90 }, () => {
        const row = Math.floor(random() * RIDGES)
        return {
            x: between(random, left, right),
            y: top + row * spacing - between(random, 0.6, spacing * 0.6),
            r: between(random, 0.25, 0.6)
        }
    }).filter((dot) => dot.y > ART_INSET + 1.5)

    const clods = Array.from({ length: 5 }, () =>
        blob(
            random,
            { x: between(random, left + 4, right - 4), y: between(random, top + 2, bottom - 2) },
            between(random, 1.4, 2.4)
        )
    )

    const pebbles = Array.from({ length: 3 }, () =>
        blob(
            random,
            { x: between(random, left + 6, right - 6), y: between(random, top + 4, bottom - 4) },
            between(random, 0.9, 1.4),
            0.65
        )
    )

    const corners: Point[] = [
        { x: left + 3, y: bottom + 1 },
        { x: right - 3, y: top + 5 },
        { x: right - 4, y: bottom + 1 },
        { x: left + 2, y: top + spacing * 2 }
    ]
    const first = Math.floor(random() * corners.length)
    const tuftCorners = [corners[first], ...corners.filter((_, index) => index !== first)]
        .filter((_, index) => index === 0 || random() < 0.4)
        .slice(0, 2)
    const tufts = tuftCorners.map((base) => ({
        wash: { x: base.x, y: base.y - 1.2, rx: between(random, 4, 6), ry: 2.2 },
        blades: Array.from({ length: 6 }, (_, index) => {
            const lean = (index - 2.5) * between(random, 0.7, 1.1)
            const tall = between(random, 3.5, 5.5)
            const foot = { x: base.x + (index - 2.5) * 1, y: base.y }
            return smooth([
                foot,
                { x: foot.x + lean * 0.4, y: foot.y - tall * 0.55 },
                { x: foot.x + lean, y: foot.y - tall }
            ])
        })
    }))

    const flowers =
        random() < 0.45
            ? [
                  {
                      x: between(random, left + 8, right - 8),
                      y: random() < 0.5 ? top + 2 : bottom,
                      colour: random() < 0.5 ? '#d8402c' : '#f2c629',
                      petals: Array.from({ length: 5 }, (_, index) => {
                          const angle = (index / 5) * Math.PI * 2 + random()
                          return { x: Math.cos(angle) * 1.9, y: Math.sin(angle) * 1.9, r: 1.3 }
                      })
                  }
              ]
            : []

    return { ridges, ticks, stipple, clods, pebbles, tufts, flowers }
}
