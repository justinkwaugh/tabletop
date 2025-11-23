import { OffsetCoordinates, Point } from '../coordinates.js'
import { RectangleDimensions } from '../dimensions.js'
import { CardinalDirection, OrdinalDirection } from '../directions.js'
import { CellGeometry } from '../grids/rectilinear/geometry.js'

export function areOrthogonal(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
    return coordsA.row === coordsB.row || coordsA.col === coordsB.col
}

export function cellCoordsToCenterPoint(
    coords: OffsetCoordinates,
    dimensions: RectangleDimensions
): Point {
    const { width, height } = dimensions
    const x = width * coords.col
    const y = height * coords.row
    return { x, y }
}

export function cellNeighborCoords(
    coords: OffsetCoordinates,
    direction: CardinalDirection | OrdinalDirection
): OffsetCoordinates {
    const { row, col } = coords
    switch (direction) {
        case CardinalDirection.North:
            return { row: row - 1, col }
        case CardinalDirection.South:
            return { row: row + 1, col }
        case CardinalDirection.East:
            return { row, col: col + 1 }
        case CardinalDirection.West:
            return { row, col: col - 1 }
        case OrdinalDirection.Northeast:
            return { row: row - 1, col: col + 1 }
        case OrdinalDirection.Northwest:
            return { row: row - 1, col: col - 1 }
        case OrdinalDirection.Southeast:
            return { row: row + 1, col: col + 1 }
        case OrdinalDirection.Southwest:
            return { row: row + 1, col: col - 1 }
    }
}

export function calculateCellGeometry(
    definition: RectangleDimensions,
    coords: OffsetCoordinates
): CellGeometry {
    const center = cellCoordsToCenterPoint(coords, definition)
    const { width, height } = definition

    const corners: Point[] = [
        { x: center.x - width / 2, y: center.y - height / 2 }, // Top-left
        { x: center.x + width / 2, y: center.y - height / 2 }, // Top-right
        { x: center.x + width / 2, y: center.y + height / 2 }, // Bottom-right
        { x: center.x - width / 2, y: center.y + height / 2 } // Bottom-left
    ]

    return {
        center,
        vertices: corners,
        boundingBox: {
            x: center.x - width / 2,
            y: center.y - height / 2,
            width: width,
            height: height
        }
    }
}
