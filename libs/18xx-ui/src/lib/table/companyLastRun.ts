import type { GameAction } from '@tabletop/common'
import { isDistributeEarnings, isRunTrains, type RunTrains } from '@tabletop/18xx'

export type CompanyLastRun = { run: RunTrains; withheld: boolean }

export function companyLastRun(
    actions: readonly GameAction[],
    actionCount: number,
    companyId: string
): CompanyLastRun | undefined {
    let lastRun: CompanyLastRun | undefined
    for (const action of actions.slice(0, actionCount)) {
        if (isRunTrains(action) && action.companyId === companyId) {
            lastRun = { run: action, withheld: false }
        } else if (
            lastRun &&
            isDistributeEarnings(action) &&
            action.companyId === companyId &&
            action.metadata?.round
        ) {
            lastRun.withheld = action.choice === 'withhold'
        }
    }
    return lastRun
}
