import { assertExists } from '../../util/assertions.js'
import { belongsToSpan, BranchMergeError, type Branch, type UnmergedBranch } from './branch.js'
import { combineCascades, type ActionCascadeResult, type GameEngine } from './gameEngine.js'
import { isRestingInSpan, restingSpan, unmergedPlayerIds } from './parallelSpan.js'
import type { GameAction } from './gameAction.js'
import type { Game, SpanHold } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export interface SpanSettlement<T extends GameState = GameState> extends ActionCascadeResult<T> {
    readonly createdBranches: UnmergedBranch[]
    readonly mergedPlayerIds: string[]
    readonly refusal?: SpanHold
}

export function siteActivePlayerIds(state: GameState, branches: readonly Branch[]): string[] {
    if (!isRestingInSpan(state)) return state.activePlayerIds
    const span = restingSpan(state)
    const closedPlayerIds = branches
        .filter((branch) => branch.closed && belongsToSpan(branch, span))
        .map((branch) => branch.playerId)
    return unmergedPlayerIds(span).filter((playerId) => !closedPlayerIds.includes(playerId))
}

export function createMissingBranches<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    unmergedBranches
}: {
    engine: GameEngine<T, U>
    game: Game
    state: T
    unmergedBranches: readonly UnmergedBranch[]
}): UnmergedBranch[] {
    if (!isRestingInSpan(state)) return []
    const span = restingSpan(state)
    const held = unmergedBranches
        .filter(({ branch }) => belongsToSpan(branch, span))
        .map(({ branch }) => branch.playerId)
    return unmergedPlayerIds(span)
        .filter((playerId) => !held.includes(playerId))
        .map((playerId) => {
            const started = engine.createBranch({ state, game, playerId })
            return { branch: started.branch, actions: started.processedActions }
        })
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
        known = new Map([...known].filter(([, record]) => belongsToSpan(record.branch, span)))
        for (const record of createMissingBranches({
            engine,
            game,
            state: current,
            unmergedBranches: [...known.values()]
        })) {
            known.set(record.branch.playerId, record)
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
