import { assertExists } from '@tabletop/common'
import { BoardSize, cellsPerSide } from './boardSize.js'

export enum Edge {
    Top = 'Top',
    Bottom = 'Bottom',
    Left = 'Left',
    Right = 'Right'
}

// A cell of the board: its column from the left edge and its row down from the top edge, both
// from 0. Each row sits half a cell further right than the one above, so the board is a rhombus
// leaning right, as HexWiki draws it.
export type Cell = { column: number; row: number }

const LETTERS = 'ABCDEFGHIJKLMNOPQRS'

// Cells are named as HexWiki names them: the column's letter, A at the left edge, then the row's
// number, 1 at the top edge. A1 is the top-left corner.
export function cellName({ column, row }: Cell): string {
    return `${LETTERS[column]}${row + 1}`
}

// The cells a board holds, which touch which, and which edges each lies on.
export type BoardGrid = {
    readonly size: BoardSize
    readonly side: number
    readonly cells: readonly string[]
    isCell(name: string): boolean
    cellOf(name: string): Cell
    neighborsOf(name: string): readonly string[]
    edgesOf(name: string): readonly Edge[]
}

// The six cells round a cell, in turn round it: right, down right, down left, left, up left and
// up right.
export function cellsAround({ column, row }: Cell): Cell[] {
    return [
        { column: column + 1, row },
        { column, row: row + 1 },
        { column: column - 1, row: row + 1 },
        { column: column - 1, row },
        { column, row: row - 1 },
        { column: column + 1, row: row - 1 }
    ]
}

function makeGrid(size: BoardSize): BoardGrid {
    const side = cellsPerSide(size)
    const cells: Cell[] = Array.from({ length: side }, (_, row) =>
        Array.from({ length: side }, (_, column) => ({ column, row }))
    ).flat()
    const inside = ({ column, row }: Cell) => column >= 0 && row >= 0 && column < side && row < side
    const byName = new Map(cells.map((cell) => [cellName(cell), cell]))
    const neighbors = new Map(
        cells.map((cell) => [cellName(cell), cellsAround(cell).filter(inside).map(cellName)])
    )
    const edges = new Map(
        cells.map(({ column, row }) => {
            const on: Edge[] = []
            if (row === 0) on.push(Edge.Top)
            if (row === side - 1) on.push(Edge.Bottom)
            if (column === 0) on.push(Edge.Left)
            if (column === side - 1) on.push(Edge.Right)
            return [cellName({ column, row }), on]
        })
    )
    const known = <T>(map: Map<string, T>, name: string): T => {
        const found = map.get(name)
        assertExists(found, `No cell ${name}`)
        return found
    }
    return {
        size,
        side,
        cells: cells.map(cellName),
        isCell: (name) => byName.has(name),
        cellOf: (name) => known(byName, name),
        neighborsOf: (name) => known(neighbors, name),
        edgesOf: (name) => known(edges, name)
    }
}

const GRIDS = new Map(Object.values(BoardSize).map((size) => [size, makeGrid(size)]))

export function gridOf(size: BoardSize): BoardGrid {
    const grid = GRIDS.get(size)
    assertExists(grid, `No board ${size}`)
    return grid
}

// The most stones any board holds.
export const MOST_STONES = Math.max(...[...GRIDS.values()].map((grid) => grid.cells.length))
