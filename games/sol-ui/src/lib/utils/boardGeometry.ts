import { Color, Point, type OffsetCoordinates } from '@tabletop/common'
import { Ring } from '@tabletop/sol'

export const CENTER_POINT = { x: 640, y: 640 }
export const CENTER_TRANSLATION = `translate(${CENTER_POINT.x}, ${CENTER_POINT.y})`

export const ONE_TO_FOUR_PLAYER_ANGLES: Record<number, number[]> = {
    [Ring.Center]: [0],
    [Ring.Core]: [298, 15, 83, 150, 225.5],
    [Ring.Radiative]: [284, 331, 15, 59.5, 104.5, 149.5, 192.5, 239],
    [Ring.Convective]: [275.5, 303.5, 331, 359, 26.5, 54.5, 82, 109.5, 137, 165, 192.5, 220, 248],
    [Ring.Inner]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.5, 177.25, 205, 232.5, 260
    ],
    [Ring.Outer]: [
        287.75, 315.5, 343.25, 11, 38.75, 66.5, 94.25, 122, 149.5, 177.25, 205, 232.5, 260
    ]
}

export const FIVE_PLAYER_ANGLES: Record<number, number[]> = {
    [Ring.Center]: [0],
    [Ring.Core]: [297, 14.5, 83, 150, 225],
    [Ring.Radiative]: [284, 331, 14.5, 59.5, 104.5, 149.5, 192.5, 239],
    [Ring.Convective]: [
        277.25, 304.5, 331, 358.75, 25.75, 52.5, 80.75, 109.5, 137.25, 165, 192.5, 220, 248
    ],
    [Ring.Inner]: [
        277.25, 299.75, 322.25, 344.75, 7.25, 29.75, 52.25, 74.75, 97.25, 119.75, 142.25, 164.75,
        187.25, 209.75, 232.25, 254.75
    ],
    [Ring.Outer]: [
        277.25, 299.75, 322.25, 344.75, 7.25, 29.75, 52.25, 74.75, 97.25, 119.75, 142.25, 164.75,
        187.25, 209.75, 232.25, 254.75
    ]
}

export const RING_RADII: Record<number, [number, number]> = {
    [Ring.Center]: [0, 45],
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
    rotation: number
}

