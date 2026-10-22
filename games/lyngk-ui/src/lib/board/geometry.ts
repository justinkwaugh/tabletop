import {
    distanceAxial,
    flatHexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { HEX_RADIUS, TIPS } from '@tabletop/lyngk'
import { SIDE, stackExtent, TILT } from './pieceGeometry.js'

export const SPACING = 60
// A little under the size where the tightest neighbours touch: side by side on neighbouring
// columns, or a stack of 5 below a single on the point above. A stack of 6 with a claimed color
// on top ends the game; one with a neutral top (rule H5) may overlap the point above.
const TALLEST_KEPT_CLEAR = 5
const CLEARANCE = 0.95
export const PIECE_RADIUS =
    CLEARANCE *
    Math.min((SPACING * Math.sqrt(3)) / 4, SPACING / (2 * TILT + TALLEST_KEPT_CLEAR * SIDE))
const FRAME_REACH = SPACING * 1.15

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export function pointCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

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

// The playing surface ends at the grid's outer lines.
export function boardOutline(): string {
    return gridOutline()
        .map((coords) => {
            const point = pointCenter(coords)
            return `${point.x},${point.y}`
        })
        .join(' ')
}

export function viewBox(): { viewBox: string; width: number; height: number } {
    const halfWidth = Math.abs(pointCenter(TIPS[1]).x) + FRAME_REACH
    const halfHeight =
        Math.abs(pointCenter({ q: 0, r: -HEX_RADIUS }).y) +
        FRAME_REACH +
        stackExtent(1, PIECE_RADIUS)
    return {
        viewBox: `${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`,
        width: halfWidth * 2,
        height: halfHeight * 2
    }
}
