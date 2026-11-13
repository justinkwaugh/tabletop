import { finiteCashOwnedBy } from '@tabletop/18xx'
import { assert } from '@tabletop/common'
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
 * Pays an amount of the player's cash towards their loan. The loan did not come from the bank, so
 * the repayment leaves play rather than going to it (§4.1.3, §4.2.4).
 */
export function repayPlayerLoan1822(stateObject: object, playerId: string, amount: number): void {
    const state = requireState1822(stateObject)
    const owed = playerLoan1822(state, playerId)
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assert(
        cash && typeof cash.amount === 'number' && amount <= Math.min(owed, cash.amount),
        'A repayment is of cash the player holds, up to what they owe'
    )
    cash.amount -= amount
    setLoan(state, playerId, owed - amount)
}

/** The most the player could pay towards their loan now. */
export function repayableLoan1822(state: object, playerId: string): number {
    return Math.min(
        playerLoan1822(state, playerId),
        finiteCashOwnedBy(requireState1822(state), { kind: 'player', playerId })
    )
}
