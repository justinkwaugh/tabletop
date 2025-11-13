import {
    ExplorationState,
    GameAction,
    GameCategory,
    GameStorage,
    type Game,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import { GameContext } from './gameContext.svelte.js'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte.js'
import type { GameService } from '$lib/services/gameService.svelte.js'
import { nanoid } from 'nanoid'
import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'

export type ExplorationStartCallback<T extends GameState, U extends HydratedGameState & T> = (
    context: GameContext<T, U>
) => void
export type ExplorationEndCallback = () => void
export type ExplorationSwitchCallback<T extends GameState, U extends HydratedGameState & T> = (
    context: GameContext<T, U>
) => void

export type ExplorationCallbacks<T extends GameState, U extends HydratedGameState & T> = {
    onExplorationEnter?: ExplorationStartCallback<T, U>
    onExplorationEnd?: ExplorationEndCallback
    onExplorationSwitched?: ExplorationSwitchCallback<T, U>
}

export class GameExplorations<T extends GameState, U extends HydratedGameState & T> {
    private sourceContext?: GameContext<T, U> = undefined
    explorationContext?: GameContext<T, U> = $state(undefined)
    private initialChecksum: number | undefined = undefined

    constructor(
        private authorizationService: AuthorizationService,
        private gameService: GameService,
        private definition: GameUiDefinition<T, U>,
        private callbacks?: ExplorationCallbacks<T, U>
    ) {}

    async startExploring(gameContext: GameContext<T, U>): Promise<void> {
        const explorationContext = await this.getNextExplorationContext(gameContext)

        if (explorationContext) {
            this.sourceContext = gameContext
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
        const game = context.game
        game.name = gameName
        game.storage = GameStorage.Local
        context.updateGame(game)

        await this.gameService.saveGameLocally({
            game: context.game,
            state: context.state,
            actions: $state.snapshot(context.actions)
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
        const myUserId = this.authorizationService.getSessionUser()?.id
        if (!myUserId) {
            return
        }

        const newGameId = nanoid()

        const newExplorationContext = originalContext.clone({
            interceptGame: (game: Game) => {
                game.id = newGameId
                game.name = 'New Exploration'
                game.category = GameCategory.Exploration
                game.hotseat = true
                game.ownerId = myUserId
                game.storage = GameStorage.None
                game.parentId = originalContext.game.id
                for (const player of game.players) {
                    if (player.userId !== myUserId) {
                        player.userId = undefined
                    }
                }
            },
            interceptState: (state: T) => {
                state.id = nanoid()
                state.gameId = newGameId

                // Allow the game to address any random initialization it needs
                const initializedState = this.definition.initializer.initializeExplorationState(
                    state
                ) as T
                Object.assign(state, initializedState)

                // Set our state so we can adjust the prng
                const explorationState: ExplorationState = {
                    actionCount: state.actionCount,
                    invocations: Math.floor(Math.random() * 500)
                }
                state.explorationState = explorationState
                state.prng.invocations = explorationState.invocations
            },
            interceptActions: (actions: GameAction[]) => {
                for (const action of actions) {
                    action.gameId = newGameId
                }
            }
        })

        // Sometimes when given a context with a history of actions, we are given as our last action an action that produces
        // additional actions, like drawing a stall tile in Fresh Fish produces a Start Auction action.
        // This leaves us in a weird state where we are missing those follow-up actions.

        // This maybe should be done in the history itself, but we will just do it here for now.
        const lastAction = newExplorationContext.undoLastAction()
        if (lastAction) {
            newExplorationContext.applyAction(lastAction)
        }

        return newExplorationContext
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
            definition: this.definition,
            game,
            state: state as T,
            actions
        })
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
