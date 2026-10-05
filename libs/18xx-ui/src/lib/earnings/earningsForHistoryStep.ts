import { assertExists, type GameAction } from '@tabletop/common'
import { isDistributeEarnings, type EarningsDetails } from '@tabletop/18xx'
import { actionForHistoryStep } from '../table/actionForHistoryStep.js'

export function earningsForHistoryStep(
    actions: readonly GameAction[],
    actionCount: number
): EarningsDetails | undefined {
    const action = actionForHistoryStep(actions, actionCount, isDistributeEarnings)
    if (!action) return
    assertExists(action.metadata, 'Recorded earnings require their distribution result')
    return action.metadata
}
