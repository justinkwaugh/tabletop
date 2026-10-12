import {
    actsInBranch,
    assert,
    assertExists,
    belongsToSpan,
    branchFromView,
    branchView,
    calculateActionChecksum,
    restingSpan,
    sameHistoryPosition,
    type ActionHistoryPosition,
    type Game,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState,
    type ParallelSpanState,
    type UnmergedBranch
} from '@tabletop/common'
import type { GameContext } from './gameContext.svelte.js'
import {
    GameReconciliation,
    type LoadedGame,
    type OptimisticSubmission
} from './gameReconciliation.js'
import {
    branchActionSteps,
    createBranchContext,
    JoinedBranchHistory,
    mergedActionSteps,
    type VisibleStep
} from './gameBranch.js'

interface OwnBranchSession<T extends GameState> {
    playerId(): string | undefined
    playsHosted(): boolean
    awaitsAnswer(): boolean
    requestBranch(): void
    onChange(steps: VisibleStep<T>[] | undefined): void
}

export class OwnBranch<T extends GameState, U extends HydratedGameState<T> & T> {
    context?: GameContext<T, U> = $state.raw()
    private followed: T
    private requestedAt?: ActionHistoryPosition
    private reconciliation?: GameReconciliation<T, U>
    private joinedHistory?: JoinedBranchHistory<T, U>

    constructor(
        private readonly mainLine: GameContext<T, U>,
        private readonly engine: GameEngine<T, U>,
        private readonly session: OwnBranchSession<T>,
        sent?: UnmergedBranch
    ) {
        this.followed = mainLine.state
        if (sent !== undefined) this.hold(createBranchContext(mainLine, sent))
    }

    get playContext(): GameContext<T, U> {
        return this.context ?? this.mainLine
    }

    get position(): ActionHistoryPosition | undefined {
        return this.context && positionOf(this.context.state)
    }

    get isAwaited(): boolean {
        return this.context === undefined && this.awaitedSpan() !== undefined
    }

    historySource(): GameContext<T, U> {
        const branch = this.context
        const playerId = this.session.playerId()
        if (branch === undefined || playerId === undefined || !branch.hasCompleteHistory) {
            this.joinedHistory = undefined
            return this.playContext
        }
        if (this.joinedHistory?.branch === branch) {
            this.joinedHistory.refresh()
        } else {
            this.joinedHistory = new JoinedBranchHistory(this.mainLine, branch, playerId)
        }
        return this.joinedHistory.context
    }

    follow(): void {
        this.track(undefined)
        this.fetchIfAwaited(!this.session.awaitsAnswer())
    }

    followAnswer(sent?: UnmergedBranch): void {
        this.track(sent)
        this.fetchIfAwaited(true)
    }

    adopt(sent: UnmergedBranch | undefined): void {
        this.followed = this.mainLine.state
        if (sent === undefined) {
            if (this.context !== undefined) this.show(undefined, undefined)
            return
        }
        const adopted = createBranchContext(this.mainLine, sent)
        if (this.context === undefined) {
            this.show(adopted, undefined)
        } else {
            this.context.restoreFrom(adopted)
            this.session.onChange(undefined)
        }
    }

    fetchAgain(): void {
        this.requestedAt = undefined
        this.fetchIfAwaited(true)
    }

    acceptSubmission(
        actionId: string,
        sent: UnmergedBranch,
        game: Game,
        optimistic?: OptimisticSubmission<T, U>
    ): void {
        const { context: branch, reconciliation } = this
        assertExists(branch, 'There is no Branch for the host to have answered about')
        assertExists(reconciliation, 'The Branch has nothing to reconcile it')
        reconciliation.acceptSubmission(actionId, { actions: sent.actions, game }, optimistic)
        assert(
            sameHistoryPosition(branch.state, sent.branch),
            'The Branch is not where the host has it'
        )
    }

    acceptUndo(before: GameContext<T, U>, sent: UnmergedBranch): void {
        const branch = this.context
        assertExists(branch, 'There is no Branch for the host to have undone in')
        branch.restoreFrom(this.undoneTo(before, sent))
    }

