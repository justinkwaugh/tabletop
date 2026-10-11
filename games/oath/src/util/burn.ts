import { HydratedOathGameState } from '../model/gameState.js'
import type { Suit } from '../model/oathEnums.js'
import { receiveFavor } from './favor.js'
import { persistentsInPlay } from './persistent.js'

/** Vow of Renewal — who takes a burned favor instead of the bank, if anyone. */
export function burnedFavorTaker(state: HydratedOathGameState): string | undefined {
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        const taker = hooks.takesBurnedFavor?.(ctx)
        if (taker) return taker
    }
    return undefined
}

/** R-10.4 — every burn a player makes routes through here so Vow of Renewal can claim it. */
export function burnFavor(state: HydratedOathGameState, count: number): string | undefined {
    if (count <= 0) return undefined
    const taker = burnedFavorTaker(state)
    if (taker) {
        receiveFavor(state, taker, count)
        return taker
    }
    state.favorSupply += count
    return undefined
}

/**
 * R-10.3-H1 — favor a bank would pay the bandits is burned, as much as the bank holds. No player
 * burns it, so Vow of Renewal ("whenever any player burns") does not take it.
 */
export function burnFavorFromBank(
    state: HydratedOathGameState,
    suit: Suit,
    wanted: number
): number {
    const burned = Math.max(0, Math.min(wanted, state.favorBank[suit]))
    state.favorBank[suit] -= burned
    state.favorSupply += burned
    return burned
}

/**
 * R-10.4-H1 — a burn no player performs goes to the shared bank: Vow of Renewal's "whenever any
 * player burns" does not take it.
 */
export function burnFavorByNoPlayer(state: HydratedOathGameState, count: number): void {
    state.favorSupply += count
}
