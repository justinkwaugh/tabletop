import { addAxial, scaleAxial, type Point } from '@tabletop/common'
import { AXES } from '@tabletop/gipf-potentials'
import type { BoardView } from './geometry.js'

export type Segment = { from: Point; to: Point }

// Lines run dot to dot across the play area; the board's rim has no line between dots.
export function gridLines(view: BoardView): Segment[] {
    const { geometry } = view
    return AXES.flatMap((axis) =>
        geometry.points
            .filter((point) => !geometry.isPoint(addAxial(point, scaleAxial(axis, -1))))
            .flatMap((start) => {
                const points = [start]
                while (geometry.isPoint(addAxial(points[points.length - 1], axis))) {
                    points.push(addAxial(points[points.length - 1], axis))
                }
                const crossesPlay = points.some((point) => geometry.isSpot(point))
                const end = points[points.length - 1]
                return crossesPlay ? [{ from: view.center(start), to: view.center(end) }] : []
            })
    )
}
