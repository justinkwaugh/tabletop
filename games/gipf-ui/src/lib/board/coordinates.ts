import { addAxial, coordinatesToNumber, type AxialCoordinates, type Point } from '@tabletop/common'
import { pointCenter } from './geometry.js'

// GIPF notation: columns A–I left to right, each counted up from 1 at its bottom dot.
// Each column is labelled with the names of its bottom and top points.
export type BoardNotation = {
    name(coords: AxialCoordinates): string
    labels: CoordinateLabel[]
}

export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

const LABEL_REACH = 1.15
const ABOVE: AxialCoordinates = { q: 0, r: -1 }
const BELOW: AxialCoordinates = { q: 0, r: 1 }

export function boardNotation(positions: readonly AxialCoordinates[]): BoardNotation {
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
            labelBeside(`top-${letter}`, `${letter}${numberOf(top)}`, top, ABOVE),
            labelBeside(`bottom-${letter}`, `${letter}1`, bottom, BELOW)
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
    key: string,
    text: string,
    ring: AxialCoordinates,
    direction: AxialCoordinates
): CoordinateLabel {
    const from = pointCenter(ring)
    const to = pointCenter(addAxial(ring, direction))
    return {
        key,
        text,
        at: {
            x: from.x + (to.x - from.x) * LABEL_REACH,
            y: from.y + (to.y - from.y) * LABEL_REACH
        }
    }
}
