import { assert, type ExplorationPopulation, type GameExploration } from '@tabletop/common'
import { MedinaGameStateValidator, type MedinaProjectedState } from '../model/gameState.js'

const UNAVAILABLE = 'Exploration is unavailable with Hidden pieces'

export class MedinaGameExploration implements GameExploration<MedinaProjectedState> {
    createFromCanonicalState(state: MedinaProjectedState): MedinaProjectedState {
        assert(!state.hiddenPieces, UNAVAILABLE)
        return state
    }

    createFromProjectedState({
        game,
        state
    }: ExplorationPopulation<MedinaProjectedState>): MedinaProjectedState {
        assert(!game.config?.hiddenPieces && !state.hiddenPieces, UNAVAILABLE)
        assert(
            MedinaGameStateValidator.Check(state),
            'Exploration must produce a complete Medina state'
        )
        return state
    }
}
