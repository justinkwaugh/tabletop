import { assert } from '@tabletop/common'
import { finiteCashOwnedBy, type FinancialState } from '../finance/finance.js'
import {
    loanInterest,
    takeLoan,
    takeLoanReason,
    companyLoans,
    loansRemaining,
    type LoanRecord,
    type LoanRules,
    type LoanState
} from './loans.js'

/**
 * Loans the system takes for a company that cannot otherwise make a payment, the fewest the
 * payment needs, as 1861's companies borrow only for track, interest and a trainless company's
 * train (§10.2). The title says which payments may borrow by giving this to the rules that
 * make them.
 */
export interface AutomaticBorrowing {
    /** What borrowing every loan the company may still take would add to its cash. */
    capacity(state: FinancialState, companyId: string): number
    /** Takes the fewest loans that let the company pay the amount, if they are not enough, all. */
    borrowFor(state: FinancialState, companyId: string, amount: number): LoanRecord[]
}

/** Construction and train purchases see only part of the state that loans are recorded in. */
function requireLoanState(state: FinancialState): LoanState {
    assert(isLoanState(state), 'Borrowing requires the loan state')
    return state
}

function isLoanState(state: FinancialState): state is LoanState {
    return 'stockMarket' in state && 'stockRound' in state
}

/** What one loan adds to the company's cash, less any interest paid as it is taken. */
export function loanProceeds(state: LoanState, rules: LoanRules): number {
    return rules.value - (rules.interestWhenTaken ? loanInterest(state, rules) : 0)
}

export function automaticBorrowing(rules: LoanRules): AutomaticBorrowing {
    const proceeds = (state: LoanState) => loanProceeds(state, rules)
    return {
        capacity(financial, companyId) {
            const state = requireLoanState(financial)
            if (takeLoanReason(state, rules, companyId)) return 0
            const loans = Math.min(
                rules.capacity(state, companyId) - companyLoans(state, companyId),
                loansRemaining(state, rules)
            )
            return Math.max(0, loans) * proceeds(state)
        },
        borrowFor(financial, companyId, amount) {
            const state = requireLoanState(financial)
            assert(proceeds(state) > 0, 'A loan must add to the company’s cash')
            const records: LoanRecord[] = []
            const company = { kind: 'company' as const, companyId }
            while (
                finiteCashOwnedBy(state, company) < amount &&
                !takeLoanReason(state, rules, companyId)
            )
                records.push(takeLoan(state, rules, companyId))
            return records
        }
    }
}
