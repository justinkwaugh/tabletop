import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    actsFor,
    controllingOwner,
    finiteCashOwnedBy,
    settleCashPayments,
    stepAction,
    titleAction,
    type CashPayment,
    type RevenueCenter
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { BridgeLeaseId, RgId } from './ids.js'
import { GorgeLocationIds, GorgeTownId } from './map.js'
import { treatySigned } from './debt.js'
import { operatedBy } from './operator.js'
import { privateCompanyHolder } from './privateHoldings.js'
import {
    requireStateRoyalGorge,
    type HydratedStateRoyalGorge,
    type StateHandlerRoyalGorge
} from './state.js'

/** The railroad running through the gorge on the Hanging Bridge Lease, if not Rio Grande (G3). */
export function bridgeLessee(state: object): string | undefined {
    const holder = privateCompanyHolder(requireStateRoyalGorge(state), BridgeLeaseId)
    return holder === RgId ? undefined : holder
}

/** Whether the operating railroad runs through the gorge on the lease this turn (G3). */
function leaseInUse(state: object, companyId: string): boolean {
    const title = requireStateRoyalGorge(state)
    return !!title.bridgeLeaseInUse && bridgeLessee(title) === companyId
}

/**
 * The lessee's trains pass Rio Grande's stations in the gorge on a turn it chose to use the
 * lease, though never to place its own (RG-2, G3).
 */
export function passesGorgeStations(
    state: object,
    companyId: string,
    center: RevenueCenter
): boolean {
    return leaseInUse(state, companyId) && GorgeLocationIds.includes(center.locationId)
}

/** Whether the lessee may still choose to use the lease this turn: from the Treaty, before it runs (G3, DB-1). */
export function bridgeLeaseOffered(state: object, companyId: string): boolean {
    const title = requireStateRoyalGorge(state)
    return (
        treatySigned(title.phaseId) &&
        title.routeStep?.companyId === companyId &&
        !title.routeStep.result &&
        bridgeLessee(title) === companyId &&
        !title.bridgeLeaseInUse
    )
}

/**
 * What the lessee owes Rio Grande for a run on the lease: 10% of the revenue of each train that
 * ran through the gorge, past its middle, rounded down, gold apart (RG-3, OQ-8).
 */
export function bridgeLeaseOwed(state: object, companyId: string): number {
    const title = requireStateRoyalGorge(state)
    const result = title.routeStep?.companyId === companyId ? title.routeStep.result : undefined
    if (!result || !leaseInUse(title, companyId) || title.bridgeLeasePaid) return 0
    return result.routes
        .filter((route) => route.paths.some((path) => path.locationId === GorgeTownId))
        .reduce((sum, route) => sum + Math.floor(route.revenue / 10), 0)
}

const UseBridgeLeaseAction = titleAction('UseBridgeLease', {
    companyId: Type.String({ minLength: 1 })
})
export const UseBridgeLease = UseBridgeLeaseAction.schema
export type UseBridgeLease = Type.Static<typeof UseBridgeLease>
export const isUseBridgeLease = UseBridgeLeaseAction.is

/** Before running, the lessee chooses to run through the gorge on the lease this turn (G3). */
export class HydratedUseBridgeLease extends UseBridgeLeaseAction.Base {
    declare playerId: string
    declare companyId: string
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            bridgeLeaseOffered(state, this.companyId)
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'The lease cannot be used now')
        state.bridgeLeaseInUse = true
    }
}

export const UseBridgeLeaseStep = stepAction<HydratedStateRoyalGorge, HydratedUseBridgeLease>(
    UseBridgeLeaseAction.type,
    (action): action is HydratedUseBridgeLease => action instanceof HydratedUseBridgeLease,
    (state, playerId) => {
        const companyId = operatedBy(state, playerId)
        return !!companyId && bridgeLeaseOffered(state, companyId)
    }
)

/** Who pays the lease, as the president chooses: the treasury or the president (G3). */
export const BridgeLeasePayers = ['company', 'president'] as const
export type BridgeLeasePayer = (typeof BridgeLeasePayers)[number]

const PayBridgeLeaseAction = titleAction('PayBridgeLease', {
    companyId: Type.String({ minLength: 1 }),
    payer: Type.Union([Type.Literal(BridgeLeasePayers[0]), Type.Literal(BridgeLeasePayers[1])]),
    expectedAmount: Type.Integer({ minimum: 1 })
})
export const PayBridgeLease = PayBridgeLeaseAction.schema
export type PayBridgeLease = Type.Static<typeof PayBridgeLease>
export const isPayBridgeLease = PayBridgeLeaseAction.is

/**
 * After its run the lessee pays Rio Grande, from its treasury or its president's cash; a
 * treasury short of the sum leaves the president the rest (G3).
 */
export class HydratedPayBridgeLease extends PayBridgeLeaseAction.Base {
    declare playerId: string
    declare companyId: string
    declare payer: BridgeLeasePayer
    declare expectedAmount: number
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            bridgeLeaseOwed(state, this.companyId) === this.expectedAmount &&
            bridgeLeasePayments(state, this.companyId, this.payer) !== undefined
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'The lease cannot be paid so')
        const payments = bridgeLeasePayments(state, this.companyId, this.payer)
        assertExists(payments, 'A valid lease payment has its payments')
        settleCashPayments(state, payments)
        state.bridgeLeasePaid = true
    }
}

/**
 * The payment that settles the lease from this payer, if it can pay it whole. Paid after the
 * run's payout, one of them always can: a withheld run is in the treasury, a paid one gave the
 * president at least 20% of it (G3).
 */
export function bridgeLeasePayments(
    state: HydratedStateRoyalGorge,
    companyId: string,
    payer: BridgeLeasePayer
): CashPayment[] | undefined {
    const owed = bridgeLeaseOwed(state, companyId)
    if (!owed || state.machineState !== 'BuyingTrains') return undefined
    const president = controllingOwner(state, companyId)
    assertExists(president, 'A railroad running trains has a president')
    const from = payer === 'company' ? { kind: 'company' as const, companyId } : president
    return finiteCashOwnedBy(state, from) >= owed
        ? [{ from, to: { kind: 'company', companyId: RgId }, amount: owed }]
        : undefined
}

export const PayBridgeLeaseStep = stepAction<HydratedStateRoyalGorge, HydratedPayBridgeLease>(
    PayBridgeLeaseAction.type,
    (action): action is HydratedPayBridgeLease => action instanceof HydratedPayBridgeLease,
    (state, playerId) => {
        const companyId = operatedBy(state, playerId)
        return (
            !!companyId &&
            BridgeLeasePayers.some((payer) => bridgeLeasePayments(state, companyId, payer))
        )
    }
)

export const BridgeLeaseActions = [
    UseBridgeLeaseAction.define((action) => new HydratedUseBridgeLease(action)),
    PayBridgeLeaseAction.define((action) => new HydratedPayBridgeLease(action))
]

/** After its payout the lessee pays Rio Grande for the gorge before anything else (RG-3, G3). */
export function awaitsBridgeLease(handler: StateHandlerRoyalGorge): StateHandlerRoyalGorge {
    const owed = (state: HydratedStateRoyalGorge) => {
        const companyId = state.routeStep?.companyId
        return !!companyId && bridgeLeaseOwed(state, companyId) > 0
    }
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) =>
            (action.type === PayBridgeLeaseAction.type || !owed(context.gameState)) &&
            handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler
                .validActionsForPlayer(playerId, context)
                .filter((type) => type === PayBridgeLeaseAction.type || !owed(context.gameState)),
        onAction: (action, context) => handler.onAction(action, context)
    }
}
