import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from '../stock/stockRules.js'
import type { LoanRules } from './loans.js'
import { HydratedPayInterest, PayInterest, isPayInterest } from './payInterest.js'
import { HydratedRepayLoan, RepayLoan, isRepayLoan } from './repayLoan.js'
import { HydratedTakeLoan, TakeLoan, isTakeLoan } from './takeLoan.js'

export function loanActions(loans: LoanRules | undefined, stocks: StockRules): ActionDefinition[] {
    if (!loans) return []
    return [
        defineAction(TakeLoan, isTakeLoan, (action) => new HydratedTakeLoan(action, loans, stocks)),
        defineAction(RepayLoan, isRepayLoan, (action) => new HydratedRepayLoan(action, loans)),
        defineAction(PayInterest, isPayInterest, (action) => new HydratedPayInterest(action, loans))
    ]
}
