import type { PhaseTable } from '../phases/phaseTable.js'
import type { TrainDepot } from './trainDepot.js'
import type { TrainPurchaseState } from './train.js'
import type { TrainRules } from './trainPurchase.js'

/**
 * 1830-style diesels: on sale from a phase alongside the depot's next train, taking listed
 * trains in trade for a credit off their price.
 */
export function dieselTrains(options: {
    depot: TrainDepot
    phases: PhaseTable
    dieselId: string
    fromPhaseId: string
    tradeInIds: readonly string[]
    credit: number
}): Pick<TrainRules, 'availableDefinitions' | 'exchangePrice'> {
    const { depot, phases, dieselId, fromPhaseId, tradeInIds, credit } = options
    const onSale = (state: TrainPurchaseState) => phases.isAtLeast(state.phaseId, fromPhaseId)
    return {
        availableDefinitions(state) {
            const next = depot.nextDefinitionId(state.trainInventory)
            return [...new Set([...(next ? [next] : []), ...(onSale(state) ? [dieselId] : [])])]
        },
        exchangePrice: (state, _companyId, definitionId, train) =>
            onSale(state) && definitionId === dieselId && tradeInIds.includes(train.definitionId)
                ? depot.trainDefinition(dieselId).price - credit
                : undefined
    }
}
