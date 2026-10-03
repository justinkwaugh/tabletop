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
import { controllingOwner } from '../finance/finance.js'
import { recordStockAction } from '../stock/stockRoundRules.js'
import type { StockRules } from '../stock/stockRules.js'
import { LoanRecord, takeLoan, takeLoanReason, type LoanRules, type LoanState } from './loans.js'

export const TakeLoan = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('TakeLoan'),
        companyId: Type.String(),
        metadata: Type.Optional(LoanRecord)
    },
    { additionalProperties: false }
)
export type TakeLoan = Type.Static<typeof TakeLoan>
const Validator = Compile(TakeLoan)
export function isTakeLoan(action: GameAction): action is TakeLoan {
    return (
        action instanceof HydratedTakeLoan ||
        (action.type === 'TakeLoan' && Validator.Check(action))
    )
}

/** Whether the player may take a loan for the company, wherever the state allows borrowing. */
export function canTakeLoan(
    state: LoanState,
    rules: LoanRules,
    playerId: string,
    companyId: string
): boolean {
    return (
        controllingOwner(state, companyId)?.playerId === playerId &&
        !takeLoanReason(state, rules, companyId)
    )
}

export class HydratedTakeLoan extends HydratableAction<typeof TakeLoan> implements TakeLoan {
    declare type: 'TakeLoan'
    declare playerId: string
    declare companyId: string
    declare metadata?: LoanRecord
    readonly #rules: LoanRules
    readonly #stocks: StockRules
    constructor(data: TakeLoan, rules: LoanRules, stocks: StockRules) {
        super(data instanceof HydratedTakeLoan ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#stocks = stocks
    }
    apply(state: HydratedGameState & LoanState): void {
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                canTakeLoan(state, this.#rules, this.playerId, this.companyId),
            'Only a company’s president may borrow for it'
        )
        this.metadata = takeLoan(state, this.#rules, this.companyId)
        if (state.loanStep) state.loanStep.borrowedAfterInterest = true
        if (state.machineState === 'StockRound') {
            state.stockRound.turn.corporateAction ??= { companyId: this.companyId }
            recordStockAction(state, this.playerId, this.#stocks.round)
        }
    }
}
