import { isResolveAuction, type Owner } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import type { HistoryStates } from './historyStates.js'

export type HistoryCash = {
    before: ReadonlyMap<string, number>
    after: ReadonlyMap<string, number>
}

export function historyCash(states: HistoryStates): Map<string, HistoryCash> {
    const result = new Map<string, HistoryCash>()
    for (const [id, { before, after }] of states) {
        if (before) result.set(id, { before: before.cash, after: after.cash })
    }
    return result
}

export type HistoryIncome = { owner: Owner; amount: number }

/** What each player received from each private income payment an auction made, read from cash. */
export function historyAuctionIncome(
    actions: readonly GameAction[],
    states: HistoryStates
): Map<string, HistoryIncome[]> {
    const result = new Map<string, HistoryIncome[]>()
    for (const action of actions) {
        if (!isResolveAuction(action) || action.metadata?.kind !== 'income') continue
        const transition = states.get(action.id)
        if (!transition?.before) continue
        const { before, after } = transition
        const income = [...after.playerCash].flatMap(([playerId, cash]) => {
            const amount = cash - (before.playerCash.get(playerId) ?? 0)
            return amount > 0 ? [{ owner: { kind: 'player' as const, playerId }, amount }] : []
        })
        if (income.length) result.set(action.id, income)
    }
    return result
}

export function changedCompanyCash(cash: HistoryCash): boolean {
    return [...new Set([...cash.before.keys(), ...cash.after.keys()])].some(
        (id) => cash.before.get(id) !== cash.after.get(id)
    )
}
