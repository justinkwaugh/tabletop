import { assert } from '@tabletop/common'
import {
    createRectangularStockMarketSpaces,
    StockMarketChart,
    type StockMarketSpace
} from '@tabletop/18xx'

// The market as printed, top row first. Zone letters: x the red-outlined starting values of major
// and minor companies, p the solid red £50 only a minor starts at (§4.4.1); y the yellow spaces
// whose certificates do not count against the certificate limit (§4.4.2); e the value that ends
// the game (§1.3.1).
const Market: readonly string[] = [
    '- - - - - - - - - - - - - - - - - 550 600 650 700e',
    '- - - - - - - - - - - - - 330 360 400 450 500 550 600 650',
    '- - - - - - - - - 200 220 245 270 300 330 360 400 450 500 550 600',
    '70 80 90 100 110 120 135 150 165 180 200 220 245 270 300 330 360 400 450 500 550',
    '60 70 80 90 100x 110 120 135 150 165 180 200 220 245 270 300 330 360 400 450 500',
    '50 60 70 80 90x 100 110 120 135 150 165 180 200 220 245 270 300 330',
    '45y 50 60 70 80x 90 100 110 120 135 150 165 180 200 220 245',
    '40y 45y 50 60 70x 80 90 100 110 120 135 150 165 180',
    '35y 40y 45y 50 60x 70 80 90 100 110 120 135',
    '30y 35y 40y 45y 50p 60 70 80 90 100',
    '25y 30y 35y 40y 45y 50 60 70 80',
    '20y 25y 30y 35y 40y 45y 50y 60y',
    '15y 20y 25y 30y 35y 40y 45y',
    '10y 15y 20y 25y 30y 35y',
    '5y 10y 15y 20y 25y'
]
const Cells = Market.map((row) => row.split(' '))

export const MarketZoneColors1822 = {
    par: 'pink',
    minorPar: 'red',
    noLimit: 'yellow',
    end: 'orange'
} as const

const Zones: Readonly<Record<string, string>> = {
    x: MarketZoneColors1822.par,
    p: MarketZoneColors1822.minorPar,
    y: MarketZoneColors1822.noLimit,
    e: MarketZoneColors1822.end
}
const zoneOf = (row: number, column: number) => Cells[row][column].replace(/[\d-]/g, '')

/**
 * A marker with no space above it rises diagonally, one space down to the right, where the chart
 * has one (§4.11.1).
 */
function risingFromTheTop(spaces: readonly StockMarketSpace[]): StockMarketSpace[] {
    return spaces.map((space) => {
        const diagonal = spaces.find(
            (other) => other.row === space.row + 1 && other.column === space.column + 1
        )
        return space.moves.up || !diagonal
            ? space
            : { ...space, moves: { ...space.moves, up: diagonal.id } }
    })
}

// Markers move down a space for each share sold (§4.6.3), up for a company wholly in players'
// hands (§4.11.1), and right or left for dividends, up or down instead where a row ends
// (§5.14.5–§5.14.9).
export const Market1822 = new StockMarketChart(
    risingFromTheTop(
        createRectangularStockMarketSpaces(
            Cells.map((row) => row.map((cell) => (cell === '-' ? null : Number.parseInt(cell)))),
            (row, column) => Zones[zoneOf(row, column)] ?? 'white'
        )
    )
)

function spaceIdsIn(zone: string): string[] {
    return Cells.flatMap((row, rowIndex) =>
        row.flatMap((_, column) =>
            zoneOf(rowIndex, column) === zone ? [`${rowIndex}:${column}`] : []
        )
    )
}

/** The starting values of major companies, £100 down to £60 (§3.4.8). */
export const MajorParSpaceIds1822: readonly string[] = spaceIdsIn('x')
/** The £50 space only a minor company starts at (§4.4.1). */
export const MinorOnlyParSpaceId1822 = spaceIdsIn('p')[0]
/** The starting values of minor companies, £100 down to £50 (§3.3.5). */
export const MinorParSpaceIds1822: readonly string[] = [
    ...MajorParSpaceIds1822,
    MinorOnlyParSpaceId1822
]
/** The value that ends the game once a company's marker reaches it (§1.3.1). */
export const EndGameSpaceId1822 = spaceIdsIn('e')[0]
/** Certificates of companies valued here do not count against the certificate limit (§4.4.2). */
export const NoLimitSpaceIds1822: readonly string[] = spaceIdsIn('y')

/**
 * The starting space of a minor company bought for a bid in phase 2 or later: half the bid,
 * rounded down to a starting value, £100 at most (§3.3.5).
 */
export function minorParSpaceId1822(bid: number): string {
    const starts = MinorParSpaceIds1822.map((spaceId) => Market1822.space(spaceId)).filter(
        (space) => space.price * 2 <= bid
    )
    assert(starts.length > 0, 'A minor company is bid for at its face value or more')
    return starts.reduce((best, space) => (space.price > best.price ? space : best)).id
}
