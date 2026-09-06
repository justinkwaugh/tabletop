import jsonpatch from 'fast-json-patch'
import { assert } from '../../util/assertions.js'
import { ActionSource, type GameAction, type Patch } from './gameAction.js'
import type { GameEngine } from './gameEngine.js'
import type { Game } from '../model/game.js'
import type { ExplorationState, GameState, HydratedGameState } from '../model/gameState.js'
import { isRedactedAction } from '../visibility/actionProjector.js'

export class ExplorationHistory<T extends GameState, U extends HydratedGameState<T>> {
    constructor(private readonly engine: GameEngine<T, U>) {}

    checkpoint(
        source: T,
        hypothetical: T,
        actions: readonly GameAction[],
        game: Game
    ): ExplorationState {
        return {
            actionCount: hypothetical.actionCount,
            invocations: hypothetical.prng.invocations,
            checkpoint: this.createBoundary(
                source,
                hypothetical,
                this.findUndoLimit(hypothetical, actions, game)
            )
        }
    }

    recordedState(state: T, exploration?: ExplorationState): T {
        const checkpoint = exploration?.checkpoint
        return checkpoint && state.actionCount === exploration.actionCount
            ? this.restore(state, checkpoint.source)
            : state
    }

    backward(state: T, action: GameAction, exploration?: ExplorationState): T {
        const result = this.engine.undoProcessedAction({ state, action })
        return this.recordedState(result, exploration)
    }

    forward(state: T, action: GameAction, game: Game, exploration?: ExplorationState): T {
        const checkpoint = exploration?.checkpoint
        const before =
            checkpoint && state.actionCount === exploration.actionCount
                ? this.restore(state, checkpoint.hypothetical)
                : state
        return this.engine.applyProcessedAction({ state: before, action, game })
    }

    afterUndo(before: T, after: T, removed: readonly GameAction[]): T {
        const exploration = before.explorationState
        const checkpoint = exploration?.checkpoint
        if (!checkpoint || after.actionCount >= exploration.actionCount) return after
        let boundary = before
        for (const action of removed.toReversed()) {
            if (action.index !== undefined && action.index >= exploration.actionCount) {
                boundary = this.engine.undoProcessedAction({ state: boundary, action })
            }
        }
        assert(
            boundary.actionCount === exploration.actionCount,
            'Undo must reconstruct the Exploration boundary'
        )
        let source = this.restore(boundary, checkpoint.source)
        for (const action of removed.toReversed()) {
            if (action.index !== undefined && action.index < exploration.actionCount) {
                source = this.engine.undoProcessedAction({ state: source, action })
            }
        }
        after.explorationState = {
            actionCount: after.actionCount,
            invocations: after.prng.invocations,
            checkpoint: this.createBoundary(source, after, checkpoint.undoLimit)
        }
        return after
    }

    private createBoundary(
        source: T,
        hypothetical: T,
        undoLimit: number
    ): NonNullable<ExplorationState['checkpoint']> {
        const recorded = this.withoutExploration(source)
        const sampled = this.withoutExploration(hypothetical)
        return {
            source: jsonpatch.compare(sampled, recorded),
            hypothetical: jsonpatch.compare(recorded, sampled),
            undoLimit
        }
    }

    private withoutExploration(state: T): T {
        const value = structuredClone(state)
        delete value.explorationState
        return value
    }

    private restore(state: T, patch: Patch): T {
        return jsonpatch.applyPatch(this.withoutExploration(state), patch).newDocument
    }

    private findUndoLimit(state: T, actions: readonly GameAction[], game: Game): number {
        let after = structuredClone(state)
        let groupEnd = actions.length
        let unsafe = false
        for (let index = actions.length - 1; index >= 0; index--) {
            const action = actions[index]
            unsafe ||=
                action.forwardPatch !== undefined ||
                !!action.skipOptimisticExecution ||
                !!action.revealsInfo ||
                isRedactedAction(action)
            if (action.source !== ActionSource.User) continue
            if (unsafe) return groupEnd
            try {
                let before = structuredClone(after)
                for (const record of actions.slice(index, groupEnd).toReversed()) {
                    before = this.engine.undoProcessedAction({ action: record, state: before })
                }
                const replay = this.engine.executeCanonicalAction({ action, state: before, game })
                if (
                    jsonpatch.compare(after, replay.updatedState).length !== 0 ||
                    replay.processedActions.length !== groupEnd - index ||
                    replay.processedActions.some(
                        (record, offset) => record.id !== actions[index + offset].id
                    )
                ) {
                    return groupEnd
                }
                after = before
            } catch {
                return groupEnd
            }
            groupEnd = index
            unsafe = false
        }
        return groupEnd
    }
}
