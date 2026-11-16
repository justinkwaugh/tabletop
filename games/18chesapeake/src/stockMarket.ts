import {
    createRectangularStockMarketSpaces,
    StockMarketChart,
    type StockMarketSpace
} from '@tabletop/18xx'

// Zone letters follow the printed markets: p par, y yellow, o orange, b brown, e the space whose
// reaching ends an Off the Rails game.
const Standard: readonly (readonly string[])[] = [
    [
        '80',
        '85',
        '90',
        '100',
        '110',
        '125',
        '140',
        '160',
        '180',
        '200',
        '225',
        '250',
        '275',
        '300',
        '325',
        '350',
        '375'
    ],
    [
        '75',
        '80',
        '85',
        '90',
        '100',
        '110',
        '125',
        '140',
        '160',
        '180',
        '200',
        '225',
        '250',
        '275',
        '300',
        '325',
        '350'
    ],
    ['70', '75', '80', '85', '95p', '105', '115', '130', '145', '160', '180', '200'],
    ['65', '70', '75', '80p', '85', '95', '105', '115', '130', '145'],
    ['60', '65', '70p', '75', '80', '85', '95', '105'],
    ['55y', '60', '65', '70', '75', '80'],
    ['50y', '55y', '60', '65'],
    ['40y', '45y', '50y']
]

/** The Off the Rails market board, laid over the printed one. */
const OffTheRails: readonly (readonly string[])[] = [
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
        '300e'
    ],
    ['70', '76', '82', '90p', '100', '112', '126', '142', '160', '180', '200', '220', '240', '260'],
    ['65', '70', '76', '82p', '90', '100', '111', '125', '140', '155', '170', '185'],
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

function spaces(grid: readonly (readonly string[])[]): StockMarketSpace[] {
    return createRectangularStockMarketSpaces(
        grid.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[grid[row][column].replace(/\d/g, '')] ?? 'white'
    )
}

/** The Off the Rails spaces, their ids apart from the printed market's. */
const OffTheRailsPrefix = 'otr:'
const offTheRailsSpaces: StockMarketSpace[] = spaces(OffTheRails).map((space) => ({
    ...space,
    id: `${OffTheRailsPrefix}${space.id}`,
    moves: Object.fromEntries(
        Object.entries(space.moves).map(([move, id]) => [move, `${OffTheRailsPrefix}${id}`])
    )
}))

/** The printed market alone, as the table draws it. */
export const StandardMarketChesapeake = new StockMarketChart(spaces(Standard))
/** The Off the Rails market alone, as the table draws it. */
export const OffTheRailsMarketChesapeake = new StockMarketChart(offTheRailsSpaces)

/**
 * Both markets, unconnected: a game uses one of them, its companies starting at its par spaces
 * and moving only along its own spaces.
 */
export const MarketChesapeake = new StockMarketChart([
    ...StandardMarketChesapeake.spaces,
    ...offTheRailsSpaces
])

/** The space whose reaching ends an Off the Rails game. */
export const EndSpaceIdChesapeake = `${OffTheRailsPrefix}0:13`
