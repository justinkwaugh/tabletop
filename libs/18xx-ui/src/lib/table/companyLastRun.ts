import type { GameAction } from '@tabletop/common'
import { isRunTrains } from '@tabletop/18xx'

export function companyLastRun(actions: readonly GameAction[], actionCount: number, companyId: string) {
    return actions.slice(0, actionCount).filter(isRunTrains)
        .findLast((action) => action.companyId === companyId)
}
