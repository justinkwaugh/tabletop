import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    CorporateStockActionsHandler,
    Owner,
    companyMarketSpace,
    corporateTurnOpen,
    finiteCashOwnedBy,
    getCompany,
    recordStockAction,
    settleCashPayments,
    sharesOwned,
    type SharePurchaseDetails,
    type StockState
} from '@tabletop/18xx'
import {
    requireEighteenThirtyTwoState,
    type EighteenThirtyTwoState,
    type EighteenThirtyTwoStateHandler,
    type HydratedEighteenThirtyTwoState
} from './state.js'
import { refreshOwnershipExcess } from './ownershipExcess.js'
import { EighteenThirtyTwoStockRoundRules } from './roundRules.js'
import { ReissueParPrices } from './stockMarket.js'
import { isSystem } from './systems.js'
import { ConsentingRedemptionState, RedemptionRequest } from './titleState.js'

const MaximumCompanyPercent = 40
const MinimumOutsidePercent = 60

const companyOwner = (companyId: string) => ({ kind: 'company' as const, companyId })

function shareCountOf(state: EighteenThirtyTwoState, companyId: string): number {
    const count = getCompany(state, companyId).shareCount
    assertExists(count, 'Redemption requires a share count')
    return count
}

/** The company's money it may spend now, less reissued shares' proceeds this stock round. */
export function spendableCash(state: EighteenThirtyTwoState, companyId: string): number {
    const locked =
        state.lockedProceeds?.stockRound === state.stockRound.number
            ? (state.lockedProceeds.amounts[companyId] ?? 0)
            : 0
    return finiteCashOwnedBy(state, companyOwner(companyId)) - locked
}

function actingForCompany(state: EighteenThirtyTwoState, playerId: string, companyId: string) {
    const company = getCompany(state, companyId)
    return (
        company.kind !== 'private' &&
        !!company.funded &&
        !company.closed &&
        !state.stockRound.turn.corporateAction &&
        corporateTurnOpen(state, playerId, companyId)
    )
}

function outsideShares(state: EighteenThirtyTwoState, companyId: string): number {
    return state.certificates.reduce(
        (total, certificate) =>
            total +
            (!certificate.retired &&
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            (certificate.owner.kind === 'player' || certificate.poolId === 'open-market')
                ? certificate.shares
                : 0),
        0
    )
}

function refusedThisTurn(state: EighteenThirtyTwoState): readonly string[] {
    const refusals = state.redemptionRefusals
    return refusals && refusals.turnStart === state.turnManager.series.at(-1)?.start
        ? refusals.playerIds
        : []
}

export type RedemptionChoice = {
    companyId: string
    certificateId: string
    holder: Owner
    price: number
}

/**
 * The shares a president may redeem for each company they act for: one an open-market share
 * while there is one, otherwise one held by a player who may consent, at its market price,
 * keeping the company at most 40% and players and market at least 60% (§5.10).
 */
