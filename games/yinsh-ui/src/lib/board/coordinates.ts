import { addAxial, assertExists, type AxialCoordinates, type Point } from '@tabletop/common'
import { pointName } from '@tabletop/yinsh'
import { VIEW, type BoardView } from './geometry.js'

// BoardSpace style: each column's letter below its bottom point, and each line's number before
// its first point on the left, where the line of that number starts. Seen from the far side, each
// label goes round with its point.
export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

// The labels' font size, and the shift that centres a label on its point from the alphabetic
// baseline.
export const LABEL_SIZE = 15
export const LABEL_SHIFT = LABEL_SIZE * 0.35

const BELOW: AxialCoordinates = { q: 0, r: 1 }
// Numbers stay level along the lines that run down to the right, so a line starts at its left.
const BEFORE_LINE: AxialCoordinates = { q: -1, r: 0 }

export function boardLabels(
    positions: readonly AxialCoordinates[],
    view: BoardView = VIEW
): CoordinateLabel[] {
    const extreme = (
        group: (coords: AxialCoordinates) => number,
        along: (coords: AxialCoordinates) => number,
        pick: (...values: number[]) => number
    ) =>
        [...new Set(positions.map(group))]
            .sort((a, b) => a - b)
            .map((key) => {
                const members = positions.filter((coords) => group(coords) === key)
                const end = pick(...members.map(along))
                const found = members.find((coords) => along(coords) === end)
                assertExists(found, 'The extreme of a group is one of its members')
                return found
            })
    const columnBottoms = extreme(
        (c) => c.q,
        (c) => c.r,
        Math.max
    )
    const lineStarts = extreme(
        (c) => c.r,
        (c) => c.q,
        Math.min
    )
    return [
        ...columnBottoms.map((coords) =>
            labelBeside(view, `column-${coords.q}`, pointName(coords).slice(0, 1), coords, BELOW)
        ),
        ...lineStarts.map((coords) =>
            labelBeside(view, `line-${coords.r}`, pointName(coords).slice(1), coords, BEFORE_LINE)
        )
    ]
}

function labelBeside(
    view: BoardView,
    key: string,
    text: string,
    point: AxialCoordinates,
    direction: AxialCoordinates
): CoordinateLabel {
    return { key, text, at: view.labelBeside(point, addAxial(point, direction)) }
}
