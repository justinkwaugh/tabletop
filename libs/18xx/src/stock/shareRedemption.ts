import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    finiteCashOwnedBy,
    getCompany,
    Owner,
    sharesOwned,
    type Company
} from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { stepAction } from '../game/stepAction.js'
import { isCompleteStockRound } from './completeStockRound.js'
import { CorporateStockActionsHandler, corporateTurnOpen } from './corporateStockTurn.js'
import { isFinishStockTurn } from './finishStockTurn.js'
import type { SharePurchaseDetails } from './sharePurchase.js'
import type { StockMarketChart } from './stockMarket.js'

import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'
import { recordStockAction, type StockRoundRules } from './stockRoundRules.js'

const Id = Type.String({ minLength: 1 })
const StockRoundNumber = Type.Integer({ minimum: 1 })
const Amounts = Type.Record(Id, Type.Integer({ minimum: 1 }))

export const ConsentingRedemptionState = 'ConsentingRedemption'

export const RedemptionRequest = Type.Object(
    {
        companyId: Id,
        certificateId: Id,
        holderPlayerId: Id,
        presidentPlayerId: Id,
        price: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type RedemptionRequest = Type.Static<typeof RedemptionRequest>

export const ShareRedemptionFields = {
    redemptions: Type.Optional(Amounts),
    redemptionRequest: Type.Optional(RedemptionRequest),
    redemptionRefusals: Type.Optional(
        Type.Array(Type.Object({ companyId: Id, playerId: Id }, { additionalProperties: false }))
    ),
    reissues: Type.Optional(Type.Record(Id, StockRoundNumber)),
    lockedProceeds: Type.Optional(Amounts)
}
export type ShareRedemptionState = Type.Static<Type.TObject<typeof ShareRedemptionFields>>

type RedemptionState = HydratedEighteenXXState & ShareRedemptionState

const MaximumCompanyPercent = 40
const MinimumOutsidePercent = 60

const companyOwner = (companyId: string) => ({ kind: 'company' as const, companyId })

export type RedemptionChoice = {
    companyId: string
    certificateId: string
    holder: Owner
    price: number
}
export type ReissueChoice = { companyId: string; certificateIds: string[]; parPrice: number }

export interface ShareRedemptionRules<State extends RedemptionState> {
    market: StockMarketChart
    charters: CompanyCharters
    roundRules: StockRoundRules
    stockRules(): StockRules
    requireState(state: object): State
    mayRedeem(company: Company): boolean
    redemptionsPerRound(state: State, companyId: string): number
    reissueParPrice(state: State, companyId: string): number
    reissueNeedsEmptyOffering: boolean
}

export class ShareRedemptionProcedure<State extends RedemptionState> {
    constructor(readonly rules: ShareRedemptionRules<State>) {}

    private shareCount(state: StockState, companyId: string): number {
        const count = companyShareCount(state, this.rules.charters, companyId)
        assertExists(count, 'Redemption requires a share count')
        return count
    }

    spendableCash(state: State, companyId: string): number {
        return (
            finiteCashOwnedBy(state, companyOwner(companyId)) -
            (state.lockedProceeds?.[companyId] ?? 0)
        )
    }

    private actingForCompany(state: State, playerId: string, companyId: string): boolean {
        const company = getCompany(state, companyId)
        return (
            company.kind !== 'private' &&
            this.rules.mayRedeem(company) &&
            !company.closed &&
            !state.stockRound.turn.corporateAction &&
            corporateTurnOpen(state, playerId, companyId, this.rules.stockRules())
        )
    }

    private outsideShares(state: StockState, companyId: string): number {
        return state.certificates.reduce(
            (total, certificate) =>
                total +
                (certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                (certificate.owner.kind === 'player' || certificate.poolId === 'open-market')
                    ? certificate.shares
                    : 0),
            0
        )
    }

    private refused(state: State, companyId: string, playerId: string): boolean {
        return (state.redemptionRefusals ?? []).some(
            (refusal) => refusal.companyId === companyId && refusal.playerId === playerId
        )
    }

    redemptionChoices(state: State, playerId: string): RedemptionChoice[] {
        return state.companies.flatMap((company) => {
            if (!this.actingForCompany(state, playerId, company.id)) return []
            if (
                (state.redemptions?.[company.id] ?? 0) >=
                this.rules.redemptionsPerRound(state, company.id)
            )
                return []
            const shareCount = this.shareCount(state, company.id)
            const held = sharesOwned(state, company.id, companyOwner(company.id))
            const outside = this.outsideShares(state, company.id)
            const price = this.rules.market.companySpace(state.stockMarket, company.id).price
            const candidates = state.certificates.flatMap((certificate) =>
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.shares === 1 &&
                certificate.companyId === company.id &&
                (certificate.owner.kind === 'player' || certificate.poolId === 'open-market') &&
                (held + certificate.shares) * 100 <= MaximumCompanyPercent * shareCount &&
                (outside - certificate.shares) * 100 >= MinimumOutsidePercent * shareCount &&
                price * certificate.shares <= this.spendableCash(state, company.id)
                    ? [certificate]
                    : []
            )
            const market = candidates.find((certificate) => certificate.poolId === 'open-market')
            if (market)
                return [
                    {
                        companyId: company.id,
                        certificateId: market.id,
                        holder: { kind: 'bank' as const },
                        price: price * market.shares
                    }
                ]
            const choices = new Map<string, RedemptionChoice>()
            for (const certificate of candidates) {
                const owner = certificate.owner
                if (
                    owner.kind !== 'player' ||
                    choices.has(owner.playerId) ||
                    this.refused(state, company.id, owner.playerId) ||
                    (owner.playerId === playerId &&
                        !this.keepsPresidency(state, company.id, playerId, certificate.shares))
                )
                    continue
                choices.set(owner.playerId, {
                    companyId: company.id,
                    certificateId: certificate.id,
                    holder: owner,
                    price: price * certificate.shares
                })
            }
            return [...choices.values()]
        })
    }

    private keepsPresidency(
        state: StockState,
        companyId: string,
        presidentId: string,
        shares: number
    ): boolean {
        const remaining = sharesOwned(state, companyId, { kind: 'player', playerId: presidentId })
        return state.players.every(
            (player) =>
                player.playerId === presidentId ||
                sharesOwned(state, companyId, { kind: 'player', playerId: player.playerId }) <=
                    remaining - shares
        )
    }

    redemptionChoice(
        state: State,
        playerId: string,
        companyId: string,
        certificateId: string
    ): RedemptionChoice | undefined {
        return this.redemptionChoices(state, playerId).find(
            (choice) => choice.companyId === companyId && choice.certificateId === certificateId
        )
    }

    applyRedemption(state: State, choice: RedemptionChoice, presidentId: string): CashPayment {
        const payment: CashPayment = {
            from: companyOwner(choice.companyId),
            to: choice.holder,
            amount: choice.price
        }
        settleCashPayments(state, [payment])
        const certificate = state.certificates.find((item) => item.id === choice.certificateId)
        assert(certificate, 'A redeemed share is in play')
        certificate.owner = companyOwner(choice.companyId)
        delete certificate.poolId
        state.redemptions = {
            ...state.redemptions,
            [choice.companyId]: (state.redemptions?.[choice.companyId] ?? 0) + 1
        }
        state.stockRound.turn.corporateAction = { companyId: choice.companyId }
        recordStockAction(state, presidentId, this.rules.roundRules)
        return payment
    }

    reissueChoices(state: State, playerId: string): ReissueChoice[] {
        return state.companies.flatMap((company) => {
            if (!this.actingForCompany(state, playerId, company.id)) return []
            const reissued = state.reissues?.[company.id]
            if (reissued === state.stockRound.number) return []
            const certificateIds = state.certificates.flatMap((certificate) =>
                certificate.companyId === company.id &&
                certificate.owner.kind === 'company' &&
                certificate.owner.companyId === company.id
                    ? [certificate.id]
                    : []
            )
            const offered = state.certificates.some(
                (certificate) =>
                    certificate.companyId === company.id &&
                    certificate.poolId === 'initial-offering'
            )
            const barred =
                offered && (this.rules.reissueNeedsEmptyOffering || reissued === undefined)
            if (!certificateIds.length || barred) return []
            return [
                {
                    companyId: company.id,
                    certificateIds,
                    parPrice: this.rules.reissueParPrice(state, company.id)
                }
            ]
        })
    }

    isReissuedShare(state: StockState, companyId: string, poolId?: string): boolean {
        return (
            poolId === 'initial-offering' &&
            this.rules.requireState(state).reissues?.[companyId] !== undefined
        )
    }

    lockProceeds(state: StockState, details: SharePurchaseDetails): void {
        const title = this.rules.requireState(state)
        const amount = details.payments
            .filter(
                (payment) =>
                    payment.to.kind === 'company' && payment.to.companyId === details.companyId
            )
            .reduce((total, payment) => total + payment.amount, 0)
        if (!amount) return
        title.lockedProceeds = {
            ...title.lockedProceeds,
            [details.companyId]: (title.lockedProceeds?.[details.companyId] ?? 0) + amount
        }
    }

    redeemsAndReissues(handler: EighteenXXStateHandler<State>): EighteenXXStateHandler<State> {
        const corporate = new CorporateStockActionsHandler(handler, [
            {
                ...stepAction<State, HydratedRedeemShare<State>>(
                    'RedeemShare',
                    isHydratedRedeemShare,
                    (state, playerId) => this.redemptionChoices(state, playerId).length > 0
                ),
                nextState: (state) =>
                    state.redemptionRequest ? ConsentingRedemptionState : undefined
            },
            stepAction<State, HydratedReissueShares<State>>(
                'ReissueShares',
                isHydratedReissueShares,
                (state, playerId) => this.reissueChoices(state, playerId).length > 0
            )
        ])
        return {
            enter: (context) => corporate.enter(context),
            validActionsForPlayer: (playerId, context) =>
                corporate.validActionsForPlayer(playerId, context),
            isValidAction: (action, context) => corporate.isValidAction(action, context),
            onAction: (action, context) => {
                if (isFinishStockTurn(action)) delete context.gameState.redemptionRefusals
                if (isCompleteStockRound(action)) {
                    delete context.gameState.redemptions
                    delete context.gameState.lockedProceeds
                }
                return corporate.onAction(action, context)
            }
        }
    }

    consentHandler(): EighteenXXStateHandler<State> {
        return new ConsentingRedemptionHandler()
    }

    actions(): ActionDefinition[] {
        return [
            defineAction(
                RedeemShare,
                isRedeemShare,
                (action) => new HydratedRedeemShare(action, this)
            ),
            defineAction(
                AnswerRedemption,
                isAnswerRedemption,
                (action) => new HydratedAnswerRedemption(action, this)
            ),
            defineAction(
                ReissueShares,
                isReissueShares,
                (action) => new HydratedReissueShares(action, this)
            )
        ]
    }
}

export const RedeemShare = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('RedeemShare'),
        companyId: Type.String(),
        certificateId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                { holder: Owner, payment: Type.Optional(CashPayment) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type RedeemShare = Type.Static<typeof RedeemShare>
const RedeemValidator = Compile(RedeemShare)
export function isRedeemShare(action: GameAction): action is RedeemShare {
    return (
        action instanceof HydratedRedeemShare ||
        (action.type === 'RedeemShare' && RedeemValidator.Check(action))
    )
}

export class HydratedRedeemShare<State extends RedemptionState = RedemptionState>
    extends HydratableAction<typeof RedeemShare>
    implements RedeemShare
{
    declare type: 'RedeemShare'
    declare playerId: string
    declare companyId: string
    declare certificateId: string
    declare metadata?: RedeemShare['metadata']
    readonly #procedure: ShareRedemptionProcedure<State>
    constructor(data: RedeemShare, procedure: ShareRedemptionProcedure<State>) {
        super(data instanceof HydratedRedeemShare ? data.dehydrate() : data, RedeemValidator)
        this.#procedure = procedure
    }
    isValid(state: State): boolean {
        return !!this.#procedure.redemptionChoice(
            state,
            this.playerId,
            this.companyId,
            this.certificateId
        )
    }
    apply(state: State): void {
        const choice = this.#procedure.redemptionChoice(
            state,
            this.playerId,
            this.companyId,
            this.certificateId
        )
        assert(this.source === ActionSource.User && choice, 'This share cannot be redeemed')
        const holder = choice.holder
        if (holder.kind === 'player' && holder.playerId !== this.playerId) {
            state.redemptionRequest = {
                companyId: this.companyId,
                certificateId: this.certificateId,
                holderPlayerId: holder.playerId,
                presidentPlayerId: this.playerId,
                price: choice.price
            }
            this.metadata = { holder }
            return
        }
        this.metadata = {
            holder,
            payment: this.#procedure.applyRedemption(state, choice, this.playerId)
        }
    }
}

export const AnswerRedemption = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('AnswerRedemption'),
        accept: Type.Boolean(),
        metadata: Type.Optional(
            Type.Object(
                { request: RedemptionRequest, payment: Type.Optional(CashPayment) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type AnswerRedemption = Type.Static<typeof AnswerRedemption>
const AnswerValidator = Compile(AnswerRedemption)
export function isAnswerRedemption(action: GameAction): action is AnswerRedemption {
    return (
        action instanceof HydratedAnswerRedemption ||
        (action.type === 'AnswerRedemption' && AnswerValidator.Check(action))
    )
}

export class HydratedAnswerRedemption<State extends RedemptionState = RedemptionState>
    extends HydratableAction<typeof AnswerRedemption>
    implements AnswerRedemption
{
    declare type: 'AnswerRedemption'
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerRedemption['metadata']
    readonly #procedure: ShareRedemptionProcedure<State>
    constructor(data: AnswerRedemption, procedure: ShareRedemptionProcedure<State>) {
        super(data instanceof HydratedAnswerRedemption ? data.dehydrate() : data, AnswerValidator)
        this.#procedure = procedure
    }
    isValid(state: State): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === ConsentingRedemptionState &&
            state.redemptionRequest?.holderPlayerId === this.playerId
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Only the asked holder answers a redemption')
        const request = state.redemptionRequest
        assertExists(request, 'An answer requires a redemption request')
        delete state.redemptionRequest
        state.activePlayerIds = [request.presidentPlayerId]
        if (!this.accept) {
            state.redemptionRefusals = [
                ...(state.redemptionRefusals ?? []),
                { companyId: request.companyId, playerId: request.holderPlayerId }
            ]
            this.metadata = { request }
            return
        }
        const certificate = state.certificates.find((item) => item.id === request.certificateId)
        assert(
            certificate &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === request.holderPlayerId &&
                this.#procedure.spendableCash(state, request.companyId) >= request.price,
            'The asked holder still holds the share and the company can still pay'
        )
        const choice: RedemptionChoice = {
            companyId: request.companyId,
            certificateId: request.certificateId,
            holder: certificate.owner,
            price: request.price
        }
        this.metadata = {
            request,
            payment: this.#procedure.applyRedemption(state, choice, request.presidentPlayerId)
        }
    }
}

class ConsentingRedemptionHandler<
    State extends RedemptionState
> implements EighteenXXStateHandler<State> {
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        return (
            action instanceof HydratedAnswerRedemption &&
            action.source === ActionSource.User &&
            state.machineState === ConsentingRedemptionState &&
            state.redemptionRequest?.holderPlayerId === action.playerId
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return context.gameState.redemptionRequest?.holderPlayerId === playerId
            ? ['AnswerRedemption']
            : []
    }
    enter(context: MachineContext<State>): void {
        const request = context.gameState.redemptionRequest
        assertExists(request, 'Consent requires a redemption request')
        context.gameState.activePlayerIds = [request.holderPlayerId]
    }
    onAction(): string {
        return 'StockRound'
    }
}

export const ReissueShares = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('ReissueShares'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    certificateIds: Type.Array(Type.String(), { minItems: 1 }),
                    parPrice: Type.Integer({ minimum: 1 }),
                    previousParPrice: Type.Integer({ minimum: 1 })
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ReissueShares = Type.Static<typeof ReissueShares>
const ReissueValidator = Compile(ReissueShares)
export function isReissueShares(action: GameAction): action is ReissueShares {
    return (
        action instanceof HydratedReissueShares ||
        (action.type === 'ReissueShares' && ReissueValidator.Check(action))
    )
}

export class HydratedReissueShares<State extends RedemptionState = RedemptionState>
    extends HydratableAction<typeof ReissueShares>
    implements ReissueShares
{
    declare type: 'ReissueShares'
    declare playerId: string
    declare companyId: string
    declare metadata?: ReissueShares['metadata']
    readonly #procedure: ShareRedemptionProcedure<State>
    constructor(data: ReissueShares, procedure: ShareRedemptionProcedure<State>) {
        super(data instanceof HydratedReissueShares ? data.dehydrate() : data, ReissueValidator)
        this.#procedure = procedure
    }
    isValid(state: State): boolean {
        return this.#procedure
            .reissueChoices(state, this.playerId)
            .some((choice) => choice.companyId === this.companyId)
    }
    apply(state: State): void {
        const choice = this.#procedure
            .reissueChoices(state, this.playerId)
            .find((entry) => entry.companyId === this.companyId)
        assert(this.source === ActionSource.User && choice, 'This company cannot reissue')
        const company = getCompany(state, this.companyId)
        assertExists(company.parPrice, 'A reissuing company has a par price')
        const previousParPrice = company.parPrice
        company.parPrice = choice.parPrice
        for (const certificate of state.certificates)
            if (choice.certificateIds.includes(certificate.id)) {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = 'initial-offering'
            }
        state.reissues = { ...state.reissues, [this.companyId]: state.stockRound.number }
        state.stockRound.turn.corporateAction = { companyId: this.companyId }
        recordStockAction(state, this.playerId, this.#procedure.rules.roundRules)
        this.metadata = {
            certificateIds: choice.certificateIds,
            parPrice: choice.parPrice,
            previousParPrice
        }
    }
}

function isHydratedRedeemShare<State extends RedemptionState>(
    action: HydratedAction
): action is HydratedRedeemShare<State> {
    return action instanceof HydratedRedeemShare
}
function isHydratedReissueShares<State extends RedemptionState>(
    action: HydratedAction
): action is HydratedReissueShares<State> {
    return action instanceof HydratedReissueShares
}
