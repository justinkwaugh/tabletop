import * as Value from 'typebox/value'
import { assert, assertExists } from '../../util/assertions.js'
import { errorMessage } from '../../util/errors.js'
import { isCommonAction } from './actionHistory.js'
import { runs, sameRun, unprocessed } from './actionReplay.js'
import {
    branchView,
    firstActionWithAnotherResult,
    withoutEngineMaintainedFields,
    type Branch,
    type UnmergedBranch
} from './branch.js'
import { replayOnMainLine, replayOnSpan } from './branchMerge.js'
import { withoutActionPositions, type CommutationOutcome } from './commutation.js'
import type { ActionCascadeResult, MainLine } from './gameEngine.js'
import type { GameAction } from './gameAction.js'
import {
    isBranchClose,
    isRestingInSpan,
    restingSpan,
    sameHistoryPosition,
    spanRuns
} from './parallelSpan.js'
import { createPatch } from './statePatch.js'
import type { GameState, HydratedGameState, ParallelSpanState } from '../model/gameState.js'
import type { Perspective } from '../visibility/valueProjector.js'

// The Game Client checks a Player's own side on the states it holds, which are projected for
// that Player, so it executes with their perspective; the host executes canonically.
function executeFrom<T extends GameState, U extends HydratedGameState<T>>(
    { engine, game, state }: MainLine<T, U>,
    action: GameAction,
    perspective: Perspective | undefined
): ActionCascadeResult<T> {
    return perspective === undefined
        ? engine.executeCanonicalAction({ action, state, game })
        : engine.executeAction({ action, state, game, perspective })
}

function sinceBranchPoint(actions: readonly GameAction[], span: ParallelSpanState): GameAction[] {
    return actions.filter((action) => {
        assertExists(action.index, 'A Main Line Action has its index')
        return action.index >= span.branchPoint.actionCount
    })
}

export function latestCommonActionUndoTarget(
    actions: readonly GameAction[],
    span: ParallelSpanState,
    playerId: string
): GameAction | undefined {
    for (const run of spanRuns(sinceBranchPoint(actions, span), span).toReversed()) {
        const first = run[0]
        if (!isCommonAction(first)) continue
        if (first.playerId !== playerId) return undefined
        return run.some((action) => action.revealsInfo) ? undefined : first
    }
    return undefined
}

export function removeCommonAction<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    history,
    actionId
}: MainLine<T, U> & { history: readonly GameAction[]; actionId: string }): {
    state: T
    removed: GameAction[]
    replayed: GameAction[]
} {
    const span = restingSpan(state)
    const position = history.findIndex((action) => action.id === actionId)
    assert(
        position >= 0 && isCommonAction(history[position]),
        'The Action is not a Common Action on the Main Line'
    )
    const removed = history.slice(position)
    const run = spanRuns(removed, span)[0]
    let earlier = state
    for (const action of removed.toReversed()) {
        earlier = engine.undoProcessedAction({ action, state: earlier })
    }
    const replayed = replayOnSpan({
        engine,
        state: earlier,
        game,
        recorded: removed.slice(run.length)
    })
    return { state: replayed.updatedState, removed, replayed: replayed.processedActions }
}

export function executeInBranchView<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    branch,
    action,
    perspective
}: MainLine<T, U> & {
    branch: Branch
    action: GameAction
    perspective?: Perspective
}): ActionCascadeResult<T> {
    return executeFrom(
        { engine, game, state: branchView(state, branch) },
        unprocessed(action),
        perspective
    )
}

export type CommonActionOutcome<T extends GameState> =
    { kind: 'executed'; result: ActionCascadeResult<T> } | { kind: 'refused'; reason: string }

export function executeCommonAction<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    action,
    branch,
    perspective
}: MainLine<T, U> & {
    action: GameAction
    branch?: Branch
    perspective?: Perspective
}): CommonActionOutcome<T> {
    const mainLine = { engine, game, state }
    if (branch === undefined) {
        return { kind: 'executed', result: executeFrom(mainLine, action, perspective) }
    }
    let inBranchView: ActionCascadeResult<T>
    try {
        inBranchView = executeInBranchView({ ...mainLine, branch, action, perspective })
    } catch (error) {
        return { kind: 'refused', reason: `it is not valid in your Branch: ${errorMessage(error)}` }
    }
    const result = executeFrom(mainLine, action, perspective)
    return sameRun(inBranchView.processedActions, result.processedActions)
        ? { kind: 'executed', result }
        : { kind: 'refused', reason: 'it runs differently in your Branch than on the Main Line' }
}

