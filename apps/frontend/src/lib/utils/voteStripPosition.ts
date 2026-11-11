import type { ViewedHistoryPosition } from '@tabletop/frontend-components'

// UI Artifacts published before viewedHistoryPosition report no position at all, so every
// History View position is offered for them and the host decides. None is reported to someone
// without a seat either; they cannot vote, so the stand-in only shows them History View.
export function voteStripPosition({
    reportsPosition,
    seated,
    viewedPosition,
    isViewingHistory,
    actionCount
}: {
    reportsPosition: boolean
    seated: boolean
    viewedPosition: ViewedHistoryPosition | undefined
    isViewingHistory: boolean
    actionCount: number | undefined
}): ViewedHistoryPosition | undefined {
    if (reportsPosition && seated) return viewedPosition
    if (!isViewingHistory || actionCount === undefined) return undefined
    return {
        actionIndex: actionCount,
        liveActionCount: actionCount,
        beyondUndoReach: true,
        startsWithUserAction: true
    }
}
