import {
    assertExists,
    coordinatesToNumber,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import type { BoardView } from './geometry.js'

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
    // Each column's bottom (largest r) and top point.
    const ends = new Map(
        columns.map((q) => {
            const rows = positions.filter((coords) => coords.q === q).map((coords) => coords.r)
            return [q, { bottom: Math.max(...rows), top: Math.min(...rows) }]
        })
    )
    const endsOf = (q: number) => {
        const found = ends.get(q)
        assertExists(found, 'Every column has points')
        return found
    }

    const letterOf = (q: number) => String.fromCharCode(65 + columns.indexOf(q))
    const numberOf = ({ q, r }: AxialCoordinates) => endsOf(q).bottom - r + 1

    const labelBeside = (key: string, text: string, dot: AxialCoordinates, top: boolean) => {
        const center = view.center(dot)
        const above = top !== view.turned
        return { key, text, at: { x: center.x, y: center.y + view.labelOffset(above) } }
    }

    const labels = columns.flatMap((q) => {
        const top = { q, r: endsOf(q).top }
        const bottom = { q, r: endsOf(q).bottom }
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
        name: (coords) => {
            const name = names.get(coordinatesToNumber(coords))
            assertExists(name, 'Only points of the board are named')
            return name
        },
        labels
    }
}
