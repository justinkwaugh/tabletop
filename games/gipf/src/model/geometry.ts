import {
    addAxial,
    ClockwiseFlatHexDirections,
    distanceAxial,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

// The outer ring of 24 points are dots, where pieces enter; the inner 37 are spots.
export const BOARD_RADIUS = 4
export const PLAY_RADIUS = 3

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

export const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

const CENTRE: AxialCoordinates = { q: 0, r: 0 }

export function isSpot(coords: AxialCoordinates): boolean {
    return distanceAxial(coords, CENTRE) <= PLAY_RADIUS
}

export function isDot(coords: AxialCoordinates): boolean {
    return distanceAxial(coords, CENTRE) === BOARD_RADIUS
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
