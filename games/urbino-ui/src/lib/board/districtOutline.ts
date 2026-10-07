import { posToRowCol, rowColToPos, BOARD_SIZE } from '@tabletop/urbino'
import { BOARD_MARGIN, SQUARE_SIZE } from './geometry.js'

export type Segment = { x1: number; y1: number; x2: number; y2: number }

export function districtOutline(district: Set<number>): Segment[] {
    const inDistrict = (row: number, col: number) =>
        row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && district.has(rowColToPos(row, col))
    const toPixels = (row: number, col: number) => ({
        x: BOARD_MARGIN + col * SQUARE_SIZE,
        y: BOARD_MARGIN + row * SQUARE_SIZE
    })
    const segment = (fromRow: number, fromCol: number, toRow: number, toCol: number): Segment => {
        const from = toPixels(fromRow, fromCol)
        const to = toPixels(toRow, toCol)
        return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    }

    return [...district].flatMap((pos) => {
        const [row, col] = posToRowCol(pos)
        const edges: Segment[] = []
        if (!inDistrict(row - 1, col)) edges.push(segment(row, col, row, col + 1))
        if (!inDistrict(row + 1, col)) edges.push(segment(row + 1, col, row + 1, col + 1))
        if (!inDistrict(row, col - 1)) edges.push(segment(row, col, row + 1, col))
        if (!inDistrict(row, col + 1)) edges.push(segment(row, col + 1, row + 1, col + 1))
        return edges
    })
}
