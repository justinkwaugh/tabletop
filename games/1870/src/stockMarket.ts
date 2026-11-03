import { SoftLedgeMarket } from '@tabletop/18xx'

// Zone letters: p par (the red outlined area), y yellow, g green, b brown, c closed. An i marks
// the lower area, below the ledge (pp. 6-8). The ledge turns rightward moves upward, as the
// market's printed arrows show and Mayfair confirmed against the rulebook's wording.
export const LedgeMarket1870 = new SoftLedgeMarket(
    [
        '64y 68 72 76 82 90 100p 110 120 140 160 180 200 225 250 275 300 325 350 375 400',
        '60y 64y 68 72 76 82 90p 100 110 120 140 160 180 200 225 250 275 300 325 350 375',
        '55y 60y 64y 68 72 76 82p 90 100 110 120 140 160 180 200 225 250i 275i 300i 325i 350i',
        '50g 55y 60y 64y 68 72 76p 82 90 100 110 120 140 160i 180i 200i 225i 250i 275i 300i 325i',
        '40b 50g 55y 60y 64 68 72p 76 82 90 100 110i 120i 140i 160i 180i',
        '30b 40g 50g 55y 60y 64 68p 72 76 82 90i 100i 110i',
        '20b 30b 40g 50g 55y 60y 64 68 72 76i 82i',
        '10b 20b 30b 40g 50y 55y 60y 64 68i 72i',
        '0c 10b 20b 30b 40g 50y 55y 60i 64i',
        '0c 0c 10b 20b 30b 40g 50y',
        '0c 0c 0c 10b 20b 30b 40g'
    ],
    { p: 'pink', y: 'yellow', g: 'green', b: 'brown', c: 'black' }
)
export const Market1870 = LedgeMarket1870.chart
export const SoftLedge1870 = LedgeMarket1870.ledge

/**
 * The par a company's redeemed shares reissue at, by its share price (p. 18). The table names a
 * nearest par to 75% of the price, and the board's par boxes print the same minimums, such as $225
 * for a $160 par. Its $220 for a $300 share is the top row's $225, where the par token is placed.
 */
const ReissueParByPrice: Readonly<Record<number, number>> = {
    100: 76,
    110: 82,
    120: 90,
    140: 110,
    160: 120,
    180: 140,
    200: 140,
    225: 160,
    250: 180,
    275: 200,
    300: 225,
    325: 250,
    350: 250,
    375: 275,
    400: 300
}

export function reissueParForPrice(price: number): number {
    const listed = ReissueParByPrice[price]
    if (listed) return listed
    const target = (price * 3) / 4
    const parPrices = LedgeMarket1870.topRowPrices.filter((par) => par >= 68)
    return parPrices.reduce((best, par) =>
        Math.abs(par - target) < Math.abs(best - target) ? par : best
    )
}
