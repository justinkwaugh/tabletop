import { addAxial, type AxialCoordinates, type Point } from '@tabletop/common'
import { spaceName } from '@tabletop/dvonn'

// BoardSpace style: each diagonal column's letter below and right of its bottom space, and each
// row's number before its first space on the left.
export type CoordinateLabel = {
    key: string
    text: string
    at: Point
}

const BELOW: AxialCoordinates = { q: 0, r: 1 }
// Numbers stay level along each row, so a row starts at its left.
const BEFORE_LINE: AxialCoordinates = { q: -1, r: 0 }

export function boardLabels(
    positions: readonly AxialCoordinates[],
    // Where a label goes beside an outer space, toward a neighbour it does not have.
    beside: (coords: AxialCoordinates, toward: AxialCoordinates) => Point
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
    const label = (
        key: string,
        text: string,
        coords: AxialCoordinates,
        direction: AxialCoordinates
    ): CoordinateLabel => ({ key, text, at: beside(coords, addAxial(coords, direction)) })
    return [
        ...columnBottoms.map((coords) =>
            label(`column-${coords.q}`, spaceName(coords).slice(0, 1), coords, BELOW)
        ),
        ...lineStarts.map((coords) =>
            label(`line-${coords.r}`, spaceName(coords).slice(1), coords, BEFORE_LINE)
        )
    ]
}
