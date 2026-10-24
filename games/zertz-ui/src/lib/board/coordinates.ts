import { addAxial, coordinatesToNumber, type AxialCoordinates, type Point } from '@tabletop/common'
import { RING_SPACING, TOP_DOWN, type BoardView } from './geometry.js'

// BoardSpace notation: columns lettered left to right, each counted up from 1 at its bottom ring.
// Each column is labelled with the names of its bottom and top rings.
export type BoardNotation = {
    name(coords: AxialCoordinates): string
    labels: CoordinateLabel[]
}

export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

// Labels stand this far off the ring, or the marble rising above it, that they name.
const LABEL_GAP = RING_SPACING * 0.22
const ABOVE: AxialCoordinates = { q: 0, r: -1 }
const BELOW: AxialCoordinates = { q: 0, r: 1 }

export function boardNotation(
    positions: readonly AxialCoordinates[],
    view: BoardView = TOP_DOWN
): BoardNotation {
    const columns = [...new Set(positions.map((coords) => coords.q))].sort((a, b) => a - b)
    const bottomOf = new Map<number, number>()
    const topOf = new Map<number, number>()
    for (const { q, r } of positions) {
        bottomOf.set(q, Math.max(bottomOf.get(q) ?? r, r))
        topOf.set(q, Math.min(topOf.get(q) ?? r, r))
    }

    const letterOf = (q: number) => String.fromCharCode(65 + columns.indexOf(q))
    const numberOf = ({ q, r }: AxialCoordinates) => (bottomOf.get(q) ?? r) - r + 1

    const labels = columns.flatMap((q) => {
        const top = { q, r: topOf.get(q) ?? 0 }
        const bottom = { q, r: bottomOf.get(q) ?? 0 }
        const letter = letterOf(q)
        return [
            labelBeside(view, `top-${letter}`, `${letter}${numberOf(top)}`, top, ABOVE),
            labelBeside(view, `bottom-${letter}`, `${letter}1`, bottom, BELOW)
        ]
    })

    const names = new Map(
        positions.map((coords) => [
            coordinatesToNumber(coords),
            `${letterOf(coords.q)}${numberOf(coords)}`
        ])
    )
    return {
        name: (coords) => names.get(coordinatesToNumber(coords)) ?? `${coords.q},${coords.r}`,
        labels
    }
}

function labelBeside(
    view: BoardView,
    key: string,
    text: string,
    ring: AxialCoordinates,
    direction: AxialCoordinates
): CoordinateLabel {
    const from = view.center(ring)
    const to = view.center(addAxial(ring, direction))
    const extent = to.y < from.y ? view.extentAbove : view.extentBelow
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const reach = (extent + LABEL_GAP) / length
    return {
        key,
        text,
        at: {
            x: from.x + (to.x - from.x) * reach,
            y: from.y + (to.y - from.y) * reach
        }
    }
}
