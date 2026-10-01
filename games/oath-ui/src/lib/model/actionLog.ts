import type { GameAction } from '@tabletop/common'
import { isCompleteRest, isResolveWake, type WinRule } from '@tabletop/oath'
import { isWinRule } from '$lib/model/endings.js'

// R-3 — the ending action records `metadata.wonBy`; R-3.3's die is read back, never recomputed.
export function recordedWinRule(actions: readonly GameAction[]): WinRule | undefined {
    for (let i = actions.length - 1; i >= 0; i--) {
        const action = actions[i]
        const wonBy =
            isResolveWake(action) || isCompleteRest(action) ? action.metadata?.wonBy : undefined
        if (wonBy !== undefined && isWinRule(wonBy)) return wonBy
    }
    return undefined
}

// R-3.3 — the last face the end die showed.
export function lastEndDieRoll(actions: readonly GameAction[]): number | undefined {
    for (let i = actions.length - 1; i >= 0; i--) {
        const action = actions[i]
        const roll = isCompleteRest(action) ? action.metadata?.endDieRoll : undefined
        if (roll !== undefined) return roll
    }
    return undefined
}
