import { isStartOperatingRound, isStartOperatingSet, isSellFundingShares } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type { HistoryStates } from './historyStates.js'

export type HistoryOperatingOrder = { before: string[]; after: string[]; movingCompanyId?: string }

export function historyOperatingOrder(
    actions: readonly GameAction[],
    states: HistoryStates
): Map<string, HistoryOperatingOrder> {
    const changes = new Map<string, HistoryOperatingOrder>()
    for (const action of actions) {
        const transition = states.get(action.id)
        if (!transition) continue
        const after = transition.after.order
        const before = transition.before?.order
        if (isStartOperatingRound(action)) {
            changes.set(action.id, { before: [], after })
        } else if (
            before &&
            !isStartOperatingSet(action) &&
            after.length &&
            (after.length !== before.length || after.some((id, index) => id !== before[index]))
        ) {
            changes.set(action.id, {
                before,
                after,
                ...(isSellFundingShares(action) ? { movingCompanyId: action.companyId } : {})
            })
        }
    }
    return changes
}
