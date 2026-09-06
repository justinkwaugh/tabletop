import {
    ExplorationHistory,
    getPrng,
    generateSeed,
    assertExists,
    type Visibility,
    GameAction,
    GameCategory,
    GameStorage,
    GameStatus,
    type Game,
    type GameState,
    type HydratedGameState,
    type User
} from '@tabletop/common'
import { GameContext } from './gameContext.svelte.js'
import type { AuthorizationBridge } from '$lib/services/bridges/authorizationBridge.svelte.js'
import type { GameService } from '$lib/services/gameService.js'
import { nanoid } from 'nanoid'
import type { GameUIRuntime } from '$lib/definition/gameUiDefinition.js'
import { fromStore } from 'svelte/store'

export type ExplorationStartCallback<T extends GameState, U extends HydratedGameState<T> & T> = (
    context: GameContext<T, U>
) => void
export type ExplorationEndCallback = () => void
export type ExplorationSwitchCallback<T extends GameState, U extends HydratedGameState<T> & T> = (
    context: GameContext<T, U>
) => void

export type ExplorationCallbacks<T extends GameState, U extends HydratedGameState<T> & T> = {
    onExplorationEnter?: ExplorationStartCallback<T, U>
    onExplorationEnd?: ExplorationEndCallback
    onExplorationSwitched?: ExplorationSwitchCallback<T, U>
}

export class GameExplorations<T extends GameState, U extends HydratedGameState<T> & T> {
    private sourceContext?: GameContext<T, U> = undefined
    explorationContext?: GameContext<T, U> = $state(undefined)
    private sourcePerspective?: Visibility.Perspective
    private initialChecksum: number | undefined = undefined
    private sessionUserStore: { current: User | undefined }

    constructor(
        private authorizationBridge: AuthorizationBridge,
        private gameService: GameService,
        private runtime: GameUIRuntime<T, U>,
        private callbacks?: ExplorationCallbacks<T, U>
    ) {
        this.sessionUserStore = fromStore(this.authorizationBridge.user)
    }

    async startExploring(
        gameContext: GameContext<T, U>,
        perspective?: Visibility.Perspective,
        fromHistory = false
    ): Promise<void> {
        this.sourcePerspective = perspective
        const explorationContext = fromHistory
            ? this.createExploration(gameContext)
            : await this.getNextExplorationContext(gameContext)

        if (explorationContext) {
            this.sourceContext = gameContext.clone()
            await this.setExplorationContext(explorationContext)

            if (this.callbacks?.onExplorationEnter) {
                this.callbacks.onExplorationEnter(explorationContext)
            }
        }
    }

    endExploring() {
        this.explorationContext = undefined
        this.sourceContext = undefined
        if (this.callbacks?.onExplorationEnd) {
            this.callbacks.onExplorationEnd()
        }
    }

    getCurrentExploration(): GameContext<T, U> | undefined {
        return this.explorationContext
    }

    hasUnsavedChanges(): boolean {
        const context = this.explorationContext
        return (
            context !== undefined &&
            context.game.storage === GameStorage.None &&
            context.state.actionChecksum !== this.initialChecksum
        )
    }

    async saveExploration(gameName: string) {
        const context = this.explorationContext
        if (!context) {
            return
        }
        context.engine.validateCanonicalState(context.state)
        const game = structuredClone(context.game)
        game.name = gameName
        game.storage = GameStorage.Local
        context.updateGame(game)

        await this.gameService.saveGameLocally({
            game: context.game,
            state: context.state,
            actions: context.actions
        })
    }

    async deleteExploration(gameId: string) {
        await this.gameService.deleteGame(gameId)

        if (this.explorationContext?.game.id === gameId) {
            if (this.sourceContext) {
                const explorationContext = await this.getNextExplorationContext(this.sourceContext)
                if (explorationContext) {
                    await this.setExplorationContext(explorationContext)
                }
            }

            if (!this.explorationContext) {
                this.endExploring()
            }
        }
    }

    async switchExploration(explorationId: string) {
        const context = await this.getExplorationContextForId(explorationId)
        if (context) {
            await this.setExplorationContext(context)
        }
    }

    async createNewExploration() {
        if (!this.sourceContext) {
            return
        }
        const explorationContext = this.createExploration(this.sourceContext)
        if (explorationContext) {
            await this.setExplorationContext(explorationContext)
        }
    }

