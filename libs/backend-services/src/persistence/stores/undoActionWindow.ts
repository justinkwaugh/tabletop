import { ActionSource, type GameAction } from '@tabletop/common'

export type UndoActionPrefixScan = {
    startIndex: number
    boundaryFound: boolean
}

export function scanUndoActionPrefix({
    targetAction,
    precedingActions,
    startIndex
}: {
    targetAction: GameAction
    precedingActions: GameAction[]
    startIndex: number
}): UndoActionPrefixScan {
    if (targetAction.simultaneousGroupId === undefined) {
        return { startIndex, boundaryFound: true }
    }

    let nextStartIndex = startIndex
    for (const action of precedingActions) {
        if (action.source !== ActionSource.User) {
            continue
        }
        if (action.simultaneousGroupId !== targetAction.simultaneousGroupId) {
            return { startIndex: nextStartIndex, boundaryFound: true }
        }
        if (action.index === undefined) {
            throw new Error(`Undo action ${action.id} has no index`)
        }
        nextStartIndex = action.index
    }

    return { startIndex: nextStartIndex, boundaryFound: false }
}
