import type { GameScoring } from '@tabletop/common'
import type { DvonnGameState } from '../model/gameState.js'

// DVONN is won or lost; the stack totals only decide who. The winner scores 1 and the loser 0, and
// a draw gives both players 1.
export class DvonnScoring implements GameScoring<DvonnGameState> {
    finalScores(state: DvonnGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
