import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMarracashGameState, MarracashGameState } from '../model/gameState.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Sample game.  Used by the game engine
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
