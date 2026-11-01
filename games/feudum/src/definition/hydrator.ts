import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedFeudumGameState, FeudumGameState } from '../model/gameState.js'

export class FeudumHydrator implements GameHydrator<FeudumGameState, HydratedFeudumGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: FeudumGameState): HydratedFeudumGameState {
        return new HydratedFeudumGameState(state)
    }
}
