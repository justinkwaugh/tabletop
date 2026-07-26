import type { LowenherzGameSession } from './session.svelte.js'

// Shared between DeckPiles.svelte (renders the interactive card + pills) and
// ActionCardArea.svelte (renders the per-slot status text) - both need to know who's
// picked which slot.

export function playerName(gameSession: LowenherzGameSession, playerId: string): string {
    return gameSession.game.players.find((p) => p.id === playerId)?.name ?? playerId
}

export function decisionsForSlot(gameSession: LowenherzGameSession, slot: 1 | 2 | 3): string[] {
    return gameSession.gameState.decisions.filter((d) => d.slot === slot).map((d) => d.playerId)
}
