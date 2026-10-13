import type { GameScoring } from '@tabletop/common'
import type { NapoleonsTriumphProjectedState } from '../model/gameState.js'

// Rule 16: a battle is won or lost, with no points, so the victor scores one and the other army nothing.
export class NapoleonsTriumphScoring implements GameScoring<NapoleonsTriumphProjectedState> {
    finalScores(state: NapoleonsTriumphProjectedState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [
                player.playerId,
                state.winningPlayerIds.includes(player.playerId) ? 1 : 0
            ])
        )
    }
}
