import type { Debt } from '../funding/cashCrisis.js'
import type { CashPayment } from './cashPayments.js'
import { sharesOwned, type FinancialState } from './finance.js'

export type ShareholderPayout = { payments: CashPayment[]; charges: Debt[] }

/**
 * The bank's payment to each player for their net shares of a company; a player short the
 * company owes the amount instead. Shares in the market or a treasury receive nothing.
 */
export function shareholderPayout(
    state: FinancialState & { players: readonly { playerId: string }[] },
    companyId: string,
    perShare: number
): ShareholderPayout {
    const payments: CashPayment[] = []
    const charges: Debt[] = []
    if (perShare <= 0) return { payments, charges }
    for (const { playerId } of state.players) {
        const player = { kind: 'player' as const, playerId }
        const amount = sharesOwned(state, companyId, player) * perShare
        if (amount > 0) payments.push({ from: { kind: 'bank' }, to: player, amount })
        else if (amount < 0) charges.push({ playerId, amount: -amount })
    }
    return { payments, charges }
}
