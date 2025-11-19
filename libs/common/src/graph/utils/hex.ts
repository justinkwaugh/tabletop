import { AxialCoordinates, Point } from '../coordinates.js'
import { DimensionsCircle, DimensionsElliptical, DimensionsRectangle } from '../dimensions.js'
import { HexOrientation } from '../grids/hex.js'

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
    dimensions: DimensionsCircle,
    orientation: HexOrientation
): DimensionsElliptical {
    const radius = dimensions.radius
    if (orientation === HexOrientation.PointyTop) {
        return { xRadius: (Math.sqrt(3) / 2) * radius, yRadius: radius }
    } else {
        return { xRadius: radius, yRadius: (Math.sqrt(3) / 2) * radius }
    }
}

export function rectangleDimensionsToElliptical(
    dimensions: DimensionsRectangle
): DimensionsElliptical {
    return { xRadius: dimensions.width / 2, yRadius: dimensions.height / 2 }
}

export function pointyHexToCenterPoint(
    coords: AxialCoordinates,
    dimensions: DimensionsElliptical
): Point {
    const { xRadius, yRadius } = dimensions
    const x = 2 * xRadius * (coords.q + coords.r / 2)
    const y = 2 * yRadius * (3 / 4) * coords.r
    return { x, y }
}

export function flatHexToCenterPoint(
    coords: AxialCoordinates,
    dimensions: DimensionsElliptical
): Point {
    const { xRadius, yRadius } = dimensions
    const x = 2 * xRadius * (3 / 4) * coords.q
    const y = 2 * yRadius * (coords.r + coords.q / 2)
    return { x, y }
}

export function hexToCenterPoint(
    coords: AxialCoordinates,
    dimensions: DimensionsElliptical,
    orientation: HexOrientation
): Point {
    if (orientation === HexOrientation.PointyTop) {
        return pointyHexToCenterPoint(coords, dimensions)
    } else {
        return flatHexToCenterPoint(coords, dimensions)
    }
}
