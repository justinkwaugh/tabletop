import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// Zone letters follow the printed market (§6, §10.1): p par, y yellow, o orange, b brown, and e
// the top-right space that ends the game (§12).
const Market: readonly (readonly string[])[] = [
    [
        '76',
        '82',
        '90',
        '100p',
        '112',
        '126',
        '142',
        '160',
        '180',
        '200',
        '225',
        '250',
        '275',
        '300',
        '325',
        '350e'
    ],
    [
        '70',
        '76',
        '82',
        '90p',
        '100',
        '112',
        '126',
        '142',
        '160',
        '180',
        '200',
        '220',
        '240',
        '260',
        '280',
        '300'
    ],
    ['65', '70', '76', '82p', '90', '100', '111', '125', '140', '155', '170', '185', '200'],
    ['60y', '66', '71', '76p', '82', '90', '100', '110', '120', '130'],
    ['55y', '62', '67', '71p', '76', '82', '90', '100'],
    ['50y', '58y', '65', '67p', '71', '75', '80'],
    ['45o', '54y', '63', '67', '69', '70'],
    ['40o', '50y', '60y', '67', '68'],
    ['30b', '40o', '50y', '60y'],
    ['20b', '30b', '40o', '50y'],
    ['10b', '20b', '30b', '40o']
]
const Zones: Readonly<Record<string, string>> = {
    p: 'pink',
    y: 'yellow',
    o: 'orange',
    b: 'brown',
    e: 'red'
}

export const Market1882 = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Market.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[Market[row][column].replace(/\d/g, '')] ?? 'white'
    )
)

/** The space whose reaching ends the game (§12). */
export const EndSpaceId = '0:15'
