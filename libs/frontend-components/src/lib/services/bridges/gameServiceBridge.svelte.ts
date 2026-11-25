import type { Game, PlayerVote } from '@tabletop/common'
import type { GameService } from '$lib/services/gameService.js'
import { RuneBackedStore } from '$lib/utils/runeBackedStore.svelte.js'

export class GameServiceBridge {
    readonly explorations: RuneBackedStore<Game[]>
    // Optional for the Game Session reading it: a Site Frontend built before it supplies a bridge
    // without it (ADR 0004).
    readonly playerVote?: RuneBackedStore<PlayerVote | undefined>

    constructor(
        private gameService: GameService,
        private gameId: string
    ) {
        this.explorations = new RuneBackedStore(() => this.gameService.getExplorations(this.gameId))
        this.playerVote = new RuneBackedStore(() => this.gameService.getPlayerVote(this.gameId))
    }

    connect() {
        this.explorations.connect()
        this.playerVote?.connect()
    }
}
