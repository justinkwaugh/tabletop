import { AxialCoordinates, Point } from '../coordinates.js'
import {
    CircleDimensions,
    EllipseDimensions,
    RectangleDimensions,
    HexDimensions,
    isCircleDimensions,
    isEllipseDimensions,
    isRectangleDimensions
} from '../dimensions.js'
import {
    FlatHexDirection,
    isFlatHexDirection,
    isPointyHexDirection,
    PointyHexDirection
} from '../directions.js'
import { HexDefinition, HexOrientation } from '../grids/hex/definition.js'
import { HexGeometry } from '../grids/hex/geometry.js'

export function addAxial(a: AxialCoordinates, b: AxialCoordinates): AxialCoordinates {
    return { q: a.q + b.q, r: a.r + b.r }
}

export function subtractAxial(a: AxialCoordinates, b: AxialCoordinates): AxialCoordinates {
    return { q: a.q - b.q, r: a.r - b.r }
}

export function scaleAxial(coords: AxialCoordinates, factor: number): AxialCoordinates {
    return { q: coords.q * factor, r: coords.r * factor }
}

export function distanceAxial(a: AxialCoordinates, b: AxialCoordinates): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export function circleDimensionsToElliptical(
    dimensions: CircleDimensions,
    orientation?: HexOrientation
): EllipseDimensions {
    const radius = dimensions.radius
    orientation = orientation ?? HexOrientation.Pointy
    if (orientation === HexOrientation.Pointy) {
        return { xRadius: (Math.sqrt(3) / 2) * radius, yRadius: radius }
    } else {
        return { xRadius: radius, yRadius: (Math.sqrt(3) / 2) * radius }
    }
}

export function rectangleDimensionsToElliptical(
    dimensions: RectangleDimensions
): EllipseDimensions {
    return { xRadius: dimensions.width / 2, yRadius: dimensions.height / 2 }
}

export function hexDimensionsToElliptical(
    dimensions: HexDimensions,
    orientation?: HexOrientation // Needed for circle
): EllipseDimensions {
    switch (true) {
        case isEllipseDimensions(dimensions):
            return dimensions
        case isRectangleDimensions(dimensions):
            return rectangleDimensionsToElliptical(dimensions)
        case isCircleDimensions(dimensions):
            return circleDimensionsToElliptical(dimensions, orientation!)
    }

    // Can never happen
    throw new Error('Invalid hex dimensions')
}

export function hexCoordsToCenterPoint(
    coords: AxialCoordinates,
    dimensions: EllipseDimensions,
    orientation: HexOrientation
): Point {
    if (orientation === HexOrientation.Pointy) {
        return pointyHexCoordsToCenterPoint(coords, dimensions)
    } else {
        return flatHexCoordsToCenterPoint(coords, dimensions)
    }
}

export function pointyHexCoordsToCenterPoint(
    coords: AxialCoordinates,
    dimensions: EllipseDimensions
): Point {
    const { xRadius, yRadius } = dimensions
    const x = 2 * xRadius * (coords.q + coords.r / 2)
    const y = 2 * yRadius * (3 / 4) * coords.r
    return { x, y }
}

export function flatHexCoordsToCenterPoint(
    coords: AxialCoordinates,
    dimensions: EllipseDimensions
): Point {
    const { xRadius, yRadius } = dimensions
    const x = 2 * xRadius * (3 / 4) * coords.q
    const y = 2 * yRadius * (coords.r + coords.q / 2)
    return { x, y }
}

export const PointyNeighborOffsets: Record<PointyHexDirection, AxialCoordinates> = {
    [PointyHexDirection.East]: { q: 1, r: 0 }, // East
    [PointyHexDirection.Southeast]: { q: 0, r: 1 }, // Southeast
    [PointyHexDirection.Southwest]: { q: -1, r: 1 }, // Southwest
    [PointyHexDirection.West]: { q: -1, r: 0 }, // West
    [PointyHexDirection.Northwest]: { q: 0, r: -1 }, // Northwest
    [PointyHexDirection.Northeast]: { q: 1, r: -1 } // Northeast
}

export const FlatNeighborOffsets: Record<FlatHexDirection, AxialCoordinates> = {
    [FlatHexDirection.North]: { q: 0, r: -1 }, // North
    [FlatHexDirection.Northeast]: { q: 1, r: -1 }, // Northeast
    [FlatHexDirection.Southeast]: { q: 1, r: 0 }, // Southeast
    [FlatHexDirection.South]: { q: 0, r: 1 }, // South
    [FlatHexDirection.Southwest]: { q: -1, r: 1 }, // Southwest
    [FlatHexDirection.Northwest]: { q: -1, r: 0 } // Northwest
}

export function neighborCoords(
    coords: AxialCoordinates,
    orientation: HexOrientation,
    direction: PointyHexDirection | FlatHexDirection
): AxialCoordinates {
    if (orientation === HexOrientation.Pointy && isPointyHexDirection(direction)) {
        return addAxial(coords, PointyNeighborOffsets[direction])
    }
    if (orientation === HexOrientation.Flat && isFlatHexDirection(direction)) {
        return addAxial(coords, FlatNeighborOffsets[direction])
    }

    throw new Error(`Invalid direction ${direction} for hex grid with orientation ${orientation}`)
}

// Currently only produces regular geometry
export function calculateHexGeometry(
    definition: HexDefinition,
    coords: AxialCoordinates
): HexGeometry {
    const ellipticalDimensions = hexDimensionsToElliptical(
        definition.dimensions ?? { radius: 50 },
        definition.orientation
    )
    const center = hexCoordsToCenterPoint(coords, ellipticalDimensions, definition.orientation)
    const { xRadius, yRadius } = ellipticalDimensions

    const radius = definition.orientation === HexOrientation.Pointy ? yRadius : xRadius
    const corners: Point[] = []
    for (let i = 0; i < 6; i++) {
        const angleDeg = definition.orientation === HexOrientation.Pointy ? 60 * i - 30 : 60 * i
        const angleRad = (Math.PI / 180) * angleDeg

        // Should we round these?
        const x = roundNumber(center.x + radius * Math.cos(angleRad), 1) + 0
        const y = roundNumber(center.y + radius * Math.sin(angleRad), 1) + 0
        corners.push({ x, y })
    }

    return {
        center,
        vertices: corners,
        boundingBox: {
            x: center.x - xRadius,
            y: center.y - yRadius,
            width: xRadius * 2,
            height: yRadius * 2
        }
    }
}

export function roundNumber(num: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces)
    return Math.round((num + Number.EPSILON) * factor) / factor
}
