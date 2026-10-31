import * as Type from 'typebox'
import { RailroadIdSchema } from './schemas.js'

// R-2.2 step 2
export const TRADES_PER_TURN = 2
// R-2.2 step 3, R-6.3
export const PLACEMENTS_PER_TURN = 3

export type TurnState = Type.Static<typeof TurnState>
export const TurnState = Type.Object({
    // R-2.2 step 1, R-3.3-H1: the revealed turn pieces not yet placed or scrapped.
    pieces: Type.Array(RailroadIdSchema),
    tradesUsed: Type.Integer({ minimum: 0, maximum: TRADES_PER_TURN }),
    placementsMade: Type.Integer({ minimum: 0, maximum: PLACEMENTS_PER_TURN }),
    placementsLeft: Type.Integer({ minimum: 0, maximum: PLACEMENTS_PER_TURN })
})

export function tradesLeft(turn: TurnState): number {
    return TRADES_PER_TURN - turn.tradesUsed
}
