import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    distanceAxial,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

// A 61-point hexagon without its centre: 60 spaces in columns of 5, 6, 7, 8, 8, 8, 7, 6 and 5
// points.
export const BOARD_RADIUS = 4

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

const CENTRE: AxialCoordinates = { q: 0, r: 0 }

// Submitted coordinates can be any number, and fractions pass the distance test.
export function isSpace(coords: AxialCoordinates): boolean {
    if (!Number.isInteger(coords.q) || !Number.isInteger(coords.r)) {
        return false
    }
    const distance = distanceAxial(coords, CENTRE)
    return distance > 0 && distance <= BOARD_RADIUS
}

export const SPACES: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
).filter(isSpace)

export function spaceKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

// Rules E1 and F3: a stack moves in a straight line over vacant spaces to the first occupied one;
// it never crosses the centre, which is not a space.
export function firstOccupiedFrom(
    from: AxialCoordinates,
    direction: AxialCoordinates,
    isOccupied: (coords: AxialCoordinates) => boolean
): AxialCoordinates | undefined {
    for (
        let current = addAxial(from, direction);
        isSpace(current);
        current = addAxial(current, direction)
    ) {
        if (isOccupied(current)) {
            return current
        }
    }
    return undefined
}
