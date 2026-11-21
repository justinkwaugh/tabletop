import { assertExists } from '@tabletop/common'
import { createLinearStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

/**
 * The stock market, printed as a track zig-zagging between two tiers: a sale moves a company one
 * place, changing tier, and a dividend moves it along its tier, two places at a time (Share Price
 * Movement).
 */
export const MarketPrices1860: readonly number[] = [
    0, 7, 14, 20, 26, 31, 36, 40, 44, 47, 50, 52, 54, 56, 58, 60, 62, 65, 68, 71, 74, 78, 82, 86,
    90, 95, 100, 105, 110, 116, 122, 128, 134, 142, 150, 158, 166, 174, 182, 191, 200, 210, 220,
    230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340
]

/** The par prices marked on the market; each layer chooses from its own range of them. */
export const ParPrices1860: readonly number[] = [54, 58, 62, 68, 74, 82, 90, 100]
/** A bankrupt company starts again at any price from 40 to its layer's highest par. */
export const RefloatPrices1860: readonly number[] = MarketPrices1860.filter(
    (price) => price >= 40 && price <= 100
)
export const BankruptcyPrice = 0
/** A company reaching 340 ends the game after the operating round (The End of the Game). */
export const GameEndPrice = 340

/** Below 40 or above 150, the first share of a sale leaves the price where it is (red letters). */
export function ignoresFirstSale(price: number): boolean {
    return price < 40 || price > 150
}

export const MarketZoneColors1860 = {
    par: 'yellow',
    refloat: 'gray',
    ignoreFirstSale: 'red',
    bankruptcy: 'black',
    gameEnd: 'orange',
    ordinary: 'white'
} as const

function zoneColor(price: number): string {
    if (price === BankruptcyPrice) return MarketZoneColors1860.bankruptcy
    if (price === GameEndPrice) return MarketZoneColors1860.gameEnd
    if (ParPrices1860.includes(price)) return MarketZoneColors1860.par
    if (RefloatPrices1860.includes(price)) return MarketZoneColors1860.refloat
    if (ignoresFirstSale(price)) return MarketZoneColors1860.ignoreFirstSale
    return MarketZoneColors1860.ordinary
}

export const Market1860 = new StockMarketChart(
    createLinearStockMarketSpaces(MarketPrices1860, zoneColor, { zigzag: true })
)

export function marketSpaceIdAt(price: number): string {
    const space = Market1860.spaces.find((candidate) => candidate.price === price)
    assertExists(space, `No 1860 market space at ${price}`)
    return space.id
}
