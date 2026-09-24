import type { HydratedGameState } from '@tabletop/common'
import type { StockState } from '../stock/stockState.js'
import { createStockRound } from '../stock/stockRound.js'
export function startFirstStockRound(
    state: HydratedGameState & StockState,
    playerOrder: string[]
): void {
    state.stockRound = createStockRound(1)
    state.turnManager.turnOrder = [...playerOrder]
    state.turnManager.endTurn(state.actionCount)
    state.turnManager.startTurn(playerOrder[0], state.actionCount + 1)
}
