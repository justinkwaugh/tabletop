import type { ReefSquare } from '@tabletop/reef-encounter'

// Players know the reef boards by their places on the table, in reading order, never by the
// numbers printed on them.
export function boardName(reefs: readonly { boardId: number }[], boardId: number): string {
    return `Board ${reefs.findIndex((reef) => reef.boardId === boardId) + 1}`
}

export function squareName(
    reefs: readonly { boardId: number }[],
    { boardId, coords }: ReefSquare
): string {
    return `${boardName(reefs, boardId)}, row ${coords.row + 1}, column ${coords.col + 1}`
}
