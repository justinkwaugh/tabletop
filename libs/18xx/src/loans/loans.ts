import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, getCompany } from '../finance/finance.js'
import { StockMarketMove, type StockMarketChart } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'
import { nextOperatingCompany, type OperatingSet } from '../operating/operatingSet.js'

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
/**
 * The interest the operating company settled after its run, where the title charges it before
 * earnings, and the part of the run's revenue it took (1856).
 */
export const TurnInterest = Type.Object(
    { companyId: Type.String(), fromRevenue: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type TurnInterest = Type.Static<typeof TurnInterest>
export const LoanFields = {
    interestRate: Type.Optional(Type.Integer({ minimum: 0 })),
    loanStep: Type.Optional(LoanStep),
    turnLoans: Type.Optional(TurnLoans),
    turnInterest: Type.Optional(TurnInterest)
}
/** The company's run, where a title's interest falls due after it, and the round's turns. */
type RunState = {
    routeStep?: { result?: { companyId: string } }
    operatingSet?: OperatingSet
}
export type LoanState = StockState & RunState & Type.Static<Type.TObject<typeof LoanFields>>

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
        /** What the run's revenue gives up for the interest, before earnings are distributed (1856). */
        fromRevenue: Type.Optional(Type.Integer({ minimum: 1 })),
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

/**
 * A printed interest table: its rows lend ``loansPerRow`` loans each, or each row its own number,
 * in order, at the rows' ``rates``, and the rate is the row the loans outstanding have reached
 * (1817; 18USA's mat for five or more players lends four at 5% and six on every other row).
 */
export type LoanRateTable = { loansPerRow: number | readonly number[]; rates: readonly number[] }

/** A title's printed table that depends on the game, as the side of 18USA's mat by player count. */
export type LoanRateTables = { tableFor(state: LoanState): LoanRateTable }

/** The loans the table's row lends. */
export function loanRateTableRowLoans(table: LoanRateTable, row: number): number {
    return typeof table.loansPerRow === 'number' ? table.loansPerRow : table.loansPerRow[row]
}

/** The loans the rows before this one lend. */
export function loanRateTableRowStart(table: LoanRateTable, row: number): number {
    let start = 0
    for (let earlier = 0; earlier < row; earlier++) start += loanRateTableRowLoans(table, earlier)
    return start
}

/** The table's row the loans outstanding have reached; its first row before any are taken. */
export function loanRateTableRow(table: LoanRateTable, outstanding: number): number {
    let row = 0
    while (
        row < table.rates.length - 1 &&
        outstanding > loanRateTableRowStart(table, row) + loanRateTableRowLoans(table, row)
    )
        row++
    return row
}

export function loanRateTableRate(table: LoanRateTable, outstanding: number): number {
    return table.rates[loanRateTableRow(table, outstanding)]
}

/** The printed table the rate follows, where it follows one. */
export function loanRateTable(state: LoanState, rules: LoanRules): LoanRateTable | undefined {
    if (typeof rules.rate === 'function') return undefined
    return 'tableFor' in rules.rate ? rules.rate.tableFor(state) : rules.rate
}

/** The percentage rate the operating round about to start would fix. */
export function loanRate(state: LoanState, rules: LoanRules): number {
    if (typeof rules.rate === 'function') return rules.rate(state)
    const table = 'tableFor' in rules.rate ? rules.rate.tableFor(state) : rules.rate
    return loanRateTableRate(table, loansOutstanding(state))
}

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
    /**
     * The percentage rate fixed for the operating round about to start, or the printed table it
     * follows, where it rises with the loans outstanding (1817).
     */
    rate: ((state: LoanState) => number) | LoanRateTable | LoanRateTables
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
    /**
     * Interest falls due after the company's run, before its earnings are distributed, rather
     * than as the loan step begins. Nothing is borrowed for it: the treasury pays what it can and
     * ``interestDefault`` settles the rest, which may take part of the run's revenue. A loan
     * taken after the run pays its interest at once, and the loan step lends nothing, loans
     * being taken before any are redeemed (1856, Pay Interest, Receiving a Government Loan).
     */
    interestBeforeEarnings?: true
    /** The most loans a company takes in one operating turn, as 1856's one. */
    loansPerTurn?: number
    /**
     * A company repays no loan in an operating turn in which it took one, and takes none once
     * its interest is paid (18USA §12.8–§12.9).
     */
    noRepaymentAfterBorrowing?: true
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
    if (
        rules.loansPerTurn !== undefined &&
        state.turnLoans?.companyId === companyId &&
        state.turnLoans.loans >= rules.loansPerTurn
    )
        return 'The company has taken as many loans as it may this turn.'
    return undefined
}

/** Whether a loan taken now pays its round's interest as it is taken. */
function interestOnTaking(state: LoanState, rules: LoanRules, companyId: string): boolean {
    return (
        !!rules.interestWhenTaken ||
        (!!rules.interestBeforeEarnings && state.routeStep?.result?.companyId === companyId)
    )
}

/** Whether the company has borrowed in its operating turn under way. */
export function borrowedThisTurn(state: LoanState, companyId: string): boolean {
    return state.turnLoans?.companyId === companyId
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
    const charged = interestOnTaking(state, rules, companyId)
    if (
        charged ||
        rules.loansPerTurn !== undefined ||
        (rules.noRepaymentAfterBorrowing && nextOperatingCompany(state) === companyId)
    )
        state.turnLoans =
            state.turnLoans?.companyId === companyId
                ? { companyId, loans: state.turnLoans.loans + 1 }
                : { companyId, loans: 1 }
    if (!charged) return record
    const interest: CashPayment = {
        from: { kind: 'company', companyId },
        to: { kind: 'bank' },
        amount: loanInterest(state, rules)
    }
    if (interest.amount) settleCashPayments(state, [interest])
    return interest.amount ? { ...record, interest } : record
}

/** The interest one loan pays in a round. */
export function loanInterest(state: LoanState, rules: LoanRules): number {
    return ((state.interestRate ?? loanRate(state, rules)) * rules.value) / 100
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
