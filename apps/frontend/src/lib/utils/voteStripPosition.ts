import type { ViewedHistoryPosition } from '@tabletop/frontend-components'

// The History View position the vote strip offers an undo vote from. A UI Artifact that reports
// positions decides alone: it reports none in Live View and while a replay plays. Older UI
// Artifacts report none at all, so every History View position is offered and the host decides.
export function voteStripPosition({
    reportsPosition,
    viewedPosition,
    isViewingHistory,
    actionCount
}: {
    reportsPosition: boolean
    viewedPosition: ViewedHistoryPosition | undefined
    isViewingHistory: boolean
    actionCount: number | undefined
}): ViewedHistoryPosition | undefined {
    if (reportsPosition) return viewedPosition
    if (!isViewingHistory || actionCount === undefined) return undefined
    return {
        actionIndex: actionCount,
        liveActionCount: actionCount,
        beyondUndoReach: true,
        startsWithUserAction: true
    }
}
