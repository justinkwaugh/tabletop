import type { Point } from '@tabletop/common'
import { riseOf, STONE_RADIUS, STONE_THICKNESS } from './geometry.js'

// A go stone: two spherical domes alike, meeting in a softly rounded rim, resting on its lower dome
// at the origin.
export function lensProfile(thickness: number) {
    const half = thickness / 2
    const rounding = STONE_RADIUS * 0.04 + thickness * 0.07
    const rim = STONE_RADIUS + rounding * 0.2
    const sphere = (rim * rim + half * half) / (2 * half)
    return { half, rounding, sphere }
}

const PROFILE = lensProfile(STONE_THICKNESS)

// How high the top dome stands `r` out from the stone's centre.
export function domeHeight(r: number): number {
    return STONE_THICKNESS - PROFILE.sphere + Math.sqrt(PROFILE.sphere ** 2 - r * r)
}

// A ring painted on the top dome, between radii `inner` and `outer`, as the board sees it at `tilt`:
// each edge a circle at its own height, so the band narrows where the dome turns away.
export function domeRing(inner: number, outer: number, tilt: number): string {
    const rise = riseOf(tilt)
    const loop = (r: number) =>
        Array.from({ length: 48 }, (_, step) => {
            const angle = (step / 48) * 2 * Math.PI
            const x = r * Math.cos(angle)
            const y = r * Math.sin(angle)
            return `${x.toFixed(2)} ${(y * tilt - domeHeight(r) * rise).toFixed(2)}`
        })
    const path = (points: string[]) => `M ${points.join(' L ')} Z`
    return `${path(loop(outer))} ${path(loop(inner).toReversed())}`
}

type Vec = [number, number, number]

// Points over the stone's surface, for fitting how it looks tipped.
const SURFACE: readonly Vec[] = Array.from({ length: 7 }, (_, ring) => (ring + 1) / 7).flatMap(
    (share) =>
        Array.from({ length: 12 }, (_, step): Vec[] => {
            const angle = (step / 12) * 2 * Math.PI
            const r = share * STONE_RADIUS * 0.98
            const [x, y] = [r * Math.cos(angle), r * Math.sin(angle)]
            const bottom = PROFILE.sphere - Math.sqrt(PROFILE.sphere ** 2 - r * r)
            return [
                [x, y, Math.max(domeHeight(r), bottom)],
                [x, y, bottom]
            ]
        }).flat()
)

export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }

// The stone tipped by `angle` degrees about a line through where it touches the board, running
// `axis` degrees round from the board's x direction, as one flat transform of its picture seen at
// `tilt`: the least-squares fit over its surface, as the picture is a single view.
export function rockTransform(angle: number, axis: number, tilt: number): Affine {
    const rise = riseOf(tilt)
    const project = ([x, y, z]: Vec): Point => ({ x, y: y * tilt - z * rise })
    const theta = (angle * Math.PI) / 180
    const phi = (axis * Math.PI) / 180
    const [ux, uy] = [Math.cos(phi), Math.sin(phi)]
    const [cos, sin] = [Math.cos(theta), Math.sin(theta)]
    // Rodrigues' rotation about the unit axis (ux, uy, 0).
    const turn = ([x, y, z]: Vec): Vec => {
        const along = ux * x + uy * y
        return [
            x * cos + uy * z * sin + ux * along * (1 - cos),
            y * cos - ux * z * sin + uy * along * (1 - cos),
            z * cos + (ux * y - uy * x) * sin
        ]
    }
    // Normal equations for [x y 1] → each screen coordinate.
    const sums = { xx: 0, xy: 0, yy: 0, x: 0, y: 0, n: 0, tx: [0, 0, 0], ty: [0, 0, 0] }
    for (const p of SURFACE) {
        const from = project(p)
        const to = project(turn(p))
        sums.xx += from.x * from.x
        sums.xy += from.x * from.y
        sums.yy += from.y * from.y
        sums.x += from.x
        sums.y += from.y
        sums.n += 1
        const row = [from.x, from.y, 1]
        row.forEach((value, index) => {
            sums.tx[index] += value * to.x
            sums.ty[index] += value * to.y
        })
    }
    const m = [
        [sums.xx, sums.xy, sums.x],
        [sums.xy, sums.yy, sums.y],
        [sums.x, sums.y, sums.n]
    ]
    const [a, c, e] = solve3(m, sums.tx)
    const [b, d, f] = solve3(m, sums.ty)
    return { a, b, c, d, e, f }
}

function solve3(m: number[][], v: number[]): [number, number, number] {
    const det = (k: number[][]) =>
        k[0][0] * (k[1][1] * k[2][2] - k[1][2] * k[2][1]) -
        k[0][1] * (k[1][0] * k[2][2] - k[1][2] * k[2][0]) +
        k[0][2] * (k[1][0] * k[2][1] - k[1][1] * k[2][0])
    const whole = det(m)
    const column = (index: number) =>
        det(m.map((row, r) => row.map((value, c) => (c === index ? v[r] : value)))) / whole
    return [column(0), column(1), column(2)]
}
