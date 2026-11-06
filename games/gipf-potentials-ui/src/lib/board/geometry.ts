import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { GEOMETRY } from '@tabletop/gipf-potentials'
import { stackTop } from './pieceShape.js'
import { hull } from './hull.js'

export const SPACING = 60
export const PIECE_RADIUS = SPACING * 0.428
export const DOT_RADIUS = SPACING * 0.12
// How far a piece's shadow softens past its edge.
export const SHADOW_BLUR = 5
// The tallest stack a dot holds: a loaded piece or a GIPF-piece brought in.
const DOT_DISCS = 2
// Beyond the silhouette of a piece on an outer dot, to the centre of its coordinate label, and
// from the outermost dots and labels to the frame's edge: a margin like ZÈRTZ's.
const LABEL_GAP = SPACING * 0.17
const FRAME_REACH = SPACING * 1.1
const FRAME_MARGIN = SPACING * 0.5
// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export type Frame = { viewBox: string; width: number; height: number }

export class BoardView {
    // How much of a height shows on screen.
    readonly rise: number
    readonly geometry = GEOMETRY

    // A turned view sees the board from the far side, half a turn round.
    constructor(
        readonly tilt: number,
        readonly turned = false
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
    }

    // The centre of a point on the board's surface, where a piece standing there rests.
    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        const sign = this.turned ? -1 : 1
        return { x: sign * point.x, y: sign * point.y * this.tilt }
    }

    // How far up the screen a height above the board shows.
    height(height: number): number {
        return height * this.rise
    }

    // Where the top face of a stack of discs is centred, above its point.
    topFace(discs: number): number {
        return -this.height(stackTop(discs) * PIECE_RADIUS)
    }

    // How far a stack of discs reaches above and below its point.
    extentAbove(discs: number): number {
        return -this.topFace(discs) + PIECE_RADIUS * this.tilt
    }

    get extentBelow(): number {
        return PIECE_RADIUS * this.tilt
    }

    // A coordinate label beside an outer dot clears a piece of two discs brought in on that dot.
    labelOffset(above: boolean): number {
        return above ? -(this.extentAbove(DOT_DISCS) + LABEL_GAP) : this.extentBelow + LABEL_GAP
    }

    // The play area's edge is the grid's outermost lines; the dots sit outside it on the table.
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

export const VIEW = new BoardView(TILT)
export const TURNED_VIEW = new BoardView(TILT, true)

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}
