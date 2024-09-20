import { GameSession } from '$lib/model/gameSession.svelte'
import type { TabletopApi } from '$lib/network/tabletopApi.svelte'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import type { NotificationService } from '$lib/services/notificationService.svelte'
import { Game, GameAction, type GameDefinition } from '@tabletop/common'
import type { Component } from 'svelte'
import type { GameColorizer } from './gameColorizer'
import type { ChatService } from '$lib/services/chatService'

export interface GameSessionConstructor {
    new ({
        authorizationService,
        notificationService,
        chatService,
        api,
        definition,
        game,
        actions,
        debug
    }: {
        authorizationService: AuthorizationService
        notificationService: NotificationService
        chatService: ChatService
        api: TabletopApi
        definition: GameUiDefinition
        game: Game
        actions: GameAction[]
        debug?: boolean
    }): GameSession
}

export interface GameUiDefinition extends GameDefinition {
    getTableComponent: () => Promise<Component>
    sessionClass: GameSessionConstructor
    colorizer: GameColorizer
    thumbnailUrl: string
}
