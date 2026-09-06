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
    Visibility
} from '@tabletop/common'
import type { RemoteApiService } from '../services/remoteApiService.js'
import { GameActionResults, type ActionResults } from './gameActionResults.svelte.js'
import type { GameContext } from './gameContext.svelte.js'

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
    | { kind: 'synchronize' }

export interface ReconciliationRemote<T extends GameState, U extends HydratedGameState<T> & T> {
    checkSync: RemoteApiService['checkSync']
    reload(): Promise<GameContext<T, U>>
    isPaused(): boolean
    recover(): Promise<void>
    acceptsPerspective(perspective: Visibility.Perspective): boolean
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
        private readonly remote?: ReconciliationRemote<T, U>
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

    async synchronize(isCurrent: () => boolean): Promise<'current' | 'stale'> {
        const remote = this.remote
        assertExists(remote, 'Synchronization requires a remote host')
        const prior = this.context.clone()
        try {
            const { status, actions, checksum } = await remote.checkSync(
                this.context.game.id,
                this.context.state.actionChecksum,
                this.context.actions.length - 1
            )
            if (!isCurrent()) {
                return 'stale'
            }
            let needsResync = status !== GameSyncStatus.InSync
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
                return 'current'
            }
        } catch (error) {
            console.log('Incremental synchronization failed', error)
        }
        if (!isCurrent()) {
            return 'stale'
        }
        this.context.restoreFrom(prior)
        const replacement = await remote.reload()
        if (!isCurrent()) {
            return 'stale'
        }
        this.context.restoreFrom(replacement)
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
            this.apply(actions, ServerActionHandling.ApplyProcessed, response.game)
            this.context.verifyFullChecksum()
            return
        }

        let before = optimistic.before
        const localAction = optimistic.result.processedActions.find(
            (action) => action.id === actionId
        )
        assertExists(localAction, `Optimistic Action ${actionId} is unavailable`)
        let applyAccepted = optimistic.result.revealing
        if (
            !applyAccepted &&
            !this.canKeepOptimisticResult(optimistic.result.processedActions, response.actions)
        ) {
            this.context.restoreFrom(before)
            applyAccepted = true
        }
        if (accepted.index !== undefined && accepted.index < (localAction.index ?? 0)) {
            this.context.restoreFrom(before)
            this.rollbackTo(this.context, accepted.index - 1)
            before = this.context.clone()
            applyAccepted = true
        }
        let actions = response.actions
        if (response.missingActions !== undefined && response.missingActions.length > 0) {
            this.context.restoreFrom(before)
            actions = [...response.missingActions]
                .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
                .concat(actions)
            applyAccepted = true
        }
        if (applyAccepted) {
            for (const action of actions) {
                this.applyProcessedAction(this.context, action)
            }
        }
        for (const action of actions) {
            this.context.upsertAction(action)
        }
        this.context.verifyFullChecksum()
    }

    private apply(
        actions: readonly GameAction[],
        handling: ServerActionHandling,
        game?: Game
    ): void {
        const gameSnapshot = structuredClone(this.context.game)
        let state = structuredClone(this.context.state)
        const results = new GameActionResults<T>([], state)
        for (const action of actions) {
            if (this.context.hasAction(action.id)) {
                continue
            }
            if (handling === ServerActionHandling.Execute) {
                if (action.source !== ActionSource.User) {
                    continue
                }
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
        if (results.processedActions.length > 0) {
            this.context.applyActionResults(results)
        }
        if (game !== undefined) {
            this.context.updateGame(game)
        }
    }

    replace(replay: ProcessedActionReplay, checksum: number, game?: Game): void {
        const replacement = this.context.clone()
        if (replay.startIndex > replacement.actions.length) {
            throw new Error('Processed Action replay starts beyond local Action History')
        }
        this.rollbackTo(replacement, replay.startIndex - 1)
        if (
            replacement.actions.length !== replay.startIndex ||
            replacement.state.actionCount !== replay.startIndex
        ) {
            throw new Error('Processed Action replay did not reach its starting state')
        }
        for (const action of replay.actions) {
            if (action.index !== replacement.actions.length) {
                throw new Error(
                    `Processed Action replay has Action ${action.id} at index ${action.index}, expected ${replacement.actions.length}`
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
        if (game !== undefined) {
            replacement.updateGame(game)
        }
        this.context.restoreFrom(replacement)
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
                action.index < 0 ||
                action.index >= this.context.actions.length
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
        this.context.restoreFrom(replacement)
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
        localActions: readonly GameAction[],
        serverActions: readonly GameAction[]
    ): boolean {
        return (
            !serverActions.some((action) => action.forwardPatch !== undefined) &&
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
        )
    }

    private rollbackTo(context: GameContext<T, U>, index: number): void {
        while (context.actions.length > 0 && context.actions.length - 1 !== index) {
            context.undoLastAction()
        }
    }
}
