import * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import type { Owner } from '../finance/finance.js'
import type { TrainPurchaseState } from './train.js'
import type { TrainRules } from './trainPurchase.js'

/** A train leaving the depot or its owner: bought, exported, rusted or discarded. */
export type TrainDeparture = {
    trainId: string
    definitionId: string
    cause: 'purchase' | 'export' | 'rust' | 'discard'
    /** Who held it before, when anyone did. */
    owner?: Owner
}

/** What the bank paid as trains departed, recorded only when it paid anything. */
export const DeparturePayments = Type.Optional(Type.Array(CashPayment, { minItems: 1 }))

/** Settles what the title pays as trains depart, in the order they leave. */
export function settleTrainDepartures(
    state: TrainPurchaseState,
    rules: TrainRules,
    departures: readonly TrainDeparture[]
): CashPayment[] {
    if (!rules.afterTrainsDepart || !departures.length) return []
    const payments = rules.afterTrainsDepart(state, departures)
    settleCashPayments(state, payments)
    return payments
}

export function departurePaymentsField(payments: CashPayment[]): {
    departurePayments?: CashPayment[]
} {
    return payments.length ? { departurePayments: payments } : {}
}
