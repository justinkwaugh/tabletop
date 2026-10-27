import { HydratedOathGameState } from '../model/gameState.js'
import type { OpenDeal } from '../model/question.js'
import { dropOpenDealsAtGameEnd } from './deals.js'
import { stableRegimeWinner } from './victory.js'
import { recordWin } from './chronicle.js'

/**
 * R-3.3, R-3.3.1 — the end die read: the game ends and the Empire wins, dropping the Tribunal deals
 * still open (R-7.6.3-H1), or the round marker advances (R-4).
 */
export function settleEndDie(
    state: HydratedOathGameState,
    roll: number
): { wonBy?: string; openDealsDropped?: OpenDeal[] } {
    const outcome = stableRegimeWinner(state, roll)
    if (outcome) {
        recordWin(state, outcome)
        return { wonBy: outcome.rule, ...dropOpenDealsAtGameEnd(state) }
    }
    state.round += 1
    return {}
}
