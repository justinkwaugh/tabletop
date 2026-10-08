import type { GameScoring } from '@tabletop/common'
import { HydratedKoggeGameState, type KoggeProjectedState } from '../model/gameState.js'

export class KoggeScoring implements GameScoring<KoggeProjectedState> {
    finalScores(state: KoggeProjectedState): Record<string, number> {
        const scores = new HydratedKoggeGameState(state).scores()
        return Object.fromEntries(
            Object.entries(scores).map(([playerId, score]) => [playerId, score.total])
        )
    }
}
