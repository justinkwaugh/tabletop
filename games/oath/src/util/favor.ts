import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { continuousHooksOf } from './continuous.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/**
 * Vow of Kinship. `advisersOf` is whose advisers a Trade acts with (Master of Disguise's
 * `particulars.advisersOf`): from revision 23 their Vow, not the player's own, decides where the
 * Trade's favor goes and what it may pay from, as theirs decides Vow of Poverty (R-7.4-H1, R-X.4).
 */
export function favorHomeBankOf(
    state: HydratedOathGameState,
    playerId: string,
    advisersOf?: string
): Suit | undefined {
    const lent =
        advisersOf !== undefined && isAtLeastOathRevision(state, OathRevision.EngineFixes19)
            ? advisersOf
            : playerId
    return continuousHooksOf(state, playerId, lent).find(
        (hooks) => hooks.keepsFavorInBank !== undefined
    )?.keepsFavorInBank
}

export function banksWithFavor(state: HydratedOathGameState): Suit[] {
    return Object.values(Suit).filter((suit) => state.favorBank[suit] > 0)
}

/** Vow of Kinship — the most of `owed` its holder can pay from the bank: what is owed, or what it holds. */
export function homeBankPayable(
    state: HydratedOathGameState,
    playerId: string,
    owed: number
): number {
    const bank = favorHomeBankOf(state, playerId)
    return bank ? Math.min(owed, state.favorBank[bank]) : 0
}

/** R-7.1.2 — `advisersOf` as for `favorHomeBankOf`. */
export function usableFavor(
    state: HydratedOathGameState,
    playerId: string,
    advisersOf?: string
): number {
    const player = state.getPlayerState(playerId)
    const bank = favorHomeBankOf(state, playerId, advisersOf)
    return player.favor + (bank ? state.favorBank[bank] : 0)
}

/** R-10.10, R-10.11, R-10.26 — `advisersOf` as for `favorHomeBankOf`. */
export function receiveFavor(
    state: HydratedOathGameState,
    playerId: string,
    count: number,
    advisersOf?: string
): void {
    assert(count >= 0, `${playerId} cannot receive ${count} favor`)
    const bank = favorHomeBankOf(state, playerId, advisersOf)
    if (bank) {
        state.favorBank[bank] += count
    } else {
        state.getPlayerState(playerId).favor += count
    }
}

/**
 * R-7.1.2, R-10.11 — favor a player pays, places, burns or gives leaves their board first.
 * `advisersOf` as for `favorHomeBankOf`.
 */
export function spendFavor(
    state: HydratedOathGameState,
    playerId: string,
    count: number,
    advisersOf?: string
): void {
    assert(count >= 0, `${playerId} cannot spend ${count} favor`)
    const usable = usableFavor(state, playerId, advisersOf)
    assert(usable >= count, `${playerId} cannot spend ${count} favor with ${usable} to use`)
    const player = state.getPlayerState(playerId)
    const fromBoard = Math.min(count, player.favor)
    player.favor -= fromBoard
    if (fromBoard === count) return
    const bank = favorHomeBankOf(state, playerId, advisersOf)
    assertExists(bank, `${playerId} has no bank to spend the rest from`)
    state.favorBank[bank] -= count - fromBoard
}

/** R-10.11 — `advisersOf`, as for `favorHomeBankOf`, is the giver's; the receiver's own Vow takes theirs. */
export function giveFavor(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    count: number,
    advisersOf?: string
): void {
    spendFavor(state, fromId, count, advisersOf)
    receiveFavor(state, toId, count)
}

/** R-10.26, R-5.5.7.III — what another player takes or burns comes off the board alone. */
export function removeFavorFromBoard(
    state: HydratedOathGameState,
    playerId: string,
    wanted: number
): number {
    const player = state.getPlayerState(playerId)
    const removed = Math.max(0, Math.min(wanted, player.favor))
    player.favor -= removed
    return removed
}

/** R-9.3 — component-limited: a gain takes as much of what it wants as the bank holds. */
export function favorTakenFrom(held: number, wanted: number): number {
    return Math.max(0, Math.min(wanted, held))
}

/** R-10.10, R-9.3 — `advisersOf` as for `favorHomeBankOf`. */
export function gainFavorFromBank(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit,
    wanted: number,
    advisersOf?: string
): number {
    const gained = favorTakenFrom(state.favorBank[suit], wanted)
    state.favorBank[suit] -= gained
    receiveFavor(state, playerId, gained, advisersOf)
    return gained
}

/** R-10.26 */
export function takeFavorFromPlayer(
    state: HydratedOathGameState,
    takerId: string,
    fromId: string,
    wanted: number
): number {
    const taken = removeFavorFromBoard(state, fromId, wanted)
    receiveFavor(state, takerId, taken)
    return taken
}

/** R-7.1.4-H1 — a continuous power is in effect from the moment its card is in play. */
export function settleBoardFavor(state: HydratedOathGameState, playerId: string): void {
    const onBoard = removeFavorFromBoard(state, playerId, state.getPlayerState(playerId).favor)
    receiveFavor(state, playerId, onBoard)
}
