import type { ReefSquare } from '@tabletop/reef-encounter'

export function squareName({ boardId, coords }: ReefSquare): string {
    return `board ${boardId}, row ${coords.row + 1}, column ${coords.col + 1}`
}
