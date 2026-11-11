import type { GameScoring } from '@tabletop/common'
import type { OstbahnGameState } from '../model/gameState.js'

export class OstbahnScoring implements GameScoring<OstbahnGameState> {
    finalScores(state: OstbahnGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
