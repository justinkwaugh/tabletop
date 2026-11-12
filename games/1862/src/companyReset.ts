import {
    finiteCashOwnedBy,
    releaseTrains,
    resetCompany,
    settleCashPayments,
    trainIdsOwnedBy
} from '@tabletop/18xx'
import { ShareCount } from './charters.js'
import { IpoPoolId } from './pools.js'
import type { HydratedState1862 } from './state.js'

/**
 * Returns a company to the start: every certificate back in the IPO, its stations off the map,
 * its markers off the charts, its permit the one it was dealt, and anything left in its
 * treasury or on its charter back to the bank, so it may be started again (§4.3, §7.5.7, §7.12).
 */
export function resetCompany1862(state: HydratedState1862, companyId: string): void {
    const treasury = { kind: 'company' as const, companyId }
    const cash = finiteCashOwnedBy(state, treasury)
    if (cash) settleCashPayments(state, [{ from: treasury, to: { kind: 'bank' }, amount: cash }])
    const trainIds = trainIdsOwnedBy(state, treasury)
    releaseTrains(state.trainInventory, trainIds, 'removed')
    for (const id of trainIds) delete state.warranties[id]
    // A restarted company buys its stations again, the home first (§6.5.3).
    resetCompany(state, companyId, ShareCount, {
        poolId: IpoPoolId,
        keepsHome: false
    })
    state.chartered = state.chartered.filter((id) => id !== companyId)
    state.obligations = state.obligations.filter((entry) => entry.companyId !== companyId)
    state.permits[companyId] = [state.originalPermits[companyId]]
    if (state.stationPurchase === companyId) delete state.stationPurchase
}
