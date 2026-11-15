import {
    assertExists,
    calculateActionChecksum,
    createPatch,
    ExplorationHistory,
    isBranchClose,
    isOutOfTurnDeclaration,
    restingSpan,
    spanRuns,
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

    /**
     * Previews taking a Common Action out of the Main Line during a Parallel Span: its run comes
     * off and the Branch Closes and Merges that followed are put back in place, as the host does
     * (Common Actions rule 9).
     */
    previewOutsideBranches(
        target: GameAction,
        perspective?: Visibility.Perspective
    ): GameContext<T, U> {
        const result = this.context.clone()
        const span = restingSpan(result.state)
        const history = new ExplorationHistory(result.engine)
        const removed: GameAction[] = []
        let state = result.state
        let action: GameAction
        do {
            const last = result.popAction()
            assertExists(last, 'Undo target is not in Action History')
            action = last
            removed.unshift(action)
            state = history.undo(state, action, this.context.state.explorationState)
        } while (action.id !== target.id)

        state = history.afterUndo(this.context.state, state, removed)
        if (perspective === undefined) result.engine.validateCanonicalState(state)
        result.updateGameState(state)
        const run = spanRuns(removed, span)[0]
        for (const later of removed.slice(run.length)) this.redo(result, later, perspective)
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
        // A Branch Close is the engine's own and is always applied as recorded; a projected
        // Action is applied by its forward patch, since it cannot be executed again, unless it is a
        // declaration, which is reapplied.
        const declaration = isOutOfTurnDeclaration(action) && !Visibility.isRedactedAction(action)
        if (
            isBranchClose(action) ||
            (perspective !== undefined && action.forwardPatch !== undefined && !declaration)
        ) {
            const hadForwardPatch = action.forwardPatch !== undefined
            const updatedState = context.engine.applyProcessedAction({
                action,
                state,
                game: context.game
            })
            updatedState.actionCount = action.index + 1
            updatedState.actionChecksum = calculateActionChecksum(state.actionChecksum, [action])
            action.undoPatch = createPatch(updatedState, state)
            if (hadForwardPatch) action.forwardPatch = createPatch(state, updatedState)
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
