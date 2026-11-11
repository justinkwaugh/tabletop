import { EighteenNinetyFourCharters } from './charters.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import { EighteenNinetyFourStockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import {
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    sameOwner,
    sharesOwned,
    type StockRules,
    type StockState
} from '@tabletop/18xx'

export const EighteenNinetyFourShareTrading = ipoMarketTrading({
    market: EighteenNinetyFourMarket,
    charters: EighteenNinetyFourCharters,
    ipoPoolId: 'initial-offering',
    marketPoolId: 'open-market',
    marketLimit: 50
})

const GrayZone = 'gray'
const zoneLimits = marketZoneHoldingLimits({
    market: EighteenNinetyFourMarket,
    charters: EighteenNinetyFourCharters,
    certificateFreeColors: [GrayZone],
    ownershipFreeColors: [GrayZone],
    ownershipPercent: 60
})

export function inGrayZone(state: StockState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        !!company.started &&
        !company.closed &&
        EighteenNinetyFourMarket.companySpace(state.stockMarket, companyId).color === GrayZone
    )
}

/** The certificate limit counts privates and every non-gray share (§6.1, §22.1). */
export function certificateLimit1894(state: StockState): number {
    const limit = { 3: 18, 4: 14 }[state.players.length]
    assertExists(limit, '1894 supports three or four players')
    return limit
}

export const EighteenNinetyFourStockRules: StockRules = {
    market: EighteenNinetyFourMarket,
    round: EighteenNinetyFourStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: EighteenNinetyFourShareTrading.purchaseTerms,
    saleTerms: EighteenNinetyFourShareTrading.stockSaleTerms,
    certificateLimit: certificateLimit1894,
    charters: EighteenNinetyFourCharters,
    certificateWeight: zoneLimits.certificateWeight,
    // Players stop buying at 60% outside the gray area, but keep what they bought there when
    // the price leaves it (§6.4, §10.1).
    ownershipLimit(state, companyId, buyer) {
        const limit = zoneLimits.ownershipLimit(state, companyId, buyer)
        return limit === 100 ? limit : Math.max(limit, sharesOwned(state, companyId, buyer) * 10)
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-sell',
    repeatSales: 'separate',
    // A gray-area company's president may buy two of its shares in one turn, from the IPO or
    // the bank pool (§6.1, §6.4).
    multipleBuys: {
        allowsAnother(state, certificate, earlier) {
            const president = getCompany(state, certificate.companyId).president
            const buyer = state.activePlayerIds[0]
            return (
                earlier.length < 2 &&
                inGrayZone(state, certificate.companyId) &&
                !!president &&
                !!buyer &&
                sameOwner(president, { kind: 'player', playerId: buyer })
            )
        }
    }
}
