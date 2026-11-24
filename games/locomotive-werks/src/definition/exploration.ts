import type { ExplorationPopulation, GameExploration } from '@tabletop/common'
import type { LwProjectedState } from '../model/gameState.js'

// The only secret is the dice still to be rolled, and an exploration rolls them from a fresh
// protected stream of its own, so the projected state needs nothing filled in.
export class LwGameExploration implements GameExploration<LwProjectedState> {
    createFromCanonicalState(state: LwProjectedState): LwProjectedState {
        return structuredClone(state)
    }

    createFromProjectedState({ state }: ExplorationPopulation<LwProjectedState>): LwProjectedState {
        return structuredClone(state)
    }
}
