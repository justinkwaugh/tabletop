import type { Game } from '@tabletop/common'
import type { GameService } from '$lib/services/gameService.js'
import { RuneBackedStore } from '$lib/utils/runeBackedStore.svelte.js'

export class GameServiceBridge {
    readonly explorations: RuneBackedStore<Game[]>

    constructor(
        private gameService: GameService,
        private gameId: string
    ) {
        this.explorations = new RuneBackedStore(() => this.gameService.getExplorations(this.gameId))
    }

    connect() {
        this.explorations.connect()
    }
}
