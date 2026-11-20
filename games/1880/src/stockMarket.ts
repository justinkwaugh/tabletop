import { createRectangularStockMarketSpaces, StockMarketChart } from '@tabletop/18xx'

// The share price chart (§XIII). Letters mark par spaces (p) and the bonus each row's yellow,
// orange, peach, olive and green spaces pay per share (b 5, w 10, x 15, y 20, z 40).
const Market: readonly (readonly (string | null)[])[] = [
    [
        null,
        null,
        '100',
        '105',
        '110',
        '115b',
        '120b',
        '125b',
        '130w',
        '140w',
        '150x',
        '160x',
        '180y',
        '200z'
    ],
    [
        null,
        '85',
        '95',
        '100p',
        '105',
        '110b',
        '115b',
        '120b',
        '125w',
        '135w',
        '145x',
        '155x',
        '170y',
        '190y'
    ],
    [
        '70',
        '80',
        '90',
        '95',
        '100',
        '105b',
        '110b',
        '115b',
        '120w',
        '130w',
        '140x',
        '150x',
        '165y',
        '180y'
    ],
    ['65', '75', '85', '90p', '95', '100b', '105b', '110b', '115w', '125w', '135x', '145x'],
    ['60', '70', '80', '85', '90', '95b', '100b', '105b', '110w', '120w'],
    ['55', '65', '75', '80p', '85', '90b', '95b', '100b'],
    ['50', '60', '70', '75', '80', '85b', '90b'],
    ['45', '55', '65', '70p', '75', '80b'],
    ['40', '50', '60', '65', '70']
]

/** Bonus per share, by the letter its space carries (§X Bonus from the Share Price Chart). */
const BonusPerShare: Readonly<Record<string, number>> = { b: 5, w: 10, x: 15, y: 20, z: 40 }
const Zones: Readonly<Record<string, string>> = {
    p: 'pink',
    b: 'yellow',
    w: 'orange',
    x: 'peach',
    y: 'olive',
    z: 'green'
}
const letter = (cell: string | null) => cell?.replace(/\d/g, '') ?? ''

export const Market1880 = new StockMarketChart(
    createRectangularStockMarketSpaces(
        Market.map((row) => row.map((cell) => (cell === null ? null : Number.parseInt(cell)))),
        (row, column) => Zones[letter(Market[row][column])] ?? 'white'
    )
)

/** The par spaces, ¥100 at the top (§XII Purchase of Shares). */
export const ParSpaceIds1880: readonly string[] = ['1:3', '3:3', '5:3', '7:3']

/** Each par price may be chosen this many times, one slot each (§XII). */
export const ParSlotsPerPrice = 4

/** A company's income bonus on its space: ten times the space's bonus per share. */
export function marketBonus(spaceId: string): number {
    const [row, column] = spaceId.split(':').map(Number)
    return (BonusPerShare[letter(Market[row]?.[column] ?? null)] ?? 0) * 10
}
