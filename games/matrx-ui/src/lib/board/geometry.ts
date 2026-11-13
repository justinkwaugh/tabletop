import {
    flatHexCoordsToCenterPoint,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { GEOMETRIES, type BoardGeometry, type BoardShape } from '@tabletop/matrx'
import { stackTop } from './pieceShape.js'
import { hull } from './hull.js'

export const SPACING = 60
export const PIECE_RADIUS = SPACING * 0.428
export const DOT_RADIUS = SPACING * 0.12
export const SHADOW_BLUR = 5
const DOT_DISCS = 2
const LABEL_GAP = SPACING * 0.17
const FRAME_REACH = SPACING * 0.75
const FRAME_MARGIN = SPACING * 0.5
// Line and dot are sized to the pieces as on the printed board.
const RESERVE_DOT = { x: -SPACING * 3.4, y: SPACING * 3.75 }
const RESERVE_LINE_LENGTH = SPACING * 1.5
export const RESERVE_DOT_RADIUS = PIECE_RADIUS * 0.37
export const RESERVE_LINE_WIDTH = PIECE_RADIUS * 2 * 0.043

export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export type Frame = { viewBox: string; width: number; height: number }

export class BoardView {
    readonly rise: number
    readonly geometry: BoardGeometry

    constructor(
        readonly tilt: number,
        shape: BoardShape,
        readonly turned = false
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
        this.geometry = GEOMETRIES[shape]
    }

    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        const sign = this.turned ? -1 : 1
        return { x: sign * point.x, y: sign * point.y * this.tilt }
    }

    reserveDot(seat: number): Point {
        const side = (seat === 0) !== this.turned ? 1 : -1
        return { x: RESERVE_DOT.x * side, y: RESERVE_DOT.y * side * this.tilt }
    }

    reserveLine(seat: number): { from: Point; to: Point } {
        const from = this.reserveDot(seat)
        const along = this.center({ q: 1, r: 0 })
        const scale = ((seat === 0 ? 1 : -1) * RESERVE_LINE_LENGTH) / SPACING
        return { from, to: { x: from.x + along.x * scale, y: from.y + along.y * scale } }
    }

    height(height: number): number {
        return height * this.rise
    }

    topFace(discs: number): number {
        return -this.height(stackTop(discs) * PIECE_RADIUS)
    }

    extentAbove(discs: number): number {
        return -this.topFace(discs) + PIECE_RADIUS * this.tilt
    }

    get extentBelow(): number {
        return PIECE_RADIUS * this.tilt
    }

    labelOffset(above: boolean): number {
        return above ? -(this.extentAbove(DOT_DISCS) + LABEL_GAP) : this.extentBelow + LABEL_GAP
    }

    playAreaOutline(): string {
        return hull(this.geometry.spots.map((coords) => this.center(coords)))
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    }

    frame(): Frame {
        const centers = this.geometry.points.map((coords) => this.center(coords))
        const xs = centers.map((point) => point.x)
        const ys = centers.map((point) => point.y)
        const left = Math.min(...xs) - FRAME_REACH
        const right = Math.max(...xs) + FRAME_REACH
        const top = Math.min(...ys) + this.labelOffset(true) - FRAME_MARGIN
        const bottom = Math.max(...ys) + this.labelOffset(false) + FRAME_MARGIN
        return {
            viewBox: `${left} ${top} ${right - left} ${bottom - top}`,
            width: right - left,
            height: bottom - top
        }
    }
}

const VIEWS = new Map<string, BoardView>()

export function viewOf(shape: BoardShape, turned = false): BoardView {
    const key = `${shape}${turned ? '-turned' : ''}`
    let view = VIEWS.get(key)
    if (view === undefined) {
        view = new BoardView(TILT, shape, turned)
        VIEWS.set(key, view)
    }
    return view
}

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}
