import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    finiteCashOwnedBy,
    controllingOwner,
    privateOwner,
    sameOwner
} from '../finance/finance.js'
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import { trainCanBeTraded, trainsOwnedBy } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import { closePrivatesOnTrainPurchase } from '../trains/buyTrain.js'
import type { CompanyDecisionState } from '../privates/companyDecision.js'
import { settleTrainDepartures } from '../trains/trainDepartures.js'

const Id = Type.String({ minLength: 1 })
export const PurchaseAsset = Type.Union([
    Type.Object({ kind: Type.Literal('train'), trainId: Id }, { additionalProperties: false }),
    Type.Object(
        { kind: Type.Literal('private'), privateCompanyId: Id },
        { additionalProperties: false }
    )
])
export type PurchaseAsset = Type.Static<typeof PurchaseAsset>
export const PurchaseOfferRequest = Type.Object(
    {
        companyId: Id,
        asset: PurchaseAsset,
        seller: Owner,
        price: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type PurchaseOfferRequest = Type.Static<typeof PurchaseOfferRequest>
export const PurchaseOffer = Type.Object(
    {
        ...PurchaseOfferRequest.properties,
        id: Id,
        buyerPlayerId: Id,
        sellerPlayerId: Id
    },
    { additionalProperties: false }
)
export type PurchaseOffer = Type.Static<typeof PurchaseOffer>
/** A player's offer, during their stock turn, for a private another player owns. */
export const PlayerPurchaseOffer = Type.Object(
    {
        id: Id,
        asset: Type.Object(
            { kind: Type.Literal('private'), privateCompanyId: Id },
            { additionalProperties: false }
        ),
        seller: Owner,
        price: Type.Integer({ minimum: 1 }),
        buyerPlayerId: Id,
        sellerPlayerId: Id
    },
    { additionalProperties: false }
)
export type PlayerPurchaseOffer = Type.Static<typeof PlayerPurchaseOffer>
/** The offer awaiting its seller's answer: a company's purchase or a player's. */
export const PendingPurchaseOffer = Type.Union([PurchaseOffer, PlayerPurchaseOffer])
export type PendingPurchaseOffer = Type.Static<typeof PendingPurchaseOffer>
export function isCompanyPurchaseOffer(offer: PendingPurchaseOffer): offer is PurchaseOffer {
    return 'companyId' in offer
}
export interface TransferRules {
    operatingCompany(state: CompanyDecisionState): string | undefined
    canPurchase(state: CompanyDecisionState, companyId: string, asset: PurchaseAsset): boolean
    priceRange(
        state: CompanyDecisionState,
        companyId: string,
        asset: PurchaseAsset
    ): { minimum: number; maximum?: number } | undefined
    afterPurchase(state: CompanyDecisionState, offer: PurchaseOffer): void
    /**
     * Who makes up a price the buyer's treasury cannot cover, in order, and the highest price
     * they may fund; undefined when the treasury must pay alone.
     */
    purchaseFunding?(
        state: CompanyDecisionState,
        companyId: string,
        asset: PurchaseAsset
    ): PurchaseFunding | undefined
}
export type PurchaseFunding = { contributors: readonly Owner[]; maximumPrice: number }
export function assetOwner(state: CompanyDecisionState, asset: PurchaseAsset): Owner | undefined {
    if (asset.kind === 'private') {
        const company = state.companies.find((item) => item.id === asset.privateCompanyId)
        return company?.kind === 'private' && !company.closed
            ? privateOwner(state, company.id)
            : undefined
    }
    const train = state.trainInventory.trains.find((item) => item.id === asset.trainId)
    return train?.status === 'owned' && trainCanBeTraded(train) ? train.owner : undefined
}
export function evaluatePurchaseOffer(
    state: CompanyDecisionState,
    request: PurchaseOfferRequest,
    rules: TransferRules,
    trains: TrainRules
):
    | { buyerPlayerId: string; sellerPlayerId: string; reason?: never }
    | { reason: string; buyerPlayerId?: never; sellerPlayerId?: never } {
    if (rules.operatingCompany(state) !== request.companyId)
        return { reason: 'Only the operating company may make a purchase offer.' }
    if (!rules.canPurchase(state, request.companyId, request.asset))
        return { reason: 'This asset cannot be purchased at this point in the turn.' }
    const buyer = state.companies.find((item) => item.id === request.companyId)
    const buyerPlayerId =
        buyer && !buyer.closed ? controllingOwner(state, buyer.id)?.playerId : undefined
    const owner = assetOwner(state, request.asset)
    if (
        !owner ||
        !sameOwner(owner, request.seller) ||
        sameOwner(owner, { kind: 'company', companyId: request.companyId })
    )
        return { reason: 'The seller no longer owns an eligible asset.' }
    const sellerPlayerId =
        owner.kind === 'player'
            ? owner.playerId
            : owner.kind === 'company'
              ? controllingOwner(state, owner.companyId)?.playerId
              : undefined
    if (!buyerPlayerId || !sellerPlayerId)
        return { reason: 'Both parties must have a controlling player.' }
    const range = rules.priceRange(state, request.companyId, request.asset)
    if (
        !range ||
        !Number.isInteger(request.price) ||
        request.price < range.minimum ||
        (range.maximum !== undefined && request.price > range.maximum)
    )
        return { reason: 'This purchase or price is not permitted.' }
    if (!canFund(state, request, rules)) return { reason: 'The buyer cannot afford the offer.' }
    if (request.asset.kind === 'train') {
        if (owner.kind !== 'company')
            return { reason: 'Intercompany trains must belong to another company.' }
        if (state.companies.find((item) => item.id === owner.companyId)?.closed)
            return { reason: 'A closed company cannot sell trains.' }
        if (
            trainsOwnedBy(state, { kind: 'company', companyId: request.companyId }).length >=
            trains.trainLimit(state, request.companyId)
        )
            return { reason: 'The buyer is at its train limit.' }
    }
    return { buyerPlayerId, sellerPlayerId }
}
export function settlePurchaseOffer(
    state: CompanyDecisionState,
    offer: PurchaseOffer,
    rules: TransferRules,
    trains: TrainRules
): void {
    const evaluation = evaluatePurchaseOffer(state, offer, rules, trains)
    assert(
        evaluation.buyerPlayerId === offer.buyerPlayerId &&
            evaluation.sellerPlayerId === offer.sellerPlayerId,
        evaluation.reason ?? 'Decision authority has changed'
    )
    const owner = { kind: 'company', companyId: offer.companyId } as const
    settleCashPayments(state, [
        ...fundingContributions(state, offer, rules),
        { from: owner, to: offer.seller, amount: offer.price }
    ])
    const asset = offer.asset
    if (asset.kind === 'train') {
        const train = state.trainInventory.trains.find((item) => item.id === asset.trainId)
        assert(train?.status === 'owned', 'The train must still be owned')
        settleTrainDepartures(state, trains, [
            {
                trainId: train.id,
                definitionId: train.definitionId,
                cause: 'purchase',
                owner: { ...train.owner }
            }
        ])
        train.owner = owner
        closePrivatesOnTrainPurchase(state, trains, offer.companyId)
    } else {
        const certificate = state.certificates.find(
            (item) =>
                !item.retired &&
                item.kind === 'private' &&
                item.companyId === asset.privateCompanyId
        )
        assertExists(certificate, 'The private requires its certificate')
        assert(!certificate.retired, 'The private must remain open')
        certificate.owner = owner
        delete certificate.poolId
    }
    rules.afterPurchase(state, offer)
}

function canFund(
    state: CompanyDecisionState,
    request: PurchaseOfferRequest,
    rules: TransferRules
): boolean {
    const treasury = cashOwnedBy(state, { kind: 'company', companyId: request.companyId })
    if (treasury === undefined) return false
    if (treasury === 'unlimited' || treasury >= request.price) return true
    const funding = rules.purchaseFunding?.(state, request.companyId, request.asset)
    return (
        !!funding &&
        request.price <= funding.maximumPrice &&
        funding.contributors.reduce(
            (sum, owner) => sum + finiteCashOwnedBy(state, owner),
            treasury
        ) >= request.price
    )
}

export function fundingContributions(
    state: CompanyDecisionState,
    offer: PurchaseOfferRequest,
    rules: TransferRules
): CashPayment[] {
    const buyer = { kind: 'company', companyId: offer.companyId } as const
    let shortfall = offer.price - finiteCashOwnedBy(state, buyer)
    if (shortfall <= 0) return []
    const funding = rules.purchaseFunding?.(state, offer.companyId, offer.asset)
    assertExists(funding, 'A purchase beyond the treasury requires funding')
    return funding.contributors.flatMap((owner) => {
        const amount = Math.min(shortfall, finiteCashOwnedBy(state, owner))
        shortfall -= amount
        return amount ? [{ from: owner, to: buyer, amount }] : []
    })
}
