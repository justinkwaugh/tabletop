import type { GameScoring } from '@tabletop/common'
import type { YinshGameState } from '../model/gameState.js'

export class YinshScoring implements GameScoring<YinshGameState> {
    finalScores(state: YinshGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, player.ringsRemoved])
        )
    }
}
