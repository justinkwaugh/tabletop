import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { Pact, ShipState } from './pieces.js'

// The pacts' effects on Branches, kept apart from the pact rules so the checks on ships can
// read them without the rules' dependencies.

export function isClosed(state: HydratedStellarHorizonsGameState, playerId: string) {
    const span = state.parallelSpan
    return (
        span !== undefined &&
        (span.closedPlayerIds.includes(playerId) || span.mergedPlayerIds.includes(playerId))
    )
}

// A pending proposal naming a Player whose Branch has closed lapses; nothing is written, it is
// read from the span record (Common Actions rule 6).
export function hasLapsed(state: HydratedStellarHorizonsGameState, candidate: Pact): boolean {
    return (
        !candidate.agreed &&
        candidate.terms.partnerIds.some((playerId) => isClosed(state, playerId))
    )
}

export function standingPacts(state: HydratedStellarHorizonsGameState): Pact[] {
    return state.pacts.filter((candidate) => !hasLapsed(state, candidate))
}

// Ships a Player's Branch may not use: those they pledged in a standing offer they made or
// accepted, and those in an agreed pact (Common Actions rule 7).
export function heldShipIds(state: HydratedStellarHorizonsGameState, playerId: string): string[] {
    return standingPacts(state)
        .filter((candidate) => candidate.agreed || candidate.acceptedIds.includes(playerId))
        .flatMap((candidate) => candidate.terms.pledges[playerId] ?? [])
}

export function isHeld(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return state.pacts.length > 0 && heldShipIds(state, ship.playerId).includes(ship.shipId)
}
