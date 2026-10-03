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
import { LoanRecord, repayLoan, repayLoanReason, type LoanRules, type LoanState } from './loans.js'

export const RepayLoan = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('RepayLoan'),
        companyId: Type.String(),
        metadata: Type.Optional(LoanRecord)
    },
    { additionalProperties: false }
)
export type RepayLoan = Type.Static<typeof RepayLoan>
const Validator = Compile(RepayLoan)
export function isRepayLoan(action: GameAction): action is RepayLoan {
    return (
        action instanceof HydratedRepayLoan ||
        (action.type === 'RepayLoan' && Validator.Check(action))
    )
}

/** Whether the operating company's president may repay one of its loans after its interest. */
export function canRepayLoan(
    state: LoanState,
    rules: LoanRules,
    playerId: string,
    companyId: string
): boolean {
    return (
        state.loanStep?.companyId === companyId &&
        !state.loanStep.borrowedAfterInterest &&
        controllingOwner(state, companyId)?.playerId === playerId &&
        !repayLoanReason(state, rules, companyId)
    )
}

export class HydratedRepayLoan extends HydratableAction<typeof RepayLoan> implements RepayLoan {
    declare type: 'RepayLoan'
    declare playerId: string
    declare companyId: string
    declare metadata?: LoanRecord
    readonly #rules: LoanRules
    constructor(data: RepayLoan, rules: LoanRules) {
        super(data instanceof HydratedRepayLoan ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & LoanState): void {
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                canRepayLoan(state, this.#rules, this.playerId, this.companyId),
            'Only the operating company’s president may repay its loans after interest'
        )
        this.metadata = repayLoan(state, this.#rules, this.companyId)
    }
}
