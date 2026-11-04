import { SoftLedgeMarket, type StockMarketSpace } from '@tabletop/18xx'

// Zone letters: p par (red outlined), y yellow, g green, b brown, c closed (black). An i marks
// the lower area, below the soft ledge (§5.1.1, §5.8.1, §5.8.3).
export const EighteenThirtyTwoLedgeMarket = new SoftLedgeMarket(
    [
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
    ],
    { p: 'pink', y: 'yellow', g: 'green', b: 'brown', c: 'black' }
)

export const EighteenThirtyTwoMarket = EighteenThirtyTwoLedgeMarket.chart
export const EighteenThirtyTwoSoftLedge = EighteenThirtyTwoLedgeMarket.ledge

export function isLowerArea(space: StockMarketSpace): boolean {
    return EighteenThirtyTwoLedgeMarket.isLowerArea(space)
}

export function isClosingSpace(space: StockMarketSpace): boolean {
    return space.color === 'black'
}

export function saleDescent(spaceId: string, shares: number): number {
    return EighteenThirtyTwoLedgeMarket.saleDescent(spaceId, shares)
}

// Reissued shares take a par from $68 to $200 (§5.11).
const MinimumReissuePar = 68
export const MaximumReissuePar = 200

/** The par prices a company may reissue at, from the top row of the market (§5.11). */
export const ReissueParPrices: readonly number[] = EighteenThirtyTwoLedgeMarket.topRowPrices.filter(
    (price) => price >= MinimumReissuePar && price <= MaximumReissuePar
)
