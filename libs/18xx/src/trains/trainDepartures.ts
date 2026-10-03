import { settleCashPayments } from '../finance/cashPayments.js'
import type { Owner } from '../finance/finance.js'
import type { TrainPurchaseState } from './train.js'
import type { TrainRules } from './trainPurchase.js'

/** A train leaving the depot or its owner: bought, exported or rusted. */
export type TrainDeparture = {
    trainId: string
    definitionId: string
    cause: 'purchase' | 'export' | 'rust'
    /** Who held it before, when anyone did. */
    owner?: Owner
}

/** Settles what the title pays as trains depart, in the order they leave. */
export function settleTrainDepartures(
    state: TrainPurchaseState,
    rules: TrainRules,
    departures: readonly TrainDeparture[]
): void {
    if (!rules.afterTrainsDepart || !departures.length) return
    settleCashPayments(state, rules.afterTrainsDepart(state, departures))
}
