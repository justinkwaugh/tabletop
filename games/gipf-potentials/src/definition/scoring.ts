import type { GameScoring } from '@tabletop/common'
import type { GipfPotentialsGameState } from '../model/gameState.js'

// GIPF with Potentials has no points: the winner scores 1 and the loser 0.
export class GipfPotentialsScoring implements GameScoring<GipfPotentialsGameState> {
    finalScores(state: GipfPotentialsGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
