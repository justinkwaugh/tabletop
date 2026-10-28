import { HydratedOathGameState } from '../model/gameState.js'
import type { OpenDeal } from '../model/question.js'
import { dropOpenDealsAtGameEnd } from './deals.js'
import { stableRegimeWinner } from './victory.js'

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
        state.winningPlayerIds = [outcome.winnerPlayerId]
        return { wonBy: outcome.rule, ...dropOpenDealsAtGameEnd(state) }
    }
    state.round += 1
    return {}
}

/**
 * Squalid District — one step up or down changes whether the game ends only from the threshold
 * (lowered, it ends nothing) or one below it (raised, it ends the game) (R-3.3).
 */
export function endDieStepMatters(roll: number, threshold: number): boolean {
    return roll === threshold - 1 || roll === threshold
}
