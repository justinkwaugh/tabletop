import { GameAction, type HydratedAction } from '../engine/gameAction.js'
import { GameState, type HydratedGameState } from '../model/gameState.js'

export interface GameHydrator {
    hydrateAction(data: GameAction): HydratedAction
    hydrateState(state: GameState): HydratedGameState
}
