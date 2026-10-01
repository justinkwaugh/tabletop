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
            if (color === 'yellow' || color === 'orange' || color === 'brown') return 0
        }
        return certificate.certificateLimitCount
    },
    ownershipLimit(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.shareCount || !company.started) return 100
        const color = companyMarketSpace(state.stockMarket, companyId).color
        return color === 'orange' || color === 'brown' ? 100 : 60
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    sellAfterBuying: true
}
