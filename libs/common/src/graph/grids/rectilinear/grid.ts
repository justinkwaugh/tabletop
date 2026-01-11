import { BaseCoordinatedGraph } from '../../coordinatedGraph.js'
import type { CoordinatedGraph, CoordinatedNode } from '../../coordinatedGraph.js'
import type { OffsetCoordinates } from '../../coordinates.js'
import type { BoundingBox, RectangleDimensions } from '../../dimensions.js'
import { CardinalDirection, OrdinalDirection } from '../../directions.js'
import type { NodeIdentifier } from '../../graph.js'
import { cellCoordsToCenterPoint, cellNeighborCoords } from '../../utils/rectilinear.js'

export type RectilinearGridNode = CoordinatedNode<OffsetCoordinates>

export class RectilinearGrid<T extends RectilinearGridNode = RectilinearGridNode>
    extends BaseCoordinatedGraph<T, OffsetCoordinates>
    implements CoordinatedGraph<T, OffsetCoordinates>
{
    cellDefinition: RectangleDimensions

    private _boundingBox: BoundingBox | undefined // Lazy calculated bounding box

    constructor(cellDefinition?: RectangleDimensions) {
        super()
        this.cellDefinition = cellDefinition ?? { width: 100, height: 100 }
    }

    get minMaxCoords(): {
        minX?: OffsetCoordinates
        maxX?: OffsetCoordinates
        minY?: OffsetCoordinates
        maxY?: OffsetCoordinates
    } {
        if (this.size === 0) {
            return { minX: undefined, maxX: undefined, minY: undefined, maxY: undefined }
        }
        if (this.size === 1) {
            const onlyCoords = Array.from(this)[0].coords
            return { minX: onlyCoords, maxX: onlyCoords, minY: onlyCoords, maxY: onlyCoords }
        }

        let minX: OffsetCoordinates | undefined = undefined
        let maxX: OffsetCoordinates | undefined = undefined
        let minY: OffsetCoordinates | undefined = undefined
        let maxY: OffsetCoordinates | undefined = undefined

        for (const node of this) {
            if (
                minX === undefined ||
                maxX === undefined ||
                minY === undefined ||
                maxY === undefined
            ) {
                minX = maxX = minY = maxY = node.coords
                continue
            }

            if (node.coords.col < minX.col) {
                minX = node.coords
            }
            if (node.coords.col > maxX.col) {
                maxX = node.coords
            }
            if (node.coords.row < minY.row) {
                minY = node.coords
            }
            if (node.coords.row > maxY.row) {
                maxY = node.coords
            }
        }
        return {
            minX,
            maxX,
            minY,
            maxY
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

        const minX =
            cellCoordsToCenterPoint(minMaxCoords.minX, this.cellDefinition).x -
            this.cellDefinition.width / 2
        const minY =
            cellCoordsToCenterPoint(minMaxCoords.minY, this.cellDefinition).y -
            this.cellDefinition.height / 2
        const maxX =
            cellCoordsToCenterPoint(minMaxCoords.maxX, this.cellDefinition).x +
            this.cellDefinition.width / 2
        const maxY =
            cellCoordsToCenterPoint(minMaxCoords.maxY, this.cellDefinition).y +
            this.cellDefinition.height / 2

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
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

    coordinateDimensions(): { rows: number; cols: number } {
        const minMaxCoords = this.minMaxCoords
        return {
            rows: (minMaxCoords.maxY?.row ?? 0) - (minMaxCoords.minY?.row ?? 0) + 1,
            cols: (minMaxCoords.maxX?.col ?? 0) - (minMaxCoords.minX?.col ?? 0) + 1
        }
    }

    neighborAt(
        coords: OffsetCoordinates,
        direction: CardinalDirection | OrdinalDirection
    ): T | undefined {
        const node = this.nodeAt(coords)
        if (!node) {
            return undefined
        }
        return this.neighborOf(node, direction)
    }

    neighborOf(node: T, direction: CardinalDirection | OrdinalDirection): T | undefined {
        const coords = cellNeighborCoords(node.coords, direction)
        return this.nodeAt(coords)
    }

    override neighborsAt(
        coords: OffsetCoordinates,
        direction?: CardinalDirection | OrdinalDirection
    ): T[] {
        const node = this.nodeAt(coords)
        if (!node) {
            return []
        }
        return this.neighborsOf(node, direction)
    }

    override neighborsOf(node: T, direction?: CardinalDirection | OrdinalDirection): T[] {
        if (direction) {
            const coords = cellNeighborCoords(node.coords, direction)
            const neighbor = this.nodeAt(coords)
            return neighbor ? [neighbor] : []
        } else {
            return [...Object.values(CardinalDirection), ...Object.values(OrdinalDirection)]
                .map((direction) => cellNeighborCoords(node.coords, direction))
                .map((coords) => this.nodeAt(coords))
                .filter((n) => n !== undefined)
        }
    }
}
