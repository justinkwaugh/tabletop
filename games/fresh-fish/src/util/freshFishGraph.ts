import {
    CardinalDirection,
    coordinatesToNumber,
    OrthogonalGrid,
    OrthogonalGridNode
} from '@tabletop/common'

import { Cell, CellType } from '../components/cells.js'

export class FreshFishGraph extends OrthogonalGrid {
    constructor(cells: Cell[][]) {
        super()
        this.initialize(cells)
    }

    private initialize(cells: Cell[][]): void {
        for (let row = 0; row < cells.length; row++) {
            for (let col = 0; col < cells[row].length; col++) {
                const cell = cells[row][col]
                const coords = { row, col }
                if (cell.type !== CellType.OffBoard) {
                    const node: OrthogonalGridNode = {
                        id: coordinatesToNumber(coords),
                        coords,
                        neighbors: {
                            [CardinalDirection.North]: undefined,
                            [CardinalDirection.East]: undefined,
                            [CardinalDirection.West]: undefined,
                            [CardinalDirection.South]: undefined
                        }
                    }
                    this.addNode(node)
                }
            }
        }

        for (const node of this) {
            for (const direction of Object.values(CardinalDirection)) {
                const neighborCoords = this.neighborCoords(node.coords, direction)
                if (this.hasAt(neighborCoords)) {
                    node.neighbors[direction] = neighborCoords
                }
            }
        }
    }
}
