import {
    createRectangularStockMarket,
    stockMarketSpace,
    type StockMarket,
    type StockMarketSpace
} from '@tabletop/18xx'

// Zone letters: p par (red outlined), y yellow, g green, b brown, c closed (black). An i marks
// the lower area, below the soft ledge (§5.1.1).
const Market: readonly (readonly string[])[] = [
    '64y 68 72 76 82 90 100p 110 120 140 160 180 200 225 250 275 300 325 350 375 400',
    '60y 64y 68 72 76 82 90p 100 110 120 140 160 180 200 225 250 275 300 325 350 375',
    '55y 60y 64y 68 72 76 82p 90 100 110 120 140 160 180 200 225 250i 275i 300i 325i 350i',
    '50g 55y 60y 64y 68 72 76p 82 90 100 110 120 140 160i 180i 200i 225i 250i 275i 300i 325i',
    '40g 50g 55y 60y 64 68 72p 76 82 90 100 110i 120i 140i 160i 180i',
    '30b 40g 50g 55y 60y 64 68p 72 76 82 90i 100i 110i',
    '20b 30b 40g 50g 55y 60 64 68 72 76i 82i',
    '10b 20b 30b 40g 50y 55y 60 64 68i 72i',
    '0c 10b 20b 30b 40g 50y 55y 60i 64i',
    '0c 0c 10b 20b 30b 40g 50y',
    '0c 0c 0c 10b 20b 30b 40g'
].map((row) => row.split(' '))

const Zones: Readonly<Record<string, string>> = {
    p: 'pink',
    y: 'yellow',
    g: 'green',
    b: 'brown',
    c: 'black'
}

const inLowerArea = (cell: string | undefined) => !!cell?.endsWith('i')

export const EighteenThirtyTwoLowerAreaSpaceIds: ReadonlySet<string> = new Set(
    Market.flatMap((row, rowIndex) =>
        row.flatMap((cell, column) => (inLowerArea(cell) ? [`${rowIndex}:${column}`] : []))
    )
)

/** The sides of upper-area spaces that border the lower area: the soft ledge's course. */
export const EighteenThirtyTwoSoftLedge: readonly { spaceId: string; side: 'bottom' | 'right' }[] =
    Market.flatMap((row, rowIndex) =>
        row.flatMap((cell, column) => {
            if (inLowerArea(cell)) return []
            return [
                ...(inLowerArea(Market[rowIndex + 1]?.[column]) ? (['bottom'] as const) : []),
                ...(inLowerArea(row[column + 1]) ? (['right'] as const) : [])
            ].map((side) => ({ spaceId: `${rowIndex}:${column}`, side }))
        })
    )

export function isLowerArea(space: StockMarketSpace): boolean {
    return EighteenThirtyTwoLowerAreaSpaceIds.has(space.id)
}

export function isClosingSpace(space: StockMarketSpace): boolean {
    return space.color === 'black'
}

/**
 * A token moving down onto the soft ledge with exactly one more space to fall stops on the
 * ledge (§5.8.1); otherwise it falls one space per share until the lower ledge.
 */
export function saleDescent(market: StockMarket, spaceId: string, shares: number): number {
    let space = stockMarketSpace(market, spaceId)
    let spaces = 0
    for (let remaining = shares; remaining > 0; remaining--) {
        const below = space.moves.down
        if (!below) break
        const next = stockMarketSpace(market, below)
        if (remaining === 1 && !isLowerArea(space) && isLowerArea(next)) break
        space = next
        spaces++
    }
    return spaces
}

// Reissued shares take a par from $68 to $200 (§5.11).
const MinimumReissuePar = 68
export const MaximumReissuePar = 200

/** The par prices a company may reissue at, from the top row of the market (§5.11). */
export const ReissueParPrices: readonly number[] = Market[0]
    .map((cell) => Number.parseInt(cell))
    .filter((price) => price >= MinimumReissuePar && price <= MaximumReissuePar)

export function createEighteenThirtyTwoStockMarket(): StockMarket {
    const market = createRectangularStockMarket(
        Market.map((row) => row.map((cell) => Number.parseInt(cell))),
        (row, column) => Zones[Market[row][column].replace(/[\di]/g, '')] ?? 'white'
    )
    for (const space of market.spaces) {
        const right = space.moves.right && stockMarketSpace(market, space.moves.right)
        // The soft ledge also stops rightward moves, which go up instead (§5.8.3).
        if (right && !isLowerArea(space) && isLowerArea(right)) {
            if (space.moves.up) space.moves.right = space.moves.up
            else delete space.moves.right
        }
        // A token at the top moves right and down instead of up (§5.8.1).
        if (space.row === 0 && space.moves.right) {
            const diagonal = stockMarketSpace(market, space.moves.right).moves.down
            if (diagonal) space.moves.up = diagonal
        }
    }
    return market
}
