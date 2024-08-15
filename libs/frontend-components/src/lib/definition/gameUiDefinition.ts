import { GameSession } from '$lib/model/gameSession.svelte'
import type { TabletopApi } from '$lib/network/tabletopApi'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte'
import type { NotificationService } from '$lib/services/notificationService.svelte'
import { Game, GameAction, type GameDefinition } from '@tabletop/common'
import type { Component } from 'svelte'

export interface GameSessionConstructor {
    new ({
        authorizationService,
        notificationService,
        api,
        definition,
        game,
        actions,
        debug
    }: {
        authorizationService: AuthorizationService
        notificationService: NotificationService
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
}
