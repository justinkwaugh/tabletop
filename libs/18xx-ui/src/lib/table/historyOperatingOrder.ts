import { isSellFundingShares, type FinanceExampleState } from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import { assert } from '@tabletop/common'

export type HistoryOperatingOrder = { before: string[]; after: string[]; movingCompanyId?: string }

export function historyOperatingOrder(
    actions: readonly GameAction[],
    state: FinanceExampleState
): Map<string, HistoryOperatingOrder> {
    const changes = new Map<string, HistoryOperatingOrder>()
    let order = [...(state.operatingSet?.companyOrder ?? [])]
    for (const action of actions.toReversed()) {
        const after = [...order]
        for (const patch of action.undoPatch ?? []) {
            if (patch.path === '/operatingSet' || patch.path === '/operatingSet/companyOrder') {
                if (patch.op === 'remove') order = []
                else if (patch.op === 'add' || patch.op === 'replace') {
                    const previous =
                        patch.path === '/operatingSet' ? patch.value.companyOrder : patch.value
                    assert(
                        Array.isArray(previous) && previous.every((id) => typeof id === 'string'),
                        'Recorded operating order requires company ids'
                    )
                    order = [...previous]
                }
            } else {
                const index = /^\/operatingSet\/companyOrder\/(\d+)$/.exec(patch.path)
                if (!index) continue
                const position = Number(index[1])
                if (patch.op === 'remove') order.splice(position, 1)
                else if (patch.op === 'replace' || patch.op === 'add') {
                    assert(
                        typeof patch.value === 'string',
                        'Recorded operating order requires a company id'
                    )
                    if (patch.op === 'add') order.splice(position, 0, patch.value)
                    else order[position] = patch.value
                }
            }
        }
        if (
            after.length &&
            (after.length !== order.length || after.some((id, index) => id !== order[index]))
        )
            changes.set(action.id, { before: [...order], after, ...(isSellFundingShares(action) ? { movingCompanyId: action.companyId } : {}) })
    }
    return changes
}
