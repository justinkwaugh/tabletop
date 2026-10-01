import type { GameScoring } from '@tabletop/common'
import {
    HydratedMagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'

export class MagnaGreciaScoring implements GameScoring<MagnaGreciaProjectedState> {
    finalScores(state: MagnaGreciaProjectedState): Record<string, number> {
        const scores = new HydratedMagnaGreciaGameState(state).scores()
        return Object.fromEntries(
            Object.entries(scores).map(([playerId, score]) => [playerId, score.total])
        )
    }
}
