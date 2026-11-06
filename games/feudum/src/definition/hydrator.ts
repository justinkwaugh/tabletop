import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'

export class FeudumHydrator implements GameHydrator<FeudumProjectedState, HydratedFeudumGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: FeudumProjectedState): HydratedFeudumGameState {
        return new HydratedFeudumGameState(state)
    }
}
