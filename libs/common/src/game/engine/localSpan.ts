import { combineCascades, type ActionCascadeResult, type MainLine } from './gameEngine.js'
import type { GameAction } from './gameAction.js'
import {
    isRestingInSpan,
    restingSpan,
    returnedPlayerIds,
    unmergedPlayerIds
} from './parallelSpan.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export function advanceSpan<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    game
}: MainLine<T, U>): ActionCascadeResult<T> | undefined {
    const steps: ActionCascadeResult<T>[] = []
    let current = state
    while (isRestingInSpan(current)) {
        const span = restingSpan(current)
        const returnedPlayerId = returnedPlayerIds(span).at(0)
        const nextPlayerId = unmergedPlayerIds(span).at(0)
        const step =
            returnedPlayerId !== undefined
                ? engine.closeBranch({ state: current, playerId: returnedPlayerId })
                : nextPlayerId === undefined
                  ? engine.completeSpan({ state: current, game })
                  : engine.startBranch({ state: current, game, playerId: nextPlayerId })
        steps.push(step)
        current = step.updatedState
    }
    return steps.length === 0 ? undefined : combineCascades(state, steps)
}

export function executeInLocalGame<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    action
}: MainLine<T, U> & { action: GameAction }): ActionCascadeResult<T> {
    const executed = engine.executeCanonicalAction({ action, state, game })
    const advanced = advanceSpan({ engine, state: executed.updatedState, game })
    return advanced === undefined ? executed : combineCascades(state, [executed, advanced])
}
