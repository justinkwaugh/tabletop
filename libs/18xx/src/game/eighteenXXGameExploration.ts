import type { GameExploration } from '@tabletop/common'
import type { EighteenXXState } from './eighteenXXState.js'

export class EighteenXXGameExploration<
    State extends EighteenXXState = EighteenXXState
> implements GameExploration<State> {
    createFromCanonicalState(state: State): State {
        delete state.stockRound.instructions
        return state
    }
}
