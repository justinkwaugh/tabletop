import {
    isAdvancePhase,
    isFloatCompany,
    sameOwner,
    type FinancialState,
    type President
} from '@tabletop/18xx'
import type { GameAction } from '@tabletop/common'
import jsonpatch from 'fast-json-patch'

export type HistoryCompanyChanges = {
    presidents: { companyId: string; previous?: President; next?: President }[]
    closedCompanyIds: string[]
}

export function historyCompanyChanges(
    actions: readonly GameAction[],
    state: Pick<FinancialState, 'companies'>
): Map<string, HistoryCompanyChanges> {
    let ledger = { companies: structuredClone(state.companies) }
    const result = new Map<string, HistoryCompanyChanges>()
    for (const action of actions.toReversed()) {
        const patches = (action.undoPatch ?? []).filter(
            (patch) => patch.path === '/companies' || patch.path.startsWith('/companies/')
        )
        if (!patches.length) continue
        const after = ledger.companies.map((company) => ({
            id: company.id,
            president: company.president ? { ...company.president } : undefined,
            closed: company.closed
        }))
        ledger = jsonpatch.applyPatch(ledger, structuredClone(patches)).newDocument
        if (!isFloatCompany(action) && !isAdvancePhase(action)) continue
        const changes: HistoryCompanyChanges = { presidents: [], closedCompanyIds: [] }
        for (const company of after) {
            const before = ledger.companies.find((previous) => previous.id === company.id)
            if (company.closed && !before?.closed) changes.closedCompanyIds.push(company.id)
            if (company.closed) continue
            const previous = before?.president ? { ...before.president } : undefined
            const next = company.president
            if (previous && next ? !sameOwner(previous, next) : previous !== next)
                changes.presidents.push({ companyId: company.id, previous, next })
        }
        result.set(action.id, changes)
    }
    return result
}