    private createExploration(originalContext: GameContext<T, U>): GameContext<T, U> | undefined {
        const myUserId = this.sessionUserStore.current?.id
        if (!myUserId) return

        const newGameId = nanoid()
        const source = originalContext.clone({
            interceptGame: (game) => {
                delete game.state
                game.id = newGameId
                game.name = 'New Exploration'
                game.category = GameCategory.Exploration
                game.hotseat = true
                game.ownerId = myUserId
                game.storage = GameStorage.None
                game.parentId = originalContext.game.id
                game.result = originalContext.state.result
                game.status = game.result === undefined ? GameStatus.Started : GameStatus.Finished
                game.winningPlayerIds = [...originalContext.state.winningPlayerIds]
                game.activePlayerIds = [...originalContext.state.activePlayerIds]
                game.lastActionPlayerId = originalContext.actions.at(-1)?.playerId
                game.lastActionAt = originalContext.actions.at(-1)?.createdAt
                if (game.result === undefined) delete game.finishedAt
                for (const player of game.players) {
                    if (player.userId !== myUserId) player.userId = undefined
                }
            },
            interceptState: (state) => {
                state.id = nanoid()
                state.gameId = newGameId
            },
            interceptActions: (actions) => {
                for (const action of actions) action.gameId = newGameId
            }
        })
        const state = structuredClone(source.state)
        delete state.explorationState
        state.prng = { seed: generateSeed(), invocations: 0 }
        if ((state.systemVersion ?? 1) >= 3) {
            state.protectedPrng = { seed: generateSeed(), invocations: 0 }
        }
        const initializer = this.runtime.initializer
        let hypothetical: T
        if (this.sourcePerspective !== undefined) {
            assertExists(
                initializer.populateExplorationState,
                'This game does not support projected exploration'
            )
            hypothetical = initializer.populateExplorationState({
                game: source.game,
                state,
                actions: source.actions,
                perspective: this.sourcePerspective,
                random: getPrng()
            })
        } else {
            hypothetical = initializer.initializeExplorationState(state)
        }
        source.engine.validateCanonicalState(hypothetical)
        const history = new ExplorationHistory(source.engine)
        const pending = initializer.getExplorationActions?.(source.game, hypothetical)
        const lastAction = source.actions.at(-1)
        if (pending === undefined && this.sourcePerspective === undefined && lastAction) {
            // Older title initializers finish a partial cascade by re-executing its last Action.
            const before = source.engine.undoProcessedAction({
                action: lastAction,
                state: hypothetical
            })
            const result = source.engine.executeCanonicalAction({
                action: lastAction,
                state: before,
                game: source.game
            })
            const branchState = result.actionCascade.transitions.find(
                (transition) => transition.after.actionCount === source.state.actionCount
            )?.after
            assertExists(branchState, 'Exploration continuation did not reach the source position')
            result.updatedState.explorationState = history.checkpoint(
                source.state,
                branchState,
                source.actions,
                source.game
            )
            return new GameContext({
                runtime: this.runtime,
                game: source.game,
                state: result.updatedState,
                actions: [
                    ...source.actions,
                    ...result.processedActions.filter(
                        (action) =>
                            action.index !== undefined && action.index >= source.state.actionCount
                    )
                ]
            })
        }
        hypothetical.explorationState = history.checkpoint(
            source.state,
            hypothetical,
            source.actions,
            source.game
        )
        const context = new GameContext({
            runtime: this.runtime,
            game: source.game,
            state: hypothetical,
            actions: source.actions
        })
        for (const action of pending ?? []) context.applyAction(action)
        return context
    }

    private async getExplorationContextForId(
        explorationId: string
    ): Promise<GameContext<T, U> | undefined> {
        const { game, actions } = await this.gameService.loadGame(explorationId)

        if (!game || !game.state) {
            return
        }

        const state = game.state
        delete game.state

        const explorationContext = new GameContext<T, U>({
            runtime: this.runtime,
            game,
            state: state as T,
            actions
        })
        explorationContext.engine.validateCanonicalState(explorationContext.state)
        return explorationContext
    }

    private async getNextExplorationContext(
        gameContext: GameContext<T, U>
    ): Promise<GameContext<T, U> | undefined> {
        const explorations = this.gameService.getExplorations(gameContext.game.id)
        if (explorations.length === 0) {
            return this.createExploration(gameContext)
        } else {
            return this.getExplorationContextForId(explorations[0].id)
        }
    }

    private async setExplorationContext(gameContext: GameContext<T, U>) {
        const previousContext = this.explorationContext
        this.explorationContext = gameContext
        this.initialChecksum = gameContext.state.actionChecksum
        if (previousContext && this.callbacks?.onExplorationSwitched) {
            this.callbacks.onExplorationSwitched(this.explorationContext)
        }
    }
}
