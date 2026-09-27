import { ActionSource } from '@tabletop/common'
import type { FinishStockTurn } from '../stock/finishStockTurn.js'
import type { SetStockInstruction } from '../stock/setStockInstruction.js'
import type { StockInstruction } from '../stock/stockInstruction.js'

export function setInstruction(
    gameId: string,
    playerId: string,
    instruction?: StockInstruction
): SetStockInstruction {
    return {
        id: `set-${playerId}-${instruction?.kind ?? 'clear'}`,
        gameId,
        source: ActionSource.User,
        type: 'SetStockInstruction',
        playerId,
        outOfTurn: true,
        supersedable: true,
        ...(instruction ? { instruction } : {})
    }
}

export function finishTurn(gameId: string, playerId: string): FinishStockTurn {
    return {
        id: `finish-${playerId}`,
        gameId,
        source: ActionSource.User,
        type: 'FinishStockTurn',
        playerId
    }
}
