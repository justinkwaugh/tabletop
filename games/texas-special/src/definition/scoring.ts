import type { GameScoring } from '@tabletop/common'
import type { SarGameState } from '../model/gameState.js'

export class SarScoring implements GameScoring<SarGameState> {
    finalScores(state: SarGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
