import { assertExists } from '@tabletop/common'
import {
    StockMarketChart,
    createRectangularStockMarketSpaces,
    type StockMarketSpace
} from '@tabletop/18xx'

// The grid market as printed, top row first (§6). Zone
// letters: x the brown spaces only a minor starts on (R50–R65, §9.2); p the red spaces either kind
// of company starts on (R70–R135, §9.2, §9.3); z the purple spaces only a public company starts on
// (R150–R200, §9.3); m the yellow seventh column, R100–R165, where a minor may convert (§12.2) and
// beyond which no minor moves right (§10.7).
const Market: readonly string[] = [
    '- - - - 135 150 165m 180 200z 220 245 270 300 330 360 400 440 490 540',
    '- - - 110 120 135 150m 165z 180z 200 220 245 270 300 330 360 400 440 490',
    '- - 90 100 110 120 135pm 150z 165 180 200 220 245 270 300 330 360 400 440',
    '- 70 80 90 100 110p 120pm 135 150 165 180 200',
    '60 65 70 80 90p 100p 110m 120 135 150',
    '55 60 65 70p 80p 90 100m 110',
    '50 55 60x 65x 70 80',
    '45 50x 55x 60 65',
    '40 45 50 55',
    '35 40 45'
]
const Cells = Market.map((row) => row.split(' '))

export const MarketZoneColors1861 = {
    minorStart: 'brown',
    start: 'red',
    majorStart: 'purple',
    convert: 'yellow'
} as const

const zonesOf = (row: number, column: number) => Cells[row][column].replace(/[\d-]/g, '')

function color(row: number, column: number): string {
    const zones = zonesOf(row, column)
    if (zones.includes('x')) return MarketZoneColors1861.minorStart
    if (zones.includes('p')) return MarketZoneColors1861.start
    if (zones.includes('z')) return MarketZoneColors1861.majorStart
    if (zones.includes('m')) return MarketZoneColors1861.convert
    return 'white'
}

/** The seventh column: minors convert from it and rise up it rather than move right (§10.7, §12.2). */
export const MinorCapColumn = 6
/**
 * The move a minor's marker makes for earnings: right, or up where its row ends or at the seventh
 * column, and not at all at the column's top (§10.7).
 */
export const MinorRightMove = 'minorRight'

/**
 * A step left, or down where the row ends on the left, as a price falls for earning nothing, for
 * nationalisation and for each loan at the game's end (§10.7, §11, §13).
 */
export const LeftOrDownMove = 'leftOrDown'

const spaceId = (row: number, column: number) => `${row}:${column}`
const exists = (row: number, column: number) =>
    row >= 0 &&
    row < Cells.length &&
    column >= 0 &&
    Cells[row][column] !== undefined &&
    Cells[row][column] !== '-'

/**
 * A public company's marker that would rise from the top row moves right and down instead, to the
 * same price (§9.5); a minor's never rises from it (§10.7). Minors move right only up to the
 * seventh column.
 */
function withTitleMoves(spaces: readonly StockMarketSpace[]): StockMarketSpace[] {
    return spaces.map((space) => {
        const { row, column } = space
        const moves = { ...space.moves }
        const up = exists(row - 1, column) ? spaceId(row - 1, column) : undefined
        const minorRight =
            column < MinorCapColumn && exists(row, column + 1) ? spaceId(row, column + 1) : up
        if (column <= MinorCapColumn && minorRight) moves[MinorRightMove] = minorRight
        if (row === 0 && exists(row + 1, column + 1)) moves.up = spaceId(row + 1, column + 1)
        const leftOrDown = moves.left ?? moves.down
        if (leftOrDown) moves[LeftOrDownMove] = leftOrDown
        return { ...space, moves }
    })
}

// Markers move down a row when a director sells (§9.1), up for a public company wholly in
// players' hands (§9.5), and right or left for earnings, up or down instead where a row ends
// (§10.7).
export const Market1861 = new StockMarketChart(
    withTitleMoves(
        createRectangularStockMarketSpaces(
            Cells.map((row) => row.map((cell) => (cell === '-' ? null : Number.parseInt(cell)))),
            color
        )
    )
)

const zoned = (zone: string) =>
    Market1861.spaces.filter((space) => zonesOf(space.row, space.column).includes(zone))
const byPrice = (spaces: readonly StockMarketSpace[]) =>
    spaces.toSorted((a, b) => a.price - b.price)

/** The spaces a minor starts on, cheapest first: R50 to R135 (§9.2). */
export const MinorStartSpaces1861: readonly StockMarketSpace[] = byPrice([
    ...zoned('x'),
    ...zoned('p')
])
/** The spaces a public company starts on, cheapest first: R70 to R200 (§9.3, §12). */
export const MajorStartSpaces1861: readonly StockMarketSpace[] = byPrice([
    ...zoned('p'),
    ...zoned('z')
])
export const MajorStartSpaceIds1861: readonly string[] = MajorStartSpaces1861.map(({ id }) => id)
/** The highest price a merger sets (§12.3). */
export const MaximumMergerPrice = 200

/**
 * Where a minor starts after an auction won at this amount: the start space of half the amount,
 * rounded down to the next available value (§9.2).
 */
export function minorStartSpace(amountPaid: number): StockMarketSpace {
    const half = Math.floor(amountPaid / 2)
    const space = MinorStartSpaces1861.findLast((candidate) => candidate.price <= half)
    assertExists(space, `No minor start space for R${amountPaid}`)
    return space
}

/**
 * The public company start space of a price, rounded down to the next available value, and at
 * most R200: for a conversion the minor's price (§12.2), for a merger the highest and lowest
 * merging prices added (§12.3).
 */
export function majorStartSpaceAtOrBelow(price: number): StockMarketSpace {
    const capped = Math.min(price, MaximumMergerPrice)
    const space = MajorStartSpaces1861.findLast((candidate) => candidate.price <= capped)
    assertExists(space, `No public company start space for R${price}`)
    return space
}

/** Whether a minor on this space may convert to a public company (§12.2). */
export function convertible(space: StockMarketSpace): boolean {
    return space.column === MinorCapColumn && space.price >= 100 && space.price <= 165
}
