import { BOARD_SIZE, getLineOfSight, posToRowCol, rowColToPos, type BoardSquare } from '@tabletop/urbino'

export type Sightline = { from: number; to: number }

export function architectSightlines(board: BoardSquare[], architects: number[]): Sightline[] {
    return architects.flatMap((architect, index) => {
        const otherArchitects = new Set(architects.filter((_, other) => other !== index))
        const visible = getLineOfSight(board, architect, otherArchitects)
        return [...visible]
            .filter((pos) => !visible.has(nextAlongRay(architect, pos)))
            .map((to) => ({ from: architect, to }))
    })
}

function nextAlongRay(origin: number, pos: number): number {
    const [originRow, originCol] = posToRowCol(origin)
    const [row, col] = posToRowCol(pos)
    const nextRow = row + Math.sign(row - originRow)
    const nextCol = col + Math.sign(col - originCol)
    const onBoard = nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE
    return onBoard ? rowColToPos(nextRow, nextCol) : -1
}
