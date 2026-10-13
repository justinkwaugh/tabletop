import * as Value from 'typebox/value'
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

export interface OptimisticSubmission<T extends GameState, U extends HydratedGameState<T> & T> {
    before: GameContext<T, U>
    result: ActionResults<T>
}

type SyncAnswer = Pick<
    Awaited<ReturnType<RemoteApiService['checkSync']>>,
    'status' | 'actions' | 'checksum'
>

export type SubmissionAnswer = Awaited<ReturnType<RemoteApiService['applyAction']>>

export class GameReconciliation<T extends GameState, U extends HydratedGameState<T> & T> {
    constructor(private readonly context: GameContext<T, U>) {}

    catchUp(answer: SyncAnswer): boolean {
        const prior = this.context.clone()
        let caughtUp = false
        try {
            caughtUp = this.applySyncAnswer(answer)
        } finally {
            if (!caughtUp) this.context.restoreFrom(prior)
        }
        return caughtUp
    }

    private applySyncAnswer({ status, actions, checksum }: SyncAnswer): boolean {
        let needsResync = status !== GameSyncStatus.InSync
        if (!needsResync && actions.length > 0) {
            this.apply(
                actions,
                Visibility.getGameVisibility(this.context.game, this.context.runtime) === undefined
                    ? ServerActionHandling.Execute
                    : ServerActionHandling.ApplyProcessed
            )
            needsResync = this.context.state.actionChecksum !== checksum
        }
        return !needsResync || this.tryResync(actions, checksum)
    }

    acceptSubmission(
        actionId: string,
        response: SubmissionAnswer,
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
        if (!applyAccepted && !this.canKeepOptimisticResult(optimistic, response.actions)) {
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

    continues(actions: readonly GameAction[]): boolean {
        const next = actions.find((action) => !this.context.hasAction(action.id))
        return next?.index === undefined || next.index <= this.context.state.actionCount
    }

    applyProcessed(actions: readonly GameAction[]): void {
        this.apply(actions, ServerActionHandling.ApplyProcessed)
    }

    apply(actions: readonly GameAction[], handling: ServerActionHandling, game?: Game): void {
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
        if (results.processedActions.length > 0) {
            this.context.applyActionResults(results)
        }
        if (game !== undefined) {
            this.context.updateGame(game)
        }
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
        return Value.Equal(confirmedState, optimistic.result.updatedState)
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
