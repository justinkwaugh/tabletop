import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany } from '../finance/finance.js'
import { StockMarketMove, moveCompanyMarker } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'

export const LoanStep = Type.Object(
    { companyId: Type.String(), borrowedAfterInterest: Type.Optional(Type.Literal(true)) },
    { additionalProperties: false }
)
export type LoanStep = Type.Static<typeof LoanStep>
export const LoanFields = {
    interestRate: Type.Optional(Type.Integer({ minimum: 0 })),
    loanStep: Type.Optional(LoanStep)
}
export type LoanState = StockState & Type.Static<Type.TObject<typeof LoanFields>>

export type LoanMarketMove = { direction: string; steps: number }
export const LoanRecord = Type.Object(
    { payment: CashPayment, marketMove: Type.Optional(StockMarketMove) },
    { additionalProperties: false }
)
export type LoanRecord = Type.Static<typeof LoanRecord>
export const InterestDefault = Type.Object(
    {
        payments: Type.Array(CashPayment),
        marketMoves: Type.Array(StockMarketMove),
        unpaid: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type InterestDefault = Type.Static<typeof InterestDefault>

export interface LoanRules {
    /** What a company receives for a loan and pays to repay one. */
    value: number
    /** Loans in the bank at the start of the game. */
    supply: number
    capacity(state: LoanState, companyId: string): number
    /** The percentage rate fixed for the operating round about to start. */
    rate(state: LoanState): number
    takeMove?: LoanMarketMove
    repayMove?: LoanMarketMove
    /** The title's consequence when a company cannot pay interest after borrowing all it can. */
    interestDefault(state: LoanState, companyId: string, owed: number): InterestDefault
}

export function companyLoans(state: LoanState, companyId: string): number {
    return getCompany(state, companyId).loans ?? 0
}

export function loansOutstanding(state: LoanState): number {
    return state.companies.reduce((sum, company) => sum + (company.loans ?? 0), 0)
}

export function loansRemaining(state: LoanState, rules: LoanRules): number {
    return rules.supply - loansOutstanding(state)
}

export function interestOwed(state: LoanState, rules: LoanRules, companyId: string): number {
    assertExists(state.interestRate, 'Interest is charged at a fixed rate')
    return (state.interestRate * companyLoans(state, companyId) * rules.value) / 100
}

export function takeLoanReason(
    state: LoanState,
    rules: LoanRules,
    companyId: string
): string | undefined {
    const company = getCompany(state, companyId)
    if (!company.started || company.closed || company.kind === 'private')
        return 'Only a started company may borrow.'
    if (companyLoans(state, companyId) >= rules.capacity(state, companyId))
        return 'The company holds as many loans as it may.'
    if (loansRemaining(state, rules) <= 0) return 'The bank has no loans left.'
    return undefined
}

export function repayLoanReason(
    state: LoanState,
    rules: LoanRules,
    companyId: string
): string | undefined {
    if (!companyLoans(state, companyId)) return 'The company has no loans.'
    if (finiteCashOwnedBy(state, { kind: 'company', companyId }) < rules.value)
        return 'The company cannot afford to repay a loan.'
    return undefined
}

export function takeLoan(state: LoanState, rules: LoanRules, companyId: string): LoanRecord {
    const reason = takeLoanReason(state, rules, companyId)
    assert(!reason, reason ?? 'Invalid loan')
    const payment: CashPayment = {
        from: { kind: 'bank' },
        to: { kind: 'company', companyId },
        amount: rules.value
    }
    settleCashPayments(state, [payment])
    const company = getCompany(state, companyId)
    company.loans = (company.loans ?? 0) + 1
    return withMarketMove(state, companyId, payment, rules.takeMove)
}

export function repayLoan(state: LoanState, rules: LoanRules, companyId: string): LoanRecord {
    const reason = repayLoanReason(state, rules, companyId)
    assert(!reason, reason ?? 'Invalid repayment')
    const payment: CashPayment = {
        from: { kind: 'company', companyId },
        to: { kind: 'bank' },
        amount: rules.value
    }
    settleCashPayments(state, [payment])
    const company = getCompany(state, companyId)
    if (company.loans === 1) delete company.loans
    else company.loans = companyLoans(state, companyId) - 1
    return withMarketMove(state, companyId, payment, rules.repayMove)
}

function withMarketMove(
    state: LoanState,
    companyId: string,
    payment: CashPayment,
    move: LoanMarketMove | undefined
): LoanRecord {
    const marketMove =
        move && moveCompanyMarker(state.stockMarket, companyId, move.direction, move.steps)
    return marketMove ? { payment, marketMove } : { payment }
}

export function validateLoanStep(state: { machineState: string; loanStep?: LoanStep }): void {
    assert(
        !state.loanStep || ['RepayingLoans', 'RaisingCash'].includes(state.machineState),
        'A loan step belongs to its operating step'
    )
}
