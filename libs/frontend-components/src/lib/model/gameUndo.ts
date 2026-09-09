import {
    assertExists,
    calculateActionChecksum,
    ExplorationHistory,
    type GameAction,
    type GameState,
    type HydratedGameState,
    type Visibility
} from '@tabletop/common'
import jsonpatch from 'fast-json-patch'
import { GameActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'

export class GameUndo<T extends GameState, U extends HydratedGameState<T> & T> {
    constructor(private readonly context: GameContext<T, U>) {}

    preview(target: GameAction, perspective?: Visibility.Perspective): GameContext<T, U> {
        const result = this.context.clone()
        const history = new ExplorationHistory(result.engine)
        const redoActions: GameAction[] = []
        let state = result.state
        let action: GameAction
        do {
            const last = result.popAction()
            assertExists(last, 'Undo target is not in Action History')
            action = last
            if (
                action.playerId &&
                action.playerId !== target.playerId &&
                target.simultaneousGroupId !== undefined &&
                action.simultaneousGroupId === target.simultaneousGroupId
            ) {
                redoActions.unshift(action)
            }
            state = history.undo(state, action, this.context.state.explorationState)
        } while (action.id !== target.id)

        state = history.afterUndo(
            this.context.state,
            state,
            this.context.actions.slice(state.actionCount)
        )
        if (perspective === undefined) result.engine.validateCanonicalState(state)
        result.updateGameState(state)
        for (const action of redoActions) this.redo(result, action, perspective)
        result.runtime.hydrator.hydrateState(result.state)
        result.verifyFullChecksum()
        return result
    }

    private redo(
        context: GameContext<T, U>,
        original: GameAction,
        perspective?: Visibility.Perspective
    ): void {
        const action = structuredClone(original)
        action.index = context.actions.length
        delete action.undoPatch
        const state = context.state
        if (perspective !== undefined && action.forwardPatch !== undefined) {
            const updatedState = context.engine.applyProcessedAction({
                action,
                state,
                game: context.game
            })
            updatedState.actionCount = action.index + 1
            updatedState.actionChecksum = calculateActionChecksum(state.actionChecksum, [action])
            action.undoPatch = jsonpatch.compare(updatedState, state)
            action.forwardPatch = jsonpatch.compare(state, updatedState)
            context.applyActionResults(new GameActionResults([action], updatedState))
            return
        }
        delete action.forwardPatch
        const args = { action, state, game: context.game }
        const result =
            perspective === undefined
                ? context.engine.executeCanonicalAction(args)
                : context.engine.executeAction({ ...args, perspective })
        context.applyActionResults(
            new GameActionResults(result.processedActions, result.updatedState)
        )
    }
}
