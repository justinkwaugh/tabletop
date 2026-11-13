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

/** What a corporation's bond money left its president owing, once their own cash is spent. */
export type BondShortfall1849 = { playerId: string; amount: number }

/**
 * Pays what the corporation owes on its bond: from its treasury, then, by emergency money raising
 * (§14.2, §10.7), from its president's own cash. What is still owed the president must raise by
 * selling shares.
 */
function treasuryThenPresident(
    state: LoanState,
    companyId: string,
    owed: number
): { payments: CashPayment[]; shortfall?: BondShortfall1849 } {
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
    const unpaid = owed - fromTreasury - fromPresident
    return president?.kind === 'player' && unpaid > 0
        ? { payments, shortfall: { playerId: president.playerId, amount: unpaid } }
        : { payments }
}

/**
 * The Bonds variant (§14.2): each corporation may issue one L. 500 bond from phase 8 at the end
 * of its operating turn, its price moving a column left, and repay it there for L. 500, moving a
 * column right, from where it may be issued again. An issued bond costs L. 50 each operating turn after
 * the turn it was issued, after the financial activities.
 */
export const LoanRules1849: LoanRules = {
    market: Market1849,
    inPlay: (state) => bondsInPlay(state),
    marketFor: (state) => marketInForce1849(state),
    value: BondValue1849,
    supply: CorporationIds1849.length,
    capacity: (state) => (Phases1849.isAtLeast(state.phaseId, BondPhaseId1849) ? 1 : 0),
    rate: () => BondInterestRate1849,
    takeMove: { direction: 'left', steps: 1 },
    repayMove: { direction: 'right', steps: 1 },
    // Emergency money raising pays interest the treasury cannot (§14.2, §10.7): the president's
    // cash, then their shares, or the corporation closes.
    interestDefault: (state, companyId, owed) => {
        const { payments, shortfall } = treasuryThenPresident(state, companyId, owed)
        return {
            payments,
            marketMoves: [],
            unpaid: shortfall?.amount ?? 0,
            companyDebt: true
        }
    },
    borrowsInLoanStepOnly: true
}

/**
 * A closing corporation repays its outstanding bond at once: from its treasury, then by
 * emergency money raising (§14.2), its president's cash and then their shares. It may issue again
 * if it starts again.
 */
export function repayBondOnClosure(
    state: LoanState,
    companyId: string
): { payments: CashPayment[]; shortfall?: BondShortfall1849 } {
    if (!bondIssued(state, companyId)) return { payments: [] }
    const repayment = treasuryThenPresident(state, companyId, BondValue1849)
    delete getCompany(state, companyId).loans
    return repayment
}
