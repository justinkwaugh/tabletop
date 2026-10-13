import * as Type from 'typebox'
import * as Value from 'typebox/value'
import jsonpatch from 'fast-json-patch'
import { assert, assertExists } from '../../util/assertions.js'
import { BaseError } from '../../util/errors.js'
import { ActionSource, GameAction, Patch } from './gameAction.js'
import { ENGINE_MAINTAINED_FIELDS } from './branchScope.js'
import { withoutActionPositions } from './commutation.js'
import {
    sameHistoryPosition,
    spanAwaitingBranch,
    spanActivePlayerIds,
    unmergedPlayerIds
} from './parallelSpan.js'
import { undoRecordedAction } from './recordedHistory.js'
import { createPatch } from './statePatch.js'
import { BranchPoint, type GameState, type ParallelSpanState } from '../model/gameState.js'

export type Branch = Type.Static<typeof Branch>
export const Branch = Type.Object({
    playerId: Type.String(),
    branchPoint: BranchPoint,
    machineState: Type.String(),
    actionCount: Type.Number(),
    actionChecksum: Type.Number(),
    closed: Type.Boolean(),
    change: Patch
})

export type UnmergedBranch = Type.Static<typeof UnmergedBranch>
export const UnmergedBranch = Type.Object({
    branch: Branch,
    actions: Type.Array(GameAction)
})

export class BranchMergeError extends BaseError {
    constructor(playerId: string, reason: string) {
        super({
            name: 'BranchMergeError',
            message: `The Branch of ${playerId} cannot be merged: ${reason}`,
            metadata: { playerId, reason }
        })
    }
}

export class BranchUndoError extends BaseError {
    constructor(playerId: string, reason: string) {
        super({
            name: 'BranchUndoError',
            message: `Undo refused in the Branch of ${playerId}: ${reason}`,
            metadata: { playerId, reason }
        })
    }
}

function withoutEngineMaintainedFields(state: object): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(state).filter(([field]) => !ENGINE_MAINTAINED_FIELDS.has(field))
    )
}

export function unopenedBranchView<T extends GameState>(state: T, playerId: string): T {
    spanAwaitingBranch(state, playerId)
    return { ...structuredClone(state), actionCount: 0, actionChecksum: 0 }
}

export function belongsToSpan(branch: Branch, span: ParallelSpanState): boolean {
    return sameHistoryPosition(branch.branchPoint, span.branchPoint)
}

function viewOver<T extends GameState>(state: T, span: ParallelSpanState, branch: Branch): T {
    assert(
        belongsToSpan(branch, span),
        `The Branch of ${branch.playerId} belongs to another Parallel Span`
    )
    const changed = jsonpatch.applyPatch(
        structuredClone(state),
        structuredClone(branch.change)
    ).newDocument
    const { branchPlayerId: _mainLineBranchPlayerId, ...mainLineSpan } = structuredClone(span)
    const viewed = {
        ...mainLineSpan,
        mergedPlayerIds: branch.closed
            ? [...span.mergedPlayerIds, branch.playerId]
            : [...span.mergedPlayerIds],
        ...(branch.closed ? {} : { branchPlayerId: branch.playerId })
    }
    return {
        ...changed,
        machineState: branch.machineState,
        activePlayerIds: spanActivePlayerIds(viewed),
        actionCount: branch.actionCount,
        actionChecksum: branch.actionChecksum,
        parallelSpan: viewed
    }
}

export function branchView<T extends GameState>(state: T, branch: Branch): T {
    return viewOver(state, spanAwaitingBranch(state, branch.playerId), branch)
}

export function branchViewDuringMerge<T extends GameState>(state: T, branch: Branch): T {
    const span = state.parallelSpan
    assertExists(span, 'No Parallel Span is in progress')
    assert(
        unmergedPlayerIds(span).includes(branch.playerId) &&
            span.branchPlayerId !== branch.playerId,
        `The Branch of ${branch.playerId} is already on the Main Line`
    )
    return viewOver(state, span, branch)
}

export function branchFromView(state: GameState, view: GameState, playerId: string): Branch {
    const span = spanAwaitingBranch(state, playerId)
    return {
        playerId,
        branchPoint: structuredClone(span.branchPoint),
        machineState: view.machineState,
        actionCount: view.actionCount,
        actionChecksum: view.actionChecksum,
        closed: view.parallelSpan?.branchPlayerId === undefined,
        change: createPatch(
            withoutEngineMaintainedFields(state),
            withoutEngineMaintainedFields(view)
        )
    }
}

export function branchUndoWindow(
    playerId: string,
    actions: readonly GameAction[],
    actionId: string,
    asAdministrator: boolean
): GameAction[] {
    const position = actions.findIndex((action) => action.id === actionId)
    if (position < 0) throw new BranchUndoError(playerId, 'the Action is not in this Branch')
    if (actions[position].source !== ActionSource.User)
        throw new BranchUndoError(playerId, 'only a User Action can be undone')
    const window = actions.slice(position)
    if (!asAdministrator && window.some((action) => action.revealsInfo))
        throw new BranchUndoError(playerId, 'it would undo an Action that revealed information')
    return window
}

function mergeOutcome(state: GameState): Record<string, unknown> {
    const { activePlayerIds: _activePlayerIds, ...outcome } = withoutActionPositions(state)
    return outcome
}

export function sameBranchOutcome(mainLine: GameState, view: GameState): boolean {
    return Value.Equal(mergeOutcome(mainLine), mergeOutcome(view))
}

// A recorded undo patch addresses the span record's lists as they stood privately, so a view worked back from one has no comparable span record.
function outcomeInsideBranch(state: GameState): Record<string, unknown> {
    const { parallelSpan: _parallelSpan, ...outcome } = mergeOutcome(state)
    return outcome
}

export function firstActionWithAnotherResult<T extends GameState>({
    closedView,
    recorded,
    replayed
}: {
    closedView: T
    recorded: readonly GameAction[]
    replayed: readonly T[]
}): GameAction | undefined {
    let shown = closedView
    let first: GameAction | undefined
    for (let position = recorded.length - 1; position >= 0; position--) {
        const action = recorded[position]
        if (!Value.Equal(outcomeInsideBranch(replayed[position]), outcomeInsideBranch(shown)))
            first = action
        shown = undoRecordedAction(shown, action)
    }
    return first
}
