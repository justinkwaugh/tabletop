import type { OathGameSession } from './session.svelte.js'

/** The seat sheet opened from a seat card; it belongs to one table, so it lives on its session. */
export class SeatDetail {
    private playerId = $state<string | null>(null)

    constructor(private readonly session: OathGameSession) {}

    get openPlayerId(): string | null {
        const playerId = this.playerId
        return playerId !== null &&
            this.session.gameState.players.some((player) => player.playerId === playerId)
            ? playerId
            : null
    }

    toggle(playerId: string): void {
        this.playerId = this.openPlayerId === playerId ? null : playerId
    }

    close(): void {
        this.playerId = null
    }
}
