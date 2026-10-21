import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// Zone letters follow the printed market (§19): p par, s the starting companies' par,
// g the gray area, e the game's end.
const Market: readonly (readonly string[])[] = [
    [
        '90',
        '99',
        '109',
        '115',
        '124',
        '132',
        '141',
        '151',
        '180',
        '215',
        '260',
        '310',
        '375',
        '450e'
    ],
    [
        '82',
        '95p',
        '100',
        '106',
        '113',
        '121',
        '130',
        '139',
        '165',
        '200',
        '240',
        '285',
        '345',
        '415'
    ],
    ['75', '82', '89', '95', '103', '111', '120', '130', '155', '185', '225', '270', '320'],
    ['69', '75', '81', '87', '93', '100s', '108', '116', '140', '170', '200', '235'],
    ['64', '69', '74', '80p', '85', '91', '97', '111', '130', '155', '185'],
    ['59g', '64', '68', '71', '76', '81', '90', '101', '120', '140'],
    ['50g', '56g', '62', '66', '70', '75', '83', '93'],
    ['40g', '50g', '55g', '60', '64', '67p', '75'],
    ['30g', '40g', '50g', '55g', '60'],
    ['20g', '30g', '40g', '50g', '55g'],
    ['10g', '20g', '30g', '40g', '50g']
]
const Zones: Readonly<Record<string, string>> = {
    p: 'pink',
    s: 'light-pink',
    g: 'gray',
    e: 'red'
}

export const EighteenNinetyFourMarket = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Market.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[Market[row][column].replace(/\d/g, '')] ?? 'white'
    )
)

/** The price a reissue sets as par, and the starting companies' extra par (§10.1, §7.3.2.2). */
export const ReissueParSpaceId = '3:5'
/** A share price reaching this space ends the game (§8.1). */
export const EndingSpaceId = '0:13'
