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
import { settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy } from '../finance/finance.js'
import { ShareSale, ShareSaleDetails, applyShareSale } from '../stock/shareSale.js'
import { evaluateCrisisSale, type CashCrisisRules, type CashCrisisState } from './cashCrisis.js'

export const SellSharesToPay = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('SellSharesToPay'),
        sale: ShareSale,
        expectedProceeds: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(
            Type.Object(
                {
                    details: ShareSaleDetails,
                    paid: Type.Integer({ minimum: 1 }),
                    continuation: Type.Optional(Type.String())
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type SellSharesToPay = Type.Static<typeof SellSharesToPay>
const Validator = Compile(SellSharesToPay)
export function isSellSharesToPay(action: GameAction): action is SellSharesToPay {
    return (
        action instanceof HydratedSellSharesToPay ||
        (action.type === 'SellSharesToPay' && Validator.Check(action))
    )
}

export class HydratedSellSharesToPay
    extends HydratableAction<typeof SellSharesToPay>
    implements SellSharesToPay
{
    declare type: 'SellSharesToPay'
    declare playerId: string
    declare sale: ShareSale
    declare expectedProceeds: number
    declare metadata?: SellSharesToPay['metadata']
    readonly #rules: CashCrisisRules
    constructor(data: SellSharesToPay, rules: CashCrisisRules) {
        super(data instanceof HydratedSellSharesToPay ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValidFor(state: CashCrisisState): boolean {
        return (
            evaluateCrisisSale(state, this.#rules, this.playerId, this.sale).details?.proceeds ===
            this.expectedProceeds
        )
    }
    apply(state: HydratedGameState & CashCrisisState): void {
        const crisis = state.cashCrisis
        assertExists(crisis, 'Shares are sold to settle a debt')
        const { details, reason } = evaluateCrisisSale(state, this.#rules, this.playerId, this.sale)
        assert(
            this.source === ActionSource.User && details?.proceeds === this.expectedProceeds,
            reason ?? 'The sale’s proceeds have changed'
        )
        applyShareSale(state, details)
        const player = { kind: 'player' as const, playerId: this.playerId }
        const paid = Math.min(crisis.amount, finiteCashOwnedBy(state, player))
        settleCashPayments(state, [{ from: player, to: { kind: 'bank' }, amount: paid }])
        crisis.amount -= paid
        if (crisis.amount) {
            this.metadata = { details, paid }
            return
        }
        delete state.cashCrisis
        this.metadata = { details, paid, continuation: crisis.continuation }
    }
}
