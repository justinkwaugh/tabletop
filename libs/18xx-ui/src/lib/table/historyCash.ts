import type { EighteenXXState } from '@tabletop/18xx'
import { assert, type GameAction } from '@tabletop/common'
import jsonpatch from 'fast-json-patch'

export type HistoryCash = {
    before: ReadonlyMap<string, number>
    after: ReadonlyMap<string, number>
}

export function historyCash(actions: readonly GameAction[], state: EighteenXXState): Map<string, HistoryCash> {
    let ledger = { cash: structuredClone(state.cash) }
    const result = new Map<string, HistoryCash>()
    function balances() {
        const values = new Map<string, number>()
        for (const entry of ledger.cash) {
            if (entry.owner.kind !== 'company') continue
            assert(typeof entry.amount === 'number', 'Company history requires finite cash')
            values.set(entry.owner.companyId, entry.amount)
        }
        return values
    }
    let after = balances()
    for (const action of actions.toReversed()) {
        const patches = (action.undoPatch ?? []).filter((patch) => patch.path === '/cash' || patch.path.startsWith('/cash/'))
        if (patches.length) ledger = jsonpatch.applyPatch(ledger, structuredClone(patches)).newDocument
        const before = patches.length ? balances() : after
        result.set(action.id, { before, after })
        after = before
    }
    return result
}

export function changedCompanyCash(cash: HistoryCash): boolean {
    return [...new Set([...cash.before.keys(), ...cash.after.keys()])]
        .some((id) => cash.before.get(id) !== cash.after.get(id))
}
