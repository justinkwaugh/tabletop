import type { GameScoring } from '@tabletop/common'
import type { LyngkGameState } from '../model/gameState.js'

// LYNGK is won or lost on a ranking of stacks: the winner scores 1 and the loser 0, and a draw gives
// both players 1. The cards and the end panel show the ranking itself.
export class LyngkScoring implements GameScoring<LyngkGameState> {
    finalScores(state: LyngkGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
