import { assert, type AxialCoordinates, type Point } from '@tabletop/common'
import { pointName } from '@tabletop/gipf-potentials'
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

    const labelBeside = (key: string, dot: AxialCoordinates, top: boolean) => {
        const center = view.center(dot)
        const above = top !== view.turned
        const text = pointName(dot)
        return { key, text, at: { x: center.x, y: center.y + view.labelOffset(above) } }
    }

    const labels = columns.flatMap((q) => {
        const rows = positions.filter((coords) => coords.q === q).map((coords) => coords.r)
        return [
            labelBeside(`top-${q}`, { q, r: Math.min(...rows) }, true),
            labelBeside(`bottom-${q}`, { q, r: Math.max(...rows) }, false)
        ]
    })

    return {
        name: (coords) => {
            assert(view.geometry.isPoint(coords), 'Only points of the board are named')
            return pointName(coords)
        },
        labels
    }
}
