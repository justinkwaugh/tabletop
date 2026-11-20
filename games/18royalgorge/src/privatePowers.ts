import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    SharePurchaseDetails,
    actsFor,
    applySharePurchase,
    closePrivate,
    evaluateShareAcquisition,
    evaluateSharePurchase,
    recordStockAction,
    stateWith,
    stepAction,
    type ShareCertificate,
    titleAction,
    type PrivatePowerRules,
    type StockRules
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CfiId, MetalsInvestorId, MintWorkerId, SulphurSpringsId, VgcId } from './ids.js'
import { SulphurSpringsLocationId } from './map.js'
import { MetalBoardPoolIdRoyalGorge } from './names.js'
import { privateCompanyHolder, privatePlayerHolder } from './privateHoldings.js'
import type { HydratedStateRoyalGorge } from './state.js'
import { StockRulesRoyalGorge } from './stock.js'
import { MarketRoyalGorge } from './stockMarket.js'
import { SulphurSpringsTileIds, mapStateRoyalGorge } from './tiles.js'

/**
 * Sulphur Springs's railroad may, in its operating turn, replace the town's tile with the city
 * tile of its colour, free and beside its lays, closing the private (B2, TR-5, OQ-14).
 */
export const PrivatePowerRulesRoyalGorge: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== SulphurSpringsId) return undefined
        const companyId = privateCompanyHolder(state, SulphurSpringsId)
        if (!companyId || state.trackStep?.companyId !== companyId) return undefined
        if (!actsFor(state, playerId, companyId)) return undefined
        const tile = mapStateRoyalGorge(state).tile(SulphurSpringsLocationId)
        const definitionId = tile.placement ? SulphurSpringsTileIds[tile.face.color] : undefined
        if (!definitionId) return undefined
        return {
            companyId,
            locationIds: [SulphurSpringsLocationId],
            definitionIds: [definitionId],
            payer: { kind: 'company', companyId },
            connected: false,
            free: true,
            relabels: true
        }
    },
    earlyTrainCompany: () => undefined,
    afterTrackLay: (_state, privateCompanyId) => ({
        payments: [],
        closedPrivateIds: privateCompanyId === SulphurSpringsId ? [SulphurSpringsId] : []
    })
}

/** The discounted metal purchases: the Metals Investor's and the U.S. Mint Worker's. */
export const MetalPurchasePrivateIds = [MetalsInvestorId, MintWorkerId] as const

/** What one share costs through the private: a space below its price, or half (G5, B6). */
function discountedPrice(state: HydratedStateRoyalGorge, privateId: string, companyId: string) {
    const space = MarketRoyalGorge.companySpace(state.stockMarket, companyId)
    return privateId === MintWorkerId
        ? Math.ceil(space.price / 2)
        : MarketRoyalGorge.move(space.id, 'left', 1).price
}

/** The metal companies the private lets its owner buy now, with how many shares at most. */
export function metalPurchaseChoices(
    state: HydratedStateRoyalGorge,
    playerId: string,
    privateId: string
): { companyId: string; maximum: number }[] {
    if (state.machineState !== 'StockRound' || privatePlayerHolder(state, privateId) !== playerId)
        return []
    if (privateId === MintWorkerId) return [{ companyId: VgcId, maximum: 2 }]
    return [CfiId, VgcId]
        .filter((companyId) => !state.investorPurchases.includes(companyId))
        .map((companyId) => ({ companyId, maximum: 1 }))
}

function discountedRules(state: HydratedStateRoyalGorge, privateId: string): StockRules {
    return {
        ...StockRulesRoyalGorge,
        purchaseTerms: (_state, certificate, buyer) =>
            certificate.poolId === MetalBoardPoolIdRoyalGorge
                ? {
                      price: discountedPrice(state, privateId, certificate.companyId),
                      recipient: { kind: 'bank' },
                      payers: [buyer]
                  }
                : 'Only shares on the board are discounted.'
    }
}

