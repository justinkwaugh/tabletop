import type { AxialCoordinates } from '@tabletop/common'
import { DOT_RADIUS, PIECE_RADIUS, type BoardView } from './geometry.js'

// Everything a GIPF-piece standing on a spot would cover, for clicks on a target there.
export function stackOutline(view: BoardView): string {
    const r = PIECE_RADIUS
    const ry = r * view.tilt
    const top = view.topFace(true)
    return `M ${-r} ${top} A ${r} ${ry} 0 0 1 ${r} ${top} L ${r} 0 A ${r} ${ry} 0 0 1 ${-r} 0 Z`
}

// The tilt shortens upright arrows most, so each starts as far from its dot on screen, as in
// MATRX GIPF.
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
