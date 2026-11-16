import type { GameScoring } from '@tabletop/common'
import type { LwProjectedState } from '../model/gameState.js'

export class LwScoring implements GameScoring<LwProjectedState> {
    finalScores(state: LwProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
