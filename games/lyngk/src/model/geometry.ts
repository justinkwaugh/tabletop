import {
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    FlatNeighborOffsets,
    HexOrientation,
    hexSpiralPattern,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'

// The 43-point board: a hexagon of radius 3 with one extra point outside the middle of each edge.
export const HEX_RADIUS = 3

export const DIRECTIONS: readonly AxialCoordinates[] = ClockwiseFlatHexDirections.map(
    (direction) => FlatNeighborOffsets[direction]
)

export function ringDistance(coords: AxialCoordinates): number {
    return Math.max(Math.abs(coords.q), Math.abs(coords.r), Math.abs(coords.q + coords.r))
}

export const TIPS: readonly AxialCoordinates[] = [
    { q: 2, r: -4 },
    { q: 4, r: -2 },
    { q: 2, r: 2 },
    { q: -2, r: 4 },
    { q: -4, r: 2 },
    { q: -2, r: -2 }
]

export function isPoint(coords: AxialCoordinates): boolean {
    return ringDistance(coords) <= HEX_RADIUS || TIPS.some((tip) => sameCoordinates(tip, coords))
}

export const POINTS: readonly AxialCoordinates[] = Array.from(
    hexSpiralPattern({ radius: HEX_RADIUS + 1, orientation: HexOrientation.Flat })()
).filter(isPoint)

export function pointKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}
