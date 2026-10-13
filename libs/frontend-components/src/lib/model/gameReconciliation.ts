import {
    ActionSource,
    assertExists,
    findLastIndex,
    GameSyncStatus,
    type CanonicalActionReplayManifest,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState,
    type ProcessedActionReplay,
    type ActionHistoryPosition,
    type UnmergedBranch,
    Visibility
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'
import { GameActionResults, type ActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'
import { sameStoredState } from './storedState.js'
import type { TransitionKind, TransitionRequest } from './transitionPresenter.js'

export enum ServerActionHandling {
    Execute = 'execute',
    ApplyProcessed = 'applyProcessed'
}

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

export interface ReconciliationRemote<T extends GameState, U extends HydratedGameState<T> & T> {
    checkSync: RemoteApiService['checkSync']
    reload(): Promise<LoadedGame<T, U>>
    branchPosition(): ActionHistoryPosition | undefined
    adoptBranch(unmergedBranch: UnmergedBranch | undefined): void
    followBranch(unmergedBranch: UnmergedBranch, undoneActionIds: readonly string[]): boolean
    isPaused(): boolean
    recover(): Promise<void>
    acceptsPerspective(perspective: Visibility.Perspective): boolean
    beforeSynchronizationUpdate?(): void
    present(request: TransitionRequest<T>, write: () => void): void
}

export interface LoadedGame<T extends GameState, U extends HydratedGameState<T> & T> {
    context: GameContext<T, U>
    unmergedBranch?: UnmergedBranch
}

export interface OptimisticSubmission<T extends GameState, U extends HydratedGameState<T> & T> {
    before: GameContext<T, U>
    result: ActionResults<T>
}

export class GameReconciliation<T extends GameState, U extends HydratedGameState<T> & T> {
    private pending: ReconciliationUpdate[] = []
    private draining = false

    constructor(
        private readonly context: GameContext<T, U>,
        private readonly remote?: ReconciliationRemote<T, U>,
        private readonly presentWithoutRemote?: (
            request: TransitionRequest<T>,
            write: () => void
        ) => void
    ) {}

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
        if (this.draining) {
            return
        }
        const remote = this.remote
        assertExists(remote, 'Queued reconciliation requires a remote host')
        this.draining = true
        try {
            while (!remote.isPaused() && this.pending.length > 0) {
                const update = this.pending.shift()
                assertExists(update, 'A queued server update must exist')
                // An update can arrive after a later change the client already has, such as the
                // player's own Undo of a broadcast action or a later Undo than the one it reports;
                // applying it would bring undone actions back.
                if (update.kind !== 'synchronize' && this.predatesLocalGame(update.game)) {
                    continue
                }
                try {
                    if (update.kind === 'synchronize') {
                        await remote.recover()
                    } else if (update.kind === 'replacement') {
                        if (
                            update.game.id === this.context.game.id &&
                            remote.acceptsPerspective(update.perspective)
                        ) {
                            this.replace(update.replay, update.checksum, update.game)
                        }
                    } else if (update.kind === 'branch') {
                        if (
                            update.game.id === this.context.game.id &&
                            remote.acceptsPerspective(update.perspective) &&
                            !remote.followBranch(update.unmergedBranch, update.undoneActionIds)
                        ) {
                            await remote.recover()
                        }
                    } else if (update.kind === 'manifest') {
                        if (update.game.id === this.context.game.id) {
                            this.replaceFromManifest(
                                update.manifest,
                                update.redoneActions,
                                update.checksum,
                                update.game
                            )
                        }
                    } else {
                        this.apply(update.actions, update.handling, update.game)
                    }
                } catch (error) {
                    console.error('Error applying server update:', error)
                    this.clearPending()
                    await remote.recover()
                }
            }
        } finally {
            this.draining = false
        }
    }

    async synchronize(isCurrent: () => boolean, forceReload = false): Promise<'current' | 'stale'> {
        if (forceReload) return this.reload(isCurrent)
        const remote = this.remote
        assertExists(remote, 'Synchronization requires a remote host')
        const prior = this.context.clone()
        try {
            const { status, actions, checksum, branchSync } = await remote.checkSync(
                this.context.game.id,
                this.context.state.actionChecksum,
                this.context.state.actionCount - 1,
                remote.branchPosition()
            )
            if (!isCurrent()) {
                return 'stale'
            }
            let needsResync = status !== GameSyncStatus.InSync
            if (needsResync || actions.length > 0) remote.beforeSynchronizationUpdate?.()
            if (!needsResync && actions.length > 0) {
                this.apply(
                    actions,
                    Visibility.getGameVisibility(this.context.game, this.context.runtime) ===
                        undefined
                        ? ServerActionHandling.Execute
                        : ServerActionHandling.ApplyProcessed
                )
                needsResync = this.context.state.actionChecksum !== checksum
            }
            if (!needsResync || this.tryResync(actions, checksum)) {
                if (branchSync?.status === GameSyncStatus.OutOfSync) {
                    remote.beforeSynchronizationUpdate?.()
                    remote.adoptBranch(branchSync.unmergedBranch)
                }
                return 'current'
            }
        } catch (error) {
            console.log('Incremental synchronization failed', error)
        }
        if (!isCurrent()) {
            return 'stale'
        }
        remote.beforeSynchronizationUpdate?.()
        this.present({ kind: 'reconciliation', intent: 'actions' }, () =>
            this.context.restoreFrom(prior)
        )
        return this.reload(isCurrent)
    }

    private async reload(isCurrent: () => boolean): Promise<'current' | 'stale'> {
        const remote = this.remote
        assertExists(remote, 'Reload requires a remote host')
        if (!isCurrent()) return 'stale'
        remote.beforeSynchronizationUpdate?.()
        const replacement = await remote.reload()
        if (!isCurrent()) {
            return 'stale'
        }
        this.present({ kind: 'reconciliation', intent: 'actions' }, () => {
            this.context.restoreFrom(replacement.context)
            remote.adoptBranch(replacement.unmergedBranch)
        })
        return 'current'
    }

    acceptSubmission(
        actionId: string,
        response: Awaited<ReturnType<RemoteApiService['applyAction']>>,
        optimistic?: OptimisticSubmission<T, U>
    ): void {
        const accepted = response.actions.find((action) => action.id === actionId)
        assertExists(accepted, `Processed action not found for ${actionId}`)
        if (optimistic === undefined) {
            const actions = [...(response.missingActions ?? []), ...response.actions].toSorted(
                (left, right) => (left.index ?? 0) - (right.index ?? 0)
            )
            this.apply(actions, ServerActionHandling.ApplyProcessed, response.game, 'own-action')
            this.context.verifyFullChecksum()
            return
        }

        let before = optimistic.before
        const localAction = optimistic.result.processedActions.find(
            (action) => action.id === actionId
        )
        assertExists(localAction, `Optimistic Action ${actionId} is unavailable`)
        const revealing = optimistic.result.revealing
        const corrected = !revealing && !this.canKeepOptimisticResult(optimistic, response.actions)
        const acceptedIndex = accepted.index
        const rollbackIndex =
            acceptedIndex !== undefined && acceptedIndex < (localAction.index ?? 0)
                ? acceptedIndex - 1
                : undefined
        const missing = response.missingActions ?? []
        let actions = response.actions
        const kind: TransitionKind =
            revealing && rollbackIndex === undefined && missing.length === 0
                ? 'own-action'
                : 'reconciliation'
        this.present({ kind }, () => {
            if (corrected) {
                this.context.restoreFrom(before)
            }
            if (rollbackIndex !== undefined) {
                this.context.restoreFrom(before)
                this.rollbackTo(this.context, rollbackIndex)
                before = this.context.clone()
            }
            if (missing.length > 0) {
                this.context.restoreFrom(before)
                actions = [...missing]
                    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
                    .concat(actions)
            }
            if (revealing || corrected || rollbackIndex !== undefined || missing.length > 0) {
                for (const action of actions) {
                    this.applyProcessedAction(this.context, action)
                }
            }
        })
        for (const action of actions) {
            this.context.upsertAction(action)
        }
        this.context.verifyFullChecksum()
    }

    applyProcessed(actions: readonly GameAction[]): void {
        this.apply(actions, ServerActionHandling.ApplyProcessed)
    }

    continueWith(actions: GameAction[], game: Game): boolean {
        const handling = ServerActionHandling.ApplyProcessed
        const next = actions.find((action) => !this.context.hasAction(action.id))
        if (next?.index !== undefined && next.index > this.context.state.actionCount) {
            this.pending.push({ kind: 'actions', actions, handling, game })
            return false
        }
        this.apply(actions, handling, game)
        return true
    }

    private apply(
        actions: readonly GameAction[],
        handling: ServerActionHandling,
        game?: Game,
        kind: TransitionKind = 'other-action'
    ): void {
        const gameSnapshot = structuredClone(this.context.game)
        let state = structuredClone(this.context.state)
        const results = new GameActionResults<T>([], state)
        for (const action of actions) {
            if (this.context.hasAction(action.id)) {
                continue
            }
            if (handling === ServerActionHandling.Execute && action.source !== ActionSource.User)
                continue
            if (action.index === undefined || action.index < this.context.historyStartIndex) {
                throw new Error('Server update predates the local checkpoint')
            }
            if (action.index !== state.actionCount) {
                throw new Error('Server update does not continue the current State')
            }
            if (handling === ServerActionHandling.Execute) {
                const result = this.context.engine.executeAction({
                    action,
                    game: gameSnapshot,
                    state
                })
                results.add(new GameActionResults(result.processedActions, result.updatedState))
            } else {
                state = this.context.engine.applyProcessedAction({
                    action,
                    game: gameSnapshot,
                    state
                })
                results.add(new GameActionResults([action], state))
            }
            state = results.updatedState
        }
        this.present({ kind }, () => {
            if (results.processedActions.length > 0) {
                this.context.applyActionResults(results)
            }
            if (game !== undefined) {
                this.context.updateGame(game)
            }
        })
    }

    private present(request: TransitionRequest<T>, write: () => void): void {
        const remote = this.remote
        if (remote) remote.present(request, write)
        else if (this.presentWithoutRemote) this.presentWithoutRemote(request, write)
        else write()
    }

    private predatesLocalGame(game: Game): boolean {
        const local = this.context.game.updatedAt
        return (
            local !== undefined &&
            game.updatedAt !== undefined &&
            game.updatedAt.getTime() < local.getTime()
        )
    }

    replace(
        replay: ProcessedActionReplay,
        checksum: number,
        game?: Game,
        before: GameContext<T, U> = this.context
    ): void {
        const replacement = before.clone()
        if (
            replay.startIndex < replacement.historyStartIndex ||
            replay.startIndex > replacement.nextActionIndex
        ) {
            throw new Error('Processed Action replay starts beyond local Action History')
        }
        this.rollbackTo(replacement, replay.startIndex - 1)
        if (
            replacement.nextActionIndex !== replay.startIndex ||
            replacement.state.actionCount !== replay.startIndex
        ) {
            throw new Error('Processed Action replay did not reach its starting state')
        }
        for (const action of replay.actions) {
            if (action.index !== replacement.nextActionIndex) {
                throw new Error(
                    `Processed Action replay has Action ${action.id} at index ${action.index}, expected ${replacement.nextActionIndex}`
                )
            }
            this.applyProcessedAction(replacement, structuredClone(action))
        }
        if (replacement.state.actionChecksum !== checksum) {
            throw new Error(
                `Processed Action replay checksum mismatch, got ${replacement.state.actionChecksum} expected ${checksum}`
            )
        }
        replacement.verifyFullChecksum()
        // The server pushes an Undo to the player who made it too, after the client already shows
        // the result. Swapping in an identical State would reset whatever the player started since.
        if (before === this.context && this.sameHistory(replacement, this.context)) {
            if (game !== undefined) {
                this.context.updateGame(game)
            }
            return
        }
        if (game !== undefined) {
            replacement.updateGame(game)
        }
        this.present({ kind: 'undo' }, () => this.context.restoreFrom(replacement))
    }

    private sameHistory(left: GameContext<T, U>, right: GameContext<T, U>): boolean {
        return (
            left.historyStartIndex === right.historyStartIndex &&
            left.actions.length === right.actions.length &&
            left.actions.every((action, index) => action.id === right.actions[index].id) &&
            sameStoredState(left.state, right.state)
        )
    }

    replaceFromManifest(
        manifest: CanonicalActionReplayManifest,
        redoneActions: GameAction[],
        checksum: number,
        game: Game
    ): void {
        const redoneById = new Map(redoneActions.map((action) => [action.id, action]))
        const actions = manifest.actionIds.map((actionId) => {
            const action = redoneById.get(actionId) ?? this.context.findAction(actionId)
            assertExists(action, `Processed Action replay Action ${actionId} is unavailable`)
            return structuredClone(action)
        })
        this.replace({ startIndex: manifest.startIndex, actions }, checksum, game)
    }

    private tryResync(serverActions: GameAction[], checksum: number): boolean {
        const matchedActionIndex = findLastIndex(serverActions, (action) => {
            if (
                action.index === undefined ||
                action.index < this.context.historyStartIndex ||
                action.index >= this.context.nextActionIndex
            ) {
                return false
            }
            return this.context.findAction(action.id)?.index === action.index
        })
        if (serverActions.length > 0 && matchedActionIndex === -1) {
            return false
        }
        const rollbackIndex =
            matchedActionIndex >= 0 ? (serverActions[matchedActionIndex].index ?? -1) : -1
        const replacement = this.context.clone()
        this.rollbackTo(replacement, rollbackIndex)
        for (const action of serverActions.slice(matchedActionIndex + 1)) {
            this.applyProcessedAction(replacement, action)
        }
        if (replacement.state.actionChecksum !== checksum) {
            return false
        }
        this.present({ kind: 'reconciliation', intent: 'actions' }, () =>
            this.context.restoreFrom(replacement)
        )
        return true
    }

    private applyProcessedAction(context: GameContext<T, U>, action: GameAction): void {
        const state = context.engine.applyProcessedAction({
            action,
            state: context.state,
            game: context.game
        })
        context.applyActionResults(new GameActionResults([action], state))
    }

    private canKeepOptimisticResult(
        optimistic: OptimisticSubmission<T, U>,
        serverActions: readonly GameAction[]
    ): boolean {
        const localActions = optimistic.result.processedActions
        const sameActions =
            localActions.length === serverActions.length &&
            localActions.every((local, index) => {
                const server = serverActions[index]
                return (
                    server !== undefined &&
                    local.id === server.id &&
                    local.index === server.index &&
                    local.source === server.source &&
                    local.type === server.type
                )
            })
        if (!sameActions) return false
        let confirmedState = optimistic.before.state
        for (const action of serverActions) {
            confirmedState = this.context.engine.applyProcessedAction({
                action,
                state: confirmedState,
                game: optimistic.before.game
            })
        }
        return sameStoredState(confirmedState, optimistic.result.updatedState)
    }

    private rollbackTo(context: GameContext<T, U>, index: number): void {
        if (index < context.historyStartIndex - 1 || index >= context.nextActionIndex) {
            throw new Error('Rollback requires unavailable Action History')
        }
        while (context.actions.length > 0 && context.nextActionIndex - 1 !== index) {
            context.undoLastAction()
        }
    }
}
