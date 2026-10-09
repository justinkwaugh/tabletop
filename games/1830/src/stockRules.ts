import { EighteenThirtyMarket } from './stockMarket.js'
import type { EighteenThirtyState } from './state.js'
import { EighteenThirtyStockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import {
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    type StockState,
    type StockRules
} from '@tabletop/18xx'

export const EighteenThirtyShareTrading = ipoMarketTrading({
    market: EighteenThirtyMarket,
    ipoPoolId: 'initial-offering',
    marketPoolId: 'open-market',
    marketLimit: 50
})

export const EighteenThirtyStockRules: StockRules = {
    market: EighteenThirtyMarket,
    round: EighteenThirtyStockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: EighteenThirtyShareTrading.purchaseTerms,
    saleTerms: EighteenThirtyShareTrading.stockSaleTerms,
    certificateLimit(state) {
        const limit = [0, 0, 28, 20, 16, 13, 11][state.players.length]
        assertExists(limit, 'Unsupported 1830 player count')
        return limit
    },
    ...marketZoneHoldingLimits({
        market: EighteenThirtyMarket,
        certificateFreeColors: ['yellow', 'orange', 'brown'],
        ownershipFreeColors: ['orange', 'brown'],
        ownershipPercent: 60
    }),
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
            if (
                EighteenThirtyMarket.companySpace(state.stockMarket, certificate.companyId)
                    .color !== 'brown'
            )
                return false
            if (state.multipleBrownFromIpo === true) return true
            return (
                certificate.poolId === 'open-market' &&
                earlier.every((purchase) => purchase.poolId !== 'initial-offering')
            )
        }
    }
}
