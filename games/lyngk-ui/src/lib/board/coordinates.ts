import { coordinatesToNumber, type AxialCoordinates, type Point } from '@tabletop/common'
import { VIEW, type BoardView } from './geometry.js'

// Columns A–I left to right, each counted up from 1 at its bottom point, BoardSpace style.
// Each column is labelled with the names of its bottom and top points; a column of one point
// (the side tips) only below.
export type BoardNotation = {
    name(coords: AxialCoordinates): string
    labels: CoordinateLabel[]
}

export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

export function boardNotation(
    positions: readonly AxialCoordinates[],
    view: BoardView = VIEW
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

    // Beyond the column's end: above its top point, below its bottom one, the other way round on
    // a turned board. A side tip's label stays below it either way.
    const labels = columns.flatMap((q) => {
        const top = { q, r: topOf.get(q) ?? 0 }
        const bottom = { q, r: bottomOf.get(q) ?? 0 }
        const letter = letterOf(q)
        if (top.r === bottom.r)
            return [labelAt(view, `bottom-${letter}`, `${letter}1`, bottom, false)]
        return [
            labelAt(view, `top-${letter}`, `${letter}${numberOf(top)}`, top, !view.turned),
            labelAt(view, `bottom-${letter}`, `${letter}1`, bottom, view.turned)
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

// A label sits straight above or below its point, clear of a tall stack standing there.
function labelAt(
    view: BoardView,
    key: string,
    text: string,
    point: AxialCoordinates,
    above: boolean
): CoordinateLabel {
    const center = view.center(point)
    return { key, text, at: { x: center.x, y: center.y + view.labelOffset(above) } }
}
