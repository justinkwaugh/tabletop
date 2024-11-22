import { Color, type OffsetCoordinates } from '@tabletop/common'
import { Ring } from '@tabletop/sol'

export const CENTER_POINT = { x: 639, y: 640 }
export const CENTER_TRANSLATION = `translate(${CENTER_POINT.x}, ${CENTER_POINT.y})`

export const ONE_TO_FOUR_PLAYER_ANGLES: Record<number, number[]> = {
    [Ring.Core]: [298, 15, 83, 150, 225.5],
    [Ring.Radiative]: [284, 331, 14.5, 59.5, 104.5, 149.5, 192.5, 239],
    [Ring.Convective]: [275.5, 303.5, 331, 359, 26.5, 54.5, 82, 109.5, 137, 165, 192.5, 220, 248],
    [Ring.Inner]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.5, 177.25, 205, 232.5, 260
    ],
    [Ring.Outer]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.5, 177.25, 205, 232.5, 260
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

export type MothershipOffsets = {
    x: number
    y: number
    angle: number
}

export const MOTHERSHIP_OFFSETS: Record<string, MothershipOffsets> = {
    [Color.Blue]: {
        x: -132,
        y: -200,
        angle: 3
    },
    [Color.Green]: {
        x: -100,
        y: -200,
        angle: 3
    },
    [Color.Purple]: {
        x: -84,
        y: -200,
        angle: 5.5
    },
    [Color.Gray]: {
        x: -122,
        y: -200,
        angle: 3
    },
    [Color.Black]: {
        x: -92,
        y: -200,
        angle: 5.8
    }
}

export function getCirclePoint(radius: number, radians: number) {
    return {
        x: radius * Math.cos(radians),
        y: radius * Math.sin(radians)
    }
}

export function toRadians(degrees: number) {
    return degrees * (Math.PI / 180)
}

function getMothershipAngle(index: number) {
    return ONE_TO_FOUR_PLAYER_ANGLES[Ring.Outer][index]
}

export function getMothershipTransformation(color: Color, index: number) {
    const offsets = MOTHERSHIP_OFFSETS[color]
    const radius = MOTHERSHIP_RADIUS
    const degrees = getMothershipAngle(index) + offsets.angle
    const point = getCirclePoint(radius, toRadians(degrees))
    return `${translateFromCenter(point.x, point.y)} scale(.4) rotate(${degrees}) translate(${offsets.x},${offsets.y})`
}

export function translateFromCenter(x: number, y: number) {
    return `translate(${CENTER_POINT.x + x}, ${CENTER_POINT.y + y})`
}

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
