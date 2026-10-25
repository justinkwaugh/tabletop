import { addAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import { pointName } from '@tabletop/yinsh'
import { VIEW } from './geometry.js'

// BoardSpace style: each column's letter below its bottom point, and each line's number before
// its first point on the left, where the line of that number starts.
export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

const BELOW: AxialCoordinates = { q: 0, r: 1 }
// Numbers stay level along the lines that run down to the right, so a line starts at its left.
const BEFORE_LINE: AxialCoordinates = { q: -1, r: 0 }

export function boardLabels(positions: readonly AxialCoordinates[]): CoordinateLabel[] {
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
                return members.find((coords) => along(coords) === end) ?? members[0]
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
            labelBeside(`column-${coords.q}`, pointName(coords).slice(0, 1), coords, BELOW)
        ),
        ...lineStarts.map((coords) =>
            labelBeside(`line-${coords.r}`, pointName(coords).slice(1), coords, BEFORE_LINE)
        )
    ]
}

function labelBeside(
    key: string,
    text: string,
    point: AxialCoordinates,
    direction: AxialCoordinates
): CoordinateLabel {
    return { key, text, at: VIEW.labelBeside(point, addAxial(point, direction)) }
}
