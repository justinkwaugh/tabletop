import type { OffsetCoordinates } from '@tabletop/common'
import { Ring } from '@tabletop/sol'

export const ONE_TO_FOUR_PLAYER_ANGLES: Record<number, number[]> = {
    [Ring.Core]: [298, 15, 83, 150, 225],
    [Ring.Radiative]: [284, 331, 14.5, 59.5, 104.5, 149.5, 192.5, 239],
    [Ring.Convective]: [275.5, 303, 331, 359, 26.5, 54.5, 82, 109.5, 137, 165, 192.5, 220, 248],
    [Ring.Inner]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.75, 177.25, 205, 232.5, 260
    ],
    [Ring.Outer]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.75, 177.25, 205, 232.5, 260
    ]
}

export const FIVE_PLAYER_ANGLES: Record<number, number[]> = {
    [Ring.Core]: [297, 15, 83, 150, 225],
    [Ring.Radiative]: [284, 331, 14.5, 59.5, 104.5, 149.5, 192.5, 239],
    [Ring.Convective]: [275.5, 303, 331, 359, 26.5, 54.5, 82, 109.5, 137, 165, 192.5, 220, 248],
    [Ring.Inner]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.75, 177.25, 205, 232.5, 260
    ],
    [Ring.Outer]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.75, 177.25, 205, 232.5, 260
    ]
}

export const RING_RADII: Record<number, [number, number]> = {
    [Ring.Core]: [45, 148],
    [Ring.Radiative]: [148, 261],
    [Ring.Convective]: [261, 364],
    [Ring.Inner]: [364, 472],
    [Ring.Outer]: [472, 576]
}

export const MOTHERSHIP_RADIUS = 472

export function dimensionsForSpace(numPlayers: number, coords: OffsetCoordinates) {
    const angles = numPlayers === 5 ? FIVE_PLAYER_ANGLES : ONE_TO_FOUR_PLAYER_ANGLES
    const innerRadius = RING_RADII[coords.row][0]
    const outerRadius = RING_RADII[coords.row][1]
    const startDegrees = angles[coords.row][coords.col]
    const endDegrees = angles[coords.row][(coords.col + 1) % angles[coords.row].length]
    return {
        innerRadius,
        outerRadius,
        startDegrees,
        endDegrees
    }
}
