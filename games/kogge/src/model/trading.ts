import { GOODS, hasGoods, totalGoods, type GoodCounts } from '../components/goods.js'

export const BASE_TRADE_RATIO = 2
export const BONUS_TRADE_RATIO = 3

export interface TradeTerms {
    cargo: GoodCounts
    market: GoodCounts
    give: GoodCounts
    take: GoodCounts
    ratio: number
}

// Rulebook 3d: goods from the cog buy goods of other kinds lying in the city, at up to
// two (three with the bonus chit) for one; a player may settle for as little as one for one.
export function isValidTrade({ cargo, market, give, take, ratio }: TradeTerms): boolean {
    const given = totalGoods(give)
    const taken = totalGoods(take)
    return (
        given > 0 &&
        taken >= given &&
        taken <= given * ratio &&
        hasGoods(cargo, give) &&
        hasGoods(market, take) &&
        GOODS.every((good) => give[good] === 0 || take[good] === 0)
    )
}

export function hasTradeOpportunity(cargo: GoodCounts, market: GoodCounts): boolean {
    return GOODS.some(
        (offered) =>
            cargo[offered] > 0 && GOODS.some((wanted) => wanted !== offered && market[wanted] > 0)
    )
}
