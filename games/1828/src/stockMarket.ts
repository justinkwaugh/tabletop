import {
    createRectangularStockMarketSpaces,
    StockMarketChart,
    type StockMarketSpace,
    type StockState
} from '@tabletop/18xx'

// The printed market (§12, figure 12.1). Letters mark its regions: y the yellow pars, g the
// green, b the blue, w the brown, o the gray area, e the $500 space that ends the game.
const Grid: readonly (readonly string[])[] = [
    [
        '122',
        '130',
        '138',
        '147',
        '157',
        '167',
        '178',
        '191',
        '213',
        '240',
        '272',
        '312',
        '357',
        '412',
        '500e'
    ],
    [
        '112',
        '120w',
        '127',
        '136',
        '145',
        '154',
        '164',
        '176',
        '197',
        '221',
        '251',
        '287',
        '329',
        '380',
        '443'
    ],
    [
        '102',
        '107',
        '113',
        '119',
        '126',
        '133',
        '140',
        '149',
        '165',
        '184',
        '207',
        '235',
        '267',
        '305',
        '353'
    ],
    [
        '95',
        '100',
        '105b',
        '111',
        '117',
        '124',
        '130',
        '139',
        '153',
        '171',
        '192',
        '218',
        '248',
        '284',
        '328'
    ],
    [
        '87',
        '92',
        '96',
        '101',
        '106',
        '111',
        '117',
        '124',
        '136',
        '151',
        '169',
        '191',
        '216',
        '246',
        '283'
    ],
    ['81', '86', '90', '94g', '99', '104', '109', '116', '127', '141', '158', '179', '202', '230'],
    ['76', '80', '84', '88', '93', '97', '102', '108', '119', '132', '148', '167', '189'],
    ['71o', '75', '78', '82', '86g', '91', '95', '101', '111', '123', '138', '156'],
    ['66o', '70o', '73', '77', '81', '85', '89', '94', '104', '115', '129'],
    ['62o', '65o', '69', '72', '76', '79y', '83', '88', '97', '108'],
    ['58o', '61o', '64o', '67', '71', '74', '78', '82', '91', '101'],
    ['54o', '57o', '60o', '63o', '66', '69', '71y', '77', '85'],
    ['51o', '53o', '56o', '59o', '62', '65', '68', '72', '79'],
    ['47o', '50o', '52o', '55o', '58o', '60', '64', '67y', '74'],
    ['', '47o', '49o', '51o', '54o', '57o', '59'],
    ['', '43o', '46o', '48o', '50o', '53o', '55o'],
    ['', '', '43o', '45o', '47o', '49o', '52o'],
    ['', '', '40o', '42o', '44o', '46o', '48o']
]

const Regions: Readonly<Record<string, string>> = {
    y: 'yellow',
    g: 'green',
    b: 'blue',
    w: 'brown',
    o: 'gray',
    e: 'red'
}

/** The par colours, in the order their phases bring them (§17). */
export const ParColors1828 = ['yellow', 'green', 'blue', 'brown'] as const

const printed = createRectangularStockMarketSpaces(
    Grid.map((row) => row.map((cell) => (cell ? Number.parseInt(cell) : null))),
    (row, column) => Regions[Grid[row][column].replace(/\d/g, '')] ?? 'white'
)

/** A marker moving up from the top of its column moves right instead (§12.2). */
function upFromTheTop(space: StockMarketSpace): StockMarketSpace {
    if (space.row > 0) return space
    const { up: _up, ...moves } = space.moves
    return { ...space, moves: moves.right ? { ...moves, up: moves.right } : moves }
}

export const Market1828 = new StockMarketChart(printed.map(upFromTheTop))

export const stockPrice = (state: Pick<StockState, 'stockMarket'>, companyId: string) =>
    Market1828.companySpace(state.stockMarket, companyId).price

/** The $500 space: a price reaching it ends the game (§9.1). */
export const EndSpaceId1828 = '0:14'
