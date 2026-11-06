import { assert } from '@tabletop/common'
import { WineBarrelCapacity, type Good } from '../data/components.js'
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

/**
 * R-4.3.4 A target acquired returns to the supply and becomes one of the seat's markers from the
 * general supply; with none of its left there, it is simply discarded. Returns whether it became one.
 */
export function targetToMarker(state: HydratedFeudumGameState, playerId: string): boolean {
    const player = state.getPlayerState(playerId)
    const { influence } = state.supply
    state.supply.targets += 1
    if ((influence[player.color] ?? 0) === 0) {
        return false
    }
    influence[player.color] -= 1
    player.influenceSupply += 1
    return true
}

/** R-4.4.2, R-1.1-H1 Markers from the general supply to the seat's; returns how many it had. */
export function takeInfluenceMarkers(
    state: HydratedFeudumGameState,
    playerId: string,
    amount: number
): number {
    const player = state.getPlayerState(playerId)
    const { influence } = state.supply
    const taken = Math.min(amount, influence[player.color] ?? 0)
    influence[player.color] -= taken
    player.influenceSupply += taken
    return taken
}

/** R-4.10.2 Only a sulfur goes in the wine barrel, while it has room. */
export function reasonSulfurToBarrelRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    resource: string
): string | undefined {
    if (resource !== 'sulfur') {
        return 'Only sulfur goes in your barrel.'
    }
    return state.getPlayerState(playerId).barrel < WineBarrelCapacity
        ? undefined
        : 'Your barrel is full.'
}

/** R-4.10.2 A sulfur the seat just gained goes straight into its barrel. */
export function putSulfurInBarrel(state: HydratedFeudumGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    player.goods.sulfur -= 1
    player.barrel += 1
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
