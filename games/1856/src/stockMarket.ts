import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// Zone letters follow the printed market: p a red-outlined par space, y yellow, b brown, c the
// closing area.
const Market: readonly (readonly string[])[] = [
    [
        '70',
        '75',
        '80',
        '90',
        '100p',
        '110',
        '125',
        '150',
        '175',
        '200',
        '225',
        '250',
        '275',
        '300',
        '325',
        '350',
        '375',
        '400',
        '425',
        '450'
    ],
    [
        '65',
        '70',
        '75',
        '80',
        '90p',
        '100',
        '110',
        '125',
        '150',
        '175',
        '200',
        '225',
        '250',
        '275',
        '300',
        '325',
        '350',
        '375',
        '400',
        '425'
    ],
    [
        '60',
        '65',
        '70',
        '75',
        '80p',
        '90',
        '100',
        '110',
        '125',
        '150',
        '175',
        '200',
        '225',
        '250',
        '275'
    ],
    ['55', '60', '65', '70', '75p', '80', '90', '100', '110', '125', '150', '175', '200'],
    ['50y', '55', '60', '65', '70p', '75', '80', '90', '100', '110', '125'],
    ['45y', '50y', '55', '60', '65p', '70', '75', '80', '90'],
    ['40b', '45y', '50y', '55', '60', '65', '70'],
    ['35b', '40b', '45y', '50y', '55', '60'],
    ['30b', '35b', '40b', '45y', '50y'],
    ['0c', '30b', '35b', '40b', '45y'],
    ['0c', '0c', '30b', '35b', '40b']
]

const Zones: Readonly<Record<string, string>> = {
    p: 'pink',
    y: 'yellow',
    b: 'brown',
    c: 'black'
}

/** The printed market; its red-outlined spaces are where companies start (Stock Market). */
export const Market1856 = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Market.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[Market[row][column].replace(/\d/g, '')] ?? 'white'
    )
)

/** The par spaces, $65 to $100. */
export const ParSpaceIds1856: readonly string[] = Market1856.spaces
    .filter((space) => space.color === 'pink')
    .map((space) => space.id)

/** The spaces of the closing area: a company reaching one closes, the CGR never enters one. */
export const ClosingSpaceIds1856: readonly string[] = Market1856.spaces
    .filter((space) => space.price === 0)
    .map((space) => space.id)
