import { getSquare, SquareType } from '../model/board.js'
import type { HydratedLowenherzGameState } from '../model/gameState.js'

export type HillScoringEntry = { playerId: string; points: number }

// Silver Mine and King is Dead cards both award 1 power point per hill space enclosed
// in each player's region(s). Returns only the players who actually scored (a no-op,
// empty result, until region-creation exists), so callers can attach it to an action's
// metadata for history/description purposes.
export function awardHillPowerPoints(state: HydratedLowenherzGameState): HillScoringEntry[] {
    const scored: HillScoringEntry[] = []

    for (const playerState of state.players) {
        let hillCount = 0
        for (const region of state.regions) {
            if (region.ownerColor !== playerState.color) continue
            for (const key of region.squareKeys) {
                const [col, row] = key.split(',').map(Number)
                if (getSquare(state.board, col, row)?.type === SquareType.Hill) hillCount++
            }
        }
        if (hillCount > 0) {
            playerState.powerPoints += hillCount
            scored.push({ playerId: playerState.playerId, points: hillCount })
        }
    }

    return scored
}
