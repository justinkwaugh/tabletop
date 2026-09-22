import { getCompany, openShares, type FinancialState, type OpenShare } from '../finance/finance.js'
import type { StockState } from './stockState.js'

export interface StockRoundRules {
    passing: 'consecutive' | 'pass-order'
    nextPlayerOrder(state: StockState): string[]
    soldOut(state: StockState, companyId: string): boolean
}

export function playerOrderAfterLastTurn(state: StockState): string[] {
    const order = state.turnManager.turnOrder
    const next = (order.indexOf(state.activePlayerIds[0]) + 1) % order.length
    return [...order.slice(next), ...order.slice(0, next)]
}

export function recordStockAction(
    state: StockState,
    playerId: string,
    rules: StockRoundRules
): void {
    state.stockRound.turn.acted = true
    state.stockRound.passedPlayerIds =
        rules.passing === 'consecutive'
            ? []
            : state.stockRound.passedPlayerIds.filter((id) => id !== playerId)
}

export function allPlayersPassed(state: StockState): boolean {
    return state.turnManager.turnOrder.every((id) => state.stockRound.passedPlayerIds.includes(id))
}

export function allSharesHeld(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string,
    held: (certificate: OpenShare) => boolean
): boolean {
    const company = getCompany(state, companyId)
    return !!company.started && !company.closed && openShares(state, companyId).every(held)
}
