import { addAxial, scaleAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import type { BoardLine } from '@tabletop/yinsh'
import { VIEW, type BoardView } from './geometry.js'

// A short whisker on past each end point, out over the edge of the board as on the real one.
const WHISKER = 0.15

function beyond(view: BoardView, coords: AxialCoordinates, step: AxialCoordinates): Point {
    const from = view.center(coords)
    const to = view.center(addAxial(coords, step))
    return { x: from.x + (to.x - from.x) * WHISKER, y: from.y + (to.y - from.y) * WHISKER }
}

// Each line of the board on screen, end to end with its whiskers.
export function boardLines(
    lines: readonly BoardLine[],
    view: BoardView = VIEW
): { from: Point; to: Point }[] {
    return lines.map(({ direction, points }) => ({
        from: beyond(view, points[0], scaleAxial(direction, -1)),
        to: beyond(view, points[points.length - 1], direction)
    }))
}
