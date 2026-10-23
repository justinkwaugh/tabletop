import type { GameAction } from '@tabletop/common'
import { isSetStockInstruction } from './setStockInstruction.js'
import { isSetStockInstructionStops } from './setStockInstructionStops.js'
import { isStopStockInstruction } from './stopStockInstruction.js'

export function isStockInstructionDeclaration(action: GameAction): boolean {
    return isSetStockInstruction(action) || isSetStockInstructionStops(action)
}

export function isStockInstructionAction(action: GameAction): boolean {
    return isStockInstructionDeclaration(action) || isStopStockInstruction(action)
}
