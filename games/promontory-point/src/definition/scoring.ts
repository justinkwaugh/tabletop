import type { GameScoring } from '@tabletop/common'
import type { PromontoryPointProjectedState } from '../model/gameState.js'

export class PromontoryPointScoring implements GameScoring<PromontoryPointProjectedState> {
    finalScores(state: PromontoryPointProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, 0]))
    }
}
