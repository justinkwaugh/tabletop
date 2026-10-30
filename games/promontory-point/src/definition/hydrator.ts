import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedPromontoryPointGameState, PromontoryPointGameState } from '../model/gameState.js'

export class PromontoryPointHydrator implements GameHydrator<
    PromontoryPointGameState,
    HydratedPromontoryPointGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        throw new Error(`Unknown action type ${data.type}`)
    }

    hydrateState(state: PromontoryPointGameState): HydratedPromontoryPointGameState {
        return new HydratedPromontoryPointGameState(state)
    }
}
