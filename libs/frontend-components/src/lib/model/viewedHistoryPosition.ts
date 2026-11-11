import { ActionSource, playerUndoReach, type GameAction } from '@tabletop/common'

export type ViewedHistoryPosition = {
    actionIndex: number
    liveActionCount: number
    beyondUndoReach: boolean
    startsWithUserAction: boolean
}

export function viewedHistoryPosition({
    actionIndex,
    liveActionCount,
    liveActions,
    playerId
}: {
    actionIndex: number
    liveActionCount: number
    liveActions: readonly GameAction[]
    playerId: string
}): ViewedHistoryPosition {
    const next = liveActions.find((action) => action.index === actionIndex)
    return {
        actionIndex,
        liveActionCount,
        beyondUndoReach: actionIndex < (playerUndoReach(liveActions, playerId) ?? liveActionCount),
        startsWithUserAction: next?.source === ActionSource.User
    }
}
