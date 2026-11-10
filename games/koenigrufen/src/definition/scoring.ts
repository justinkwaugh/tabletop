import type { GameScoring } from '@tabletop/common'
import type { KoenigrufenProjectedState } from '../model/gameState.js'

export class KoenigrufenScoring implements GameScoring<KoenigrufenProjectedState> {
    finalScores(state: KoenigrufenProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
