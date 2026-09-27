import type { GameExploration } from '@tabletop/common'
import type { EighteenXXState } from './eighteenXXState.js'

export class EighteenXXGameExploration implements GameExploration<EighteenXXState> {
    createFromCanonicalState(state: EighteenXXState): EighteenXXState {
        delete state.stockRound.instructions
        return state
    }
}
