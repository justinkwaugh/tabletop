import type { GameScoring } from '@tabletop/common'
import type { SantiagoProjectedState } from '../model/gameState.js'

export class SantiagoScoring implements GameScoring<SantiagoProjectedState> {
    finalScores(state: SantiagoProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
