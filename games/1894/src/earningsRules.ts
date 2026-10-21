import { EighteenNinetyFourCharters } from './charters.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import { payOrWithholdEarningsRules, type EarningsRules } from '@tabletop/18xx'

// IPO shares pay the company and bank pool shares pay nobody; shares in the company's own
// treasury pay it as their holder (§7.3.6).
const payOrWithhold = payOrWithholdEarningsRules(
    EighteenNinetyFourMarket,
    EighteenNinetyFourCharters,
    {
        unpaidPoolIds: ['open-market'],
        companyPoolIds: ['initial-offering']
    }
)

export const EighteenNinetyFourEarningsRules: EarningsRules = {
    ...payOrWithhold,
    // A gray-area price moved up moves up once more (§10.1), as a payout at a row's end does.
    marketEffect(state, companyId, distribution) {
        const effect = payOrWithhold.marketEffect(state, companyId, distribution)
        const move = effect.move
        if (!move) return effect
        const from = EighteenNinetyFourMarket.space(move.fromMarketSpaceId)
        const to = EighteenNinetyFourMarket.space(move.toMarketSpaceId)
        if (from.color !== 'gray' || to.row >= from.row) return effect
        return {
            ...effect,
            move: { ...move, toMarketSpaceId: EighteenNinetyFourMarket.move(to.id, 'up', 1).id }
        }
    }
}