function changesOutsideEngineFields<T extends GameState>(execution: ActionCascadeResult<T>) {
    return createPatch(
        withoutEngineMaintainedFields(execution.actionCascade.before),
        withoutEngineMaintainedFields(execution.updatedState)
    )
}

function replayRacedRuns<T extends GameState, U extends HydratedGameState<T>>(
    { engine, game, state }: MainLine<T, U>,
    raced: readonly GameAction[]
): T | undefined {
    let current = state
    for (const run of spanRuns(raced, restingSpan(state))) {
        const first = run[0]
        const playerId = first.playerId
        assertExists(playerId, 'Every step of a span belongs to a Player')
        const step = isBranchClose(first)
            ? engine.closeBranch({ state: current, playerId })
            : engine.executeCanonicalAction({ action: unprocessed(first), state: current, game })
        if (!sameRun(run, step.processedActions)) return undefined
        current = step.updatedState
    }
    return current
}

export function settleCommonActionRace<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    raced,
    late
}: MainLine<T, U> & { raced: readonly GameAction[]; late: GameAction }): CommutationOutcome {
    const invalid = (reason: string): CommutationOutcome => ({ kind: 'invalid', reason })
    if (!isRestingInSpan(state)) return invalid('the span has completed')
    if (raced.some((action) => action.undoPatch === undefined))
        return invalid('the raced Actions cannot be reversed')
    let earlier = state
    for (const action of raced.toReversed()) {
        earlier = engine.undoProcessedAction({ action, state: earlier })
    }
    if (
        !isRestingInSpan(earlier) ||
        !sameHistoryPosition(restingSpan(earlier).branchPoint, restingSpan(state).branchPoint)
    )
        return invalid('the span has completed')
    const racedCommonRuns = spanRuns(raced, restingSpan(state)).filter((run) =>
        isCommonAction(run[0])
    )
    try {
        const lateFirst = engine.executeCanonicalAction({
            action: unprocessed(late),
            state: earlier,
            game
        })
        const afterRaced = engine.executeCanonicalAction({
            action: unprocessed(late),
            state,
            game
        })
        if (!sameRun(lateFirst.processedActions, afterRaced.processedActions))
            return invalid('its consequences depend on the order')
        if (racedCommonRuns.length === 0) {
            return Value.Equal(
                changesOutsideEngineFields(lateFirst),
                changesOutsideEngineFields(afterRaced)
            )
                ? { kind: 'commutes' }
                : invalid('it makes different changes after the Branch Closes and Merges it raced')
        }
        if (
            [...afterRaced.processedActions, ...racedCommonRuns.flat()].some(
                (action) => action.revealsInfo
            )
        )
            return invalid('an involved Action reveals information')
        if (racedCommonRuns.some((run) => run[0].playerId === late.playerId))
            return invalid('the Player already acted since that position')
        const replayed = replayRacedRuns({ engine, game, state: lateFirst.updatedState }, raced)
        if (replayed === undefined)
            return invalid('a raced Action’s consequences depend on the order')
        if (
            !Value.Equal(
                withoutActionPositions(afterRaced.updatedState),
                withoutActionPositions(replayed)
            )
        )
            return invalid('the orders reach different Game States')
        return { kind: 'commutes' }
    } catch (error) {
        return invalid(errorMessage(error))
    }
}

export function findBranchThatWouldNotReplay<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    unmergedBranches
}: MainLine<T, U> & { unmergedBranches: readonly UnmergedBranch[] }):
    { playerId: string; reason: string } | undefined {
    for (const { branch, actions } of unmergedBranches) {
        const playerId = branch.playerId
        try {
            const expected = branchView(state, branch)
            const replayed: T[] = []
            let current = state
            for (const recorded of runs(actions)) {
                const step = replayOnMainLine({ engine, state: current, game, playerId, recorded })
                replayed.push(
                    ...step.actionCascade.transitions.map((transition) => transition.after)
                )
                current = step.updatedState
            }
            const changed = firstActionWithAnotherResult({
                closedView: expected,
                recorded: actions,
                replayed
            })
            if (changed !== undefined)
                return { playerId, reason: `${changed.type} would have a different result` }
        } catch (error) {
            return { playerId, reason: errorMessage(error) }
        }
    }
    return undefined
}
