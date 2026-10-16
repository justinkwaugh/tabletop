import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

// The 61-point board: the outer ring of 24 points are dots, where pieces enter; the inner 37 are spots.
export const BOARD_RADIUS = 4
export const PLAY_RADIUS = 3

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

// One direction per line orientation, for scanning rows.
export const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

export function ringDistance(coords: AxialCoordinates): number {
    return Math.max(Math.abs(coords.q), Math.abs(coords.r), Math.abs(coords.q + coords.r))
}

export function isSpot(coords: AxialCoordinates): boolean {
    return ringDistance(coords) <= PLAY_RADIUS
}

export function isDot(coords: AxialCoordinates): boolean {
    return ringDistance(coords) === BOARD_RADIUS
}

export const ALL_POINTS: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
)

export const SPOTS: readonly AxialCoordinates[] = ALL_POINTS.filter(isSpot)
export const DOTS: readonly AxialCoordinates[] = ALL_POINTS.filter(isDot)

export type Entry = {
    dot: AxialCoordinates
    direction: AxialCoordinates
    line: AxialCoordinates[]
}

// The spots a piece entering from a dot in a direction passes, from the first spot to the far edge.
export function lineFrom(start: AxialCoordinates, direction: AxialCoordinates): AxialCoordinates[] {
    const line: AxialCoordinates[] = []
    let current = start
    while (isSpot(current)) {
        line.push(current)
        current = addAxial(current, direction)
    }
    return line
}

export const ENTRIES: readonly Entry[] = DOTS.flatMap((dot) =>
    DIRECTIONS.filter((direction) => isSpot(addAxial(dot, direction))).map((direction) => ({
        dot,
        direction,
        line: lineFrom(addAxial(dot, direction), direction)
    }))
)

export function pointKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}
