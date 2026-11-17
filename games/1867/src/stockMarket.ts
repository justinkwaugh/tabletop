import { assertExists } from '@tabletop/common'
import {
    StockMarketChart,
    createLinearStockMarketSpaces,
    type StockMarketSpace
} from '@tabletop/18xx'

// The Column Market, the 1867 default (§4). Zone letters: x the orange spaces only a minor starts
// on, $50–$65; p the pink spaces either kind of company starts on, $70–$135; c the blue spaces
// from which a minor may convert, $100–$165; z the teal spaces only a major starts on, $150–$200
// (§4.1, §7.2.1, §7.4, §9.1). The thick border stands right of $165: no minor moves past it (§4.3).
const Market: readonly string[] = [
    '35',
    '40',
    '45',
    '50x',
    '55x',
    '60x',
    '65x',
    '70p',
    '80p',
    '90p',
    '100pc',
    '110pc',
    '120pc',
    '135pc',
    '150cz',
    '165cz',
    '180z',
    '200z',
    '220',
    '245',
    '270',
    '300',
    '330',
    '360',
    '400',
    '440',
    '490',
    '540'
]

export const MarketZoneColors1867 = {
    minorStart: 'orange',
    start: 'pink',
    convert: 'blue',
    majorStart: 'teal'
} as const

const zonesAt = (price: number) => {
    const cell = Market.find((entry) => Number.parseInt(entry) === price)
    assertExists(cell, `No market space at $${price}`)
    return cell.replace(/\d/g, '')
}

// The blue convert range overlaps the pink and teal start ranges; a space shows one colour, so
// it shows blue where a minor may convert, the rule only that range sets.
function color(price: number): string {
    const zones = zonesAt(price)
    if (zones.includes('x')) return MarketZoneColors1867.minorStart
    if (zones.includes('c')) return MarketZoneColors1867.convert
    if (zones.includes('p')) return MarketZoneColors1867.start
    if (zones.includes('z')) return MarketZoneColors1867.majorStart
    return 'white'
}

/** The highest price a minor's marker reaches; it stays there for a dividend (§4.3). */
export const MinorMaximumPrice = 165
/** The move a minor's marker makes for a dividend: right, but not past $165 (§4.3). */
export const MinorRightMove = 'minorRight'
/**
 * A step left, as a price falls for no dividend, a President's sale, nationalisation and each
 * loan (§4.3, §7.3.1, §10.1).
 */
export const LeftMove = 'left'

function withMinorMoves(spaces: readonly StockMarketSpace[]): StockMarketSpace[] {
    return spaces.map((space) => {
        const right = space.moves.right
        return right && space.price < MinorMaximumPrice
            ? { ...space, moves: { ...space.moves, [MinorRightMove]: right } }
            : space
    })
}

// One row: right for a dividend at least the price, a minor's dividend or a sold-out major, left
// otherwise; the family's up and down moves run along the row (§4.3).
export const Market1867 = new StockMarketChart(
    withMinorMoves(
        createLinearStockMarketSpaces(
            Market.map((cell) => Number.parseInt(cell)),
            color
        )
    )
)

const zoned = (zone: string) =>
    Market1867.spaces.filter((space) => zonesAt(space.price).includes(zone))
const byPrice = (spaces: readonly StockMarketSpace[]) =>
    [...new Set(spaces)].toSorted((a, b) => a.price - b.price)

/** The spaces a minor starts on, cheapest first: $50 to $135 (§7.2.1). */
export const MinorStartSpaces1867: readonly StockMarketSpace[] = byPrice([
    ...zoned('x'),
    ...zoned('p')
])
/** The spaces a major starts on from a stock round, cheapest first: $70 to $200 (§7.4). */
export const MajorStartSpaces1867: readonly StockMarketSpace[] = byPrice([
    ...zoned('p'),
    ...zoned('z')
])
export const MajorStartSpaceIds1867: readonly string[] = MajorStartSpaces1867.map(({ id }) => id)
/** The highest price a merger sets (§9.2). */
export const MaximumMergerPrice = 200

/**
 * Where a minor starts after an auction won at this amount: the start space of half the amount,
 * rounded down to the next available value (§7.2.1).
 */
export function minorStartSpace(amountPaid: number): StockMarketSpace {
    const half = Math.floor(amountPaid / 2)
    const space = MinorStartSpaces1867.findLast((candidate) => candidate.price <= half)
    assertExists(space, `No minor start space for $${amountPaid}`)
    return space
}

/**
 * The major start space of a price, rounded down to the next available value, and at most $200:
 * for a conversion the minor's price (§9.1), for a merger the highest and lowest merging prices
 * added (§9.2).
 */
export function majorStartSpaceAtOrBelow(price: number): StockMarketSpace {
    const capped = Math.min(price, MaximumMergerPrice)
    const space = MajorStartSpaces1867.findLast((candidate) => candidate.price <= capped)
    assertExists(space, `No major start space for $${price}`)
    return space
}

/** Whether a minor on this space may convert to a major company, from $100 to $165 (§9.1). */
export function convertible(space: StockMarketSpace): boolean {
    return zonesAt(space.price).includes('c')
}
