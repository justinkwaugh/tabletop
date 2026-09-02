import { getSquare, SquareType } from '../model/board.js'
import type { HydratedLowenherzGameState } from '../model/gameState.js'

export type HillScoringEntry = { playerId: string; points: number }

// Silver Mine and King is Dead cards both award 1 power point per hill space enclosed
// in each player's region(s). Returns an entry for every player, including the ones
// who gained nothing (points: 0, currently everyone until region-creation exists), so
// callers can attach the full result to an action's metadata and history can report
// what happened - or didn't - for each player rather than silently omitting them.
export function awardHillPowerPoints(state: HydratedLowenherzGameState): HillScoringEntry[] {
    const scored: HillScoringEntry[] = []

    for (const playerState of state.players) {
        let hillCount = 0
        for (const region of state.regions) {
            if (region.owner !== playerState.playerId) continue
            for (const key of region.squareKeys) {
                const [col, row] = key.split(',').map(Number)
                if (getSquare(state.board, col, row)?.type === SquareType.Hill) hillCount++
            }
        }
        if (hillCount > 0) playerState.powerPoints += hillCount
        scored.push({ playerId: playerState.playerId, points: hillCount })
    }

    return scored
}
