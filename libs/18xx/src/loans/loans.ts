import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany } from '../finance/finance.js'
import { StockMarketMove, type StockMarketChart } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'

export const LoanStep = Type.Object(
    {
        companyId: Type.String(),
        borrowedAfterInterest: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type LoanStep = Type.Static<typeof LoanStep>
/** Loans the operating company took this turn, their interest paid as they were taken. */
export const TurnLoans = Type.Object(
    { companyId: Type.String(), loans: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type TurnLoans = Type.Static<typeof TurnLoans>
export const LoanFields = {
    interestRate: Type.Optional(Type.Integer({ minimum: 0 })),
    loanStep: Type.Optional(LoanStep),
    turnLoans: Type.Optional(TurnLoans)
}
export type LoanState = StockState & Type.Static<Type.TObject<typeof LoanFields>>

export type LoanMarketMove = { direction: string; steps: number }
export const LoanRecord = Type.Object(
    {
        payment: CashPayment,
        /** The interest paid as the loan was taken, where the title charges it then. */
        interest: Type.Optional(CashPayment),
        marketMove: Type.Optional(StockMarketMove)
    },
    { additionalProperties: false }
)
export type LoanRecord = Type.Static<typeof LoanRecord>
export const InterestDefault = Type.Object(
    {
        payments: Type.Array(CashPayment),
        marketMoves: Type.Array(StockMarketMove),
        unpaid: Type.Integer({ minimum: 0 }),
        /**
         * The interest stays the company's debt, paid in full: what is unpaid its president
         * raises for it, as 1849's emergency money raising does (§14.2), rather than owing it as
         * their own.
         */
        companyDebt: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type InterestDefault = Type.Static<typeof InterestDefault>

export interface LoanRules {
    market: StockMarketChart
    /** Whether the title's loans are in this game, as 1849's only with its Bonds variant; always unless given. */
    inPlay?(state: LoanState): boolean
    /** The chart loans move prices on, where it changes with play; ``market`` unless given. */
    marketFor?(state: LoanState): StockMarketChart
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
    /** Interest a company owes each operating round beyond its loans'. */
    extraInterest?(state: LoanState, companyId: string): number
    /**
     * Companies borrow only in the turn's loan step, not at any point of the turn, as 1849's
     * bonds are issued at the end of the operating turn (§14.2).
     */
    borrowsInLoanStepOnly?: true
    /**
     * Companies never borrow by choice: the system takes the fewest loans a payment needs (see
     * `automaticBorrowing`), and the title settles interest and repayment in a step of its own,
     * as 1861's (§10.2, §10.8–§10.9). The family's loan step and its loan Actions are left out.
     */
    automatic?: true
    /**
     * A loan's interest for the round is paid as it is taken, so a company owes interest in its
     * turn only on the loans it began the turn with (1861 §10.2).
     */
    interestWhenTaken?: true
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
    return (
        companyLoans(state, companyId) * loanInterest(state, rules) +
        (rules.extraInterest?.(state, companyId) ?? 0)
    )
}

export function takeLoanReason(
    state: LoanState,
    rules: LoanRules,
    companyId: string
): string | undefined {
    if (rules.inPlay?.(state) === false) return 'Loans are not in this game.'
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
    const record = withMarketMove(
        state,
        rules.marketFor?.(state) ?? rules.market,
        companyId,
        payment,
        rules.takeMove
    )
    if (!rules.interestWhenTaken) return record
    const interest: CashPayment = {
        from: { kind: 'company', companyId },
        to: { kind: 'bank' },
        amount: loanInterest(state, rules)
    }
    if (interest.amount) settleCashPayments(state, [interest])
    state.turnLoans =
        state.turnLoans?.companyId === companyId
            ? { companyId, loans: state.turnLoans.loans + 1 }
            : { companyId, loans: 1 }
    return interest.amount ? { ...record, interest } : record
}

/** The interest one loan pays in a round. */
export function loanInterest(state: LoanState, rules: LoanRules): number {
    return ((state.interestRate ?? rules.rate(state)) * rules.value) / 100
}

/**
 * The interest the company owes in its turn: on the loans it began the turn with, where the
 * title charges a loan's first interest as it is taken.
 */
export function turnInterestOwed(state: LoanState, rules: LoanRules, companyId: string): number {
    const taken =
        rules.interestWhenTaken && state.turnLoans?.companyId === companyId
            ? state.turnLoans.loans
            : 0
    return (
        (companyLoans(state, companyId) - taken) * loanInterest(state, rules) +
        (rules.extraInterest?.(state, companyId) ?? 0)
    )
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
    return withMarketMove(
        state,
        rules.marketFor?.(state) ?? rules.market,
        companyId,
        payment,
        rules.repayMove
    )
}

function withMarketMove(
    state: LoanState,
    market: StockMarketChart,
    companyId: string,
    payment: CashPayment,
    move: LoanMarketMove | undefined
): LoanRecord {
    const marketMove =
        move && market.moveCompanyMarker(state.stockMarket, companyId, move.direction, move.steps)
    return marketMove ? { payment, marketMove } : { payment }
}

export function validateLoanStep(state: { machineState: string; loanStep?: LoanStep }): void {
    assert(
        // A loan that takes the company's price to zero closes it before its turn ends.
        !state.loanStep ||
            ['RepayingLoans', 'RaisingCash', 'ClosingOperatingCorporation'].includes(
                state.machineState
            ),
        'A loan step belongs to its operating step'
    )
}