export const MOTHERSHIP_OFFSETS: Record<string, MothershipOffsets> = {
    [Color.Blue]: {
        x: -132,
        y: -200,
        angle: -3,
        rotation: 180
    },
    [Color.Green]: {
        x: -100,
        y: -200,
        angle: -3,
        rotation: 180
    },
    [Color.Purple]: {
        x: -84,
        y: -200,
        angle: 5,
        rotation: 0
    },
    [Color.Gray]: {
        x: -122,
        y: -200,
        angle: 2.25,
        rotation: 0
    },
    [Color.Black]: {
        x: -92,
        y: -200,
        angle: 5.3,
        rotation: 0
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

export function getMothershipSpotAngle(numPlayers: number, index: number) {
    const angles = numPlayers === 5 ? FIVE_PLAYER_ANGLES : ONE_TO_FOUR_PLAYER_ANGLES
    return angles[Ring.Outer][index]
}

export function getMothershipSpotPoint(numPlayers: number, index: number) {
    const degrees = getMothershipSpotAngle(numPlayers, index)
    return getCirclePoint(MOTHERSHIP_RADIUS, toRadians(degrees))
}

export function getMothershipAngle(numPlayers: number, color: Color, index: number) {
    const offsets = MOTHERSHIP_OFFSETS[color]
    return getMothershipSpotAngle(numPlayers, index) + offsets.angle
}

export function getMothershipTransformation(numPlayers: number, color: Color, index: number) {
    const radius = MOTHERSHIP_RADIUS
    const degrees = getMothershipAngle(numPlayers, color, index)
    const point = getCirclePoint(radius, toRadians(degrees))
    return `translate(${point.x}, ${point.y}) `
}

export function translateFromCenter(x: number, y: number) {
    return `translate(${CENTER_POINT.x + x}, ${CENTER_POINT.y + y})`
}

export function offsetFromCenter(point: Point) {
    return {
        x: CENTER_POINT.x + point.x,
        y: CENTER_POINT.y + point.y
    }
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

export type GatePosition = {
    radius: number
    angle: number
}

export function getGatePosition(
    numPlayers: number,
    innerCoords: OffsetCoordinates,
    outerCoords: OffsetCoordinates
): GatePosition {
    const innerDimensions = dimensionsForSpace(numPlayers, innerCoords)
    const outerDimensions = dimensionsForSpace(numPlayers, outerCoords)
    const radius = innerDimensions.outerRadius

    if (outerDimensions.startDegrees > outerDimensions.endDegrees) {
        if (innerDimensions.startDegrees < outerDimensions.endDegrees) {
            innerDimensions.startDegrees = 360 + innerDimensions.startDegrees
            innerDimensions.endDegrees = 360 + innerDimensions.endDegrees
        }

        outerDimensions.endDegrees = 360 + outerDimensions.endDegrees

        if (innerDimensions.startDegrees > innerDimensions.endDegrees) {
            innerDimensions.endDegrees = 360 + innerDimensions.endDegrees
        }
    } else if (innerDimensions.startDegrees > innerDimensions.endDegrees) {
        if (
            innerDimensions.startDegrees > outerDimensions.startDegrees &&
            innerDimensions.endDegrees > outerDimensions.startDegrees
        ) {
            innerDimensions.startDegrees = 0 - (360 - innerDimensions.startDegrees)
        } else {
            innerDimensions.endDegrees = 360 + innerDimensions.endDegrees
        }
    }

    if (
        outerDimensions.startDegrees >= innerDimensions.startDegrees &&
        outerDimensions.endDegrees <= innerDimensions.endDegrees
    ) {
        return {
            radius,
            angle: (outerDimensions.startDegrees + outerDimensions.endDegrees) / 2
        }
    } else if (
        innerDimensions.startDegrees >= outerDimensions.startDegrees &&
        innerDimensions.endDegrees <= outerDimensions.endDegrees
    ) {
        return {
            radius,
            angle: (innerDimensions.startDegrees + innerDimensions.endDegrees) / 2
        }
    } else if (
        innerDimensions.startDegrees > outerDimensions.startDegrees &&
        innerDimensions.startDegrees < outerDimensions.endDegrees
    ) {
        return {
            radius,
            angle: (innerDimensions.startDegrees + outerDimensions.endDegrees) / 2
        }
    } else {
        return {
            radius,
            angle: (innerDimensions.endDegrees + outerDimensions.startDegrees) / 2
        }
    }
}

export function getSpaceCentroid(numPlayers: number, coords: OffsetCoordinates) {
    const { angle, radius } = getSpaceCentroidAngleAndRadius(numPlayers, coords)
    return getCirclePoint(radius, toRadians(angle))
}

export function getSpaceCentroidAngleAndRadius(numPlayers: number, coords: OffsetCoordinates) {
    const { innerRadius, outerRadius, startDegrees, endDegrees } = dimensionsForSpace(
        numPlayers,
        coords
    )

    const radius = (innerRadius + outerRadius) / 2
    const angle = (startDegrees + (startDegrees > endDegrees ? endDegrees + 360 : endDegrees)) / 2
    return { angle, radius }
}

export function addToAngle(angleDegrees: number, amount: number) {
    return normalizeAngle(angleDegrees + amount)
}

export function subtractFromAngle(angleDegrees: number, amount: number) {
    return normalizeAngle(angleDegrees - amount)
}

export function normalizeAngle(angleDegrees: number) {
    if (angleDegrees < 0) {
        return 360 + (angleDegrees % 360)
    } else if (angleDegrees >= 360) {
        return angleDegrees % 360
    }
    return angleDegrees
}
