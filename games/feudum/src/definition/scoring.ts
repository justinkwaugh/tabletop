import type { GameScoring } from '@tabletop/common'
import type { FeudumProjectedState } from '../model/gameState.js'

export class FeudumScoring implements GameScoring<FeudumProjectedState> {
    finalScores(state: FeudumProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, 0]))
    }
}
