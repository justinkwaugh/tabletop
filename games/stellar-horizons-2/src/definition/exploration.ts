import type { ExplorationPopulation, GameExploration } from '@tabletop/common'
import type { StellarHorizonsProjectedState } from '../model/gameState.js'

export class StellarHorizonsGameExploration implements GameExploration<StellarHorizonsProjectedState> {
    createFromCanonicalState(state: StellarHorizonsProjectedState): StellarHorizonsProjectedState {
        return structuredClone(state)
    }

    createFromProjectedState({
        state
    }: ExplorationPopulation<StellarHorizonsProjectedState>): StellarHorizonsProjectedState {
        return structuredClone(state)
    }
}
