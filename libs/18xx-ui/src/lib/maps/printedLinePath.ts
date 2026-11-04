import type { Point } from '@tabletop/common'

const SamplesPerCurve = 8

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Point, by: number): Point => ({ x: a.x * by, y: a.y * by })
const lengthOf = (a: Point) => Math.hypot(a.x, a.y)
const unit = (a: Point) => scale(a, 1 / (lengthOf(a) || 1))

export const PointMath = { add, minus, scale, lengthOf, unit }

/**
 * A smooth path through a printed line's points, leaving and arriving along the given unit
 * directions so that legs in neighbouring hexes join evenly, with samples along it that marks in
 * the hex can keep clear of.
 */
export function smoothLinePath(points: readonly Point[], first: Point, last: Point) {
    const tangents = points.map((point, index) => {
        if (index === 0) return scale(first, lengthOf(minus(points[1], point)))
        if (index === points.length - 1)
            return scale(last, lengthOf(minus(point, points[index - 1])))
        return scale(minus(points[index + 1], points[index - 1]), 0.5)
    })
    const fixed = (value: number) => value.toFixed(1)
    let d = `M ${fixed(points[0].x)} ${fixed(points[0].y)}`
    const samples: Point[] = [points[0]]
    for (let index = 1; index < points.length; index++) {
        const start = points[index - 1]
        const end = points[index]
        const c1 = add(start, scale(tangents[index - 1], 1 / 3))
        const c2 = minus(end, scale(tangents[index], 1 / 3))
        d += ` C ${fixed(c1.x)} ${fixed(c1.y)} ${fixed(c2.x)} ${fixed(c2.y)} ${fixed(end.x)} ${fixed(end.y)}`
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
