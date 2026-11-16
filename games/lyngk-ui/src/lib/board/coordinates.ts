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
    // Each column's lowest r (its top point) and highest (its bottom point).
    const rowsOf = (q: number) =>
        positions.filter((coords) => coords.q === q).map((coords) => coords.r)
    const topOf = (q: number) => Math.min(...rowsOf(q))
    const bottomOf = (q: number) => Math.max(...rowsOf(q))

    const letterOf = (q: number) => String.fromCharCode(65 + columns.indexOf(q))
    const numberOf = ({ q, r }: AxialCoordinates) => bottomOf(q) - r + 1

    // Beyond the column's end: above its top point, below its bottom one, the other way round on
    // a turned board. A side tip's label stays below it either way.
    const labels = columns.flatMap((q) => {
        const top = { q, r: topOf(q) }
        const bottom = { q, r: bottomOf(q) }
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
        name: (coords) => {
            const name = names.get(coordinatesToNumber(coords))
            if (name === undefined) throw Error(`No point ${coords.q},${coords.r}`)
            return name
        },
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
