import type { GameSession } from '$lib/model/gameSession.svelte'
import type { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
import type { NotificationService } from '$lib/services/notificationService.js'
import type {
    Game,
    GameAction,
    GameInfo,
    GameRuntime,
    GameState,
    HydratedGameState
} from '@tabletop/common'
import { type Component } from 'svelte'
import type { GameColorizer } from './gameColorizer'
import type { ChatService } from '$lib/services/chatService'
import type { GameService } from '$lib/services/gameService.js'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'
import type { DynamicComponent } from '$lib/utils/dynamicComponent.js'

export type GameTable<T extends GameState, U extends HydratedGameState<T> & T> = Component<{
    gameSession: GameSession<T, U>
}>
export interface GameSessionConstructor<T extends GameState, U extends HydratedGameState<T> & T> {
    new ({
        gameService,
        bridgedContext,
        notificationService,
        chatService,
        api,
        runtime,
        game,
        state,
        actions,
        debug
    }: {
        gameService: GameService
        bridgedContext: BridgedContext
        notificationService: NotificationService
        chatService: ChatService
        api: RemoteApiService
        runtime: GameUIRuntime<T, U>
        game: Game
        state: T
        actions: GameAction[]
        debug?: boolean
    }): GameSession<T, U>
}

export type GameUIInfo = GameInfo & {
    thumbnailUrl: string
}

export interface GameUIRuntime<T extends GameState, U extends HydratedGameState<T> & T>
    extends GameRuntime<T, U> {
    gameUI: DynamicComponent<GameTable<T, U>>
    sessionClass: GameSessionConstructor<T, U>
    colorizer: GameColorizer
}

export type GameUiDefinition<T extends GameState, U extends HydratedGameState<T> & T> = {
    info: GameUIInfo
    runtime: () => Promise<GameUIRuntime<T, U>>
}
