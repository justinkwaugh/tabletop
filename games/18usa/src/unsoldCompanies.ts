import {
    LiquidateCompany,
    SystemActionFirstHandler,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import type { HydratedEighteenUSAState } from './state.js'
import { eighteenUSAOptions } from './state.js'
import { EighteenUSACompanyMarket } from './marketZones.js'

/**
 * With the $300 variant, a company with less than half its shares in players' hands as its
 * first stock round ends is liquidated (§17, "$300 Maximum Starting Price After Phase 5").
 */
export function liquidatesUnsoldCompanies(
    handler: EighteenXXStateHandler<HydratedEighteenUSAState>
): EighteenXXStateHandler<HydratedEighteenUSAState> {
    return new SystemActionFirstHandler(handler, LiquidateCompany, (state) => {
        if (!eighteenUSAOptions(state).highStartPrices) return undefined
        const market = EighteenUSACompanyMarket
        const companyId = state.companies.find(
            (company) =>
                company.kind === 'major' &&
                company.started &&
                !company.closed &&
                !company.operated &&
                !market.isLiquidated(state.stockMarket, company.id) &&
                market.playerHoldings(state, company.id) * 2 < market.shareCount(state, company.id)
        )?.id
        return companyId ? { companyId, reason: 'unsold-shares' as const } : undefined
    })
}
