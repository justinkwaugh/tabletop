import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import { assertExists } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import type { StockMarketChart } from './stockMarket.js'
import { marketSaleTerms, type StockRules } from './stockRules.js'

export function ipoMarketTrading(options: {
    market: StockMarketChart
    charters: CompanyCharters
    ipoPoolId: string
    marketPoolId: string
    marketLimit: number
}): {
    purchaseTerms: StockRules['purchaseTerms']
    stockSaleTerms: StockRules['saleTerms']
    emergencySaleTerms: StockRules['saleTerms']
} {
    const saleTerms: StockRules['saleTerms'] = (state, companyId, shares) => {
        const shareCount = companyShareCount(state, options.charters, companyId)
        if (!shareCount || !getCompany(state, companyId).president)
            return 'This company has no saleable shares.'
        return marketSaleTerms(options.market, state, companyId, {
            destinationPoolId: options.marketPoolId,
            marketLimit: options.marketLimit,
            maximumShares: shareCount,
            movement: shares
        })
    }
    return {
        purchaseTerms(state, certificate, buyer) {
            const company = getCompany(state, certificate.companyId)
            if (!company.started || company.closed)
                return 'This company has not started or is closed.'
            if (certificate.president)
                return 'Start the company to buy its president’s certificate.'
            if (
                certificate.owner.kind !== 'bank' ||
                (certificate.poolId !== options.ipoPoolId &&
                    certificate.poolId !== options.marketPoolId)
            )
                return 'This certificate is not available for purchase.'
            const price =
                certificate.poolId === options.ipoPoolId
                    ? company.parPrice
                    : options.market.companySpace(state.stockMarket, company.id).price
            assertExists(price, 'An available share requires its purchase price')
            return {
                price: price * certificate.shares,
                recipient: certificate.owner,
                payers: [buyer]
            }
        },
        stockSaleTerms(state, companyId, shares, seller) {
            if (state.stockRound.number === 1)
                return 'Shares cannot be sold in the first stock round.'
            return saleTerms(state, companyId, shares, seller)
        },
        emergencySaleTerms(state, companyId, shares, seller) {
            if (getCompany(state, companyId).closed) return 'This company has no saleable shares.'
            return saleTerms(state, companyId, shares, seller)
        }
    }
}
