import type { GameScoring } from '@tabletop/common'
import type { MatrxGameState } from '../model/gameState.js'

export class MatrxScoring implements GameScoring<MatrxGameState> {
    finalScores(state: MatrxGameState): Record<string, number> {
        return Object.fromEntries(
            state.players.map((player) => [player.playerId, player.captured.length])
        )
    }
}
