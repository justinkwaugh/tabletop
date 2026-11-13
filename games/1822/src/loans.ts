import { finiteCashOwnedBy, type CashPayment } from '@tabletop/18xx'
import { requireState1822 } from './state.js'

/** The bank charges half as much again, rounded up, on a loan as it is taken and at the end of each stock round (§4.2.3, §5.17.2). */
function withInterest(amount: number): number {
    return amount + Math.ceil(amount / 2)
}

export function playerLoan1822(state: object, playerId: string): number {
    return (
        requireState1822(state).playerLoans.find((loan) => loan.playerId === playerId)?.amount ?? 0
    )
}

function setLoan(stateObject: object, playerId: string, amount: number): void {
    const state = requireState1822(stateObject)
    state.playerLoans = [
        ...state.playerLoans.filter((loan) => loan.playerId !== playerId),
        ...(amount > 0 ? [{ playerId, amount }] : [])
    ]
}

/** Records a loan a director took to buy a train, with its interest (§5.17.2). */
export function takePlayerLoan1822(state: object, playerId: string, borrowed: number): void {
    setLoan(state, playerId, playerLoan1822(state, playerId) + withInterest(borrowed))
}

/** Adds the stock round's interest to every outstanding loan (§4.2.3, §4.10.6). */
export function chargeLoanInterest1822(
    stateObject: object
): { playerId: string; interest: number }[] {
    const state = requireState1822(stateObject)
    const charges = state.playerLoans.map(({ playerId, amount }) => ({
        playerId,
        interest: withInterest(amount) - amount
    }))
    state.playerLoans = state.playerLoans.map((loan) => ({
        ...loan,
        amount: withInterest(loan.amount)
    }))
    return charges
}

/**
 * Pays as much of a player's loan as their cash covers. The loan did not come from the bank, so
 * the repayment leaves play rather than going to it (§4.2.4).
 */
export function repayPlayerLoan1822(stateObject: object, playerId: string): number {
    const state = requireState1822(stateObject)
    const owed = playerLoan1822(state, playerId)
    const player = { kind: 'player' as const, playerId }
    const paid = Math.min(owed, finiteCashOwnedBy(state, player))
    if (!paid) return 0
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    if (cash && typeof cash.amount === 'number') cash.amount -= paid
    setLoan(state, playerId, owed - paid)
    return paid
}

/** Money a player earns in an operating round goes to their loan as it is earned (§4.2.2 example). */
export function repayLoansFromIncome1822(
    state: object,
    payments: readonly CashPayment[]
): { playerId: string; amount: number }[] {
    const playerIds = new Set(
        payments.flatMap((payment) => (payment.to.kind === 'player' ? [payment.to.playerId] : []))
    )
    return [...playerIds].flatMap((playerId) => {
        const amount = repayPlayerLoan1822(state, playerId)
        return amount ? [{ playerId, amount }] : []
    })
}
