import type { GameScoring } from '@tabletop/common'
import type { MatrxGameState } from '../model/gameState.js'

// MATRX GIPF has no points: the winner scores 1 and the loser 0.
export class MatrxScoring implements GameScoring<MatrxGameState> {
    finalScores(state: MatrxGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
