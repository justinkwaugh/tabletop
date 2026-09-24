import type { GameAction } from '@tabletop/common'
import { isCompleteStockRound } from './completeStockRound.js'
import { isStartStockRound } from './startStockRound.js'
import { isSetStockInstruction } from './setStockInstruction.js'
import { isStopStockInstruction } from './stopStockInstruction.js'
import type { StockInstruction, StockInstructionStopReason } from './stockInstruction.js'

export type StoppedStockInstruction = {
    kind: StockInstruction['kind']
    reason: StockInstructionStopReason
}

export function lastStoppedStockInstruction(
    actions: readonly GameAction[],
    playerId: string
): StoppedStockInstruction | undefined {
    let reason: StockInstructionStopReason | undefined
    for (const action of actions.toReversed()) {
        if (isCompleteStockRound(action) || isStartStockRound(action)) return undefined
        if (action.playerId !== playerId) continue
        if (isStopStockInstruction(action)) {
            if (reason !== undefined) {
                if (action.replacement) return { kind: action.replacement.kind, reason }
                continue
            }
            if (action.replacement) return undefined
            reason = action.reason
        } else if (isSetStockInstruction(action)) {
            if (reason === undefined || !action.instruction) return undefined
            return { kind: action.instruction.kind, reason }
        }
    }
    return undefined
}
