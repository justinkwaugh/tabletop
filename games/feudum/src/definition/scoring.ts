import type { GameScoring } from '@tabletop/common'
import type { FeudumGameState } from '../model/gameState.js'

export class FeudumScoring implements GameScoring<FeudumGameState> {
    finalScores(state: FeudumGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, 0]))
    }
}
