import { addAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import { isSpace, SPACES } from '@tabletop/dvonn'
import type { BoardView } from './geometry.js'

// The graph board: lines along the three directions through every space, running a short whisker
// on past the outer spaces, as on the printed board.
const AXES: readonly AxialCoordinates[] = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 }
]
const WHISKER = 0.225

export function boardLines(layout: BoardView): { from: Point; to: Point }[] {
    const beyond = (coords: AxialCoordinates, step: AxialCoordinates) => {
        const from = layout.center(coords)
        const to = layout.center(addAxial(coords, step))
        return { x: from.x + (to.x - from.x) * WHISKER, y: from.y + (to.y - from.y) * WHISKER }
    }
    return AXES.flatMap((axis) => {
        const back = { q: -axis.q, r: -axis.r }
        return SPACES.filter((space) => !isSpace(addAxial(space, back))).map((start) => {
            let end = start
            while (isSpace(addAxial(end, axis))) end = addAxial(end, axis)
            return { from: beyond(start, back), to: beyond(end, axis) }
        })
    })
}
