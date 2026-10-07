import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    type StockRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoStockRoundRules } from './roundRules.js'
import { isClosingSpace, saleDescent } from './stockMarket.js'
import { EighteenThirtyTwoMajors } from './majors.js'
import { londonTradable } from './londonInvestment.js'
import {
    OwnershipPercent,
    refreshBuyerExcess,
    refreshSellerExcess,
    requiredSellDown
} from './ownershipExcess.js'
import { recordProtectableSale } from './priceProtection.js'
import { isReissuedShare, lockReissueProceeds } from './redemption.js'
import { requireEighteenThirtyTwoState, type EighteenThirtyTwoState } from './state.js'

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
        if (isClosingSpace(from)) return 'This company is closing.'
        return { ...terms, movement: saleDescent(state.stockMarket, from.id, shares) }
    }
}

function withSellDown(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
    return (state, companyId, shares, seller) =>
        shares < requiredSellDown(state, companyId, seller)
            ? 'Sell down to 60% of this company.'
            : saleTerms(state, companyId, shares, seller)
}

// A reissued share's price goes to its company (§5.11).
const purchaseTerms: StockRules['purchaseTerms'] = (state, certificate, buyer) => {
    const terms = Trading.purchaseTerms(state, certificate, buyer)
    if (
        typeof terms === 'string' ||
        !isReissuedShare(state, certificate.companyId, certificate.poolId)
    )
        return terms
    return { ...terms, recipient: { kind: 'company', companyId: certificate.companyId } }
}

export const EighteenThirtyTwoShareTrading = {
    purchaseTerms,
    stockSaleTerms: withSellDown(withSoftLedge(Trading.stockSaleTerms)),
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

/**
 * The Table 2 column: of the ten railroads, those still active or available, from ten down to
 * six or fewer. A System's two shells both count; a company bought in a takeover does not. A
 * company in the black area counts as closed, as a seller must assume no president protects it
 * (§5.3.5, §11.6, §11.7).
 */
export function certificateLimitColumn(
    state: Pick<EighteenThirtyTwoState, 'companies' | 'stockMarket' | 'systems'>
): number {
    const open = (companyId: string) => {
        const company = getCompany(state, companyId)
        return (
            !company.closed &&
            !(company.started && isClosingSpace(companyMarketSpace(state.stockMarket, companyId)))
        )
    }
    const systemOf = (companyId: string) =>
        Object.keys(state.systems).find((systemId) => state.systems[systemId].includes(companyId))
    const remaining = state.companies.filter((company) => {
        if (!MajorIds.includes(company.id)) return false
        const systemId = systemOf(company.id)
        return systemId ? open(systemId) : open(company.id)
    }).length
    return Math.min(4, MajorIds.length - remaining)
}

export const EighteenThirtyTwoStockRules: StockRules = {
    round: EighteenThirtyTwoStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: EighteenThirtyTwoShareTrading.purchaseTerms,
    saleTerms: EighteenThirtyTwoShareTrading.stockSaleTerms,
    certificateLimit(state) {
        const limit =
            CertificateLimits[state.players.length]?.[
                certificateLimitColumn(requireEighteenThirtyTwoState(state))
            ]
        assertExists(limit, 'Unsupported 1832 player count')
        return limit
    },
    // A closing company's certificates are about to leave play (§5.3.5).
    ...marketZoneHoldingLimits({
        certificateFreeColors: ['yellow', 'green', 'brown', 'black'],
        ownershipFreeColors: ['green', 'brown'],
        ownershipPercent: OwnershipPercent
    }),
    afterSale(state, details) {
        recordProtectableSale(state, details)
        refreshSellerExcess(state, details)
    },
    afterPurchase(state, details) {
        lockReissueProceeds(state, details)
        refreshBuyerExcess(state, details)
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    // Players trade privates at any agreed price of at least $1 (§16.1).
    privateSales: {
        priceRange: (state, privateCompanyId) =>
            londonTradable(state, privateCompanyId) ? { minimum: 1 } : undefined
    },
    // A player may buy every open-market share of one brown-area company in a turn; initial
    // offering shares are still bought one at a time (§5.1.1).
    multipleBuys: {
        allowsAnother: (state, certificate, earlier) =>
            certificate.poolId === 'open-market' &&
            earlier.every((purchase) => purchase.poolId === 'open-market') &&
            companyMarketSpace(state.stockMarket, certificate.companyId).color === 'brown'
    }
}
