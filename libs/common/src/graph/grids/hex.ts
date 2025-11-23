import { BaseCoordinatedGraph, CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { AxialCoordinates, axialToCube, CubeCoordinates } from '../coordinates.js'
import { EllipseDimensions, BoundingBox } from '../dimensions.js'
import { FlatHexDirection, PointyHexDirection } from '../directions.js'
import { NodeIdentifier } from '../graph.js'
import {
    hexCoordsToCenterPoint,
    hexDimensionsToElliptical,
    hexNeighborCoords
} from '../utils/hex.js'
import { HexDefinition, HexOrientation } from './hex/definition.js'

export const DEFAULT_POINTY_HEX_DIMENSIONS = { xRadius: 43.5, yRadius: 50 }
export const DEFAULT_FLAT_HEX_DIMENSIONS = { xRadius: 50, yRadius: 43.5 }

export type HexGridNode = CoordinatedNode<AxialCoordinates>

export class HexGrid<T extends HexGridNode = HexGridNode>
    extends BaseCoordinatedGraph<T, AxialCoordinates>
    implements CoordinatedGraph<T, AxialCoordinates>
{
    definition: HexDefinition
    orientation: HexOrientation

    // We hold the dimensions as elliptical so we don't have to keep converting
    private ellipticalDimensions: EllipseDimensions // Allows for non-regular hexes
    private _boundingBox: BoundingBox | undefined // Lazy calculated bounding box

    constructor({ hexDefinition }: { hexDefinition: HexDefinition }) {
        super()
        this.definition = hexDefinition
        this.orientation = hexDefinition.orientation

        const dimensions =
            hexDefinition.dimensions ??
            (this.orientation === HexOrientation.Pointy
                ? DEFAULT_POINTY_HEX_DIMENSIONS
                : DEFAULT_FLAT_HEX_DIMENSIONS)

        this.ellipticalDimensions = hexDimensionsToElliptical(dimensions, this.orientation)
    }

    override setNode(node: T): void {
        super.setNode(node)
        this._boundingBox = undefined
    }

    override removeNode(nodeOrId: T | NodeIdentifier): T | undefined {
        const node = super.removeNode(nodeOrId)
        if (node) {
            this._boundingBox = undefined
        }
        return node
    }

    get minMaxCoords(): {
        minX?: AxialCoordinates
        maxX?: AxialCoordinates
        minY?: AxialCoordinates
        maxY?: AxialCoordinates
    } {
        if (this.size === 0) {
            return { minX: undefined, maxX: undefined, minY: undefined, maxY: undefined }
        }
        if (this.size === 1) {
            const onlyCoords = Array.from(this)[0].coords
            return { minX: onlyCoords, maxX: onlyCoords, minY: onlyCoords, maxY: onlyCoords }
        }

        let cubeMinX: CubeCoordinates | undefined = undefined
        let cubeMaxX: CubeCoordinates | undefined = undefined
        let cubeMinY: CubeCoordinates | undefined = undefined
        let cubeMaxY: CubeCoordinates | undefined = undefined

        for (const node of this) {
            const cubeCurrent = axialToCube(node.coords)
            if (
                cubeMinX === undefined ||
                cubeMaxX === undefined ||
                cubeMinY === undefined ||
                cubeMaxY === undefined
            ) {
                cubeMinX = cubeMaxX = cubeMinY = cubeMaxY = cubeCurrent
                continue
            }

            if (this.orientation === HexOrientation.Pointy) {
                if (cubeCurrent.s > cubeMinX.s || cubeCurrent.q < cubeMinX.q) {
                    cubeMinX = cubeCurrent
                }
                if (cubeCurrent.s < cubeMaxX.s || cubeCurrent.q > cubeMaxX.q) {
                    cubeMaxX = cubeCurrent
                }
                if (cubeCurrent.r < cubeMinY.r) {
                    cubeMinY = cubeCurrent
                }
                if (cubeCurrent.r > cubeMaxY.r) {
                    cubeMaxY = cubeCurrent
                }
            } else {
                if (cubeCurrent.q < cubeMinX.q) {
                    cubeMinX = cubeCurrent
                }
                if (cubeCurrent.q > cubeMaxX.q) {
                    cubeMaxX = cubeCurrent
                }
                if (cubeCurrent.r < cubeMinY.r || cubeCurrent.s > cubeMinY.s) {
                    cubeMinY = cubeCurrent
                }
                if (cubeCurrent.r > cubeMaxY.r || cubeCurrent.s < cubeMaxY.s) {
                    cubeMaxY = cubeCurrent
                }
            }
        }
        return {
            minX: { q: cubeMinX!.q, r: cubeMinX!.r },
            maxX: { q: cubeMaxX!.q, r: cubeMaxX!.r },
            minY: { q: cubeMinY!.q, r: cubeMinY!.r },
            maxY: { q: cubeMaxY!.q, r: cubeMaxY!.r }
        }
    }

    get boundingBox(): BoundingBox {
        if (this._boundingBox !== undefined) {
            return this._boundingBox
        }

        if (this.size === 0) {
            return { x: 0, y: 0, width: 0, height: 0 }
        }
        const minMaxCoords = this.minMaxCoords
        if (
            minMaxCoords.minX === undefined ||
            minMaxCoords.maxX === undefined ||
            minMaxCoords.minY === undefined ||
            minMaxCoords.maxY === undefined
        ) {
            return { x: 0, y: 0, width: 0, height: 0 }
        }

        const cornerPoint = {
            x:
                hexCoordsToCenterPoint(
                    minMaxCoords.minX,
                    this.ellipticalDimensions,
                    this.orientation
                ).x - this.ellipticalDimensions.xRadius,
            y:
                hexCoordsToCenterPoint(
                    minMaxCoords.minY,
                    this.ellipticalDimensions,
                    this.orientation
                ).y - this.ellipticalDimensions.yRadius
        }

        const hexWidth = this.ellipticalDimensions.xRadius * 2
        const leftCenterPoint = hexCoordsToCenterPoint(
            minMaxCoords.minX,
            this.ellipticalDimensions,
            this.orientation
        )
        const rightCenterPoint = hexCoordsToCenterPoint(
            minMaxCoords.maxX,
            this.ellipticalDimensions,
            this.orientation
        )

        const hexHeight = this.ellipticalDimensions.yRadius * 2
        const topCenterPoint = hexCoordsToCenterPoint(
            minMaxCoords.minY,
            this.ellipticalDimensions,
            this.orientation
        )
        const bottomCenterPoint = hexCoordsToCenterPoint(
            minMaxCoords.maxY,
            this.ellipticalDimensions,
            this.orientation
        )
        this._boundingBox = {
            x: cornerPoint.x,
            y: cornerPoint.y,
            width: rightCenterPoint.x - leftCenterPoint.x + hexWidth,
            height: bottomCenterPoint.y - topCenterPoint.y + hexHeight
        }

        return this._boundingBox
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
        const coords = hexNeighborCoords(node.coords, this.orientation, direction)
        return this.nodeAt(coords)
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
            const coords = hexNeighborCoords(node.coords, this.orientation, direction)
            const neighbor = this.nodeAt(coords)
            return neighbor ? [neighbor] : []
        } else {
            const neighborDirections =
                this.orientation === HexOrientation.Pointy ? PointyHexDirection : FlatHexDirection
            return Object.values(neighborDirections)
                .map((direction) => hexNeighborCoords(node.coords, this.orientation, direction))
                .map((coords) => this.nodeAt(coords))
                .filter((n) => n !== undefined)
        }
    }
}
