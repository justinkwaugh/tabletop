import type { GameScoring } from '@tabletop/common'
import type { FreshFishProjectedState } from '../model/gameState.js'

export class FreshFishScoring implements GameScoring<FreshFishProjectedState> {
    finalScores(state: FreshFishProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
