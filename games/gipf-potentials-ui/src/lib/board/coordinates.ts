import { coordinatesToNumber, type AxialCoordinates, type Point } from '@tabletop/common'
import type { BoardView } from './geometry.js'

// GIPF notation: columns A–J left to right, each counted up from 1 at its bottom dot.
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

export function boardNotation(view: BoardView): BoardNotation {
    const positions = view.geometry.points
    const columns = [...new Set(positions.map((coords) => coords.q))].sort((a, b) => a - b)
    const bottomOf = new Map<number, number>()
    const topOf = new Map<number, number>()
    for (const { q, r } of positions) {
        bottomOf.set(q, Math.max(bottomOf.get(q) ?? r, r))
        topOf.set(q, Math.min(topOf.get(q) ?? r, r))
    }

    const letterOf = (q: number) => String.fromCharCode(65 + columns.indexOf(q))
    const numberOf = ({ q, r }: AxialCoordinates) => (bottomOf.get(q) ?? r) - r + 1

    // Columns run straight up the screen, so a label sits above or below its dot.
    const labelBeside = (key: string, text: string, dot: AxialCoordinates, above: boolean) => {
        const center = view.center(dot)
        return { key, text, at: { x: center.x, y: center.y + view.labelOffset(above) } }
    }

    const labels = columns.flatMap((q) => {
        const top = { q, r: topOf.get(q) ?? 0 }
        const bottom = { q, r: bottomOf.get(q) ?? 0 }
        const letter = letterOf(q)
        return [
            labelBeside(`top-${letter}`, `${letter}${numberOf(top)}`, top, true),
            labelBeside(`bottom-${letter}`, `${letter}1`, bottom, false)
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
