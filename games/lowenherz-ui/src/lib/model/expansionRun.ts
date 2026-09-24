import type { GameAction } from '@tabletop/common'
import { type ExpandRegion, isCancelAlliance, isExpandRegion } from '@tabletop/lowenherz'

// The actions of the expansion currently under way on a region: the trailing run of that
// region's ExpandRegion actions, which is the record itself, so the UI cannot disagree with
// the engine about what has been taken.
//
// A CancelAlliance in that run is stepped over rather than ending it - paying ten ducats to
// free the second space is the rulebook's central use of that payment, and it spends no part
// of the knight action.
export function expansionActionsFor(
    actions: GameAction[],
    regionId: string,
    playerId: string
): ExpandRegion[] {
    const expansionActions: ExpandRegion[] = []
    for (let index = actions.length - 1; index >= 0; index--) {
        const action = actions[index]
        if (isCancelAlliance(action)) continue
        if (!isExpandRegion(action)) break
        if (action.playerId !== playerId || action.regionId !== regionId) break
        expansionActions.unshift(action)
    }
    return expansionActions
}

// Identifies the open expansion by the action that started it, which is what a decline of its
// optional second space is remembered against: an Undo of that space leaves the knight action
// and the region unchanged, so anything keyed to those outlives the space it applied to.
export function openExpansionActionIdFor(
    actions: GameAction[],
    expandingRegionId: string | undefined,
    playerId: string | undefined
): string | undefined {
    if (!expandingRegionId || !playerId) return undefined
    return expansionActionsFor(actions, expandingRegionId, playerId).at(0)?.id
}
