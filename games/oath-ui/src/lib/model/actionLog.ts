import type { GameAction } from '@tabletop/common'
import { isCompleteRest, isRollEndDie } from '@tabletop/oath'

/** R-3.3 — the last face the end die showed: the Chancellor's roll, or the Rest's in a game recorded before it (R-X.4). */
export function lastEndDieRoll(actions: readonly GameAction[]): number | undefined {
    for (let i = actions.length - 1; i >= 0; i--) {
        const action = actions[i]
        const roll = isRollEndDie(action)
            ? action.metadata?.roll
            : isCompleteRest(action)
              ? action.metadata?.endDieRoll
              : undefined
        if (roll !== undefined) return roll
    }
    return undefined
}
