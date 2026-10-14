import { Shikoku1889Market } from './stockMarket.js'
import { Shikoku1889StockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import {
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playersAfterPresident,
    type StockRules
} from '@tabletop/18xx'

export const Shikoku1889ShareTrading = ipoMarketTrading({
    market: Shikoku1889Market,
    ipoPoolId: 'initial-offering',
    marketPoolId: 'open-market',
    marketLimit: 50
})

export const Shikoku1889StockRules: StockRules = {
    market: Shikoku1889Market,
    round: Shikoku1889StockRoundRules,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: Shikoku1889ShareTrading.purchaseTerms,
    saleTerms: Shikoku1889ShareTrading.stockSaleTerms,
    certificateLimit(state) {
        const limit = [0, 0, 25, 19, 14, 12, 11][state.players.length]
        assertExists(limit, 'Unsupported 1889 player count')
        return limit
    },
    ...marketZoneHoldingLimits({
        market: Shikoku1889Market,
        certificateFreeColors: ['yellow', 'orange'],
        ownershipFreeColors: ['orange'],
        ownershipPercent: 60
    }),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    repeatSales: 'extend-block'
}
