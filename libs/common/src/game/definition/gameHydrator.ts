import { GameAction, type HydratedAction } from '../engine/gameAction.js'
import { GameState, type HydratedGameState } from '../model/gameState.js'

export interface GameHydrator<
    T extends GameState = GameState,
    U extends HydratedGameState = HydratedGameState
> {
    hydrateAction(data: GameAction): HydratedAction
    hydrateState(state: T): U
}
