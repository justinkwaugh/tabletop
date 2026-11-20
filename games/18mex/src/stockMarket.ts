import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// Zone letters follow the printed chart: p par, y yellow, e the $200 that ends the game.
const Market: readonly (readonly string[])[] = [
    [
        '60',
        '65',
        '70',
        '75',
        '80p',
        '90p',
        '100',
        '110',
        '120',
        '130',
        '140',
        '150',
        '165',
        '180',
        '200e'
    ],
    [
        '55',
        '60',
        '65',
        '70p',
        '75p',
        '80',
        '90',
        '100',
        '110',
        '120',
        '130',
        '140',
        '150',
        '165',
        '180'
    ],
    ['50', '55', '60p', '65', '70', '75', '80', '90', '100', '110', '120', '130', '140', '150'],
    ['45', '50', '55', '60', '65', '70', '75', '80', '90', '100', '110', '120'],
    ['40y', '45', '50', '55', '60', '65', '70', '75', '80'],
    ['30y', '40y', '45y', '50y', '55y'],
    ['20y', '30y', '40y', '45y', '50y'],
    ['10y']
]
const Zones: Readonly<Record<string, string>> = { p: 'pink', y: 'yellow', e: 'red' }

export const ParPrices: readonly number[] = [60, 70, 75, 80, 90]
/** A market value of $200 ends the game after the current operating round (6(b)). */
export const EndPrice = 200

export const MarketMex = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Market.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[Market[row][column].replace(/\d/g, '')] ?? 'white'
    )
)
