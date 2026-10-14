import { presidentCertificate } from '../finance/finance.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import { fullCapitalizationPayments, sharesStillToFloat } from './companyFlotation.js'
import type { CompanyRules } from './companyRules.js'

export function fullCapitalizationCompanyRules(options: {
    market: StockMarketChart
    ipoPoolId: string
    parSpaceColor: string
    floatPercent: number
}): CompanyRules {
    const sharesToFloat: NonNullable<CompanyRules['sharesToFloat']> = (state, companyId) =>
        sharesStillToFloat(
            state,
            companyId,
            options.floatPercent,
            (certificate) => certificate.poolId === options.ipoPoolId
        )
    return {
        startMarketSpaces: () =>
            options.market.spaces
                .filter((space) => space.color === options.parSpaceColor)
                .map((space) => space.id),
        startTerms(state, companyId, buyer, marketSpaceId) {
            const certificate = presidentCertificate(state, companyId)
            if (
                !certificate ||
                certificate.owner.kind !== 'bank' ||
                certificate.poolId !== options.ipoPoolId
            )
                return 'The president’s certificate must be available in the IPO.'
            return {
                price: options.market.space(marketSpaceId).price * certificate.shares,
                recipient: { kind: 'bank' },
                payers: [buyer]
            }
        },
        sharesToFloat,
        flotationPayments: (state, companyId) =>
            fullCapitalizationPayments(state, companyId, sharesToFloat(state, companyId))
    }
}
