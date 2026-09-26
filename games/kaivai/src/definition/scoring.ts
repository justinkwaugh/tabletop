import type { GameScoring } from '@tabletop/common'
import type { KaivaiProjectedState } from '../model/gameState.js'

export class KaivaiScoring implements GameScoring<KaivaiProjectedState> {
    finalScores(state: KaivaiProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
