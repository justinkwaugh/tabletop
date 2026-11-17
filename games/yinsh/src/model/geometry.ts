import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    distanceAxial,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    sameCoordinates,
    scaleAxial,
    type AxialCoordinates
} from '@tabletop/common'

// The 85-point board: a hexagon of radius 5 without its six corners.
export const HEX_RADIUS = 5

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// One direction per line orientation, for scanning rows.
export const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

const CENTER: AxialCoordinates = { q: 0, r: 0 }

// The hexagon's corners, which the board leaves out, in the order of DIRECTIONS.
export const CORNERS: readonly AxialCoordinates[] = DIRECTIONS.map((direction) =>
    scaleAxial(direction, HEX_RADIUS)
)

// Submitted coordinates can be any number, and fractions pass the distance test.
export function isPoint(coords: AxialCoordinates): boolean {
    return (
        Number.isInteger(coords.q) &&
        Number.isInteger(coords.r) &&
        distanceAxial(coords, CENTER) <= HEX_RADIUS &&
        !CORNERS.some((corner) => sameCoordinates(corner, coords))
    )
}

export const POINTS: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: HEX_RADIUS, orientation: HexOrientation.Flat })()
).filter(isPoint)

export function pointKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

// The points from start along a direction, start included, for as long as they stay on the board.
export function lineFrom(start: AxialCoordinates, direction: AxialCoordinates): AxialCoordinates[] {
    const line: AxialCoordinates[] = []
    for (let current = start; isPoint(current); current = addAxial(current, direction)) {
        line.push(current)
    }
    return line
}

// Every line of the board, end to end, each with the direction it runs in from its first point.
export type BoardLine = { direction: AxialCoordinates; points: AxialCoordinates[] }

export const LINES: readonly BoardLine[] = AXES.flatMap((direction) =>
    POINTS.filter((coords) => !isPoint(addAxial(coords, scaleAxial(direction, -1)))).map(
        (start) => ({ direction, points: lineFrom(start, direction) })
    )
)

// The points from one end to the other when both lie on one board line, otherwise undefined.
export function pointsBetween(
    from: AxialCoordinates,
    to: AxialCoordinates
): AxialCoordinates[] | undefined {
    const dq = to.q - from.q
    const dr = to.r - from.r
    const steps = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
    if (steps === 0) {
        return [from]
    }
    const direction = { q: dq / steps, r: dr / steps }
    if (!DIRECTIONS.some((d) => sameCoordinates(d, direction))) {
        return undefined
    }
    return Array.from({ length: steps + 1 }, (_, index) =>
        addAxial(from, scaleAxial(direction, index))
    )
}
