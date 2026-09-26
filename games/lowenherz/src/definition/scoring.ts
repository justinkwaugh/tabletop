import type { GameScoring } from '@tabletop/common'
import type { LowenherzProjectedState } from '../model/gameState.js'

export class LowenherzScoring implements GameScoring<LowenherzProjectedState> {
    finalScores(state: LowenherzProjectedState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, player.powerPoints])
        )
    }
}
