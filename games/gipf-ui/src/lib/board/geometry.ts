import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { BOARD_RADIUS, PLAY_RADIUS } from '@tabletop/gipf'
import { pieceTop } from './pieceShape.js'

export const SPACING = 60
export const PIECE_RADIUS = SPACING * 0.428
export const DOT_RADIUS = SPACING * 0.12
export const CROWN_SCALE = 0.55
const LABEL_GAP = SPACING * 0.17
const FRAME_REACH = SPACING * 1.1
const FRAME_MARGIN = SPACING * 0.5

// Depth shrinks to TILT of its length, and heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export class BoardView {
    readonly rise: number

    constructor(
        readonly tilt: number,
        readonly turned = false
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
    }

    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        const sign = this.turned ? -1 : 1
        return { x: sign * point.x, y: sign * point.y * this.tilt }
    }

    height(height: number): number {
        return height * this.rise
    }

    topFace(gipf: boolean): number {
        return -this.height(pieceTop(gipf) * PIECE_RADIUS)
    }

    extentAbove(gipf: boolean): number {
        return -this.topFace(gipf) + PIECE_RADIUS * this.tilt
    }

    get extentBelow(): number {
        return PIECE_RADIUS * this.tilt
    }

    labelOffset(above: boolean): number {
        return above ? -(this.extentAbove(true) + LABEL_GAP) : this.extentBelow + LABEL_GAP
    }

    playAreaOutline(): string {
        const corners: AxialCoordinates[] = [
            { q: PLAY_RADIUS, r: -PLAY_RADIUS },
            { q: PLAY_RADIUS, r: 0 },
            { q: 0, r: PLAY_RADIUS },
            { q: -PLAY_RADIUS, r: PLAY_RADIUS },
            { q: -PLAY_RADIUS, r: 0 },
            { q: 0, r: -PLAY_RADIUS }
        ]
        return corners
            .map((corner) => {
                const point = this.center(corner)
                return `${point.x},${point.y}`
            })
            .join(' ')
    }

    frame(): { viewBox: string; width: number; height: number } {
        const halfWidth =
            Math.abs(this.center({ q: BOARD_RADIUS, r: -BOARD_RADIUS }).x) + FRAME_REACH
        // The board is the same shape half a turn round, so the frame is the same either way.
        const reach = Math.abs(this.center({ q: 0, r: BOARD_RADIUS }).y)
        const top = -reach + this.labelOffset(true)
        const bottom = reach + this.labelOffset(false)
        const minY = top - FRAME_MARGIN
        const height = bottom + FRAME_MARGIN - minY
        return {
            viewBox: `${-halfWidth} ${minY} ${halfWidth * 2} ${height}`,
            width: halfWidth * 2,
            height
        }
    }
}

export const VIEW = new BoardView(TILT)
const TURNED_VIEW = new BoardView(TILT, true)

export function viewOf(turned: boolean): BoardView {
    return turned ? TURNED_VIEW : VIEW
}
