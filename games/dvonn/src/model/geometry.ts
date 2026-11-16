import {
    addAxial,
    ClockwisePointyHexDirections,
    coordinatesToNumber,
    PointyNeighborOffsets,
    scaleAxial,
    type AxialCoordinates
} from '@tabletop/common'

// The 49-space board: five horizontal rows of 9, 10, 11, 10 and 9 spaces, the middle row at r = 0.
export const ROWS = 5
export const MIDDLE_ROW_LENGTH = 11

const ROW_REACH = (ROWS - 1) / 2
const COLUMN_REACH = (MIDDLE_ROW_LENGTH - 1) / 2

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwisePointyHexDirections.map(
    (direction) => PointyNeighborOffsets[direction]
)

export function isSpace(coords: AxialCoordinates): boolean {
    return (
        Math.abs(coords.r) <= ROW_REACH &&
        Math.abs(coords.q) <= COLUMN_REACH &&
        Math.abs(coords.q + coords.r) <= COLUMN_REACH
    )
}

export const SPACES: readonly AxialCoordinates[] = Array.from(
    { length: ROWS },
    (_, row) => row - ROW_REACH
).flatMap((r) =>
    Array.from({ length: MIDDLE_ROW_LENGTH }, (_, column) => ({
        q: column - COLUMN_REACH,
        r
    })).filter(isSpace)
)

export function spaceKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

export function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return DIRECTIONS.map((direction) => addAxial(coords, direction)).filter(isSpace)
}

export function stepsFrom(
    from: AxialCoordinates,
    direction: AxialCoordinates,
    distance: number
): AxialCoordinates {
    return addAxial(from, scaleAxial(direction, distance))
}
