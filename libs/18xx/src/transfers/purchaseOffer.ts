import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    controllingOwner,
    privateOwner,
    sameOwner
} from '../finance/finance.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { trainCanBeTraded, trainsOwnedBy } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { CompanyDecisionState } from '../privates/companyDecision.js'

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
export interface TransferRules {
    priceRange(
        state: CompanyDecisionState,
        companyId: string,
        asset: PurchaseAsset
    ): { minimum: number; maximum?: number } | undefined
    afterPurchase(state: CompanyDecisionState, offer: PurchaseOffer): void
}
export const OperatingDecisionStates = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'DistributingEarnings',
    'BuyingTrains'
]
export function operatingCompany(state: CompanyDecisionState): string | undefined {
    return OperatingDecisionStates.includes(state.machineState)
        ? nextOperatingCompany(state)
        : undefined
}
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
    if (operatingCompany(state) !== request.companyId)
        return { reason: 'Only the operating company may make a purchase offer.' }
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
    const cash = cashOwnedBy(state, { kind: 'company', companyId: request.companyId })
    if (cash === undefined || (cash !== 'unlimited' && cash < request.price))
        return { reason: 'The buyer cannot afford the offer.' }
    if (request.asset.kind === 'train') {
        if (
            state.machineState !== 'BuyingTrains' ||
            state.trainPurchaseStep?.companyId !== request.companyId ||
            owner.kind !== 'company'
        )
            return { reason: 'Intercompany trains may only be bought during train purchasing.' }
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
    settleCashPayments(state, [{ from: owner, to: offer.seller, amount: offer.price }])
    const asset = offer.asset
    if (asset.kind === 'train') {
        const train = state.trainInventory.trains.find((item) => item.id === asset.trainId)
        assert(train?.status === 'owned', 'The train must still be owned')
        train.owner = owner
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
