import {
    distanceAxial,
    flatHexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { HEX_RADIUS, TIPS } from '@tabletop/lyngk'
import { stackBounds } from './pieceGeometry.js'

export const SPACING = 60
// A little under the size where pieces on neighbouring columns touch. A tall stack reaches up
// over the point straight behind it, which is drawn first.
const CLEARANCE = 0.95
export const PIECE_RADIUS = (CLEARANCE * (SPACING * Math.sqrt(3))) / 4
// The tallest stack a coordinate label clears: a neutral-topped stack of 5 stays on the board.
const TALLEST_LABELLED = 5
// Beyond the silhouette of a stack on an outer point, to the centre of its coordinate label, and
// from the outermost points and labels to the frame's edge.
const LABEL_GAP = SPACING * 0.22
const FRAME_REACH = SPACING * 1.15
const FRAME_MARGIN = SPACING * 0.4
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.6

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

    // The centre of a point on the board's surface, where a stack standing there rests.
    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        return { x: point.x, y: point.y * this.tilt }
    }

    // How far up the screen a height above the board shows.
    height(height: number): number {
        return height * this.rise
    }

    // From an outer point to the coordinate label above or below it, clear of a tall stack there.
    labelOffset(above: boolean): number {
        const bounds = stackBounds(this, TALLEST_LABELLED, PIECE_RADIUS)
        return above ? bounds.top - LABEL_GAP : bounds.bottom + LABEL_GAP
    }

    // The playing surface ends at the grid's outer lines.
    playAreaOutline(): string {
        return gridOutline()
            .map((coords) => {
                const point = this.center(coords)
                return `${point.x},${point.y}`
            })
            .join(' ')
    }

    frame(): { viewBox: string; width: number; height: number } {
        const halfWidth = Math.abs(this.center(TIPS[1]).x) + FRAME_REACH
        const top = this.center({ q: 0, r: -HEX_RADIUS }).y + this.labelOffset(true)
        const bottom = this.center({ q: 0, r: HEX_RADIUS }).y + this.labelOffset(false)
        const minY = top - FRAME_MARGIN
        const height = bottom + FRAME_MARGIN + CONTROLS_ROOM - minY
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

const CORNERS: AxialCoordinates[] = [
    { q: 0, r: -HEX_RADIUS },
    { q: HEX_RADIUS, r: -HEX_RADIUS },
    { q: HEX_RADIUS, r: 0 },
    { q: 0, r: HEX_RADIUS },
    { q: -HEX_RADIUS, r: HEX_RADIUS },
    { q: -HEX_RADIUS, r: 0 }
]

// The grid's outer lines, clockwise from the top: along each hexagon edge, out to the tip
// beside its middle and back.
export function gridOutline(): AxialCoordinates[] {
    return CORNERS.flatMap((corner, index) => {
        const next = CORNERS[(index + 1) % CORNERS.length]
        const step = { q: (next.q - corner.q) / HEX_RADIUS, r: (next.r - corner.r) / HEX_RADIUS }
        const first = { q: corner.q + step.q, r: corner.r + step.r }
        const second = { q: corner.q + 2 * step.q, r: corner.r + 2 * step.r }
        const tip = TIPS.find(
            (candidate) =>
                distanceAxial(candidate, first) === 1 && distanceAxial(candidate, second) === 1
        )
        return tip ? [corner, first, tip, second] : [corner, first, second]
    })
}
