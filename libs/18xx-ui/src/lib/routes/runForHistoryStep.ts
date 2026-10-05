import { assertExists, type GameAction } from '@tabletop/common'
import { isRunTrains, type OperatingResult } from '@tabletop/18xx'
import { actionForHistoryStep } from '../table/actionForHistoryStep.js'

export function runForHistoryStep(
    actions: readonly GameAction[],
    actionCount: number
): OperatingResult | undefined {
    const run = actionForHistoryStep(actions, actionCount, isRunTrains)
    if (!run) return
    assertExists(run.metadata, 'A recorded train run requires its operating result')
    return run.metadata
}
