import { assertExists } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import { companyMarketSpace } from './stockMarket.js'
import { marketSaleTerms, type StockRules } from './stockRules.js'

export function ipoMarketTrading(options: {
    ipoPoolId: string
    marketPoolId: string
    marketLimit: number
}): {
    purchaseTerms: StockRules['purchaseTerms']
    stockSaleTerms: StockRules['saleTerms']
    emergencySaleTerms: StockRules['saleTerms']
} {
    const saleTerms: StockRules['saleTerms'] = (state, companyId, shares) => {
        const company = getCompany(state, companyId)
        if (!company.shareCount || !company.president) return 'This company has no saleable shares.'
        return marketSaleTerms(state, companyId, {
            destinationPoolId: options.marketPoolId,
            marketLimit: options.marketLimit,
            maximumShares: company.shareCount,
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
                    : companyMarketSpace(state.stockMarket, company.id).price
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
