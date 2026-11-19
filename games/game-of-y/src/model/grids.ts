import { assertExists } from '@tabletop/common'
import { isPoint, neighborsOf, POINTS, Side, sidesOf } from './points.js'
import { BoardShape } from './boardShape.js'

// The places a board holds, which touch which, and which sides each lies on.
export type BoardGrid = {
    readonly shape: BoardShape
    readonly points: readonly string[]
    isPoint(point: string): boolean
    neighborsOf(point: string): readonly string[]
    sidesOf(point: string): Side[]
}

const KADON_GRID: BoardGrid = {
    shape: BoardShape.Kadon,
    points: POINTS,
    isPoint,
    neighborsOf,
    sidesOf
}

const HEX_SIZES: Readonly<Record<BoardShape, number | undefined>> = {
    [BoardShape.Kadon]: undefined,
    [BoardShape.Hex9]: 9,
    [BoardShape.Hex13]: 13,
    [BoardShape.Hex19]: 19
}

// How many cells a side of a hex board holds, or undefined for Kadon's board.
export function hexSizeOf(shape: BoardShape): number | undefined {
    return HEX_SIZES[shape]
}

const HEX_LETTERS = 'ABCDEFGHIJKLMNOPQRS'

// A cell of a hex board: its row up from the bottom side and its place along the row from the
// left side, both from 0.
export type HexCell = { row: number; column: number }

// Cells are named as on a Hex board, by the two lines of cells through them: the letter of the
// line rising to the right from the bottom side (A at the bottom-left corner), and the number of
// the line rising to the left, counted up the left side (1 at the bottom-left corner). So A1 is
// the bottom-left corner, A{size} the top corner and the bottom-right corner is the last letter
// with the number {size}.
export function hexCellName({ row, column }: HexCell): string {
    return `${HEX_LETTERS[column]}${row + column + 1}`
}

export function hexCellOf(point: string): HexCell {
    const column = HEX_LETTERS.indexOf(point[0])
    return { row: Number(point.slice(1)) - 1 - column, column }
}

function hexGrid(shape: BoardShape, size: number): BoardGrid {
    const cells: HexCell[] = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size - row }, (_, column) => ({ row, column }))
    ).flat()
    const inside = ({ row, column }: HexCell) => row >= 0 && column >= 0 && row + column < size
    const neighbors = new Map(
        cells.map((cell) => {
            const { row, column } = cell
            const around: HexCell[] = [
                { row, column: column - 1 },
                { row, column: column + 1 },
                { row: row + 1, column },
                { row: row + 1, column: column - 1 },
                { row: row - 1, column },
                { row: row - 1, column: column + 1 }
            ]
            return [hexCellName(cell), around.filter(inside).map(hexCellName)]
        })
    )
    return {
        shape,
        points: cells.map(hexCellName),
        isPoint: (point) => neighbors.has(point),
        neighborsOf: (point) => {
            const around = neighbors.get(point)
            assertExists(around, `No cell ${point}`)
            return around
        },
        sidesOf: (point) => {
            const { row, column } = hexCellOf(point)
            const sides: Side[] = []
            if (row === 0) sides.push(Side.Bottom)
            if (column === 0) sides.push(Side.Left)
            if (row + column === size - 1) sides.push(Side.Right)
            return sides
        }
    }
}

const GRIDS = new Map<BoardShape, BoardGrid>(
    Object.values(BoardShape).map((shape) => {
        const size = hexSizeOf(shape)
        return [shape, size === undefined ? KADON_GRID : hexGrid(shape, size)]
    })
)

export function gridOf(shape: BoardShape): BoardGrid {
    const grid = GRIDS.get(shape)
    assertExists(grid, `No board ${shape}`)
    return grid
}

// The most stones any board holds.
export const MOST_STONES = Math.max(...[...GRIDS.values()].map((grid) => grid.points.length))
