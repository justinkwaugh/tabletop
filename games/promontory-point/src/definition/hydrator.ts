import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import {
    HydratedPromontoryPointGameState,
    PromontoryPointProjectedState
} from '../model/gameState.js'

export class PromontoryPointHydrator implements GameHydrator<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        throw new Error(`Unknown action type ${data.type}`)
    }

    hydrateState(state: PromontoryPointProjectedState): HydratedPromontoryPointGameState {
        return new HydratedPromontoryPointGameState(state)
    }
}
