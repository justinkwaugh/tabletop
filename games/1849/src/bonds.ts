import {
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    settleCashPayments,
    type CashPayment,
    type LoanRules,
    type LoanState
} from '@tabletop/18xx'
import { CorporationIds1849 } from './companies.js'
import { requireState1849 } from './state.js'
import { Market1849 } from './stockMarket.js'
import { marketInForce1849 } from './stock.js'
import { Phases1849 } from './trains.js'

/** What a corporation receives for its bond and pays to repay it (§14.2). */
export const BondValue1849 = 500
/** The interest on an issued bond each operating turn: 10% of its value (§14.2). */
export const BondInterestRate1849 = 10
/** What each share of a corporation with an outstanding bond counts less at the end (§14.2). */
export const BondShareDeduction1849 = 100
/** Bonds may be issued from phase 8 (§14.2). */
export const BondPhaseId1849 = '8H'

export function bondsInPlay(state: object): boolean {
    return requireState1849(state).variants.bonds === true
}

export function bondIssued(state: LoanState, companyId: string): boolean {
    return (getCompany(state, companyId).loans ?? 0) > 0
}

/**
 * The amount owed beyond what the treasury holds is paid from the president's own cash; any
 * of it the president cannot pay is written off (ruling 16).
 */
function treasuryThenPresident(state: LoanState, companyId: string, owed: number): CashPayment[] {
    const company = { kind: 'company' as const, companyId }
    const fromTreasury = Math.min(owed, finiteCashOwnedBy(state, company))
    const president = controllingOwner(state, companyId)
    const fromPresident = president
        ? Math.min(owed - fromTreasury, finiteCashOwnedBy(state, president))
        : 0
    const payments: CashPayment[] = [
        ...(fromTreasury
            ? [{ from: company, to: { kind: 'bank' as const }, amount: fromTreasury }]
            : []),
        ...(president && fromPresident
            ? [{ from: president, to: { kind: 'bank' as const }, amount: fromPresident }]
            : [])
    ]
    settleCashPayments(state, payments)
    return payments
}

/**
 * The Bonds variant (§14.2): each corporation may issue one L. 500 bond from phase 8 at the end
 * of its operating turn, its price moving a column left, and repay it there for L. 500, moving a
 * column right, but not both in one turn. An issued bond costs L. 50 each operating turn after
 * the turn it was issued, after the financial activities.
 */
export const LoanRules1849: LoanRules = {
    market: Market1849,
    inPlay: (state) => bondsInPlay(state),
    marketFor: (state) => marketInForce1849(state),
    value: BondValue1849,
    supply: CorporationIds1849.length,
    capacity: (state) =>
        bondsInPlay(state) && Phases1849.isAtLeast(state.phaseId, BondPhaseId1849) ? 1 : 0,
    rate: () => BondInterestRate1849,
    takeMove: { direction: 'left', steps: 1 },
    repayMove: { direction: 'right', steps: 1 },
    // Emergency money raising pays interest the treasury cannot (§14.2): ruling 16.
    interestDefault: (state, companyId, owed) => {
        const payments = treasuryThenPresident(state, companyId, owed)
        return { payments, marketMoves: [], unpaid: 0 }
    },
    borrowsInLoanStepOnly: true,
    noBorrowingAfterRepaying: true
}

/**
 * A closing corporation repays its outstanding bond at once: from its treasury, then by
 * emergency money raising (§14.2), the president's own cash (ruling 16). It may issue again if
 * it starts again.
 */
export function repayBondOnClosure(state: LoanState, companyId: string): CashPayment[] {
    if (!bondIssued(state, companyId)) return []
    const payments = treasuryThenPresident(state, companyId, BondValue1849)
    delete getCompany(state, companyId).loans
    return payments
}
