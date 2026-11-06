import { assert } from '@tabletop/common'
import type { Good } from '../data/components.js'
import type { HydratedFeudumGameState } from './gameState.js'

/** R-1.1-H1 The supply pays what remains; returns what it paid. */
export function takeShillingsFromSupply(state: HydratedFeudumGameState, amount: number): number {
    const paid = Math.min(amount, state.supply.shillings)
    state.supply.shillings -= paid
    return paid
}

/** R-1.1-H1 Returns what the player received. */
export function payShillingsFromSupply(
    state: HydratedFeudumGameState,
    playerId: string,
    amount: number
): number {
    const paid = takeShillingsFromSupply(state, amount)
    state.getPlayerState(playerId).shillings += paid
    return paid
}

/** R-1.1 Shillings going back to the general supply; the player must hold them. */
export function payShillingsToSupply(
    state: HydratedFeudumGameState,
    playerId: string,
    amount: number
): void {
    const player = state.getPlayerState(playerId)
    assert(player.shillings >= amount, `R-1.1 ${playerId} does not hold ${amount} shillings`)
    player.shillings -= amount
    state.supply.shillings += amount
}

/** R-1.4.4, R-1.1-H1 A named good from the haversack; returns how many it held to give. */
export function takeGoodFromHaversack(
    state: HydratedFeudumGameState,
    good: Good,
    amount = 1
): number {
    const taken = Math.min(amount, state.supply.haversack[good])
    state.supply.haversack[good] -= taken
    return taken
}

/** R-1.4.4, R-7 "Turn in": a good goes back to the haversack. */
export function returnGoodToHaversack(
    state: HydratedFeudumGameState,
    good: Good,
    amount = 1
): void {
    state.supply.haversack[good] += amount
}
