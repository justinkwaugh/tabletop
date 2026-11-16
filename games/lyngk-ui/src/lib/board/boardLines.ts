import { addAxial, sameCoordinates, type AxialCoordinates, type Point } from '@tabletop/common'
import { POINTS } from '@tabletop/lyngk'
import type { BoardView } from './geometry.js'

const AXES: AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

// Each line runs on a little past its last points, as on the printed board: a fraction of the
// step between points.
const WHISKER = 0.25

const onBoard = (coords: AxialCoordinates) => POINTS.some((point) => sameCoordinates(point, coords))

// The board's printed lines in `view`: along each axis, as far as consecutive points go.
export function boardLines(view: BoardView): { from: Point; to: Point }[] {
    return AXES.flatMap((axis) =>
        POINTS.filter((point) => !onBoard(addAxial(point, { q: -axis.q, r: -axis.r }))).flatMap(
            (start) => {
                let end = start
                while (onBoard(addAxial(end, axis))) end = addAxial(end, axis)
                if (sameCoordinates(start, end)) return []
                const [from, to] = [view.center(start), view.center(end)]
                const next = view.center(addAxial(start, axis))
                const step = { x: (next.x - from.x) * WHISKER, y: (next.y - from.y) * WHISKER }
                return [
                    {
                        from: { x: from.x - step.x, y: from.y - step.y },
                        to: { x: to.x + step.x, y: to.y + step.y }
                    }
                ]
            }
        )
    )
}
