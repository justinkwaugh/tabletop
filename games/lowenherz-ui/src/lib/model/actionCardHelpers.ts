import type { LowenherzGameSession } from './session.svelte.js'

// Shared between DeckPiles.svelte (renders the interactive card + pills) and
// ActionCardArea.svelte (renders the per-slot status text) - both need to know who's
// picked which slot.

export function playerName(gameSession: LowenherzGameSession, playerId: string): string {
    return gameSession.game.players.find((p) => p.id === playerId)?.name ?? playerId
}

export function decisionsForSlot(gameSession: LowenherzGameSession, slot: 1 | 2 | 3): string[] {
    // A resolved slot keeps its decisions in state - they are the record of who laid what this
    // round - but its markers have nothing left to say: the contest is settled and the winner has
    // taken it. Leaving them up meant a card that accumulated names as the round went on, so by the
    // last slot the pills were mostly history rather than anything to act on.
    //
    // Which also leaves the markers meaning exactly one thing while a negotiation is open: the two
    // names still on the card are the two players negotiating, on the slot they are negotiating
    // over.
    if (gameSession.gameState.resolvedSlots.some((resolved) => resolved.slot === slot)) return []
    return gameSession.gameState.decisions.filter((d) => d.slot === slot).map((d) => d.playerId)
}
