import { getCompany } from '../finance/finance.js'
import type { StockMarketChart } from './stockMarket.js'
import type { StockRules } from './stockRules.js'

export function marketZoneHoldingLimits(options: {
    market: StockMarketChart
    certificateFreeColors: readonly string[]
    ownershipFreeColors: readonly string[]
    ownershipPercent: number
}): Pick<StockRules, 'certificateWeight' | 'ownershipLimit'> {
    return {
        certificateWeight(state, certificate) {
            if (
                certificate.kind === 'share' &&
                getCompany(state, certificate.companyId).started &&
                options.certificateFreeColors.includes(
                    options.market.companySpace(state.stockMarket, certificate.companyId).color
                )
            )
                return 0
            return certificate.certificateLimitCount
        },
        ownershipLimit(state, companyId) {
            const company = getCompany(state, companyId)
            if (!company.shareCount || !company.started || company.closed) return 100
            return options.ownershipFreeColors.includes(
                options.market.companySpace(state.stockMarket, companyId).color
            )
                ? 100
                : options.ownershipPercent
        }
    }
}
