import { assertExists } from '../../util/assertions.js'
import { BranchMergeError, type UnmergedBranch } from './branch.js'
import { combineCascades, type ActionCascadeResult, type GameEngine } from './gameEngine.js'
import {
    isRestingInSpan,
    restingSpan,
    sameHistoryPosition,
    unmergedPlayerIds
} from './parallelSpan.js'
import type { GameAction } from './gameAction.js'
import type { Game, SpanHold } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export interface SpanSettlement<T extends GameState = GameState> extends ActionCascadeResult<T> {
    readonly createdBranches: UnmergedBranch[]
    readonly mergedPlayerIds: string[]
    readonly refusal?: SpanHold
}

export function settleSpan<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    unmergedBranches,
    held = false
}: {
    engine: GameEngine<T, U>
    game: Game
    state: T
    unmergedBranches: readonly UnmergedBranch[]
    held?: boolean
}): SpanSettlement<T> {
    const steps: ActionCascadeResult<T>[] = []
    const created: UnmergedBranch[] = []
    const mergedPlayerIds: string[] = []
    let known = new Map(unmergedBranches.map((record) => [record.branch.playerId, record]))
    let current = state
    let refusal: SpanHold | undefined

    while (isRestingInSpan(current) && refusal === undefined) {
        const span = restingSpan(current)
        const unmerged = unmergedPlayerIds(span)
        known = new Map(
            [...known].filter(([, record]) =>
                sameHistoryPosition(record.branch.branchPoint, span.branchPoint)
            )
        )
        for (const playerId of unmerged) {
            if (known.has(playerId)) continue
            const started = engine.createBranch({ state: current, game, playerId })
            const record = { branch: started.branch, actions: started.processedActions }
            known.set(playerId, record)
            created.push(record)
        }
        if (held) break

        if (unmerged.length === 0) {
            const completed = engine.completeSpan({ state: current, game })
            steps.push(completed)
            current = completed.updatedState
            continue
        }

        const ready = engine.branchesReadyToMerge({
            state: current,
            closedPlayerIds: unmerged.filter((playerId) => known.get(playerId)?.branch.closed)
        })
        if (ready.length === 0) break
        for (const playerId of ready) {
            const record = known.get(playerId)
            assertExists(record, `The Branch of ${playerId} is ready to merge but unknown`)
            try {
                const merged = engine.mergeBranch({ state: current, game, ...record })
                steps.push(merged)
                current = merged.updatedState
                mergedPlayerIds.push(playerId)
                known.delete(playerId)
            } catch (error) {
                if (!(error instanceof BranchMergeError)) throw error
                refusal = { playerId, reason: error.message }
                break
            }
        }
    }

    return {
        ...combineCascades(state, steps),
        createdBranches: created.filter((record) => known.get(record.branch.playerId) === record),
        mergedPlayerIds,
        ...(refusal === undefined ? {} : { refusal })
    }
}

export function reverseToBranchStart<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    history
}: {
    engine: GameEngine<T, U>
    state: T
    history: readonly GameAction[]
}): { state: T; reversed: GameAction[] } | undefined {
    const remaining = [...history]
    const reversed: GameAction[] = []
    let current = state
    while (current.parallelSpan?.branchPlayerId !== undefined) {
        const action = remaining.pop()
        if (action === undefined) return undefined
        current = engine.undoProcessedAction({ action, state: current })
        reversed.unshift(action)
    }
    return { state: current, reversed }
}
