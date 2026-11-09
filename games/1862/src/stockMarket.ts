import { assertExists } from '@tabletop/common'
import { createLinearStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// Letters: p chartered and non-chartered par, r non-chartered par only, c bankruptcy, e game end.
const Market: readonly string[] = [
    '0c',
    '7',
    '14',
    '20',
    '26',
    '31',
    '36',
    '40',
    '44',
    '47',
    '50',
    '52',
    '54p',
    '56r',
    '58p',
    '60r',
    '62p',
    '65r',
    '68p',
    '71r',
    '74p',
    '78r',
    '82p',
    '86r',
    '90p',
    '95r',
    '100p',
    '105r',
    '110r',
    '116r',
    '122r',
    '128r',
    '134r',
    '142r',
    '150r',
    '158r',
    '166r',
    '174r',
    '182r',
    '191r',
    '200r',
    '210',
    '220',
    '232',
    '245',
    '260',
    '275',
    '292',
    '310',
    '330',
    '350',
    '375',
    '400',
    '430',
    '460',
    '495',
    '530',
    '570',
    '610',
    '655',
    '700',
    '750',
    '800',
    '850',
    '900',
    '950',
    '1000e'
]

const MarketPrices = Market.map((cell) => Number.parseInt(cell))
const zone = (letter: string) =>
    Market.filter((cell) => cell.endsWith(letter)).map((cell) => Number.parseInt(cell))

/** The par prices a chartered company may choose (§4.2). */
export const CharteredParPrices: readonly number[] = zone('p')
/** The par chart's non-chartered area, from 54 to 100 (§6.5.3, §7.5.4). */
export const NonCharteredParPrices: readonly number[] = [...zone('p'), ...zone('r')]
    .filter((price) => price <= 100)
    .sort((a, b) => a - b)
/** The pink and yellow regions, 54 to 200, where a non-chartered company starts (§6.5.3). */
export const NonCharteredStartPrices: readonly number[] = [...zone('p'), ...zone('r')].sort(
    (a, b) => a - b
)
export const BankruptcyPrice = 0
export const GameEndPrice = 1000

/**
 * The first shares a non-director sells that leave the price unmoved: one above 200 or below 40,
 * two at 400 and over (§6.4.2).
 */
export function ignoredSales(price: number): 0 | 1 | 2 {
    if (price >= 400) return 2
    if (price > 200 || price < 40) return 1
    return 0
}

export const MarketZoneColors1862 = {
    charteredPar: 'yellow',
    nonCharteredPar: 'pink',
    ignoreOneSale: 'blue',
    ignoreTwoSales: 'green',
    bankruptcy: 'black',
    gameEnd: 'red',
    ordinary: 'white'
} as const

function marketZoneColor(price: number): string {
    if (price === BankruptcyPrice) return MarketZoneColors1862.bankruptcy
    if (price === GameEndPrice) return MarketZoneColors1862.gameEnd
    if (CharteredParPrices.includes(price)) return MarketZoneColors1862.charteredPar
    if (NonCharteredStartPrices.includes(price)) return MarketZoneColors1862.nonCharteredPar
    const ignored = ignoredSales(price)
    if (ignored === 2) return MarketZoneColors1862.ignoreTwoSales
    if (ignored === 1) return MarketZoneColors1862.ignoreOneSale
    return MarketZoneColors1862.ordinary
}

export const Market1862 = new StockMarketChart(
    // The track wraps onto four rows of seventeen, as a 67-space row is too long to draw.
    createLinearStockMarketSpaces(MarketPrices, marketZoneColor, { rowLength: 17 })
)

export function marketSpaceIdAt(price: number): string {
    const space = Market1862.spaces.find((candidate) => candidate.price === price)
    assertExists(space, `No 1862 market space at ${price}`)
    return space.id
}
