import { tick } from 'svelte'
import {
    assertExists,
    GameSyncStatus,
    type CanonicalActionReplayManifest,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState,
    type ProcessedActionReplay,
    type UnmergedBranch,
    Visibility
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'
import type { VisibleStep } from './gameBranch.js'
import type { GameContext } from './gameContext.svelte.js'
import {
    GameReconciliation,
    ServerActionHandling,
    type OptimisticSubmission,
    type SubmissionAnswer
} from './gameReconciliation.js'
import { OwnBranch } from './ownBranch.svelte.js'

export type ReconciliationUpdate =
    | { kind: 'actions'; actions: GameAction[]; handling: ServerActionHandling; game: Game }
    | {
          kind: 'replacement'
          replay: ProcessedActionReplay
          checksum: number
          game: Game
          perspective: Visibility.Perspective
      }
    | {
          kind: 'manifest'
          manifest: CanonicalActionReplayManifest
          redoneActions: GameAction[]
          checksum: number
          game: Game
      }
    | {
          kind: 'branch'
          unmergedBranch: UnmergedBranch
          undoneActionIds: readonly string[]
          game: Game
          perspective: Visibility.Perspective
      }
    | { kind: 'synchronize' }

export interface LoadedGame<T extends GameState, U extends HydratedGameState<T> & T> {
    context: GameContext<T, U>
    unmergedBranch?: UnmergedBranch
}

export interface GameLinesSession<T extends GameState, U extends HydratedGameState<T> & T> {
    checkSync: RemoteApiService['checkSync']
    reload(): Promise<LoadedGame<T, U>>
    isPaused(): boolean
    recover(): Promise<void>
    acceptsPerspective(perspective: Visibility.Perspective): boolean
    beforeSynchronizationUpdate?(): void
    playerId(): string | undefined
    playsHosted(): boolean
    awaitsAnswer(): boolean
    settle(): Promise<void>
    onBranchViewChange(steps: VisibleStep<T>[] | undefined): void
}

type UndoAnswer = Awaited<ReturnType<RemoteApiService['undoAction']>>

export class GameLines<T extends GameState, U extends HydratedGameState<T> & T> {
    private readonly reconciliation: GameReconciliation<T, U>
    private readonly branch: OwnBranch<T, U>
    private pending: ReconciliationUpdate[] = []
    private draining = false

    constructor(
        readonly mainLine: GameContext<T, U>,
        private readonly session: GameLinesSession<T, U>,
        sent?: UnmergedBranch
    ) {
        this.reconciliation = new GameReconciliation(mainLine)
        this.branch = new OwnBranch(
            mainLine,
            mainLine.engine,
            {
                playerId: () => session.playerId(),
                playsHosted: () => session.playsHosted(),
                awaitsAnswer: () => session.awaitsAnswer(),
                requestBranch: () => this.requestBranch(),
                onChange: (steps) => session.onBranchViewChange(steps)
            },
            sent
        )
    }

    get branchContext(): GameContext<T, U> | undefined {
        return this.branch.context
    }

    get playContext(): GameContext<T, U> {
        return this.branch.playContext
    }

    get branchIsAwaited(): boolean {
        return this.branch.isAwaited
    }

    holds(context: GameContext<T, U>): boolean {
        return context === this.mainLine || context === this.branch.context
    }

    historySource(): GameContext<T, U> {
        return this.branch.historySource()
    }

    followMainLine(): void {
        this.branch.follow()
    }

    updateBranchGame(game: Game): void {
        this.branch.context?.updateGame(game)
    }

    replaceMainLine(context: GameContext<T, U>): void {
        this.invalidatePendingRepresentation()
        this.mainLine.restoreFrom(context.clone())
        this.branch.adopt(undefined)
        this.branch.fetchAgain()
    }

    hydrateHistory(loaded: LoadedGame<T, U>): boolean {
        return this.mainLine.hydrateHistory(loaded.context) && this.branch.hydrateHistory(loaded)
    }

    async enqueue(update: ReconciliationUpdate): Promise<void> {
        this.pending.push(update)
        await this.resume()
    }

    clearPending(): void {
        this.pending = []
    }

    invalidatePendingRepresentation(): void {
        if (this.pending.length > 0) {
            this.pending = [{ kind: 'synchronize' }]
        }
    }

    async resume(): Promise<void> {
        if (this.draining) return
        this.draining = true
        try {
            while (!this.session.isPaused() && this.pending.length > 0) {
                const update = this.pending.shift()
                assertExists(update, 'A queued server update must exist')
                try {
                    await this.applyUpdate(update)
                } catch (error) {
                    console.error('Error applying server update:', error)
                    this.clearPending()
                    await this.session.recover()
                }
            }
        } finally {
            this.draining = false
        }
    }

    async synchronize(isCurrent: () => boolean, forceReload = false): Promise<'current' | 'stale'> {
        if (forceReload) return this.reload(isCurrent)
        const mainLine = this.mainLine
        try {
            const answer = await this.session.checkSync(
                mainLine.game.id,
                mainLine.state.actionChecksum,
                mainLine.state.actionCount - 1,
                this.branch.position
            )
            if (!isCurrent()) return 'stale'
            if (answer.status !== GameSyncStatus.InSync || answer.actions.length > 0) {
                this.session.beforeSynchronizationUpdate?.()
            }
            if (this.reconciliation.catchUp(answer)) {
                if (answer.branchSync?.status === GameSyncStatus.OutOfSync) {
                    this.session.beforeSynchronizationUpdate?.()
                    this.branch.adopt(answer.branchSync.unmergedBranch)
                }
                return 'current'
            }
        } catch (error) {
            console.log('Incremental synchronization failed', error)
        }
        if (!isCurrent()) return 'stale'
        this.session.beforeSynchronizationUpdate?.()
        return this.reload(isCurrent)
    }

    async acceptSubmission({
        action,
        response,
        context,
        optimistic,
        isCurrent
    }: {
        action: GameAction
        response: SubmissionAnswer
        context: GameContext<T, U>
        optimistic?: OptimisticSubmission<T, U>
        isCurrent: () => boolean
    }): Promise<'applied' | 'stale'> {
        if (context !== this.branch.context) {
            this.reconciliation.acceptSubmission(action.id, response, optimistic)
            this.branch.follow()
            if (response.unmergedBranch !== undefined) {
                await this.session.settle()
                if (!isCurrent()) return 'stale'
            }
            this.branch.followAnswer(response.unmergedBranch)
            return 'applied'
        }

        const merged = response.actions.some((accepted) => accepted.id === action.id)
        if (response.actions.length > 0) {
            await this.session.settle()
            if (!isCurrent()) return 'stale'
        }
        if (!merged) {
            const sent = response.unmergedBranch
            assertExists(sent, 'The host accepted a Branch Action without returning the Branch')
            this.branch.acceptSubmission(action.id, sent, response.game, optimistic)
        }
        if (response.actions.length > 0 && this.continueWith(response.actions, response.game)) {
            this.branch.followAnswer(merged ? response.unmergedBranch : undefined)
        }
        return 'applied'
    }

    acceptUndo({
        context,
        before,
        response
    }: {
        context: GameContext<T, U>
        before: GameContext<T, U>
        response: UndoAnswer
    }): void {
        const replay = response.actionReplay ?? response.canonicalReplay
        if (context !== this.branch.context) {
            this.reconciliation.replace(replay, response.checksum, response.game, before)
            return
        }
        const sent = response.unmergedBranch
        assertExists(sent, 'The host undid a Branch Action without returning the Branch')
        const mainLine = this.mainLine
        if (
            response.checksum !== mainLine.state.actionChecksum &&
            replay.startIndex <= mainLine.nextActionIndex
        ) {
            this.reconciliation.replace(replay, response.checksum, response.game)
        }
        this.branch.acceptUndo(before, sent)
    }

    private async applyUpdate(update: ReconciliationUpdate): Promise<void> {
        const gameId = this.mainLine.game.id
        switch (update.kind) {
            case 'synchronize':
                await this.session.recover()
                return
            case 'actions':
                this.reconciliation.apply(update.actions, update.handling, update.game)
                return
            case 'replacement':
                if (
                    update.game.id === gameId &&
                    this.session.acceptsPerspective(update.perspective)
                ) {
                    this.reconciliation.replace(update.replay, update.checksum, update.game)
                }
                return
            case 'manifest':
                if (update.game.id === gameId) {
                    this.reconciliation.replaceFromManifest(
                        update.manifest,
                        update.redoneActions,
                        update.checksum,
                        update.game
                    )
                }
                return
            case 'branch':
                if (
                    update.game.id === gameId &&
                    this.session.acceptsPerspective(update.perspective) &&
                    !this.branch.followPublished(update.unmergedBranch, update.undoneActionIds)
                ) {
                    await this.session.recover()
                }
        }
    }

    private async reload(isCurrent: () => boolean): Promise<'current' | 'stale'> {
        if (!isCurrent()) return 'stale'
        this.session.beforeSynchronizationUpdate?.()
        const replacement = await this.session.reload()
        if (!isCurrent()) return 'stale'
        this.mainLine.restoreFrom(replacement.context)
        this.branch.adopt(replacement.unmergedBranch)
        return 'current'
    }

    private continueWith(actions: GameAction[], game: Game): boolean {
        const handling = ServerActionHandling.ApplyProcessed
        if (!this.reconciliation.continues(actions)) {
            this.pending.push({ kind: 'actions', actions, handling, game })
            return false
        }
        this.reconciliation.apply(actions, handling, game)
        return true
    }

    private requestBranch(): void {
        void tick()
            .then(() => this.session.settle())
            .then(() => this.enqueue({ kind: 'synchronize' }))
            .catch((error) => {
                console.error('Unable to fetch the Player’s Branch:', error)
            })
    }
}
