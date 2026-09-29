import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { continuousHooksOf } from './continuous.js'

/** Vow of Kinship */
export function favorHomeBankOf(state: HydratedOathGameState, playerId: string): Suit | undefined {
    return continuousHooksOf(state, playerId).find((hooks) => hooks.keepsFavorInBank !== undefined)
        ?.keepsFavorInBank
}

/** R-7.1.2 */
export function usableFavor(state: HydratedOathGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)
    const bank = favorHomeBankOf(state, playerId)
    return player.favor + (bank ? state.favorBank[bank] : 0)
}

/** R-10.10, R-10.11, R-10.26 */
export function receiveFavor(state: HydratedOathGameState, playerId: string, count: number): void {
    assert(count >= 0, `${playerId} cannot receive ${count} favor`)
    const bank = favorHomeBankOf(state, playerId)
    if (bank) {
        state.favorBank[bank] += count
    } else {
        state.getPlayerState(playerId).favor += count
    }
}

/** R-7.1.2, R-10.11 — favor a player pays, places, burns or gives leaves their board first. */
export function spendFavor(state: HydratedOathGameState, playerId: string, count: number): void {
    assert(count >= 0, `${playerId} cannot spend ${count} favor`)
    const usable = usableFavor(state, playerId)
    assert(usable >= count, `${playerId} cannot spend ${count} favor with ${usable} to use`)
    const player = state.getPlayerState(playerId)
    const fromBoard = Math.min(count, player.favor)
    player.favor -= fromBoard
    if (fromBoard === count) return
    const bank = favorHomeBankOf(state, playerId)
    assertExists(bank, `${playerId} has no bank to spend the rest from`)
    state.favorBank[bank] -= count - fromBoard
}

/** R-10.11 */
export function giveFavor(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    count: number
): void {
    spendFavor(state, fromId, count)
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

/** R-10.10, R-9.3 */
export function gainFavorFromBank(
    state: HydratedOathGameState,
    playerId: string,
    suit: Suit,
    wanted: number
): number {
    const gained = Math.max(0, Math.min(wanted, state.favorBank[suit]))
    state.favorBank[suit] -= gained
    receiveFavor(state, playerId, gained)
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
