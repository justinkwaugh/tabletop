import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedGameState
} from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { controllingOwner, finiteCashOwnedBy } from '../finance/finance.js'
import type { CashCrisisState } from '../funding/cashCrisis.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import {
    InterestDefault,
    interestOwed,
    takeLoan,
    takeLoanReason,
    type LoanRules,
    type LoanState
} from './loans.js'

const Fields = Type.Object({
    type: Type.Literal('PayInterest'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            {
                interest: Type.Integer({ minimum: 0 }),
                loansTaken: Type.Integer({ minimum: 0 }),
                payments: Type.Array(CashPayment),
                marketMoves: Type.Array(StockMarketMove),
                default: Type.Optional(InterestDefault)
            },
            { additionalProperties: false }
        )
    )
})
export const PayInterest: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type PayInterest = Type.Static<typeof PayInterest>
const Validator = Compile(PayInterest)
export function isPayInterest(action: GameAction): action is PayInterest {
    return (
        action instanceof HydratedPayInterest ||
        (action.type === 'PayInterest' && Validator.Check(action))
    )
}

export class HydratedPayInterest
    extends HydratableAction<typeof PayInterest>
    implements PayInterest
{
    declare type: 'PayInterest'
    declare companyId: string
    declare metadata?: PayInterest['metadata']
    readonly #rules: LoanRules
    constructor(data: PayInterest, rules: LoanRules) {
        super(data instanceof HydratedPayInterest ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & LoanState & CashCrisisState): void {
        assert(
            this.source === ActionSource.System && !state.loanStep,
            'Interest is paid once, by the system'
        )
        const company = { kind: 'company' as const, companyId: this.companyId }
        const marketMoves: StockMarketMove[] = []
        const payments: CashPayment[] = []
        let loansTaken = 0
        let interest = interestOwed(state, this.#rules, this.companyId)
        while (
            interest > finiteCashOwnedBy(state, company) &&
            !takeLoanReason(state, this.#rules, this.companyId)
        ) {
            const loan = takeLoan(state, this.#rules, this.companyId)
            payments.push(loan.payment)
            if (loan.marketMove) marketMoves.push(loan.marketMove)
            loansTaken++
            interest = interestOwed(state, this.#rules, this.companyId)
        }
        let interestDefault: InterestDefault | undefined
        if (interest <= finiteCashOwnedBy(state, company)) {
            if (interest > 0) {
                const payment = { from: company, to: { kind: 'bank' as const }, amount: interest }
                settleCashPayments(state, [payment])
                payments.push(payment)
            }
        } else {
            const president = controllingOwner(state, this.companyId)
            assertExists(president, 'A borrowing company has a president')
            interestDefault = this.#rules.interestDefault(state, this.companyId, interest)
            if (interestDefault.unpaid)
                state.cashCrisis = {
                    playerId: president.playerId,
                    amount: interestDefault.unpaid,
                    continuation: 'RepayingLoans'
                }
        }
        state.loanStep = { companyId: this.companyId }
        this.metadata = {
            interest,
            loansTaken,
            payments,
            marketMoves,
            ...(interestDefault ? { default: interestDefault } : {})
        }
    }
}
