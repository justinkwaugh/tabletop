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

export function changedCompanyCash(cash: HistoryCash): boolean {
    return [...new Set([...cash.before.keys(), ...cash.after.keys()])].some(
        (id) => cash.before.get(id) !== cash.after.get(id)
    )
}
