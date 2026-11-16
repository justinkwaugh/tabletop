import type { GameScoring } from '@tabletop/common'
import type { YinshGameState } from '../model/gameState.js'

// YINSH has no points: the winner scores 1 and the loser 0, and a draw gives both players 1.
export class YinshScoring implements GameScoring<YinshGameState> {
    finalScores(state: YinshGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
