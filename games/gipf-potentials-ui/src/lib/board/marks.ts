import type { AxialCoordinates } from '@tabletop/common'
import { DOT_RADIUS, PIECE_RADIUS, type BoardView } from './geometry.js'
import { markGaps, type Disc } from './pieceShape.js'

export const DASH = 5
export const DASH_GAP = 4

export function stackOutline(view: BoardView, discs: number): string {
    const r = PIECE_RADIUS
    const ry = r * view.tilt
    const top = view.topFace(Math.max(discs, 2))
    return `M ${-r} ${top} A ${r} ${ry} 0 0 1 ${r} ${top} L ${r} 0 A ${r} ${ry} 0 0 1 ${-r} 0 Z`
}

export type RingArc = { d: string; length: number }

// In dash-and-gap units: whole dashes round a ring, and a dash at each end of a broken arc.
export function topRing(view: BoardView, top: Disc, radius: number, cy: number): RingArc[] {
    const rx = radius
    const ry = radius * view.tilt
    const gaps = markGaps(top, radius / PIECE_RADIUS).toSorted((a, b) => a[0] - b[0])
    const point = (angle: number) => ({
        x: rx * Math.cos(angle),
        y: cy - ry * Math.sin(angle)
    })
    const at = (angle: number) => `${point(angle).x} ${point(angle).y}`
    const arcLength = (from: number, to: number) =>
        Array.from({ length: 48 }, (_, step) => {
            const a = point(from + ((to - from) * step) / 48)
            const b = point(from + ((to - from) * (step + 1)) / 48)
            return Math.hypot(b.x - a.x, b.y - a.y)
        }).reduce((sum, length) => sum + length, 0)
    const period = DASH + DASH_GAP
    if (gaps.length === 0) {
        const dashes = Math.max(1, Math.round(arcLength(0, 2 * Math.PI) / period))
        return [
            {
                d: `M ${-rx} ${cy} A ${rx} ${ry} 0 1 0 ${rx} ${cy} A ${rx} ${ry} 0 1 0 ${-rx} ${cy}`,
                length: dashes * period
            }
        ]
    }
    return gaps.map(([, end], index) => {
        const [next] = gaps[(index + 1) % gaps.length]
        const start = next + (index === gaps.length - 1 ? 2 * Math.PI : 0)
        const large = start - end > Math.PI ? 1 : 0
        const dashes = Math.max(1, Math.round((arcLength(end, start) + DASH_GAP) / period))
        return {
            d: `M ${at(end)} A ${rx} ${ry} 0 ${large} 0 ${at(start)}`,
            length: dashes * period - DASH_GAP
        }
    })
}

// The tilt shortens an arrow pointing up or down the screen more than one along a slanted line,
// so each starts as far from its dot on screen as an upright one does.
export const ARROW_START = DOT_RADIUS * 2 + 12
export const ARROW_REACH = 24

export function pushArrow(view: BoardView, from: AxialCoordinates, to: AxialCoordinates): string {
    const start = view.center(from)
    const end = view.center(to)
    const flat = (x: number, y: number) => `${x} ${y * view.tilt}`
    const [sx, sy, ex, ey] = [start.x, start.y / view.tilt, end.x, end.y / view.tilt]
    const length = Math.hypot(ex - sx, ey - sy)
    const ux = (ex - sx) / length
    const uy = (ey - sy) / length
    const tipX = ex - ux * (PIECE_RADIUS + 2 - ARROW_REACH)
    const tipY = ey - uy * (PIECE_RADIUS + 2 - ARROW_REACH)
    const tail = (ARROW_START * view.tilt) / Math.hypot(ux, uy * view.tilt)
    const baseX = sx + ux * tail
    const baseY = sy + uy * tail
    const wing = 8
    return `M ${flat(baseX, baseY)} L ${flat(tipX, tipY)} M ${flat(tipX - ux * wing - uy * wing, tipY - uy * wing + ux * wing)} L ${flat(tipX, tipY)} L ${flat(tipX - ux * wing + uy * wing, tipY - uy * wing - ux * wing)}`
}
