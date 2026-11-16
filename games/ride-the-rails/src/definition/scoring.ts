import type { GameScoring } from '@tabletop/common'
import type { RideTheRailsGameState } from '../model/gameState.js'

// R-6.2: money is the only score.
export class RideTheRailsScoring implements GameScoring<RideTheRailsGameState> {
    finalScores(state: RideTheRailsGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.money]))
    }
}
