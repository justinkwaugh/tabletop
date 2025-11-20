import { BaseCoordinatedGraph, CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { OffsetCoordinates } from '../coordinates.js'
import { CardinalDirection, OrdinalDirection } from '../directions.js'
import { NodeIdentifier } from '../graph.js'

export type RectilinearGridNode = CoordinatedNode<OffsetCoordinates>

export class RectilinearGrid<T extends RectilinearGridNode = RectilinearGridNode>
    extends BaseCoordinatedGraph<T, OffsetCoordinates>
    implements CoordinatedGraph<T, OffsetCoordinates>
{
    minRow: number = 0
    minCol: number = 0
    maxRow: number = 0
    maxCol: number = 0

    constructor() {
        super()
    }

    override setNode(node: T): void {
        super.setNode(node)
        const { row, col } = node.coords
        if (this.size === 1) {
            this.minRow = row
            this.maxRow = row
            this.minCol = col
            this.maxCol = col
        } else {
            if (row < this.minRow) {
                this.minRow = row
            }
            if (row > this.maxRow) {
                this.maxRow = row
            }
            if (col < this.minCol) {
                this.minCol = col
            }
            if (col > this.maxCol) {
                this.maxCol = col
            }
        }
    }

    override removeNode(nodeOrId: T | NodeIdentifier): T | undefined {
        const node = super.removeNode(nodeOrId)

        if (node) {
            const { row, col } = node.coords
            if (
                row === this.minRow ||
                row === this.maxRow ||
                col === this.minCol ||
                col === this.maxCol
            ) {
                for (const n of this) {
                    const { row: nRow, col: nCol } = n.coords
                    if (nRow < this.minRow) {
                        this.minRow = nRow
                    }
                    if (nRow > this.maxRow) {
                        this.maxRow = nRow
                    }
                    if (nCol < this.minCol) {
                        this.minCol = nCol
                    }
                    if (nCol > this.maxCol) {
                        this.maxCol = nCol
                    }
                }
            }
        }
        return node
    }

    dimensions(): { rows: number; cols: number } {
        return {
            rows: this.maxRow - this.minRow + 1,
            cols: this.maxCol - this.minCol + 1
        }
    }

    isWithinDimensions(coords: OffsetCoordinates): boolean {
        const { row, col } = coords
        return row >= this.minRow && row <= this.maxRow && col >= this.minCol && col <= this.maxCol
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
        const neighborCoords = this.neighborCoords(node.coords, direction)
        return this.nodeAt(neighborCoords)
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
            const neighborCoords = this.neighborCoords(node.coords, direction)
            const neighbor = this.nodeAt(neighborCoords)
            return neighbor ? [neighbor] : []
        } else {
            return [...Object.values(CardinalDirection), ...Object.values(OrdinalDirection)]
                .map((direction) => this.neighborCoords(node.coords, direction))
                .map((coords) => this.nodeAt(coords))
                .filter((n) => n !== undefined)
        }
    }

    neighborCoords(
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
}
