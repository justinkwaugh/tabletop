import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { EighteenThirtyTwoStockRoundRules } from './roundRules.js'
import { saleDescent } from './stockMarket.js'
import { EighteenThirtyTwoMajors } from './majors.js'

const Trading = ipoMarketTrading({
    ipoPoolId: 'initial-offering',
    marketPoolId: 'open-market',
    marketLimit: 50
})

// Sales fall one space per share, stopping on the soft ledge when one space remains (§5.8.1).
function withSoftLedge(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
    return (state, companyId, shares, seller) => {
        const terms = saleTerms(state, companyId, shares, seller)
        if (typeof terms === 'string') return terms
        const from = companyMarketSpace(state.stockMarket, companyId)
        return { ...terms, movement: saleDescent(state.stockMarket, from.id, shares) }
    }
}

export const EighteenThirtyTwoShareTrading = {
    purchaseTerms: Trading.purchaseTerms,
    stockSaleTerms: withSoftLedge(Trading.stockSaleTerms),
    emergencySaleTerms: withSoftLedge(Trading.emergencySaleTerms)
}

// Certificate limits by player count, for 10, 9, 8, 7 and at most 6 companies (Table 2).
const CertificateLimits: Readonly<Record<number, readonly number[]>> = {
    2: [28, 24, 21, 17, 14],
    3: [20, 17, 15, 12, 10],
    4: [16, 14, 12, 10, 8],
    5: [13, 11, 9, 8, 6],
    6: [11, 9, 8, 6, 5],
    7: [9, 7, 6, 5, 4]
}

const MajorIds: readonly string[] = Object.keys(EighteenThirtyTwoMajors)

/** The Table 2 column: companies still active or available, from ten down to six or fewer. */
export function certificateLimitColumn(state: Pick<StockState, 'companies'>): number {
    const remaining = state.companies.filter(
        (company) => MajorIds.includes(company.id) && !company.closed
    ).length
    return Math.min(4, MajorIds.length - remaining)
}

export const EighteenThirtyTwoStockRules: StockRules = {
    round: EighteenThirtyTwoStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: EighteenThirtyTwoShareTrading.purchaseTerms,
    saleTerms: EighteenThirtyTwoShareTrading.stockSaleTerms,
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]?.[certificateLimitColumn(state)]
        assertExists(limit, 'Unsupported 1832 player count')
        return limit
    },
    ...marketZoneHoldingLimits({
        certificateFreeColors: ['yellow', 'green', 'brown'],
        ownershipFreeColors: ['green', 'brown'],
        ownershipPercent: 60
    }),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    // Players trade privates at any agreed price of at least $1 (§16.1).
    privateSales: { priceRange: () => ({ minimum: 1 }) },
    // A player may buy every open-market share of one brown-area company in a turn; initial
    // offering shares are still bought one at a time (§5.1.1).
    multipleBuys: {
        allowsAnother: (state, certificate, earlier) =>
            companyMarketSpace(state.stockMarket, certificate.companyId).color === 'brown' &&
            certificate.poolId === 'open-market' &&
            earlier.every((purchase) => purchase.poolId === 'open-market')
    }
}
