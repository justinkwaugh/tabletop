import type {
    ExplorationPopulation,
    GameAction,
    GameExploration,
    GameState,
    HydratedGameState
} from '@tabletop/common'
import type { EighteenXXState } from './eighteenXXState.js'
import { isStockInstructionDeclaration } from '../stock/stockInstructionActions.js'
import { isRunInstructionDeclaration } from '../routes/runInstructionActions.js'

export class EighteenXXGameExploration<
    State extends GameState = EighteenXXState
> implements GameExploration<State> {
    readonly createFromProjectedState?: (input: ExplorationPopulation<State>) => State
    constructor(
        private readonly hydrate: (
            state: State
        ) => HydratedGameState<State> & Pick<EighteenXXState, 'stockRound' | 'runInstructions'>,
        populate?: (input: ExplorationPopulation<State>) => State
    ) {
        if (populate)
            this.createFromProjectedState = (input) =>
                this.createFromCanonicalState(populate(input))
    }
    createFromCanonicalState(state: State): State {
        const exploration = this.hydrate(state)
        delete exploration.stockRound.instructions
        delete exploration.runInstructions
        return exploration.dehydrate()
    }
    keepsSourceDeclaration(action: GameAction): boolean {
        return !isStockInstructionDeclaration(action) && !isRunInstructionDeclaration(action)
    }
}
