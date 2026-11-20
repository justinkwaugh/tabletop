import { debtPenaltySteps, type StateRoyalGorge } from '@tabletop/18royalgorge'

export type OutstandingDebt = { companyId: string; owed: number; penalty: number }

/** The debts each railroad still owes, and the spaces its price falls if they stay unpaid (DB-6). */
export function outstandingDebts(state: StateRoyalGorge): OutstandingDebt[] {
    return Object.entries(state.debts).map(([companyId, owed]) => ({
        companyId,
        owed,
        penalty: debtPenaltySteps(state, companyId)
    }))
}
