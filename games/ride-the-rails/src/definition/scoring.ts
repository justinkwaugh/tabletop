import type { GameScoring } from '@tabletop/common'
import type { RideTheRailsGameState } from '../model/gameState.js'

export class RideTheRailsScoring implements GameScoring<RideTheRailsGameState> {
    finalScores(state: RideTheRailsGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, 0]))
    }
}
