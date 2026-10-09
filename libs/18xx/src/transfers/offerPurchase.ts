import { CompanyChanges, CompanyChangeRecorder } from '../company/companyChanges.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { pendingCompanyDecision, type CompanyDecisionState } from '../privates/companyDecision.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TrainState } from '../trains/train.js'
import type { CashPayment } from '../finance/cashPayments.js'
import { DeparturePayments, departurePaymentsField } from '../trains/trainDepartures.js'
import {
    offerSaleRequest,
    privateSaleReason,
    settlePlayerPurchaseOffer
} from '../stock/privateSale.js'
import type { StockRules } from '../stock/stockRules.js'
import {
    PendingPurchaseOffer,
    PurchaseOfferRequest,
    PurchaseOffer,
    PurchaseEffects,
    OrdinaryPurchaseAsset,
    OrdinaryPurchaseOffer,
    OrdinaryPendingPurchaseOffer,
    isCompanyPurchaseOffer,
    evaluatePurchaseOffer,
    settlePurchaseOffer,
    type TransferRules
} from './purchaseOffer.js'
const PurchaseMetadataFields = {
    accepted: Type.Boolean(),
    trainDefinitionId: Type.Optional(Type.String()),
    companyChanges: Type.Optional(CompanyChanges),
    departurePayments: DeparturePayments
}
/** The offered train's kind, recorded so history can name it after the train leaves play. */
function offeredTrain(
    state: Pick<TrainState, 'trainInventory'>,
    asset: { kind: string; trainId?: string }
): { trainDefinitionId?: string } {
    if (asset.kind !== 'train') return {}
    const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
    assertExists(train, 'An offered train is in play')
    return { trainDefinitionId: train.definitionId }
}
export const OfferPurchase = Type.Object(
    {
        ...PlayerAction.properties,
        ...PurchaseOfferRequest.properties,
        type: Type.Literal('OfferPurchase'),
        metadata: Type.Optional(
            Type.Object({
                offer: PurchaseOffer,
                ...PurchaseMetadataFields,
                effects: Type.Optional(PurchaseEffects)
            })
        )
    },
    { additionalProperties: false }
)
export type OfferPurchase = Type.Static<typeof OfferPurchase>
export const OrdinaryOfferPurchase = Type.Object(
    {
        ...OfferPurchase.properties,
        asset: OrdinaryPurchaseAsset,
        metadata: Type.Optional(
            Type.Object({
                offer: OrdinaryPurchaseOffer,
                ...PurchaseMetadataFields
            })
        )
    },
    { additionalProperties: false }
)
const Validator = Compile(OfferPurchase)
export class HydratedOfferPurchase
    extends HydratableAction<typeof OfferPurchase>
    implements OfferPurchase
{
    declare type: 'OfferPurchase'
    declare playerId: string
    declare companyId: string
    declare asset: PurchaseOfferRequest['asset']
    declare seller: PurchaseOfferRequest['seller']
    declare price: number
    declare metadata?: OfferPurchase['metadata']
    readonly #rules: TransferRules
    readonly #trains: TrainRules
    constructor(data: OfferPurchase, rules: TransferRules, trains: TrainRules) {
        super(data instanceof HydratedOfferPurchase ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#trains = trains
    }
    isValid(state: CompanyDecisionState): boolean {
        return (
            this.source === ActionSource.User &&
            !pendingCompanyDecision(state) &&
            state.activePlayerIds.includes(this.playerId) &&
            evaluatePurchaseOffer(state, this, this.#rules, this.#trains).buyerPlayerId ===
                this.playerId
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid purchase offer')
        const result = evaluatePurchaseOffer(state, this, this.#rules, this.#trains)
        assert(result.buyerPlayerId && result.sellerPlayerId, 'Offer requires both players')
        const offer: PurchaseOffer = {
            id: this.id,
            companyId: this.companyId,
            asset: this.asset,
            seller: this.seller,
            price: this.price,
            buyerPlayerId: result.buyerPlayerId,
            sellerPlayerId: result.sellerPlayerId
        }
        const companies = new CompanyChangeRecorder(state)
        const train = offeredTrain(state, offer.asset)
        const accepted = offer.buyerPlayerId === offer.sellerPlayerId
        const settlement = accepted
            ? settlePurchaseOffer(state, offer, this.#rules, this.#trains)
            : { payments: [] }
        if (!accepted) state.purchaseOffer = offer
        this.metadata = {
            companyChanges: companies.changes(state),
            offer,
            accepted,
            ...train,
            ...(settlement.effects ? { effects: settlement.effects } : {}),
            ...departurePaymentsField(settlement.payments)
        }
    }
}
export const RespondToPurchaseOffer = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('RespondToPurchaseOffer'),
        offerId: Type.String(),
        accept: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object({
                offer: PendingPurchaseOffer,
                ...PurchaseMetadataFields,
                effects: Type.Optional(PurchaseEffects)
            })
        )
    },
    { additionalProperties: false }
)
export type RespondToPurchaseOffer = Type.Static<typeof RespondToPurchaseOffer>
export const OrdinaryRespondToPurchaseOffer = Type.Object(
    {
        ...RespondToPurchaseOffer.properties,
        metadata: Type.Optional(
            Type.Object({
                offer: OrdinaryPendingPurchaseOffer,
                ...PurchaseMetadataFields
            })
        )
    },
    { additionalProperties: false }
)
const ResponseValidator = Compile(RespondToPurchaseOffer)
export class HydratedRespondToPurchaseOffer
    extends HydratableAction<typeof RespondToPurchaseOffer>
    implements RespondToPurchaseOffer
{
    declare type: 'RespondToPurchaseOffer'
    declare playerId: string
    declare offerId: string
    declare accept: boolean
    declare metadata?: RespondToPurchaseOffer['metadata']
    readonly #rules: TransferRules
    readonly #trains: TrainRules
    readonly #stocks: StockRules
    constructor(
        data: RespondToPurchaseOffer,
        rules: TransferRules,
        trains: TrainRules,
        stocks: StockRules
    ) {
        super(
            data instanceof HydratedRespondToPurchaseOffer ? data.dehydrate() : data,
            ResponseValidator
        )
        this.#rules = rules
        this.#trains = trains
        this.#stocks = stocks
    }
    isValid(state: CompanyDecisionState): boolean {
        const offer = state.purchaseOffer
        if (
            this.source !== ActionSource.User ||
            !offer ||
            offer.id !== this.offerId ||
            offer.sellerPlayerId !== this.playerId ||
            !state.activePlayerIds.includes(this.playerId)
        )
            return false
        if (!this.accept) return true
        if (!isCompanyPurchaseOffer(offer))
            return privateSaleReason(state, this.#stocks, offerSaleRequest(offer)) === undefined
        const result = evaluatePurchaseOffer(state, offer, this.#rules, this.#trains)
        return (
            result.buyerPlayerId === offer.buyerPlayerId &&
            result.sellerPlayerId === offer.sellerPlayerId
        )
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(this.isValid(state), 'Invalid or stale purchase response')
        const offer = state.purchaseOffer!
        const companies = new CompanyChangeRecorder(state)
        const train = offeredTrain(state, offer.asset)
        const payments: CashPayment[] = []
        let effects: PurchaseEffects | undefined
        if (isCompanyPurchaseOffer(offer)) {
            if (this.accept) {
                const settlement = settlePurchaseOffer(state, offer, this.#rules, this.#trains)
                payments.push(...settlement.payments)
                effects = settlement.effects
            }
        } else {
            if (this.accept) settlePlayerPurchaseOffer(state, offer, this.#stocks)
            state.activePlayerIds = [offer.buyerPlayerId]
        }
        delete state.purchaseOffer
        this.metadata = {
            companyChanges: companies.changes(state),
            offer,
            accepted: this.accept,
            ...train,
            ...(effects ? { effects } : {}),
            ...departurePaymentsField(payments)
        }
    }
}

export function isOfferPurchase(action: GameAction): action is OfferPurchase {
    return (
        action instanceof HydratedOfferPurchase ||
        (action.type === 'OfferPurchase' && Validator.Check(action))
    )
}

export function isRespondToPurchaseOffer(action: GameAction): action is RespondToPurchaseOffer {
    return (
        action instanceof HydratedRespondToPurchaseOffer ||
        (action.type === 'RespondToPurchaseOffer' && ResponseValidator.Check(action))
    )
}
