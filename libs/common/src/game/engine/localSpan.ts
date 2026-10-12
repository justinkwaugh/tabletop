import { combineCascades, type ActionCascadeResult, type GameEngine } from './gameEngine.js'
import type { GameAction } from './gameAction.js'
import type { Game } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export function executeInLocalGame<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    action
}: {
    engine: GameEngine<T, U>
    game: Game
    state: T
    action: GameAction
}): ActionCascadeResult<T> {
    const executed = engine.executeCanonicalAction({ action, state, game })
    const advanced = engine.advanceSpan({ state: executed.updatedState, game })
    return advanced === undefined ? executed : combineCascades(state, [executed, advanced])
}
