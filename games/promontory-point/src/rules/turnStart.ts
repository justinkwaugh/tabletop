import type { RailroadId } from '../components/railroads.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { PLACEMENTS_PER_TURN } from '../model/turn.js'

// R-2.2 step 1, R-5, R-6.3-H2: the hand, and any kept piece, turn face up as the turn pieces.
export function revealTurnPieces(
    state: HydratedPromontoryPointGameState,
    playerId: string
): RailroadId[] {
    const player = state.getPlayerState(playerId)
    const pieces: RailroadId[] = [
        ...player.knownHand(),
        ...(player.keptPiece === undefined ? [] : [player.keptPiece])
    ]
    player.hand = []
    player.handCount = 0
    delete player.keptPiece
    state.turn = {
        pieces,
        tradesUsed: 0,
        placementsMade: 0,
        placementsLeft: PLACEMENTS_PER_TURN
    }
    return pieces
}
