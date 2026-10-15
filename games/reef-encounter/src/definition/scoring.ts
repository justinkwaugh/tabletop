import type { GameScoring } from '@tabletop/common'
import {
    HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '../model/gameState.js'

export class ReefEncounterScoring implements GameScoring<ReefEncounterProjectedState> {
    finalScores(state: ReefEncounterProjectedState): Record<string, number> {
        const scores = new HydratedReefEncounterGameState(structuredClone(state)).scores()
        return Object.fromEntries(
            Object.entries(scores).map(([playerId, score]) => [playerId, score.total])
        )
    }
}
