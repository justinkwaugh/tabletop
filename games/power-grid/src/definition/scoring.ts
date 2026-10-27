import type { GameScoring } from '@tabletop/common'
import { HydratedPowerGridGameState, type PowerGridProjectedState } from '../model/gameState.js'

export class PowerGridScoring implements GameScoring<PowerGridProjectedState> {
    finalScores(state: PowerGridProjectedState): Record<string, number> {
        return Object.fromEntries(
            new HydratedPowerGridGameState(state)
                .finalStandings()
                .map((standing) => [standing.playerId, standing.powered])
        )
    }
}
