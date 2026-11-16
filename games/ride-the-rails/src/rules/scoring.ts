import * as Type from 'typebox'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'

export type PlayerMoney = Type.Static<typeof PlayerMoney>
export const PlayerMoney = Type.Object({
    playerId: Type.String(),
    money: Type.Integer({ minimum: 0 })
})

export function moneyOf(
    state: HydratedRideTheRailsGameState,
    playerIds: readonly string[]
): PlayerMoney[] {
    return playerIds.map((playerId) => ({
        playerId,
        money: state.getPlayerState(playerId).money
    }))
}

// R-6.2: the most money wins; every player tied for it shares the win.
export function richestPlayerIds(state: HydratedRideTheRailsGameState): string[] {
    const most = Math.max(...state.players.map((player) => player.money))
    return state.players.filter((player) => player.money === most).map((player) => player.playerId)
}
