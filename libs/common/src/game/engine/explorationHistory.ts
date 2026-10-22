import { recordedSource } from './recordedHistory.js'
import jsonpatch from 'fast-json-patch'
import { deriveGameSeeds, generateMasterSeed } from '../../util/gameSeeds.js'
import { generateSeed } from '../../util/prng.js'
import { assert, assertExists } from '../../util/assertions.js'
import { ActionSource, type GameAction, type Patch } from './gameAction.js'
import type { GameEngine } from './gameEngine.js'
import type { Game } from '../model/game.js'
import type { ExplorationState, GameState, HydratedGameState } from '../model/gameState.js'
import { isRedactedAction } from '../visibility/actionProjector.js'
import { isOutOfTurnDeclaration } from './actionHistory.js'
import { isSameSimultaneousGroup } from './playerUndo.js'

export class ExplorationHistory<T extends GameState, U extends HydratedGameState<T>> {
    constructor(private readonly engine: GameEngine<T, U>) {}

    checkpoint(
        source: T,
        hypothetical: T,
        actions: readonly GameAction[],
        game: Game,
        sourceRepresentation: 'canonical' | 'projected' = 'projected'
    ): ExplorationState {
        return {
            actionCount: hypothetical.actionCount,
            invocations: hypothetical.prng.invocations,
            checkpoint: this.createBoundary(
                source,
                hypothetical,
                sourceRepresentation === 'canonical'
                    ? (source.explorationState?.checkpoint?.undoLimit ?? 0)
                    : this.findUndoLimit(hypothetical, actions, game),
                sourceRepresentation === 'canonical' ? true : undefined
            )
        }
    }

    prepareState(source: T): T {
        const state = this.withoutExploration(source)
        delete state.masterSeed
        state.prng = { seed: generateSeed(), invocations: 0 }
        if ((state.systemVersion ?? 1) >= 3) {
            state.protectedPrng =
                this.engine.runtime.randomnessVersion === 1
                    ? {
                          algorithm: 'chacha20-v1',
                          seed: deriveGameSeeds(generateMasterSeed()).protectedSeed,
                          invocations: 0
                      }
                    : { seed: generateSeed(), invocations: 0 }
        }
        return state
    }

    undo(state: T, action: GameAction, exploration?: ExplorationState): T {
        const before = exploration?.checkpoint?.canonicalSource
            ? this.recordedState(state, exploration)
            : state
        return this.engine.undoProcessedAction({ state: before, action })
    }

    recordedState(state: T, exploration?: ExplorationState): T {
        return recordedSource(state, exploration)
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

    undoThrough(current: T, undone: readonly GameAction[]): { state: T; redo: GameAction[] } {
        const target = undone[0]
        assertExists(target, 'Undo needs a target Action')
        const exploration = current.explorationState
        let state = current
        const redo: GameAction[] = []
        for (const action of undone.toReversed()) {
            if (this.redoesAfterUndo(action, target, exploration)) redo.unshift(action)
            state = this.undo(state, action, exploration)
        }
        return { state: this.afterUndo(current, state, undone), redo }
    }

    afterUndo(before: T, after: T, removed: readonly GameAction[]): T {
        const exploration = before.explorationState
        const checkpoint = exploration?.checkpoint
        if (!checkpoint || after.actionCount >= exploration.actionCount) return after
        if (checkpoint.canonicalSource) {
            const prepared = this.prepareState(after)
            const hypothetical = this.engine.runtime.exploration
                ? this.engine.runtime.exploration.createFromCanonicalState(prepared)
                : prepared
            hypothetical.explorationState = {
                actionCount: hypothetical.actionCount,
                invocations: hypothetical.prng.invocations,
                checkpoint: this.createBoundary(after, hypothetical, checkpoint.undoLimit, true)
            }
            return hypothetical
        }
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
            if (this.recordedBeforeExploration(action, exploration)) {
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

    private redoesAfterUndo(
        action: GameAction,
        target: GameAction,
        exploration?: ExplorationState
    ): boolean {
        if (
            action.playerId !== undefined &&
            action.playerId !== target.playerId &&
            isSameSimultaneousGroup(action, target)
        )
            return true
        if (!isOutOfTurnDeclaration(action) || action.id === target.id) return false
        if (!this.recordedBeforeExploration(action, exploration)) return true
        return this.engine.runtime.exploration?.keepsSourceDeclaration?.(action) ?? true
    }

    private recordedBeforeExploration(action: GameAction, exploration?: ExplorationState) {
        return (
            exploration !== undefined &&
            action.index !== undefined &&
            action.index < exploration.actionCount
        )
    }

    private createBoundary(
        source: T,
        hypothetical: T,
        undoLimit: number,
        canonicalSource?: true
    ): NonNullable<ExplorationState['checkpoint']> {
        const recorded = this.withoutExploration(source)
        const sampled = this.withoutExploration(hypothetical)
        return {
            source: jsonpatch.compare(sampled, recorded),
            hypothetical: jsonpatch.compare(recorded, sampled),
            undoLimit,
            ...(canonicalSource ? { canonicalSource } : {})
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
            unsafe ||= isRedactedAction(action)
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