/** The purchases buying the shares would make, one after another, and their total, or why not. */
export function evaluateMetalPurchase(
    state: HydratedStateRoyalGorge,
    playerId: string,
    privateId: string,
    companyId: string,
    shares: number
):
    | { purchases: SharePurchaseDetails[]; price: number; reason?: never }
    | { reason: string; purchases?: never; price?: never } {
    const choice = metalPurchaseChoices(state, playerId, privateId).find(
        (entry) => entry.companyId === companyId
    )
    if (!choice || shares > choice.maximum) return { reason: 'This private cannot buy that.' }
    const board = state.certificates.filter(
        (certificate): certificate is ShareCertificate =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.poolId === MetalBoardPoolIdRoyalGorge
    )
    if (board.length < shares) return { reason: 'Not enough shares are on the board.' }
    const rules = discountedRules(state, privateId)
    const buyer = { kind: 'player' as const, playerId }
    const purchases: SharePurchaseDetails[] = []
    const projected = stateWith(state, {
        cash: state.cash.map((entry) => ({ ...entry })),
        certificates: state.certificates.map((certificate) => ({ ...certificate })),
        stockRound: { ...state.stockRound, turn: { ...state.stockRound.turn } }
    })
    for (const [index, certificate] of board.slice(0, shares).entries()) {
        const request = { playerId, buyer, certificateId: certificate.id }
        const result =
            index === 0
                ? evaluateSharePurchase(projected, request, rules)
                : evaluateShareAcquisition(
                      projected,
                      request,
                      rules,
                      rules.purchaseTerms(projected, certificate, buyer)
                  )
        if (!result.details) return { reason: result.reason }
        purchases.push(result.details)
        applySharePurchase(projected, result.details)
    }
    return { purchases, price: purchases.reduce((sum, purchase) => sum + purchase.price, 0) }
}

const BuyMetalSharesAction = titleAction('BuyMetalShares', {
    privateId: Type.Union([
        Type.Literal(MetalPurchasePrivateIds[0]),
        Type.Literal(MetalPurchasePrivateIds[1])
    ]),
    companyId: Type.String({ minLength: 1 }),
    shares: Type.Integer({ minimum: 1, maximum: 2 }),
    expectedPrice: Type.Integer({ minimum: 0 }),
    metadata: Type.Optional(
        Type.Object(
            { purchases: Type.Array(SharePurchaseDetails) },
            { additionalProperties: false }
        )
    )
})
export const BuyMetalShares = BuyMetalSharesAction.schema
export type BuyMetalShares = Type.Static<typeof BuyMetalShares>
export const isBuyMetalShares = BuyMetalSharesAction.is

/**
 * As the turn's purchase, the Metals Investor's owner buys a CF&I or VGC share a space below
 * its price, to hold until the next stock round; or the U.S. Mint Worker's owner closes it to
 * buy one or two VGC shares at half price (G5, B6, SR-13, SR-14).
 */
export class HydratedBuyMetalShares extends BuyMetalSharesAction.Base {
    declare playerId: string
    declare privateId: (typeof MetalPurchasePrivateIds)[number]
    declare companyId: string
    declare shares: number
    declare expectedPrice: number
    declare metadata?: BuyMetalShares['metadata']
    isValid(state: HydratedStateRoyalGorge): boolean {
        const result = evaluateMetalPurchase(
            state,
            this.playerId,
            this.privateId,
            this.companyId,
            this.shares
        )
        return this.source === ActionSource.User && result.price === this.expectedPrice
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'This discounted purchase is not available')
        const result = evaluateMetalPurchase(
            state,
            this.playerId,
            this.privateId,
            this.companyId,
            this.shares
        )
        assertExists(result.purchases, 'A valid purchase has its details')
        recordStockAction(state, this.playerId, StockRulesRoyalGorge.round)
        for (const purchase of result.purchases) applySharePurchase(state, purchase)
        if (this.privateId === MintWorkerId) closePrivate(state, MintWorkerId)
        else state.investorPurchases = [...state.investorPurchases, this.companyId]
        this.metadata = { purchases: result.purchases }
    }
}

export const BuyMetalSharesStep = stepAction<HydratedStateRoyalGorge, HydratedBuyMetalShares>(
    BuyMetalSharesAction.type,
    (action): action is HydratedBuyMetalShares => action instanceof HydratedBuyMetalShares,
    (state, playerId) =>
        state.activePlayerIds.includes(playerId) &&
        MetalPurchasePrivateIds.some((privateId) =>
            metalPurchaseChoices(state, playerId, privateId).some(
                (choice) =>
                    !!evaluateMetalPurchase(state, playerId, privateId, choice.companyId, 1)
                        .purchases
            )
        )
)

export const MetalPurchaseActions = [
    BuyMetalSharesAction.define((action) => new HydratedBuyMetalShares(action))
]