    followPublished(sent: UnmergedBranch): boolean {
        const { context: branch, reconciliation } = this
        const span = this.awaitedSpan()
        if (
            branch === undefined ||
            reconciliation === undefined ||
            span === undefined ||
            !belongsToSpan(sent.branch, span)
        ) {
            return false
        }
        const held = branch.state.actionCount
        if (sent.actions.length > 0 && sent.actions[0].index === held) {
            reconciliation.applyProcessed(sent.actions)
        } else if (sent.branch.actionCount < held) {
            branch.restoreFrom(this.undoneTo(branch, sent))
        }
        return sameHistoryPosition(branch.state, sent.branch)
    }

    private undoneTo(from: GameContext<T, U>, sent: UnmergedBranch): GameContext<T, U> {
        const undone = from.clone()
        while (undone.nextActionIndex > sent.branch.actionCount) {
            assertExists(undone.popAction(), 'The Branch has no Action left to undo')
        }
        undone.updateGameState(branchView(this.mainLine.state, sent.branch))
        undone.verifyFullChecksum()
        return undone
    }

    hydrateHistory({ context, unmergedBranch }: LoadedGame<T, U>): boolean {
        const branch = this.context
        if (branch === undefined || branch.hasCompleteHistory) return true
        return (
            unmergedBranch !== undefined &&
            actsInBranch(context.state, unmergedBranch.branch.playerId) &&
            belongsToSpan(unmergedBranch.branch, restingSpan(context.state)) &&
            branch.hydrateHistory(createBranchContext(context, unmergedBranch))
        )
    }

    private awaitedSpan(): ParallelSpanState | undefined {
        const state = this.mainLine.state
        return this.session.playsHosted() && actsInBranch(state, this.session.playerId())
            ? restingSpan(state)
            : undefined
    }

    private hold(context: GameContext<T, U> | undefined): void {
        this.context = context
        this.reconciliation = context && new GameReconciliation(context)
    }

    private show(context: GameContext<T, U> | undefined, steps: VisibleStep<T>[] | undefined) {
        this.hold(context)
        this.session.onChange(steps)
    }

    private fetchIfAwaited(mayAsk: boolean): void {
        if (this.context !== undefined) {
            this.requestedAt = undefined
            return
        }
        if (!mayAsk || this.awaitedSpan() === undefined) return
        const position = positionOf(this.mainLine.state)
        if (this.requestedAt !== undefined && sameHistoryPosition(this.requestedAt, position))
            return
        this.requestedAt = position
        this.session.requestBranch()
    }

    private arrivedSince(before: T): GameAction[] | undefined {
        const arrived = this.mainLine.actions.filter(
            (action) => action.index !== undefined && action.index >= before.actionCount
        )
        return calculateActionChecksum(before.actionChecksum, arrived) ===
            this.mainLine.state.actionChecksum
            ? arrived
            : undefined
    }

    private track(sent: UnmergedBranch | undefined): void {
        const before = this.followed
        const mainLine = this.mainLine
        if (mainLine.state === before && sent === undefined) return
        this.followed = mainLine.state

        const playerId = this.session.playerId()
        const current = this.context
        const span = this.awaitedSpan()
        if (playerId === undefined || (current === undefined && span === undefined)) return

        const replay = { engine: this.engine, game: mainLine.game, playerId }
        const held = current && branchFromView(before, current.state, playerId)
        const arrived = this.arrivedSince(before)
        const merged =
            arrived && mergedActionSteps({ ...replay, from: before, actions: arrived, held })

        if (sent !== undefined) {
            this.show(
                createBranchContext(mainLine, sent),
                merged && [
                    ...merged,
                    ...branchActionSteps({
                        ...replay,
                        mainLine: mainLine.state,
                        actions: sent.actions
                    })
                ]
            )
        } else if (current === undefined) {
            return
        } else if (held !== undefined && span !== undefined && belongsToSpan(held, span)) {
            current.updateGameState(branchView(mainLine.state, held))
            this.session.onChange(merged)
        } else {
            this.show(undefined, merged)
        }
    }
}

function positionOf(state: GameState): ActionHistoryPosition {
    return { actionCount: state.actionCount, actionChecksum: state.actionChecksum }
}
