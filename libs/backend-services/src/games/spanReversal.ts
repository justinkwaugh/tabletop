import {
    assertExists,
    belongsToSpan,
    closedUnmergedPlayerIds,
    removeBranchCloses,
    restingSpan,
    reverseToBranchStart,
    sameHistoryPosition,
    settleSpan,
    unmergedPlayerIds,
    type Branch,
    type Game,
    type GameAction,
    type GameEngine,
    type GameState,
    type UnmergedBranch
} from '@tabletop/common'
import type { GameStore, UnmergedBranchWrite } from '../persistence/stores/gameStore.js'
import { freshBranchWrite } from './spanSubmission.js'

export interface ReopenedBranch {
    readonly branch: Branch
    readonly undoneActions: readonly GameAction[]
}

export interface ReversalSettlement {
    readonly state: GameState
    readonly removedActions: GameAction[]
    readonly reappliedActions: GameAction[]
    readonly leavesSpan: boolean
    readonly watchedPlayerIds: string[]
    readonly storedBranches: UnmergedBranch[]
    readonly branchWrites: UnmergedBranchWrite[]
}

export async function settleAfterReversal({
    gameStore,
    engine,
    game,
    state,
    reopened
}: {
    gameStore: GameStore
    engine: GameEngine
    game: Game
    state: GameState
    reopened?: ReopenedBranch
}): Promise<ReversalSettlement> {
    const priorSpan = game.state?.parallelSpan
    const span = state.parallelSpan
    if (span === undefined) {
        return {
            state,
            removedActions: [],
            reappliedActions: [],
            leavesSpan: priorSpan !== undefined,
            watchedPlayerIds: [],
            storedBranches: [],
            branchWrites: []
        }
    }

    const sinceSpanBegan = await gameStore.findActionRangeForGame({
        game,
        startIndex: span.branchPoint.actionCount,
        endIndex: state.actionCount
    })
    const outsideBranch = reverseToBranchStart({ engine, state, history: sinceSpanBegan })
    assertExists(outsideBranch, 'The start of the merged Branch is not in Action History')
    const resting = restingSpan(outsideBranch.state)
    const leavesSpan =
        priorSpan !== undefined && !sameHistoryPosition(priorSpan.branchPoint, span.branchPoint)
    const watchedPlayerIds = leavesSpan ? [] : unmergedPlayerIds(resting)
    const storedBranches = await gameStore.findUnmergedBranches(game.id, watchedPlayerIds)
    const heldBranches = [
        ...storedBranches.filter(
            ({ branch }) =>
                branch.playerId !== reopened?.branch.playerId && belongsToSpan(branch, resting)
        ),
        ...(reopened === undefined ? [] : [{ branch: reopened.branch, actions: [] }])
    ]
    const closedInStore = heldBranches
        .filter(({ branch }) => branch.closed)
        .map(({ branch }) => branch.playerId)
    const withoutStrayCloses = removeBranchCloses({
        engine,
        game,
        state: outsideBranch.state,
        history: sinceSpanBegan.slice(0, sinceSpanBegan.length - outsideBranch.reversed.length),
        playerIds: closedUnmergedPlayerIds(resting).filter(
            (playerId) => !closedInStore.includes(playerId)
        )
    })
    const settlement = settleSpan({
        engine,
        game,
        state: withoutStrayCloses.state,
        unmergedBranches: heldBranches,
        mergesHeld: true
    })
    return {
        state: settlement.updatedState,
        removedActions: [...withoutStrayCloses.removed, ...outsideBranch.reversed],
        reappliedActions: [...withoutStrayCloses.replayed, ...settlement.processedActions],
        leavesSpan,
        watchedPlayerIds,
        storedBranches,
        branchWrites: [
            ...settlement.createdBranches.map(freshBranchWrite),
            ...(reopened === undefined
                ? []
                : [
                      {
                          branch: reopened.branch,
                          addedActions: [],
                          removedActions: reopened.undoneActions
                      }
                  ])
        ]
    }
}
