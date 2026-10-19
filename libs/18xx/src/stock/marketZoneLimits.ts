import { getCompany, standardCertificateWeight } from '../finance/finance.js'
import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import type { StockMarketChart } from './stockMarket.js'
import type { StockRules } from './stockRules.js'

export function marketZoneHoldingLimits(options: {
    market: StockMarketChart
    charters: CompanyCharters
    certificateFreeColors: readonly string[]
    ownershipFreeColors: readonly string[]
    ownershipPercent: number
}): Pick<StockRules, 'charters' | 'certificateWeight' | 'ownershipLimit'> {
    return {
        charters: options.charters,
        certificateWeight(state, certificate) {
            if (
                certificate.kind === 'share' &&
                getCompany(state, certificate.companyId).started &&
                options.certificateFreeColors.includes(
                    options.market.companySpace(state.stockMarket, certificate.companyId).color
                )
            )
                return 0
            return standardCertificateWeight(certificate)
        },
        ownershipLimit(state, companyId) {
            const company = getCompany(state, companyId)
            if (
                !companyShareCount(state, options.charters, companyId) ||
                !company.started ||
                company.closed
            )
                return 100
            return options.ownershipFreeColors.includes(
                options.market.companySpace(state.stockMarket, companyId).color
            )
                ? 100
                : options.ownershipPercent
        }
    }
}
