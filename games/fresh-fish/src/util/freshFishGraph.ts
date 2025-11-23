import { coordinatesToNumber, RectilinearGrid, RectilinearGridNode } from '@tabletop/common'

import { Cell, CellType } from '../components/cells.js'

export class FreshFishGraph extends RectilinearGrid {
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
                    const node: RectilinearGridNode = {
                        id: coordinatesToNumber(coords),
                        coords
                    }
                    this.setNode(node)
                }
            }
        }
    }
}
