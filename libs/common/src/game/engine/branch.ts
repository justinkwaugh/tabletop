import * as Type from 'typebox'
import * as Value from 'typebox/value'
import jsonpatch from 'fast-json-patch'
import { assert } from '../../util/assertions.js'
import { BaseError } from '../../util/errors.js'
import { ActionSource, GameAction, Patch } from './gameAction.js'
import { ENGINE_MAINTAINED_FIELDS } from './branchScope.js'
import { withoutActionPositions } from './commutation.js'
import { sameHistoryPosition, spanAwaitingBranch } from './parallelSpan.js'
import { createPatch } from './statePatch.js'
import { BranchPoint, type GameState } from '../model/gameState.js'

export type Branch = Type.Static<typeof Branch>
export const Branch = Type.Object({
    playerId: Type.String(),
    branchPoint: BranchPoint,
    machineState: Type.String(),
    activePlayerIds: Type.Array(Type.String()),
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

export interface BranchExecution<T extends GameState = GameState> {
    readonly branch: Branch
    readonly processedActions: GameAction[]
    readonly view: T
}

export type BranchUndoWindow =
    { kind: 'undo'; actions: GameAction[] } | { kind: 'refused'; reason: string }

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

export function branchView<T extends GameState>(state: T, branch: Branch): T {
    const span = spanAwaitingBranch(state, branch.playerId)
    assert(
        sameHistoryPosition(span.branchPoint, branch.branchPoint),
        `The Branch of ${branch.playerId} belongs to another Parallel Span`
    )
    const changed = jsonpatch.applyPatch(
        structuredClone(state),
        structuredClone(branch.change)
    ).newDocument
    return {
        ...changed,
        machineState: branch.machineState,
        activePlayerIds: [...branch.activePlayerIds],
        actionCount: branch.actionCount,
        actionChecksum: branch.actionChecksum,
        parallelSpan: {
            ...structuredClone(span),
            mergedPlayerIds: branch.closed
                ? [...span.mergedPlayerIds, branch.playerId]
                : [...span.mergedPlayerIds],
            ...(branch.closed ? {} : { branchPlayerId: branch.playerId })
        }
    }
}

export function branchFromView(state: GameState, view: GameState, playerId: string): Branch {
    const span = spanAwaitingBranch(state, playerId)
    return {
        playerId,
        branchPoint: structuredClone(span.branchPoint),
        machineState: view.machineState,
        activePlayerIds: [...view.activePlayerIds],
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
    actions: readonly GameAction[],
    actionId: string,
    { asAdministrator = false }: { asAdministrator?: boolean } = {}
): BranchUndoWindow {
    const position = actions.findIndex((action) => action.id === actionId)
    if (position < 0) return { kind: 'refused', reason: 'the Action is not in this Branch' }
    if (actions[position].source !== ActionSource.User)
        return { kind: 'refused', reason: 'only a User Action can be undone' }
    const window = actions.slice(position)
    if (!asAdministrator && window.some((action) => action.revealsInfo))
        return { kind: 'refused', reason: 'it would undo an Action that revealed information' }
    return { kind: 'undo', actions: window }
}

function mergeOutcome(state: GameState): Record<string, unknown> {
    const { activePlayerIds: _activePlayerIds, ...outcome } = withoutActionPositions(state)
    return outcome
}

export function sameBranchOutcome(mainLine: GameState, view: GameState): boolean {
    return Value.Equal(mergeOutcome(mainLine), mergeOutcome(view))
}
