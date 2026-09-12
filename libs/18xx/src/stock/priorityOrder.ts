import { assertExists } from '@tabletop/common'
import type { StockState } from './stockState.js'
import type { StockRoundRules } from './stockRoundRules.js'

export function priorityOrder(state: StockState, rules: StockRoundRules): string[] {
    const order = state.turnManager.turnOrder
    if (state.stockRound.completed) return [...order]
    const passed = state.stockRound.passedPlayerIds
    if (rules.passing === 'pass-order')
        return [...passed, ...order.filter((id) => !passed.includes(id))]
    const active = state.activePlayerIds[0]
    assertExists(active, 'An active stock round requires a player')
    const first = state.stockRound.turn.acted
        ? (order.indexOf(active) + 1) % order.length
        : order.indexOf(passed[0] ?? active)
    return [...order.slice(first), ...order.slice(0, first)]
}
