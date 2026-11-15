import type { GameScoring } from '@tabletop/common'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'

export class MedinaScoring implements GameScoring<MedinaProjectedState> {
    finalScores(state: MedinaProjectedState): Record<string, number> {
        const scores = new HydratedMedinaGameState(state).scores()
        return Object.fromEntries(
            Object.entries(scores).map(([playerId, score]) => [playerId, score.total])
        )
    }
}
