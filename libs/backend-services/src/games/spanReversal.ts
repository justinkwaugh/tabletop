import {
    BranchUndoError,
    GameEngine,
    assertExists,
    belongsToSpan,
    closedUnmergedPlayerIds,
    findBranchThatWouldNotReplay,
    isCommonAction,
    isRestingInSpan,
    latestCommonActionUndoTarget,
    removeBranchCloses,
    removeCommonAction,
    restingSpan,
    reverseToBranchStart,
    sameHistoryPosition,
    settleSpan,
    spanRuns,
    undoBranchAction as undoInBranch,
    unmergedPlayerIds,
    type Branch,
    type Game,
    type GameAction,
    type GameDefinition,
    type GameState,
    type ParallelSpanState,
    type UnmergedBranch
} from '@tabletop/common'
import type { GameStore, UnmergedBranchWrites } from '../persistence/stores/gameStore.js'
import { DisallowedUndoError } from './errors.js'
import {
    assertBranchUnmoved,
    assertBranchesUnmoved,
    assertGameInProgress,
    assertSameSpan,
    freshBranchWrite,
    type ExpectedBranch
} from './spanWrites.js'

export interface ReopenedBranch {
    readonly closed: Branch
    readonly reopened: Branch
    readonly undoneActions: readonly GameAction[]
}

export type BranchUndo =
    | {
          readonly kind: 'branch'
          readonly unmergedBranch: UnmergedBranch
          readonly undoneActions: readonly GameAction[]
      }
    | { readonly kind: 'reopen'; readonly reopened: ReopenedBranch }

export async function undoBranchAction({
    gameStore,
    definition,
    game,
    actionId,
    playerIds,
    asAdministrator
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    actionId: string
    playerIds: readonly string[]
    asAdministrator: boolean
}): Promise<BranchUndo | undefined> {
    const gameId = game.id
    const state = game.state
    assertExists(state, 'A Branch Undo requires current Game State')
    if (!isRestingInSpan(state)) return undefined
    const span = restingSpan(state)

    const target = (await gameStore.findUnmergedBranches(gameId, playerIds)).find(
        (record) =>
            belongsToSpan(record.branch, span) &&
            record.actions.some((action) => action.id === actionId)
    )
    if (target === undefined) return undefined

    const engine = new GameEngine(definition.runtime)
    const undone = (() => {
        try {
            return undoInBranch({ engine, state, ...target, actionId, asAdministrator })
        } catch (error) {
            if (error instanceof BranchUndoError) {
                throw new DisallowedUndoError({ gameId, actionId, reason: error.message })
            }
            throw error
        }
    })()
    const { branch, undoneActions } = undone
    if (target.branch.closed) {
        return {
            kind: 'reopen',
            reopened: { closed: target.branch, reopened: branch, undoneActions }
        }
    }

    await gameStore.writeUnmergedBranch({
        gameId,
        write: { branch, addedActions: [], removedActions: undoneActions },
        validator: async (found) => {
            assertGameInProgress(found.game)
            assertSameSpan(gameId, found.state, span)
            assertBranchUnmoved(gameId, found.branch, target.branch)
        }
    })
    return { kind: 'branch', unmergedBranch: { branch, actions: [] }, undoneActions }
}

export interface CommonActionUndo {
    readonly target: GameAction
    readonly state: GameState
    readonly removed: GameAction[]
    readonly replayed: GameAction[]
}

export async function planCommonActionUndo({
    gameStore,
    definition,
    game,
    actionId,
    playerId
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    actionId: string
    playerId: string
}): Promise<CommonActionUndo | undefined> {
    const state = game.state
    assertExists(state, 'A Common Action Undo requires current Game State')
    if (!isRestingInSpan(state)) return undefined
    const span = restingSpan(state)
    const history = await gameStore.findActionRangeForGame({
        game,
        startIndex: span.branchPoint.actionCount,
        endIndex: state.actionCount
    })
    const target = history.find((action) => action.id === actionId)
    if (target === undefined || !isCommonAction(target)) return undefined
    if (latestCommonActionUndoTarget(history, span, playerId)?.id !== actionId) {
        throw new DisallowedUndoError({
            gameId: game.id,
            actionId,
            reason: 'only your own latest Common Action can be undone, and not once another Player’s Common Action follows it or it revealed information'
        })
    }
    const engine = new GameEngine(definition.runtime)
    const undone = removeCommonAction({ engine, game, state, history, actionId })
    return { target, ...undone }
}

