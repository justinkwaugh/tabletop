import type { GameScoring } from '@tabletop/common'
import type { RailheadsProjectedState } from '../model/gameState.js'

export class RailheadsScoring implements GameScoring<RailheadsProjectedState> {
    finalScores(state: RailheadsProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
