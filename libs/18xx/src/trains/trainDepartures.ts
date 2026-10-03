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

/** What the bank pays as a train departs, and the private it pays for when it pays for one. */
export const DeparturePayment = Type.Object(
    { ...CashPayment.properties, privateId: Type.Optional(Type.String()) },
    { additionalProperties: false }
)
export type DeparturePayment = Type.Static<typeof DeparturePayment>

/** What the bank paid as trains departed, recorded only when it paid anything. */
export const DeparturePayments = Type.Optional(Type.Array(DeparturePayment, { minItems: 1 }))

/** Settles what the title pays as trains depart, in the order they leave. */
export function settleTrainDepartures(
    state: TrainPurchaseState,
    rules: TrainRules,
    departures: readonly TrainDeparture[]
): DeparturePayment[] {
    if (!rules.afterTrainsDepart || !departures.length) return []
    const payments = rules.afterTrainsDepart(state, departures)
    settleCashPayments(state, payments)
    return payments
}

export function departurePaymentsField(payments: DeparturePayment[]): {
    departurePayments?: DeparturePayment[]
} {
    return payments.length ? { departurePayments: payments } : {}
}
