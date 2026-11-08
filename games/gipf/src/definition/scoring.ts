import type { GameScoring } from '@tabletop/common'
import type { GipfGameState } from '../model/gameState.js'

// GIPF is won or lost with no points, so the winner scores one and the loser nothing.
export class GipfScoring implements GameScoring<GipfGameState> {
    finalScores(state: GipfGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
