import { MachineState } from '@tabletop/lowenherz'
import type { LowenherzGameSession } from './session.svelte.js'

// Shared between DeckPiles.svelte (renders the interactive card + pills) and
// ActionCardArea.svelte (renders the per-slot status text) - both need to know who's
// picked which slot.

export function playerName(gameSession: LowenherzGameSession, playerId: string): string {
    return gameSession.game.players.find((p) => p.id === playerId)?.name ?? playerId
}

// A slot's placement phase: the winner still has walls/knights to place, or a politics
// card to draw, before the action they won is actually done.
const PLACEMENT_STATES: MachineState[] = [
    MachineState.PlacingWalls,
    MachineState.PlacingKnights,
    MachineState.TakingPoliticsCard
]

export function decisionsForSlot(gameSession: LowenherzGameSession, slot: 1 | 2 | 3): string[] {
    // A resolved slot keeps its decisions in state - they are the record of who laid what this
    // round - but its markers have nothing left to say once the winner has actually taken the
    // action: the contest is settled and there is nothing left to act on. Leaving them up meant a
    // card that accumulated names as the round went on, so by the last slot the pills were mostly
    // history rather than anything to act on.
    //
    // Which also leaves the markers meaning exactly one thing while a negotiation is open: the two
    // names still on the card are the two players negotiating, on the slot they are negotiating
    // over.
    //
    // Resolved doesn't mean finished, though: a border/knight/politics winner still has to place
    // their walls/knights or draw their card, and resolvedSlots is pushed the moment the contest
    // is settled - before that placement phase runs (see isFreshestResolvedSlot). So the freshest
    // resolved slot keeps its markers for as long as its placement phase is still the current
    // machine state; only once the winner finishes (or the phase never opened - Money Bag, or a
    // winner capped/stocked/carded out with nothing to place) do the markers come down.
    const isResolved = gameSession.gameState.resolvedSlots.some((resolved) => resolved.slot === slot)
    if (isResolved) {
        const stillPlacing =
            gameSession.isFreshestResolvedSlot(slot) &&
            PLACEMENT_STATES.includes(gameSession.gameState.machineState)
        if (!stillPlacing) return []
    }
    return gameSession.gameState.decisions.filter((d) => d.slot === slot).map((d) => d.playerId)
}
