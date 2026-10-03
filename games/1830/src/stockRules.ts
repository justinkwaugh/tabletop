import type { EighteenThirtyState } from './state.js'
import { EighteenThirtyStockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    marketSaleTerms,
    playersAfterPresident,
    type StockState,
    type StockRules
} from '@tabletop/18xx'

// Shares priced in these market zones are free of the certificate limit, and the last two
// also of the 60% ownership limit.
const CertificateLimitFreeZones = ['yellow', 'orange', 'brown']
const OwnershipLimitFreeZones = ['orange', 'brown']

export function exemptFromOwnershipLimit(
    state: Pick<StockState, 'stockMarket'>,
    companyId: string
): boolean {
    return OwnershipLimitFreeZones.includes(companyMarketSpace(state.stockMarket, companyId).color)
}

export function eighteenThirtySaleTerms(
    state: Pick<StockState, 'stockMarket'>,
    companyId: string,
    shareCount: number,
    shares: number
) {
    return marketSaleTerms(state, companyId, {
        destinationPoolId: 'open-market',
        marketLimit: 50,
        maximumShares: shareCount,
        movement: shares
    })
}

export const EighteenThirtyStockRules: StockRules = {
    round: EighteenThirtyStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started or is closed.'
        if (certificate.president) return 'Start the company to buy its president’s certificate.'
        if (
            certificate.owner.kind !== 'bank' ||
            (certificate.poolId !== 'initial-offering' && certificate.poolId !== 'open-market')
        )
            return 'This certificate is not available for purchase.'
        const price =
            certificate.poolId === 'initial-offering'
                ? company.parPrice
                : companyMarketSpace(state.stockMarket, company.id).price
        assertExists(price, 'An available 1830 share requires its purchase price')
        return { price: price * certificate.shares, recipient: certificate.owner, payers: [buyer] }
    },
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (state.stockRound.number === 1) return 'Shares cannot be sold in the first stock round.'
        if (!company.shareCount || !company.president) return 'This company has no saleable shares.'
        return eighteenThirtySaleTerms(state, companyId, company.shareCount, shares)
    },
    certificateLimit(state) {
        const limit = [0, 0, 28, 20, 16, 13, 11][state.players.length]
        assertExists(limit, 'Unsupported 1830 player count')
        return limit
    },
    certificateWeight(state, certificate) {
        if (certificate.kind === 'share') {
            if (!getCompany(state, certificate.companyId).started)
                return certificate.certificateLimitCount
            const color = companyMarketSpace(state.stockMarket, certificate.companyId).color
            if (CertificateLimitFreeZones.includes(color)) return 0
        }
        return certificate.certificateLimitCount
    },
    ownershipLimit(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.shareCount || !company.started) return 100
        return exemptFromOwnershipLimit(state, companyId) ? 100 : 60
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-sell',
    repeatSales: 'separate',
    // Players sell privates to one another at any agreed price from the second stock round;
    // the B&O private cannot be bought.
    privateSales: {
        priceRange: (state, privateCompanyId) =>
            state.stockRound.number > 1 && privateCompanyId !== 'BOP' ? { minimum: 1 } : undefined
    },
    // Brown-zone shares of one company may be bought several at a time: from the market, or
    // also from the IPO when the game's option allows it.
    multipleBuys: {
        allowsAnother(
            state: StockState & Pick<EighteenThirtyState, 'multipleBrownFromIpo'>,
            certificate,
            earlier
        ) {
            if (companyMarketSpace(state.stockMarket, certificate.companyId).color !== 'brown')
                return false
            if (state.multipleBrownFromIpo === true) return true
            return (
                certificate.poolId === 'open-market' &&
                earlier.every((purchase) => purchase.poolId !== 'initial-offering')
            )
        }
    }
}
