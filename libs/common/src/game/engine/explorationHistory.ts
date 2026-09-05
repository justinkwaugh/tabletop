import jsonpatch from 'fast-json-patch'
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
            checkpoint: {
                source: this.snapshot(source),
                hypothetical: this.snapshot(hypothetical),
                undoLimit: this.findUndoLimit(hypothetical, actions, game)
            }
        }
    }

    recordedState(state: T, exploration?: ExplorationState): T {
        const checkpoint = exploration?.checkpoint
        return checkpoint && state.actionCount === exploration.actionCount
            ? this.restore(state, checkpoint.source)
            : state
    }

    backward(state: T, action: GameAction, exploration?: ExplorationState): T {
        const before = this.recordedState(state, exploration)
        const result = this.engine.undoProcessedAction({ state: before, action })
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
        let source = this.restore(before, checkpoint.source)
        for (const action of removed.toReversed()) {
            if (action.index !== undefined && action.index < exploration.actionCount) {
                source = this.engine.undoProcessedAction({ state: source, action })
            }
        }
        after.explorationState = {
            actionCount: after.actionCount,
            invocations: after.prng.invocations,
            checkpoint: {
                source: this.snapshot(source),
                hypothetical: this.snapshot(after),
                undoLimit: checkpoint.undoLimit
            }
        }
        return after
    }

    private snapshot(state: T): Patch {
        const value = structuredClone(state)
        delete value.explorationState
        return [{ op: 'replace', path: '', value }]
    }

    private restore(state: T, patch: Patch): T {
        return jsonpatch.applyPatch(structuredClone(state), patch).newDocument
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
                const replay = this.engine.executeAction({ action, state: before, game })
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
