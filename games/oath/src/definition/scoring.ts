import type { GameScoring } from '@tabletop/common'
import type { OathProjectedState } from '../model/gameState.js'

/** R-3 — Oath keeps no points: the one winner scores 1 and every other player 0. */
export class OathScoring implements GameScoring<OathProjectedState> {
    finalScores(state: OathProjectedState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
