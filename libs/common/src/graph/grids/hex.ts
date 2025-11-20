import { BaseCoordinatedGraph, CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { AxialCoordinates, axialToCube, Point } from '../coordinates.js'
import {
    DimensionsRectangle,
    DimensionsCircle,
    DimensionsEllipse,
    BoundingBox
} from '../dimensions.js'
import {
    FlatHexDirection,
    isFlatHexDirection,
    isPointyHexDirection,
    PointyHexDirection
} from '../directions.js'
import { NodeIdentifier } from '../graph.js'
import { addAxial, hexCoordsToCenterPoint, hexDimensionsToElliptical } from '../utils/hex.js'

export enum HexOrientation {
    PointyTop = 'pointy-top',
    FlatTop = 'flat-top'
}

export type HexDefinition = {
    orientation: HexOrientation
    dimensions?: DimensionsRectangle | DimensionsEllipse | DimensionsCircle
}

export const DEFAULT_POINTY_TOP_HEX_DIMENSIONS = { xRadius: 43.5, yRadius: 50 }
export const DEFAULT_FLAT_TOP_HEX_DIMENSIONS = { xRadius: 50, yRadius: 43.5 }

export type HexGeometry = {
    center: Point
    vertices: Point[]
}

export type HexGridNode = CoordinatedNode<AxialCoordinates>

export class HexGrid<T extends HexGridNode = HexGridNode>
    extends BaseCoordinatedGraph<T, AxialCoordinates>
    implements CoordinatedGraph<T, AxialCoordinates>
{
    orientation: HexOrientation
    ellipticalDimensions: DimensionsEllipse // Allows for non-regular hexes

    // These are used for quick boundary calculations
    minXCoords: AxialCoordinates = { q: 0, r: 0 }
    minYCoords: AxialCoordinates = { q: 0, r: 0 }
    maxXCoords: AxialCoordinates = { q: 0, r: 0 }
    maxYCoords: AxialCoordinates = { q: 0, r: 0 }

    constructor({ hexDefinition }: { hexDefinition: HexDefinition }) {
        super()
        this.orientation = hexDefinition.orientation

        const dimensions =
            hexDefinition.dimensions ??
            (this.orientation === HexOrientation.PointyTop
                ? DEFAULT_POINTY_TOP_HEX_DIMENSIONS
                : DEFAULT_FLAT_TOP_HEX_DIMENSIONS)

        this.ellipticalDimensions = hexDimensionsToElliptical(dimensions, this.orientation)
    }

    get pixelWidth(): number {
        if (this.size === 0) return 0

        const hexWidth = this.ellipticalDimensions.xRadius * 2
        const leftCenterPoint = hexCoordsToCenterPoint(
            this.minXCoords,
            this.ellipticalDimensions,
            this.orientation
        )
        const rightCenterPoint = hexCoordsToCenterPoint(
            this.maxXCoords,
            this.ellipticalDimensions,
            this.orientation
        )
        return rightCenterPoint.x - leftCenterPoint.x + hexWidth
    }

    get pixelHeight(): number {
        if (this.size === 0) return 0

        const hexHeight = this.ellipticalDimensions.yRadius * 2
        const topCenterPoint = hexCoordsToCenterPoint(
            this.minYCoords,
            this.ellipticalDimensions,
            this.orientation
        )
        const bottomCenterPoint = hexCoordsToCenterPoint(
            this.maxYCoords,
            this.ellipticalDimensions,
            this.orientation
        )
        return bottomCenterPoint.y - topCenterPoint.y + hexHeight
    }

    get cornerPoint(): Point {
        if (this.size === 0) {
            return { x: 0, y: 0 }
        }
        return {
            x:
                hexCoordsToCenterPoint(this.minXCoords, this.ellipticalDimensions, this.orientation)
                    .x - this.ellipticalDimensions.xRadius,
            y:
                hexCoordsToCenterPoint(this.minYCoords, this.ellipticalDimensions, this.orientation)
                    .y - this.ellipticalDimensions.yRadius
        }
    }

    get centerOffset(): Point {
        const cornerPoint = this.cornerPoint
        return {
            x: -cornerPoint.x,
            y: -cornerPoint.y
        }
    }

    override setNode(node: T): void {
        super.setNode(node)

        const { q, r } = node.coords

        if (this.size === 1) {
            this.minXCoords = { q, r }
            this.maxXCoords = { q, r }
            this.minYCoords = { q, r }
            this.maxYCoords = { q, r }
        } else if (this.orientation === HexOrientation.PointyTop) {
            const cubeMinX = axialToCube(this.minXCoords)
            const cubeMaxX = axialToCube(this.maxXCoords)
            const cubeCurrent = axialToCube(node.coords)

            if (cubeCurrent.s > cubeMinX.s || cubeCurrent.q < cubeMinX.q) {
                this.minXCoords = { q, r }
            }
            if (cubeCurrent.s < cubeMaxX.s || cubeCurrent.q > cubeMaxX.q) {
                this.maxXCoords = { q, r }
            }
            if (r < this.minYCoords.r) {
                this.minYCoords = { q, r }
            }
            if (r > this.maxYCoords.r) {
                this.maxYCoords = { q, r }
            }
        } else {
            const cubeMinY = axialToCube(this.minYCoords)
            const cubeMaxY = axialToCube(this.maxYCoords)
            const cubeCurrent = axialToCube(node.coords)

            if (q < this.minXCoords.q) {
                this.minXCoords = { q, r }
            }
            if (q > this.maxXCoords.q) {
                this.maxXCoords = { q, r }
            }
            if (cubeCurrent.r < cubeMinY.r || cubeCurrent.s > cubeMinY.s) {
                this.minYCoords = { q, r }
            }
            if (cubeCurrent.r > cubeMaxY.r || cubeCurrent.s < cubeMaxY.s) {
                this.maxYCoords = { q, r }
            }
        }
    }

    override removeNode(nodeOrId: T | NodeIdentifier): T | undefined {
        const node = super.removeNode(nodeOrId)

        if (node) {
            const { q, r } = node.coords
            // if (
            //     row === this.minRow ||
            //     row === this.maxRow ||
            //     col === this.minCol ||
            //     col === this.maxCol
            // ) {
            //     for (const n of this) {
            //         const { row: nRow, col: nCol } = n.coords
            //         if (nRow < this.minRow) {
            //             this.minRow = nRow
            //         }
            //         if (nRow > this.maxRow) {
            //             this.maxRow = nRow
            //         }
            //         if (nCol < this.minCol) {
            //             this.minCol = nCol
            //         }
            //         if (nCol > this.maxCol) {
            //             this.maxCol = nCol
            //         }
            //     }
            // }
        }
        return node
    }

    neighborAt(
        coords: AxialCoordinates,
        direction: PointyHexDirection | FlatHexDirection
    ): T | undefined {
        const node = this.nodeAt(coords)
        if (!node) {
            return undefined
        }
        return this.neighborOf(node, direction)
    }

    neighborOf(node: T, direction: PointyHexDirection | FlatHexDirection): T | undefined {
        const neighborCoords = this.neighborCoords(node.coords, direction)
        return this.nodeAt(neighborCoords)
    }

    override neighborsAt(
        coords: AxialCoordinates,
        direction?: PointyHexDirection | FlatHexDirection
    ): T[] {
        const node = this.nodeAt(coords)
        if (!node) {
            return []
        }
        return this.neighborsOf(node, direction)
    }

    override neighborsOf(node: T, direction?: PointyHexDirection | FlatHexDirection): T[] {
        if (direction) {
            const neighborCoords = this.neighborCoords(node.coords, direction)
            const neighbor = this.nodeAt(neighborCoords)
            return neighbor ? [neighbor] : []
        } else {
            const neighborDirections =
                this.orientation === HexOrientation.PointyTop
                    ? PointyHexDirection
                    : FlatHexDirection
            return Object.values(neighborDirections)
                .map((direction) => this.neighborCoords(node.coords, direction))
                .map((coords) => this.nodeAt(coords))
                .filter((n) => n !== undefined)
        }
    }

    neighborCoords(
        coords: AxialCoordinates,
        direction: PointyHexDirection | FlatHexDirection
    ): AxialCoordinates {
        if (this.orientation === HexOrientation.PointyTop && isPointyHexDirection(direction)) {
            return addAxial(coords, PointyNeighborOffsets[direction])
        }
        if (this.orientation === HexOrientation.FlatTop && isFlatHexDirection(direction)) {
            return addAxial(coords, FlatNeighborOffsets[direction])
        }

        throw new Error(
            `Invalid direction ${direction} for hex grid with orientation ${this.orientation}`
        )
    }

    getBoundingBox(offset?: Point): BoundingBox {
        const cornerPoint = this.cornerPoint
        offset = offset ?? { x: 0, y: 0 }
        return {
            x: cornerPoint.x + offset.x,
            y: cornerPoint.y + offset.y,
            width: this.pixelWidth,
            height: this.pixelHeight
        }
    }

    getBoundingBoxForCoords(coords: AxialCoordinates, offset?: Point): BoundingBox {
        const centerPoint = hexCoordsToCenterPoint(
            coords,
            this.ellipticalDimensions,
            this.orientation
        )
        offset = offset ?? { x: 0, y: 0 }
        return {
            x: centerPoint.x - this.ellipticalDimensions.xRadius + offset.x,
            y: centerPoint.y - this.ellipticalDimensions.yRadius + offset.y,
            width: this.ellipticalDimensions.xRadius * 2,
            height: this.ellipticalDimensions.yRadius * 2
        }
    }
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
