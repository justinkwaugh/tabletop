import { addAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import { spaceName } from '@tabletop/dvonn'

// BoardSpace style: each diagonal column's letter below and right of its bottom space, and each
// row's number before its first space on the left.
export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

// Beyond the sand's edge, on the table.
const LABEL_REACH = 0.98
const BELOW: AxialCoordinates = { q: 0, r: 1 }
// Numbers stay level along each row, so a row starts at its left.
const BEFORE_LINE: AxialCoordinates = { q: -1, r: 0 }

export function boardLabels(
    positions: readonly AxialCoordinates[],
    center: (coords: AxialCoordinates) => Point
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
            labelBeside(`column-${coords.q}`, spaceName(coords).slice(0, 1), coords, BELOW, center)
        ),
        ...lineStarts.map((coords) =>
            labelBeside(`line-${coords.r}`, spaceName(coords).slice(1), coords, BEFORE_LINE, center)
        )
    ]
}

function labelBeside(
    key: string,
    text: string,
    point: AxialCoordinates,
    direction: AxialCoordinates,
    center: (coords: AxialCoordinates) => Point
): CoordinateLabel {
    const from = center(point)
    const to = center(addAxial(point, direction))
    return {
        key,
        text,
        at: {
            x: from.x + (to.x - from.x) * LABEL_REACH,
            y: from.y + (to.y - from.y) * LABEL_REACH
        }
    }
}
