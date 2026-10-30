import type { GameScoring } from '@tabletop/common'
import type { PromontoryPointGameState } from '../model/gameState.js'

export class PromontoryPointScoring implements GameScoring<PromontoryPointGameState> {
    finalScores(state: PromontoryPointGameState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, 0]))
    }
}
