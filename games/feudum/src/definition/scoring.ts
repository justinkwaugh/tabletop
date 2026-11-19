import type { GameScoring } from '@tabletop/common'
import type { FeudumProjectedState } from '../model/gameState.js'

export class FeudumScoring implements GameScoring<FeudumProjectedState> {
    /** R-6.3 What the winner is ranked by; the barrel only breaks a tie. */
    finalScores(state: FeudumProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
