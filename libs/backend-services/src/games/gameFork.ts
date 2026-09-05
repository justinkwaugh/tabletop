import {
    assert,
    type Game,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import { nanoid } from 'nanoid'

export function reconstructForkHistory<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    initialState,
    canonicalState,
    actions,
    actionIndex
}: {
    engine: GameEngine<T, U>
    game: Game
    initialState: T
    canonicalState?: T
    actions: readonly GameAction[]
    actionIndex: number
}): { state: T; actions: GameAction[] } {
    let state = structuredClone(canonicalState ?? initialState)
    if (canonicalState !== undefined) {
        for (const action of actions.toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        assert(
            state.actionChecksum === 0 && state.actionCount === 0,
            'Could not rewind game to initial state'
        )
        state.id = initialState.id
        state.gameId = game.id
    }

    const appliedActions: GameAction[] = []
    for (const original of actions.slice(0, actionIndex + 1)) {
        const action = { ...structuredClone(original), id: nanoid(), gameId: game.id }
        const result = engine.executeSingleAction({ action, state, game })
        state = result.updatedState
        appliedActions.push(...result.processedActions)
    }
    return { state, actions: appliedActions }
}
