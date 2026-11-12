import type { ExplorationPopulation, GameExploration } from '@tabletop/common'
import type { OstbahnGameState } from '../model/gameState.js'

export class OstbahnGameExploration implements GameExploration<OstbahnGameState> {
    createFromCanonicalState(state: OstbahnGameState): OstbahnGameState {
        return structuredClone(state)
    }

    createFromProjectedState({ state }: ExplorationPopulation<OstbahnGameState>): OstbahnGameState {
        return structuredClone(state)
    }
}
