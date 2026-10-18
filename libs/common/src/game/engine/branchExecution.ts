import * as Value from 'typebox/value'
import { assert } from '../../util/assertions.js'
import { sameRun } from './actionReplay.js'
import {
    branchFromView,
    branchUndoWindow,
    branchView,
    unopenedBranchView,
    type Branch
} from './branch.js'
import type { ActionCascadeResult, GameEngine, MainLine } from './gameEngine.js'
import type { GameAction } from './gameAction.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export interface BranchExecution<T extends GameState = GameState> {
    readonly branch: Branch
    readonly processedActions: GameAction[]
    readonly view: T
}

function branchExecution<T extends GameState>(
    state: T,
    executed: ActionCascadeResult<T>,
    playerId: string
): BranchExecution<T> {
    return {
        branch: branchFromView(state, executed.updatedState, playerId),
        processedActions: executed.processedActions,
        view: executed.updatedState
    }
}

// Whether two executions of a Branch Action reached the same Branch by the same run, as when
// the same Action is worked out over two Main Line positions that differ only in what the
// Branch does not read.
export function sameBranchExecution(left: BranchExecution, right: BranchExecution): boolean {
    return (
        sameRun(left.processedActions, right.processedActions) &&
        left.branch.actionCount === right.branch.actionCount &&
        left.branch.actionChecksum === right.branch.actionChecksum &&
        left.branch.machineState === right.branch.machineState &&
        left.branch.closed === right.branch.closed &&
        Value.Equal(left.branch.change, right.branch.change)
    )
}

export function createBranch<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    game,
    playerId
}: MainLine<T, U> & { playerId: string }): BranchExecution<T> {
    const started = engine.startBranch({
        state: unopenedBranchView(state, playerId),
        game,
        playerId
    })
    return branchExecution(state, started, playerId)
}

export function executeBranchAction<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    branch,
    action,
    game
}: MainLine<T, U> & { branch: Branch; action: GameAction }): BranchExecution<T> {
    assert(!branch.closed, `The Branch of ${branch.playerId} is closed`)
    const executed = engine.executeCanonicalAction({
        action,
        state: branchView(state, branch),
        game
    })
    return branchExecution(state, executed, branch.playerId)
}

export function undoBranchAction<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    state,
    branch,
    actions,
    actionId,
    asAdministrator = false
}: {
    engine: GameEngine<T, U>
    state: T
    branch: Branch
    actions: readonly GameAction[]
    actionId: string
    asAdministrator?: boolean
}): { branch: Branch; undoneActions: GameAction[] } {
    const playerId = branch.playerId
    const undoneActions = branchUndoWindow(playerId, actions, actionId, asAdministrator)
    assert(
        undoneActions.at(-1)?.index === branch.actionCount - 1,
        'The recorded Actions do not end where the Branch does'
    )
    let view = branchView(state, branch)
    for (const action of undoneActions.toReversed()) {
        view = engine.undoProcessedAction({ action, state: view })
    }
    return { branch: branchFromView(state, view, playerId), undoneActions }
}
