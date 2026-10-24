import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { BOARD_RADIUS, PLAY_RADIUS } from '@tabletop/gipf'
import { pieceTop } from './pieceShape.js'

export const SPACING = 60
export const PIECE_RADIUS = SPACING * 0.428
export const DOT_RADIUS = SPACING * 0.12
// The ring on a GIPF-piece's top face, as a fraction of its radius.
export const CROWN_SCALE = 0.55
// Beyond the silhouette of a piece on an outer dot, to the centre of its coordinate label, and
// from the outermost dots and labels to the frame's edge: a margin like ZÈRTZ's.
const LABEL_GAP = SPACING * 0.17
const FRAME_REACH = SPACING * 1.1
const FRAME_MARGIN = SPACING * 0.5

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export class BoardView {
    // How much of a height shows on screen.
    readonly rise: number

    constructor(readonly tilt: number) {
        this.rise = Math.sqrt(1 - tilt ** 2)
    }

    // The centre of a point on the board's surface, where a piece standing there rests.
    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        return { x: point.x, y: point.y * this.tilt }
    }

    // How far up the screen a height above the board shows.
    height(height: number): number {
        return height * this.rise
    }

    // Where a piece's top face is centred, above its point.
    topFace(gipf: boolean): number {
        return -this.height(pieceTop(gipf) * PIECE_RADIUS)
    }

    // How far a piece reaches above and below its point.
    extentAbove(gipf: boolean): number {
        return -this.topFace(gipf) + PIECE_RADIUS * this.tilt
    }

    get extentBelow(): number {
        return PIECE_RADIUS * this.tilt
    }

    // A coordinate label beside an outer dot clears a GIPF-piece brought in on that dot.
    labelOffset(above: boolean): number {
        return above ? -(this.extentAbove(true) + LABEL_GAP) : this.extentBelow + LABEL_GAP
    }

    // The play area's edge is the grid's outermost lines; the dots sit outside it on the table.
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
        const top = this.center({ q: 0, r: -BOARD_RADIUS }).y + this.labelOffset(true)
        const bottom = this.center({ q: 0, r: BOARD_RADIUS }).y + this.labelOffset(false)
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

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}