// The Unmerged Branches that must replay the same on the Main Line a reversal leaves: every one
// when it passes over an agreement, since a Branch may have relied on what it settled; and the
// Branch of each Player whose Common Action it takes out, since what that Action held may have
// been used in that Branch meanwhile, and taking it out puts the hold back.
function branchesThatMustReplay(
    stored: readonly UnmergedBranch[],
    undone: readonly GameAction[],
    span: ParallelSpanState | undefined
): UnmergedBranch[] {
    if (span === undefined) return []
    const commonRuns = spanRuns(undone, span).filter((run) => isCommonAction(run[0]))
    if (commonRuns.some((run) => run.some((action) => action.revealsInfo))) return [...stored]
    const playerIds = new Set(commonRuns.map((run) => run[0].playerId))
    return stored.filter(({ branch }) => playerIds.has(branch.playerId))
}

export interface ReversalSettlement {
    readonly state: GameState
    readonly removedActions: GameAction[]
    readonly reappliedActions: GameAction[]
    readonly leavesSpan: boolean
    readonly branchWrites: UnmergedBranchWrites
    assertBranchesUnmoved(stored: readonly Branch[]): void
}

export async function settleAfterReversal({
    gameStore,
    engine,
    game,
    state,
    undone,
    reopened
}: {
    gameStore: GameStore
    engine: GameEngine
    game: Game
    state: GameState
    undone: readonly GameAction[]
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
            branchWrites: { set: [], removeBranchesOf: priorSpan === undefined ? [] : 'all' },
            assertBranchesUnmoved: () => {}
        }
    }

    const sinceSpanBegan = await gameStore.findActionRangeForGame({
        game,
        startIndex: span.branchPoint.actionCount,
        endIndex: state.actionCount
    })
    const outsideBranch = reverseToBranchStart({ engine, state, history: sinceSpanBegan })
    const resting = restingSpan(outsideBranch.state)
    const leavesSpan =
        priorSpan !== undefined && !sameHistoryPosition(priorSpan.branchPoint, span.branchPoint)
    const stored = leavesSpan
        ? []
        : (await gameStore.findUnmergedBranches(game.id, unmergedPlayerIds(resting))).filter(
              ({ branch }) =>
                  belongsToSpan(branch, resting) && branch.playerId !== reopened?.closed.playerId
          )
    const held = [
        ...stored,
        ...(reopened === undefined ? [] : [{ branch: reopened.reopened, actions: [] }])
    ]
    const closedInStore = held
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
        unmergedBranches: held,
        mergesHeld: true
    })
    const mustReplay = branchesThatMustReplay(stored, undone, priorSpan)
    const relied = findBranchThatWouldNotReplay({
        engine,
        game,
        state: settlement.updatedState,
        unmergedBranches: mustReplay
    })
    if (relied !== undefined) {
        throw new DisallowedUndoError({
            gameId: game.id,
            actionId: undone[0].id,
            reason: `the Branch of ${relied.playerId} would not replay the same on the Main Line the Undo leaves: ${relied.reason}`
        })
    }
    const expected: ExpectedBranch[] = [
        ...stored
            .filter((record) => record.branch.closed || mustReplay.includes(record))
            .map(({ branch }) => ({ playerId: branch.playerId, branch })),
        ...settlement.createdBranches.map(({ branch }) => ({
            playerId: branch.playerId,
            branch: undefined
        })),
        ...(reopened === undefined
            ? []
            : [{ playerId: reopened.closed.playerId, branch: reopened.closed }])
    ]
    return {
        state: settlement.updatedState,
        removedActions: [...withoutStrayCloses.removed, ...outsideBranch.reversed],
        reappliedActions: [...withoutStrayCloses.replayed, ...settlement.processedActions],
        leavesSpan,
        branchWrites: {
            set: [
                ...settlement.createdBranches.map(freshBranchWrite),
                ...(reopened === undefined
                    ? []
                    : [
                          {
                              branch: reopened.reopened,
                              addedActions: [],
                              removedActions: reopened.undoneActions
                          }
                      ])
            ],
            removeBranchesOf: leavesSpan ? 'all' : [],
            watchBranchesOf: expected.map((branch) => branch.playerId)
        },
        assertBranchesUnmoved: (found) => assertBranchesUnmoved(game.id, resting, found, expected)
    }
}
