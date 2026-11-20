import {
    HalfAgainInterest,
    chargePlayerLoanInterest,
    playerLoan,
    repayablePlayerLoan,
    takePlayerLoan,
    type PlayerLoanRules
} from '@tabletop/18xx'
import { requireState1822 } from './state.js'

/**
 * The bank charges half as much again, rounded up, on a loan as it is taken and at the end of
 * each stock round (§4.2.3, §5.17.2). The loan did not come from the bank, so a repayment leaves
 * play rather than going to it (§4.1.3, §4.2.4).
 */
export const PlayerLoanRules1822: PlayerLoanRules = {
    interest: HalfAgainInterest,
    repaidTo: 'nobody'
}

export function playerLoan1822(state: object, playerId: string): number {
    return playerLoan(requireState1822(state), playerId)
}

/** Records a loan a director took to buy a train, with its interest (§5.17.2). */
export function takePlayerLoan1822(state: object, playerId: string, borrowed: number): void {
    takePlayerLoan(requireState1822(state), PlayerLoanRules1822, playerId, borrowed)
}

/** Adds the stock round's interest to every outstanding loan (§4.2.3, §4.10.6). */
export function chargeLoanInterest1822(state: object): { playerId: string; interest: number }[] {
    return chargePlayerLoanInterest(requireState1822(state), PlayerLoanRules1822)
}

/** The most the player could pay towards their loan now. */
export function repayableLoan1822(state: object, playerId: string): number {
    return repayablePlayerLoan(requireState1822(state), playerId)
}
