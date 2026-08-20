import { HydratedLowenherzGameState } from '../model/gameState.js'

// What's still on the table for the winner of a knight action ("single sword and
// shield" / "two swords and two shields"). The rulebook makes a sword spendable on
// either half of the action - "place a knight (see below) or expand a region (see
// below)" - and a two-sword card explicitly on one of each, "in either order", but
// never on two expansions: "using this action to expand twice is not allowed".
//
// Deliberately does NOT check whether a legal square actually exists for a knight
// (that's a board scan, and PlaceKnight's own validation is the authority) - this is
// about what the ACTION still permits, which is what both the state handler and the
// resolution step need to decide whether the phase has anything left to offer.
export type KnightActionOptions = {
    canPlaceKnight: boolean
    canStartExpansion: boolean
    canContinueExpansion: boolean
}

export function knightActionOptions(
    state: HydratedLowenherzGameState,
    playerId: string
): KnightActionOptions {
    const playerState = state.getPlayerState(playerId)
    const swordsLeft = state.knightsRemaining ?? 0
    return {
        // "If he has no more knights, he may place no more" - an empty stock closes
        // this half of the action off, without touching the expanding half below.
        canPlaceKnight: swordsLeft > 0 && playerState.knightsInStock > 0,
        canStartExpansion:
            swordsLeft > 0 &&
            !state.expansionUsed &&
            state.regions.some((r) => r.ownerColor === playerState.color),
        // The optional 2nd space of an expansion already under way - part of the sword
        // already spent on it, so it costs nothing further and ignores expansionUsed.
        canContinueExpansion: state.expandingRegionId !== undefined
    }
}

export function hasKnightActionOptions(
    state: HydratedLowenherzGameState,
    playerId: string
): boolean {
    const options = knightActionOptions(state, playerId)
    return options.canPlaceKnight || options.canStartExpansion || options.canContinueExpansion
}
