import { MachineState } from '../definition/states.js'
import type { TurnState } from '../model/turn.js'

// R-2.2, R-2.2-H1, R-2.2-H2: the first placement or scrap opens from trading; the rest follow.
export const PLACEMENT_STATES: readonly MachineState[] = [
    MachineState.TradingBeforePlacing,
    MachineState.Placing
]

// R-3.3-H1, R-6.3-H2: three placements made, fewer when the bag ran dry, or no turn piece left.
export function placingHasEnded(turn: TurnState): boolean {
    return turn.placementsLeft === 0 || turn.pieces.length === 0
}

// R-2.2-H1, R-2.2-H2: a placement or a scrap keeps trading closed until placing has ended.
export function stateAfterPlacingStep(
    turn: TurnState
): MachineState.Placing | MachineState.TradingAfterPlacing {
    return placingHasEnded(turn) ? MachineState.TradingAfterPlacing : MachineState.Placing
}
