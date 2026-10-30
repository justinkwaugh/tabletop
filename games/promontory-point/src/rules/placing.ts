import type { TurnState } from '../model/turn.js'

// R-3.3-H1, R-6.3-H2: three placements made, fewer when the bag ran dry, or no turn piece left.
export function placingHasEnded(turn: TurnState): boolean {
    return turn.placementsLeft === 0 || turn.pieces.length === 0
}
