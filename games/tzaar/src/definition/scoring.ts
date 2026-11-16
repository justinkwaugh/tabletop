import type { GameScoring } from '@tabletop/common'
import type { TzaarGameState } from '../model/gameState.js'

// TZAAR is won or lost and cannot be drawn (rule G): the winner scores 1 and the loser 0.
export class TzaarScoring implements GameScoring<TzaarGameState> {
    finalScores(state: TzaarGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
