import { GameSession } from '$lib/model/gameSession.svelte'
import type { AuthorizationService } from '$lib/services/authorizationService.js'
import type { NotificationService } from '$lib/services/notificationService.js'
import {
    Game,
    GameAction,
    GameState,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import type { Component } from 'svelte'
import type { GameColorizer } from './gameColorizer'
import type { ChatService } from '$lib/services/chatService'
import type { GameService } from '$lib/services/gameService.js'
import type { RemoteApiService } from '$lib/services/remoteApiService.js'

export interface GameSessionConstructor<
    T extends GameState,
    U extends HydratedGameState<T> & T
> {
    new ({
        gameService,
        authorizationService,
        notificationService,
        chatService,
        api,
        definition,
        game,
        state,
        actions,
        debug
    }: {
        gameService: GameService
        authorizationService: AuthorizationService
        notificationService: NotificationService
        chatService: ChatService
        api: RemoteApiService
        definition: GameUiDefinition<T, U>
        game: Game
        state: T
        actions: GameAction[]
        debug?: boolean
    }): GameSession<T, U>
}

export interface GameUiDefinition<T extends GameState, U extends HydratedGameState<T> & T>
    extends GameDefinition<T, U> {
    getTableComponent: () => Promise<Component>
    sessionClass: GameSessionConstructor<T, U>
    colorizer: GameColorizer
    thumbnailUrl: string
}
