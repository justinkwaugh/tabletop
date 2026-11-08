import type { GameScoring } from '@tabletop/common'
import type { GipfGameState } from '../model/gameState.js'

// GIPF has no points: the winner scores 1 and the loser 0.
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
