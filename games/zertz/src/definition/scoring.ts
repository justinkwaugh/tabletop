import type { GameScoring } from '@tabletop/common'
import type { ZertzGameState } from '../model/gameState.js'

// ZÈRTZ has no points: the winner scores 1 and the loser 0; a drawn game gives both 1.
export class ZertzScoring implements GameScoring<ZertzGameState> {
    finalScores(state: ZertzGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
