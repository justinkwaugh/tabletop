import * as Type from 'typebox'
import type { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from './gameState.js'

export type Payout = Type.Static<typeof Payout>
export const Payout = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

export type PerShare = { railroadId: RailroadId; perShare: number }

// Pays each player $3 for every Leave Town cube in their area, from the bank.
export function payLeaveTownCubes(state: HydratedSarGameState): Payout[] {
    return state.players
        .map((player) => {
            const amount = state.leaveTownPayout(player.playerId)
            player.cash += amount
            return { playerId: player.playerId, amount }
        })
        .filter((payout) => payout.amount > 0)
}

// Pays each player the per-share amount for every share they hold, from the bank.
export function payShareholders(state: HydratedSarGameState, rates: readonly PerShare[]): Payout[] {
    return state.players.map((player) => {
        const amount = rates.reduce(
            (sum, rate) => sum + rate.perShare * state.sharesHeld(rate.railroadId, player.playerId),
            0
        )
        player.cash += amount
        return { playerId: player.playerId, amount }
    })
}
