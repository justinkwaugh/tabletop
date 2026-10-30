import {
    addAxial,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    type AxialCoordinates
} from '@tabletop/common'

// The 61-point hexagon of the GIPF board without its centre: 60 spaces in columns of 5, 6, 7, 8,
// 8, 8, 7, 6 and 5 points.
export const BOARD_RADIUS = 4

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

function ringDistance(coords: AxialCoordinates): number {
    return Math.max(Math.abs(coords.q), Math.abs(coords.r), Math.abs(coords.q + coords.r))
}

export function isSpace(coords: AxialCoordinates): boolean {
    const distance = ringDistance(coords)
    return distance > 0 && distance <= BOARD_RADIUS
}

export const SPACES: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: BOARD_RADIUS, orientation: HexOrientation.Flat })()
).filter(isSpace)

export function spaceKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

export function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return DIRECTIONS.map((direction) => addAxial(coords, direction)).filter(isSpace)
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
