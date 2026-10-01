import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { settleCashPayments } from '../finance/cashPayments.js'
import { cashOwnedBy, privateOwner } from '../finance/finance.js'
import type { StockState } from './stockState.js'
import { certificateLimitAllows, type StockRules } from './stockRules.js'
import { recordStockAction } from './stockRoundRules.js'
import { recordTurnPurchase, type StockTurnPurchaseState } from './turnPurchases.js'

export const PrivateSaleOffer = Type.Object(
    {
        privateCompanyId: Type.String(),
        buyerPlayerId: Type.String(),
        sellerPlayerId: Type.String(),
        price: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type PrivateSaleOffer = Type.Static<typeof PrivateSaleOffer>

/**
 * State fields a title adds with ``StockRules.privateSales``. They stay out of the family state
 * until titles in play can take a state migration.
 */
export const PrivateSaleFields = { privateSaleOffer: Type.Optional(PrivateSaleOffer) }
export type PrivateSaleState = StockState &
    StockTurnPurchaseState & { machineState: string; privateSaleOffer?: PrivateSaleOffer }

export interface PrivateSaleRules {
    /** The price bounds for buying a player's private this turn, or undefined when not for sale. */
    priceRange(
        state: StockState,
        privateCompanyId: string
    ): { minimum: number; maximum?: number } | undefined
}

/** Why a player may not offer this price for another player's private now, if they may not. */
export function privateSaleOfferReason(
    state: PrivateSaleState,
    rules: StockRules,
    request: { playerId: string; privateCompanyId: string; price: number }
): string | undefined {
    const { playerId, privateCompanyId, price } = request
    if (!rules.privateSales) return 'Private companies are not sold between players.'
    if (state.machineState !== 'StockRound' || state.stockRound.completed)
        return 'Privates are sold between players during stock rounds.'
    if (state.privateSaleOffer) return 'Another private sale awaits an answer.'
    if (!state.activePlayerIds.includes(playerId)) return 'It is not this player’s turn.'
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
        price: Type.Integer({ minimum: 0 })
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
    apply(state: HydratedGameState & PrivateSaleState): void {
        assert(this.source === ActionSource.User, 'A private purchase offer requires a player')
        const reason = privateSaleOfferReason(state, this.#rules, this)
        assert(reason === undefined, reason ?? 'Invalid private purchase offer')
        const owner = privateOwner(state, this.privateCompanyId)
        assert(owner?.kind === 'player', 'The seller is a player')
        state.privateSaleOffer = {
            privateCompanyId: this.privateCompanyId,
            buyerPlayerId: this.playerId,
            sellerPlayerId: owner.playerId,
            price: this.price
        }
    }
}

export const AnswerPrivatePurchase = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AnswerPrivatePurchase'),
        accept: Type.Boolean(),
        metadata: Type.Optional(PrivateSaleOffer)
    },
    { additionalProperties: false }
)
export type AnswerPrivatePurchase = Type.Static<typeof AnswerPrivatePurchase>
const AnswerValidator = Compile(AnswerPrivatePurchase)
export function isAnswerPrivatePurchase(action: GameAction): action is AnswerPrivatePurchase {
    return (
        action instanceof HydratedAnswerPrivatePurchase ||
        (action.type === 'AnswerPrivatePurchase' && AnswerValidator.Check(action))
    )
}
export class HydratedAnswerPrivatePurchase
    extends HydratableAction<typeof AnswerPrivatePurchase>
    implements AnswerPrivatePurchase
{
    declare type: 'AnswerPrivatePurchase'
    declare playerId: string
    declare accept: boolean
    declare metadata?: PrivateSaleOffer
    readonly #rules: StockRules
    constructor(data: AnswerPrivatePurchase, rules: StockRules) {
        super(
            data instanceof HydratedAnswerPrivatePurchase ? data.dehydrate() : data,
            AnswerValidator
        )
        this.#rules = rules
    }
    apply(state: HydratedGameState & PrivateSaleState): void {
        const offer = state.privateSaleOffer
        assert(
            this.source === ActionSource.User && offer?.sellerPlayerId === this.playerId,
            'Only the private’s owner may answer the offer'
        )
        delete state.privateSaleOffer
        state.activePlayerIds = [offer.buyerPlayerId]
        this.metadata = offer
        if (!this.accept) return
        const buyer = { kind: 'player', playerId: offer.buyerPlayerId } as const
        const certificate = privateCharter(state, offer.privateCompanyId)
        if (offer.price > 0)
            settleCashPayments(state, [
                {
                    from: buyer,
                    to: { kind: 'player', playerId: offer.sellerPlayerId },
                    amount: offer.price
                }
            ])
        certificate.owner = buyer
        recordStockAction(state, offer.buyerPlayerId, this.#rules.round)
        recordTurnPurchase(state, this.#rules, {
            kind: 'private',
            companyId: offer.privateCompanyId
        })
        state.stockRound.turn.soldBeforeBuying = state.stockRound.turn.companiesSold.length > 0
        state.stockRound.turn.bought = true
    }
}

/** Gives the stock round to a private's owner until they answer a purchase offer. */
export class PrivateSaleHandler<
    State extends HydratedGameState & PrivateSaleState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: StockRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const offer = context.gameState.privateSaleOffer
        if (offer)
            return (
                action instanceof HydratedAnswerPrivatePurchase &&
                action.playerId === offer.sellerPlayerId
            )
        if (action instanceof HydratedOfferPrivatePurchase)
            return !privateSaleOfferReason(context.gameState, this.rules, action)
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const offer = state.privateSaleOffer
        if (offer) return offer.sellerPlayerId === playerId ? ['AnswerPrivatePurchase'] : []
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return this.offersPurchase(state, playerId) ? [...actions, 'OfferPrivatePurchase'] : actions
    }
    enter(context: MachineContext<State>): void {
        const offer = context.gameState.privateSaleOffer
        if (offer) context.gameState.activePlayerIds = [offer.sellerPlayerId]
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedOfferPrivatePurchase ||
            action instanceof HydratedAnswerPrivatePurchase
            ? 'StockRound'
            : this.handler.onAction(action, context)
    }
    private offersPurchase(state: State, playerId: string): boolean {
        return state.companies.some((company) => {
            const range =
                company.kind === 'private'
                    ? this.rules.privateSales?.priceRange(state, company.id)
                    : undefined
            return (
                range !== undefined &&
                !privateSaleOfferReason(state, this.rules, {
                    playerId,
                    privateCompanyId: company.id,
                    price: range.minimum
                })
            )
        })
    }
}
