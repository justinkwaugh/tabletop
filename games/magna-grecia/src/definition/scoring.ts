import type { GameScoring } from '@tabletop/common'
import { HydratedMagnaGreciaGameState, type MagnaGreciaGameState } from '../model/gameState.js'

export class MagnaGreciaScoring implements GameScoring<MagnaGreciaGameState> {
    finalScores(state: MagnaGreciaGameState): Record<string, number> {
        const scores = new HydratedMagnaGreciaGameState(state).scores()
        return Object.fromEntries(
            Object.entries(scores).map(([playerId, score]) => [playerId, score.total])
        )
    }
}
