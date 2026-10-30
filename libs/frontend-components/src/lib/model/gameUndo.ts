import {
    assertExists,
    calculateActionChecksum,
    createPatch,
    ExplorationHistory,
    isOutOfTurnDeclaration,
    type GameAction,
    type GameState,
    type HydratedGameState,
    Visibility
} from '@tabletop/common'
import { GameActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'

export class GameUndo<T extends GameState, U extends HydratedGameState<T> & T> {
    constructor(private readonly context: GameContext<T, U>) {}

    preview(target: GameAction, perspective?: Visibility.Perspective): GameContext<T, U> {
        const result = this.context.clone()
        const undone: GameAction[] = []
        let action: GameAction
        do {
            const last = result.popAction()
            assertExists(last, 'Undo target is not in Action History')
            action = last
            undone.unshift(action)
        } while (action.id !== target.id)

        const { state, redo } = new ExplorationHistory(result.engine).undoThrough(
            result.state,
            undone
        )
        if (perspective === undefined) result.engine.validateCanonicalState(state)
        result.updateGameState(state)
        for (const action of redo) this.redo(result, action, perspective)
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
        action.index = context.nextActionIndex
        delete action.undoPatch
        const state = context.state
        const declaration = isOutOfTurnDeclaration(action) && !Visibility.isRedactedAction(action)
        if (perspective !== undefined && action.forwardPatch !== undefined && !declaration) {
            const updatedState = context.engine.applyProcessedAction({
                action,
                state,
                game: context.game
            })
            updatedState.actionCount = action.index + 1
            updatedState.actionChecksum = calculateActionChecksum(state.actionChecksum, [action])
            action.undoPatch = createPatch(updatedState, state)
            action.forwardPatch = createPatch(state, updatedState)
            context.applyActionResults(new GameActionResults([action], updatedState))
            return
        }
        delete action.forwardPatch
        const target = { action, state, game: context.game, perspective }
        const result = declaration
            ? context.engine.reapplyDeclaration(target)
            : context.engine.execute(target)
        if (!result) return
        context.applyActionResults(
            new GameActionResults(result.processedActions, result.updatedState)
        )
    }
}
