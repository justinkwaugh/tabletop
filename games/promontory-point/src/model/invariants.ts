import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { SHARES_PER_RAILROAD } from '../components/shares.js'
import { TRACK_PIECES_PER_RAILROAD } from '../components/trackPieces.js'
import type { PromontoryPointGameState } from './gameState.js'
import { keptPieces, sharesHeld } from './playerState.js'
import { PLACEMENTS_PER_TURN } from './turn.js'

export function invariantsHold(state: PromontoryPointGameState): boolean {
    return (
        piecesConserved(state) &&
        sharesConserved(state) &&
        handCountsMatch(state) &&
        placementsWithinTurn(state)
    )
}

// R-1.1: 24 = bag + hands + kept pieces + turn pieces + board + scrapped, per railroad.
export function piecesConserved(state: PromontoryPointGameState): boolean {
    if (state.bag.items.length !== state.bag.remaining) {
        return false
    }
    const pieces: RailroadId[] = [
        ...state.bag.items,
        ...state.players.flatMap((player) => [...player.hand, ...keptPieces(player)]),
        ...(state.turn?.pieces ?? []),
        ...Object.values(state.track)
    ]
    return RAILROAD_IDS.every(
        (railroadId) =>
            pieces.filter((piece) => piece === railroadId).length + state.scrapped[railroadId] ===
            TRACK_PIECES_PER_RAILROAD
    )
}

// R-1.1, R-1.3 step 4: 11 = share deck + holdings; the deck is derived, so holdings never exceed 11.
function sharesConserved(state: PromontoryPointGameState): boolean {
    return RAILROAD_IDS.every(
        (railroadId) => sharesHeld(state.players, railroadId) <= SHARES_PER_RAILROAD
    )
}

function handCountsMatch(state: PromontoryPointGameState): boolean {
    return state.players.every((player) => player.handCount === player.hand.length)
}

// R-2.2 step 3, R-3.3-H1
function placementsWithinTurn(state: PromontoryPointGameState): boolean {
    return (
        state.turn === undefined ||
        state.turn.placementsMade + state.turn.placementsLeft <= PLACEMENTS_PER_TURN
    )
}
