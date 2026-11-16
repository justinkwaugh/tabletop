import { addAxial, scaleAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import { ALL_POINTS, AXES, SPOTS } from '@tabletop/gipf'
import { includesCoords, type BoardView } from './geometry.js'

export type Segment = { from: Point; to: Point }

// Lines run dot to dot across the play area; the board's rim has no line between dots.
export function gridLines(view: BoardView): Segment[] {
    const inBoard = (coords: AxialCoordinates) => includesCoords(ALL_POINTS, coords)
    return AXES.flatMap((axis) =>
        ALL_POINTS.filter((point) => !inBoard(addAxial(point, scaleAxial(axis, -1)))).flatMap(
            (start) => {
                const points = [start]
                while (inBoard(addAxial(points[points.length - 1], axis))) {
                    points.push(addAxial(points[points.length - 1], axis))
                }
                const crossesPlay = points.some((point) => includesCoords(SPOTS, point))
                const end = points[points.length - 1]
                return crossesPlay ? [{ from: view.center(start), to: view.center(end) }] : []
            }
        )
    )
}
