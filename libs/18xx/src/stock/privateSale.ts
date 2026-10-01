import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { settleCashPayments } from '../finance/cashPayments.js'
import { cashOwnedBy, privateOwner } from '../finance/finance.js'
import type { PendingPurchaseOffer, PlayerPurchaseOffer } from '../transfers/purchaseOffer.js'
import type { StockState } from './stockState.js'
import { certificateLimitAllows, type StockRules } from './stockRules.js'
import { recordStockAction } from './stockRoundRules.js'
import { recordTurnPurchase, type StockTurnPurchaseState } from './turnPurchases.js'

export type PrivateSaleState = StockState &
    StockTurnPurchaseState & { machineState: string; purchaseOffer?: PendingPurchaseOffer }

export interface PrivateSaleRules {
    /** The price bounds for buying a player's private this turn, or undefined when not for sale. */
    priceRange(
        state: StockState,
        privateCompanyId: string
    ): { minimum: number; maximum?: number } | undefined
}

type PrivateSaleRequest = { playerId: string; privateCompanyId: string; price: number }

/** Why the player may not buy this private at this price from its owner now, if they may not. */
export function privateSaleReason(
    state: PrivateSaleState,
    rules: StockRules,
    request: PrivateSaleRequest
): string | undefined {
    const { playerId, privateCompanyId, price } = request
    if (!rules.privateSales) return 'Private companies are not sold between players.'
    if (state.machineState !== 'StockRound' || state.stockRound.completed)
        return 'Privates are sold between players during stock rounds.'
    if (state.stockRound.turn.bought) return 'A private must be the turn’s first purchase.'
    const company = state.companies.find((company) => company.id === privateCompanyId)
    if (company?.kind !== 'private' || company.closed) return 'This is not an open private.'
    const owner = privateOwner(state, privateCompanyId)
    if (owner?.kind !== 'player') return 'This private is not owned by a player.'
    if (owner.playerId === playerId) return 'The buyer already owns this private.'
    const range = rules.privateSales.priceRange(state, privateCompanyId)
    if (!range) return 'This private cannot be sold between players now.'
    if (!Number.isSafeInteger(price) || price < range.minimum)
        return `The price must be at least ${range.minimum}.`
    if (range.maximum !== undefined && price > range.maximum)
        return `The price must be at most ${range.maximum}.`
    const cash = cashOwnedBy(state, { kind: 'player', playerId })
    if (cash === undefined || (cash !== 'unlimited' && cash < price))
        return 'The buyer cannot afford this price.'
    const certificate = privateCharter(state, privateCompanyId)
    if (!certificateLimitAllows(state, { kind: 'player', playerId }, certificate, rules))
        return 'The purchase exceeds the certificate limit.'
    return undefined
}

/** Why the active player may not offer this price for another player's private now. */
export function privateSaleOfferReason(
    state: PrivateSaleState,
    rules: StockRules,
    request: PrivateSaleRequest
): string | undefined {
    if (state.purchaseOffer) return 'Another offer awaits an answer.'
    if (!state.activePlayerIds.includes(request.playerId)) return 'It is not this player’s turn.'
    return privateSaleReason(state, rules, request)
}

/** Completes an accepted player offer: the private and cash change hands as the turn's purchase. */
export function settlePlayerPurchaseOffer(
    state: PrivateSaleState,
    offer: PlayerPurchaseOffer,
    rules: StockRules
): void {
    const reason = privateSaleReason(state, rules, {
        playerId: offer.buyerPlayerId,
        privateCompanyId: offer.asset.privateCompanyId,
        price: offer.price
    })
    assert(reason === undefined, reason ?? 'Invalid private sale')
    const buyer = { kind: 'player', playerId: offer.buyerPlayerId } as const
    settleCashPayments(state, [{ from: buyer, to: offer.seller, amount: offer.price }])
    privateCharter(state, offer.asset.privateCompanyId).owner = buyer
    recordStockAction(state, offer.buyerPlayerId, rules.round)
    recordTurnPurchase(state, rules, { kind: 'private', companyId: offer.asset.privateCompanyId })
    state.stockRound.turn.soldBeforeBuying = state.stockRound.turn.companiesSold.length > 0
    state.stockRound.turn.bought = true
}

function privateCharter(state: StockState, privateCompanyId: string) {
    const certificate = state.certificates.find(
        (certificate) =>
            certificate.kind === 'private' && certificate.companyId === privateCompanyId
    )
    assert(certificate && !certificate.retired, 'A private has a charter certificate')
    return certificate
}

export const OfferPrivatePurchase = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('OfferPrivatePurchase'),
        privateCompanyId: Type.String(),
        price: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type OfferPrivatePurchase = Type.Static<typeof OfferPrivatePurchase>
const OfferValidator = Compile(OfferPrivatePurchase)
export function isOfferPrivatePurchase(action: GameAction): action is OfferPrivatePurchase {
    return (
        action instanceof HydratedOfferPrivatePurchase ||
        (action.type === 'OfferPrivatePurchase' && OfferValidator.Check(action))
    )
}
/** A player's offer for another player's private, answered with ``RespondToPurchaseOffer``. */
export class HydratedOfferPrivatePurchase
    extends HydratableAction<typeof OfferPrivatePurchase>
    implements OfferPrivatePurchase
{
    declare type: 'OfferPrivatePurchase'
    declare playerId: string
    declare privateCompanyId: string
    declare price: number
    readonly #rules: StockRules
    constructor(data: OfferPrivatePurchase, rules: StockRules) {
        super(
            data instanceof HydratedOfferPrivatePurchase ? data.dehydrate() : data,
            OfferValidator
        )
        this.#rules = rules
    }
    isValid(state: PrivateSaleState): boolean {
        return (
            this.source === ActionSource.User &&
            privateSaleOfferReason(state, this.#rules, this) === undefined
        )
    }
    apply(state: HydratedGameState & PrivateSaleState): void {
        assert(this.isValid(state), 'Invalid private purchase offer')
        const owner = privateOwner(state, this.privateCompanyId)
        assert(owner?.kind === 'player', 'The seller is a player')
        state.purchaseOffer = {
            id: this.id,
            asset: { kind: 'private', privateCompanyId: this.privateCompanyId },
            seller: owner,
            price: this.price,
            buyerPlayerId: this.playerId,
            sellerPlayerId: owner.playerId
        }
    }
}

/** Whether the player may offer for some other player's private now. */
export function offersPrivatePurchase(
    state: PrivateSaleState,
    rules: StockRules,
    playerId: string
): boolean {
    return state.companies.some((company) => {
        const range =
            company.kind === 'private' && !company.closed
                ? rules.privateSales?.priceRange(state, company.id)
                : undefined
        return (
            range !== undefined &&
            privateSaleOfferReason(state, rules, {
                playerId,
                privateCompanyId: company.id,
                price: range.minimum
            }) === undefined
        )
    })
}
