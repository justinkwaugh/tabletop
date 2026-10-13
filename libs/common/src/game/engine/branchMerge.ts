import { assert, assertExists } from '../../util/assertions.js'
import { errorMessage } from '../../util/errors.js'
import { runs, sameRun, unprocessed } from './actionReplay.js'
import {
    branchView,
    BranchMergeError,
    firstActionWithAnotherResult,
    sameBranchOutcome,
    type Branch
} from './branch.js'
import { combineCascades, type ActionCascadeResult, type MainLine } from './gameEngine.js'
import type { GameAction } from './gameAction.js'
import { isBranchClose, restingSpan, spanRuns, unmergedPlayerIds } from './parallelSpan.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

function replayOnMainLine<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    game,
    playerId,
    recorded
}: MainLine<T, U> & {
    playerId: string
    recorded: readonly GameAction[]
}): ActionCascadeResult<T> {
    const first = recorded[0]
    let replayed: ActionCascadeResult<T>
    try {
        replayed = engine.executeCanonicalAction({ action: unprocessed(first), state, game })
    } catch (error) {
        throw new BranchMergeError(
            playerId,
            `${first.type} failed on the Main Line: ${errorMessage(error)}`
        )
    }
    const sameIdentities = recorded.every(
        (action, index) => action.id === replayed.processedActions.at(index)?.id
    )
    if (!sameRun(recorded, replayed.processedActions) || !sameIdentities)
        throw new BranchMergeError(playerId, `${first.type} ran differently on the Main Line`)
    return replayed
}

export function replayOnSpan<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    game,
    recorded
}: MainLine<T, U> & { recorded: readonly GameAction[] }): ActionCascadeResult<T> {
    const steps: ActionCascadeResult<T>[] = []
    let current = state
    for (const run of spanRuns(recorded, restingSpan(state))) {
        const playerId = run[0].playerId
        assertExists(playerId, 'Every step of a span belongs to a Player')
        const step = isBranchClose(run[0])
            ? engine.closeBranch({ state: current, playerId })
            : replayOnMainLine({ engine, state: current, game, playerId, recorded: run })
        steps.push(step)
        current = step.updatedState
    }
    return combineCascades(state, steps)
}

export function mergeBranch<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    game,
    branch,
    actions
}: MainLine<T, U> & {
    branch: Branch
    actions: readonly GameAction[]
}): ActionCascadeResult<T> {
    const playerId = branch.playerId
    assert(branch.closed, `The Branch of ${playerId} is still open`)
    const span = restingSpan(state)
    assert(
        span.closedPlayerIds.includes(playerId),
        `The Branch of ${playerId} has no Branch Close on the Main Line`
    )
    assert(
        unmergedPlayerIds(span).at(0) === playerId,
        `The Branch of ${playerId} is not next in Merge Order`
    )
    const expected = branchView(state, branch)
    const recordedRuns = runs(actions)
    if (recordedRuns.at(0)?.at(0)?.id !== span.branchStartIds[playerId])
        throw new BranchMergeError(playerId, 'its record does not begin with its Branch Start')

    const steps: ActionCascadeResult<T>[] = []
    let current = state
    for (const recorded of recordedRuns) {
        const replayed = replayOnMainLine({ engine, state: current, game, playerId, recorded })
        steps.push(replayed)
        current = replayed.updatedState
    }
    if (!sameBranchOutcome(current, expected))
        throw new BranchMergeError(playerId, 'it reached a different Game State on the Main Line')
    const merged = combineCascades(state, steps)
    const changed = firstActionWithAnotherResult({
        closedView: expected,
        recorded: actions,
        replayed: merged.actionCascade.transitions.map((transition) => transition.after)
    })
    if (changed !== undefined)
        throw new BranchMergeError(
            playerId,
            `${changed.type} had a different result on the Main Line`
        )
    return merged
}
