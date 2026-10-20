import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy } from '../finance/finance.js'
import {
    inReceivership,
    type PresidencyClaimTerms,
    type ReceivershipRules
} from '../finance/receivership.js'
import { PresidencyClaim, applyPresidencyClaim } from './presidency.js'
import { markTurnPurchase } from './sharePurchase.js'
import { mustSellShares } from './shareSale.js'
import { soldThisStockRound } from './stockRound.js'
import { recordStockAction } from './stockRoundRules.js'
import { stockCertificateCount, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

export type PresidencyClaimOffer = PresidencyClaimTerms & { companyId: string }

/** The presidencies the player may take out of the market as this stock turn's purchase. */
export function presidencyClaims(
    state: StockState,
    rules: { stockRules: StockRules; receivershipRules: ReceivershipRules },
    playerId: string
): PresidencyClaimOffer[] {
    const { presidencyClaim } = rules.receivershipRules
    const buyer = { kind: 'player' as const, playerId }
    if (
        !presidencyClaim ||
        !state.activePlayerIds.includes(playerId) ||
        state.stockRound.turn.bought ||
        mustSellShares(state, playerId, rules.stockRules) ||
        stockCertificateCount(state, buyer, rules.stockRules) >
            rules.stockRules.certificateLimit(state, buyer)
    )
        return []
    return state.companies.flatMap((company) => {
        if (
            !inReceivership(state, company.id) ||
            soldThisStockRound(state.stockRound, buyer, company.id)
        )
            return []
        const terms = presidencyClaim(state, company.id, buyer)
        return terms && finiteCashOwnedBy(state, buyer) >= terms.price
            ? [{ ...terms, companyId: company.id }]
            : []
    })
}

const ClaimDetails = Type.Object(
    { claim: PresidencyClaim, payment: CashPayment },
    { additionalProperties: false }
)
export const ClaimPresidency = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ClaimPresidency'),
        companyId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(ClaimDetails)
    },
    { additionalProperties: false }
)
export type ClaimPresidency = Type.Static<typeof ClaimPresidency>
const Validator = Compile(ClaimPresidency)
export function isClaimPresidency(action: GameAction): action is ClaimPresidency {
    return (
        action instanceof HydratedClaimPresidency ||
        (action.type === 'ClaimPresidency' && Validator.Check(action))
    )
}
export class HydratedClaimPresidency
    extends HydratableAction<typeof ClaimPresidency>
    implements ClaimPresidency
{
    declare type: 'ClaimPresidency'
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    declare metadata?: Type.Static<typeof ClaimDetails>
    readonly #rules: { stockRules: StockRules; receivershipRules: ReceivershipRules }
    constructor(
        data: ClaimPresidency,
        rules: { stockRules: StockRules; receivershipRules: ReceivershipRules }
    ) {
        super(data instanceof HydratedClaimPresidency ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    offer(state: StockState): PresidencyClaimOffer | undefined {
        return presidencyClaims(state, this.#rules, this.playerId).find(
            (offer) => offer.companyId === this.companyId && offer.price === this.expectedPrice
        )
    }
    isValid(state: StockState & { machineState: string }): boolean {
        return (
            this.source === ActionSource.User &&
            state.machineState === 'StockRound' &&
            this.offer(state) !== undefined
        )
    }
    apply(state: HydratedGameState & StockState): void {
        assert(this.isValid(state), 'Invalid presidency claim')
        const offer = this.offer(state)
        assertExists(offer, 'A presidency claim requires its terms')
        const payment = {
            from: { kind: 'player' as const, playerId: this.playerId },
            to: { kind: 'bank' as const },
            amount: offer.price
        }
        settleCashPayments(state, [payment])
        applyPresidencyClaim(state, offer.claim)
        markTurnPurchase(state)
        recordStockAction(state, this.playerId, this.#rules.stockRules.round)
        this.metadata = { claim: offer.claim, payment }
    }
}

/** Lets a stock turn take a presidency out of the market on the title's terms. */
export class PresidencyClaimsHandler<
    State extends HydratedGameState & StockState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: { stockRules: StockRules; receivershipRules: ReceivershipRules }
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return action instanceof HydratedClaimPresidency
            ? action.isValid(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return !context.gameState.stockRound.completed &&
            presidencyClaims(context.gameState, this.rules, playerId).length
            ? [...actions, 'ClaimPresidency']
            : actions
    }
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedClaimPresidency
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
