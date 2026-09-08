import {
    assertExists,
    type GameState,
    type HydratedGameState,
    type Visibility
} from '@tabletop/common'
import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
import type { HarnessAppContext } from './harnessContext.js'
import { HarnessHostApi } from './harnessHostApi.js'

export class HarnessSessions {
    session: GameSession<GameState, HydratedGameState> | undefined = $state.raw()
    protectedMode = $state(false)
    selectedView = $state('')
    loading = $state(false)
    error: string | undefined = $state()
    failedGameId: string | undefined = $state()
    private bridge?: BridgedContext
    private disposed = false

    constructor(
        private readonly app: HarnessAppContext,
        private readonly definition: GameUiDefinition<GameState, HydratedGameState>
    ) {}

    async load(gameId: string, protectedMode = this.protectedMode, view = this.selectedView) {
        if (this.disposed || this.loading || this.session?.busy) return
        const historyIndex =
            this.session?.primaryGame.id === gameId && this.session.history.inHistory
                ? this.session.currentActionIndex
                : undefined
        this.loading = true
        this.error = undefined
        this.failedGameId = undefined
        this.clearSession()
        try {
            const { gameService, authorizationService, notificationService, chatService } = this.app
            const runtime = await this.definition.runtime()
            let { game, actions } = await gameService.loadGame(gameId)
            assertExists(game, 'Local game is unavailable')
            assertExists(game.state, 'Local game has no state')
            let api = this.app.api
            let hostPerspective: Visibility.Perspective | undefined
            if (protectedMode) {
                assertExists(runtime.visibility, 'Protected mode requires a visibility definition')
                if (
                    !['host', 'spectator'].includes(view) &&
                    !game.players.some((player) => player.id === view)
                ) {
                    view = game.state.activePlayerIds[0] ?? game.players[0]?.id ?? 'spectator'
                }
                hostPerspective =
                    view === 'host' || view === 'spectator'
                        ? { kind: 'spectator' }
                        : { kind: 'player', playerId: view }
                api = new HarnessHostApi(gameService, runtime, hostPerspective)
                const projected = await api.getGame(
                    gameId,
                    view === 'host' ? { hostView: true } : undefined
                )
                game = projected.game
                actions = projected.actions
            }
            if (this.disposed) return
            assertExists(game.state, 'Game representation has no state')
            this.protectedMode = protectedMode
            this.selectedView = view
            chatService.setGame(game)
            this.bridge = new BridgedContext({
                authorizationService,
                gameService,
                chatService,
                gameId
            })
            const session = new runtime.sessionClass({
                gameService,
                bridgedContext: this.bridge,
                notificationService,
                chatService,
                api,
                runtime,
                game,
                state: game.state,
                actions,
                hostPerspective
            })
            this.session = session
            if (protectedMode && view === 'host') await session.setPrivilegedGameViewEnabled(true)
            if (historyIndex !== undefined)
                await session.history.goToActionIndex(historyIndex, {
                    exact: true,
                    animationIntent: 'silent-swap'
                })
            if (this.disposed) {
                session.dispose()
                return
            }
        } catch (error) {
            this.failedGameId = gameId
            this.error = error instanceof Error ? error.message : 'Unable to load game'
            this.clearSession()
        } finally {
            this.loading = false
        }
    }

    dispose() {
        this.disposed = true
        this.clearSession()
    }

    private clearSession() {
        this.session?.history.stopHistoryPlayback()
        this.session?.dispose()
        this.session = undefined
        this.bridge?.dispose()
        this.bridge = undefined
    }
}
