import { SoftLedgeMarket } from '@tabletop/18xx'

// Zone letters: p par (the red outlined area), y yellow, g green, b brown, c closed. An i marks the
// lower area, below the soft ledge (§5.1.1, §5.8.1). Read from the printed board.
export const LedgeMarket1850 = new SoftLedgeMarket(
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
export const Market1850 = LedgeMarket1850.chart
export const SoftLedge1850 = LedgeMarket1850.ledge

/**
 * The par boxes print the lowest share price that may reissue at each (§5.1.2): $76 from $100 up to
 * $200 from $275, the highest par. Those are 75% of the price to the nearest par (§5.11).
 */
const ReissueParMinimums: readonly (readonly [par: number, price: number])[] = [
    [200, 275],
    [180, 250],
    [160, 225],
    [140, 180],
    [120, 160],
    [110, 140],
    [90, 120],
    [82, 110],
    [76, 100]
]
const LowestPar = 68

export function reissueParForPrice(price: number): number {
    return ReissueParMinimums.find(([, minimum]) => price >= minimum)?.[0] ?? LowestPar
}
