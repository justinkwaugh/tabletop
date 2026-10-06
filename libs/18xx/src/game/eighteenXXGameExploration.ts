import type { GameExploration, GameState, HydratedGameState } from '@tabletop/common'
import type { EighteenXXState } from './eighteenXXState.js'

export class EighteenXXGameExploration<
    State extends GameState = EighteenXXState
> implements GameExploration<State> {
    constructor(
        private readonly hydrate: (
            state: State
        ) => HydratedGameState<State> & Pick<EighteenXXState, 'stockRound'>
    ) {}
    createFromCanonicalState(state: State): State {
        const exploration = this.hydrate(state)
        delete exploration.stockRound.instructions
        return exploration.dehydrate()
    }
}