export function redemptionChoices(
    state: EighteenThirtyTwoState,
    playerId: string
): RedemptionChoice[] {
    return state.companies.flatMap((company) => {
        if (!actingForCompany(state, playerId, company.id)) return []
        const redeemed = state.redemptions?.[company.id]
        // A System may redeem two shares a stock round, one a turn (§11.6.9).
        if (
            redeemed?.stockRound === state.stockRound.number &&
            redeemed.count >= (isSystem(state, company.id) ? 2 : 1)
        )
            return []
        const shareCount = shareCountOf(state, company.id)
        const held = sharesOwned(state, company.id, companyOwner(company.id))
        const outside = outsideShares(state, company.id)
        const price = companyMarketSpace(state.stockMarket, company.id).price
        const candidates = state.certificates.flatMap((certificate) =>
            !certificate.retired &&
            certificate.kind === 'share' &&
            !certificate.president &&
            certificate.companyId === company.id &&
            (certificate.owner.kind === 'player' || certificate.poolId === 'open-market') &&
            (held + certificate.shares) * 100 <= MaximumCompanyPercent * shareCount &&
            (outside - certificate.shares) * 100 >= MinimumOutsidePercent * shareCount &&
            price * certificate.shares <= spendableCash(state, company.id)
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
                refusedThisTurn(state).includes(owner.playerId) ||
                (owner.playerId === playerId &&
                    !keepsPresidency(state, company.id, playerId, certificate.shares))
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

// A redemption may not change the presidency at once (§5.10.3).
function keepsPresidency(
    state: EighteenThirtyTwoState,
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

function redemptionChoice(
    state: EighteenThirtyTwoState,
    playerId: string,
    companyId: string,
    certificateId: string
): RedemptionChoice | undefined {
    return redemptionChoices(state, playerId).find(
        (choice) => choice.companyId === companyId && choice.certificateId === certificateId
    )
}

function applyRedemption(
    state: HydratedEighteenThirtyTwoState,
    choice: RedemptionChoice,
    presidentId: string
): CashPayment {
    const payment: CashPayment = {
        from: companyOwner(choice.companyId),
        to: choice.holder,
        amount: choice.price
    }
    settleCashPayments(state, [payment])
    const certificate = state.certificates.find((item) => item.id === choice.certificateId)
    assert(certificate && !certificate.retired, 'A redeemed share is in play')
    certificate.owner = companyOwner(choice.companyId)
    delete certificate.poolId
    refreshOwnershipExcess(state, choice.companyId, choice.holder)
    const redeemed = state.redemptions?.[choice.companyId]
    state.redemptions = {
        ...state.redemptions,
        [choice.companyId]: {
            stockRound: state.stockRound.number,
            count: redeemed?.stockRound === state.stockRound.number ? redeemed.count + 1 : 1
        }
    }
    state.stockRound.turn.corporateAction = { companyId: choice.companyId }
    recordStockAction(state, presidentId, EighteenThirtyTwoStockRoundRules)
    return payment
}

export const RedeemShare = Type.Object(
    {
        ...PlayerAction.properties,
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

/**
 * As their turn's only action, a president redeems a share for their company: at once from the
 * market or their own holding, or by asking another player, who may refuse (§5.10.4, §5.10.6).
 */
export class HydratedRedeemShare
    extends HydratableAction<typeof RedeemShare>
    implements RedeemShare
{
    declare type: 'RedeemShare'
    declare playerId: string
    declare companyId: string
    declare certificateId: string
    declare metadata?: RedeemShare['metadata']
    constructor(data: RedeemShare) {
        super(data instanceof HydratedRedeemShare ? data.dehydrate() : data, RedeemValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return !!redemptionChoice(state, this.playerId, this.companyId, this.certificateId)
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const choice = redemptionChoice(state, this.playerId, this.companyId, this.certificateId)
        assert(this.source === ActionSource.User && choice, 'This share cannot be redeemed')
        const holder = choice.holder
        if (holder.kind === 'player' && holder.playerId !== this.playerId) {
            state.redemptionRequest = {
                companyId: this.companyId,
                certificateId: this.certificateId,
                holderPlayerId: holder.playerId,
                presidentPlayerId: this.playerId
            }
            this.metadata = { holder }
            return
        }
        this.metadata = { holder, payment: applyRedemption(state, choice, this.playerId) }
    }
}

export const AnswerRedemption = Type.Object(
    {
        ...PlayerAction.properties,
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

/** The holder agrees to the redemption, which completes the president's action, or refuses. */
export class HydratedAnswerRedemption
    extends HydratableAction<typeof AnswerRedemption>
    implements AnswerRedemption
{
    declare type: 'AnswerRedemption'
    declare playerId: string
    declare accept: boolean
    declare metadata?: AnswerRedemption['metadata']
    constructor(data: AnswerRedemption) {
        super(data instanceof HydratedAnswerRedemption ? data.dehydrate() : data, AnswerValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === ConsentingRedemptionState &&
            state.redemptionRequest?.holderPlayerId === this.playerId
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'Only the asked holder answers a redemption')
        const request = state.redemptionRequest
        assertExists(request, 'An answer requires a redemption request')
        delete state.redemptionRequest
        state.activePlayerIds = [request.presidentPlayerId]
        if (!this.accept) {
            const turnStart = state.turnManager.series.at(-1)?.start
            assertExists(turnStart, 'A redemption is asked on a stock turn')
            state.redemptionRefusals = {
                turnStart,
                playerIds: [...refusedThisTurn(state), request.holderPlayerId]
            }
            this.metadata = { request }
            return
        }
        const certificate = state.certificates.find((item) => item.id === request.certificateId)
        assert(
            certificate &&
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === request.holderPlayerId,
            'The asked holder still holds the share'
        )
        // Nothing but the answer has happened since the president chose this share.
        const choice: RedemptionChoice = {
            companyId: request.companyId,
            certificateId: request.certificateId,
            holder: certificate.owner,
            price:
                companyMarketSpace(state.stockMarket, request.companyId).price * certificate.shares
        }
        this.metadata = {
            request,
            payment: applyRedemption(state, choice, request.presidentPlayerId)
        }
    }
}

/** The holder asked to allow a redemption decides (§5.10.4). */
export class ConsentingRedemptionHandler implements EighteenThirtyTwoStateHandler {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): boolean {
        return action instanceof HydratedAnswerRedemption && action.isValid(context.gameState)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string[] {
        return context.gameState.redemptionRequest?.holderPlayerId === playerId
            ? ['AnswerRedemption']
            : []
    }
    enter(context: MachineContext<HydratedEighteenThirtyTwoState>): void {
        const request = context.gameState.redemptionRequest
        assertExists(request, 'Consent requires a redemption request')
        context.gameState.activePlayerIds = [request.holderPlayerId]
    }
    onAction(): string {
        return 'StockRound'
    }
}

export type ReissueChoice = { companyId: string; certificateIds: string[]; parPrice: number }

/**
 * The par price reissued shares sell at: the higher of the company's par and the reissue par
 * nearest 75% of its market price, a tie rounding up (§5.11).
 */
export function reissueParPrice(state: EighteenThirtyTwoState, companyId: string): number {
    const target = (companyMarketSpace(state.stockMarket, companyId).price * 3) / 4
    const nearest = ReissueParPrices.reduce((best, price) =>
        Math.abs(price - target) <= Math.abs(best - target) ? price : best
    )
    const parPrice = getCompany(state, companyId).parPrice
    assertExists(parPrice, 'A reissuing company has a par price')
    return Math.max(parPrice, nearest)
}

/**
 * As their turn's only action, a president may return all their company's redeemed shares to
 * the initial offering, once its original offering has sold out and once per stock round.
 */
export function reissueChoices(state: EighteenThirtyTwoState, playerId: string): ReissueChoice[] {
    return state.companies.flatMap((company) => {
        if (!actingForCompany(state, playerId, company.id)) return []
        const reissued = state.reissues?.[company.id]
        if (reissued === state.stockRound.number) return []
        const certificateIds = state.certificates.flatMap((certificate) =>
            !certificate.retired &&
            certificate.companyId === company.id &&
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id
                ? [certificate.id]
                : []
        )
        const originalOffering = state.certificates.some(
            (certificate) =>
                !certificate.retired &&
                certificate.companyId === company.id &&
                certificate.poolId === 'initial-offering'
        )
        if (!certificateIds.length || (originalOffering && reissued === undefined)) return []
        return [
            {
                companyId: company.id,
                certificateIds,
                parPrice: reissueParPrice(state, company.id)
            }
        ]
    })
}

export const ReissueShares = Type.Object(
    {
        ...PlayerAction.properties,
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

/** The redeemed shares return to the initial offering at the reissue par (§5.11). */
export class HydratedReissueShares
    extends HydratableAction<typeof ReissueShares>
    implements ReissueShares
{
    declare type: 'ReissueShares'
    declare playerId: string
    declare companyId: string
    declare metadata?: ReissueShares['metadata']
    constructor(data: ReissueShares) {
        super(data instanceof HydratedReissueShares ? data.dehydrate() : data, ReissueValidator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return reissueChoices(state, this.playerId).some(
            (choice) => choice.companyId === this.companyId
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        const choice = reissueChoices(state, this.playerId).find(
            (entry) => entry.companyId === this.companyId
        )
        assert(this.source === ActionSource.User && choice, 'This company cannot reissue')
        const company = getCompany(state, this.companyId)
        assertExists(company.parPrice, 'A reissuing company has a par price')
        const previousParPrice = company.parPrice
        company.parPrice = choice.parPrice
        for (const certificate of state.certificates)
            if (!certificate.retired && choice.certificateIds.includes(certificate.id)) {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = 'initial-offering'
            }
        state.reissues = { ...state.reissues, [this.companyId]: state.stockRound.number }
        state.stockRound.turn.corporateAction = { companyId: this.companyId }
        recordStockAction(state, this.playerId, EighteenThirtyTwoStockRoundRules)
        this.metadata = {
            certificateIds: choice.certificateIds,
            parPrice: choice.parPrice,
            previousParPrice
        }
    }
}

/** Whether an initial-offering share is a reissued one, whose price its company receives. */
export function isReissuedShare(state: StockState, companyId: string, poolId?: string): boolean {
    return (
        poolId === 'initial-offering' &&
        requireEighteenThirtyTwoState(state).reissues?.[companyId] !== undefined
    )
}

/** Records reissued shares' proceeds, which the company may not spend this stock round. */
export function lockReissueProceeds(state: StockState, details: SharePurchaseDetails): void {
    const title = requireEighteenThirtyTwoState(state)
    const amount = details.payments
        .filter(
            (payment) => payment.to.kind === 'company' && payment.to.companyId === details.companyId
        )
        .reduce((total, payment) => total + payment.amount, 0)
    if (!amount) return
    const current =
        title.lockedProceeds?.stockRound === title.stockRound.number
            ? title.lockedProceeds.amounts
            : {}
    title.lockedProceeds = {
        stockRound: title.stockRound.number,
        amounts: { ...current, [details.companyId]: (current[details.companyId] ?? 0) + amount }
    }
}

/** A president's redemptions and reissues for their company, in place of their own action. */
export function companyShareActions(
    handler: EighteenThirtyTwoStateHandler
): EighteenThirtyTwoStateHandler {
    return new CorporateStockActionsHandler(handler, [
        {
            type: 'RedeemShare',
            available: (state, playerId) => redemptionChoices(state, playerId).length > 0,
            isValid: (action, state) =>
                action instanceof HydratedRedeemShare && action.isValid(state),
            nextState: (state) => (state.redemptionRequest ? ConsentingRedemptionState : undefined)
        },
        {
            type: 'ReissueShares',
            available: (state, playerId) => reissueChoices(state, playerId).length > 0,
            isValid: (action, state) =>
                action instanceof HydratedReissueShares && action.isValid(state)
        }
    ])
}
