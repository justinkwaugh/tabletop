import {
    certificateLimitAllows,
    closePrivate,
    finiteCashOwnedBy,
    markTurnPurchase,
    mustSellShares,
    recordStockAction,
    recordStockRoundSale,
    soldThisStockRound,
    settleCashPayments,
    stepAction,
    titleAction,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import {
    FishbourneId,
    PrivateCatalog1860,
    PrivateIds1860,
    PrivateSaleCommission
} from './companies.js'
import { BankPrivatesPoolId } from './names.js'
import type { HydratedState1860 } from './state.js'
import { StockRules1860 } from './stock.js'
import { FishbournePhaseId, Phases1860 } from './trains.js'

const Id = Type.String({ minLength: 1 })
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

function privateCertificate(state: HydratedState1860, privateId: string) {
    return state.certificates.find(
        (certificate) => certificate.kind === 'private' && certificate.companyId === privateId
    )
}

/** Whether it is the player's stock turn, with nothing else to settle first. */
function inStockTurn(state: HydratedState1860, playerId: string): boolean {
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        state.activePlayerIds.includes(playerId)
    )
}

/**
 * The privates the player may sell to the bank for face value less £30: from the second stock
 * round, in their turn, before they buy (Selling Private Companies).
 */
export function sellablePrivates(state: HydratedState1860, playerId: string): string[] {
    if (!inStockTurn(state, playerId) || state.stockRound.number < 2) return []
    if (state.stockRound.turn.bought) return []
    return PrivateIds1860.filter((privateId) => {
        const certificate = privateCertificate(state, privateId)
        return (
            certificate?.owner.kind === 'player' &&
            certificate.owner.playerId === playerId &&
            PrivateCatalog1860.faceValue(privateId) >= PrivateSaleCommission
        )
    })
}

/**
 * The privates the player may buy from the bank at face value as the turn's purchase: those sold
 * to it and not closed, and the Fishbourne Ferry from the first 6+3 train (Selling Private
 * Companies; The Fishbourne Ferry Company).
 */
export function buyablePrivates(state: HydratedState1860, playerId: string): string[] {
    if (!inStockTurn(state, playerId) || state.stockRound.turn.bought) return []
    if (mustSellShares(state, playerId, StockRules1860)) return []
    const buyer = player(playerId)
    return PrivateIds1860.filter((privateId) => {
        const certificate = privateCertificate(state, privateId)
        if (!certificate || certificate.owner.kind !== 'bank') return false
        const forSale =
            certificate.poolId === BankPrivatesPoolId ||
            (privateId === FishbourneId && Phases1860.isAtLeast(state.phaseId, FishbournePhaseId))
        // No buying back a private sold to the bank this round (SR-13).
        return (
            forSale &&
            !soldThisStockRound(state.stockRound, buyer, privateId) &&
            finiteCashOwnedBy(state, buyer) >= PrivateCatalog1860.faceValue(privateId) &&
            certificateLimitAllows(state, buyer, certificate, StockRules1860)
        )
    })
}

const SellAction = titleAction('SellPrivateToBank', {
    privateCompanyId: Id,
    metadata: Type.Optional(
        Type.Object({ proceeds: Type.Integer({ minimum: 0 }) }, { additionalProperties: false })
    )
})
export const SellPrivateToBank = SellAction.schema
export const isSellPrivateToBank = SellAction.is

export class HydratedSellPrivateToBank extends SellAction.Base {
    declare playerId: string
    declare privateCompanyId: Type.Static<typeof SellPrivateToBank>['privateCompanyId']
    declare metadata?: Type.Static<typeof SellPrivateToBank>['metadata']
    isValid(state: HydratedState1860): boolean {
        return (
            this.source === ActionSource.User &&
            sellablePrivates(state, this.playerId).includes(this.privateCompanyId)
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The owner sells a private to the bank')
        const certificate = privateCertificate(state, this.privateCompanyId)
        assertExists(certificate, 'The private has its certificate')
        const proceeds = PrivateCatalog1860.faceValue(this.privateCompanyId) - PrivateSaleCommission
        if (proceeds)
            settleCashPayments(state, [
                { from: { kind: 'bank' }, to: player(this.playerId), amount: proceeds }
            ])
        certificate.owner = { kind: 'bank' }
        certificate.poolId = BankPrivatesPoolId
        recordStockRoundSale(state.stockRound, player(this.playerId), this.privateCompanyId)
        recordStockAction(state, this.playerId, StockRules1860.round)
        this.metadata = { proceeds }
    }
}

const BuyAction = titleAction('BuyPrivateFromBank', {
    privateCompanyId: Id,
    metadata: Type.Optional(
        Type.Object(
            {
                price: Type.Integer({ minimum: 0 }),
                closedPrivateIds: Type.Array(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const BuyPrivateFromBank = BuyAction.schema
export const isBuyPrivateFromBank = BuyAction.is

/** Buying the Fishbourne Ferry closes every other private (The Fishbourne Ferry Company). */
export class HydratedBuyPrivateFromBank extends BuyAction.Base {
    declare playerId: string
    declare privateCompanyId: Type.Static<typeof BuyPrivateFromBank>['privateCompanyId']
    declare metadata?: Type.Static<typeof BuyPrivateFromBank>['metadata']
    isValid(state: HydratedState1860): boolean {
        return (
            this.source === ActionSource.User &&
            buyablePrivates(state, this.playerId).includes(this.privateCompanyId)
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The player buys a private the bank offers')
        const certificate = privateCertificate(state, this.privateCompanyId)
        assertExists(certificate, 'The private has its certificate')
        const price = PrivateCatalog1860.faceValue(this.privateCompanyId)
        settleCashPayments(state, [
            { from: player(this.playerId), to: { kind: 'bank' }, amount: price }
        ])
        certificate.owner = player(this.playerId)
        delete certificate.poolId
        const closedPrivateIds =
            this.privateCompanyId === FishbourneId
                ? PrivateIds1860.filter(
                      (id) =>
                          id !== FishbourneId &&
                          !state.companies.find((company) => company.id === id)?.closed
                  )
                : []
        for (const privateId of closedPrivateIds) closePrivate(state, privateId)
        markTurnPurchase(state)
        recordStockAction(state, this.playerId, StockRules1860.round)
        this.metadata = { price, closedPrivateIds }
    }
}

const isAction =
    <Action>(type: new (...args: never[]) => Action) =>
    (
        action: HydratedAction
    ): action is HydratedAction & Action & { isValid(state: HydratedState1860): boolean } =>
        action instanceof type

export const BankPrivateSteps: readonly StepAction<HydratedState1860>[] = [
    stepAction(
        SellAction.type,
        isAction(HydratedSellPrivateToBank),
        (state, playerId) => sellablePrivates(state, playerId).length > 0
    ),
    stepAction(
        BuyAction.type,
        isAction(HydratedBuyPrivateFromBank),
        (state, playerId) => buyablePrivates(state, playerId).length > 0
    )
]

export const BankPrivateActions = [
    SellAction.define((action) => new HydratedSellPrivateToBank(action)),
    BuyAction.define((action) => new HydratedBuyPrivateFromBank(action))
]
