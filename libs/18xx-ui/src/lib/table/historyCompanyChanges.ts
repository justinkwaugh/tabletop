import {
    isAdvancePhase,
    isBuyPrivateTrain,
    isBuyTrain,
    isFloatCompany,
    isOfferPurchase,
    isRespondToPurchaseOffer,
    type CompanyChanges
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'

export type HistoryCompanyChanges = CompanyChanges

export function historyCompanyChanges(
    actions: readonly GameAction[]
): Map<string, HistoryCompanyChanges> {
    const result = new Map<string, HistoryCompanyChanges>()
    for (const action of actions) {
        if (
            isFloatCompany(action) ||
            isAdvancePhase(action) ||
            isBuyTrain(action) ||
            isBuyPrivateTrain(action) ||
            isOfferPurchase(action) ||
            isRespondToPurchaseOffer(action)
        ) {
            const changes = action.metadata?.companyChanges
            if (changes) result.set(action.id, changes)
        }
    }
    return result
}
