import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMarracashGameState, type MarracashProjectedState } from '../model/gameState.js'

export class MarracashHydrator implements GameHydrator<
    MarracashProjectedState,
    HydratedMarracashGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: MarracashProjectedState): HydratedMarracashGameState {
        return new HydratedMarracashGameState(state)
    }
}
