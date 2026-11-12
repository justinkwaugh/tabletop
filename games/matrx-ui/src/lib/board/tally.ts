import { assertExists, type GameAction } from '@tabletop/common'
import { isRemoveRow, PieceKind, type Captured } from '@tabletop/matrx'

export const TALLY_HEIGHT = 5

// The first taken stand at the right; each stack fills before the next starts on its left.
export function tallyStacks<T>(taken: readonly T[], height = TALLY_HEIGHT): T[][] {
    return Array.from({ length: Math.ceil(taken.length / height) }, (_, index) =>
        taken.slice(index * height, (index + 1) * height)
    ).reverse()
}

// The opponent's discs a player took, oldest first, read from the rows they took among `actions`;
// grouped by kind when those actions do not account for every capture, as when the history held
// is incomplete.
export function capturedInOrder(
    playerId: string,
    captured: Captured,
    actions: readonly GameAction[]
): PieceKind[] {
    const taken: PieceKind[] = []
    for (const action of actions) {
        if (!isRemoveRow(action) || action.playerId !== playerId) continue
        assertExists(action.metadata, 'A row taken records what it removed')
        for (const { unit } of action.metadata.removed) {
            if (unit.playerId === playerId) continue
            taken.push(...unit.discIds.map(() => unit.kind))
        }
    }
    const kinds = Object.values(PieceKind)
    const accounted = kinds.every(
        (kind) => taken.filter((each) => each === kind).length === captured[kind]
    )
    return accounted
        ? taken
        : kinds.flatMap((kind) => Array.from({ length: captured[kind] }, () => kind))
}
