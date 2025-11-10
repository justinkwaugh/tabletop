import { GameSession } from '$lib/model/gameSession.svelte'
import type { TabletopApi } from '$lib/network/tabletopApi.svelte'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import type { NotificationService } from '$lib/services/notificationService.svelte'
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
import type { GameService } from '$lib/services/gameService.svelte'

export interface GameSessionConstructor<T extends GameState, U extends HydratedGameState & T> {
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
        api: TabletopApi
        definition: GameUiDefinition<T, U>
        game: Game
        state: T
        actions: GameAction[]
        debug?: boolean
    }): GameSession<T, U>
}

export interface GameUiDefinition<T extends GameState, U extends HydratedGameState & T>
    extends GameDefinition {
    getTableComponent: () => Promise<Component>
    sessionClass: GameSessionConstructor<T, U>
    colorizer: GameColorizer
    thumbnailUrl: string
}
