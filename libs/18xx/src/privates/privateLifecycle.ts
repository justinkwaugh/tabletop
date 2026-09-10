import { assert } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import type { StockState } from '../stock/stockState.js'
import type { StockRules } from '../stock/stockRules.js'
import { closePrivate } from './privateCompany.js'
import { applyPrivateShareExchange } from './privateExchange.js'
import type { PrivateEffect } from './privateRules.js'

export function applyPrivateEffects(
    state: StockState,
    effects: readonly PrivateEffect[],
    rules: StockRules
): void {
    for (const effect of effects) {
        const company = getCompany(state, effect.privateCompanyId)
        assert(
            company.kind === 'private' && !company.closed,
            'Private effect requires an open private'
        )
        if (effect.kind === 'close') closePrivate(state, company.id)
        else if (effect.kind === 'income') company.privateRevenue = effect.revenue
        else
            applyPrivateShareExchange(
                state,
                company.id,
                effect.certificateId,
                effect.exemptOwnershipLimit,
                rules
            )
    }
}
