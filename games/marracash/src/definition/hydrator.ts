import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMarracashGameState, MarracashGameState } from '../model/gameState.js'

export class MarracashHydrator implements GameHydrator<
    MarracashGameState,
    HydratedMarracashGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: MarracashGameState): HydratedMarracashGameState {
        return new HydratedMarracashGameState(state)
    }
}
