import type { GameScoring } from '@tabletop/common'
import type { PunctGameState } from '../model/gameState.js'

// PÜNCT is won, lost or drawn; the central spaces only decide who in the standard game. The
// winner scores 1 and the loser 0, and a draw gives both players 1.
export class PunctScoring implements GameScoring<PunctGameState> {
    finalScores(state: PunctGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
