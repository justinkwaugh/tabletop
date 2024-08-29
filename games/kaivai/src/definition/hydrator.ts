import {
    GameAction,
    GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { KaivaiGameState, HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class KaivaiHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedKaivaiGameState(state as KaivaiGameState)
    }
}
