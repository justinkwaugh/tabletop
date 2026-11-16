import type { ExplorationPopulation, GameExploration } from '@tabletop/common'
import type { RideTheRailsGameState } from '../model/gameState.js'

// R-5: nothing is hidden, so the projected state is the canonical state and an exploration
// starts from a copy of either one.
export class RideTheRailsGameExploration implements GameExploration<RideTheRailsGameState> {
    createFromCanonicalState(state: RideTheRailsGameState): RideTheRailsGameState {
        return structuredClone(state)
    }

    createFromProjectedState({
        state
    }: ExplorationPopulation<RideTheRailsGameState>): RideTheRailsGameState {
        return structuredClone(state)
    }
}
