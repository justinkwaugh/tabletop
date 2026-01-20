import type { Game } from '@tabletop/common'
import type { GameService } from '$lib/services/gameService.js'
import { writable, type Writable } from 'svelte/store'

export class GameServiceBridge {
    readonly explorations: Writable<Game[]>

    constructor(
        private gameService: GameService,
        private gameId: string
    ) {
        this.explorations = writable(this.gameService.getExplorations(this.gameId))
    }

    connect() {
        $effect(() => {
            this.explorations.set(this.gameService.getExplorations(this.gameId))
        })
    }
}
